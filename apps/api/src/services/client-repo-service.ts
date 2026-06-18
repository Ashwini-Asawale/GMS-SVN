import { prisma } from '../lib/prisma.js';
import { getPlatformSettings } from '../lib/platform-settings.js';
import { browseRepository, serializeRepository } from './repository-service.js';
import { svnDirectAvailable, svnDirectListPath } from '../lib/svn-direct.js';
import type { AppConfig } from '../config.js';

export interface ClientCheckoutPath {
  label: string;
  path: string;
  url: string;
  folderName: string;
}

function withLiveSvnUrl<T extends { name: string; status: string; svnUrl: string | null }>(
  repo: T,
  visualsvnUrl: string,
): T & { svnUrl: string | null } {
  if (repo.status !== 'ACTIVE') return repo;
  return {
    ...repo,
    svnUrl: `${visualsvnUrl.replace(/\/$/, '')}/${repo.name}`,
  };
}

export async function getClientVisibleRepos(tenantId: string, userId: string, isAdmin: boolean) {
  const settings = await getPlatformSettings(tenantId);

  if (isAdmin) {
    const repos = await prisma.repository.findMany({
      where: { tenantId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
    return repos.map((r) => withLiveSvnUrl(serializeRepository(r), settings.visualsvnUrl));
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    include: { groupMembers: { include: { group: true } } },
  });
  if (!user) return [];

  const groupNames = user.groupMembers.map((gm) => gm.group.name);

  const rules = await prisma.repoAccessRule.findMany({
    where: {
      access: { not: 'NONE' },
      OR: [
        { principalType: 'USER', principalName: user.username },
        { principalType: 'GROUP', principalName: { in: groupNames } },
      ],
      repository: { tenantId, status: 'ACTIVE' },
    },
    include: { repository: true },
  });

  const byId = new Map<string, ReturnType<typeof serializeRepository>>();
  for (const rule of rules) {
    if (!byId.has(rule.repository.id)) {
      byId.set(
        rule.repository.id,
        withLiveSvnUrl(serializeRepository(rule.repository), settings.visualsvnUrl),
      );
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function getClientVisibleRepoOrThrow(
  tenantId: string,
  userId: string,
  isAdmin: boolean,
  repositoryId: string,
) {
  const repos = await getClientVisibleRepos(tenantId, userId, isAdmin);
  const repo = repos.find((r) => r.id === repositoryId);
  if (!repo?.svnUrl) {
    throw new Error('Repository not found or not accessible');
  }
  return repo;
}

async function listClientRepoPath(
  config: AppConfig,
  tenantId: string,
  userId: string,
  repositoryName: string,
  repositoryId: string,
  repoPath: string,
): Promise<{ name: string; kind: string }[]> {
  const platform = await getPlatformSettings(tenantId);
  const svnSettings = {
    visualsvnUrl: platform.visualsvnUrl,
    visualsvnRepoRoot: platform.visualsvnRepoRoot,
  };
  const normalizedPath = repoPath && repoPath !== '/' ? repoPath : '/';

  if (config.agentMock && svnDirectAvailable(svnSettings)) {
    try {
      const data = await svnDirectListPath(svnSettings, repositoryName, normalizedPath);
      return data.entries;
    } catch {
      return [];
    }
  }

  try {
    const data = await browseRepository(config, tenantId, repositoryId, normalizedPath, userId);
    return (data.entries as { name: string; kind: string }[]) ?? [];
  } catch {
    return [];
  }
}

function buildClientRepoUrl(baseUrl: string, repoPath: string): string {
  const root = baseUrl.replace(/\/+$/, '');
  if (!repoPath || repoPath === '/') return root;
  return `${root}/${repoPath.replace(/^\/+/, '')}`;
}

export async function browseClientRepository(
  config: AppConfig,
  tenantId: string,
  userId: string,
  isAdmin: boolean,
  repositoryId: string,
  path = '/',
): Promise<{
  repositoryName: string;
  path: string;
  url: string;
  entries: { name: string; kind: 'dir' | 'file' }[];
}> {
  const repo = await getClientVisibleRepoOrThrow(tenantId, userId, isAdmin, repositoryId);
  const repoPath = path && path !== '' ? (path.startsWith('/') ? path : `/${path}`) : '/';
  const entries = await listClientRepoPath(config, tenantId, userId, repo.name, repositoryId, repoPath);

  return {
    repositoryName: repo.name,
    path: repoPath,
    url: buildClientRepoUrl(repo.svnUrl!, repoPath),
    entries: entries.map((entry) => ({
      name: entry.name,
      kind: entry.kind === 'dir' ? 'dir' : 'file',
    })),
  };
}

export async function listClientCheckoutPaths(
  config: AppConfig,
  tenantId: string,
  userId: string,
  isAdmin: boolean,
  repositoryId: string,
): Promise<{ paths: ClientCheckoutPath[] }> {
  const repo = await getClientVisibleRepoOrThrow(tenantId, userId, isAdmin, repositoryId);
  const baseUrl = repo.svnUrl!.replace(/\/+$/, '');
  const paths: ClientCheckoutPath[] = [];

  const addPath = (label: string, repoPath: string, folderName: string) => {
    paths.push({
      label,
      path: repoPath,
      url: buildClientRepoUrl(baseUrl, repoPath),
      folderName,
    });
  };

  addPath('Repository root', '/', repo.name);

  const rootEntries = await listClientRepoPath(config, tenantId, userId, repo.name, repositoryId, '/');
  const rootDirs = rootEntries.filter((e) => e.kind === 'dir').map((e) => e.name);

  if (rootDirs.includes('trunk')) {
    addPath('Trunk', '/trunk', 'trunk');
  }

  if (rootDirs.includes('branches')) {
    const branches = await listClientRepoPath(config, tenantId, userId, repo.name, repositoryId, '/branches');
    for (const entry of branches.filter((e) => e.kind === 'dir')) {
      addPath(`Branch: ${entry.name}`, `/branches/${entry.name}`, entry.name);
    }
  }

  if (rootDirs.includes('tags')) {
    const tags = await listClientRepoPath(config, tenantId, userId, repo.name, repositoryId, '/tags');
    for (const entry of tags.filter((e) => e.kind === 'dir')) {
      addPath(`Tag: ${entry.name}`, `/tags/${entry.name}`, entry.name);
    }
  }

  return { paths };
}
