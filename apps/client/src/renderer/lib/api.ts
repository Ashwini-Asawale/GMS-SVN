const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

export interface ApiUser {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
}

export interface ClientRepo {
  id: string;
  name: string;
  slug: string;
  svnUrl: string | null;
  status: string;
  latestRevision: number | null;
  sizeBytes: string | null;
}

export interface ClientCheckoutPath {
  label: string;
  path: string;
  url: string;
  folderName: string;
}

export interface ClientRepoBrowseEntry {
  name: string;
  kind: 'dir' | 'file';
}

export interface ClientRepoBrowseResult {
  repositoryName: string;
  path: string;
  url: string;
  entries: ClientRepoBrowseEntry[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: ApiUser;
}

async function resolveApiBase(): Promise<string> {
  if (window.gmsClient?.settings) {
    return window.gmsClient.settings.getApiBaseUrl();
  }
  return API_BASE;
}

async function request<T>(path: string, accessToken: string | null, options: RequestInit = {}): Promise<T> {
  const apiBase = await resolveApiBase();
  const headers = new Headers(options.headers);
  if (options.body !== undefined && options.body !== null && options.body !== '') {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, { ...options, headers });
  } catch {
    throw new Error(`Cannot reach server at ${apiBase}. Check Server URL, firewall, and that the API is running.`);
  }

  if (res.status === 401 && accessToken) {
    const auth = await window.gmsClient.auth.load();
    if (auth?.refreshToken) {
      const newAccess = await window.gmsClient.auth.refresh(auth.refreshToken);
      if (newAccess) {
        await window.gmsClient.auth.save({ ...auth, accessToken: newAccess });
        headers.set('Authorization', `Bearer ${newAccess}`);
        res = await fetch(`${apiBase}${path}`, { ...options, headers });
      }
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  login(tenantSlug: string, email: string, password: string) {
    return request<LoginResponse>('/auth/login', null, {
      method: 'POST',
      body: JSON.stringify({ tenantSlug, email, username: email, password }),
    });
  },

  clientRepos(accessToken: string) {
    return request<ClientRepo[]>('/client/repos', accessToken);
  },

  clientCheckoutPaths(accessToken: string, repositoryId: string) {
    return request<{ paths: ClientCheckoutPath[] }>(
      `/client/repos/${repositoryId}/checkout-paths`,
      accessToken,
    );
  },

  clientBrowseRepository(accessToken: string, repositoryId: string, path = '/') {
    const query = new URLSearchParams({ path });
    return request<ClientRepoBrowseResult>(
      `/client/repos/${repositoryId}/browse?${query.toString()}`,
      accessToken,
    );
  },

  postAudit(
    accessToken: string,
    body: {
      action: string;
      repositoryId?: string;
      repositoryName?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return request<{ ok: boolean }>('/client/audit-events', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
