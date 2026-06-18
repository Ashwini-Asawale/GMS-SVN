import type { PlatformStorageSettings, StorageBackend } from '@gms-svn/shared';
import { DEFAULT_STORAGE_SETTINGS } from '@gms-svn/shared';
import { prisma } from './prisma.js';

export const SETTING_KEYS = {
  gmsSvnServerHost: 'gms_svn.server_host',
  visualsvnUrl: 'visualsvn.url',
  visualsvnRepoRoot: 'visualsvn.repo_root',
  storageBackend: 'storage.backend',
  storageBackupPath: 'storage.backup_path',
  storageReportsPath: 'storage.reports_path',
  storageAttachmentsPath: 'storage.attachments_path',
  storageLogsPath: 'storage.logs_path',
} as const;

const ALL_KEYS = Object.values(SETTING_KEYS);

function parseBackend(value: string | undefined): StorageBackend {
  return value === 'smb' ? 'smb' : 'iscsi';
}

export async function getPlatformSettings(): Promise<PlatformStorageSettings> {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: ALL_KEYS } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return {
    gmsSvnServerHost: map[SETTING_KEYS.gmsSvnServerHost] ?? DEFAULT_STORAGE_SETTINGS.gmsSvnServerHost,
    visualsvnUrl: map[SETTING_KEYS.visualsvnUrl] ?? DEFAULT_STORAGE_SETTINGS.visualsvnUrl,
    visualsvnRepoRoot: map[SETTING_KEYS.visualsvnRepoRoot] ?? DEFAULT_STORAGE_SETTINGS.visualsvnRepoRoot,
    storageBackend: parseBackend(map[SETTING_KEYS.storageBackend]),
    storageBackupPath: map[SETTING_KEYS.storageBackupPath] ?? DEFAULT_STORAGE_SETTINGS.storageBackupPath,
    storageReportsPath: map[SETTING_KEYS.storageReportsPath] ?? DEFAULT_STORAGE_SETTINGS.storageReportsPath,
    storageAttachmentsPath:
      map[SETTING_KEYS.storageAttachmentsPath] ?? DEFAULT_STORAGE_SETTINGS.storageAttachmentsPath,
    storageLogsPath: map[SETTING_KEYS.storageLogsPath] ?? DEFAULT_STORAGE_SETTINGS.storageLogsPath,
  };
}

export async function upsertPlatformSettings(
  partial: Partial<PlatformStorageSettings>,
): Promise<PlatformStorageSettings> {
  const entries: [string, string | undefined][] = [
    [SETTING_KEYS.gmsSvnServerHost, partial.gmsSvnServerHost],
    [SETTING_KEYS.visualsvnUrl, partial.visualsvnUrl],
    [SETTING_KEYS.visualsvnRepoRoot, partial.visualsvnRepoRoot],
    [SETTING_KEYS.storageBackend, partial.storageBackend],
    [SETTING_KEYS.storageBackupPath, partial.storageBackupPath],
    [SETTING_KEYS.storageReportsPath, partial.storageReportsPath],
    [SETTING_KEYS.storageAttachmentsPath, partial.storageAttachmentsPath],
    [SETTING_KEYS.storageLogsPath, partial.storageLogsPath],
  ];

  for (const [key, value] of entries) {
    if (value !== undefined) {
      await prisma.platformSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
  }

  return getPlatformSettings();
}

export async function seedDefaultPlatformSettings(): Promise<void> {
  const defaults: [string, string][] = [
    [SETTING_KEYS.gmsSvnServerHost, DEFAULT_STORAGE_SETTINGS.gmsSvnServerHost],
    [SETTING_KEYS.visualsvnUrl, DEFAULT_STORAGE_SETTINGS.visualsvnUrl],
    [SETTING_KEYS.visualsvnRepoRoot, DEFAULT_STORAGE_SETTINGS.visualsvnRepoRoot],
    [SETTING_KEYS.storageBackend, DEFAULT_STORAGE_SETTINGS.storageBackend],
    [SETTING_KEYS.storageBackupPath, DEFAULT_STORAGE_SETTINGS.storageBackupPath],
    [SETTING_KEYS.storageReportsPath, DEFAULT_STORAGE_SETTINGS.storageReportsPath],
    [SETTING_KEYS.storageAttachmentsPath, DEFAULT_STORAGE_SETTINGS.storageAttachmentsPath],
    [SETTING_KEYS.storageLogsPath, DEFAULT_STORAGE_SETTINGS.storageLogsPath],
  ];

  for (const [key, value] of defaults) {
    await prisma.platformSetting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  }
}
