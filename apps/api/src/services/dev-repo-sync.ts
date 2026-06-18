import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { getPlatformSettings } from '../lib/platform-settings.js';
import { DEFAULT_TENANT_ID } from '../lib/tenant.js';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isSvnRepository(dirPath: string): boolean {
  return fs.existsSync(path.join(dirPath, 'format'));
}

/**
 * Register SVN repositories found on disk into the platform DB (dev + LAN svnserve).
 */
export async function syncDevRepositoriesFromDisk(options?: {
  tenantId?: string;
  repoRoot?: string;
  svnUrl?: string;
  grantDevelopersAccess?: boolean;
}): Promise<{ synced: number; names: string[] }> {
  const tenantId = options?.tenantId ?? DEFAULT_TENANT_ID;
  const settings = await getPlatformSettings(tenantId);
  const repoRoot = options?.repoRoot ?? settings.visualsvnRepoRoot;
  const svnUrl = (options?.svnUrl ?? settings.visualsvnUrl).replace(/\/+$/, '');
  const grantDevelopersAccess = options?.grantDevelopersAccess ?? true;

  if (!repoRoot || !fs.existsSync(repoRoot)) {
    return { synced: 0, names: [] };
  }

  const names = fs
    .readdirSync(repoRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => isSvnRepository(path.join(repoRoot, name)));

  for (const name of names) {
    const repository = await prisma.repository.upsert({
      where: { tenantId_name: { tenantId, name } },
      create: {
        tenantId,
        name,
        slug: slugify(name),
        status: 'ACTIVE',
        svnUrl: `${svnUrl}/${name}`,
      },
      update: {
        status: 'ACTIVE',
        svnUrl: `${svnUrl}/${name}`,
      },
    });

    if (grantDevelopersAccess) {
      await prisma.repoAccessRule.upsert({
        where: {
          repositoryId_path_principalType_principalName: {
            repositoryId: repository.id,
            path: '/',
            principalType: 'GROUP',
            principalName: 'Developers',
          },
        },
        create: {
          repositoryId: repository.id,
          path: '/',
          principalType: 'GROUP',
          principalName: 'Developers',
          access: 'WRITE',
        },
        update: { access: 'WRITE' },
      });
    }
  }

  return { synced: names.length, names };
}

export async function syncAllTenantsFromDisk() {
  const tenants = await prisma.tenant.findMany({ where: { isActive: true }, select: { id: true } });
  let synced = 0;
  const names: string[] = [];

  for (const tenant of tenants) {
    const result = await syncDevRepositoriesFromDisk({ tenantId: tenant.id });
    synced += result.synced;
    names.push(...result.names);
  }

  return { synced, names: [...new Set(names)] };
}
