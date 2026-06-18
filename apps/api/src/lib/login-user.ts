import type { User } from '@prisma/client';
import { prisma } from './prisma.js';

export async function findUserByLoginIdentifier(
  tenantId: string,
  email?: string,
  username?: string,
): Promise<User | null> {
  const identifier = email?.trim() || username?.trim();
  if (!identifier) return null;

  if (identifier.includes('@')) {
    return prisma.user.findFirst({
      where: {
        tenantId,
        email: { equals: identifier, mode: 'insensitive' },
      },
    });
  }

  return prisma.user.findFirst({
    where: {
      tenantId,
      username: identifier,
    },
  });
}
