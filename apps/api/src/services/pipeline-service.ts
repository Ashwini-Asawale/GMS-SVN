import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../config.js';
import { writeAuditLog } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { getAgentOrchestrator } from './agent-orchestrator.js';
import { enqueuePipelineDispatch } from './pipeline-worker.js';

export function signPipelinePayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function verifyPipelineSignature(secret: string, body: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = signPipelinePayload(secret, body);
  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch {
    return false;
  }
}

function serializeConfig(config: {
  id: string;
  repositoryId: string;
  enabled: boolean;
  webhookUrl: string | null;
  webhookSecret: string | null;
  triggerPaths: string[];
  triggerBranches: string[];
  hookInstalled: boolean;
  updatedAt: Date;
}) {
  return {
    id: config.id,
    repositoryId: config.repositoryId,
    enabled: config.enabled,
    webhookUrl: config.webhookUrl,
    hasWebhookSecret: Boolean(config.webhookSecret),
    triggerPaths: config.triggerPaths,
    triggerBranches: config.triggerBranches,
    hookInstalled: config.hookInstalled,
    updatedAt: config.updatedAt.toISOString(),
  };
}

function serializeBuild(build: {
  id: string;
  repositoryId: string;
  revision: number;
  status: string;
  durationMs: number | null;
  logUrl: string | null;
  externalBuildId: string | null;
  errorMessage: string | null;
  changedPaths: string[];
  author: string | null;
  triggeredAt: Date;
  completedAt: Date | null;
}) {
  return {
    id: build.id,
    repositoryId: build.repositoryId,
    revision: build.revision,
    status: build.status,
    durationMs: build.durationMs,
    logUrl: build.logUrl,
    externalBuildId: build.externalBuildId,
    errorMessage: build.errorMessage,
    changedPaths: build.changedPaths,
    author: build.author,
    triggeredAt: build.triggeredAt.toISOString(),
    completedAt: build.completedAt?.toISOString() ?? null,
  };
}

function matchesTriggers(
  changedPaths: string[],
  triggerPaths: string[],
  triggerBranches: string[],
): boolean {
  if (changedPaths.length === 0) return true;

  return changedPaths.some((cp) => {
    const normalized = cp.startsWith('/') ? cp : `/${cp}`;
    if (triggerPaths.some((tp) => normalized === tp || normalized.startsWith(`${tp}/`))) return true;
    return triggerBranches.some((branch) => {
      const prefix = `/${branch}`;
      return normalized === prefix || normalized.startsWith(`${prefix}/`);
    });
  });
}

export async function getOrCreatePipelineConfig(repositoryId: string) {
  const existing = await prisma.repoPipelineConfig.findUnique({ where: { repositoryId } });
  if (existing) return serializeConfig(existing);

  const created = await prisma.repoPipelineConfig.create({
    data: { repositoryId },
  });
  return serializeConfig(created);
}

export async function updatePipelineConfig(
  repositoryId: string,
  userId: string,
  data: {
    enabled?: boolean;
    webhookUrl?: string | null;
    webhookSecret?: string | null;
    triggerPaths?: string[];
    triggerBranches?: string[];
  },
) {
  await prisma.repository.findUniqueOrThrow({ where: { id: repositoryId } });
  const config = await prisma.repoPipelineConfig.upsert({
    where: { repositoryId },
    create: {
      repositoryId,
      enabled: data.enabled ?? false,
      webhookUrl: data.webhookUrl ?? null,
      webhookSecret: data.webhookSecret ?? null,
      triggerPaths: data.triggerPaths ?? ['/trunk'],
      triggerBranches: data.triggerBranches ?? ['trunk'],
    },
    update: {
      enabled: data.enabled,
      webhookUrl: data.webhookUrl,
      webhookSecret: data.webhookSecret,
      triggerPaths: data.triggerPaths,
      triggerBranches: data.triggerBranches,
    },
  });

  await writeAuditLog({
    action: 'settings.updated',
    userId,
    repositoryId,
    metadata: { pipelineConfig: true, enabled: config.enabled },
  });

  return serializeConfig(config);
}

export async function listPipelineBuilds(repositoryId: string, limit = 50) {
  const builds = await prisma.pipelineBuild.findMany({
    where: { repositoryId },
    orderBy: { triggeredAt: 'desc' },
    take: limit,
  });
  return builds.map(serializeBuild);
}

export async function handlePostCommit(
  config: AppConfig,
  input: {
    repositoryName: string;
    revision: number;
    author?: string;
    changedPaths?: string[];
  },
) {
  const repos = await prisma.repository.findMany({
    where: { name: input.repositoryName, status: 'ACTIVE' },
  });
  if (repos.length === 0) {
    return { accepted: false, reason: 'Repository not found' };
  }

  let lastResult: Record<string, unknown> = { accepted: false, reason: 'No pipeline processed' };

  for (const repo of repos) {
    await prisma.repository.update({
      where: { id: repo.id },
      data: {
        latestRevision: input.revision,
        updatedAt: new Date(),
      },
    });

    const pipeline = await prisma.repoPipelineConfig.findUnique({ where: { repositoryId: repo.id } });
    if (!pipeline?.enabled) {
      lastResult = { accepted: true, skipped: true, reason: 'Pipeline disabled', revision: input.revision };
      continue;
    }

    const existing = await prisma.pipelineBuild.findUnique({
      where: { repositoryId_revision: { repositoryId: repo.id, revision: input.revision } },
    });
    if (existing) {
      lastResult = { accepted: true, duplicate: true, buildId: existing.id };
      continue;
    }

    const changedPaths = input.changedPaths ?? [];
    if (!matchesTriggers(changedPaths, pipeline.triggerPaths, pipeline.triggerBranches)) {
      const skipped = await prisma.pipelineBuild.create({
        data: {
          repositoryId: repo.id,
          configId: pipeline.id,
          revision: input.revision,
          status: 'SKIPPED',
          author: input.author,
          changedPaths,
          completedAt: new Date(),
          idempotencyKey: `build-${repo.id}-${input.revision}`,
        },
      });
      lastResult = { accepted: true, skipped: true, buildId: skipped.id, reason: 'Path filter mismatch' };
      continue;
    }

    if (!pipeline.webhookUrl) {
      const skipped = await prisma.pipelineBuild.create({
        data: {
          repositoryId: repo.id,
          configId: pipeline.id,
          revision: input.revision,
          status: 'SKIPPED',
          author: input.author,
          changedPaths,
          errorMessage: 'No webhook URL configured',
          completedAt: new Date(),
          idempotencyKey: `build-${repo.id}-${input.revision}`,
        },
      });
      lastResult = { accepted: true, skipped: true, buildId: skipped.id, reason: 'No webhook URL' };
      continue;
    }

    const build = await prisma.pipelineBuild.create({
      data: {
        repositoryId: repo.id,
        configId: pipeline.id,
        revision: input.revision,
        status: 'QUEUED',
        author: input.author,
        changedPaths,
        idempotencyKey: `build-${repo.id}-${input.revision}`,
      },
    });

    await writeAuditLog({
      action: 'pipeline.triggered',
      repositoryId: repo.id,
      metadata: {
        buildId: build.id,
        revision: input.revision,
        repositoryName: repo.name,
      },
    });

    void enqueuePipelineDispatch(config, build.id);

    lastResult = { accepted: true, buildId: build.id, queued: true };
  }

  return lastResult;
}

export async function dispatchPipelineWebhook(config: AppConfig, buildId: string) {
  const build = await prisma.pipelineBuild.findUniqueOrThrow({
    where: { id: buildId },
    include: { repository: true, config: true },
  });

  if (!build.config?.webhookUrl) {
    throw new Error('Webhook URL not configured');
  }

  const secret = build.config.webhookSecret ?? config.pipelineHookSecret;
  const callbackUrl = `${config.apiPublicUrl.replace(/\/$/, '')}/hooks/build-callback`;
  const payload = {
    event: 'svn.post_commit',
    buildId: build.id,
    repository: build.repository.name,
    repositoryId: build.repositoryId,
    revision: build.revision,
    author: build.author,
    changedPaths: build.changedPaths,
    callbackUrl,
  };
  const body = JSON.stringify(payload);
  const signature = signPipelinePayload(secret, body);

  await prisma.pipelineBuild.update({
    where: { id: buildId },
    data: { status: 'RUNNING' },
  });

  const start = Date.now();
  try {
    const res = await fetch(build.config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GMS-SVN-Event': 'svn.post_commit',
        'X-GMS-SVN-Signature': signature,
      },
      body,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Webhook returned ${res.status}: ${text.slice(0, 200)}`);
    }

    const externalBuildId =
      res.headers.get('X-Build-Id') ??
      (await res.json().catch(() => ({})) as { buildId?: string }).buildId ??
      null;

    await prisma.pipelineBuild.update({
      where: { id: buildId },
      data: {
        externalBuildId: externalBuildId ?? undefined,
        durationMs: Date.now() - start,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook dispatch failed';
    await prisma.pipelineBuild.update({
      where: { id: buildId },
      data: {
        status: 'FAILED',
        errorMessage: message,
        durationMs: Date.now() - start,
        completedAt: new Date(),
      },
    });

    await writeAuditLog({
      action: 'pipeline.failed',
      repositoryId: build.repositoryId,
      metadata: { buildId, revision: build.revision, error: message },
    });

    throw err;
  }
}

export async function handleBuildCallback(
  buildId: string,
  input: {
    status: 'SUCCESS' | 'FAILED' | 'RUNNING';
    durationMs?: number;
    logUrl?: string;
    externalBuildId?: string;
    errorMessage?: string;
  },
) {
  const build = await prisma.pipelineBuild.findUnique({ where: { id: buildId } });
  if (!build) throw new Error('Build not found');

  const updated = await prisma.pipelineBuild.update({
    where: { id: buildId },
    data: {
      status: input.status,
      durationMs: input.durationMs ?? build.durationMs,
      logUrl: input.logUrl ?? build.logUrl,
      externalBuildId: input.externalBuildId ?? build.externalBuildId,
      errorMessage: input.errorMessage ?? build.errorMessage,
      completedAt: input.status === 'RUNNING' ? null : new Date(),
    },
  });

  if (input.status === 'SUCCESS' || input.status === 'FAILED') {
    await writeAuditLog({
      action: input.status === 'SUCCESS' ? 'pipeline.completed' : 'pipeline.failed',
      repositoryId: build.repositoryId,
      metadata: {
        buildId,
        revision: build.revision,
        durationMs: updated.durationMs,
        logUrl: updated.logUrl,
      },
    });
  }

  return serializeBuild(updated);
}

export async function installPostCommitHook(
  config: AppConfig,
  repositoryId: string,
  userId: string,
  scriptPath: string,
) {
  const repo = await prisma.repository.findUniqueOrThrow({ where: { id: repositoryId } });
  const orchestrator = getAgentOrchestrator(config);

  await orchestrator.dispatchCommand(
    'InstallHook',
    { repositoryName: repo.name, hookType: 'post-commit', scriptPath },
    {
      repositoryId,
      requestedById: userId,
      idempotencyKey: `install-hook-${repositoryId}-post-commit`,
    },
  );

  const pipeline = await prisma.repoPipelineConfig.upsert({
    where: { repositoryId },
    create: { repositoryId, hookInstalled: true },
    update: { hookInstalled: true },
  });

  await writeAuditLog({
    action: 'pipeline.hook_installed',
    userId,
    repositoryId,
    metadata: { repositoryName: repo.name, scriptPath },
  });

  return serializeConfig(pipeline);
}

export async function getLatestBuildStatuses(repositoryIds: string[]) {
  if (repositoryIds.length === 0) return new Map<string, string>();

  const builds = await prisma.pipelineBuild.findMany({
    where: { repositoryId: { in: repositoryIds } },
    orderBy: { triggeredAt: 'desc' },
    distinct: ['repositoryId'],
    select: { repositoryId: true, status: true },
  });

  return new Map(builds.map((b: { repositoryId: string; status: string }) => [b.repositoryId, b.status]));
}

export function resolveHookSecret(
  config: AppConfig,
  pipelineSecret: string | null | undefined,
): string {
  return pipelineSecret ?? config.pipelineHookSecret;
}
