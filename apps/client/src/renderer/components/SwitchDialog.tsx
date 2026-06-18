import { useMemo, useState } from 'react';
import { SVN_LABELS } from '@gms-svn/shared';
import { resolveRepositoryRootUrl } from '../lib/repo-url';
import { ModalShell } from './ModalShell';

interface SwitchDialogProps {
  workingCopyId: string;
  localPath: string;
  repoUrl: string;
  repositoryName: string;  onClose: () => void;
  onSuccess: (detail: string) => void;
  onReload: () => void;
  getAccessToken: () => Promise<string | null>;
}

export function SwitchDialog({
  workingCopyId,
  localPath,
  repoUrl,
  repositoryName,
  onClose,
  onSuccess,
  onReload,
  getAccessToken,
}: SwitchDialogProps) {
  const [targetUrl, setTargetUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const root = useMemo(
    () => resolveRepositoryRootUrl(repoUrl, repositoryName),
    [repoUrl, repositoryName],
  );
  const submit = async () => {
    const url = targetUrl.trim();
    if (!url) {
      setError('Enter the branch/tag URL to switch to.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const result = await window.gmsClient.svn.switch({
        id: workingCopyId,
        url,
        accessToken: token,
      });
      if (!result.success) {
        setError(result.stderr.trim() || 'Switch failed');
        return;
      }
      onReload();
      onSuccess(result.stdout.trim() || `Switched to ${url}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Switch failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={SVN_LABELS.switch}
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
            disabled={busy || !targetUrl.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-sm disabled:opacity-50"
          >
            {busy ? 'Switching…' : 'Switch'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-slate-400 text-xs">
          Switch this working copy to a different branch or tag URL (same repository).
        </p>
        <p className="text-slate-500 font-mono text-xs break-all">Current URL: {repoUrl}</p>

        <label className="block">
          <span className="text-slate-300">Switch to URL</span>
          <input
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder={`${root}/branches/my-feature`}
            className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-xs"
            autoFocus
          />
        </label>

        <div className="rounded border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-500 space-y-1">
          <p>Quick pick:</p>
          <button
            type="button"
            className="block text-left text-blue-400 hover:underline font-mono"
            onClick={() => setTargetUrl(root)}
          >
            {root}
          </button>
          <button
            type="button"
            className="block text-left text-blue-400 hover:underline font-mono"
            onClick={() => setTargetUrl(`${root}/trunk`)}
          >
            {root}/trunk
          </button>
          <button
            type="button"
            className="block text-left text-blue-400 hover:underline font-mono"
            onClick={() => setTargetUrl(`${root}/branches/my-feature`)}
          >
            {root}/branches/my-feature
          </button>
        </div>

        {error && <p className="text-red-400">{error}</p>}
      </div>
    </ModalShell>
  );
}
