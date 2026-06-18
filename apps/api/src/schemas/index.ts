import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().email().optional(),
    username: z.string().min(1).optional(),
    password: z.string().min(1),
  })
  .refine((data) => Boolean(data.email?.trim() || data.username?.trim()), {
    message: 'Email is required',
    path: ['email'],
  });

export const createUserSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  isAdmin: z.boolean().optional().default(false),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  isAdmin: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const createGroupSchema = z.object({
  name: z.string().min(2).max(64),
  description: z.string().max(255).optional(),
});

export const updateGroupSchema = z.object({
  name: z.string().min(2).max(64).optional(),
  description: z.string().max(255).optional().nullable(),
});

export const addGroupMemberSchema = z.object({
  userId: z.string().uuid(),
});

export const createRepositorySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/, 'Invalid repository name'),
});

export const updateRepositorySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/)
    .optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});

export const createAccessRuleSchema = z.object({
  path: z
    .string()
    .regex(/^\/[^\0]*$/)
    .refine((p) => !p.includes('..'), 'Path traversal not allowed'),
  principalType: z.enum(['USER', 'GROUP']),
  principalName: z.string().min(1).max(128),
  access: z.enum(['READ', 'WRITE', 'NONE']),
});

export const createRepositoryBranchSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, 'Invalid branch name'),
  sourcePath: z
    .string()
    .regex(/^\/[^\0]*$/)
    .refine((p) => !p.includes('..'), 'Path traversal not allowed')
    .optional()
    .default('/'),
  message: z.string().min(1).max(2000),
});

export const clientAuditEventSchema = z.object({
  action: z.enum(['svn.checkout', 'svn.update', 'svn.commit', 'svn.revert', 'svn.diff', 'svn.log']),
  repositoryId: z.string().uuid().optional(),
  repositoryName: z.string().max(128).optional(),
  metadata: z.record(z.unknown()).optional(),
  sourceMachine: z.string().max(255).optional(),
});

export const auditLogQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  repositoryId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const auditLogExportQuerySchema = auditLogQuerySchema.omit({ page: true, limit: true });

export const commitHistoryReportQuerySchema = z.object({
  repositoryId: z.string().uuid(),
  path: z.string().optional().default('/trunk'),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

export const createIssueSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional().default('NORMAL'),
  assigneeId: z.string().uuid().optional(),
});

export const updateIssueSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
});

export const createWikiPageSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  title: z.string().min(1).max(200),
  content: z.string().max(100_000),
});

export const updateWikiPageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(100_000).optional(),
});

export const createReviewRequestSchema = z.object({
  title: z.string().min(1).max(200),
  svnPath: z
    .string()
    .regex(/^\/[^\0]*$/)
    .refine((p) => !p.includes('..'), 'Path traversal not allowed'),
  revision: z.number().int().min(1).optional(),
  description: z.string().max(5000).optional(),
});

export const reviewDecisionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().max(2000).optional(),
});

export const postCommitHookSchema = z.object({
  repositoryName: z.string().min(1).max(64),
  revision: z.number().int().min(1),
  author: z.string().max(128).optional(),
  changedPaths: z.array(z.string().max(512)).optional(),
});

export const buildCallbackSchema = z.object({
  buildId: z.string().uuid(),
  status: z.enum(['SUCCESS', 'FAILED', 'RUNNING']),
  durationMs: z.number().int().min(0).optional(),
  logUrl: z.string().url().optional(),
  externalBuildId: z.string().max(256).optional(),
  errorMessage: z.string().max(2000).optional(),
});

export const updatePipelineConfigSchema = z.object({
  enabled: z.boolean().optional(),
  webhookUrl: z.string().url().optional().nullable(),
  webhookSecret: z.string().min(8).max(256).optional().nullable(),
  triggerPaths: z.array(z.string().regex(/^\/[^\0]*$/)).min(1).optional(),
  triggerBranches: z.array(z.string().min(1).max(64)).min(1).optional(),
});

const optionalPath = z.string().min(1).optional();
const optionalUrl = z.union([z.string().url(), z.literal('')]).optional();

export const updateSettingsSchema = z.object({
  gmsSvnServerHost: z.string().min(1).optional(),
  visualsvnUrl: optionalUrl,
  visualsvnRepoRoot: optionalPath,
  storageBackend: z.enum(['iscsi', 'smb']).optional(),
  storageBackupPath: optionalPath,
  storageReportsPath: optionalPath,
  storageAttachmentsPath: optionalPath,
  storageLogsPath: optionalPath,
});
