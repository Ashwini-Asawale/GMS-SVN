import { Link } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export function RepositoriesPage() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const [repos, setRepos] = useState<
    {
      id: string;
      name: string;
      slug: string;
      status: string;
      latestRevision: number | null;
      sizeBytes: string | null;
      svnUrl: string | null;
    }[]
  >([]);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadRepos = useCallback(() => {
    api.listRepositories().then(setRepos).catch(console.error);
  }, []);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  useEffect(() => {
    if (!isAdmin) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const url = `${API_BASE}/agent/events?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    source.onmessage = () => {
      loadRepos();
    };

    return () => source.close();
  }, [isAdmin, loadRepos]);

  const createRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api.createRepository(name.trim());
      setName('');
      loadRepos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repository');
    } finally {
      setCreating(false);
    }
  };

  const syncFromServer = async () => {
    setSyncing(true);
    setError(null);
    try {
      await api.syncRepositories();
      loadRepos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Repositories</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Manage repos, access rules, browse, log and diff (Phase 4)
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={syncFromServer}
            disabled={syncing}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:border-slate-500 disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Sync from server'}
          </button>
        )}
      </div>

      {isAdmin && (
        <form onSubmit={createRepo} className="mt-6 flex flex-wrap items-end gap-3 max-w-lg">
          <label className="flex-1 min-w-[200px] text-sm">
            <span className="text-slate-400">New repository name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              pattern="^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$"
              required
              placeholder="my-project"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-blue-500 font-mono text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create repository'}
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {repos.length === 0 ? (
        <p className="mt-8 text-slate-500">No repositories yet. Create one or sync from GMS SVN SERVER.</p>
      ) : (
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-800">
              <th className="pb-2">Name</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Revision</th>
              <th className="pb-2">Size</th>
              <th className="pb-2">SVN URL</th>
            </tr>
          </thead>
          <tbody>
            {repos.map((r) => (
              <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                <td className="py-3">
                  <Link to={`/repositories/${r.id}`} className="text-blue-400 hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="py-3">{r.latestRevision ?? '—'}</td>
                <td className="py-3">{r.sizeBytes ?? '—'}</td>
                <td className="py-3 font-mono text-xs">{r.svnUrl ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-green-900/50 text-green-300',
    PENDING: 'bg-amber-900/50 text-amber-300',
    ARCHIVED: 'bg-slate-800 text-slate-400',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs uppercase ${styles[status] ?? styles.PENDING}`}>
      {status}
    </span>
  );
}
