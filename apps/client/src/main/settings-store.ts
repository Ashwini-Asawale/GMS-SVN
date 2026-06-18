import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const BUILD_DEFAULT = (process.env.VITE_API_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');

function userSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function installConfigPath(): string {
  return path.join(path.dirname(process.execPath), 'gms-svn-client.config.json');
}

export function normalizeApiBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Server URL must start with http:// or https://');
  }
  return trimmed;
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getApiBaseUrl(): string {
  const user = readJsonFile(userSettingsPath());
  if (typeof user?.apiBaseUrl === 'string' && user.apiBaseUrl.trim()) {
    return normalizeApiBaseUrl(user.apiBaseUrl);
  }

  const install = readJsonFile(installConfigPath());
  if (typeof install?.apiBaseUrl === 'string' && install.apiBaseUrl.trim()) {
    return normalizeApiBaseUrl(install.apiBaseUrl);
  }

  return BUILD_DEFAULT;
}

export function setApiBaseUrl(url: string): string {
  const normalized = normalizeApiBaseUrl(url);
  const file = userSettingsPath();
  const existing = readJsonFile(file) ?? {};
  fs.writeFileSync(file, JSON.stringify({ ...existing, apiBaseUrl: normalized }, null, 2), 'utf8');
  return normalized;
}
