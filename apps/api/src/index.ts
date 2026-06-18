import './load-env.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PRODUCT_NAMES } from '@gms-svn/shared';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { groupRoutes } from './routes/groups.js';
import { repositoryRoutes } from './routes/repositories.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { settingsRoutes } from './routes/settings.js';
import { agentRoutes } from './routes/agent.js';
import { clientRoutes } from './routes/client.js';
import { auditRoutes } from './routes/audit.js';
import { reportRoutes } from './routes/reports.js';
import { collaborationRoutes } from './routes/collaboration.js';
import { hookRoutes, pipelineRoutes } from './routes/pipeline.js';
import { loadConfig } from './config.js';
import { startRepoSyncWorker, stopRepoSyncWorker, triggerRepoSync } from './services/repo-sync-worker.js';
import { startPipelineWorker, stopPipelineWorker } from './services/pipeline-worker.js';
import { syncDevRepositoriesFromDisk } from './services/dev-repo-sync.js';
import { syncSeedSvnPasswd } from './services/svn-passwd-sync.js';

async function main() {
  const config = loadConfig();

  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      // Electron desktop client and server-side tools often send no Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }
      if (config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(groupRoutes);
  await app.register(repositoryRoutes, config);
  await app.register(dashboardRoutes);
  await app.register(settingsRoutes);
  await app.register(agentRoutes, config);
  await app.register(clientRoutes);
  await app.register(auditRoutes);
  await app.register(reportRoutes, config);
  await app.register(collaborationRoutes);
  await app.register(hookRoutes, config);
  await app.register(pipelineRoutes, config);

  startRepoSyncWorker(config);
  startPipelineWorker(config);

  void (async () => {
    try {
      const { synced, names } = await syncDevRepositoriesFromDisk();
      if (synced > 0) {
        app.log.info(`Auto-registered ${synced} SVN repos: ${names.join(', ')}`);
      }
      await triggerRepoSync(config, { wait: true });
      syncSeedSvnPasswd();
      app.log.info('Repository status synced from live SVN');
    } catch (err) {
      app.log.warn({ err }, 'Startup SVN sync skipped (is svnserve running?)');
    }
  })();

  const shutdown = async () => {
    await stopPipelineWorker();
    await stopRepoSyncWorker();
    await app.close();
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  await app.listen({ host: config.host, port: config.port });
  app.log.info(`${PRODUCT_NAMES.webAdmin} listening on http://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
