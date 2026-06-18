import { Queue, Worker } from 'bullmq';
import type { AppConfig } from '../config.js';
import { getAgentOrchestrator } from './agent-orchestrator.js';

const QUEUE_NAME = 'gms-svn-repo-sync';

let queue: Queue | null = null;
let worker: Worker | null = null;

export function startRepoSyncWorker(config: AppConfig) {
  if (!config.redisUrl) {
    console.warn('[repo-sync] REDIS_URL not set — periodic repository sync disabled');
    return;
  }

  const connection = { url: config.redisUrl };

  queue = new Queue(QUEUE_NAME, { connection });
  worker = new Worker(
    QUEUE_NAME,
    async () => {
      const orchestrator = getAgentOrchestrator(config);
      return orchestrator.syncRepositories();
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[repo-sync] job ${job?.id} failed:`, err.message);
  });

  void queue.add(
    'sync',
    {},
    {
      repeat: { pattern: process.env.NODE_ENV === 'production' ? '0 2 * * *' : '*/15 * * * *' },
      jobId: 'repo-sync-periodic',
    },
  );

  void queue.add('sync-startup', {}, { jobId: `sync-startup-${Date.now()}` });

  const interval = process.env.NODE_ENV === 'production' ? 'nightly at 02:00' : 'every 15 minutes';
  console.info(`[repo-sync] BullMQ worker started (${interval} + on startup)`);
}

export async function triggerRepoSync(config: AppConfig, options?: { wait?: boolean }) {
  const orchestrator = getAgentOrchestrator(config);
  if (options?.wait || !queue) {
    return orchestrator.syncRepositories();
  }
  await queue.add('sync-manual', {}, { jobId: `sync-manual-${Date.now()}` });
  return { queued: true };
}

export async function stopRepoSyncWorker() {
  await worker?.close();
  await queue?.close();
  worker = null;
  queue = null;
}
