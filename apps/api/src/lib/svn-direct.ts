import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface SvnDirectSettings {
  visualsvnUrl: string;
  visualsvnRepoRoot: string;
  svnExe?: string;
}

export function resolveSvnExe(explicit?: string): string | null {
  const candidates = [
    explicit,
    process.env.SVN_EXE_PATH,
    process.env.GMS_SVN_CLIENT_SVN_EXE,
    'C:\\Program Files\\GMS SVN CLIENT\\svn\\svn.exe',
    'C:\\Program Files\\TortoiseSVN\\bin\\svn.exe',
    'C:\\Program Files\\SlikSvn\\bin\\svn.exe',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return 'svn';
}

function buildRepoUrl(settings: SvnDirectSettings, repositoryName: string): string {
  return `${settings.visualsvnUrl.replace(/\/+$/, '')}/${repositoryName}`;
}

function buildRepoUrlPath(settings: SvnDirectSettings, repositoryName: string, repoPath: string): string {
  const base = buildRepoUrl(settings, repositoryName);
  const normalized = repoPath && repoPath !== '/' ? repoPath.replace(/^\/+/, '') : '';
  return normalized ? `${base}/${normalized}` : base;
}

function resolveSvnServiceCredentials(): { username: string; password: string } {
  return {
    username: process.env.SVN_SERVICE_USERNAME ?? process.env.SVN_ADMIN_USERNAME ?? 'admin',
    password: process.env.SVN_SERVICE_PASSWORD ?? process.env.SVN_ADMIN_PASSWORD ?? 'admin123',
  };
}

function buildSvnServiceAuthArgs(requireAuth: boolean): string[] {
  if (!requireAuth) return [];
  const creds = resolveSvnServiceCredentials();
  return [
    '--username',
    creds.username,
    '--password',
    creds.password,
    '--non-interactive',
    '--no-auth-cache',
  ];
}

function parseRevisionFromCommit(stdout: string): number | null {
  const match = stdout.match(/revision\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

async function runSvn(exe: string, args: string[], requireAuth = false): Promise<{ stdout: string; stderr: string }> {
  const authArgs = buildSvnServiceAuthArgs(requireAuth);
  const timeoutMs = 25_000;
  try {
    const result = await Promise.race([
      execFileAsync(exe, [...authArgs, ...args], {
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('SVN command timed out. Start svnserve (Start-Dev-Stack.bat).')),
          timeoutMs,
        );
      }),
    ]);
    const { stdout, stderr } = result;
    return { stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
    const stdout = e.stdout?.toString?.() ?? '';
    const stderr = e.stderr?.toString?.() ?? e.message ?? 'svn command failed';
    throw new Error(stderr.trim() || stdout.trim() || 'svn command failed');
  }
}

function parseRevisionFromInfo(stdout: string): number | null {
  const match = stdout.match(/^Revision:\s*(\d+)/m);
  return match ? Number(match[1]) : null;
}

function parseSvnLogXml(xml: string): {
  entries: {
    revision: number;
    author: string;
    date: string;
    message: string;
    paths: { path: string; action: string }[];
  }[];
} {
  const entries: {
    revision: number;
    author: string;
    date: string;
    message: string;
    paths: { path: string; action: string }[];
  }[] = [];

  const entryRegex = /<logentry\s+revision="(\d+)">([\s\S]*?)<\/logentry>/g;
  let match: RegExpExecArray | null;
  while ((match = entryRegex.exec(xml)) !== null) {
    const revision = Number(match[1]);
    const block = match[2];
    const author = block.match(/<author>([\s\S]*?)<\/author>/)?.[1]?.trim() ?? '';
    const date = block.match(/<date>([\s\S]*?)<\/date>/)?.[1]?.trim() ?? '';
    const message = block.match(/<msg>([\s\S]*?)<\/msg>/)?.[1]?.trim() ?? '';
    const paths: { path: string; action: string }[] = [];
    const pathRegex = /<path\s+([^>]*?)>([\s\S]*?)<\/path>/g;
    let pathMatch: RegExpExecArray | null;
    while ((pathMatch = pathRegex.exec(block)) !== null) {
      const attrs = pathMatch[1];
      const action = attrs.match(/action="([^"]+)"/)?.[1] ?? 'M';
      paths.push({ path: pathMatch[2].trim(), action });
    }
    entries.push({ revision, author, date, message, paths });
  }

  return { entries };
}

export async function svnDirectListPath(
  settings: SvnDirectSettings,
  repositoryName: string,
  repoPath: string,
): Promise<{ path: string; entries: { name: string; kind: 'dir' | 'file' }[] }> {
  const exe = resolveSvnExe(settings.svnExe);
  if (!exe) throw new Error('svn executable not found');

  const url = buildRepoUrlPath(settings, repositoryName, repoPath || '/');
  const { stdout } = await runSvn(exe, ['list', url]);
  const entries = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      name: line.endsWith('/') ? line.slice(0, -1) : line,
      kind: line.endsWith('/') ? ('dir' as const) : ('file' as const),
    }));

  return { path: repoPath || '/', entries };
}

export async function svnDirectGetLog(
  settings: SvnDirectSettings,
  repositoryName: string,
  repoPath: string,
  limit: number,
): Promise<{
  entries: {
    revision: number;
    author: string;
    date: string;
    message: string;
    paths: { path: string; action: string }[];
  }[];
}> {
  const exe = resolveSvnExe(settings.svnExe);
  if (!exe) throw new Error('svn executable not found');

  const url = buildRepoUrlPath(settings, repositoryName, repoPath || '/');
  const { stdout } = await runSvn(exe, ['log', '-l', String(limit), '--xml', '--verbose', url]);
  return parseSvnLogXml(stdout);
}

export async function svnDirectGetDiff(
  settings: SvnDirectSettings,
  repositoryName: string,
  repoPath: string,
  revision: number,
): Promise<{ revision: number; path: string; diff: string }> {
  const exe = resolveSvnExe(settings.svnExe);
  if (!exe) throw new Error('svn executable not found');

  const url = buildRepoUrlPath(settings, repositoryName, repoPath || '/');
  const { stdout } = await runSvn(exe, ['diff', '-c', String(revision), url]);
  return { revision, path: repoPath || '/', diff: stdout };
}

export async function svnDirectGetRepositoryStatus(
  settings: SvnDirectSettings,
  repositoryName: string,
): Promise<{ name: string; latestRevision: number | null; sizeBytes: string; lockCount: number }> {
  const exe = resolveSvnExe(settings.svnExe);
  if (!exe) throw new Error('svn executable not found');

  const url = buildRepoUrl(settings, repositoryName);
  const { stdout } = await runSvn(exe, ['info', url]);
  const latestRevision = parseRevisionFromInfo(stdout);

  const fsRepo = path.join(settings.visualsvnRepoRoot, repositoryName);
  let sizeBytes = '0';
  if (fs.existsSync(fsRepo)) {
    sizeBytes = String(await directorySize(fsRepo));
  }

  return {
    name: repositoryName,
    latestRevision,
    sizeBytes,
    lockCount: 0,
  };
}

export async function svnDirectListRepositories(settings: SvnDirectSettings): Promise<{
  repositories: { name: string; latestRevision: number | null; sizeBytes: string | null }[];
}> {
  const root = settings.visualsvnRepoRoot;
  if (!fs.existsSync(root)) {
    return { repositories: [] };
  }

  const exe = resolveSvnExe(settings.svnExe);
  const names = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(root, name, 'format')));

  const repositories = [];
  for (const name of names) {
    try {
      const status = exe
        ? await svnDirectGetRepositoryStatus(settings, name)
        : { latestRevision: null, sizeBytes: '0' };
      repositories.push({
        name,
        latestRevision: status.latestRevision,
        sizeBytes: status.sizeBytes,
      });
    } catch {
      repositories.push({ name, latestRevision: null, sizeBytes: null });
    }
  }

  return { repositories };
}

async function directorySize(dir: string): Promise<number> {
  let total = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        try {
          total += fs.statSync(full).size;
        } catch {
          // skip unreadable files
        }
      }
    }
  }
  return total;
}

export function svnDirectAvailable(settings: SvnDirectSettings): boolean {
  if (!settings.visualsvnUrl || !settings.visualsvnRepoRoot) return false;
  if (!fs.existsSync(settings.visualsvnRepoRoot)) return false;
  return Boolean(resolveSvnExe(settings.svnExe));
}

export async function svnDirectPathExists(
  settings: SvnDirectSettings,
  repositoryName: string,
  repoPath: string,
): Promise<boolean> {
  try {
    await svnDirectListPath(settings, repositoryName, repoPath);
    return true;
  } catch {
    return false;
  }
}

export async function svnDirectCopy(
  settings: SvnDirectSettings,
  sourceUrl: string,
  destUrl: string,
  message: string,
): Promise<{ revision: number | null; stdout: string }> {
  const exe = resolveSvnExe(settings.svnExe);
  if (!exe) throw new Error('svn executable not found');

  const { stdout, stderr } = await runSvn(
    exe,
    ['copy', '-m', message, '--parents', sourceUrl, destUrl],
    true,
  );
  const combined = stdout.trim() || stderr.trim();
  return { revision: parseRevisionFromCommit(combined), stdout: combined };
}

export async function svnDirectCreateBranch(
  settings: SvnDirectSettings,
  repositoryName: string,
  branchName: string,
  sourcePath: string,
  message: string,
): Promise<{ branchName: string; branchPath: string; sourcePath: string; destUrl: string; revision: number | null }> {
  const safeName = branchName.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!safeName || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(safeName)) {
    throw new Error('Invalid branch name. Use letters, numbers, dots, dashes, or underscores.');
  }

  const branchPath = `/branches/${safeName}`;
  if (await svnDirectPathExists(settings, repositoryName, branchPath)) {
    throw new Error(`Branch "${safeName}" already exists.`);
  }

  const normalizedSource = sourcePath && sourcePath !== '/' ? sourcePath.replace(/^\/+/, '') : '';
  if (normalizedSource) {
    const sourceExists = await svnDirectPathExists(settings, repositoryName, `/${normalizedSource}`);
    if (!sourceExists) {
      throw new Error(`Source path "/${normalizedSource}" does not exist in this repository.`);
    }
  }

  const repoRoot = buildRepoUrl(settings, repositoryName);
  const sourceUrl = normalizedSource ? `${repoRoot}/${normalizedSource}` : repoRoot;
  const destUrl = `${repoRoot}/branches/${safeName}`;

  const result = await svnDirectCopy(settings, sourceUrl, destUrl, message);
  return {
    branchName: safeName,
    branchPath,
    sourcePath: normalizedSource ? `/${normalizedSource}` : '/',
    destUrl,
    revision: result.revision,
  };
}
