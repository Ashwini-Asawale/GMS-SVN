import type { Prisma } from '@prisma/client';
import type { AuditAction } from '@gms-svn/shared';
import { prisma } from '../lib/prisma.js';

export interface AuditLogQuery {
  userId?: string;
  action?: AuditAction;
  repositoryId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export interface AuditLogItem {
  id: string;
  action: string;
  userId: string | null;
  username: string | null;
  repositoryId: string | null;
  repositoryName: string | null;
  metadata: Record<string, unknown> | null;
  sourceIp: string | null;
  sourceMachine: string | null;
  createdAt: string;
}

function metadataRepositoryName(metadata: Prisma.JsonValue | null): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const name = (metadata as Record<string, unknown>).repositoryName;
  return typeof name === 'string' ? name : null;
}

function buildWhere(query: AuditLogQuery): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (query.userId) where.userId = query.userId;
  if (query.action) where.action = query.action;
  if (query.repositoryId) where.repositoryId = query.repositoryId;

  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = query.from;
    if (query.to) where.createdAt.lte = query.to;
  }

  return where;
}

export async function queryAuditLogs(query: AuditLogQuery) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 50;
  const skip = (page - 1) * limit;
  const where = buildWhere(query);

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { username: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const repoIds = [...new Set(rows.map((r) => r.repositoryId).filter(Boolean))] as string[];
  const repos =
    repoIds.length > 0
      ? await prisma.repository.findMany({
          where: { id: { in: repoIds } },
          select: { id: true, name: true },
        })
      : [];
  const repoNames = new Map(repos.map((r) => [r.id, r.name]));

  const items: AuditLogItem[] = rows.map((row) => ({
    id: row.id,
    action: row.action,
    userId: row.userId,
    username: row.user?.username ?? null,
    repositoryId: row.repositoryId,
    repositoryName:
      (row.repositoryId ? repoNames.get(row.repositoryId) : null) ??
      metadataRepositoryName(row.metadata),
    metadata: row.metadata as Record<string, unknown> | null,
    sourceIp: row.sourceIp,
    sourceMachine: row.sourceMachine,
    createdAt: row.createdAt.toISOString(),
  }));

  return { items, total, page, limit };
}

export async function fetchAllAuditLogs(query: Omit<AuditLogQuery, 'page' | 'limit'>) {
  const where = buildWhere(query);
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10_000,
    include: { user: { select: { username: true } } },
  });

  const repoIds = [...new Set(rows.map((r) => r.repositoryId).filter(Boolean))] as string[];
  const repos =
    repoIds.length > 0
      ? await prisma.repository.findMany({
          where: { id: { in: repoIds } },
          select: { id: true, name: true },
        })
      : [];
  const repoNames = new Map(repos.map((r) => [r.id, r.name]));

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    userId: row.userId,
    username: row.user?.username ?? null,
    repositoryId: row.repositoryId,
    repositoryName:
      (row.repositoryId ? repoNames.get(row.repositoryId) : null) ??
      metadataRepositoryName(row.metadata),
    metadata: row.metadata as Record<string, unknown> | null,
    sourceIp: row.sourceIp,
    sourceMachine: row.sourceMachine,
    createdAt: row.createdAt.toISOString(),
  }));
}
