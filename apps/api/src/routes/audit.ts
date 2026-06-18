import type { FastifyInstance } from 'fastify';
import type { AuditAction } from '@gms-svn/shared';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { auditLogQuerySchema } from '../schemas/index.js';
import { queryAuditLogs } from '../services/audit-query-service.js';
import { tenantIdFromRequest } from '../lib/tenant.js';

export async function auditRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireAdmin);

  app.get('/audit/logs', async (request, reply) => {
    const parsed = auditLogQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const q = parsed.data;
    return queryAuditLogs({
      tenantId: tenantIdFromRequest(request),
      userId: q.userId,
      action: q.action as AuditAction | undefined,
      repositoryId: q.repositoryId,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      page: q.page,
      limit: q.limit,
    });
  });
}
