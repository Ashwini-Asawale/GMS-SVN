import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  username: string;
  email?: string;
  svnPassword?: string;
  isAdmin: boolean;
  tenantSlug?: string;
}

function authFilePath(): string {
  return path.join(app.getPath('userData'), 'auth.dat');
}

export function saveAuth(auth: StoredAuth): void {
  const json = JSON.stringify(auth);
  const file = authFilePath();

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(json);
    fs.writeFileSync(file, encrypted);
    return;
  }

  fs.writeFileSync(file, Buffer.from(json, 'utf8'));
}

export function loadAuth(): StoredAuth | null {
  const file = authFilePath();
  if (!fs.existsSync(file)) return null;

  try {
    const raw = fs.readFileSync(file);
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(raw)
      : raw.toString('utf8');
    return JSON.parse(json) as StoredAuth;
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  const file = authFilePath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
