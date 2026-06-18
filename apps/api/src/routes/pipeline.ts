import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';
import { prisma } from '../lib/prisma.js';
import {
  postCommitHookSchema,
  buildCallbackSchema,
  updatePipelineConfigSchema,
} from '../schemas/index.js';
import {
  getOrCreatePipelineConfig,
  handleBuildCallback,
  handlePostCommit,
  installPostCommitHook,
  listPipelineBuilds,
  resolveHookSecret,
  updatePipelineConfig,
  verifyPipelineSignature,
} from '../services/pipeline-service.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

export async function hookRoutes(app: FastifyInstance, config: AppConfig) {
  app.post('/hooks/post-commit', async (request, reply) => {
    const rawBody = JSON.stringify(request.body ?? {});
    const parsed = postCommitHookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const repo = await prisma.repository.findUnique({
      where: { name: parsed.data.repositoryName },
      include: { pipelineConfig: true },
    });

    const secret = resolveHookSecret(config, repo?.pipelineConfig?.webhookSecret);
    const signature = request.headers['x-gms-svn-signature'];
    if (
      !verifyPipelineSignature(
        secret,
        rawBody,
        typeof signature === 'string' ? signature : undefined,
      )
    ) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    const result = await handlePostCommit(config, parsed.data);
    return reply.status(202).send(result);
  });

  app.post('/hooks/build-callback', async (request, reply) => {
    const rawBody = JSON.stringify(request.body ?? {});
    const parsed = buildCallbackSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const build = await prisma.pipelineBuild.findUnique({
      where: { id: parsed.data.buildId },
      include: { config: true },
    });
    if (!build) return reply.status(404).send({ error: 'Build not found' });

    const secret = resolveHookSecret(config, build.config?.webhookSecret);
    const signature = request.headers['x-gms-svn-signature'];
    if (
      !verifyPipelineSignature(
        secret,
        rawBody,
        typeof signature === 'string' ? signature : undefined,
      )
    ) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    try {
      const updated = await handleBuildCallback(parsed.data.buildId, parsed.data);
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Callback failed';
      return reply.status(400).send({ error: message });
    }
  });
}

export async function pipelineRoutes(app: FastifyInstance, config: AppConfig) {
  app.addHook('preHandler', authenticate);

  app.get('/repositories/:id/pipeline', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await getOrCreatePipelineConfig(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load pipeline config';
      return reply.status(400).send({ error: message });
    }
  });

  app.patch('/repositories/:id/pipeline', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updatePipelineConfigSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    try {
      return await updatePipelineConfig(id, request.user!.sub, parsed.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update pipeline';
      return reply.status(400).send({ error: message });
    }
  });

  app.get('/repositories/:id/builds', async (request, reply) => {
    const { id } = request.params as { id: string };
    const limit = Math.min(100, Number((request.query as { limit?: string }).limit ?? 50));
    try {
      return await listPipelineBuilds(id, limit);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list builds';
      return reply.status(400).send({ error: message });
    }
  });

  app.post(
    '/repositories/:id/pipeline/install-hook',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const scriptPath =
        (request.body as { scriptPath?: string }).scriptPath ??
        process.env.PIPELINE_HOOK_SCRIPT ??
        'D:\\GMS-SVN\\infra\\hooks\\gms-svn-post-commit.ps1';

      try {
        return await installPostCommitHook(config, id, request.user!.sub, scriptPath);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to install hook';
        return reply.status(400).send({ error: message });
      }
    },
  );

  app.post(
    '/repositories/:id/pipeline/simulate',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { revision?: number; changedPaths?: string[] };
      const revision = body.revision ?? 1;

      const repo = await prisma.repository.findUniqueOrThrow({ where: { id } });
      try {
        const result = await handlePostCommit(config, {
          repositoryName: repo.name,
          revision,
          author: request.user!.username,
          changedPaths: body.changedPaths ?? ['/trunk'],
        });
        return reply.status(202).send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Simulation failed';
        return reply.status(400).send({ error: message });
      }
    },
  );
}
