import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuditAction } from '@gms-svn/shared';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { writeAuditLog } from '../lib/audit.js';
import { auditLogExportQuerySchema, commitHistoryReportQuerySchema } from '../schemas/index.js';
import type { AppConfig } from '../config.js';
import {
  generateAccessRulesPdf,
  generateAuditLogCsv,
  generateCommitHistoryCsv,
  generateRepositoriesCsv,
  generateUsersCsv,
} from '../services/report-service.js';

function sendCsv(reply: FastifyReply, filename: string, csv: string) {
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${filename}"`)
    .send(csv);
}

function sendPdf(reply: FastifyReply, filename: string, buffer: Buffer) {
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `attachment; filename="${filename}"`)
    .send(buffer);
}

export async function reportRoutes(app: FastifyInstance, config: AppConfig) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireAdmin);

  app.get('/reports/users.csv', async (_request, reply) => {
    const { csv, filename } = await generateUsersCsv();
    return sendCsv(reply, filename, csv);
  });

  app.get('/reports/repositories.csv', async (_request, reply) => {
    const { csv, filename } = await generateRepositoriesCsv();
    return sendCsv(reply, filename, csv);
  });

  app.get('/reports/audit-log.csv', async (request, reply) => {
    const parsed = auditLogExportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const q = parsed.data;
    const { csv, filename } = await generateAuditLogCsv({
      userId: q.userId,
      action: q.action as AuditAction | undefined,
      repositoryId: q.repositoryId,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });

    await writeAuditLog({
      action: 'report.export',
      userId: request.user!.sub,
      metadata: { reportType: 'audit-log', filename, filters: q },
    });

    return sendCsv(reply, filename, csv);
  });

  app.get('/reports/access-rules.pdf', async (request, reply) => {
    const repositoryId = (request.query as { repositoryId?: string }).repositoryId;
    const { buffer, filename } = await generateAccessRulesPdf(repositoryId);

    await writeAuditLog({
      action: 'report.export',
      userId: request.user!.sub,
      repositoryId,
      metadata: { reportType: 'access-rules', filename },
    });

    return sendPdf(reply, filename, buffer);
  });

  app.get('/reports/commit-history.csv', async (request, reply) => {
    const parsed = commitHistoryReportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { repositoryId, path: logPath, limit } = parsed.data;
    const { csv, filename } = await generateCommitHistoryCsv(
      config,
      repositoryId,
      logPath,
      limit,
      request.user!.sub,
    );

    await writeAuditLog({
      action: 'report.export',
      userId: request.user!.sub,
      repositoryId,
      metadata: { reportType: 'commit-history', filename, path: logPath, limit },
    });

    return sendCsv(reply, filename, csv);
  });
}
