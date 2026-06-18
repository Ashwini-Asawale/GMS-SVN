import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SVN_LABELS } from '@gms-svn/shared';
import type { WorkingCopy } from '../../preload/index';
import { api, type ClientRepo } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function HomePage() {
  const { auth, getAccessToken, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [repos, setRepos] = useState<ClientRepo[]>([]);
  const [workingCopies, setWorkingCopies] = useState<WorkingCopy[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<ClientRepo | null>(null);
  const [localPath, setLocalPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [svnPath, setSvnPath] = useState('');
  const [svnBundled, setSvnBundled] = useState(false);
  const [svnAvailable, setSvnAvailable] = useState(true);
  const [svnMock, setSvnMock] = useState(false);

  const load = async () => {
    const token = await getAccessToken();
    if (!token) return;
    const [r, wc] = await Promise.all([
      api.clientRepos(token),
      window.gmsClient.workingCopies.list(),
    ]);
    setRepos(r);
    setWorkingCopies(wc);
  };

  useEffect(() => {
    load().catch(console.error);
    Promise.all([
      window.gmsClient.system.svnExePath(),
      window.gmsClient.system.svnIsBundled(),
      window.gmsClient.system.svnIsAvailable(),
      window.gmsClient.system.svnIsMockMode(),
    ]).then(([path, bundled, available, mock]) => {
      setSvnPath(path);
      setSvnBundled(bundled);
      setSvnAvailable(available);
      setSvnMock(mock);
    });
  }, []);

  useEffect(() => {
    const checkoutPath = searchParams.get('checkoutPath');
    if (checkoutPath) {
      setLocalPath(checkoutPath);
    }
  }, [searchParams]);

  useEffect(() => {
    const wcPath = searchParams.get('wcPath');
    if (!wcPath || workingCopies.length === 0) return;

    const match = workingCopies.find(
      (wc) => wc.localPath.toLowerCase() === wcPath.toLowerCase(),
    );
    if (match) {
      const query = searchParams.toString();
      navigate(query ? `/wc/${match.id}?${query}` : `/wc/${match.id}`, { replace: true });
    }
  }, [searchParams, workingCopies, navigate]);

  const pickFolder = async () => {
    const folder = await window.gmsClient.system.selectFolder();
    if (folder) setLocalPath(folder);
  };

  const checkout = async () => {
    if (!selectedRepo?.svnUrl || !localPath) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const result = await window.gmsClient.svn.checkout({
        url: selectedRepo.svnUrl,
        localPath,
        repositoryName: selectedRepo.name,
        accessToken: token,
      });
      if (!result.success) throw new Error(result.stderr || 'Checkout failed');
      await load();
      setSelectedRepo(null);
      setLocalPath('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  };

  const removeWc = async (id: string) => {
    await window.gmsClient.workingCopies.remove(id);
    await load();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Working copies</h1>
          <p className="text-slate-400 text-sm mt-1">
            SVN engine:{' '}
            {svnBundled ? 'bundled with GMS SVN CLIENT (no TortoiseSVN needed)' : svnPath}
          </p>
        </div>
        <button type="button" onClick={() => logout()} className="text-sm text-slate-400 hover:text-white">
          Sign out ({auth?.username})
        </button>
      </div>

      {(svnMock || !svnAvailable) && (
        <div className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
          {svnMock ? (
            <p>
              SVN mock mode is on (dev only). Reinstall from GMS-SVN-CLIENT-Setup.exe on client PCs —
              TortoiseSVN is not required.
            </p>
          ) : (
            <p>
              SVN engine missing from this install. Reinstall from the latest GMS-SVN-CLIENT-Setup.exe.
              TortoiseSVN is not required on client PCs.
            </p>
          )}
        </div>
      )}

      {workingCopies.length === 0 ? (
        <p className="text-slate-500">No working copies yet. Checkout a repository below.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-800">
              <th className="pb-2">Repository</th>
              <th className="pb-2">Local path</th>
              <th className="pb-2">Revision</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {workingCopies.map((wc) => (
              <tr key={wc.id} className="border-b border-slate-800/50">
                <td className="py-3">
                  <Link to={`/wc/${wc.id}`} className="text-blue-400 hover:underline">
                    {wc.repositoryName}
                  </Link>
                </td>
                <td className="py-3 font-mono text-xs">{wc.localPath}</td>
                <td className="py-3">{wc.lastRevision ?? '—'}</td>
                <td className="py-3 text-right">
                  <button type="button" onClick={() => removeWc(wc.id)} className="text-xs text-red-400">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section className="rounded-lg border border-slate-800 p-4">
        <h2 className="font-semibold">{SVN_LABELS.checkout}</h2>
        <p className="text-sm text-slate-400 mt-1">Repositories you can access (VisualSVN enforces permissions on commit)</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-slate-400">Repository</span>
            <select
              value={selectedRepo?.id ?? ''}
              onChange={(e) => setSelectedRepo(repos.find((r) => r.id === e.target.value) ?? null)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
            >
              <option value="">Select…</option>
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.svnUrl ? `(${r.svnUrl})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-400">Local folder</span>
            <div className="mt-1 flex gap-2">
              <input
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
                placeholder="C:\Projects\my-repo"
              />
              <button type="button" onClick={pickFolder} className="rounded border border-slate-600 px-3 text-sm">
                Browse
              </button>
            </div>
          </label>
        </div>

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        <button
          type="button"
          onClick={checkout}
          disabled={busy || !selectedRepo?.svnUrl || !localPath}
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy ? 'Checking out…' : SVN_LABELS.checkout}
        </button>
      </section>
    </div>
  );
}
