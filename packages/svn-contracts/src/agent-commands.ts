import { z } from 'zod';

export const REPO_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

export const CreateRepositoryPayload = z.object({
  name: z.string().regex(REPO_NAME_REGEX),
  layout: z.enum(['standard']).default('standard'),
});

export const SetAccessRulePayload = z.object({
  repositoryName: z.string().regex(REPO_NAME_REGEX),
  path: z
    .string()
    .regex(/^\/[^\0]*$/)
    .refine((p) => !p.includes('..'), 'Path traversal not allowed'),
  principalType: z.enum(['user', 'group']),
  principalName: z.string().min(1).max(128),
  access: z.enum(['read', 'write', 'none']),
});

export const RemoveAccessRulePayload = z.object({
  repositoryName: z.string().regex(REPO_NAME_REGEX),
  path: z
    .string()
    .regex(/^\/[^\0]*$/)
    .refine((p) => !p.includes('..'), 'Path traversal not allowed'),
  principalType: z.enum(['user', 'group']),
  principalName: z.string().min(1).max(128),
});

export const GetRepositoryStatusPayload = z.object({
  repositoryName: z.string().regex(REPO_NAME_REGEX),
});

export const ListRepositoriesPayload = z.object({});

export const ExecuteBackupPayload = z.object({
  repositoryName: z.string().regex(REPO_NAME_REGEX).optional(),
});

export const InstallHookPayload = z.object({
  repositoryName: z.string().regex(REPO_NAME_REGEX),
  hookType: z.enum(['pre-commit', 'post-commit']),
  scriptPath: z.string().min(1).max(512),
});

export const ListPathPayload = z.object({
  repositoryName: z.string().regex(REPO_NAME_REGEX),
  path: z
    .string()
    .regex(/^\/[^\0]*$/)
    .refine((p) => !p.includes('..'), 'Path traversal not allowed'),
});

export const GetLogPayload = z.object({
  repositoryName: z.string().regex(REPO_NAME_REGEX),
  path: z
    .string()
    .regex(/^\/[^\0]*$/)
    .refine((p) => !p.includes('..'), 'Path traversal not allowed'),
  limit: z.number().int().min(1).max(200).default(50),
});

export const GetDiffPayload = z.object({
  repositoryName: z.string().regex(REPO_NAME_REGEX),
  path: z
    .string()
    .regex(/^\/[^\0]*$/)
    .refine((p) => !p.includes('..'), 'Path traversal not allowed'),
  revision: z.number().int().min(1),
});

const payloadSchemas = {
  CreateRepository: CreateRepositoryPayload,
  SetAccessRule: SetAccessRulePayload,
  RemoveAccessRule: RemoveAccessRulePayload,
  GetRepositoryStatus: GetRepositoryStatusPayload,
  ListRepositories: ListRepositoriesPayload,
  ExecuteBackup: ExecuteBackupPayload,
  InstallHook: InstallHookPayload,
  ListPath: ListPathPayload,
  GetLog: GetLogPayload,
  GetDiff: GetDiffPayload,
} as const;

export type AgentCommandTypeName = keyof typeof payloadSchemas;

export const AgentCommandType = z.enum([
  'CreateRepository',
  'SetAccessRule',
  'RemoveAccessRule',
  'GetRepositoryStatus',
  'ListRepositories',
  'ExecuteBackup',
  'InstallHook',
  'ListPath',
  'GetLog',
  'GetDiff',
]);

export type AgentCommandType = z.infer<typeof AgentCommandType>;

export function validateAgentPayload(type: AgentCommandType, payload: unknown) {
  const schema = payloadSchemas[type];
  return schema.safeParse(payload);
}

export const AgentCommandRequestSchema = z.object({
  commandId: z.string().uuid(),
  correlationId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(128),
  type: AgentCommandType,
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime(),
  signature: z.string().min(64).max(128),
});

export const AgentCommandResultSchema = z.object({
  commandId: z.string().uuid(),
  success: z.boolean(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  exitCode: z.number().int().optional(),
  durationMs: z.number().int(),
  data: z.record(z.unknown()).optional(),
});

export const ListRepositoriesResultData = z.object({
  repositories: z.array(
    z.object({
      name: z.string(),
      latestRevision: z.number().int().nullable(),
      sizeBytes: z.string().nullable(),
    }),
  ),
});

export type AgentCommandRequest = z.infer<typeof AgentCommandRequestSchema>;
export type AgentCommandResult = z.infer<typeof AgentCommandResultSchema>;
