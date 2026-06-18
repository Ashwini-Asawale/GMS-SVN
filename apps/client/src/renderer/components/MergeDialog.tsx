import { useMemo, useState } from 'react';
import { SVN_LABELS } from '@gms-svn/shared';
import { resolveRepositoryRootUrl } from '../lib/repo-url';
import { ModalShell } from './ModalShell';

interface MergeDialogProps {
  workingCopyId: string;
  localPath: string;
  repoUrl: string;
  repositoryName: string;
  onClose: () => void;
  onSuccess: (detail: string) => void;
  getAccessToken: () => Promise<string | null>;
}

export function MergeDialog({
  workingCopyId,
  localPath,
  repoUrl,
  repositoryName,
  onClose,
  onSuccess,
  getAccessToken,
}: MergeDialogProps) {
  const [sourceUrl, setSourceUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const root = useMemo(
    () => resolveRepositoryRootUrl(repoUrl, repositoryName),
    [repoUrl, repositoryName],
  );

  const submit = async () => {
    const url = sourceUrl.trim();
    if (!url) {
      setError('Enter the merge source URL (branch to merge from).');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const result = await window.gmsClient.svn.merge({
        id: workingCopyId,
        sourceUrl: url,
        accessToken: token,
      });
      if (!result.success) {
        setError(result.stderr.trim() || 'Merge failed');
        return;
      }
      const detail = result.stdout.trim() || result.stderr.trim() || 'Merge completed';
      onSuccess(detail);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merge failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={SVN_LABELS.merge}
      subtitle={localPath}
      onClose={onClose}
      widthClass="max-w-2xl"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded border border-slate-600 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !sourceUrl.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-sm disabled:opacity-50"
          >
            {busy ? 'Merging…' : 'Merge'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-slate-400 text-xs">
          Merge changes from another branch into this working copy, then review and commit.
        </p>
        <p className="text-slate-500 font-mono text-xs break-all">Working copy URL: {repoUrl}</p>

        <label className="block">
          <span className="text-slate-300">Merge from URL</span>
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder={`${root}/branches/my-feature`}
            className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-xs"
            autoFocus
          />
        </label>

        <div className="rounded border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-500 space-y-1">
          <p>Examples:</p>
          <button
            type="button"
            className="block text-left text-blue-400 hover:underline font-mono"
            onClick={() => setSourceUrl(`${root}/branches/my-feature`)}
          >
            {root}/branches/my-feature
          </button>
          <button
            type="button"
            className="block text-left text-blue-400 hover:underline font-mono"
            onClick={() => setSourceUrl(`${root}/trunk`)}
          >
            {root}/trunk
          </button>
        </div>

        {error && <p className="text-red-400">{error}</p>}
      </div>
    </ModalShell>
  );
}
