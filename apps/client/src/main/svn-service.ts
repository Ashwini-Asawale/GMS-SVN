import { randomUUID } from 'node:crypto';
import { enqueueAudit, peekAuditQueue, clearAuditQueue } from './audit-queue.js';
import { ensureAccessToken, postAudit, refreshAccessToken } from './api-client.js';
import { loadAuth, saveAuth, type StoredAuth } from './auth-store.js';
import {
  addWorkingCopy,
  listWorkingCopies,
  updateWorkingCopy,
  type WorkingCopy,
} from './working-copy-store.js';
import {
  findRegisteredWorkingCopy,
  inferRepositoryName,
  isWorkingCopyRoot,
  resolveWorkingCopyRoot,
  workingCopyNotFoundMessage,
} from './wc-resolver.js';
import { resolveRepositoryRootUrl } from './repo-url.js';
import { hasCompleteSvnCredentials, svnCredentialsMissingMessage } from './svn-credentials.js';
import { parseSvnStatus, type SvnStatusEntry } from './svn-status-parser.js';
import {
  getHostname,
  isMockMode,
  parseRevisionFromCommit,
  parseRevisionFromInfo,
  parseRevisionFromUpdate,
  parseUrlFromInfo,
  svnAdd,
  svnAddUnversioned,
  svnBlame,
  svnCheckout,
  svnCleanup,
  svnCommit,
  svnCopy,
  svnDelete,
  svnDiff,
  svnExport,
  svnImport,
  svnInfo,
  svnList,
  svnLock,
  svnLog,
  svnMove,
  svnPropGet,
  svnMerge,
  svnApplyPatch,
  svnPropList,
  svnPropSet,
  svnRelocate,
  svnResolve,
  svnRevert,
  svnStatus,
  svnStatusQuiet,
  svnSwitch,
  svnUnlock,
  svnUpdate,
  type SvnResult,
} from './svn-runner.js';

export type ShellAction =
  | 'update'
  | 'update-revision'
  | 'commit'
  | 'diff'
  | 'revert'
  | 'log'
  | 'lock'
  | 'unlock'
  | 'add'
  | 'delete'
  | 'cleanup'
  | 'blame'
  | 'resolve'
  | 'status'
  | 'repobrowser'
  | 'export'
  | 'switch'
  | 'relocate'
  | 'branchtag'
  | 'merge'
  | 'properties'
  | 'copyurl'
  | 'createpatch'
  | 'applypatch'
  | 'rename';

async function resolveAuth(): Promise<{ accessToken: string; auth: StoredAuth } | null> {
  const auth = loadAuth();
  if (!auth) return null;

  let accessToken = await ensureAccessToken(auth);
  if (!accessToken) {
    accessToken = (await refreshAccessToken(auth.refreshToken)) ?? null;
  }
  if (!accessToken) return null;

  if (accessToken !== auth.accessToken) {
    saveAuth({ ...auth, accessToken });
  }

  return { accessToken, auth: { ...auth, accessToken } };
}

async function auditWithFallback(
  accessToken: string,
  event: {
    action: string;
    repositoryName?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const ok = await postAudit(accessToken, {
    ...event,
    sourceMachine: getHostname(),
  });
  if (!ok) {
    enqueueAudit({ ...event, sourceMachine: getHostname() });
  }
}

export async function flushAuditQueue(accessToken: string): Promise<number> {
  const queue = peekAuditQueue();
  if (queue.length === 0) return 0;

  let sent = 0;
  const remaining = [];
  for (const item of queue) {
    const ok = await postAudit(accessToken, item);
    if (ok) sent++;
    else remaining.push(item);
  }
  clearAuditQueue();
  for (const item of remaining) enqueueAudit(item);
  return sent;
}

function resolveWorkingCopy(id: string): WorkingCopy | null {
  return listWorkingCopies().find((x) => x.id === id) ?? null;
}

function wcNotFound(): SvnResult {
  return { success: false, stderr: 'Working copy not found', stdout: '', exitCode: 1 };
}

export function formatRepoContext(wc: Pick<WorkingCopy, 'repositoryName' | 'svnUrl' | 'localPath'>): string {
  return `Repository: ${wc.repositoryName}\nURL: ${wc.svnUrl}\nLocal path: ${wc.localPath}`;
}

export async function getWorkingCopyContextForPath(targetPath: string): Promise<WorkingCopy | null> {
  const wcRoot = resolveWorkingCopyRoot(targetPath);
  if (!wcRoot) return null;
  return ensureRegisteredWorkingCopy(wcRoot);
}

async function ensureRegisteredWorkingCopy(wcRoot: string): Promise<WorkingCopy> {
  const existing = findRegisteredWorkingCopy(wcRoot);
  if (existing) return existing;

  const info = await svnInfo(wcRoot);
  const wc: WorkingCopy = {
    id: randomUUID(),
    localPath: wcRoot,
    svnUrl: parseUrlFromInfo(info.stdout) ?? '',
    repositoryName: await inferRepositoryName(wcRoot),
    lastRevision: parseRevisionFromInfo(info.stdout),
    lastUpdated: new Date().toISOString(),
  };
  addWorkingCopy(wc);
  return wc;
}

async function autoAddPaths(wcPath: string, paths: string[]): Promise<SvnResult | null> {
  for (const relativePath of paths) {
    const status = await svnStatusQuiet(wcPath, relativePath);
    if (status.success && status.stdout.trim().startsWith('?')) {
      const added = await svnAdd(wcPath, relativePath);
      if (!added.success) return added;
    }
  }
  return null;
}

export async function runSvnStatusById(id: string): Promise<SvnResult & { entries: SvnStatusEntry[] }> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return { ...wcNotFound(), entries: [] };

  const result = await svnStatus(wc.localPath);
  const entries = result.success ? parseSvnStatus(result.stdout) : [];
  return { ...result, entries };
}

export async function runSvnUpdateById(
  id: string,
  accessToken: string,
  source: 'client' | 'explorer' = 'client',
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();

  const result = await svnUpdate(wc.localPath);
  if (result.success) {
    const rev = parseRevisionFromUpdate(result.stdout);
    updateWorkingCopy(id, { lastRevision: rev, lastUpdated: new Date().toISOString() });
    await auditWithFallback(accessToken, {
      action: 'svn.update',
      repositoryName: wc.repositoryName,
      metadata: { revision: rev, localPath: wc.localPath, source },
    });
  }
  return result;
}

export async function runSvnCommitById(
  id: string,
  message: string,
  accessToken: string,
  source: 'client' | 'explorer' = 'client',
  relativePaths?: string[],
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();

  if (!isWorkingCopyRoot(wc.localPath)) {
    return {
      success: false,
      stderr: workingCopyNotFoundMessage({ mockMode: isMockMode() }),
      stdout: '',
      exitCode: 1,
    };
  }

  if (relativePaths && relativePaths.length > 0) {
    const addErr = await autoAddPaths(wc.localPath, relativePaths);
    if (addErr) return addErr;
  } else {
    const added = await svnAddUnversioned(wc.localPath);
    if (!added.success) return added;
  }

  if (!hasCompleteSvnCredentials()) {
    const auth = loadAuth();
    return {
      success: false,
      stderr:
        svnCredentialsMissingMessage(auth?.username) +
        '\n\nTip: Sign out and sign in again in GMS SVN CLIENT so your SVN password is saved.',
      stdout: '',
      exitCode: 1,
    };
  }

  const result = await svnCommit(
    wc.localPath,
    message,
    relativePaths && relativePaths.length > 0 ? relativePaths : undefined,
  );
  if (result.success) {
    const rev = parseRevisionFromCommit(result.stdout);
    const auth = loadAuth();
    updateWorkingCopy(id, { lastRevision: rev, lastUpdated: new Date().toISOString() });
    await auditWithFallback(accessToken, {
      action: 'svn.commit',
      repositoryName: wc.repositoryName,
      metadata: {
        revision: rev,
        message,
        paths: relativePaths,
        source,
        svnAuthor: auth?.username ?? null,
        svnAuthorEmail: auth?.email ?? null,
      },
    });
  }
  return result;
}

export async function runSvnAddById(
  id: string,
  relativePath: string,
  accessToken: string,
  source: 'client' | 'explorer' = 'client',
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  const result = await svnAdd(wc.localPath, relativePath);
  if (result.success) {
    await auditWithFallback(accessToken, {
      action: 'svn.add',
      repositoryName: wc.repositoryName,
      metadata: { path: relativePath, source },
    });
  }
  return result;
}

export async function runSvnDeleteById(
  id: string,
  relativePath: string,
  accessToken: string,
  source: 'client' | 'explorer' = 'client',
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  const result = await svnDelete(wc.localPath, relativePath);
  if (result.success) {
    await auditWithFallback(accessToken, {
      action: 'svn.delete',
      repositoryName: wc.repositoryName,
      metadata: { path: relativePath, source },
    });
  }
  return result;
}

export async function runSvnMoveById(
  id: string,
  fromPath: string,
  toPath: string,
  accessToken: string,
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  const result = await svnMove(wc.localPath, fromPath, toPath);
  if (result.success) {
    await auditWithFallback(accessToken, {
      action: 'svn.move',
      repositoryName: wc.repositoryName,
      metadata: { from: fromPath, to: toPath },
    });
  }
  return result;
}

export async function runSvnCleanupById(id: string, accessToken: string): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  const result = await svnCleanup(wc.localPath);
  if (result.success) {
    await auditWithFallback(accessToken, {
      action: 'svn.cleanup',
      repositoryName: wc.repositoryName,
    });
  }
  return result;
}

export async function runSvnBlameById(
  id: string,
  accessToken: string,
  relativePath?: string,
  source: 'client' | 'explorer' = 'client',
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  const result = await svnBlame(wc.localPath, relativePath);
  if (result.success) {
    await auditWithFallback(accessToken, {
      action: 'svn.blame',
      repositoryName: wc.repositoryName,
      metadata: { path: relativePath ?? '.', source },
    });
  }
  return result;
}

export async function runSvnResolveById(
  id: string,
  relativePath: string,
  accept: 'working' | 'mine-full' | 'theirs-full' | 'base',
  accessToken: string,
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  const result = await svnResolve(wc.localPath, relativePath, accept);
  if (result.success) {
    await auditWithFallback(accessToken, {
      action: 'svn.resolve',
      repositoryName: wc.repositoryName,
      metadata: { path: relativePath, accept },
    });
  }
  return result;
}

export async function runSvnPropListById(
  id: string,
  _accessToken: string,
  relativePath?: string,
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  return svnPropList(wc.localPath, relativePath);
}

export async function runSvnPropGetById(
  id: string,
  propName: string,
  _accessToken: string,
  relativePath?: string,
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  return svnPropGet(wc.localPath, propName, relativePath);
}

export async function runSvnPropSetById(
  id: string,
  propName: string,
  value: string,
  accessToken: string,
  relativePath?: string,
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  const result = await svnPropSet(wc.localPath, propName, value, relativePath);
  if (result.success) {
    await auditWithFallback(accessToken, {
      action: 'svn.propset',
      repositoryName: wc.repositoryName,
      metadata: { propName, path: relativePath ?? '.' },
    });
  }
  return result;
}

export async function runSvnListById(
  id: string,
  _accessToken: string,
  relativePath?: string,
  options?: { fromRepoRoot?: boolean },
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  const base =
    options?.fromRepoRoot === false
      ? wc.svnUrl
      : resolveRepositoryRootUrl(wc.svnUrl, wc.repositoryName);
  return svnList(base, relativePath);
}

export async function runSvnExportById(
  id: string,
  targetPath: string,
  accessToken: string,
  relativePath?: string,
  revision?: string,
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  const url = relativePath
    ? `${wc.svnUrl.replace(/\/$/, '')}/${relativePath}`
    : wc.svnUrl;
  const result = await svnExport(url, targetPath, revision);
  if (result.success) {
    await auditWithFallback(accessToken, {
      action: 'svn.export',
      repositoryName: wc.repositoryName,
      metadata: { targetPath, url },
    });
  }
  return result;
}

export async function runSvnSwitchById(
  id: string,
  url: string,
  accessToken: string,
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  const result = await svnSwitch(wc.localPath, url);
  if (result.success) {
    updateWorkingCopy(id, { svnUrl: url, lastUpdated: new Date().toISOString() });
    await auditWithFallback(accessToken, {
      action: 'svn.switch',
      repositoryName: wc.repositoryName,
      metadata: { url },
    });
  }
  return result;
}

export async function runSvnRelocateById(
  id: string,
  fromUrl: string,
  toUrl: string,
  accessToken: string,
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  const result = await svnRelocate(wc.localPath, fromUrl, toUrl);
  if (result.success) {
    updateWorkingCopy(id, { svnUrl: toUrl, lastUpdated: new Date().toISOString() });
    await auditWithFallback(accessToken, {
      action: 'svn.relocate',
      repositoryName: wc.repositoryName,
      metadata: { fromUrl, toUrl },
    });
  }
  return result;
}

export async function runSvnCopyById(
  id: string,
  destUrl: string,
  message: string,
  accessToken: string,
  sourceRelativePath?: string,
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  const repoRoot = resolveRepositoryRootUrl(wc.svnUrl, wc.repositoryName);
  const sourceUrl = sourceRelativePath
    ? `${wc.svnUrl.replace(/\/$/, '')}/${sourceRelativePath}`
    : wc.svnUrl;
  // Destination must stay under repository root (never nest under current branch path).
  const normalizedDest = destUrl.replace(/\/+$/, '');
  if (!normalizedDest.toLowerCase().startsWith(repoRoot.toLowerCase())) {
    return {
      success: false,
      stderr: `Destination URL must be inside the repository root:\n${repoRoot}`,
      stdout: '',
      exitCode: 1,
    };
  }
  const result = await svnCopy(sourceUrl, destUrl, message);
  if (result.success) {
    await auditWithFallback(accessToken, {
      action: 'svn.copy',
      repositoryName: wc.repositoryName,
      metadata: { sourceUrl, destUrl, message },
    });
  }
  return result;
}

export async function runSvnMergeById(
  id: string,
  sourceUrl: string,
  accessToken: string,
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  const result = await svnMerge(wc.localPath, sourceUrl);
  if (result.success) {
    await auditWithFallback(accessToken, {
      action: 'svn.merge',
      repositoryName: wc.repositoryName,
      metadata: { sourceUrl },
    });
  }
  return result;
}

export async function runSvnImport(
  localPath: string,
  url: string,
  message: string,
  accessToken: string,
): Promise<SvnResult> {
  const result = await svnImport(localPath, url, message);
  if (result.success) {
    await auditWithFallback(accessToken, {
      action: 'svn.import',
      metadata: { localPath, url, message },
    });
  }
  return result;
}

export async function runSvnDiffById(
  id: string,
  accessToken: string,
  relativePath?: string,
  source: 'client' | 'explorer' = 'client',
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();

  const result = await svnDiff(wc.localPath, relativePath);
  if (result.success) {
    await auditWithFallback(accessToken, {
      action: 'svn.diff',
      repositoryName: wc.repositoryName,
      metadata: { path: relativePath ?? '.', source },
    });
  }
  return result;
}

export async function runSvnLogById(
  id: string,
  accessToken: string,
  limit = 20,
  source: 'client' | 'explorer' = 'client',
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();

  const result = await svnLog(wc.localPath, limit);
  if (result.success) {
    await auditWithFallback(accessToken, {
      action: 'svn.log',
      repositoryName: wc.repositoryName,
      metadata: { source },
    });
  }
  return result;
}

export async function runSvnRevertById(
  id: string,
  accessToken: string,
  relativePath?: string,
  source: 'client' | 'explorer' = 'client',
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();

  const result = await svnRevert(wc.localPath, relativePath);
  if (result.success) {
    await auditWithFallback(accessToken, {
      action: 'svn.revert',
      repositoryName: wc.repositoryName,
      metadata: { path: relativePath ?? 'recursive', source },
    });
  }
  return result;
}

export async function runSvnLockById(
  id: string,
  relativePath: string,
  accessToken: string,
  message?: string,
  source: 'client' | 'explorer' = 'client',
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  const result = await svnLock(wc.localPath, relativePath, message);
  if (result.success) {
    await auditWithFallback(accessToken, {
      action: 'svn.lock',
      repositoryName: wc.repositoryName,
      metadata: { path: relativePath, source },
    });
  }
  return result;
}

export async function runSvnUnlockById(
  id: string,
  relativePath: string,
  accessToken: string,
  source: 'client' | 'explorer' = 'client',
): Promise<SvnResult> {
  const wc = resolveWorkingCopy(id);
  if (!wc) return wcNotFound();
  const result = await svnUnlock(wc.localPath, relativePath);
  if (result.success) {
    await auditWithFallback(accessToken, {
      action: 'svn.unlock',
      repositoryName: wc.repositoryName,
      metadata: { path: relativePath, source },
    });
  }
  return result;
}

export async function runSvnCheckout(input: {
  url: string;
  localPath: string;
  repositoryName: string;
  accessToken: string;
}): Promise<SvnResult & { workingCopy: WorkingCopy | null }> {
  const result = await svnCheckout(input.url, input.localPath);
  if (!result.success) return { ...result, workingCopy: null };

  if (!isWorkingCopyRoot(input.localPath)) {
    return {
      success: false,
      stderr:
        result.stderr.trim() ||
        workingCopyNotFoundMessage({ mockMode: isMockMode() }) +
          ' Checkout did not create a .svn folder at ' +
          input.localPath,
      stdout: result.stdout,
      exitCode: 1,
      workingCopy: null,
    };
  }

  const info = await svnInfo(input.localPath);
  const wc: WorkingCopy = {
    id: randomUUID(),
    localPath: input.localPath,
    svnUrl: parseUrlFromInfo(info.stdout) ?? input.url,
    repositoryName: input.repositoryName,
    lastRevision: parseRevisionFromInfo(info.stdout),
    lastUpdated: new Date().toISOString(),
  };
  addWorkingCopy(wc);

  await auditWithFallback(input.accessToken, {
    action: 'svn.checkout',
    repositoryName: input.repositoryName,
    metadata: { localPath: input.localPath, svnUrl: wc.svnUrl },
  });

  return { ...result, workingCopy: wc };
}

function relativePathWithinWorkingCopy(wcRoot: string, targetPath: string): string | undefined {
  const root = wcRoot.replace(/\\/g, '/');
  const target = targetPath.replace(/\\/g, '/');
  if (target === root) return undefined;
  if (target.startsWith(`${root}/`)) {
    return target.slice(root.length + 1);
  }
  return undefined;
}

export async function runShellAction(input: {
  action: ShellAction;
  targetPath: string;
  message?: string;
  url?: string;
  revision?: string;
  destPath?: string;
  accessToken?: string;
}): Promise<SvnResult> {
  const wcRoot = resolveWorkingCopyRoot(input.targetPath);
  if (!wcRoot) {
    const registered = findRegisteredWorkingCopy(input.targetPath);
    return {
      success: false,
      stderr: workingCopyNotFoundMessage({
        mockMode: isMockMode() || Boolean(registered),
      }),
      stdout: '',
      exitCode: 1,
    };
  }

  const authResult = input.accessToken
    ? { accessToken: input.accessToken, auth: loadAuth()! }
    : await resolveAuth();

  if (!authResult?.accessToken) {
    return {
      success: false,
      stderr: 'Not logged in. Open GMS SVN CLIENT and sign in first.',
      stdout: '',
      exitCode: 1,
    };
  }

  await flushAuditQueue(authResult.accessToken);

  const wc = await ensureRegisteredWorkingCopy(wcRoot);
  const relativePath = relativePathWithinWorkingCopy(wcRoot, input.targetPath);

  switch (input.action) {
    case 'update':
      return runSvnUpdateById(wc.id, authResult.accessToken, 'explorer');
    case 'update-revision': {
      if (!input.revision?.trim()) {
        return { success: false, stderr: 'Revision is required.', stdout: '', exitCode: 1 };
      }
      const result = await svnUpdate(wc.localPath, input.revision.trim());
      if (result.success) {
        await auditWithFallback(authResult.accessToken, {
          action: 'svn.update',
          repositoryName: wc.repositoryName,
          metadata: { revision: input.revision, source: 'explorer' },
        });
      }
      return result;
    }
    case 'commit':
      if (!input.message?.trim()) {
        return {
          success: false,
          stderr: 'Commit message is required.',
          stdout: '',
          exitCode: 1,
        };
      }
      return runSvnCommitById(
        wc.id,
        input.message.trim(),
        authResult.accessToken,
        'explorer',
        relativePath ? [relativePath] : undefined,
      );
    case 'diff':
      return runSvnDiffById(wc.id, authResult.accessToken, relativePath, 'explorer');
    case 'log':
      return runSvnLogById(wc.id, authResult.accessToken, 20, 'explorer');
    case 'revert':
      return runSvnRevertById(wc.id, authResult.accessToken, relativePath, 'explorer');
    case 'add':
      if (!relativePath) {
        return { success: false, stderr: 'Select a file or folder to add.', stdout: '', exitCode: 1 };
      }
      return runSvnAddById(wc.id, relativePath, authResult.accessToken, 'explorer');
    case 'delete':
      if (!relativePath) {
        return { success: false, stderr: 'Select a file or folder to delete.', stdout: '', exitCode: 1 };
      }
      return runSvnDeleteById(wc.id, relativePath, authResult.accessToken, 'explorer');
    case 'cleanup':
      return runSvnCleanupById(wc.id, authResult.accessToken);
    case 'blame':
      return runSvnBlameById(wc.id, authResult.accessToken, relativePath, 'explorer');
    case 'resolve':
      if (!relativePath) {
        return { success: false, stderr: 'Select a conflicted file to resolve.', stdout: '', exitCode: 1 };
      }
      return runSvnResolveById(wc.id, relativePath, 'working', authResult.accessToken);
    case 'status':
      return runSvnStatusById(wc.id);
    case 'repobrowser':
      return runSvnListById(wc.id, authResult.accessToken, relativePath, { fromRepoRoot: false });
    case 'export': {
      if (!input.destPath?.trim()) {
        return { success: false, stderr: 'Export folder is required.', stdout: '', exitCode: 1 };
      }
      return runSvnExportById(wc.id, input.destPath.trim(), authResult.accessToken, relativePath);
    }
    case 'switch': {
      if (!input.url?.trim()) {
        return { success: false, stderr: 'Switch URL is required.', stdout: '', exitCode: 1 };
      }
      return runSvnSwitchById(wc.id, input.url.trim(), authResult.accessToken);
    }
    case 'relocate': {
      if (!input.url?.trim() || !input.destPath?.trim()) {
        return { success: false, stderr: 'From URL and To URL are required.', stdout: '', exitCode: 1 };
      }
      return runSvnRelocateById(wc.id, input.url.trim(), input.destPath.trim(), authResult.accessToken);
    }
    case 'branchtag': {
      if (!input.url?.trim() || !input.message?.trim()) {
        return { success: false, stderr: 'Branch/tag URL and message are required.', stdout: '', exitCode: 1 };
      }
      return runSvnCopyById(
        wc.id,
        input.url.trim(),
        input.message.trim(),
        authResult.accessToken,
        relativePath,
      );
    }
    case 'merge': {
      if (!input.url?.trim()) {
        return { success: false, stderr: 'Merge source URL is required.', stdout: '', exitCode: 1 };
      }
      const result = await svnMerge(wc.localPath, input.url.trim());
      if (result.success) {
        await auditWithFallback(authResult.accessToken, {
          action: 'svn.merge',
          repositoryName: wc.repositoryName,
          metadata: { sourceUrl: input.url, source: 'explorer' },
        });
      }
      return result;
    }
    case 'properties':
      return runSvnPropListById(wc.id, authResult.accessToken, relativePath);
    case 'copyurl': {
      const info = await svnInfo(wc.localPath);
      if (!info.success) return info;
      const fileUrl = relativePath
        ? `${(parseUrlFromInfo(info.stdout) ?? wc.svnUrl).replace(/\/$/, '')}/${relativePath}`
        : (parseUrlFromInfo(info.stdout) ?? wc.svnUrl);
      return { success: true, stdout: fileUrl, stderr: '', exitCode: 0 };
    }
    case 'createpatch': {
      const diff = await svnDiff(wc.localPath, relativePath);
      if (!diff.success) return diff;
      if (!input.destPath?.trim()) {
        return { success: false, stderr: 'Patch file path is required.', stdout: '', exitCode: 1 };
      }
      const fs = await import('node:fs');
      fs.writeFileSync(input.destPath.trim(), diff.stdout, 'utf8');
      return {
        success: true,
        stdout: `Patch saved: ${input.destPath.trim()}`,
        stderr: '',
        exitCode: 0,
      };
    }
    case 'applypatch': {
      if (!input.destPath?.trim()) {
        return { success: false, stderr: 'Patch file path is required.', stdout: '', exitCode: 1 };
      }
      return svnApplyPatch(wc.localPath, input.destPath.trim());
    }
    case 'rename': {
      if (!relativePath || !input.destPath?.trim()) {
        return { success: false, stderr: 'Select a file and provide the new name.', stdout: '', exitCode: 1 };
      }
      return runSvnMoveById(wc.id, relativePath, input.destPath.trim(), authResult.accessToken);
    }
    case 'lock':
      if (!relativePath) {
        return {
          success: false,
          stderr: 'Select a file to lock (not the working copy root).',
          stdout: '',
          exitCode: 1,
        };
      }
      return runSvnLockById(wc.id, relativePath, authResult.accessToken, input.message, 'explorer');
    case 'unlock':
      if (!relativePath) {
        return {
          success: false,
          stderr: 'Select a file to unlock (not the working copy root).',
          stdout: '',
          exitCode: 1,
        };
      }
      return runSvnUnlockById(wc.id, relativePath, authResult.accessToken, 'explorer');
    default:
      return { success: false, stderr: `Unknown action: ${input.action}`, stdout: '', exitCode: 1 };
  }
}

export { resolveAuth };
