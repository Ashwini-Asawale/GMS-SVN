import fs from 'node:fs';
import path from 'node:path';

export const DEV_SVN_SEED_CREDENTIALS: Record<string, string> = {
  admin: 'admin123',
  dev1: 'dev123',
  dev2: 'dev123',
};

export function resolveSvnRepoRoot(explicit?: string): string {
  return (
    explicit ??
    process.env.VISUALSVN_REPO_ROOT ??
    process.env.GMS_SVN_REPO_ROOT ??
    'D:\\GMS-SVN\\.dev-svn-repos'
  );
}

export function getSvnAuthPasswdPath(repoRoot: string): string {
  return path.join(repoRoot, 'auth', 'passwd');
}

export function parsePasswdFile(content: string): Map<string, string> {
  const users = new Map<string, string>();
  let inUsers = false;
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '[users]') {
      inUsers = true;
      continue;
    }
    if (trimmed.startsWith('[')) {
      inUsers = false;
      continue;
    }
    if (!inUsers || !trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      users.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
    }
  }
  return users;
}

export function writePasswdFile(repoRoot: string, users: Map<string, string>): void {
  const authDir = path.join(repoRoot, 'auth');
  fs.mkdirSync(authDir, { recursive: true });
  const lines = [
    '### GMS SVN — synced from platform users (svnserve password database)',
    '[users]',
    ...Array.from(users.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([username, password]) => `${username} = ${password}`),
    '',
  ];
  fs.writeFileSync(getSvnAuthPasswdPath(repoRoot), lines.join('\n'), 'utf8');
}

export function upsertSvnPasswdUser(
  repoRoot: string,
  username: string,
  password: string,
): void {
  const file = getSvnAuthPasswdPath(repoRoot);
  const users = fs.existsSync(file) ? parsePasswdFile(fs.readFileSync(file, 'utf8')) : new Map();
  users.set(username, password);
  writePasswdFile(repoRoot, users);
}

export function removeSvnPasswdUser(repoRoot: string, username: string): void {
  const file = getSvnAuthPasswdPath(repoRoot);
  if (!fs.existsSync(file)) return;
  const users = parsePasswdFile(fs.readFileSync(file, 'utf8'));
  if (!users.delete(username)) return;
  writePasswdFile(repoRoot, users);
}

export function syncSeedSvnPasswd(repoRoot?: string): void {
  const root = resolveSvnRepoRoot(repoRoot);
  for (const [username, password] of Object.entries(DEV_SVN_SEED_CREDENTIALS)) {
    upsertSvnPasswdUser(root, username, password);
  }
}
