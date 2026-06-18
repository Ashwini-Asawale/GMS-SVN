import { useMemo, useState } from 'react';
import { SVN_LABELS } from '@gms-svn/shared';
import { buildBranchUrl, buildTagUrl, resolveRepositoryRootUrl } from '../lib/repo-url';
import { ModalShell } from './ModalShell';

type BranchTagKind = 'branch' | 'tag';

interface BranchTagDialogProps {
  workingCopyId: string;
  localPath: string;
  repoUrl: string;
  repositoryName: string;
  sourcePath?: string;
  onClose: () => void;
  onSuccess: (detail: string) => void;
  getAccessToken: () => Promise<string | null>;
}

export function BranchTagDialog({
  workingCopyId,
  localPath,
  repoUrl,
  repositoryName,
  sourcePath,
  onClose,
  onSuccess,
  getAccessToken,
}: BranchTagDialogProps) {
  const [kind, setKind] = useState<BranchTagKind>('branch');
  const [name, setName] = useState('');
  const [destUrl, setDestUrl] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const repoRootUrl = useMemo(
    () => resolveRepositoryRootUrl(repoUrl, repositoryName),
    [repoUrl, repositoryName],
  );

  const suggestedUrl = useMemo(() => {
    if (!name.trim()) return '';
    return kind === 'branch' ? buildBranchUrl(repoRootUrl, name) : buildTagUrl(repoRootUrl, name);
  }, [repoRootUrl, kind, name]);

  const effectiveDestUrl = destUrl.trim() || suggestedUrl;

  const submit = async () => {
    if (!name.trim()) {
      setError('Enter a branch or tag name.');
      return;
    }
    if (!effectiveDestUrl) {
      setError('Destination URL is required.');
      return;
    }
    if (!message.trim()) {
      setError('Log message is required.');
      return;
    }
    if (!effectiveDestUrl.toLowerCase().startsWith(repoRootUrl.toLowerCase())) {
      setError(`Destination must be under repository root:\n${repoRootUrl}`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const result = await window.gmsClient.svn.copy({
        id: workingCopyId,
        destUrl: effectiveDestUrl,
        message: message.trim(),
        accessToken: token,
        sourcePath,
      });
      if (!result.success) {
        setError(result.stderr.trim() || 'Branch/tag failed');
        return;
      }
      onSuccess(result.stdout.trim() || `Created ${kind} at ${effectiveDestUrl}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Branch/tag failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={SVN_LABELS.branchTag}
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
            disabled={busy}
            className="rounded bg-blue-600 px-4 py-2 text-sm disabled:opacity-50"
          >
            {busy ? 'Creating…' : kind === 'branch' ? SVN_LABELS.branch : SVN_LABELS.tag}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-slate-400 font-mono text-xs break-all">Copy from (working copy): {repoUrl}</p>
        <p className="text-slate-500 font-mono text-xs break-all">Repository root: {repoRootUrl}</p>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="branchTagKind"
              checked={kind === 'branch'}
              onChange={() => {
                setKind('branch');
                setDestUrl('');
              }}
            />
            {SVN_LABELS.branch}
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="branchTagKind"
              checked={kind === 'tag'}
              onChange={() => {
                setKind('tag');
                setDestUrl('');
              }}
            />
            {SVN_LABELS.tag}
          </label>
        </div>

        <label className="block">
          <span className="text-slate-300">Name</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDestUrl('');
            }}
            placeholder={kind === 'branch' ? 'ashwini' : 'release-1.0'}
            className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-xs"
          />
        </label>

        <label className="block">
          <span className="text-slate-300">Destination URL</span>
          <input
            value={destUrl || suggestedUrl}
            onChange={(e) => setDestUrl(e.target.value)}
            placeholder={suggestedUrl || `${repoRootUrl}/${kind === 'branch' ? 'branches' : 'tags'}/name`}
            className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-xs"
          />
        </label>

        <label className="block">
          <span className="text-slate-300">Log message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={kind === 'branch' ? 'Create branch ashwini' : 'Tag release-1.0'}
            rows={3}
            className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
          />
        </label>

        {sourcePath && (
          <p className="text-xs text-slate-500">Source path in working copy: {sourcePath}</p>
        )}

        <p className="text-xs text-slate-500">
          Branches and tags are always created under the repository root ({repoRootUrl}/branches/… or …/tags/…).
        </p>

        {error && <p className="text-red-400 whitespace-pre-wrap">{error}</p>}
      </div>
    </ModalShell>
  );
}
