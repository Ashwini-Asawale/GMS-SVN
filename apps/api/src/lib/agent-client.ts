import { randomUUID } from 'node:crypto';
import type { AgentCommandResult, AgentCommandType } from '@gms-svn/svn-contracts';
import { AgentCommandResultSchema, signAgentRequest, validateAgentPayload } from '@gms-svn/svn-contracts';
import {
  type SvnDirectSettings,
  svnDirectAvailable,
  svnDirectGetDiff,
  svnDirectGetLog,
  svnDirectGetRepositoryStatus,
  svnDirectListPath,
  svnDirectListRepositories,
} from './svn-direct.js';

export interface AgentClientOptions {
  baseUrl: string;
  hmacSecret: string;
  mock: boolean;
  /** When mock is true, read live SVN data from svnserve/VisualSVN instead of static fixtures. */
  svnDirect?: SvnDirectSettings | null;
}

const MOCK_TREE: Record<string, { name: string; kind: 'dir' | 'file' }[]> = {
  '/': [
    { name: 'trunk', kind: 'dir' },
    { name: 'branches', kind: 'dir' },
    { name: 'tags', kind: 'dir' },
  ],
  '/trunk': [
    { name: 'README.md', kind: 'file' },
    { name: 'src', kind: 'dir' },
  ],
  '/trunk/src': [
    { name: 'main.c', kind: 'file' },
    { name: 'utils.c', kind: 'file' },
  ],
  '/branches': [],
  '/tags': [],
};

export class AgentClient {
  constructor(private readonly options: AgentClientOptions) {}

  async execute(
    type: AgentCommandType,
    payload: Record<string, unknown>,
    meta: { commandId: string; correlationId: string; idempotencyKey: string },
  ): Promise<AgentCommandResult> {
    const validation = validateAgentPayload(type, payload);
    if (!validation.success) {
      throw new Error(`Invalid agent payload: ${validation.error.message}`);
    }

    if (this.options.mock) {
      return this.mockExecute(type, payload, meta.commandId);
    }

    const timestamp = new Date().toISOString();
    const signature = signAgentRequest(
      this.options.hmacSecret,
      meta.commandId,
      type,
      timestamp,
      payload,
    );

    const body = {
      commandId: meta.commandId,
      correlationId: meta.correlationId,
      idempotencyKey: meta.idempotencyKey,
      type,
      payload,
      timestamp,
      signature,
    };

    const url = `${this.options.baseUrl.replace(/\/$/, '')}/commands`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : `Agent request failed (${res.status})`);
    }

    const parsed = AgentCommandResultSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error('Agent returned invalid result shape');
    }

    return parsed.data;
  }

  private async mockExecute(
    type: AgentCommandType,
    payload: Record<string, unknown>,
    commandId: string,
  ): Promise<AgentCommandResult> {
    const start = Date.now();
    const durationMs = () => Date.now() - start;
    const svnDirect = this.options.svnDirect;

    if (svnDirect && svnDirectAvailable(svnDirect)) {
      try {
        const live = await this.liveSvnExecute(type, payload, commandId, durationMs, svnDirect);
        if (live) return live;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Live SVN read failed';
        if (type === 'ListPath' || type === 'GetLog' || type === 'GetDiff' || type === 'GetRepositoryStatus' || type === 'ListRepositories') {
          return {
            commandId,
            success: false,
            stdout: '',
            stderr: message,
            exitCode: 1,
            durationMs: durationMs(),
          };
        }
      }
    }

    switch (type) {
      case 'CreateRepository': {
        const name = payload.name as string;
        return {
          commandId,
          success: true,
          stdout: `Mock: created repository ${name} with /trunk, /branches, /tags`,
          exitCode: 0,
          durationMs: durationMs(),
          data: { name, layout: 'standard' },
        };
      }
      case 'SetAccessRule':
        return {
          commandId,
          success: true,
          stdout: `Mock: SetAccessRule ${payload.path} → ${payload.principalName} (${payload.access})`,
          exitCode: 0,
          durationMs: durationMs(),
        };
      case 'RemoveAccessRule':
        return {
          commandId,
          success: true,
          stdout: `Mock: RemoveAccessRule ${payload.path} for ${payload.principalName}`,
          exitCode: 0,
          durationMs: durationMs(),
        };
      case 'InstallHook': {
        const name = payload.repositoryName as string;
        const hookType = payload.hookType as string;
        return {
          commandId,
          success: true,
          stdout: `Mock: installed ${hookType} hook for ${name}`,
          exitCode: 0,
          durationMs: durationMs(),
        };
      }
      case 'ListRepositories':
        return {
          commandId,
          success: true,
          stdout: 'Mock: listed repositories',
          exitCode: 0,
          durationMs: durationMs(),
          data: { repositories: [] },
        };
      case 'GetRepositoryStatus':
        return {
          commandId,
          success: true,
          stdout: 'Mock: repository status',
          exitCode: 0,
          durationMs: durationMs(),
          data: {
            name: payload.repositoryName,
            latestRevision: 3,
            sizeBytes: '4096',
            lockCount: 0,
          },
        };
      case 'ListPath': {
        const path = (payload.path as string) || '/';
        const entries = MOCK_TREE[path] ?? [];
        return {
          commandId,
          success: true,
          stdout: `Mock: list ${path}`,
          exitCode: 0,
          durationMs: durationMs(),
          data: { path, entries },
        };
      }
      case 'GetLog':
        return {
          commandId,
          success: true,
          stdout: 'Mock: svn log',
          exitCode: 0,
          durationMs: durationMs(),
          data: {
            entries: [
              {
                revision: 3,
                author: 'dev1',
                date: new Date().toISOString(),
                message: 'Update main.c',
                paths: [{ path: '/trunk/src/main.c', action: 'M' }],
              },
              {
                revision: 2,
                author: 'admin',
                date: new Date(Date.now() - 86400000).toISOString(),
                message: 'Add utils module',
                paths: [{ path: '/trunk/src/utils.c', action: 'A' }],
              },
              {
                revision: 1,
                author: 'admin',
                date: new Date(Date.now() - 172800000).toISOString(),
                message: 'Initial import',
                paths: [{ path: '/trunk', action: 'A' }],
              },
            ],
          },
        };
      case 'GetDiff':
        return {
          commandId,
          success: true,
          stdout: 'Mock: svn diff',
          exitCode: 0,
          durationMs: durationMs(),
          data: {
            revision: payload.revision,
            path: payload.path,
            diff: `--- ${payload.path}\t(revision ${Number(payload.revision) - 1})\n+++ ${payload.path}\t(revision ${payload.revision})\n@@ -1,3 +1,4 @@\n int main() {\n+  // mock diff\n   return 0;\n }`,
          },
        };
      default:
        return {
          commandId,
          success: true,
          stdout: `Mock: executed ${type}`,
          exitCode: 0,
          durationMs: durationMs(),
        };
    }
  }

  private async liveSvnExecute(
    type: AgentCommandType,
    payload: Record<string, unknown>,
    commandId: string,
    durationMs: () => number,
    svnDirect: SvnDirectSettings,
  ): Promise<AgentCommandResult | null> {
    switch (type) {
      case 'ListRepositories': {
        const data = await svnDirectListRepositories(svnDirect);
        return {
          commandId,
          success: true,
          stdout: `Listed ${data.repositories.length} repositories from live SVN`,
          exitCode: 0,
          durationMs: durationMs(),
          data,
        };
      }
      case 'GetRepositoryStatus': {
        const name = payload.repositoryName as string;
        const data = await svnDirectGetRepositoryStatus(svnDirect, name);
        return {
          commandId,
          success: true,
          stdout: `Revision ${data.latestRevision ?? '—'}`,
          exitCode: 0,
          durationMs: durationMs(),
          data,
        };
      }
      case 'ListPath': {
        const name = payload.repositoryName as string;
        const repoPath = (payload.path as string) || '/';
        const data = await svnDirectListPath(svnDirect, name, repoPath);
        return {
          commandId,
          success: true,
          stdout: `Listed ${data.entries.length} entries`,
          exitCode: 0,
          durationMs: durationMs(),
          data,
        };
      }
      case 'GetLog': {
        const name = payload.repositoryName as string;
        const repoPath = (payload.path as string) || '/';
        const limit = Number(payload.limit ?? 50);
        const data = await svnDirectGetLog(svnDirect, name, repoPath, limit);
        return {
          commandId,
          success: true,
          stdout: `Loaded ${data.entries.length} log entries`,
          exitCode: 0,
          durationMs: durationMs(),
          data,
        };
      }
      case 'GetDiff': {
        const name = payload.repositoryName as string;
        const repoPath = (payload.path as string) || '/';
        const revision = Number(payload.revision);
        const data = await svnDirectGetDiff(svnDirect, name, repoPath, revision);
        return {
          commandId,
          success: true,
          stdout: 'Loaded diff',
          exitCode: 0,
          durationMs: durationMs(),
          data,
        };
      }
      default:
        return null;
    }
  }
}

let client: AgentClient | null = null;
let clientKey: string | null = null;

function clientOptionsKey(options: AgentClientOptions): string {
  return JSON.stringify({
    baseUrl: options.baseUrl,
    mock: options.mock,
    svnDirect: options.svnDirect,
  });
}

export function getAgentClient(options: AgentClientOptions): AgentClient {
  const key = clientOptionsKey(options);
  if (!client || clientKey !== key) {
    client = new AgentClient(options);
    clientKey = key;
  }
  return client;
}

export function newCorrelationId(): string {
  return randomUUID();
}

export function newIdempotencyKey(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
