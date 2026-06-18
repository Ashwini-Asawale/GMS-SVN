import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { IssuesTab } from '../components/repository/IssuesTab';
import { WikiTab } from '../components/repository/WikiTab';
import { ReviewsTab } from '../components/repository/ReviewsTab';
import { PipelineTab } from '../components/repository/PipelineTab';

import { BranchesTab } from '../components/repository/BranchesTab';

type Tab = 'access' | 'browse' | 'branches' | 'log' | 'issues' | 'wiki' | 'reviews' | 'pipeline';

export function RepositoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const [tab, setTab] = useState<Tab>('browse');
  const [repo, setRepo] = useState<Awaited<ReturnType<typeof api.getRepository>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rename, setRename] = useState('');

  const load = () => {
    if (!id) return;
    api.getRepository(id).then(setRepo).catch((e) => setError(e.message));
  };

  useEffect(load, [id]);

  useEffect(() => {
    if (repo) setRename(repo.name);
  }, [repo?.name]);

  const archive = async () => {
    if (!id || !confirm('Archive this repository?')) return;
    try {
      await api.updateRepository(id, { status: 'ARCHIVED' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Archive failed');
    }
  };

  const saveRename = async () => {
    if (!id || rename === repo?.name) return;
    try {
      await api.updateRepository(id, { name: rename.trim() });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rename failed');
    }
  };

  if (!repo) {
    return <p className="text-slate-500">{error ?? 'Loading…'}</p>;
  }

  return (
    <div>
      <Link to="/repositories" className="text-sm text-blue-400 hover:underline">
        ← Repositories
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{repo.name}</h1>
          <p className="text-slate-400 mt-1 text-sm font-mono">{repo.svnUrl ?? '—'}</p>
          <p className="text-slate-500 text-xs mt-1">
            Rev {repo.latestRevision ?? '—'} · {repo.sizeBytes ? `${repo.sizeBytes} B` : '—'} · {repo.status}
          </p>
        </div>
        {isAdmin && repo.status !== 'ARCHIVED' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => api.refreshRepository(id!).then(load).catch(console.error)}
              className="rounded border border-slate-600 px-3 py-1.5 text-sm"
            >
              Refresh status
            </button>
            <button
              type="button"
              onClick={archive}
              className="rounded border border-red-800 text-red-300 px-3 py-1.5 text-sm"
            >
              Archive
            </button>
          </div>
        )}
      </div>

      {isAdmin && repo.status !== 'ARCHIVED' && (
        <div className="mt-4 flex gap-2 max-w-md">
          <input
            value={rename}
            onChange={(e) => setRename(e.target.value)}
            className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm font-mono"
          />
          <button type="button" onClick={saveRename} className="rounded bg-slate-700 px-3 py-1.5 text-sm">
            Rename
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-8 flex gap-2 border-b border-slate-800 overflow-x-auto">
        {(
          [
            ['browse', 'Browse'],
            ['branches', 'Branches'],
            ['log', 'Log'],
            ['issues', 'Issues'],
            ['wiki', 'Wiki'],
            ['reviews', 'Reviews'],
            ['pipeline', 'Pipeline'],
            ['access', 'Access rules'],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm whitespace-nowrap ${tab === t ? 'border-b-2 border-blue-500 text-white' : 'text-slate-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'browse' && id && <BrowseTab repositoryId={id} svnUrl={repo.svnUrl ?? ''} />}
        {tab === 'branches' && id && (
          <BranchesTab
            repositoryId={id}
            repositoryName={repo.name}
            svnUrl={repo.svnUrl}
            isAdmin={isAdmin}
            onBranchCreated={load}
          />
        )}
        {tab === 'log' && id && <LogTab repositoryId={id} />}
        {tab === 'issues' && id && <IssuesTab repositoryId={id} />}
        {tab === 'wiki' && id && <WikiTab repositoryId={id} />}
        {tab === 'reviews' && id && <ReviewsTab repositoryId={id} isAdmin={isAdmin} />}
        {tab === 'pipeline' && id && <PipelineTab repositoryId={id} isAdmin={isAdmin} />}
        {tab === 'access' && id && (
          <AccessTab repositoryId={id} isAdmin={isAdmin} onChange={load} rules={repo.accessRules ?? []} />
        )}
      </div>
    </div>
  );
}

function BrowseTab({ repositoryId, svnUrl }: { repositoryId: string; svnUrl: string }) {
  const [path, setPath] = useState('/');
  const [entries, setEntries] = useState<{ name: string; kind: string }[]>([]);
  const [quickPaths, setQuickPaths] = useState<string[]>(['/']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pathParts = path === '/' ? [] : path.split('/').filter(Boolean);

  const displayUrl = useMemo(() => {
    const root = svnUrl.replace(/\/+$/, '');
    if (path === '/') return root;
    return `${root}${path}`;
  }, [svnUrl, path]);

  useEffect(() => {
    let cancelled = false;

    async function loadQuickPaths() {
      try {
        const rootData = await api.browseRepository(repositoryId, '/');
        const rootEntries = (rootData.entries as { name: string; kind: string }[]) ?? [];
        const paths = [
          '/',
          ...rootEntries.filter((e) => e.kind === 'dir').map((e) => `/${e.name}`),
        ];

        const hasBranches = rootEntries.some((e) => e.name === 'branches' && e.kind === 'dir');
        if (hasBranches) {
          try {
            const branchData = await api.browseRepository(repositoryId, '/branches');
            const branchEntries = (branchData.entries as { name: string; kind: string }[]) ?? [];
            paths.push(
              ...branchEntries
                .filter((e) => e.kind === 'dir')
                .map((e) => `/branches/${e.name}`),
            );
          } catch {
            // branches folder empty or unreadable
          }
        }

        if (!cancelled) setQuickPaths([...new Set(paths)]);
      } catch {
        if (!cancelled) setQuickPaths(['/']);
      }
    }

    void loadQuickPaths();
    return () => {
      cancelled = true;
    };
  }, [repositoryId]);

  useEffect(() => {
    setBusy(true);
    setError(null);
    api
      .browseRepository(repositoryId, path)
      .then((data) => {
        setEntries((data.entries as { name: string; kind: string }[]) ?? []);
      })
      .catch((e) => {
        setEntries([]);
        setError(e instanceof Error ? e.message : 'Could not browse repository');
      })
      .finally(() => setBusy(false));
  }, [repositoryId, path]);

  const enter = (name: string, kind: string) => {
    if (kind !== 'dir') return;
    setPath(path === '/' ? `/${name}` : `${path}/${name}`);
  };

  const goToPath = (index: number) => {
    if (index < 0) {
      setPath('/');
      return;
    }
    setPath(`/${pathParts.slice(0, index + 1).join('/')}`);
  };

  const up = () => {
    if (path === '/') return;
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    setPath(parts.length ? `/${parts.join('/')}` : '/');
  };

  return (
    <div>
      <div className="mb-4 space-y-2">
        <label className="text-xs text-slate-500">Repository URL</label>
        <input
          readOnly
          value={displayUrl}
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-blue-200"
        />
        <div className="flex flex-wrap items-center gap-1 text-sm font-mono">
          <button type="button" onClick={up} className="text-blue-400 mr-2" disabled={path === '/'}>
            ↑ Up
          </button>
          <button
            type="button"
            onClick={() => goToPath(-1)}
            className={`rounded px-1 ${path === '/' ? 'text-blue-300' : 'text-slate-400 hover:text-white'}`}
          >
            /
          </button>
          {pathParts.map((part, index) => (
            <span key={`${part}-${index}`} className="flex items-center gap-1">
              <span className="text-slate-600">/</span>
              <button
                type="button"
                onClick={() => goToPath(index)}
                className={`rounded px-1 ${
                  index === pathParts.length - 1 ? 'text-blue-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                {part}
              </button>
            </span>
          ))}
        </div>
        {quickPaths.length > 1 && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-slate-500">Quick:</span>
            {quickPaths.map((quickPath) => (
              <button
                key={quickPath}
                type="button"
                onClick={() => setPath(quickPath)}
                className={`rounded border px-2 py-0.5 font-mono hover:bg-slate-800 ${
                  path === quickPath
                    ? 'border-blue-600 text-blue-300'
                    : 'border-slate-700 text-blue-400'
                }`}
              >
                {quickPath}
              </button>
            ))}
          </div>
        )}
      </div>

      {busy && <p className="text-sm text-slate-500 mb-2">Loading…</p>}
      {error && (
        <p className="text-sm text-red-400 mb-2 whitespace-pre-wrap">
          {error}
          <span className="block text-slate-500 mt-1">
            This path may not exist in this repository. Use the breadcrumbs or ↑ Up to go back.
          </span>
        </p>
      )}

      <ul className="space-y-1">
        {entries.map((e) => (
          <li key={e.name}>
            {e.kind === 'dir' ? (
              <button
                type="button"
                onDoubleClick={() => enter(e.name, e.kind)}
                className="text-left text-sm hover:text-blue-400 font-mono w-full"
              >
                📁 {e.name}
                <span className="ml-2 text-xs text-slate-600">double-click to open</span>
              </button>
            ) : (
              <span className="text-sm font-mono text-slate-300">📄 {e.name}</span>
            )}
          </li>
        ))}
        {entries.length === 0 && !busy && !error && (
          <li className="text-slate-500 text-sm">Empty folder</li>
        )}
      </ul>
      <p className="mt-4 text-xs text-slate-500">
        Double-click folders to open them. Files are listed but not navigable.
      </p>
    </div>
  );
}

function LogTab({ repositoryId }: { repositoryId: string }) {
  const [path, setPath] = useState('/');
  const [entries, setEntries] = useState<
    {
      revision: number;
      author: string;
      authorEmail?: string | null;
      authorDisplay?: string;
      date: string;
      message: string;
      paths: { path: string; action: string }[];
    }[]
  >([]);
  const [selectedRev, setSelectedRev] = useState<number | null>(null);
  const [diff, setDiff] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBusy(true);
    setError(null);
    api
      .getRepositoryLog(repositoryId, path)
      .then((data) => {
        setEntries((data.entries as typeof entries) ?? []);
      })
      .catch((e) => {
        setEntries([]);
        setError(e instanceof Error ? e.message : 'Could not load log');
      })
      .finally(() => setBusy(false));
  }, [repositoryId, path]);

  const showDiff = async (revision: number, filePath: string) => {
    setSelectedRev(revision);
    const data = await api.getRepositoryDiff(repositoryId, filePath, revision);
    setDiff((data.diff as string) ?? '');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <label className="text-sm text-slate-400">
          Path
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-sm"
          />
        </label>
        {busy && <p className="mt-2 text-xs text-slate-500">Loading log…</p>}
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <ul className="mt-4 space-y-3 max-h-96 overflow-y-auto">
          {entries.map((e) => (
            <li key={e.revision} className="rounded border border-slate-800 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2 text-slate-400 text-xs">
                <span>r{e.revision}</span>
                <span className="font-mono text-slate-300" title={e.authorEmail ?? e.author}>
                  {e.authorDisplay ?? e.author ?? '(no author)'}
                </span>
                <span>{new Date(e.date).toLocaleString()}</span>
              </div>
              <p className="mt-1">{e.message}</p>
              <ul className="mt-2 text-xs font-mono text-slate-500">
                {e.paths?.map((p) => (
                  <li key={p.path}>
                    <button type="button" className="hover:text-blue-400" onClick={() => showDiff(e.revision, p.path)}>
                      {p.action} {p.path}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-medium text-slate-400">
          Diff {selectedRev != null ? `(r${selectedRev})` : ''}
        </h3>
        <pre className="mt-2 max-h-96 overflow-auto rounded border border-slate-800 bg-slate-950 p-3 text-xs font-mono whitespace-pre-wrap">
          {diff || 'Select a changed path to view diff'}
        </pre>
      </div>
    </div>
  );
}

function AccessTab({
  repositoryId,
  isAdmin,
  rules,
  onChange,
}: {
  repositoryId: string;
  isAdmin: boolean;
  rules: {
    id: string;
    path: string;
    principalType: string;
    principalName: string;
    access: string;
  }[];
  onChange: () => void;
}) {
  const [users, setUsers] = useState<{ username: string }[]>([]);
  const [groups, setGroups] = useState<{ name: string }[]>([]);
  const [form, setForm] = useState({
    path: '/trunk',
    principalType: 'GROUP' as 'USER' | 'GROUP',
    principalName: 'Developers',
    access: 'READ' as 'READ' | 'WRITE' | 'NONE',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      api.listUsers().then((u) => setUsers(u.map((x) => ({ username: x.username }))));
      api.listGroups().then((g) => setGroups(g.map((x) => ({ name: x.name }))));
    }
  }, [isAdmin]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createAccessRule(repositoryId, form);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const remove = async (ruleId: string) => {
    if (!confirm('Remove this access rule from VisualSVN?')) return;
    await api.deleteAccessRule(repositoryId, ruleId);
    onChange();
  };

  return (
    <div>
      <table className="w-full text-sm mb-8">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-800">
            <th className="pb-2">Path</th>
            <th className="pb-2">Principal</th>
            <th className="pb-2">Access</th>
            {isAdmin && <th className="pb-2" />}
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} className="border-b border-slate-800/50">
              <td className="py-2 font-mono">{r.path}</td>
              <td className="py-2">
                {r.principalType === 'GROUP' ? 'Group' : 'User'}: {r.principalName}
              </td>
              <td className="py-2">{r.access}</td>
              {isAdmin && (
                <td className="py-2 text-right">
                  <button type="button" onClick={() => remove(r.id)} className="text-red-400 text-xs">
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
          {rules.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-slate-500">
                No access rules yet
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {isAdmin && (
        <form onSubmit={save} className="max-w-lg space-y-3 rounded border border-slate-800 p-4">
          <h3 className="font-medium">Add access rule</h3>
          <Field label="Path" value={form.path} onChange={(v) => setForm({ ...form, path: v })} mono />
          <label className="block text-sm">
            <span className="text-slate-400">Principal type</span>
            <select
              value={form.principalType}
              onChange={(e) =>
                setForm({ ...form, principalType: e.target.value as 'USER' | 'GROUP', principalName: '' })
              }
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
            >
              <option value="GROUP">Group</option>
              <option value="USER">User</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Principal</span>
            <select
              value={form.principalName}
              onChange={(e) => setForm({ ...form, principalName: e.target.value })}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
              required
            >
              <option value="">Select…</option>
              {(form.principalType === 'GROUP' ? groups : users).map((p) => {
                const name = 'name' in p ? p.name : p.username;
                return (
                  <option key={name} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Access</span>
            <select
              value={form.access}
              onChange={(e) => setForm({ ...form, access: e.target.value as 'READ' | 'WRITE' | 'NONE' })}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
            >
              <option value="READ">Read</option>
              <option value="WRITE">Read / Write</option>
              <option value="NONE">No access</option>
            </select>
          </label>
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm">
            Save to VisualSVN
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 ${mono ? 'font-mono' : ''}`}
      />
    </label>
  );
}
