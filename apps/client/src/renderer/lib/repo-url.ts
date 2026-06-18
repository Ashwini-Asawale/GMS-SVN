export function resolveRepositoryRootUrl(svnUrl: string, repositoryName: string): string {
  const normalized = svnUrl.replace(/\/+$/, '');
  const marker = `/${repositoryName}`;
  const idx = normalized.lastIndexOf(marker);
  if (idx < 0) return normalized;
  return normalized.slice(0, idx + marker.length);
}

export function buildBranchUrl(repoRootUrl: string, name: string): string {
  const root = repoRootUrl.replace(/\/+$/, '');
  const safeName = name.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  return `${root}/branches/${safeName}`;
}

export function buildTagUrl(repoRootUrl: string, name: string): string {
  const root = repoRootUrl.replace(/\/+$/, '');
  const safeName = name.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  return `${root}/tags/${safeName}`;
}

export function joinRepoUrlPath(baseUrl: string, relativePath: string): string {
  const root = baseUrl.replace(/\/+$/, '');
  if (!relativePath) return root;
  return `${root}/${relativePath.replace(/^\/+/, '')}`;
}
