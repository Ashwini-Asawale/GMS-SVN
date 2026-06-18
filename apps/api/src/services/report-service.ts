import fs from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { AppConfig } from '../config.js';
import type { AuditAction } from '@gms-svn/shared';
import { getPlatformSettings } from '../lib/platform-settings.js';
import { prisma } from '../lib/prisma.js';
import { fetchAllAuditLogs, type AuditLogItem } from './audit-query-service.js';
import { getRepositoryLog } from './repository-service.js';

export function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

async function resolveReportsDir(tenantId: string): Promise<string> {
  const settings = await getPlatformSettings(tenantId);
  const configured = settings.storageReportsPath?.trim();
  const fallback = path.resolve(process.cwd(), '../../data/reports');
  const candidates = configured ? [configured, fallback] : [fallback];

  for (const dir of candidates) {
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.access(dir);
      return dir;
    } catch {
      // try next
    }
  }

  await fs.mkdir(fallback, { recursive: true });
  return fallback;
}

export async function saveReportFile(tenantId: string, filename: string, content: Buffer | string): Promise<string> {
  const dir = await resolveReportsDir(tenantId);
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fullPath = path.join(dir, safeName);
  await fs.writeFile(fullPath, content);
  return fullPath;
}

export async function generateUsersCsv(tenantId: string): Promise<{ csv: string; filename: string }> {
  const users = await prisma.user.findMany({
    where: { tenantId },
    orderBy: { username: 'asc' },
    include: {
      groupMembers: {
        include: { group: { select: { name: true } } },
      },
    },
  });

  const rows = users.map((u) => [
    u.username,
    u.email,
    u.isAdmin ? 'yes' : 'no',
    u.isActive ? 'yes' : 'no',
    u.groupMembers.map((m) => m.group.name).join('; '),
    u.createdAt.toISOString(),
  ]);

  const csv = toCsv(['Username', 'Email', 'Admin', 'Active', 'Groups', 'Created'], rows);
  const filename = `users-${timestamp()}.csv`;
  await saveReportFile(tenantId, filename, csv);
  return { csv, filename };
}

export async function generateRepositoriesCsv(tenantId: string): Promise<{ csv: string; filename: string }> {
  const repos = await prisma.repository.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });

  const rows = repos.map((r) => [
    r.name,
    r.status,
    r.svnUrl,
    r.latestRevision,
    r.sizeBytes?.toString() ?? '',
    r.updatedAt.toISOString(),
  ]);

  const csv = toCsv(['Name', 'Status', 'SVN URL', 'Latest Revision', 'Size (bytes)', 'Updated'], rows);
  const filename = `repositories-${timestamp()}.csv`;
  await saveReportFile(tenantId, filename, csv);
  return { csv, filename };
}

export async function generateAuditLogCsv(
  tenantId: string,
  filters: {
  userId?: string;
  action?: AuditAction;
  repositoryId?: string;
  from?: Date;
  to?: Date;
}): Promise<{ csv: string; filename: string }> {
  const items = await fetchAllAuditLogs({ tenantId, ...filters });

  const rows = items.map((item) => auditRow(item));
  const csv = toCsv(
    ['Timestamp', 'User', 'Action', 'Repository', 'Source IP', 'Source Machine', 'Details'],
    rows,
  );
  const filename = `audit-log-${timestamp()}.csv`;
  await saveReportFile(tenantId, filename, csv);
  return { csv, filename };
}

function auditRow(item: AuditLogItem): (string | null)[] {
  const details = item.metadata ? JSON.stringify(item.metadata) : '';
  return [
    item.createdAt,
    item.username ?? item.userId ?? '',
    item.action,
    item.repositoryName ?? '',
    item.sourceIp,
    item.sourceMachine,
    details,
  ];
}

export async function generateAccessRulesPdf(
  tenantId: string,
  repositoryId?: string,
): Promise<{ buffer: Buffer; filename: string; savedPath: string }> {
  const repos = repositoryId
    ? await prisma.repository.findMany({ where: { id: repositoryId, tenantId }, orderBy: { name: 'asc' } })
    : await prisma.repository.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });

  if (repos.length === 0) {
    throw new Error('No repositories found');
  }

  const rules = await prisma.repoAccessRule.findMany({
    where: repositoryId
      ? { repositoryId, repository: { tenantId } }
      : { repository: { tenantId } },
    orderBy: [{ repositoryId: 'asc' }, { path: 'asc' }, { principalName: 'asc' }],
    include: { repository: { select: { name: true } } },
  });

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('GMS SVN — Repository Access Rules', { underline: true });
    doc.moveDown();
    doc.fontSize(10).fillColor('#666').text(`Generated ${new Date().toISOString()}`);
    doc.moveDown();

    if (rules.length === 0) {
      doc.fontSize(12).fillColor('#000').text('No access rules configured.');
    }

    let currentRepo = '';
    for (const rule of rules) {
      if (rule.repository.name !== currentRepo) {
        currentRepo = rule.repository.name;
        doc.moveDown();
        doc.fontSize(14).fillColor('#000').text(`Repository: ${currentRepo}`, { underline: true });
        doc.moveDown(0.5);
      }
      doc
        .fontSize(10)
        .text(
          `${rule.path}  |  ${rule.principalType} ${rule.principalName}  |  ${rule.access}`,
        );
    }

    if (repositoryId && rules.length === 0) {
      doc.fontSize(12).text(`Repository: ${repos[0]!.name}`);
      doc.text('No access rules configured for this repository.');
    }

    doc.end();
  });

  const repoSuffix = repositoryId ? repos[0]!.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'all';
  const filename = `access-rules-${repoSuffix}-${timestamp()}.pdf`;
  const savedPath = await saveReportFile(tenantId, filename, buffer);
  return { buffer, filename, savedPath };
}

interface LogEntry {
  revision?: number;
  author?: string;
  date?: string;
  message?: string;
}

export async function generateCommitHistoryCsv(
  config: AppConfig,
  tenantId: string,
  repositoryId: string,
  logPath: string,
  limit: number,
  userId: string,
): Promise<{ csv: string; filename: string }> {
  const repo = await prisma.repository.findFirstOrThrow({ where: { id: repositoryId, tenantId } });
  const data = (await getRepositoryLog(config, tenantId, repositoryId, logPath, limit, userId)) as {
    entries?: LogEntry[];
  };
  const entries = data.entries ?? [];

  const rows = entries.map((e) => [e.revision ?? '', e.author ?? '', e.date ?? '', e.message ?? '']);
  const csv = toCsv(['Revision', 'Author', 'Date', 'Message'], rows);
  const filename = `commit-history-${repo.name.replace(/[^a-zA-Z0-9._-]/g, '_')}-${timestamp()}.csv`;
  await saveReportFile(tenantId, filename, csv);
  return { csv, filename };
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
