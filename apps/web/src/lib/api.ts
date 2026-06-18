import type { PlatformStorageSettings, StorageConnectionTestResult } from '@gms-svn/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export interface ApiUser {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  isActive: boolean;
  groups?: { id: string; name: string }[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: ApiUser;
}

export interface AuditLogEntry {
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

export interface RepoIssue {
  id: string;
  repositoryId: string;
  number: number;
  title: string;
  description: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  createdById: string;
  createdByUsername: string;
  assigneeId: string | null;
  assigneeUsername: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WikiPage {
  id: string;
  repositoryId: string;
  slug: string;
  title: string;
  content: string;
  updatedById: string;
  updatedByUsername: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRequest {
  id: string;
  repositoryId: string;
  title: string;
  svnPath: string;
  revision: number | null;
  description: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requesterId: string;
  requesterUsername: string;
  reviewerId: string | null;
  reviewerUsername: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
}

export interface PipelineConfig {
  id: string;
  repositoryId: string;
  enabled: boolean;
  webhookUrl: string | null;
  hasWebhookSecret: boolean;
  triggerPaths: string[];
  triggerBranches: string[];
  hookInstalled: boolean;
  updatedAt: string;
}

export interface PipelineBuild {
  id: string;
  repositoryId: string;
  revision: number;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  durationMs: number | null;
  logUrl: string | null;
  externalBuildId: string | null;
  errorMessage: string | null;
  changedPaths: string[];
  author: string | null;
  triggeredAt: string;
  completedAt: string | null;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onUnauthorized?: () => void;

  setTokens(access: string | null, refresh: string | null) {
    this.accessToken = access;
    this.refreshToken = refresh;
  }

  setOnUnauthorized(fn: () => void) {
    this.onUnauthorized = fn;
  }

  loadFromStorage() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  saveToStorage() {
    if (this.accessToken) localStorage.setItem('accessToken', this.accessToken);
    else localStorage.removeItem('accessToken');
    if (this.refreshToken) localStorage.setItem('refreshToken', this.refreshToken);
    else localStorage.removeItem('refreshToken');
  }

  clearStorage() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    this.accessToken = null;
    this.refreshToken = null;
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (options.body != null && options.body !== '') {
      headers.set('Content-Type', 'application/json');
    }
    if (this.accessToken) headers.set('Authorization', `Bearer ${this.accessToken}`);

    let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401 && this.refreshToken && !path.includes('/auth/refresh')) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers.set('Authorization', `Bearer ${this.accessToken}`);
        res = await fetch(`${API_BASE}${path}`, { ...options, headers });
      }
    }

    if (res.status === 401) {
      this.onUnauthorized?.();
      throw new Error('Unauthorized');
    }

    if (res.status === 204) return undefined as T;

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
    return data as T;
  }

  private buildQuery(params: Record<string, string | undefined>): string {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) q.set(key, value);
    }
    const s = q.toString();
    return s ? `?${s}` : '';
  }

  async downloadReport(reportPath: string, params: Record<string, string | undefined> = {}): Promise<void> {
    const headers = new Headers();
    if (this.accessToken) headers.set('Authorization', `Bearer ${this.accessToken}`);

    const url = `${API_BASE}/reports/${reportPath}${this.buildQuery(params)}`;
    let res = await fetch(url, { headers });

    if (res.status === 401 && this.refreshToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers.set('Authorization', `Bearer ${this.accessToken}`);
        res = await fetch(url, { headers });
      }
    }

    if (res.status === 401) {
      this.onUnauthorized?.();
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `Download failed (${res.status})`);
    }

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? reportPath;

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  listAuditLogs(params: {
    userId?: string;
    action?: string;
    repositoryId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const q = new URLSearchParams();
    if (params.userId) q.set('userId', params.userId);
    if (params.action) q.set('action', params.action);
    if (params.repositoryId) q.set('repositoryId', params.repositoryId);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    return this.request<{ items: AuditLogEntry[]; total: number; page: number; limit: number }>(
      `/audit/logs?${q.toString()}`,
    );
  }

  private async tryRefresh(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string };
      this.accessToken = data.accessToken;
      this.saveToStorage();
      return true;
    } catch {
      return false;
    }
  }

  login(email: string, password: string) {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, username: email, password }),
    });
  }

  logout() {
    return this.request<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });
  }

  me() {
    return this.request<ApiUser>('/auth/me');
  }

  dashboardStats() {
    return this.request<{
      userCount: number;
      groupCount: number;
      repoCount: number;
      latestRevision: { repository: string; revision: number; at: string } | null;
      pipelineFailedBuilds: number;
      pipelineRunningBuilds: number;
    }>('/dashboard/stats');
  }

  listUsers() {
    return this.request<ApiUser[]>('/users');
  }

  createUser(body: { username: string; email: string; password: string; isAdmin?: boolean }) {
    return this.request<ApiUser>('/users', { method: 'POST', body: JSON.stringify(body) });
  }

  updateUser(id: string, body: Partial<{ email: string; password: string; isAdmin: boolean; isActive: boolean }>) {
    return this.request<ApiUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  listGroups() {
    return this.request<
      {
        id: string;
        name: string;
        description: string | null;
        members: { id: string; user: { id: string; username: string; email: string; isActive: boolean } }[];
      }[]
    >('/groups');
  }

  createGroup(body: { name: string; description?: string }) {
    return this.request('/groups', { method: 'POST', body: JSON.stringify(body) });
  }

  deleteGroup(id: string) {
    return this.request<void>(`/groups/${id}`, { method: 'DELETE' });
  }

  addGroupMember(groupId: string, userId: string) {
    return this.request(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  removeGroupMember(groupId: string, userId: string) {
    return this.request<void>(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
  }

  listRepositories() {
    return this.request<
      {
        id: string;
        name: string;
        slug: string;
        svnUrl: string | null;
        status: string;
        latestRevision: number | null;
        sizeBytes: string | null;
      }[]
    >('/repositories');
  }

  getRepository(id: string) {
    return this.request<{
      id: string;
      name: string;
      slug: string;
      svnUrl: string | null;
      status: string;
      latestRevision: number | null;
      sizeBytes: string | null;
      accessRules?: {
        id: string;
        path: string;
        principalType: string;
        principalName: string;
        access: string;
      }[];
    }>(`/repositories/${id}`);
  }

  updateRepository(id: string, body: { name?: string; status?: 'ACTIVE' | 'ARCHIVED' }) {
    return this.request(`/repositories/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  refreshRepository(id: string) {
    return this.request(`/repositories/${id}/refresh`, { method: 'POST', body: JSON.stringify({}) });
  }

  createAccessRule(
    repositoryId: string,
    body: {
      path: string;
      principalType: 'USER' | 'GROUP';
      principalName: string;
      access: 'READ' | 'WRITE' | 'NONE';
    },
  ) {
    return this.request(`/repositories/${repositoryId}/access-rules`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  deleteAccessRule(repositoryId: string, ruleId: string) {
    return this.request<void>(`/repositories/${repositoryId}/access-rules/${ruleId}`, { method: 'DELETE' });
  }

  browseRepository(repositoryId: string, path: string) {
    return this.request<{ path: string; entries: { name: string; kind: string }[] }>(
      `/repositories/${repositoryId}/browse?path=${encodeURIComponent(path)}`,
    );
  }

  getRepositoryLog(repositoryId: string, path: string, limit = 50) {
    return this.request<{ entries: unknown[] }>(
      `/repositories/${repositoryId}/log?path=${encodeURIComponent(path)}&limit=${limit}`,
    );
  }

  getRepositoryDiff(repositoryId: string, path: string, revision: number) {
    return this.request<{ diff: string }>(
      `/repositories/${repositoryId}/diff?path=${encodeURIComponent(path)}&revision=${revision}`,
    );
  }

  listRepositoryBranches(repositoryId: string) {
    return this.request<{ branches: { name: string; path: string; url: string }[] }>(
      `/repositories/${repositoryId}/branches`,
    );
  }

  createRepositoryBranch(
    repositoryId: string,
    body: { name: string; sourcePath?: string; message: string },
  ) {
    return this.request<{
      branchName: string;
      branchPath: string;
      sourcePath: string;
      destUrl: string;
      revision: number | null;
    }>(`/repositories/${repositoryId}/branches`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  createRepository(name: string) {
    return this.request<{
      repository: {
        id: string;
        name: string;
        slug: string;
        status: string;
        svnUrl: string | null;
      };
      command: { id: string; status: string; correlationId: string };
    }>('/repositories', { method: 'POST', body: JSON.stringify({ name }) });
  }

  syncRepositories() {
    return this.request<{ synced?: number; queued?: boolean; commandId?: string }>('/agent/sync', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  getSettings() {
    return this.request<PlatformStorageSettings>('/settings');
  }

  updateSettings(body: Partial<PlatformStorageSettings>) {
    return this.request<PlatformStorageSettings>('/settings', { method: 'PUT', body: JSON.stringify(body) });
  }

  testStorageConnection() {
    return this.request<StorageConnectionTestResult>('/settings/test-connection', { method: 'POST' });
  }

  listIssues(repositoryId: string) {
    return this.request<RepoIssue[]>(`/repositories/${repositoryId}/issues`);
  }

  createIssue(
    repositoryId: string,
    body: {
      title: string;
      description?: string;
      priority?: 'LOW' | 'NORMAL' | 'HIGH';
      assigneeId?: string;
    },
  ) {
    return this.request<RepoIssue>(`/repositories/${repositoryId}/issues`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  updateIssue(
    repositoryId: string,
    issueId: string,
    body: Partial<{
      title: string;
      description: string | null;
      status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
      priority: 'LOW' | 'NORMAL' | 'HIGH';
      assigneeId: string | null;
    }>,
  ) {
    return this.request<RepoIssue>(`/repositories/${repositoryId}/issues/${issueId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  listWikiPages(repositoryId: string) {
    return this.request<WikiPage[]>(`/repositories/${repositoryId}/wiki`);
  }

  getWikiPage(repositoryId: string, slug: string) {
    return this.request<WikiPage>(`/repositories/${repositoryId}/wiki/${encodeURIComponent(slug)}`);
  }

  createWikiPage(
    repositoryId: string,
    body: { slug: string; title: string; content: string },
  ) {
    return this.request<WikiPage>(`/repositories/${repositoryId}/wiki`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  updateWikiPage(repositoryId: string, slug: string, body: { title?: string; content?: string }) {
    return this.request<WikiPage>(`/repositories/${repositoryId}/wiki/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  listReviewRequests(repositoryId: string) {
    return this.request<ReviewRequest[]>(`/repositories/${repositoryId}/reviews`);
  }

  createReviewRequest(
    repositoryId: string,
    body: { title: string; svnPath: string; revision?: number; description?: string },
  ) {
    return this.request<ReviewRequest>(`/repositories/${repositoryId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  decideReviewRequest(
    repositoryId: string,
    reviewId: string,
    body: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string },
  ) {
    return this.request<ReviewRequest>(
      `/repositories/${repositoryId}/reviews/${reviewId}/decision`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  }

  getPipelineConfig(repositoryId: string) {
    return this.request<PipelineConfig>(`/repositories/${repositoryId}/pipeline`);
  }

  updatePipelineConfig(
    repositoryId: string,
    body: {
      enabled?: boolean;
      webhookUrl?: string | null;
      webhookSecret?: string;
      triggerPaths?: string[];
      triggerBranches?: string[];
    },
  ) {
    return this.request<PipelineConfig>(`/repositories/${repositoryId}/pipeline`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  listPipelineBuilds(repositoryId: string) {
    return this.request<PipelineBuild[]>(`/repositories/${repositoryId}/builds`);
  }

  installPipelineHook(repositoryId: string, scriptPath?: string) {
    return this.request<PipelineConfig>(`/repositories/${repositoryId}/pipeline/install-hook`, {
      method: 'POST',
      body: JSON.stringify(scriptPath ? { scriptPath } : {}),
    });
  }

  simulatePipeline(
    repositoryId: string,
    body: { revision?: number; changedPaths?: string[] },
  ) {
    return this.request<{ accepted: boolean; buildId?: string; queued?: boolean }>(
      `/repositories/${repositoryId}/pipeline/simulate`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  }
}

export const api = new ApiClient();
