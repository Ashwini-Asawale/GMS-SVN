import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/dashboard/stats', async () => {
    const [userCount, groupCount, repoCount, latestRepo, failedBuilds, runningBuilds] =
      await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.group.count(),
      prisma.repository.count(),
      prisma.repository.findFirst({
        where: { latestRevision: { not: null } },
        orderBy: { updatedAt: 'desc' },
        select: { name: true, latestRevision: true, updatedAt: true },
      }),
      prisma.pipelineBuild.count({ where: { status: 'FAILED' } }),
      prisma.pipelineBuild.count({ where: { status: { in: ['QUEUED', 'RUNNING'] } } }),
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