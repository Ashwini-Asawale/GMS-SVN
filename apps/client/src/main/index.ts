import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';

import { clearAuth, loadAuth, saveAuth } from './auth-store.js';

import { refreshAccessToken } from './api-client.js';
import { getApiBaseUrl, setApiBaseUrl } from './settings-store.js';

import { enqueueAudit } from './audit-queue.js';

import { cliLaunchTarget, isCliInvocation, parseCliArgs, runCli } from './cli.js';
import { ensureExplorerShellIntegration } from './shell-registration.js';

import {

  flushAuditQueue,

  runSvnAddById,

  runSvnBlameById,

  runSvnCleanupById,

  runSvnCommitById,

  runSvnCopyById,

  runSvnDeleteById,

  runSvnDiffById,

  runSvnExportById,

  runSvnImport,

  runSvnListById,

  runSvnLockById,

  runSvnLogById,

  runSvnMergeById,

  runSvnMoveById,

  runSvnPropGetById,

  runSvnPropListById,

  runSvnPropSetById,

  runSvnRelocateById,

  runSvnResolveById,

  runSvnRevertById,

  runSvnCheckout,

  runSvnStatusById,

  runSvnSwitchById,

  runSvnUnlockById,

  runSvnUpdateById,

} from './svn-service.js';

import { listWorkingCopies, removeWorkingCopy } from './working-copy-store.js';

import { getHostname, getSvnExePath, isBundledSvn, isMockMode, isSvnAvailable } from './svn-runner.js';

import { createMainWindow, navigateMainWindow } from './window.js';



const isHeadlessCli = isCliInvocation(process.argv);



if (isHeadlessCli) {

  app.disableHardwareAcceleration();

}



let mainWindow: BrowserWindow | null = null;



function focusOrOpenWindow(launch?: ReturnType<typeof cliLaunchTarget>): void {

  if (mainWindow && !mainWindow.isDestroyed()) {

    if (launch) navigateMainWindow(mainWindow, launch);

    if (mainWindow.isMinimized()) mainWindow.restore();

    mainWindow.focus();

    return;

  }

  mainWindow = createMainWindow(launch);

  mainWindow.on('closed', () => {

    mainWindow = null;

  });

}



async function handleSecondInstance(argv: string[]): Promise<void> {

  const parsed = parseCliArgs(argv);



  if (isCliInvocation(argv) && parsed?.action !== 'open' && parsed?.action !== 'checkout') {

    const result = await runCli(argv);

    if (result.openSignIn) {

      clearAuth();

      focusOrOpenWindow(result.openSignIn);

      return;

    }

    if (result.exitCode !== 0) app.exit(result.exitCode);

    return;

  }



  focusOrOpenWindow(cliLaunchTarget(argv));

}



function registerIpc(): void {

  ipcMain.handle('auth:load', () => loadAuth());

  ipcMain.handle('auth:save', (_e, auth) => {

    saveAuth(auth);

    return true;

  });

  ipcMain.handle('auth:clear', () => {

    clearAuth();

    return true;

  });



  ipcMain.handle('auth:refresh', async (_e, refreshToken: string) => refreshAccessToken(refreshToken));

  ipcMain.handle('settings:getApiBaseUrl', () => getApiBaseUrl());
  ipcMain.handle('settings:setApiBaseUrl', (_e, url: string) => setApiBaseUrl(url));



  ipcMain.handle('system:hostname', () => getHostname());

  ipcMain.handle('svn:exePath', () => getSvnExePath());
  ipcMain.handle('svn:isBundled', () => isBundledSvn());
  ipcMain.handle('svn:isAvailable', () => isSvnAvailable());
  ipcMain.handle('svn:isMockMode', () => isMockMode());



  ipcMain.handle('dialog:selectFolder', async () => {

    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });

    return result.canceled ? null : result.filePaths[0] ?? null;

  });



  ipcMain.handle('wc:list', () => listWorkingCopies());

  ipcMain.handle('wc:remove', (_e, id: string) => removeWorkingCopy(id));



  ipcMain.handle(

    'svn:checkout',

    async (

      _e,

      input: { url: string; localPath: string; repositoryName: string; accessToken: string },

    ) => runSvnCheckout(input),

  );



  ipcMain.handle('svn:update', async (_e, input: { id: string; accessToken: string }) =>

    runSvnUpdateById(input.id, input.accessToken),

  );



  ipcMain.handle('svn:commit', async (_e, input: { id: string; message: string; accessToken: string; paths?: string[] }) =>

    runSvnCommitById(input.id, input.message, input.accessToken, 'client', input.paths),

  );

  ipcMain.handle('svn:status', async (_e, input: { id: string }) => runSvnStatusById(input.id));

  ipcMain.handle('svn:add', async (_e, input: { id: string; path: string; accessToken: string }) =>
    runSvnAddById(input.id, input.path, input.accessToken),
  );

  ipcMain.handle('svn:delete', async (_e, input: { id: string; path: string; accessToken: string }) =>
    runSvnDeleteById(input.id, input.path, input.accessToken),
  );

  ipcMain.handle('svn:move', async (_e, input: { id: string; from: string; to: string; accessToken: string }) =>
    runSvnMoveById(input.id, input.from, input.to, input.accessToken),
  );

  ipcMain.handle('svn:cleanup', async (_e, input: { id: string; accessToken: string }) =>
    runSvnCleanupById(input.id, input.accessToken),
  );

  ipcMain.handle('svn:blame', async (_e, input: { id: string; accessToken: string; path?: string }) =>
    runSvnBlameById(input.id, input.accessToken, input.path),
  );

  ipcMain.handle(
    'svn:resolve',
    async (_e, input: { id: string; path: string; accept: 'working' | 'mine-full' | 'theirs-full' | 'base'; accessToken: string }) =>
      runSvnResolveById(input.id, input.path, input.accept, input.accessToken),
  );

  ipcMain.handle('svn:proplist', async (_e, input: { id: string; accessToken: string; path?: string }) =>
    runSvnPropListById(input.id, input.accessToken, input.path),
  );

  ipcMain.handle('svn:propget', async (_e, input: { id: string; propName: string; accessToken: string; path?: string }) =>
    runSvnPropGetById(input.id, input.propName, input.accessToken, input.path),
  );

  ipcMain.handle(
    'svn:propset',
    async (_e, input: { id: string; propName: string; value: string; accessToken: string; path?: string }) =>
      runSvnPropSetById(input.id, input.propName, input.value, input.accessToken, input.path),
  );

  ipcMain.handle(
    'svn:list',
    async (
      _e,
      input: { id: string; accessToken: string; path?: string; fromRepoRoot?: boolean },
    ) => runSvnListById(input.id, input.accessToken, input.path, { fromRepoRoot: input.fromRepoRoot }),
  );

  ipcMain.handle(
    'svn:export',
    async (_e, input: { id: string; targetPath: string; accessToken: string; path?: string; revision?: string }) =>
      runSvnExportById(input.id, input.targetPath, input.accessToken, input.path, input.revision),
  );

  ipcMain.handle('svn:switch', async (_e, input: { id: string; url: string; accessToken: string }) =>
    runSvnSwitchById(input.id, input.url, input.accessToken),
  );

  ipcMain.handle('svn:relocate', async (_e, input: { id: string; fromUrl: string; toUrl: string; accessToken: string }) =>
    runSvnRelocateById(input.id, input.fromUrl, input.toUrl, input.accessToken),
  );

  ipcMain.handle(
    'svn:copy',
    async (_e, input: { id: string; destUrl: string; message: string; accessToken: string; sourcePath?: string }) =>
      runSvnCopyById(input.id, input.destUrl, input.message, input.accessToken, input.sourcePath),
  );

  ipcMain.handle('svn:merge', async (_e, input: { id: string; sourceUrl: string; accessToken: string }) =>
    runSvnMergeById(input.id, input.sourceUrl, input.accessToken),
  );

  ipcMain.handle('svn:import', async (_e, input: { localPath: string; url: string; message: string; accessToken: string }) =>
    runSvnImport(input.localPath, input.url, input.message, input.accessToken),
  );



  ipcMain.handle('svn:diff', async (_e, input: { id: string; accessToken: string; path?: string }) =>

    runSvnDiffById(input.id, input.accessToken, input.path),

  );



  ipcMain.handle('svn:log', async (_e, input: { id: string; accessToken: string; limit?: number }) =>

    runSvnLogById(input.id, input.accessToken, input.limit),

  );



  ipcMain.handle('svn:revert', async (_e, input: { id: string; accessToken: string; path?: string }) =>

    runSvnRevertById(input.id, input.accessToken, input.path),

  );



  ipcMain.handle(

    'svn:lock',

    async (_e, input: { id: string; path: string; message?: string; accessToken: string }) =>

      runSvnLockById(input.id, input.path, input.accessToken, input.message),

  );



  ipcMain.handle('svn:unlock', async (_e, input: { id: string; path: string; accessToken: string }) =>

    runSvnUnlockById(input.id, input.path, input.accessToken),

  );



  ipcMain.handle('audit:queue', (_e, event) => {

    enqueueAudit(event);

    return true;

  });



  ipcMain.handle('audit:flush', async (_e, accessToken: string) => flushAuditQueue(accessToken));

}



const gotSingleInstanceLock = app.requestSingleInstanceLock();



if (!gotSingleInstanceLock) {

  app.quit();

} else {

  app.on('second-instance', (_event, argv) => {

    void handleSecondInstance(argv);

  });



  app.whenReady().then(async () => {

    Menu.setApplicationMenu(null);

    registerIpc();

    await ensureExplorerShellIntegration();

    const parsed = parseCliArgs(process.argv);



    if (isHeadlessCli && parsed?.action !== 'open' && parsed?.action !== 'checkout') {

      const result = await runCli(process.argv);

      if (result.openSignIn) {

        clearAuth();

        focusOrOpenWindow(result.openSignIn);

        return;

      }

      app.exit(result.exitCode);

      return;

    }



    focusOrOpenWindow(cliLaunchTarget(process.argv));



    app.on('activate', () => {

      if (BrowserWindow.getAllWindows().length === 0) focusOrOpenWindow();

    });

  });



  app.on('window-all-closed', () => {

    if (process.platform !== 'darwin') app.quit();

  });

}


