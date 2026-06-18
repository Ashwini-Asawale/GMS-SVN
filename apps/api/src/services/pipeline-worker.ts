import { Queue, Worker } from 'bullmq';
import type { AppConfig } from '../config.js';
import { dispatchPipelineWebhook } from './pipeline-service.js';

const QUEUE_NAME = 'gms-svn-pipeline-dispatch';

let queue: Queue | null = null;
let worker: Worker | null = null;

export function startPipelineWorker(config: AppConfig) {
  if (!config.redisUrl) {
    console.warn('[pipeline] REDIS_URL not set — webhook dispatch runs inline');
    return;
  }

  const connection = { url: config.redisUrl };
  queue = new Queue(QUEUE_NAME, { connection });
  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      await dispatchPipelineWebhook(config, job.data.buildId as string);
    },
    { connection, concurrency: 3 },
  );

  worker.on('failed', (job, err) => {
    console.error(`[pipeline] job ${job?.id} failed:`, err.message);
  });

  console.info('[pipeline] BullMQ worker started for CI webhook dispatch');
}

export async function enqueuePipelineDispatch(config: AppConfig, buildId: string) {
  if (!queue) {
    void dispatchPipelineWebhook(config, buildId).catch((err) => {
      console.error(`[pipeline] inline dispatch failed for ${buildId}:`, err.message);
    });
    return;
  }

  await queue.add(
    'dispatch',
    { buildId },
    {
      jobId: `pipeline-${buildId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    },
  );
}

export async function stopPipelineWorker() {
  await worker?.close();
  await queue?.close();
  worker = null;
  queue = null;
}
