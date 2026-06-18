import { getApiBaseUrl } from './settings-store.js';

export async function apiFetch(
  apiPath: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (options.accessToken) headers.set('Authorization', `Bearer ${options.accessToken}`);

  const apiBase = getApiBaseUrl();
  return fetch(`${apiBase}${apiPath}`, { ...options, headers });
}

export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await apiFetch('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { accessToken: string };
  return data.accessToken;
}

export async function postAudit(
  accessToken: string,
  event: {
    action: string;
    repositoryId?: string;
    repositoryName?: string;
    metadata?: Record<string, unknown>;
    sourceMachine?: string;
  },
): Promise<boolean> {
  const res = await apiFetch('/client/audit-events', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(event),
  });
  return res.ok;
}

export async function ensureAccessToken(auth: {
  accessToken: string;
  refreshToken: string;
}): Promise<string | null> {
  const probe = await apiFetch('/client/repos', { accessToken: auth.accessToken });
  if (probe.ok) return auth.accessToken;
  return refreshAccessToken(auth.refreshToken);
}
