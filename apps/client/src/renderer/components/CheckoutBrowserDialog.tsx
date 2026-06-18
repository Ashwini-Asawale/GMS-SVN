import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type ClientRepoBrowseEntry } from '../lib/api';
import { joinRepoUrlPath } from '../lib/repo-url';

export interface CheckoutBrowserSelection {
  url: string;
  path: string;
  folderName: string;
}

interface CheckoutBrowserDialogProps {
  repositoryId: string;
  repoName: string;
  repoRootUrl: string;
  initialPath?: string;
  onSelect: (selection: CheckoutBrowserSelection) => void;
  onClose: () => void;
  getAccessToken: () => Promise<string | null>;
}

function folderNameFromPath(repoPath: string, repositoryName: string): string {
  if (!repoPath || repoPath === '/') return repositoryName;
  const parts = repoPath.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? repositoryName;
}

export function CheckoutBrowserDialog({
  repositoryId,
  repoName,
  repoRootUrl,
  initialPath = '/',
  onSelect,
  onClose,
  getAccessToken,
}: CheckoutBrowserDialogProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || '/');
  const [entries, setEntries] = useState<ClientRepoBrowseEntry[]>([]);
  const [currentUrl, setCurrentUrl] = useState(repoRootUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pathParts = useMemo(() => {
    if (!currentPath || currentPath === '/') return [];
    return currentPath.replace(/^\/+/, '').split('/').filter(Boolean);
  }, [currentPath]);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const data = await api.clientBrowseRepository(token, repositoryId, currentPath);
      setEntries(data.entries);
      setCurrentUrl(data.url);
    } catch (e) {
      setEntries([]);
      setError(e instanceof Error ? e.message : 'Could not browse repository');
    } finally {
      setBusy(false);
    }
  }, [currentPath, getAccessToken, repositoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const goUp = () => {
    if (!pathParts.length) return;
    const next = pathParts.slice(0, -1);
    setCurrentPath(next.length ? `/${next.join('/')}` : '/');
  };

  const openFolder = (name: string) => {
    const next =
      !currentPath || currentPath === '/'
        ? `/${name}`
        : `${currentPath.replace(/\/+$/, '')}/${name}`;
    setCurrentPath(next);
  };

  const goToPath = (index: number) => {
    if (index < 0) {
      setCurrentPath('/');
      return;
    }
    setCurrentPath(`/${pathParts.slice(0, index + 1).join('/')}`);
  };

  const confirm = () => {
    onSelect({
      url: currentUrl,
      path: currentPath,
      folderName: folderNameFromPath(currentPath, repoName),
    });
  };

  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }),
    [entries],
  );

  const folderCount = sortedEntries.filter((e) => e.kind === 'dir').length;
  const fileCount = sortedEntries.length - folderCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="flex w-full max-w-4xl flex-col rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
        style={{ minHeight: '480px', maxHeight: '88vh' }}
      >
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-lg font-semibold">Repository Browser</h2>
          <p className="text-xs text-slate-400">Select folder to checkout (like TortoiseSVN)</p>
        </div>

        <div className="border-b border-slate-800 px-4 py-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="text-sm block">
              <span className="text-slate-400">URL</span>
              <input
                readOnly
                value={currentUrl}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-blue-200"
              />
            </label>
            <label className="text-sm block sm:w-28">
              <span className="text-slate-400">Revision</span>
              <input
                readOnly
                value="HEAD"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => goToPath(-1)}
              className={`rounded px-2 py-0.5 ${currentPath === '/' ? 'text-blue-300' : 'text-slate-400 hover:text-white'}`}
            >
              {repoName}
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
            disabled={currentPath === '/' || busy}
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

        <div className="flex-1 overflow-auto px-4 py-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                <th className="pb-2 w-20">Kind</th>
                <th className="pb-2">File</th>
                <th className="pb-2 w-40 hidden sm:table-cell">Path</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((entry) => {
                const entryPath =
                  currentPath === '/'
                    ? `/${entry.name}`
                    : `${currentPath.replace(/\/+$/, '')}/${entry.name}`;
                return (
                  <tr
                    key={entry.name}
                    className="border-b border-slate-900 hover:bg-slate-800/60 cursor-pointer"
                    onDoubleClick={() => entry.kind === 'dir' && openFolder(entry.name)}
                    onClick={() => entry.kind === 'dir' && openFolder(entry.name)}
                  >
                    <td className="py-2 pl-1">
                      <span className={`text-xs font-medium ${entry.kind === 'dir' ? 'text-yellow-400' : 'text-slate-500'}`}>
                        {entry.kind === 'dir' ? 'Folder' : 'File'}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-xs">{entry.name}</td>
                    <td className="py-2 font-mono text-xs text-slate-500 hidden sm:table-cell">
                      {joinRepoUrlPath(repoRootUrl, entryPath.replace(/^\/+/, ''))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!busy && sortedEntries.length === 0 && !error && (
            <p className="py-4 text-sm text-slate-500">This folder is empty.</p>
          )}
        </div>

        <div className="border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
          Showing {fileCount} file{fileCount === 1 ? '' : 's'} and {folderCount} folder
          {folderCount === 1 ? '' : 's'}, {sortedEntries.length} item{sortedEntries.length === 1 ? '' : 's'} in total
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy || !!error}
            className="rounded bg-blue-600 px-4 py-2 text-sm disabled:opacity-50"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
