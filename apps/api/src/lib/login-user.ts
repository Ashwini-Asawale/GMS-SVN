import type { User } from '@prisma/client';
import { prisma } from './prisma.js';

export async function findUserByLoginIdentifier(
  email?: string,
  username?: string,
): Promise<User | null> {
  const identifier = email?.trim() || username?.trim();
  if (!identifier) return null;

  if (identifier.includes('@')) {
    return prisma.user.findFirst({
      where: { email: { equals: identifier, mode: 'insensitive' } },
    });
  }

  return prisma.user.findUnique({ where: { username: identifier } });
}
