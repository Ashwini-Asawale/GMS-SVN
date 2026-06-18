import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function ReportsPage() {
  const [repos, setRepos] = useState<{ id: string; name: string }[]>([]);
  const [commitRepoId, setCommitRepoId] = useState('');
  const [commitPath, setCommitPath] = useState('/trunk');
  const [accessRepoId, setAccessRepoId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listRepositories().then((r) => {
      setRepos(r.map((x) => ({ id: x.id, name: x.name })));
      if (r[0]) setCommitRepoId(r[0].id);
    });
  }, []);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Reports</h1>
      <p className="text-slate-400 mt-1 text-sm">
        On-demand CSV/PDF exports. Files are also saved to the configured reports folder on storage.
      </p>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <ReportCard
          title="User list"
          description="All users with group membership"
          busy={busy === 'users'}
          onExport={() => run('users', () => api.downloadReport('users.csv'))}
        />

        <ReportCard
          title="Repository list"
          description="Repositories with size and latest revision"
          busy={busy === 'repos'}
          onExport={() => run('repos', () => api.downloadReport('repositories.csv'))}
        />

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2">
          <h2 className="font-semibold">Access rules (PDF)</h2>
          <p className="text-sm text-slate-400 mt-1">Path permissions per repository — user/group × path × access</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm min-w-[200px]">
              <span className="text-slate-400">Repository</span>
              <select
                value={accessRepoId}
                onChange={(e) => setAccessRepoId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="">All repositories</option>
                {repos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy === 'access-rules'}
              onClick={() =>
                run('access-rules', () =>
                  api.downloadReport('access-rules.pdf', accessRepoId ? { repositoryId: accessRepoId } : {}),
                )
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
            >
              {busy === 'access-rules' ? 'Generating…' : 'Download PDF'}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2">
          <h2 className="font-semibold">Commit history (CSV)</h2>
          <p className="text-sm text-slate-400 mt-1">SVN log from GMS SVN SERVER — matches web browse log</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm min-w-[180px]">
              <span className="text-slate-400">Repository</span>
              <select
                value={commitRepoId}
                onChange={(e) => setCommitRepoId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                {repos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm min-w-[180px]">
              <span className="text-slate-400">Path</span>
              <input
                value={commitPath}
                onChange={(e) => setCommitPath(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono"
              />
            </label>
            <button
              type="button"
              disabled={!commitRepoId || busy === 'commit-history'}
              onClick={() =>
                run('commit-history', () =>
                  api.downloadReport('commit-history.csv', {
                    repositoryId: commitRepoId,
                    path: commitPath,
                    limit: '100',
                  }),
                )
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
            >
              {busy === 'commit-history' ? 'Generating…' : 'Download CSV'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function ReportCard({
  title,
  description,
  busy,
  onExport,
}: {
  title: string;
  description: string;
  busy: boolean;
  onExport: () => void;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-slate-400 mt-1 flex-1">{description}</p>
      <button
        type="button"
        onClick={onExport}
        disabled={busy}
        className="mt-4 self-start rounded-lg border border-slate-600 px-4 py-2 text-sm hover:border-slate-500 disabled:opacity-50"
      >
        {busy ? 'Exporting…' : 'Download CSV'}
      </button>
    </section>
  );
}
