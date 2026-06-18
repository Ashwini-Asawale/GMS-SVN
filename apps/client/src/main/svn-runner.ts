import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { buildSvnAuthArgs } from './svn-credentials.js';
export interface SvnResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

function installRoot(): string {
  try {
    if (app.isReady()) {
      return path.dirname(app.getPath('exe'));
    }
  } catch {
    // app not ready yet
  }
  return path.dirname(process.execPath);
}

function resolveSvnExe(): string {
  const fromEnv = process.env.GMS_SVN_CLIENT_SVN_EXE;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const bundled = path.join(installRoot(), 'svn', 'svn.exe');
  if (fs.existsSync(bundled)) return bundled;

  // Packaged GMS SVN CLIENT must use its own bundled svn — no TortoiseSVN on client PCs
  try {
    if (app.isPackaged) return bundled;
  } catch {
    // electron not loaded
  }

  // Dev machine fallback only (when running npm run dev:client without bundled svn)
  const candidates = [
    'C:\\Program Files\\TortoiseSVN\\bin\\svn.exe',
    'C:\\Program Files\\SlikSvn\\bin\\svn.exe',
    'C:\\Program Files (x86)\\Subversion\\bin\\svn.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return bundled;
}

export function isBundledSvn(): boolean {
  const bundled = path.join(installRoot(), 'svn', 'svn.exe');
  return fs.existsSync(bundled) && resolveSvnExe() === bundled;
}

export function isMockMode(): boolean {
  if (process.env.CLIENT_SVN_MOCK !== 'true') return false;

  // Packaged installs always use real svn.exe
  try {
    if (app.isPackaged) return false;
  } catch {
    // electron not loaded
  }

  // Dev: if svn.exe exists (TortoiseSVN, bundled, etc.) use it — ignore mock flag
  const exe = resolveSvnExe();
  if (fs.existsSync(exe)) return false;

  return true;
}

export function isSvnAvailable(): boolean {
  if (isMockMode()) return false;
  const exe = resolveSvnExe();
  return fs.existsSync(exe);
}

export function svnMissingMessage(): string {
  return (
    'SVN engine missing from this GMS SVN CLIENT install. Reinstall from the latest ' +
    'GMS-SVN-CLIENT-Setup.exe (includes bundled svn.exe). TortoiseSVN is NOT required on client PCs.'
  );
}
export function getSvnExePath(): string {
  return resolveSvnExe();
}

export function getHostname(): string {
  return os.hostname();
}

function improveSvnError(stderr: string): string {
  const raw = stderr.trim();
  if (!raw) return raw;

  const refused =
    /E730061/i.test(raw) ||
    /actively refused/i.test(raw) ||
    /No connection could be made/i.test(raw);
  if (!refused) return raw;

  const urlMatch = raw.match(/URL\s+'([^']+)'/i);
  const targetUrl = urlMatch?.[1] ?? '';
  let guidance =
    'SVN server is unreachable (connection refused). Start your SVN server service and verify the configured URL/port.';
  if (targetUrl.includes('localhost')) {
    guidance +=
      ' This PC is trying to connect to itself via localhost. For another client PC, set SVN URL to your server IP/hostname instead of localhost.';
  } else if (targetUrl) {
    guidance += ` Verify this URL is reachable in browser: ${targetUrl}`;
  }
  return `${raw}\n\n${guidance}`;
}

async function runSvn(args: string[], cwd?: string): Promise<SvnResult> {
  if (isMockMode()) {
    return mockSvn(args);
  }

  const exe = resolveSvnExe();
  if (!fs.existsSync(exe)) {
    return {
      success: false,
      stdout: '',
      stderr: svnMissingMessage(),
      exitCode: 1,
    };
  }

  return new Promise((resolve) => {
    const proc = spawn(exe, [...buildSvnAuthArgs(), ...args], {
      cwd,
      windowsHide: true,
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('close', (code) => {
      const normalizedStderr = code === 0 ? stderr : improveSvnError(stderr);
      resolve({
        success: code === 0,
        stdout,
        stderr: normalizedStderr,
        exitCode: code ?? 1,
      });
    });
    proc.on('error', (err) => {
      const stderr =
        err.message.includes('ENOENT') ? svnMissingMessage() : err.message;
      resolve({ success: false, stdout: '', stderr, exitCode: 1 });
    });  });
}

function mockSvn(args: string[]): SvnResult {
  const cmd = args[0];
  if (cmd === 'checkout') {
    return {
      success: false,
      stdout: '',
      stderr:
        'Mock checkout is disabled. Reinstall GMS SVN CLIENT from the latest Setup.exe ' +
        '(includes bundled svn.exe). TortoiseSVN is not required.',
      exitCode: 1,
    };
  }
  if (cmd === 'update') {
    const rev = 'Updated to revision 3.';
    return { success: true, stdout: rev, stderr: '', exitCode: 0 };
  }
  if (cmd === 'commit') {
    return { success: true, stdout: 'Committed revision 4.', stderr: '', exitCode: 0 };
  }
  if (cmd === 'diff') {
    return {
      success: true,
      stdout: '--- mock\n+++ mock\n@@ -1 +1 @@\n-old\n+new',
      stderr: '',
      exitCode: 0,
    };
  }
  if (cmd === 'log') {
    const creds = buildSvnAuthArgs();
    const user = creds.includes('--username') ? creds[creds.indexOf('--username') + 1] : 'dev1';
    return {
      success: true,
      stdout: `------------------------------------------------------------------------\nr3 | ${user} | 2026-06-16\n------------------------------------------------------------------------\nMock commit message\n`,
      stderr: '',
      exitCode: 0,
    };
  }
  if (cmd === 'revert') {
    return { success: true, stdout: 'Reverted', stderr: '', exitCode: 0 };
  }
  if (cmd === 'info') {
    return {
      success: true,
      stdout: 'URL: mock\nRevision: 3\n',
      stderr: '',
      exitCode: 0,
    };
  }
  if (cmd === 'lock' || cmd === 'unlock') {
    return { success: true, stdout: `Mock ${cmd}`, stderr: '', exitCode: 0 };
  }
  return { success: true, stdout: `Mock svn ${args.join(' ')}`, stderr: '', exitCode: 0 };
}

export async function svnCheckout(url: string, targetPath: string): Promise<SvnResult> {
  return runSvn(['checkout', url, targetPath]);
}

export async function svnUpdate(wcPath: string, revision?: string): Promise<SvnResult> {
  const args = revision ? ['update', '-r', revision] : ['update'];
  return runSvn(args, wcPath);
}

export async function svnAdd(wcPath: string, relativePath: string): Promise<SvnResult> {
  return runSvn(['add', '--parents', relativePath], wcPath);
}

export async function svnAddUnversioned(wcPath: string): Promise<SvnResult> {
  return runSvn(['add', '--force', '.'], wcPath);
}

export async function svnCommit(
  wcPath: string,
  message: string,
  relativePaths?: string | string[],
): Promise<SvnResult> {
  const paths = relativePaths === undefined
    ? []
    : Array.isArray(relativePaths)
      ? relativePaths
      : [relativePaths];
  const args = paths.length > 0
    ? ['commit', '-m', message, ...paths]
    : ['commit', '-m', message];
  return runSvn(args, wcPath);
}

export async function svnStatus(wcPath: string, relativePath?: string): Promise<SvnResult> {
  const args = relativePath ? ['status', relativePath] : ['status'];
  return runSvn(args, wcPath);
}

export async function svnStatusQuiet(wcPath: string, relativePath?: string): Promise<SvnResult> {
  const args = relativePath ? ['status', '--quiet', relativePath] : ['status', '--quiet'];
  return runSvn(args, wcPath);
}

export async function svnDiff(wcPath: string, path?: string): Promise<SvnResult> {
  const args = path ? ['diff', path] : ['diff'];
  return runSvn(args, wcPath);
}

export async function svnLog(wcPath: string, limit = 20): Promise<SvnResult> {
  const result = await runSvn(['log', '-l', String(limit), '--xml'], wcPath);
  if (!result.success) return result;
  return { ...result, stdout: formatSvnLogXml(result.stdout) };
}

function formatSvnLogXml(xml: string): string {
  const entries: string[] = [];
  const entryRegex = /<logentry\s+revision="(\d+)">([\s\S]*?)<\/logentry>/g;
  let match: RegExpExecArray | null;
  while ((match = entryRegex.exec(xml)) !== null) {
    const revision = match[1];
    const block = match[2];
    const author = block.match(/<author>([\s\S]*?)<\/author>/)?.[1]?.trim() || '(no author)';
    const dateRaw = block.match(/<date>([\s\S]*?)<\/date>/)?.[1]?.trim() ?? '';
    const message = block.match(/<msg>([\s\S]*?)<\/msg>/)?.[1]?.trim() ?? '';
    const date = dateRaw ? new Date(dateRaw).toLocaleString() : '';
    entries.push(
      [
        '------------------------------------------------------------------------',
        `r${revision} | ${author} | ${date}`,
        '------------------------------------------------------------------------',
        message,
        '',
      ].join('\n'),
    );
  }
  return entries.join('\n') || 'No log entries.';
}

export async function svnRevert(wcPath: string, path?: string): Promise<SvnResult> {
  const args = path ? ['revert', path] : ['revert', '-R', '.'];
  return runSvn(args, wcPath);
}

export async function svnLock(wcPath: string, path: string, message?: string): Promise<SvnResult> {
  const args = message ? ['lock', '-m', message, path] : ['lock', path];
  return runSvn(args, wcPath);
}

export async function svnUnlock(wcPath: string, path: string): Promise<SvnResult> {
  return runSvn(['unlock', path], wcPath);
}

export async function svnInfo(wcPath: string): Promise<SvnResult> {
  return runSvn(['info'], wcPath);
}

export async function svnDelete(wcPath: string, relativePath: string): Promise<SvnResult> {
  return runSvn(['delete', '--force', relativePath], wcPath);
}

export async function svnMove(
  wcPath: string,
  fromPath: string,
  toPath: string,
): Promise<SvnResult> {
  return runSvn(['move', fromPath, toPath], wcPath);
}

export async function svnCleanup(wcPath: string): Promise<SvnResult> {
  return runSvn(['cleanup'], wcPath);
}

export async function svnBlame(wcPath: string, relativePath?: string): Promise<SvnResult> {
  const args = relativePath ? ['blame', relativePath] : ['blame'];
  return runSvn(args, wcPath);
}

export async function svnResolve(
  wcPath: string,
  relativePath: string,
  accept: 'working' | 'mine-full' | 'theirs-full' | 'base',
): Promise<SvnResult> {
  return runSvn(['resolve', '--accept', accept, relativePath], wcPath);
}

export async function svnPropList(wcPath: string, relativePath?: string): Promise<SvnResult> {
  const args = relativePath ? ['proplist', relativePath] : ['proplist'];
  return runSvn(args, wcPath);
}

export async function svnPropGet(
  wcPath: string,
  propName: string,
  relativePath?: string,
): Promise<SvnResult> {
  const args = relativePath
    ? ['propget', propName, relativePath]
    : ['propget', propName];
  return runSvn(args, wcPath);
}

export async function svnPropSet(
  wcPath: string,
  propName: string,
  value: string,
  relativePath?: string,
): Promise<SvnResult> {
  const target = relativePath?.trim() || '.';
  return runSvn(['propset', propName, value, target], wcPath);
}

export async function svnList(url: string, relativePath?: string): Promise<SvnResult> {
  const target = relativePath ? `${url.replace(/\/$/, '')}/${relativePath}` : url;
  return runSvn(['list', target]);
}

export async function svnExport(url: string, targetPath: string, revision?: string): Promise<SvnResult> {
  const args = revision
    ? ['export', '-r', revision, url, targetPath]
    : ['export', url, targetPath];
  return runSvn(args);
}

export async function svnImport(
  localPath: string,
  url: string,
  message: string,
): Promise<SvnResult> {
  return runSvn(['import', '-m', message, localPath, url]);
}

export async function svnSwitch(wcPath: string, url: string): Promise<SvnResult> {
  return runSvn(['switch', url], wcPath);
}

export async function svnRelocate(wcPath: string, fromUrl: string, toUrl: string): Promise<SvnResult> {
  return runSvn(['switch', '--relocate', fromUrl, toUrl], wcPath);
}

export async function svnCopy(
  sourceUrl: string,
  destUrl: string,
  message: string,
): Promise<SvnResult> {
  return runSvn(['copy', '-m', message, '--parents', sourceUrl, destUrl]);
}

export async function svnMerge(wcPath: string, sourceUrl: string): Promise<SvnResult> {
  return runSvn(['merge', sourceUrl], wcPath);
}

export async function svnApplyPatch(wcPath: string, patchFile: string): Promise<SvnResult> {
  return runSvn(['patch', patchFile], wcPath);
}

export function parseRevisionFromUpdate(stdout: string): number | null {
  const m = stdout.match(/revision\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

export function parseRevisionFromCommit(stdout: string): number | null {
  const m = stdout.match(/revision\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

export function parseUrlFromInfo(stdout: string): string | null {
  const m = stdout.match(/^URL:\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

export function parseRevisionFromInfo(stdout: string): number | null {
  const m = stdout.match(/^Revision:\s*(\d+)$/m);
  return m ? Number(m[1]) : null;
}
