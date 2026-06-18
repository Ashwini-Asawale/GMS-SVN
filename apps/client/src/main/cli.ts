import { clipboard, dialog } from 'electron';
import path from 'node:path';
import { loadAuth } from './auth-store.js';
import { promptTextInput, promptPasswordInput } from './prompt.js';
import {
  formatRepoContext,
  getWorkingCopyContextForPath,
  runShellAction,
  type ShellAction,
} from './svn-service.js';
import { ensureSvnCredentials, applySvnCredentialsFromCli, getSvnCredentials, svnCredentialsMissingMessage } from './svn-credentials.js';
import { resolveWorkingCopyRoot, workingCopyNotFoundMessage } from './wc-resolver.js';
import { isMockMode } from './svn-runner.js';

export interface CliArgs {
  action: ShellAction | 'open' | 'checkout' | 'help';
  targetPath?: string;
  message?: string;
  url?: string;
  revision?: string;
  destPath?: string;
  svnUsername?: string;
  svnPassword?: string;
  quiet: boolean;
}

const SHELL_ACTIONS = new Set<ShellAction>([
  'update',
  'update-revision',
  'commit',
  'diff',
  'revert',
  'log',
  'lock',
  'unlock',
  'add',
  'delete',
  'cleanup',
  'blame',
  'resolve',
  'status',
  'repobrowser',
  'export',
  'switch',
  'relocate',
  'branchtag',
  'merge',
  'properties',
  'copyurl',
  'createpatch',
  'applypatch',
  'rename',
]);

const WC_OPTIONAL = new Set<ShellAction>(['update']);

const SVN_WRITE_ACTIONS = new Set<ShellAction>([
  'commit',
  'delete',
  'lock',
  'unlock',
  'branchtag',
  'merge',
  'switch',
  'relocate',
]);

export function parseCliArgs(argv: string[]): CliArgs | null {
  const dashDash = argv.indexOf('--');
  const args = dashDash >= 0 ? argv.slice(dashDash + 1) : argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { action: 'help', quiet: false };
  }

  let action: CliArgs['action'] = 'help';
  let targetPath: string | undefined;
  let message: string | undefined;
  let url: string | undefined;
  let revision: string | undefined;
  let destPath: string | undefined;
  let svnUsername: string | undefined;
  let svnPassword: string | undefined;
  let quiet = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--action' || arg === '-a') {
      action = args[++i] as CliArgs['action'];
    } else if (arg === '--path' || arg === '-p') {
      targetPath = args[++i];
    } else if (arg === '--message' || arg === '-m') {
      message = args[++i];
    } else if (arg === '--url' || arg === '-u') {
      url = args[++i];
    } else if (arg === '--revision' || arg === '-r') {
      revision = args[++i];
    } else if (arg === '--dest-path' || arg === '--dest') {
      destPath = args[++i];
    } else if (arg === '--quiet' || arg === '-q') {
      quiet = true;
    } else if (arg === '--svn-username') {
      svnUsername = args[++i];
    } else if (arg === '--svn-password') {
      svnPassword = args[++i];
    }
  }

  if (action === 'help') return { action: 'help', quiet };
  if (!targetPath && action !== 'open') return { action: 'help', quiet };

  return { action, targetPath, message, url, revision, destPath, svnUsername, svnPassword, quiet };
}

export function isCliInvocation(argv: string[]): boolean {
  const parsed = parseCliArgs(argv);
  if (!parsed) return false;
  if (parsed.action === 'open' || parsed.action === 'checkout' || parsed.action === 'repobrowser') {
    return false;
  }
  if (parsed.action === 'help') return argv.includes('--action') || argv.includes('-a');
  return true;
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`GMS SVN CLIENT — headless CLI (Explorer / shell integration)

Usage:
  "GMS SVN CLIENT.exe" -- --action <action> --path "<path>" [options]

Actions:
  checkout, update, update-revision, commit, add, diff, revert, log, status,
  repobrowser, blame, delete, cleanup, resolve, lock, unlock, export, switch,
  relocate, branchtag, merge, properties, copyurl, createpatch, applypatch, rename, open

Options:
  --message, --url, --revision, --dest-path, --quiet
`);
}

async function promptWithRepo(
  title: string,
  message: string,
  repoContext?: string,
): Promise<string | null> {
  const body = repoContext ? `${repoContext}\n\n${message}` : message;
  return promptTextInput(title, body);
}

async function promptCommitMessage(repoContext?: string): Promise<string | null> {
  return promptWithRepo('GMS SVN Commit', 'Enter commit message:', repoContext);
}

async function showResult(
  title: string,
  success: boolean,
  detail: string,
  quiet: boolean,
  repoContext?: string,
): Promise<void> {
  if (quiet && !repoContext) return;
  const body = repoContext ? `${repoContext}\n\n${detail}` : detail;
  await dialog.showMessageBox({
    type: success ? 'info' : 'error',
    title,
    message: success ? 'Completed successfully' : 'Operation failed',
    detail: body,
  });
}

function isLoginRequiredMessage(detail: string): boolean {
  const lower = detail.toLowerCase();
  return (
    lower.includes('not logged in') ||
    lower.includes("can't get username or password") ||
    lower.includes('e170001') ||
    lower.includes('svn credentials missing') ||
    lower.includes('authentication failed')
  );
}

async function collectExplorerInputs(
  parsed: CliArgs,
  repoContext?: string,
): Promise<CliArgs | null> {
  const action = parsed.action as ShellAction;

  if (action === 'commit' && !parsed.message) {
    parsed.message = (await promptCommitMessage(repoContext)) ?? undefined;
    if (!parsed.message) return null;
  }

  if (action === 'update-revision' && !parsed.revision) {
    parsed.revision =
      (await promptWithRepo('SVN Update to Revision', 'Enter revision number:', repoContext)) ?? undefined;
    if (!parsed.revision) return null;
  }

  if (action === 'switch' && !parsed.url) {
    parsed.url = (await promptWithRepo('SVN Switch', 'Enter branch/tag URL:', repoContext)) ?? undefined;
    if (!parsed.url) return null;
  }

  if (action === 'merge' && !parsed.url) {
    parsed.url = (await promptWithRepo('SVN Merge', 'Enter merge source URL:', repoContext)) ?? undefined;
    if (!parsed.url) return null;
  }

  if (action === 'branchtag') {
    if (!parsed.url) {
      parsed.url =
        (await promptWithRepo('Branch/Tag', 'Enter destination URL:', repoContext)) ?? undefined;
    }
    if (!parsed.message) {
      parsed.message =
        (await promptWithRepo('Branch/Tag', 'Enter log message:', repoContext)) ?? undefined;
    }
    if (!parsed.url || !parsed.message) return null;
  }

  if (action === 'relocate') {
    if (!parsed.url) {
      parsed.url = (await promptWithRepo('SVN Relocate', 'From URL:', repoContext)) ?? undefined;
    }
    if (!parsed.destPath) {
      parsed.destPath = (await promptWithRepo('SVN Relocate', 'To URL:', repoContext)) ?? undefined;
    }
    if (!parsed.url || !parsed.destPath) return null;
  }

  if (action === 'rename' && !parsed.destPath) {
    parsed.destPath =
      (await promptWithRepo('SVN Rename', 'New relative path/name:', repoContext)) ?? undefined;
    if (!parsed.destPath) return null;
  }

  if (action === 'export' && !parsed.destPath) {
    const picked = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    parsed.destPath = picked.canceled ? undefined : picked.filePaths[0];
    if (!parsed.destPath) return null;
  }

  if (action === 'createpatch' && !parsed.destPath) {
    const picked = await dialog.showSaveDialog({ filters: [{ name: 'Patch', extensions: ['patch', 'diff'] }] });
    parsed.destPath = picked.canceled ? undefined : picked.filePath ?? undefined;
    if (!parsed.destPath) return null;
  }

  if (action === 'applypatch' && !parsed.destPath) {
    const picked = await dialog.showOpenDialog({ filters: [{ name: 'Patch', extensions: ['patch', 'diff'] }] });
    parsed.destPath = picked.canceled ? undefined : picked.filePaths[0];
    if (!parsed.destPath) return null;
  }

  return parsed;
}

export async function runCli(argv: string[]): Promise<CliRunResult> {
  const parsed = parseCliArgs(argv);
  if (!parsed || parsed.action === 'help') {
    printHelp();
    return { exitCode: parsed?.action === 'help' && !argv.includes('--action') ? 0 : 1 };
  }

  if (parsed.action === 'open' || parsed.action === 'checkout' || parsed.action === 'repobrowser') {
    return { exitCode: 0 };
  }

  if (!SHELL_ACTIONS.has(parsed.action as ShellAction)) {
    printHelp();
    return { exitCode: 1 };
  }

  const action = parsed.action as ShellAction;

  if (!parsed.targetPath) {
    printHelp();
    return { exitCode: 1 };
  }

  const targetPath = path.resolve(parsed.targetPath);
  if (!WC_OPTIONAL.has(action) && !resolveWorkingCopyRoot(targetPath)) {
    await showResult(
      'GMS SVN',
      false,
      workingCopyNotFoundMessage({ mockMode: isMockMode() }),
      parsed.quiet,
    );
    return { exitCode: 1 };
  }

  if (!loadAuth()) {
    return { exitCode: 0, openSignIn: cliLaunchTarget(argv) ?? { fromExplorer: true, explorerAction: action } };
  }

  const wcContext = await getWorkingCopyContextForPath(targetPath);
  const repoContext = wcContext ? formatRepoContext(wcContext) : undefined;

  const withInputs = await collectExplorerInputs(parsed, repoContext);
  if (!withInputs) return { exitCode: 1 };

  if (SVN_WRITE_ACTIONS.has(action)) {
    if (parsed.svnPassword) {
      applySvnCredentialsFromCli(parsed.svnUsername, parsed.svnPassword);
    }

    let creds = getSvnCredentials() ?? null;
    if (!creds) {
      creds = await ensureSvnCredentials((username) =>
        promptPasswordInput(
          'GMS SVN credentials',
          `Enter SVN password for ${username}:\n(Same password as GMS SVN CLIENT sign-in)`,
        ),
      );
    }
    if (!creds) {
      const auth = loadAuth();
      await showResult(
        `GMS SVN ${action}`,
        false,
        svnCredentialsMissingMessage(auth?.username),
        parsed.quiet,
        repoContext,
      );
      return {
        exitCode: 0,
        openSignIn: cliLaunchTarget(argv) ?? { fromExplorer: true, explorerAction: action },
      };
    }
  }

  const result = await runShellAction({
    action,
    targetPath,
    message: withInputs.message,
    url: withInputs.url,
    revision: withInputs.revision,
    destPath: withInputs.destPath,
  });

  if (action === 'copyurl' && result.success && result.stdout) {
    clipboard.writeText(result.stdout.trim());
  }

  const detail = result.success
    ? action === 'copyurl'
      ? `URL copied to clipboard:\n${result.stdout.trim()}`
      : result.stdout.trim() || 'Done.'
    : result.stderr.trim() || result.stdout.trim() || 'Unknown error';

  if (!result.success && isLoginRequiredMessage(detail)) {
    return {
      exitCode: 0,
      openSignIn: cliLaunchTarget(argv) ?? { fromExplorer: true, explorerAction: action },
    };
  }

  await showResult(`GMS SVN ${action}`, result.success, detail, parsed.quiet, repoContext);
  return { exitCode: result.success ? 0 : 1 };
}

export interface CliLaunch {
  wcPath?: string;
  checkoutPath?: string;
  fromExplorer?: boolean;
  explorerAction?: string;
}

export function cliLaunchTarget(argv: string[]): CliLaunch | undefined {
  const parsed = parseCliArgs(argv);
  if (!parsed?.targetPath) return undefined;

  const resolved = path.resolve(parsed.targetPath);
  if (parsed.action === 'open') return { wcPath: resolved };
  if (parsed.action === 'checkout') {
    return { checkoutPath: resolved, fromExplorer: true, explorerAction: 'checkout' };
  }
  return {
    wcPath: resolveWorkingCopyRoot(resolved) ?? undefined,
    checkoutPath: !resolveWorkingCopyRoot(resolved) ? resolved : undefined,
    fromExplorer: true,
    explorerAction: parsed.action,
  };
}

export type CliRunResult = { exitCode: number; openSignIn?: CliLaunch };
