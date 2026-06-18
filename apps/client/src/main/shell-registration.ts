import { dialog } from 'electron';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { isCliInvocation } from './cli.js';

const HANDLER_GUID = '{f4e8b2a1-6c3d-4e5f-9a8b-1c2d3e4f5a6b}';
const HANDLER_NAME = 'GMS SVN CLIENT';

function getInstallDir(): string {
  return path.dirname(process.execPath);
}

function registryHasHandler(): boolean {
  const key = `HKLM\\Software\\Classes\\Directory\\ShellEx\\ContextMenuHandlers\\${HANDLER_NAME}`;
  const result = spawnSync('reg.exe', ['query', key, '/ve'], { encoding: 'utf8' });
  if (result.status !== 0) return false;
  return result.stdout.includes(HANDLER_GUID);
}

function explorerFilesPresent(installDir: string): boolean {
  const explorerDir = path.join(installDir, 'explorer');
  return (
    fs.existsSync(path.join(explorerDir, 'GmsSvn.ShellExtension.dll')) &&
    fs.existsSync(path.join(explorerDir, 'SharpShell.dll')) &&
    fs.existsSync(path.join(explorerDir, 'GmsSvn.ShellBridge.exe'))
  );
}

function runRegisterShellElevated(installDir: string): Promise<boolean> {
  const script = path.join(installDir, 'register-shell.ps1');
  if (!fs.existsSync(script)) return Promise.resolve(false);

  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${script.replace(/'/g, "''")}'`,
      ],
      { windowsHide: true },
    );
    child.on('exit', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

function refreshExplorerInUserSession(installDir: string): void {
  const script = path.join(installDir, 'refresh-explorer.ps1');
  if (!fs.existsSync(script)) return;
  spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
}

export async function ensureExplorerShellIntegration(): Promise<void> {
  if (process.platform !== 'win32' || isHeadlessCli()) return;

  const installDir = getInstallDir();
  if (!explorerFilesPresent(installDir)) return;
  if (registryHasHandler()) return;

  const ok = await runRegisterShellElevated(installDir);
  if (!ok) {
    await dialog.showMessageBox({
      type: 'warning',
      title: 'GMS SVN CLIENT',
      message: 'Explorer menu not enabled yet',
      detail: 'Click Yes on the Administrator prompt, then open this app again.',
    });
    return;
  }

  refreshExplorerInUserSession(installDir);
  await dialog.showMessageBox({
    type: 'info',
    title: 'GMS SVN CLIENT',
    message: 'Explorer menu is ready',
    detail:
      'Right-click any folder → GMS SVN CLIENT → SVN Checkout.\nOn Windows 11, click "Show more options" first.',
  });
}

function isHeadlessCli(): boolean {
  return isCliInvocation(process.argv);
}
