import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { SVN_LABELS } from '@gms-svn/shared';
import type { SvnStatusEntry, WorkingCopy } from '../../preload/index';
import { useAuth } from '../context/AuthContext';
import { CommitDialog } from '../components/CommitDialog';
import { OutputDialog } from '../components/OutputDialog';
import { RepoBrowserDialog } from '../components/RepoBrowserDialog';
import { BranchTagDialog } from '../components/BranchTagDialog';
import { MergeDialog } from '../components/MergeDialog';
import { SwitchDialog } from '../components/SwitchDialog';

const STATUS_COLORS: Record<string, string> = {
  M: 'text-yellow-400',
  A: 'text-green-400',
  D: 'text-red-400',
  C: 'text-orange-400',
  '?': 'text-slate-400',
  '!': 'text-red-300',
  L: 'text-blue-400',
};

const STATUS_LABELS: Record<string, string> = {
  M: 'Modified',
  A: 'Added',
  D: 'Deleted',
  C: 'Conflicted',
  '?': 'Unversioned',
  '!': 'Missing',
  L: 'Locked',
};

type OutputView = { title: string; content: string } | null;

export function WorkingCopyPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const explorerActionHandled = useRef(false);
  const { getAccessToken } = useAuth();

  const [wc, setWc] = useState<WorkingCopy | null>(null);
  const [entries, setEntries] = useState<SvnStatusEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [showCommit, setShowCommit] = useState(false);
  const [showRepoBrowser, setShowRepoBrowser] = useState(false);
  const [showBranchTag, setShowBranchTag] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [outputView, setOutputView] = useState<OutputView>(null);

  const load = async () => {
    const list = await window.gmsClient.workingCopies.list();
    setWc(list.find((x) => x.id === id) ?? null);
  };

  const refreshStatus = useCallback(async () => {
    if (!id) return;
    setBusy(true);
    setToast(null);
    try {
      const result = await window.gmsClient.svn.status({ id });
      if (result.entries) setEntries(result.entries);
      if (!result.success) setToast(result.stderr || 'Status failed');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Status failed');
    } finally {
      setBusy(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    void refreshStatus();
  }, [id, refreshStatus]);

  const selectedPaths = useMemo(() => [...selected], [selected]);
  const selectedPath = selectedPaths.length === 1 ? selectedPaths[0] : undefined;
  const selectedEntry = useMemo(
    () => (selectedPath ? entries.find((e) => e.path === selectedPath) : undefined),
    [entries, selectedPath],
  );

  const runCommand = useCallback(
    async (
      title: string,
      fn: (token: string) => Promise<{ success: boolean; stdout: string; stderr: string }>,
      options?: { refresh?: boolean; showOutput?: boolean },
    ) => {
      setBusy(true);
      setToast(null);
      try {
        const token = await getAccessToken();
        if (!token) return;
        const result = await fn(token);
        const body = result.stdout.trim() || result.stderr.trim();
        if (!result.success) {
          setToast(result.stderr.trim() || `${title} failed`);
          if (options?.showOutput !== false && body) {
            setOutputView({ title, content: body });
          }
          return;
        }
        if (options?.showOutput !== false && body) {
          setOutputView({ title, content: body });
        } else if (options?.showOutput === false) {
          setToast(`${title} completed`);
        }
        if (options?.refresh !== false) {
          await refreshStatus();
          await load();
        }
      } catch (e) {
        setToast(e instanceof Error ? e.message : `${title} failed`);
      } finally {
        setBusy(false);
      }
    },
    [getAccessToken, refreshStatus],
  );

  const openRepoBrowser = useCallback(() => {
    setShowRepoBrowser(true);
  }, []);

  const openCommit = useCallback(() => setShowCommit(true), []);

  const showCommandOutput = useCallback((title: string, detail: string) => {
    setOutputView({ title, content: detail });
    void refreshStatus();
    void load();
  }, [refreshStatus]);

  const handleExplorerAction = useCallback(
    (action: string) => {
      switch (action) {
        case 'repobrowser':
          openRepoBrowser();
          break;
        case 'commit':
          openCommit();
          break;
        case 'branchtag':
          setShowBranchTag(true);
          break;
        case 'merge':
          setShowMerge(true);
          break;
        case 'switch':
          setShowSwitch(true);
          break;
        case 'status':
          void refreshStatus();
          break;
        case 'update':
          void runCommand(SVN_LABELS.update, (t) =>
            window.gmsClient.svn.update({ id: id!, accessToken: t }),
          );
          break;
        case 'add':
          if (selectedEntry?.status === '?') {
            void runCommand(SVN_LABELS.add, (t) =>
              window.gmsClient.svn.add({ id: id!, path: selectedEntry.path, accessToken: t }),
            );
          } else {
            setToast('Select an unversioned file (?) to add.');
          }
          break;
        case 'diff':
          void runCommand(SVN_LABELS.diff, (t) =>
            window.gmsClient.svn.diff({ id: id!, accessToken: t, path: selectedPath }),
          );
          break;
        case 'log':
          void runCommand(SVN_LABELS.log, (t) =>
            window.gmsClient.svn.log({ id: id!, accessToken: t, limit: 50 }),
          );
          break;
        default:
          break;
      }
    },
    [id, openCommit, openRepoBrowser, refreshStatus, runCommand, selectedEntry, selectedPath],
  );

  useEffect(() => {
    if (!wc || explorerActionHandled.current) return;
    const action = searchParams.get('explorerAction');
    if (!action) return;

    explorerActionHandled.current = true;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('explorerAction');
        next.delete('fromExplorer');
        next.delete('wcPath');
        return next;
      },
      { replace: true },
    );

    handleExplorerAction(action);
  }, [wc, searchParams, setSearchParams, handleExplorerAction]);

  const toggleSelect = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(entries.map((e) => e.path)));

  if (!wc) {
    return <p className="text-slate-500">Working copy not found</p>;
  }

  return (
    <div className="max-w-5xl mx-auto pb-6">
      <Link to="/" className="text-sm text-blue-400 hover:underline">
        ← Working copies
      </Link>

      {/* Tortoise-style "Check for modifications" window */}
      <div className="mt-4 rounded-lg border border-slate-600 bg-slate-900 shadow-lg overflow-hidden">
        <div className="border-b border-slate-700 bg-slate-800/80 px-4 py-3">
          <h1 className="text-base font-semibold">{SVN_LABELS.status}</h1>
          <p className="text-xs font-mono text-slate-300 mt-1">{wc.localPath}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-700 text-xs">
          <div className="bg-slate-900 px-4 py-2">
            <span className="text-slate-500">URL: </span>
            <span className="font-mono text-blue-300/90 break-all">{wc.svnUrl}</span>
          </div>
          <div className="bg-slate-900 px-4 py-2">
            <span className="text-slate-500">Revision: </span>
            <span className="font-mono">{wc.lastRevision ?? '—'}</span>
            <span className="text-slate-500 ml-4">Repository: </span>
            <span>{wc.repositoryName}</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2 bg-slate-950/50">
          <p className="text-xs text-slate-500">
            M=Modified · A=Added · D=Deleted · ?=Unversioned · C=Conflict
          </p>
          <button type="button" className="text-xs text-blue-400 hover:underline" onClick={selectAll}>
            Select all
          </button>
        </div>

        <div className="min-h-[280px] max-h-[420px] overflow-auto">
          {entries.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">No local changes</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-950 text-xs text-slate-500">
                <tr className="border-b border-slate-800">
                  <th className="w-10 px-3 py-2" />
                  <th className="w-12 px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Path</th>
                  <th className="w-32 px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.path}
                    className={`border-b border-slate-800/80 hover:bg-slate-800/40 cursor-pointer ${
                      selected.has(entry.path) ? 'bg-blue-950/30' : ''
                    }`}
                    onClick={() => toggleSelect(entry.path)}
                    onDoubleClick={() => {
                      if (entry.status === '?') return;
                      void runCommand(SVN_LABELS.diff, (t) =>
                        window.gmsClient.svn.diff({ id: wc.id, accessToken: t, path: entry.path }),
                      );
                    }}
                  >
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={selected.has(entry.path)}
                        onChange={() => toggleSelect(entry.path)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded"
                      />
                    </td>
                    <td className={`px-3 py-1.5 font-mono font-bold ${STATUS_COLORS[entry.status] ?? 'text-slate-300'}`}>
                      {entry.status}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs">{entry.path}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-400">
                      {STATUS_LABELS[entry.status] ?? entry.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Branch / merge row (Tortoise-style) */}
        <div className="border-t border-slate-800 bg-slate-950/40 px-4 py-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 mr-1">Branching:</span>
          <SecondaryButton label={SVN_LABELS.branchTag} disabled={busy} onClick={() => setShowBranchTag(true)} />
          <SecondaryButton label={SVN_LABELS.merge} disabled={busy} onClick={() => setShowMerge(true)} />
          <SecondaryButton label={SVN_LABELS.switch} disabled={busy} onClick={() => setShowSwitch(true)} />
        </div>

        {/* Tortoise-style bottom button row */}
        <div className="border-t border-slate-700 bg-slate-800/50 px-4 py-3 flex flex-wrap gap-2">
          <PrimaryButton label="Commit…" disabled={busy} onClick={openCommit} />
          <PrimaryButton
            label={SVN_LABELS.add}
            disabled={busy || selectedEntry?.status !== '?'}
            onClick={() =>
              runCommand(SVN_LABELS.add, (t) =>
                window.gmsClient.svn.add({ id: wc.id, path: selectedEntry!.path, accessToken: t }),
              )
            }
          />
          <PrimaryButton
            label={SVN_LABELS.revert}
            disabled={busy || !selectedPath}
            onClick={() => {
              if (!selectedPath || !confirm(`Revert ${selectedPath}?`)) return;
              void runCommand(SVN_LABELS.revert, (t) =>
                window.gmsClient.svn.revert({ id: wc.id, accessToken: t, path: selectedPath }),
              );
            }}
          />
          <PrimaryButton
            label={SVN_LABELS.update}
            disabled={busy}
            onClick={() =>
              runCommand(SVN_LABELS.update, (t) => window.gmsClient.svn.update({ id: wc.id, accessToken: t }))
            }
          />
          <PrimaryButton
            label={SVN_LABELS.diff}
            disabled={busy || !selectedPath}
            onClick={() =>
              runCommand(SVN_LABELS.diff, (t) =>
                window.gmsClient.svn.diff({ id: wc.id, accessToken: t, path: selectedPath }),
              )
            }
          />
          <PrimaryButton
            label={SVN_LABELS.log}
            disabled={busy}
            onClick={() =>
              runCommand(SVN_LABELS.log, (t) => window.gmsClient.svn.log({ id: wc.id, accessToken: t, limit: 50 }))
            }
          />
          <SecondaryButton label={SVN_LABELS.repoBrowser} disabled={busy} onClick={openRepoBrowser} />
          <SecondaryButton label="More…" disabled={busy} onClick={() => setShowMore(true)} />
          <div className="flex-1" />
          <SecondaryButton label="Refresh" disabled={busy} onClick={() => void refreshStatus()} />
        </div>
      </div>

      {toast && (
        <div className="mt-3 rounded border border-amber-700/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
          {toast}
        </div>
      )}

      {showCommit && (
        <CommitDialog
          workingCopyId={wc.id}
          localPath={wc.localPath}
          repoUrl={wc.svnUrl}
          entries={entries}
          selectedPaths={selectedPaths}
          onClose={() => setShowCommit(false)}
          onCommitted={() => {
            void refreshStatus();
            void load();
          }}
          getAccessToken={getAccessToken}
        />
      )}

      {showRepoBrowser && (
        <RepoBrowserDialog
          workingCopyId={wc.id}
          repoName={wc.repositoryName}
          repoUrl={wc.svnUrl}
          onClose={() => setShowRepoBrowser(false)}
          getAccessToken={getAccessToken}
        />
      )}

      {showBranchTag && (
        <BranchTagDialog
          workingCopyId={wc.id}
          localPath={wc.localPath}
          repoUrl={wc.svnUrl}
          repositoryName={wc.repositoryName}
          sourcePath={selectedPath}
          onClose={() => setShowBranchTag(false)}
          onSuccess={(detail) => showCommandOutput(SVN_LABELS.branchTag, detail)}
          getAccessToken={getAccessToken}
        />
      )}

      {showMerge && (
        <MergeDialog
          workingCopyId={wc.id}
          localPath={wc.localPath}
          repoUrl={wc.svnUrl}
          repositoryName={wc.repositoryName}
          onClose={() => setShowMerge(false)}
          onSuccess={(detail) => showCommandOutput(SVN_LABELS.merge, detail)}
          getAccessToken={getAccessToken}
        />
      )}

      {showSwitch && (
        <SwitchDialog
          workingCopyId={wc.id}
          localPath={wc.localPath}
          repoUrl={wc.svnUrl}
          repositoryName={wc.repositoryName}
          onClose={() => setShowSwitch(false)}
          onSuccess={(detail) => showCommandOutput(SVN_LABELS.switch, detail)}
          onReload={() => {
            void load();
            void refreshStatus();
          }}
          getAccessToken={getAccessToken}
        />
      )}

      {outputView && (
        <OutputDialog
          title={outputView.title}
          subtitle={wc.localPath}
          repoUrl={wc.svnUrl}
          localPath={wc.localPath}
          content={outputView.content}
          onClose={() => setOutputView(null)}
        />
      )}

      {showMore && (
        <MoreActionsDialog
          wc={wc}
          selectedPath={selectedPath}
          busy={busy}
          onClose={() => setShowMore(false)}
          onRun={runCommand}
        />
      )}
    </div>
  );
}

function PrimaryButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-slate-500 bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600 disabled:opacity-40 min-w-[88px]"
    >
      {label}
    </button>
  );
}

function SecondaryButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-slate-600 px-3 py-1.5 text-sm hover:border-slate-500 disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function MoreActionsDialog({
  wc,
  selectedPath,
  busy,
  onClose,
  onRun,
}: {
  wc: WorkingCopy;
  selectedPath?: string;
  busy: boolean;
  onClose: () => void;
  onRun: (
    title: string,
    fn: (token: string) => Promise<{ success: boolean; stdout: string; stderr: string }>,
    options?: { refresh?: boolean; showOutput?: boolean },
  ) => Promise<void>;
}) {
  const [switchUrl, setSwitchUrl] = useState(wc.svnUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-lg border border-slate-600 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h2 className="font-semibold">More SVN actions</h2>
          <button type="button" onClick={onClose} className="text-sm border border-slate-600 rounded px-3 py-1">
            Close
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-2 text-sm">
          <MoreBtn
            label={SVN_LABELS.cleanup}
            disabled={busy}
            onClick={() => void onRun(SVN_LABELS.cleanup, (t) => window.gmsClient.svn.cleanup({ id: wc.id, accessToken: t }))}
          />
          <MoreBtn
            label={SVN_LABELS.blame}
            disabled={busy || !selectedPath}
            onClick={() =>
              void onRun(SVN_LABELS.blame, (t) =>
                window.gmsClient.svn.blame({ id: wc.id, accessToken: t, path: selectedPath }),
              )
            }
          />
          <MoreBtn
            label={SVN_LABELS.lock}
            disabled={busy || !selectedPath}
            onClick={() =>
              void onRun(SVN_LABELS.lock, (t) =>
                window.gmsClient.svn.lock({ id: wc.id, path: selectedPath!, accessToken: t }),
              )
            }
          />
          <MoreBtn
            label={SVN_LABELS.unlock}
            disabled={busy || !selectedPath}
            onClick={() =>
              void onRun(SVN_LABELS.unlock, (t) =>
                window.gmsClient.svn.unlock({ id: wc.id, path: selectedPath!, accessToken: t }),
              )
            }
          />
          <MoreBtn
            label={SVN_LABELS.resolve}
            disabled={busy || !selectedPath}
            onClick={() =>
              void onRun(SVN_LABELS.resolve, (t) =>
                window.gmsClient.svn.resolve({
                  id: wc.id,
                  path: selectedPath!,
                  accept: 'working',
                  accessToken: t,
                }),
              )
            }
          />
          <MoreBtn
            label={SVN_LABELS.delete}
            disabled={busy || !selectedPath}
            onClick={() => {
              if (!selectedPath || !confirm(`Mark ${selectedPath} for deletion?`)) return;
              void onRun(SVN_LABELS.delete, (t) =>
                window.gmsClient.svn.delete({ id: wc.id, path: selectedPath, accessToken: t }),
              );
            }}
          />
          <MoreBtn
            label={SVN_LABELS.export}
            disabled={busy}
            onClick={async () => {
              const target = await window.gmsClient.system.selectFolder();
              if (!target) return;
              void onRun(SVN_LABELS.export, (t) =>
                window.gmsClient.svn.export({ id: wc.id, targetPath: target, accessToken: t }),
              );
            }}
          />
        </div>
        <div className="border-t border-slate-700 px-4 py-3 space-y-2">
          <p className="text-xs text-slate-500">{SVN_LABELS.switch}</p>
          <div className="flex gap-2">
            <input
              value={switchUrl}
              onChange={(e) => setSwitchUrl(e.target.value)}
              className="flex-1 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs font-mono"
            />
            <button
              type="button"
              disabled={busy || !switchUrl.trim()}
              className="rounded border border-slate-600 px-3 py-1 text-xs disabled:opacity-40"
              onClick={() =>
                void onRun(SVN_LABELS.switch, (t) =>
                  window.gmsClient.svn.switch({ id: wc.id, url: switchUrl.trim(), accessToken: t }),
                )
              }
            >
              Switch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoreBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-slate-600 px-3 py-2 text-left text-sm hover:bg-slate-800 disabled:opacity-40"
    >
      {label}
    </button>
  );
}
