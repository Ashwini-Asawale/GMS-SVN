import type { AgentCommandType } from '@gms-svn/svn-contracts';
import type { AgentCommandStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getAgentClient, newCorrelationId, newIdempotencyKey } from '../lib/agent-client.js';
import { agentCommandEvents } from '../lib/agent-events.js';
import { writeAuditLog } from '../lib/audit.js';
import { getPlatformSettings } from '../lib/platform-settings.js';
import type { AppConfig } from '../config.js';

export interface DispatchOptions {
  repositoryId?: string;
  requestedById?: string;
  idempotencyKey?: string;
  correlationId?: string;
  /** Reserved for future approval workflows — not used in Phase 4 */
  approvalRequired?: boolean;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function emitUpdate(row: {
  id: string;
  correlationId: string;
  commandType: string;
  status: AgentCommandStatus;
  repositoryId: string | null;
  result?: Prisma.JsonValue | null;
}) {
  const result = row.result as { success?: boolean; stderr?: string } | null;
  agentCommandEvents.emitCommand({
    commandId: row.id,
    correlationId: row.correlationId,
    commandType: row.commandType,
    status: row.status,
    repositoryId: row.repositoryId,
    success: result?.success,
    message: result?.stderr,
  });
}

export class AgentOrchestrator {
  constructor(private readonly config: AppConfig) {}

  private async clientWithSettings() {
    const settings = await getPlatformSettings();
    return getAgentClient({
      baseUrl: this.config.agentBaseUrl,
      hmacSecret: this.config.agentHmacSecret,
      mock: this.config.agentMock,
      svnDirect: this.config.agentMock
        ? {
            visualsvnUrl: settings.visualsvnUrl,
            visualsvnRepoRoot: settings.visualsvnRepoRoot,
          }
        : null,
    });
  }

  async dispatchCommand(
    type: AgentCommandType,
    payload: Record<string, unknown>,
    options: DispatchOptions = {},
  ) {
    if (options.approvalRequired) {
      throw new Error('Approval required for this action');
    }

    const correlationId = options.correlationId ?? newCorrelationId();
    const idempotencyKey = options.idempotencyKey ?? newIdempotencyKey(type.toLowerCase());

    const existing = await prisma.agentCommand.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.status === 'PENDING' || existing.status === 'RUNNING') {
        void this.processCommand(existing.id);
      }
      return existing;
    }

    const command = await prisma.agentCommand.create({
      data: {
        commandType: type,
        idempotencyKey,
        correlationId,
        payload: payload as Prisma.InputJsonValue,
        repositoryId: options.repositoryId,
        requestedById: options.requestedById,
        status: 'PENDING',
      },
    });

    await writeAuditLog({
      action: 'agent.command',
      userId: options.requestedById,
      repositoryId: options.repositoryId,
      metadata: { commandId: command.id, type, correlationId, phase: 'dispatched' },
    });

    emitUpdate(command);
    void this.processCommand(command.id);
    return command;
  }

  async processCommand(commandId: string) {
    const command = await prisma.agentCommand.findUnique({ where: { id: commandId } });
    if (!command || command.status === 'COMPLETED' || command.status === 'FAILED') return;

    const running = await prisma.agentCommand.updateMany({
      where: { id: commandId, status: 'PENDING' },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    if (running.count === 0) return;

    const updated = await prisma.agentCommand.findUniqueOrThrow({ where: { id: commandId } });
    emitUpdate(updated);

    try {
      const agentClient = await this.clientWithSettings();
      const result = await agentClient.execute(
        command.commandType as AgentCommandType,
        command.payload as Record<string, unknown>,
        {
          commandId: command.id,
          correlationId: command.correlationId,
          idempotencyKey: command.idempotencyKey,
        },
      );

      const completed = await prisma.agentCommand.update({
        where: { id: commandId },
        data: {
          status: result.success ? 'COMPLETED' : 'FAILED',
          result: result as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      await this.afterCommand(completed, result.success);
      emitUpdate(completed);

      await writeAuditLog({
        action: 'agent.command',
        userId: command.requestedById ?? undefined,
        repositoryId: command.repositoryId ?? undefined,
        metadata: {
          commandId,
          type: command.commandType,
          correlationId: command.correlationId,
          success: result.success,
          durationMs: result.durationMs,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Agent execution failed';
      const failed = await prisma.agentCommand.update({
        where: { id: commandId },
        data: {
          status: 'FAILED',
          result: { success: false, stderr: message, durationMs: 0 },
          completedAt: new Date(),
        },
      });
      emitUpdate(failed);

      await writeAuditLog({
        action: 'agent.command',
        userId: command.requestedById ?? undefined,
        repositoryId: command.repositoryId ?? undefined,
        metadata: { commandId, type: command.commandType, success: false, error: message },
      });
    }
  }

  private async afterCommand(
    command: { commandType: string; repositoryId: string | null },
    success: boolean,
  ) {
    if (!success || !command.repositoryId) return;

    if (command.commandType === 'CreateRepository') {
      const settings = await getPlatformSettings();
      const repo = await prisma.repository.findUnique({ where: { id: command.repositoryId } });
      if (!repo) return;

      const svnUrl = `${settings.visualsvnUrl.replace(/\/$/, '')}/${repo.name}`;
      await prisma.repository.update({
        where: { id: command.repositoryId },
        data: {
          status: 'ACTIVE',
          svnUrl,
          latestRevision: 0,
          sizeBytes: BigInt(0),
        },
      });
    }
  }

  async createRepository(name: string, requestedById: string) {
    const slug = slugify(name);
    const existing = await prisma.repository.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    if (existing) {
      throw new Error('Repository name already exists');
    }

    const repository = await prisma.repository.create({
      data: { name, slug, status: 'PENDING' },
    });

    const command = await this.dispatchCommand(
      'CreateRepository',
      { name, layout: 'standard' },
      {
        repositoryId: repository.id,
        requestedById,
        idempotencyKey: newIdempotencyKey(`create-repo-${repository.id}`),
      },
    );

    await writeAuditLog({
      action: 'repo.created',
      userId: requestedById,
      repositoryId: repository.id,
      metadata: { name, commandId: command.id },
    });

    return { repository, command };
  }

  async syncRepositories(requestedById?: string) {
    await this.reprocessPendingRepositories();

    const correlationId = newCorrelationId();
    const command = await this.dispatchCommand(
      'ListRepositories',
      {},
      { requestedById, correlationId, idempotencyKey: newIdempotencyKey('list-repos') },
    );

    await this.waitForCommand(command.id, 60_000);

    const completed = await prisma.agentCommand.findUniqueOrThrow({ where: { id: command.id } });
    if (completed.status !== 'COMPLETED' || !completed.result) {
      throw new Error('Repository sync failed');
    }

    const result = completed.result as {
      data?: { repositories?: { name: string; latestRevision: number | null; sizeBytes: string | null }[] };
    };
    const list = result.data?.repositories ?? [];
    const settings = await getPlatformSettings();

    for (const item of list) {
      const slug = slugify(item.name);
      await prisma.repository.upsert({
        where: { name: item.name },
        create: {
          name: item.name,
          slug,
          status: 'ACTIVE',
          svnUrl: `${settings.visualsvnUrl.replace(/\/$/, '')}/${item.name}`,
          latestRevision: item.latestRevision,
          sizeBytes: item.sizeBytes ? BigInt(item.sizeBytes) : null,
        },
        update: {
          latestRevision: item.latestRevision,
          sizeBytes: item.sizeBytes ? BigInt(item.sizeBytes) : null,
          status: 'ACTIVE',
        },
      });
    }

    const activeRepos = await prisma.repository.findMany({ where: { status: 'ACTIVE' } });
    for (const repo of activeRepos) {
      try {
        const data = await this.executeQuery(
          'GetRepositoryStatus',
          { repositoryName: repo.name },
          { repositoryId: repo.id },
        );
        const status = data as { latestRevision?: number | null; sizeBytes?: string | null };
        await prisma.repository.update({
          where: { id: repo.id },
          data: {
            latestRevision: status.latestRevision ?? repo.latestRevision,
            sizeBytes: status.sizeBytes != null ? BigInt(status.sizeBytes) : repo.sizeBytes,
          },
        });
      } catch {
        // skip repos agent cannot reach during sync
      }
    }

    return { synced: list.length, commandId: command.id };
  }

  private async reprocessPendingRepositories() {
    const pending = await prisma.repository.findMany({ where: { status: 'PENDING' } });
    for (const repo of pending) {
      let command = await prisma.agentCommand.findFirst({
        where: { repositoryId: repo.id, commandType: 'CreateRepository' },
        orderBy: { createdAt: 'desc' },
      });

      if (command?.status === 'FAILED') {
        await prisma.agentCommand.update({
          where: { id: command.id },
          data: {
            status: 'PENDING',
            startedAt: null,
            completedAt: null,
            result: Prisma.JsonNull,
          },
        });
      }

      if (!command || command.status === 'PENDING' || command.status === 'FAILED') {
        if (!command) {
          command = await this.dispatchCommand(
            'CreateRepository',
            { name: repo.name, layout: 'standard' },
            {
              repositoryId: repo.id,
              requestedById: undefined,
              idempotencyKey: newIdempotencyKey(`create-repo-retry-${repo.id}`),
            },
          );
        } else {
          void this.processCommand(command.id);
        }
        await this.waitForCommand(command.id, 30_000);
      }
    }
  }

  async waitForCommand(commandId: string, timeoutMs: number) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const cmd = await prisma.agentCommand.findUnique({ where: { id: commandId } });
      if (cmd && (cmd.status === 'COMPLETED' || cmd.status === 'FAILED')) return cmd;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('Command timed out');
  }

  async executeQuery(
    type: AgentCommandType,
    payload: Record<string, unknown>,
    options: DispatchOptions = {},
  ): Promise<Record<string, unknown>> {
    const command = await this.dispatchCommand(type, payload, options);
    const completed = await this.waitForCommand(command.id, 60_000);
    if (completed.status !== 'COMPLETED') {
      const result = completed.result as { stderr?: string } | null;
      throw new Error(result?.stderr ?? `Agent command ${type} failed`);
    }
    const result = completed.result as { success?: boolean; stderr?: string; data?: Record<string, unknown> };
    if (!result.success) {
      throw new Error(result.stderr ?? `Agent command ${type} failed`);
    }
    return result.data ?? {};
  }
}

let orchestrator: AgentOrchestrator | null = null;

export function getAgentOrchestrator(config: AppConfig): AgentOrchestrator {
  if (!orchestrator) orchestrator = new AgentOrchestrator(config);
  return orchestrator;
}
