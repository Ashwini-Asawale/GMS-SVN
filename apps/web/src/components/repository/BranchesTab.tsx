import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface BranchEntry {
  name: string;
  path: string;
  url: string;
}

interface BranchesTabProps {
  repositoryId: string;
  repositoryName: string;
  svnUrl: string | null;
  isAdmin: boolean;
  onBranchCreated?: () => void;
}

export function BranchesTab({
  repositoryId,
  repositoryName,
  svnUrl,
  isAdmin,
  onBranchCreated,
}: BranchesTabProps) {
  const [branches, setBranches] = useState<BranchEntry[]>([]);
  const [sourceOptions, setSourceOptions] = useState<string[]>(['/']);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [sourcePath, setSourcePath] = useState('/');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [branchData, rootData] = await Promise.all([
        api.listRepositoryBranches(repositoryId),
        api.browseRepository(repositoryId, '/'),
      ]);
      setBranches(branchData.branches);

      const rootEntries = (rootData.entries as { name: string; kind: string }[]) ?? [];
      const sources = ['/'];
      for (const entry of rootEntries) {
        if (entry.kind === 'dir') {
          sources.push(`/${entry.name}`);
        }
      }
      setSourceOptions([...new Set(sources)]);
    } catch (e) {
      setBranches([]);
      setError(e instanceof Error ? e.message : 'Failed to load branches');
    } finally {
      setBusy(false);
    }
  }, [repositoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await api.createRepositoryBranch(repositoryId, {
        name: name.trim(),
        sourcePath,
        message: message.trim(),
      });
      setSuccess(
        result.revision
          ? `Created branch "${result.branchName}" at revision ${result.revision}.`
          : `Created branch "${result.branchName}".`,
      );
      setName('');
      setMessage('');
      await load();
      onBranchCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create branch');
    } finally {
      setCreating(false);
    }
  };

  const repoRoot = svnUrl ?? `svn://…/${repositoryName}`;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Branches</h2>
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="rounded border border-slate-600 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {busy && <p className="text-sm text-slate-500 mb-3">Loading…</p>}
        {error && !creating && <p className="text-sm text-red-400 mb-3 whitespace-pre-wrap">{error}</p>}

        {branches.length === 0 && !busy ? (
          <p className="text-sm text-slate-500">No branches yet in this repository.</p>
        ) : (
          <ul className="space-y-2">
            {branches.map((branch) => (
              <li
                key={branch.path}
                className="rounded border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm"
              >
                <div className="font-mono text-blue-300">{branch.name}</div>
                <div className="text-xs text-slate-500 mt-1 break-all">{branch.url}</div>
                <div className="text-xs text-slate-600 mt-1 font-mono">{branch.path}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isAdmin ? (
        <div>
          <h2 className="text-lg font-semibold mb-4">Create branch</h2>
          <p className="text-sm text-slate-400 mb-4">
            Copy from a source path in <span className="font-mono text-slate-300">{repoRoot}</span> to{' '}
            <span className="font-mono text-slate-300">…/branches/&lt;name&gt;</span>.
          </p>

          <form onSubmit={(e) => void createBranch(e)} className="space-y-4">
            <label className="block text-sm">
              <span className="text-slate-400">Branch name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="feature-login"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm"
                required
              />
            </label>

            <label className="block text-sm">
              <span className="text-slate-400">Copy from (source path)</span>
              <select
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm"
              >
                {sourceOptions.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500 mt-1 block">
                Use <span className="font-mono">/</span> for repository root (empty repos or trunk-less layouts).
              </span>
            </label>

            <label className="block text-sm">
              <span className="text-slate-400">Log message</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Create branch ${name || 'my-branch'}`}
                rows={3}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                required
              />
            </label>

            {creating && error && <p className="text-sm text-red-400 whitespace-pre-wrap">{error}</p>}
            {success && <p className="text-sm text-green-400">{success}</p>}

            <button
              type="submit"
              disabled={creating || !name.trim() || !message.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create branch'}
            </button>
          </form>
        </div>
      ) : (
        <div className="rounded border border-slate-800 bg-slate-950/40 px-4 py-6 text-sm text-slate-500">
          Only administrators can create branches from Web Admin.
        </div>
      )}
    </div>
  );
}
