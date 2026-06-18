import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let electronDir;
try {
  electronDir = path.dirname(require.resolve('electron/package.json', { paths: [repoRoot] }));
} catch {
  process.exit(0);
}

const pathTxt = path.join(electronDir, 'path.txt');
const exe = path.join(electronDir, 'dist', 'electron.exe');

if (fs.existsSync(pathTxt) && fs.existsSync(exe)) {
  process.exit(0);
}

console.log('Ensuring Electron binary is installed...');
const installScript = path.join(electronDir, 'install.js');
const result = spawnSync(process.execPath, [installScript], {
  cwd: electronDir,
  stdio: 'inherit',
});

if (result.status !== 0 && !fs.existsSync(exe)) {
  process.exit(result.status ?? 1);
}

if (!fs.existsSync(pathTxt) && fs.existsSync(exe)) {
  fs.writeFileSync(pathTxt, 'electron.exe', 'utf8');
}

if (!fs.existsSync(path.join(electronDir, 'dist', 'version'))) {
  const { version } = require(path.join(electronDir, 'package.json'));
  fs.writeFileSync(path.join(electronDir, 'dist', 'version'), version.replace(/^v/, ''));
}

console.log('Electron ready:', exe);
