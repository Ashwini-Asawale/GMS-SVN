import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export function userSelect() {
  return {
    id: true,
    username: true,
    email: true,
    isAdmin: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

export type SafeUser = {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};
