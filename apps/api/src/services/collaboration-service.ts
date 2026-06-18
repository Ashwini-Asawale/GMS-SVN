import { prisma } from '../lib/prisma.js';
import { writeAuditLog } from '../lib/audit.js';

async function nextIssueNumber(repositoryId: string): Promise<number> {
  const last = await prisma.repoIssue.findFirst({
    where: { repositoryId },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

async function assertRepository(tenantId: string, repositoryId: string) {
  const repo = await prisma.repository.findFirst({ where: { id: repositoryId, tenantId } });
  if (!repo) throw new Error('Repository not found');
  if (repo.status === 'ARCHIVED') throw new Error('Repository is archived');
  return repo;
}

function serializeIssue(issue: {
  id: string;
  repositoryId: string;
  number: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  createdById: string;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { username: string };
  assignee: { username: string } | null;
}) {
  return {
    id: issue.id,
    repositoryId: issue.repositoryId,
    number: issue.number,
    title: issue.title,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    createdById: issue.createdById,
    createdByUsername: issue.createdBy.username,
    assigneeId: issue.assigneeId,
    assigneeUsername: issue.assignee?.username ?? null,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
  };
}

export async function listIssues(tenantId: string, repositoryId: string) {
  await assertRepository(tenantId, repositoryId);
  const issues = await prisma.repoIssue.findMany({
    where: { repositoryId },
    orderBy: [{ status: 'asc' }, { number: 'desc' }],
    include: {
      createdBy: { select: { username: true } },
      assignee: { select: { username: true } },
    },
  });
  return issues.map(serializeIssue);
}

export async function createIssue(
  tenantId: string,
  repositoryId: string,
  userId: string,
  data: {
    title: string;
    description?: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH';
    assigneeId?: string;
  },
) {
  const repo = await assertRepository(tenantId, repositoryId);
  const number = await nextIssueNumber(repositoryId);

  const issue = await prisma.repoIssue.create({
    data: {
      repositoryId,
      number,
      title: data.title,
      description: data.description,
      priority: data.priority ?? 'NORMAL',
      createdById: userId,
      assigneeId: data.assigneeId,
    },
    include: {
      createdBy: { select: { username: true } },
      assignee: { select: { username: true } },
    },
  });

  await writeAuditLog({
    action: 'issue.created',
    userId,
    repositoryId,
    metadata: { issueNumber: number, title: data.title, repositoryName: repo.name },
  });

  return serializeIssue(issue);
}

export async function updateIssue(
  tenantId: string,
  repositoryId: string,
  issueId: string,
  userId: string,
  data: {
    title?: string;
    description?: string | null;
    status?: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
    priority?: 'LOW' | 'NORMAL' | 'HIGH';
    assigneeId?: string | null;
  },
) {
  const repo = await assertRepository(tenantId, repositoryId);
  const existing = await prisma.repoIssue.findFirst({ where: { id: issueId, repositoryId } });
  if (!existing) throw new Error('Issue not found');

  const issue = await prisma.repoIssue.update({
    where: { id: issueId },
    data: {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      assigneeId: data.assigneeId,
    },
    include: {
      createdBy: { select: { username: true } },
      assignee: { select: { username: true } },
    },
  });

  const action = data.status === 'CLOSED' ? 'issue.closed' : 'issue.updated';
  await writeAuditLog({
    action,
    userId,
    repositoryId,
    metadata: { issueNumber: issue.number, repositoryName: repo.name, changes: data },
  });

  return serializeIssue(issue);
}

function serializeWikiPage(page: {
  id: string;
  repositoryId: string;
  slug: string;
  title: string;
  content: string;
  updatedById: string;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: { username: string };
}) {
  return {
    id: page.id,
    repositoryId: page.repositoryId,
    slug: page.slug,
    title: page.title,
    content: page.content,
    updatedById: page.updatedById,
    updatedByUsername: page.updatedBy.username,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}

export async function listWikiPages(tenantId: string, repositoryId: string) {
  await assertRepository(tenantId, repositoryId);
  const pages = await prisma.wikiPage.findMany({
    where: { repositoryId },
    orderBy: { title: 'asc' },
    include: { updatedBy: { select: { username: true } } },
  });
  return pages.map(serializeWikiPage);
}

export async function getWikiPage(tenantId: string, repositoryId: string, slug: string) {
  await assertRepository(tenantId, repositoryId);
  const page = await prisma.wikiPage.findUnique({
    where: { repositoryId_slug: { repositoryId, slug } },
    include: { updatedBy: { select: { username: true } } },
  });
  if (!page) throw new Error('Wiki page not found');
  return serializeWikiPage(page);
}

export async function createWikiPage(
  tenantId: string,
  repositoryId: string,
  userId: string,
  data: { slug: string; title: string; content: string },
) {
  const repo = await assertRepository(tenantId, repositoryId);
  const existing = await prisma.wikiPage.findUnique({
    where: { repositoryId_slug: { repositoryId, slug: data.slug } },
  });
  if (existing) throw new Error('Wiki page slug already exists');

  const page = await prisma.wikiPage.create({
    data: {
      repositoryId,
      slug: data.slug,
      title: data.title,
      content: data.content,
      updatedById: userId,
    },
    include: { updatedBy: { select: { username: true } } },
  });

  await writeAuditLog({
    action: 'wiki.page_created',
    userId,
    repositoryId,
    metadata: { slug: data.slug, title: data.title, repositoryName: repo.name },
  });

  return serializeWikiPage(page);
}

export async function updateWikiPage(
  tenantId: string,
  repositoryId: string,
  slug: string,
  userId: string,
  data: { title?: string; content?: string },
) {
  const repo = await assertRepository(tenantId, repositoryId);
  const existing = await prisma.wikiPage.findUnique({
    where: { repositoryId_slug: { repositoryId, slug } },
  });
  if (!existing) throw new Error('Wiki page not found');

  const page = await prisma.wikiPage.update({
    where: { id: existing.id },
    data: {
      title: data.title,
      content: data.content,
      updatedById: userId,
    },
    include: { updatedBy: { select: { username: true } } },
  });

  await writeAuditLog({
    action: 'wiki.page_updated',
    userId,
    repositoryId,
    metadata: { slug, repositoryName: repo.name },
  });

  return serializeWikiPage(page);
}

function serializeReview(review: {
  id: string;
  repositoryId: string;
  title: string;
  svnPath: string;
  revision: number | null;
  description: string | null;
  status: string;
  requesterId: string;
  reviewerId: string | null;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  requester: { username: string };
  reviewer: { username: string } | null;
}) {
  return {
    id: review.id,
    repositoryId: review.repositoryId,
    title: review.title,
    svnPath: review.svnPath,
    revision: review.revision,
    description: review.description,
    status: review.status,
    requesterId: review.requesterId,
    requesterUsername: review.requester.username,
    reviewerId: review.reviewerId,
    reviewerUsername: review.reviewer?.username ?? null,
    reviewNote: review.reviewNote,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    reviewedAt: review.reviewedAt?.toISOString() ?? null,
  };
}

export async function listReviewRequests(tenantId: string, repositoryId: string) {
  await assertRepository(tenantId, repositoryId);
  const reviews = await prisma.reviewRequest.findMany({
    where: { repositoryId },
    orderBy: { createdAt: 'desc' },
    include: {
      requester: { select: { username: true } },
      reviewer: { select: { username: true } },
    },
  });
  return reviews.map(serializeReview);
}

export async function createReviewRequest(
  tenantId: string,
  repositoryId: string,
  userId: string,
  data: { title: string; svnPath: string; revision?: number; description?: string },
) {
  const repo = await assertRepository(tenantId, repositoryId);

  const review = await prisma.reviewRequest.create({
    data: {
      repositoryId,
      title: data.title,
      svnPath: data.svnPath,
      revision: data.revision,
      description: data.description,
      requesterId: userId,
    },
    include: {
      requester: { select: { username: true } },
      reviewer: { select: { username: true } },
    },
  });

  await writeAuditLog({
    action: 'review.requested',
    userId,
    repositoryId,
    metadata: {
      reviewId: review.id,
      svnPath: data.svnPath,
      revision: data.revision,
      repositoryName: repo.name,
    },
  });

  return serializeReview(review);
}

export async function decideReviewRequest(
  tenantId: string,
  repositoryId: string,
  reviewId: string,
  reviewerId: string,
  isAdmin: boolean,
  data: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string },
) {
  if (!isAdmin) throw new Error('Admin access required to approve or reject reviews');

  const repo = await assertRepository(tenantId, repositoryId);
  const existing = await prisma.reviewRequest.findFirst({
    where: { id: reviewId, repositoryId },
  });
  if (!existing) throw new Error('Review request not found');
  if (existing.status !== 'PENDING') throw new Error('Review already decided');

  const review = await prisma.reviewRequest.update({
    where: { id: reviewId },
    data: {
      status: data.status,
      reviewerId,
      reviewNote: data.reviewNote,
      reviewedAt: new Date(),
    },
    include: {
      requester: { select: { username: true } },
      reviewer: { select: { username: true } },
    },
  });

  await writeAuditLog({
    action: data.status === 'APPROVED' ? 'review.approved' : 'review.rejected',
    userId: reviewerId,
    repositoryId,
    metadata: {
      reviewId,
      svnPath: review.svnPath,
      revision: review.revision,
      repositoryName: repo.name,
      reviewNote: data.reviewNote,
    },
  });

  return serializeReview(review);
}
