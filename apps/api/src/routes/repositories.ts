import type { FastifyInstance } from 'fastify';
import {
  createRepositorySchema,
  createAccessRuleSchema,
  createRepositoryBranchSchema,
  updateRepositorySchema,
} from '../schemas/index.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { getAgentOrchestrator } from '../services/agent-orchestrator.js';
import {
  serializeRepository,
  getRepository,
  updateRepository,
  addAccessRule,
  removeAccessRule,
  browseRepository,
  getRepositoryLog,
  getRepositoryDiff,
  refreshRepositoryStatus,
  listRepositoryBranches,
  createRepositoryBranch,
} from '../services/repository-service.js';
import type { AppConfig } from '../config.js';
import { tenantIdFromRequest } from '../lib/tenant.js';

export async function repositoryRoutes(app: FastifyInstance, config: AppConfig) {
  app.addHook('preHandler', authenticate);

  app.get('/repositories', async (request) => {
    const tenantId = tenantIdFromRequest(request);
    const repos = await prisma.repository.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
    return repos.map(serializeRepository);
  });

  app.get('/repositories/:id', async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const { id } = request.params as { id: string };
    const repo = await getRepository(tenantId, id);
    if (!repo) return reply.status(404).send({ error: 'Repository not found' });
    return repo;
  });

  app.post('/repositories', { preHandler: [requireAdmin] }, async (request, reply) => {
    const parsed = createRepositorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const orchestrator = getAgentOrchestrator(config);
      const tenantId = tenantIdFromRequest(request);
      const { repository, command } = await orchestrator.createRepository(
        tenantId,
        parsed.data.name,
        request.user!.sub,
      );

      return reply.status(202).send({
        repository: serializeRepository(repository),
        command: {
          id: command.id,
          status: command.status,
          correlationId: command.correlationId,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create repository';
      return reply.status(400).send({ error: message });
    }
  });

  app.patch('/repositories/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateRepositorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const tenantId = tenantIdFromRequest(request);
      const updated = await updateRepository(config, tenantId, id, parsed.data, request.user!.sub);
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed';
      return reply.status(400).send({ error: message });
    }
  });

  app.post('/repositories/:id/refresh', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const tenantId = tenantIdFromRequest(request);
      return await refreshRepositoryStatus(config, tenantId, id, request.user!.sub);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Refresh failed';
      return reply.status(400).send({ error: message });
    }
  });

  app.get('/repositories/:id/access-rules', async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const { id } = request.params as { id: string };
    const repo = await prisma.repository.findFirst({ where: { id, tenantId } });
    if (!repo) return reply.status(404).send({ error: 'Repository not found' });

    return prisma.repoAccessRule.findMany({
      where: { repositoryId: id },
      orderBy: [{ path: 'asc' }, { principalName: 'asc' }],
    });
  });

  app.post('/repositories/:id/access-rules', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = createAccessRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const tenantId = tenantIdFromRequest(request);
      const rule = await addAccessRule(config, tenantId, id, parsed.data, request.user!.sub);
      return reply.status(201).send(rule);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save access rule';
      return reply.status(400).send({ error: message });
    }
  });

  app.delete(
    '/repositories/:id/access-rules/:ruleId',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id, ruleId } = request.params as { id: string; ruleId: string };
      try {
        const tenantId = tenantIdFromRequest(request);
        await removeAccessRule(config, tenantId, id, ruleId, request.user!.sub);
        return reply.status(204).send();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove access rule';
        return reply.status(400).send({ error: message });
      }
    },
  );

  app.get('/repositories/:id/browse', async (request, reply) => {
    const { id } = request.params as { id: string };
    const path = (request.query as { path?: string }).path ?? '/';
    try {
      const tenantId = tenantIdFromRequest(request);
      return await browseRepository(config, tenantId, id, path, request.user!.sub);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Browse failed';
      return reply.status(400).send({ error: message });
    }
  });

  app.get('/repositories/:id/log', async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as { path?: string; limit?: string };
    const path = q.path ?? '/trunk';
    const limit = Math.min(200, Math.max(1, Number(q.limit ?? 50)));
    try {
      const tenantId = tenantIdFromRequest(request);
      return await getRepositoryLog(config, tenantId, id, path, limit, request.user!.sub);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Log failed';
      return reply.status(400).send({ error: message });
    }
  });

  app.get('/repositories/:id/diff', async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as { path?: string; revision?: string };
    const path = q.path ?? '/trunk';
    const revision = Number(q.revision ?? 1);
    if (!Number.isFinite(revision) || revision < 1) {
      return reply.status(400).send({ error: 'Invalid revision' });
    }
    try {
      const tenantId = tenantIdFromRequest(request);
      return await getRepositoryDiff(config, tenantId, id, path, revision, request.user!.sub);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Diff failed';
      return reply.status(400).send({ error: message });
    }
  });

  app.get('/repositories/:id/branches', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const tenantId = tenantIdFromRequest(request);
      return await listRepositoryBranches(config, tenantId, id, request.user!.sub);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list branches';
      return reply.status(400).send({ error: message });
    }
  });

  app.post('/repositories/:id/branches', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = createRepositoryBranchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const tenantId = tenantIdFromRequest(request);
      const result = await createRepositoryBranch(config, tenantId, id, parsed.data, request.user!.sub);
      return reply.status(201).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create branch';
      return reply.status(400).send({ error: message });
    }
  });
}
