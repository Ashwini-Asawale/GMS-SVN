import type { FastifyInstance } from 'fastify';
import { clientAuditEventSchema } from '../schemas/index.js';
import { authenticate } from '../middleware/auth.js';
import { writeAuditLog, getClientIp } from '../lib/audit.js';
import { getClientVisibleRepos } from '../services/client-repo-service.js';
import { prisma } from '../lib/prisma.js';
import type { AuditAction } from '@gms-svn/shared';

const CLIENT_AUDIT_ACTIONS = new Set<string>([
  'svn.checkout',
  'svn.update',
  'svn.commit',
  'svn.revert',
  'svn.diff',
  'svn.log',
]);

export async function clientRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/client/repos', async (request) => {
    const user = request.user!;
    return getClientVisibleRepos(user.sub, user.isAdmin);
  });

  app.post('/client/audit-events', async (request, reply) => {
    const parsed = clientAuditEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { action, repositoryId, repositoryName, metadata, sourceMachine } = parsed.data;

    if (!CLIENT_AUDIT_ACTIONS.has(action)) {
      return reply.status(400).send({ error: 'Invalid client audit action' });
    }

    let resolvedRepositoryId = repositoryId ?? null;
    if (!resolvedRepositoryId && repositoryName) {
      const repo = await prisma.repository.findFirst({
        where: { name: repositoryName, status: 'ACTIVE' },
      });
      resolvedRepositoryId = repo?.id ?? null;
    }

    await writeAuditLog({
      action: action as AuditAction,
      userId: request.user!.sub,
      repositoryId: resolvedRepositoryId ?? undefined,
      metadata: {
        ...metadata,
        repositoryName,
        client: 'GMS SVN CLIENT',
      },
      sourceIp: getClientIp(request.headers),
      sourceMachine: sourceMachine ?? undefined,
    });

    if (action === 'svn.commit' && resolvedRepositoryId) {
      const revision = metadata?.revision;
      const revNumber = typeof revision === 'number' ? revision : Number(revision);
      if (Number.isFinite(revNumber) && revNumber > 0) {
        await prisma.repository.update({
          where: { id: resolvedRepositoryId },
          data: {
            latestRevision: revNumber,
            updatedAt: new Date(),
          },
        });
      }
    }

    return { ok: true };
  });
}
