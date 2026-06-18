import { z } from 'zod';

export const AuditAction = z.enum([
  'auth.login',
  'auth.logout',
  'auth.login_failed',
  'user.created',
  'user.updated',
  'user.disabled',
  'group.created',
  'group.updated',
  'group.deleted',
  'group.member_added',
  'group.member_removed',
  'repo.created',
  'repo.updated',
  'repo.archived',
  'access_rule.created',
  'access_rule.removed',
  'svn.checkout',
  'svn.update',
  'svn.commit',
  'svn.revert',
  'svn.diff',
  'svn.log',
  'agent.command',
  'settings.updated',
  'settings.connection_test',
  'report.export',
  'issue.created',
  'issue.updated',
  'issue.closed',
  'wiki.page_created',
  'wiki.page_updated',
  'review.requested',
  'review.approved',
  'review.rejected',
  'pipeline.triggered',
  'pipeline.completed',
  'pipeline.failed',
  'pipeline.hook_installed',
]);

export type AuditAction = z.infer<typeof AuditAction>;

export const AuditEventSchema = z.object({
  action: AuditAction,
  userId: z.string().uuid().optional(),
  username: z.string().optional(),
  repositoryId: z.string().uuid().optional(),
  repositoryName: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  sourceIp: z.string().optional(),
  sourceMachine: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
