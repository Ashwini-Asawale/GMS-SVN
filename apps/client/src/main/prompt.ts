import { BrowserWindow, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';

export function promptTextInput(title: string, message: string): Promise<string | null> {
  return promptInput(title, message, false);
}

export function promptPasswordInput(title: string, message: string): Promise<string | null> {
  return promptInput(title, message, true);
}

function promptInput(title: string, message: string, secret: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const channel = `gms-prompt-${randomUUID()}`;
    const win = new BrowserWindow({
      width: 480,
      height: 220,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    const finish = (value: string | null) => {
      ipcMain.removeAllListeners(channel);
      resolve(value);
      if (!win.isDestroyed()) win.close();
    };

    ipcMain.on(channel, (_event, value: string | null) => finish(value));
    win.on('closed', () => finish(null));

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: Segoe UI, sans-serif; margin: 16px; }
  label { display: block; margin-bottom: 8px; }
  input { width: 100%; box-sizing: border-box; padding: 8px; }
  .actions { margin-top: 16px; text-align: right; }
  button { margin-left: 8px; padding: 6px 14px; }
</style></head>
<body>
  <label>${message}</label>
  <input id="msg" type="${secret ? 'password' : 'text'}" autofocus />
  <div class="actions">
    <button id="cancel">Cancel</button>
    <button id="ok">OK</button>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    const channel = ${JSON.stringify(channel)};
    const input = document.getElementById('msg');
    document.getElementById('ok').onclick = () => {
      const value = input.value.trim();
      if (!value) return;
      ipcRenderer.send(channel, value);
    };
    document.getElementById('cancel').onclick = () => ipcRenderer.send(channel, null);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('ok').click();
      if (e.key === 'Escape') document.getElementById('cancel').click();
    });
  </script>
</body></html>`;

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });
}
