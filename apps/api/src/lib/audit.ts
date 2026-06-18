import type { AuditAction } from '@gms-svn/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

interface AuditParams {
  action: AuditAction;
  userId?: string;
  repositoryId?: string;
  metadata?: Record<string, unknown>;
  sourceIp?: string;
  sourceMachine?: string;
}

export async function writeAuditLog(params: AuditParams) {
  return prisma.auditLog.create({
    data: {
      action: params.action,
      userId: params.userId,
      repositoryId: params.repositoryId,
      metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      sourceIp: params.sourceIp,
      sourceMachine: params.sourceMachine,
    },
  });
}

export function getClientIp(headers: Record<string, string | string[] | undefined>): string | undefined {
  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  return undefined;
}
