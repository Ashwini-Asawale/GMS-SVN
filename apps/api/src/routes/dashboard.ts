import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { tenantIdFromRequest } from '../lib/tenant.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/dashboard/stats', async (request) => {
    const tenantId = tenantIdFromRequest(request);
    const repoFilter = { tenantId };

    const [userCount, groupCount, repoCount, latestRepo, failedBuilds, runningBuilds] =
      await Promise.all([
        prisma.user.count({ where: { tenantId, isActive: true } }),
        prisma.group.count({ where: { tenantId } }),
        prisma.repository.count({ where: repoFilter }),
        prisma.repository.findFirst({
          where: { tenantId, latestRevision: { not: null } },
          orderBy: { updatedAt: 'desc' },
          select: { name: true, latestRevision: true, updatedAt: true },
        }),
        prisma.pipelineBuild.count({
          where: { status: 'FAILED', repository: repoFilter },
        }),
        prisma.pipelineBuild.count({
          where: { status: { in: ['QUEUED', 'RUNNING'] }, repository: repoFilter },
        }),
      ]);

    return {
      userCount,
      groupCount,
      repoCount,
      latestRevision: latestRepo
        ? { repository: latestRepo.name, revision: latestRepo.latestRevision, at: latestRepo.updatedAt }
        : null,
      pipelineFailedBuilds: failedBuilds,
      pipelineRunningBuilds: runningBuilds,
    };
  });
}
