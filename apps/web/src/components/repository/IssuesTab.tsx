import { useEffect, useState } from 'react';
import { api, type RepoIssue } from '../../lib/api';

const COLUMNS: { status: RepoIssue['status']; label: string }[] = [
  { status: 'OPEN', label: 'Open' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'CLOSED', label: 'Closed' },
];

export function IssuesTab({ repositoryId }: { repositoryId: string }) {
  const [issues, setIssues] = useState<RepoIssue[]>([]);
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'NORMAL' as 'LOW' | 'NORMAL' | 'HIGH',
    assigneeId: '',
  });

  const load = () => {
    api.listIssues(repositoryId).then(setIssues).catch((e) => setError(String(e)));
  };

  useEffect(() => {
    load();
    api.listUsers().then((u) => setUsers(u.map((x) => ({ id: x.id, username: x.username })))).catch(() => setUsers([]));
  }, [repositoryId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createIssue(repositoryId, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        assigneeId: form.assigneeId || undefined,
      });
      setForm({ title: '', description: '', priority: 'NORMAL', assigneeId: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create issue');
    }
  };

  const moveIssue = async (issue: RepoIssue, status: RepoIssue['status']) => {
    if (issue.status === status) return;
    try {
      await api.updateIssue(repositoryId, issue.id, { status });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update issue');
    }
  };

  return (
    <div>
      <form onSubmit={create} className="mb-8 max-w-xl space-y-3 rounded border border-slate-800 p-4">
        <h3 className="font-medium">New issue</h3>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Title"
          required
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Description (optional)"
          rows={3}
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-3">
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as 'LOW' | 'NORMAL' | 'HIGH' })}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </select>
          <select
            value={form.assigneeId}
            onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm">
            Create
          </button>
        </div>
      </form>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => (
          <div key={col.status} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 min-h-[200px]">
            <h4 className="text-sm font-medium text-slate-400 mb-3">{col.label}</h4>
            <ul className="space-y-2">
              {issues
                .filter((i) => i.status === col.status)
                .map((issue) => (
                  <li key={issue.id} className="rounded border border-slate-800 bg-slate-950 p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">
                        #{issue.number} {issue.title}
                      </span>
                      <span className="text-xs text-slate-500 shrink-0">{issue.priority}</span>
                    </div>
                    {issue.description && (
                      <p className="mt-1 text-slate-400 text-xs line-clamp-2">{issue.description}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                      {issue.assigneeUsername ? `@${issue.assigneeUsername}` : 'Unassigned'} ·{' '}
                      {issue.createdByUsername}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {COLUMNS.filter((c) => c.status !== issue.status).map((c) => (
                        <button
                          key={c.status}
                          type="button"
                          onClick={() => moveIssue(issue, c.status)}
                          className="text-xs text-blue-400 hover:underline"
                        >
                          → {c.label}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
