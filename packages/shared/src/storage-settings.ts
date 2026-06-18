/** Platform storage topology for GMS SVN SERVER (Phase 2) */

export type StorageBackend = 'iscsi' | 'smb';

export interface PlatformStorageSettings {
  gmsSvnServerHost: string;
  visualsvnUrl: string;
  visualsvnRepoRoot: string;
  storageBackend: StorageBackend;
  storageBackupPath: string;
  storageReportsPath: string;
  storageAttachmentsPath: string;
  storageLogsPath: string;
}

export const DEFAULT_STORAGE_SETTINGS: PlatformStorageSettings = {
  gmsSvnServerHost: '192.168.1.133',
  visualsvnUrl: 'https://192.168.1.133/svn',
  visualsvnRepoRoot: 'D:\\SVN\\Repositories',
  storageBackend: 'iscsi',
  storageBackupPath: '\\\\GMS-NAS\\SVN\\Backups',
  storageReportsPath: '\\\\GMS-NAS\\SVN\\Reports',
  storageAttachmentsPath: '\\\\GMS-NAS\\SVN\\Attachments',
  storageLogsPath: '\\\\GMS-NAS\\SVN\\Logs',
};

export type ConnectionCheckStatus = 'pass' | 'warn' | 'fail' | 'skip';

export interface StorageConnectionCheck {
  id: string;
  label: string;
  status: ConnectionCheckStatus;
  message: string;
  /** True when full validation deferred to GMS SVN SERVER Agent (Phase 3) */
  deferredToAgent?: boolean;
}

export interface StorageConnectionTestResult {
  overall: 'pass' | 'warn' | 'fail';
  testedAt: string;
  testedFrom: string;
  settings: PlatformStorageSettings;
  checks: StorageConnectionCheck[];
}
