import type { AccessLevel, PrincipalType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getPlatformSettings } from '../lib/platform-settings.js';
import { writeAuditLog } from '../lib/audit.js';
import { getAgentOrchestrator } from './agent-orchestrator.js';
import type { AppConfig } from '../config.js';
import {
  svnDirectAvailable,
  svnDirectCreateBranch,
  svnDirectListPath,
  type SvnDirectSettings,
} from '../lib/svn-direct.js';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function toAgentAccess(access: AccessLevel): 'read' | 'write' | 'none' {
  if (access === 'READ') return 'read';
  if (access === 'WRITE') return 'write';
  return 'none';
}

function toAgentPrincipal(type: PrincipalType): 'user' | 'group' {
  return type === 'USER' ? 'user' : 'group';
}

export function serializeRepository(r: {
  id: string;
  name: string;
  slug: string;
  svnUrl: string | null;
  status: string;
  latestRevision: number | null;
  sizeBytes: bigint | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...r,
    sizeBytes: r.sizeBytes?.toString() ?? null,
  };
}

export async function getRepository(tenantId: string, id: string) {
  const repo = await prisma.repository.findFirst({
    where: { id, tenantId },
    include: { accessRules: { orderBy: [{ path: 'asc' }, { principalName: 'asc' }] } },
  });
  if (!repo) return null;
  return {
    ...serializeRepository(repo),
    accessRules: repo.accessRules,
  };
}

export async function updateRepository(
  _config: AppConfig,
  tenantId: string,
  id: string,
  data: { name?: string; status?: 'ACTIVE' | 'ARCHIVED' },
  userId: string,
) {
  const repo = await prisma.repository.findFirst({ where: { id, tenantId } });
  if (!repo) throw new Error('Repository not found');

  if (data.name && data.name !== repo.name) {
    const taken = await prisma.repository.findFirst({
      where: {
        tenantId,
        OR: [{ name: data.name }, { slug: slugify(data.name) }],
        NOT: { id },
      },
    });
    if (taken) throw new Error('Repository name already exists');

    const settings = await getPlatformSettings(tenantId);
    const updated = await prisma.repository.update({
      where: { id },
      data: {
        name: data.name,
        slug: slugify(data.name),
        svnUrl: repo.status === 'ACTIVE'
          ? `${settings.visualsvnUrl.replace(/\/$/, '')}/${data.name}`
          : repo.svnUrl,
      },
    });

    await writeAuditLog({
      action: 'repo.updated',
      tenantId,
      userId,
      repositoryId: id,
      metadata: { previousName: repo.name, name: data.name },
    });

    return serializeRepository(updated);
  }

  if (data.status === 'ARCHIVED') {
    const updated = await prisma.repository.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
    await writeAuditLog({
      action: 'repo.archived',
      tenantId,
      userId,
      repositoryId: id,
      metadata: { name: repo.name },
    });
    return serializeRepository(updated);
  }

  return serializeRepository(repo);
}

export async function addAccessRule(
  config: AppConfig,
  tenantId: string,
  repositoryId: string,
  input: {
    path: string;
    principalType: PrincipalType;
    principalName: string;
    access: AccessLevel;
  },
  userId: string,
) {
  const repo = await prisma.repository.findFirst({ where: { id: repositoryId, tenantId } });
  if (!repo || repo.status === 'ARCHIVED') throw new Error('Repository not available');

  const orchestrator = getAgentOrchestrator(config);
  await orchestrator.executeQuery(
    'SetAccessRule',
    {
      repositoryName: repo.name,
      path: input.path,
      principalType: toAgentPrincipal(input.principalType),
      principalName: input.principalName,
      access: toAgentAccess(input.access),
    },
    { repositoryId, requestedById: userId },
  );

  const rule = await prisma.repoAccessRule.upsert({
    where: {
      repositoryId_path_principalType_principalName: {
        repositoryId,
        path: input.path,
        principalType: input.principalType,
        principalName: input.principalName,
      },
    },
    create: { repositoryId, ...input },
    update: { access: input.access },
  });

  await writeAuditLog({
    action: 'access_rule.created',
    tenantId,
    userId,
    repositoryId,
    metadata: { ruleId: rule.id, ...input },
  });

  return rule;
}

export async function removeAccessRule(
  config: AppConfig,
  tenantId: string,
  repositoryId: string,
  ruleId: string,
  userId: string,
) {
  const rule = await prisma.repoAccessRule.findFirst({
    where: { id: ruleId, repositoryId, repository: { tenantId } },
  });
  if (!rule) throw new Error('Access rule not found');

  const repo = await prisma.repository.findFirstOrThrow({ where: { id: repositoryId, tenantId } });

  const orchestrator = getAgentOrchestrator(config);
  await orchestrator.executeQuery(
    'RemoveAccessRule',
    {
      repositoryName: repo.name,
      path: rule.path,
      principalType: toAgentPrincipal(rule.principalType),
      principalName: rule.principalName,
    },
    { repositoryId, requestedById: userId },
  );

  await prisma.repoAccessRule.delete({ where: { id: ruleId } });

  await writeAuditLog({
    action: 'access_rule.removed',
    tenantId,
    userId,
    repositoryId,
    metadata: { ruleId, path: rule.path, principalName: rule.principalName },
  });
}

export async function browseRepository(
  config: AppConfig,
  tenantId: string,
  repositoryId: string,
  path: string,
  userId: string,
) {
  const repo = await prisma.repository.findFirstOrThrow({ where: { id: repositoryId, tenantId } });
  const orchestrator = getAgentOrchestrator(config);
  const data = await orchestrator.executeQuery(
    'ListPath',
    { repositoryName: repo.name, path },
    { repositoryId, requestedById: userId },
  );
  return data;
}

export async function getRepositoryLog(
  config: AppConfig,
  tenantId: string,
  repositoryId: string,
  path: string,
  limit: number,
  userId: string,
) {
  const repo = await prisma.repository.findFirstOrThrow({ where: { id: repositoryId, tenantId } });
  const orchestrator = getAgentOrchestrator(config);
  const data = await orchestrator.executeQuery(
    'GetLog',
    { repositoryName: repo.name, path, limit },
    { repositoryId, requestedById: userId, tenantId },
  );
  return enrichRepositoryLogAuthors(tenantId, data);
}

async function enrichRepositoryLogAuthors(
  tenantId: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const entries = (data.entries as {
    revision: number;
    author: string;
    authorEmail?: string | null;
    authorDisplay?: string;
    date: string;
    message: string;
    paths: { path: string; action: string }[];
  }[]) ?? [];

  if (entries.length === 0) return data;

  const authorNames = [...new Set(entries.map((e) => e.author).filter(Boolean))];
  const users =
    authorNames.length > 0
      ? await prisma.user.findMany({
          where: { tenantId, username: { in: authorNames } },
          select: { username: true, email: true },
        })
      : [];
  const emailByUsername = new Map(users.map((u) => [u.username, u.email]));

  return {
    ...data,
    entries: entries.map((entry) => {
      const email = entry.author ? (emailByUsername.get(entry.author) ?? null) : null;
      const author = entry.author?.trim() || '';
      const authorDisplay = author
        ? email
          ? `${author} <${email}>`
          : author
        : '(no author)';
      return {
        ...entry,
        authorEmail: email,
        authorDisplay,
      };
    }),
  };
}

export async function getRepositoryDiff(
  config: AppConfig,
  tenantId: string,
  repositoryId: string,
  path: string,
  revision: number,
  userId: string,
) {
  const repo = await prisma.repository.findFirstOrThrow({ where: { id: repositoryId, tenantId } });
  const orchestrator = getAgentOrchestrator(config);
  const data = await orchestrator.executeQuery(
    'GetDiff',
    { repositoryName: repo.name, path, revision },
    { repositoryId, requestedById: userId },
  );
  return data;
}

export async function refreshRepositoryStatus(
  config: AppConfig,
  tenantId: string,
  repositoryId: string,
  userId?: string,
) {
  const repo = await prisma.repository.findFirstOrThrow({ where: { id: repositoryId, tenantId } });
  const orchestrator = getAgentOrchestrator(config);
  const data = await orchestrator.executeQuery(
    'GetRepositoryStatus',
    { repositoryName: repo.name },
    { repositoryId, requestedById: userId },
  );

  const status = data as {
    latestRevision?: number | null;
    sizeBytes?: string | null;
  };

  const updated = await prisma.repository.update({
    where: { id: repositoryId },
    data: {
      latestRevision: status.latestRevision ?? repo.latestRevision,
      sizeBytes: status.sizeBytes != null ? BigInt(status.sizeBytes) : repo.sizeBytes,
    },
  });

  return serializeRepository(updated);
}

async function getSvnDirectSettings(tenantId: string): Promise<SvnDirectSettings> {
  const platform = await getPlatformSettings(tenantId);
  return {
    visualsvnUrl: platform.visualsvnUrl,
    visualsvnRepoRoot: platform.visualsvnRepoRoot,
  };
}

export async function listRepositoryBranches(
  config: AppConfig,
  tenantId: string,
  repositoryId: string,
  userId: string,
) {
  const repo = await prisma.repository.findFirstOrThrow({ where: { id: repositoryId, tenantId } });
  const svnSettings = await getSvnDirectSettings(tenantId);

  if (config.agentMock && svnDirectAvailable(svnSettings)) {
    try {
      const data = await svnDirectListPath(svnSettings, repo.name, '/branches');
      return {
        branches: data.entries
          .filter((e) => e.kind === 'dir')
          .map((e) => ({
            name: e.name,
            path: `/branches/${e.name}`,
            url: `${svnSettings.visualsvnUrl.replace(/\/+$/, '')}/${repo.name}/branches/${e.name}`,
          })),
      };
    } catch {
      return { branches: [] as { name: string; path: string; url: string }[] };
    }
  }

  const data = await browseRepository(config, tenantId, repositoryId, '/branches', userId);
  const entries = (data.entries as { name: string; kind: string }[]) ?? [];
  const repoUrl = repo.svnUrl ?? `${svnSettings.visualsvnUrl.replace(/\/+$/, '')}/${repo.name}`;
  return {
    branches: entries
      .filter((e) => e.kind === 'dir')
      .map((e) => ({
        name: e.name,
        path: `/branches/${e.name}`,
        url: `${repoUrl.replace(/\/+$/, '')}/branches/${e.name}`,
      })),
  };
}

export async function createRepositoryBranch(
  config: AppConfig,
  tenantId: string,
  repositoryId: string,
  input: { name: string; sourcePath?: string; message: string },
  userId: string,
) {
  const repo = await prisma.repository.findFirstOrThrow({ where: { id: repositoryId, tenantId } });
  if (repo.status !== 'ACTIVE') {
    throw new Error('Repository is not active');
  }

  const svnSettings = await getSvnDirectSettings(tenantId);
  if (!svnDirectAvailable(svnSettings)) {
    throw new Error('SVN server is not configured or svn executable is missing.');
  }

  const result = await svnDirectCreateBranch(
    svnSettings,
    repo.name,
    input.name,
    input.sourcePath ?? '/',
    input.message,
  );

  await writeAuditLog({
    action: 'repo.updated',
    tenantId,
    userId,
    repositoryId,
    metadata: {
      action: 'branch_created',
      branchName: result.branchName,
      branchPath: result.branchPath,
      sourcePath: result.sourcePath,
      destUrl: result.destUrl,
      revision: result.revision,
    },
  });

  if (result.revision != null && result.revision > 0) {
    await prisma.repository.update({
      where: { id: repositoryId },
      data: {
        latestRevision: result.revision,
        updatedAt: new Date(),
      },
    });
  } else {
    await refreshRepositoryStatus(config, tenantId, repositoryId, userId);
  }

  return result;
}
