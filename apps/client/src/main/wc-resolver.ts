import fs from 'node:fs';
import path from 'node:path';
import { listWorkingCopies, type WorkingCopy } from './working-copy-store.js';
import { svnInfo, parseUrlFromInfo } from './svn-runner.js';

export function isWorkingCopyRoot(dirPath: string): boolean {
  const svnDir = path.join(dirPath, '.svn');
  return fs.existsSync(svnDir) && fs.statSync(svnDir).isDirectory();
}

export function workingCopyNotFoundMessage(options?: { mockMode?: boolean }): string {
  if (options?.mockMode) {
    return (
      'This folder is not a real SVN working copy. Remove this entry and checkout again with GMS SVN CLIENT ' +
      '(reinstall from Setup.exe if svn engine is missing).'
    );
  }
  return (
    'Not an SVN working copy (no .svn folder found). Use GMS SVN CLIENT → SVN Checkout first.'
  );
}

/** Walk up from file or folder path to find the SVN working copy root. */
export function resolveWorkingCopyRoot(inputPath: string): string | null {
  let current = path.resolve(inputPath);

  try {
    if (!fs.existsSync(current)) return null;
    if (!fs.statSync(current).isDirectory()) {
      current = path.dirname(current);
    }
  } catch {
    return null;
  }

  while (true) {
    if (isWorkingCopyRoot(current)) return current;

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function findRegisteredWorkingCopy(wcRoot: string): WorkingCopy | null {
  const normalized = path.resolve(wcRoot);
  const list = listWorkingCopies();
  return (
    list.find((wc) => path.resolve(wc.localPath) === normalized) ??
    list.find((wc) => normalized.startsWith(path.resolve(wc.localPath) + path.sep)) ??
    null
  );
}

export async function inferRepositoryName(wcRoot: string): Promise<string> {
  const registered = findRegisteredWorkingCopy(wcRoot);
  if (registered) return registered.repositoryName;

  const info = await svnInfo(wcRoot);
  const url = parseUrlFromInfo(info.stdout);
  if (url) {
    const segments = url.replace(/\/+$/, '').split('/');
    const last = segments[segments.length - 1];
    if (last) return last;
  }

  return path.basename(wcRoot);
}
