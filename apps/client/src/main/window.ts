import { BrowserWindow } from 'electron';

import fs from 'node:fs';

import path from 'node:path';

import { fileURLToPath, pathToFileURL } from 'node:url';

import type { CliLaunch } from './cli.js';



const __dirname = path.dirname(fileURLToPath(import.meta.url));



function resolvePreloadPath(): string {

  const preloadDir = path.join(__dirname, '../preload');

  const candidates = ['index.mjs', 'index.js', 'index.cjs'];

  for (const name of candidates) {

    const candidate = path.join(preloadDir, name);

    if (fs.existsSync(candidate)) return candidate;

  }

  return path.join(preloadDir, 'index.mjs');

}



export function buildRendererUrl(launch?: CliLaunch): string {

  const params = new URLSearchParams();

  if (launch?.wcPath) params.set('wcPath', launch.wcPath);

  if (launch?.checkoutPath) params.set('checkoutPath', launch.checkoutPath);

  if (launch?.fromExplorer) params.set('fromExplorer', '1');

  if (launch?.explorerAction) params.set('explorerAction', launch.explorerAction);

  const search = params.toString();

  const hash = search ? `#/?${search}` : '#/';



  if (process.env.ELECTRON_RENDERER_URL) {

    const url = new URL(process.env.ELECTRON_RENDERER_URL);

    url.hash = hash;

    return url.toString();

  }



  const indexPath = path.join(__dirname, '../renderer/index.html');

  return `${pathToFileURL(indexPath).href}${hash}`;

}



export function createMainWindow(launch?: CliLaunch): BrowserWindow {

  const win = new BrowserWindow({

    width: 1100,

    height: 720,

    title: 'GMS SVN CLIENT',

    show: false,

    webPreferences: {

      preload: resolvePreloadPath(),

      contextIsolation: true,

      nodeIntegration: false,

      sandbox: false,

    },

  });



  win.once('ready-to-show', () => win.show());



  win.webContents.on('did-fail-load', (_event, code, description, url) => {

    // eslint-disable-next-line no-console

    console.error('[renderer] did-fail-load', { code, description, url });

  });



  void win.loadURL(buildRendererUrl(launch));



  return win;

}



export function navigateMainWindow(win: BrowserWindow, launch?: CliLaunch): void {

  void win.loadURL(buildRendererUrl(launch));

}


