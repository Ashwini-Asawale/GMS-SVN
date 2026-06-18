import { prisma } from '../lib/prisma.js';
import { getPlatformSettings } from '../lib/platform-settings.js';
import { serializeRepository } from './repository-service.js';

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
