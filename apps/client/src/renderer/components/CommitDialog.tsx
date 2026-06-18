import { useMemo, useState } from 'react';
import { SVN_LABELS } from '@gms-svn/shared';
import type { SvnStatusEntry } from '../../preload/index';
import { useAuth } from '../context/AuthContext';
import { ModalShell } from './ModalShell';
const STATUS_LABELS: Record<string, string> = {
  M: 'Modified',
  A: 'Added',
  D: 'Deleted',
  C: 'Conflicted',
  '?': 'Unversioned',
  '!': 'Missing',
  L: 'Locked',
};

interface CommitDialogProps {
  workingCopyId: string;
  localPath: string;
  repoUrl: string;
  entries: SvnStatusEntry[];
  selectedPaths: string[];
  onClose: () => void;
  onCommitted: () => void;
  getAccessToken: () => Promise<string | null>;
}

export function CommitDialog({
  workingCopyId,
  localPath,
  repoUrl,
  entries,
  selectedPaths,
  onClose,
  onCommitted,
  getAccessToken,
}: CommitDialogProps) {
  const { auth } = useAuth();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authorLabel = useMemo(() => {
    if (!auth?.username) return 'Not signed in';
    return auth.email ? `${auth.username} <${auth.email}>` : auth.username;
  }, [auth?.username, auth?.email]);
  const filesToCommit = useMemo(() => {
    if (selectedPaths.length > 0) {
      return entries.filter((e) => selectedPaths.includes(e.path));
    }
    return entries.filter((e) => e.status !== '?');
  }, [entries, selectedPaths]);

  const commit = async () => {
    if (!message.trim()) {
      setError('Commit message is required.');
      return;
    }
    if (!auth?.svnPassword) {
      setError('SVN password not saved. Sign out and sign in again in GMS SVN CLIENT, then retry.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const result = await window.gmsClient.svn.commit({
        id: workingCopyId,
        message: message.trim(),
        accessToken: token,
        paths: selectedPaths.length > 0 ? selectedPaths : undefined,
      });
      if (!result.success) {
        setError(result.stderr.trim() || 'Commit failed');
        return;
      }
      onCommitted();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Commit failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={SVN_LABELS.commit}
      subtitle={localPath}
      onClose={onClose}
      widthClass="max-w-3xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 font-mono truncate">{repoUrl}</p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded border border-slate-600 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void commit()}
              disabled={busy || !message.trim() || filesToCommit.length === 0 || !auth?.svnPassword}
              className="rounded bg-blue-600 px-4 py-2 text-sm disabled:opacity-50"
            >
              {busy ? 'Committing…' : 'Commit'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Commit author: <span className="font-mono text-slate-300">{authorLabel}</span>
          {!auth?.svnPassword && auth?.username && (
            <span className="block text-amber-400/90 mt-1">Sign in again to refresh SVN credentials for this author.</span>
          )}
        </p>
        <div>          <label className="text-sm text-slate-300">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter a commit message"
            rows={4}
            autoFocus
            className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <p className="text-sm text-slate-300 mb-2">
            Changes ({filesToCommit.length} file{filesToCommit.length === 1 ? '' : 's'})
          </p>
          <div className="max-h-48 overflow-auto rounded border border-slate-700">
            {filesToCommit.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">No versioned changes to commit.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-950 sticky top-0">
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-2 w-12">Action</th>
                    <th className="px-3 py-2">Path</th>
                    <th className="px-3 py-2 w-28">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filesToCommit.map((entry) => (
                    <tr key={entry.path} className="border-t border-slate-800">
                      <td className="px-3 py-1.5 font-mono">{entry.status}</td>
                      <td className="px-3 py-1.5 font-mono">{entry.path}</td>
                      <td className="px-3 py-1.5 text-slate-400">{STATUS_LABELS[entry.status] ?? entry.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </ModalShell>
  );
}
