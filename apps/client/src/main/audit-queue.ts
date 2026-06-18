import { getAuditQueue, setAuditQueue } from './working-copy-store.js';

export interface QueuedAuditEvent {
  action: string;
  repositoryId?: string;
  repositoryName?: string;
  metadata?: Record<string, unknown>;
  sourceMachine?: string;
  queuedAt: string;
}

export function enqueueAudit(event: Omit<QueuedAuditEvent, 'queuedAt'>): void {
  const queue = getAuditQueue() as QueuedAuditEvent[];
  queue.push({ ...event, queuedAt: new Date().toISOString() });
  setAuditQueue(queue);
}

export function peekAuditQueue(): QueuedAuditEvent[] {
  return getAuditQueue() as QueuedAuditEvent[];
}

export function clearAuditQueue(): void {
  setAuditQueue([]);
}
