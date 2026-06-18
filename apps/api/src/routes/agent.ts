import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { verifyAccessToken } from '../lib/auth.js';
import { agentCommandEvents } from '../lib/agent-events.js';
import { prisma } from '../lib/prisma.js';
import { getAgentOrchestrator } from '../services/agent-orchestrator.js';
import { triggerRepoSync } from '../services/repo-sync-worker.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import type { AppConfig } from '../config.js';

export async function agentRoutes(app: FastifyInstance, config: AppConfig) {
  app.get('/agent/events', async (request, reply) => {
    const token =
      (typeof request.query === 'object' &&
        request.query !== null &&
        'token' in request.query &&
        typeof request.query.token === 'string' &&
        request.query.token) ||
      request.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const user = verifyAccessToken(token);
      if (!user.isAdmin) {
        return reply.status(403).send({ error: 'Admin access required' });
      }
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    reply.raw.write(': connected\n\n');

    const unsubscribe = agentCommandEvents.subscribe((event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    request.raw.on('close', () => {
      unsubscribe();
    });
  });

  app.register(async (admin) => {
    admin.addHook('preHandler', authenticate);
    admin.addHook('preHandler', requireAdmin);

    admin.get('/agent/commands/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const command = await prisma.agentCommand.findUnique({ where: { id } });
      if (!command) return reply.status(404).send({ error: 'Command not found' });
      return command;
    });

    admin.post('/agent/sync', async (request, reply) => {
      try {
        const tenantId = request.user!.tenantId;
        return await triggerRepoSync(config, { wait: true, tenantId });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Repository sync failed';
        return reply.status(400).send({ error: message });
      }
    });

    admin.post('/agent/commands/:id/retry', async (request, reply) => {
      const { id } = request.params as { id: string };
      const command = await prisma.agentCommand.findUnique({ where: { id } });
      if (!command) return reply.status(404).send({ error: 'Command not found' });
      if (command.status !== 'FAILED') {
        return reply.status(400).send({ error: 'Only failed commands can be retried' });
      }

      await prisma.agentCommand.update({
        where: { id },
        data: { status: 'PENDING', startedAt: null, completedAt: null, result: Prisma.JsonNull },
      });

      void getAgentOrchestrator(config).processCommand(id);
      return prisma.agentCommand.findUniqueOrThrow({ where: { id } });
    });
  });
}
