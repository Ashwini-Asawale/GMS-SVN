import { useCallback, useEffect, useMemo, useState } from 'react';
import { joinRepoUrlPath, resolveRepositoryRootUrl } from '../lib/repo-url';

interface RepoEntry {
  name: string;
  isDir: boolean;
}

function parseSvnList(stdout: string): RepoEntry[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      name: line.endsWith('/') ? line.slice(0, -1) : line,
      isDir: line.endsWith('/'),
    }))
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
}

function joinRepoPath(baseUrl: string, relativePath: string): string {
  return joinRepoUrlPath(baseUrl, relativePath);
}

interface RepoBrowserDialogProps {
  workingCopyId: string;
  repoName: string;
  repoUrl: string;
  onClose: () => void;
  getAccessToken: () => Promise<string | null>;
}

export function RepoBrowserDialog({
  workingCopyId,
  repoName,
  repoUrl,
  onClose,
  getAccessToken,
}: RepoBrowserDialogProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<RepoEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const repoRootUrl = useMemo(
    () => resolveRepositoryRootUrl(repoUrl, repoName),
    [repoUrl, repoName],
  );

  const displayUrl = useMemo(() => joinRepoPath(repoRootUrl, currentPath), [repoRootUrl, currentPath]);

  const pathParts = useMemo(() => {
    if (!currentPath) return [];
    return currentPath.split('/').filter(Boolean);
  }, [currentPath]);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const result = await window.gmsClient.svn.list({
        id: workingCopyId,
        accessToken: token,
        path: currentPath || undefined,
        fromRepoRoot: true,
      });
      if (!result.success) {
        setEntries([]);
        setError(result.stderr.trim() || 'Could not list repository folder');
        return;
      }
      setEntries(parseSvnList(result.stdout));
    } catch (e) {
      setEntries([]);
      setError(e instanceof Error ? e.message : 'Could not list repository folder');
    } finally {
      setBusy(false);
    }
  }, [currentPath, getAccessToken, workingCopyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const goUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  const openFolder = (name: string) => {
    setCurrentPath(currentPath ? `${currentPath}/${name}` : name);
  };

  const goToPath = (index: number) => {
    if (index < 0) {
      setCurrentPath('');
      return;
    }
    setCurrentPath(pathParts.slice(0, index + 1).join('/'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="flex w-full max-w-3xl flex-col rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
        style={{ minHeight: '420px', maxHeight: '85vh' }}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold">Repo-browser</h2>
            <p className="text-xs text-slate-400">{repoName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-600 px-3 py-1 text-sm hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="border-b border-slate-800 px-4 py-3 space-y-2">
          <label className="text-xs text-slate-400">Repository URL</label>
          <input
            readOnly
            value={displayUrl}
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-blue-200"
          />
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => goToPath(-1)}
              className={`rounded px-2 py-0.5 ${!currentPath ? 'text-blue-300' : 'text-slate-400 hover:text-white'}`}
            >
              /
            </button>
            {pathParts.map((part, index) => (
              <span key={`${part}-${index}`} className="flex items-center gap-1">
                <span className="text-slate-600">/</span>
                <button
                  type="button"
                  onClick={() => goToPath(index)}
                  className={`rounded px-1 py-0.5 ${
                    index === pathParts.length - 1 ? 'text-blue-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {part}
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2">
          <button
            type="button"
            onClick={goUp}
            disabled={!currentPath || busy}
            className="rounded border border-slate-600 px-3 py-1 text-xs disabled:opacity-40"
          >
            Up
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="rounded border border-slate-600 px-3 py-1 text-xs disabled:opacity-40"
          >
            Refresh
          </button>
          {busy && <span className="text-xs text-slate-500">Loading…</span>}
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-auto px-4 py-3">
          {entries.length === 0 && !busy && !error ? (
            <p className="text-sm text-slate-500">This folder is empty.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                  <th className="pb-2 w-16">Kind</th>
                  <th className="pb-2">Name</th>
                  <th className="pb-2 w-36" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.name}
                    className="border-b border-slate-900 hover:bg-slate-800/50 cursor-pointer"
                    onDoubleClick={() => entry.isDir && openFolder(entry.name)}
                  >
                    <td className="py-2 pl-1">
                      <span className={`text-xs font-medium ${entry.isDir ? 'text-yellow-400' : 'text-slate-500'}`}>
                        {entry.isDir ? 'Folder' : 'File'}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-xs">{entry.name}</td>
                    <td className="py-2 text-xs text-slate-500">{entry.isDir ? 'Double-click to open' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
          Double-click a folder to open it. Use Up or the path links to go back.
        </div>
      </div>
    </div>
  );
}
