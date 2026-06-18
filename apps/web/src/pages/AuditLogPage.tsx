import { useCallback, useEffect, useState } from 'react';
import { api, type AuditLogEntry } from '../lib/api';
import { AUDIT_ACTION_OPTIONS, formatAuditAction } from '../lib/audit-labels';

export function AuditLogPage() {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [repos, setRepos] = useState<{ id: string; name: string }[]>([]);

  const [filters, setFilters] = useState({
    userId: '',
    action: '',
    repositoryId: '',
    from: '',
    to: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listAuditLogs({
        userId: filters.userId || undefined,
        action: filters.action || undefined,
        repositoryId: filters.repositoryId || undefined,
        from: filters.from ? new Date(filters.from).toISOString() : undefined,
        to: filters.to ? new Date(`${filters.to}T23:59:59`).toISOString() : undefined,
        page,
        limit: 50,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    api.listUsers().then((u) => setUsers(u.map((x) => ({ id: x.id, username: x.username }))));
    api.listRepositories().then((r) => setRepos(r.map((x) => ({ id: x.id, name: x.name }))));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      await api.downloadReport('audit-log.csv', {
        userId: filters.userId || undefined,
        action: filters.action || undefined,
        repositoryId: filters.repositoryId || undefined,
        from: filters.from ? new Date(filters.from).toISOString() : undefined,
        to: filters.to ? new Date(`${filters.to}T23:59:59`).toISOString() : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Who did what — login, permissions, SVN actions from client
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:border-slate-500 disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <FilterSelect
          label="User"
          value={filters.userId}
          onChange={(v) => {
            setPage(1);
            setFilters({ ...filters, userId: v });
          }}
          options={[{ value: '', label: 'All users' }, ...users.map((u) => ({ value: u.id, label: u.username }))]}
        />
        <FilterSelect
          label="Action"
          value={filters.action}
          onChange={(v) => {
            setPage(1);
            setFilters({ ...filters, action: v });
          }}
          options={[{ value: '', label: 'All actions' }, ...AUDIT_ACTION_OPTIONS]}
        />
        <FilterSelect
          label="Repository"
          value={filters.repositoryId}
          onChange={(v) => {
            setPage(1);
            setFilters({ ...filters, repositoryId: v });
          }}
          options={[{ value: '', label: 'All repos' }, ...repos.map((r) => ({ value: r.id, label: r.name }))]}
        />
        <label className="text-sm">
          <span className="text-slate-400">From</span>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => {
              setPage(1);
              setFilters({ ...filters, from: e.target.value });
            }}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-400">To</span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => {
              setPage(1);
              setFilters({ ...filters, to: e.target.value });
            }}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-800">
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2 pr-4">User</th>
              <th className="pb-2 pr-4">Action</th>
              <th className="pb-2 pr-4">Repository</th>
              <th className="pb-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-slate-500">
                  No audit events match your filters.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="border-b border-slate-800/50 align-top">
                  <td className="py-3 pr-4 whitespace-nowrap text-slate-400">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 pr-4">{row.username ?? '—'}</td>
                  <td className="py-3 pr-4">{formatAuditAction(row.action)}</td>
                  <td className="py-3 pr-4">{row.repositoryName ?? '—'}</td>
                  <td className="py-3 text-xs text-slate-500 font-mono max-w-xs truncate">
                    {row.sourceMachine ? `${row.sourceMachine} · ` : ''}
                    {row.metadata ? JSON.stringify(row.metadata) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
        <span>
          {total} event{total === 1 ? '' : 's'}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-2 py-1">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="text-sm">
      <span className="text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value || 'all'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
