import { loadAuth, saveAuth } from './auth-store.js';

export interface SvnCredentials {
  username: string;
  password: string;
}

let sessionCredentials: SvnCredentials | null = null;

export function setSessionSvnCredentials(creds: SvnCredentials | null): void {
  sessionCredentials = creds;
}

export function getSvnCredentials(): SvnCredentials | undefined {
  if (sessionCredentials?.username && sessionCredentials.password) {
    return sessionCredentials;
  }

  const auth = loadAuth();
  if (!auth?.username) return undefined;
  const password = auth.svnPassword?.trim() ?? '';
  if (!password) return undefined;
  return {
    username: auth.username,
    password,
  };
}

export function buildSvnAuthArgs(): string[] {
  const creds = getSvnCredentials();
  if (!creds?.username || !creds.password) return [];
  return [
    '--username',
    creds.username,
    '--password',
    creds.password,
    '--non-interactive',
    '--no-auth-cache',
  ];
}

export function svnCredentialsMissingMessage(username?: string): string {
  if (!username) {
    return 'Not logged in. Open GMS SVN CLIENT and sign in first.';
  }
  return (
    `SVN credentials missing for "${username}".\n\n` +
    'Sign out and sign in again in GMS SVN CLIENT, or enter your SVN password when prompted.'
  );
}

export function hasCompleteSvnCredentials(): boolean {
  return Boolean(getSvnCredentials()?.username && getSvnCredentials()?.password);
}

export function applySvnCredentialsFromCli(
  svnUsername?: string,
  svnPassword?: string,
): SvnCredentials | null {
  const auth = loadAuth();
  const username = svnUsername?.trim() || auth?.username;
  const password = svnPassword?.trim();
  if (!username || !password) return null;

  const creds = { username, password };
  setSessionSvnCredentials(creds);

  if (auth) {
    saveAuth({
      ...auth,
      username,
      svnPassword: password,
    });
  }

  return creds;
}

export async function ensureSvnCredentials(
  promptPassword: (username: string) => Promise<string | null>,
): Promise<SvnCredentials | null> {
  const existing = getSvnCredentials();
  if (existing?.username && existing.password) {
    return existing;
  }

  const auth = loadAuth();
  if (!auth?.username) return null;

  const password = await promptPassword(auth.username);
  if (!password) return null;

  saveAuth({ ...auth, svnPassword: password });
  setSessionSvnCredentials({ username: auth.username, password });
  return { username: auth.username, password };
}
