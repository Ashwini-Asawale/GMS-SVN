import dns from 'node:dns/promises';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  PlatformStorageSettings,
  StorageConnectionCheck,
  StorageConnectionTestResult,
} from '@gms-svn/shared';

function overallFromChecks(checks: StorageConnectionCheck[]): 'pass' | 'warn' | 'fail' {
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'warn')) return 'warn';
  return 'pass';
}

function isLocalDrivePath(p: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(p);
}

function isUncPath(p: string): boolean {
  return p.startsWith('\\\\');
}

async function checkDnsHost(hostname: string): Promise<StorageConnectionCheck> {
  const id = 'dns-server-host';
  if (!hostname.trim()) {
    return { id, label: 'GMS SVN SERVER host DNS', status: 'fail', message: 'Host is not configured' };
  }

  try {
    const result = await dns.lookup(hostname);
    return {
      id,
      label: 'GMS SVN SERVER host DNS',
      status: 'pass',
      message: `${hostname} resolves to ${result.address}`,
    };
  } catch {
    return {
      id,
      label: 'GMS SVN SERVER host DNS',
      status: 'warn',
      message: `${hostname} could not be resolved from this host (may be internal DNS only)`,
    };
  }
}

async function checkVisualSvnUrl(url: string): Promise<StorageConnectionCheck> {
  const id = 'visualsvn-url';
  if (!url.trim()) {
    return { id, label: 'VisualSVN URL reachability', status: 'fail', message: 'URL is not configured' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
    clearTimeout(timeout);
    return {
      id,
      label: 'VisualSVN URL reachability',
      status: res.ok || res.status === 401 || res.status === 403 ? 'pass' : 'warn',
      message: `HTTP ${res.status} from ${url}`,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown error';
    return {
      id,
      label: 'VisualSVN URL reachability',
      status: 'warn',
      message: `Could not reach ${url} (${detail}). Expected if VisualSVN is not on this network yet.`,
      deferredToAgent: true,
    };
  }
}

async function checkServerLocalPath(
  id: string,
  label: string,
  repoPath: string,
): Promise<StorageConnectionCheck> {
  if (!repoPath.trim()) {
    return { id, label, status: 'fail', message: 'Path is not configured' };
  }

  if (!isLocalDrivePath(repoPath)) {
    return {
      id,
      label,
      status: 'skip',
      message: `${repoPath} is validated on GMS SVN SERVER (not from Web Admin host)`,
      deferredToAgent: true,
    };
  }

  try {
    const stat = await fs.stat(repoPath);
    if (!stat.isDirectory()) {
      return { id, label, status: 'fail', message: `${repoPath} exists but is not a directory` };
    }
    await fs.access(repoPath, fs.constants.R_OK);
    return { id, label, status: 'pass', message: `${repoPath} exists and is readable` };
  } catch {
    return {
      id,
      label,
      status: 'skip',
      message: `${repoPath} not accessible from Web Admin host — configure on GMS SVN SERVER`,
      deferredToAgent: true,
    };
  }
}

async function checkNasPath(
  id: string,
  label: string,
  targetPath: string,
  requireWrite: boolean,
): Promise<StorageConnectionCheck> {
  if (!targetPath.trim()) {
    return { id, label, status: 'fail', message: 'Path is not configured' };
  }

  if (!isUncPath(targetPath) && !isLocalDrivePath(targetPath)) {
    return { id, label, status: 'warn', message: `${targetPath} is not a recognized Windows path format` };
  }

  try {
    await fs.access(targetPath, fs.constants.R_OK);
    const stat = await fs.stat(targetPath);
    if (!stat.isDirectory()) {
      return { id, label, status: 'fail', message: `${targetPath} exists but is not a directory` };
    }

    if (requireWrite) {
      const probe = path.join(targetPath, `.gms-svn-probe-${Date.now()}.tmp`);
      await fs.writeFile(probe, 'probe', 'utf8');
      await fs.unlink(probe);
      return { id, label, status: 'pass', message: `${targetPath} is readable and writable` };
    }

    return { id, label, status: 'pass', message: `${targetPath} is readable` };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'not accessible';
    return {
      id,
      label,
      status: 'fail',
      message: `${targetPath} — ${detail}. Verify NAS share permissions from Web Admin host.`,
    };
  }
}

export async function runStorageConnectionTest(
  settings: PlatformStorageSettings,
): Promise<StorageConnectionTestResult> {
  const checks: StorageConnectionCheck[] = [
    await checkDnsHost(settings.gmsSvnServerHost),
    await checkVisualSvnUrl(settings.visualsvnUrl),
    await checkServerLocalPath('repo-root', 'VisualSVN repository root', settings.visualsvnRepoRoot),
    await checkNasPath('storage-backup', 'Backup path (NAS)', settings.storageBackupPath, true),
    await checkNasPath('storage-reports', 'Reports path (NAS)', settings.storageReportsPath, true),
    await checkNasPath('storage-attachments', 'Attachments path (NAS)', settings.storageAttachmentsPath, true),
    await checkNasPath('storage-logs', 'Logs export path (NAS)', settings.storageLogsPath, true),
    {
      id: 'storage-backend',
      label: 'Storage backend selection',
      status: settings.storageBackend === 'smb' ? 'warn' : 'pass',
      message:
        settings.storageBackend === 'smb'
          ? 'SMB repo storage selected — requires VisualSVN network-share sign-off (see runbook)'
          : 'iSCSI block volume selected (recommended for production repo data)',
    },
  ];

  return {
    overall: overallFromChecks(checks),
    testedAt: new Date().toISOString(),
    testedFrom: os.hostname(),
    settings,
    checks,
  };
}
