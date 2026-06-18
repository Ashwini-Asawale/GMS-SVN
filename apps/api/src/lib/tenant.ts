import type { FastifyRequest } from 'fastify';
import { prisma } from './prisma.js';

export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_TENANT_SLUG = 'default';

export function tenantIdFromRequest(request: FastifyRequest): string {
  const tenantId = request.user?.tenantId;
  if (!tenantId) throw new Error('Missing tenant context');
  return tenantId;
}

export async function findTenantBySlug(slug: string) {
  return prisma.tenant.findFirst({
    where: {
      slug: slug.trim().toLowerCase(),
      isActive: true,
    },
  });
}

export async function ensureDefaultTenant() {
  return prisma.tenant.upsert({
    where: { slug: DEFAULT_TENANT_SLUG },
    create: {
      id: DEFAULT_TENANT_ID,
      slug: DEFAULT_TENANT_SLUG,
      name: 'Default Organization',
    },
    update: {},
  });
}
