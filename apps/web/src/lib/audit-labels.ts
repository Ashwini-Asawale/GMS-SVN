import { AuditAction } from '@gms-svn/shared';

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Login',
  'auth.logout': 'Logout',
  'auth.login_failed': 'Failed login',
  'user.created': 'User created',
  'user.updated': 'User updated',
  'user.disabled': 'User disabled',
  'group.created': 'Group created',
  'group.updated': 'Group updated',
  'group.deleted': 'Group deleted',
  'group.member_added': 'Group member added',
  'group.member_removed': 'Group member removed',
  'repo.created': 'Repository created',
  'repo.updated': 'Repository updated',
  'repo.archived': 'Repository archived',
  'access_rule.created': 'Access rule added',
  'access_rule.removed': 'Access rule removed',
  'svn.checkout': 'SVN checkout',
  'svn.update': 'SVN update',
  'svn.commit': 'SVN commit',
  'svn.revert': 'SVN revert',
  'svn.diff': 'SVN diff',
  'svn.log': 'SVN log',
  'agent.command': 'Agent command',
  'settings.updated': 'Settings updated',
  'settings.connection_test': 'Connection test',
  'report.export': 'Report exported',
  'issue.created': 'Issue created',
  'issue.updated': 'Issue updated',
  'issue.closed': 'Issue closed',
  'wiki.page_created': 'Wiki page created',
  'wiki.page_updated': 'Wiki page updated',
  'review.requested': 'Review requested',
  'review.approved': 'Review approved',
  'review.rejected': 'Review rejected',
  'pipeline.triggered': 'Pipeline triggered',
  'pipeline.completed': 'Pipeline completed',
  'pipeline.failed': 'Pipeline failed',
  'pipeline.hook_installed': 'Post-commit hook installed',
};

export const AUDIT_ACTION_OPTIONS = AuditAction.options.map((value) => ({
  value,
  label: AUDIT_ACTION_LABELS[value] ?? value,
}));

export function formatAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
