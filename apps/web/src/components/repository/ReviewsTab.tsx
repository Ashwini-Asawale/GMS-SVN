import { useEffect, useState } from 'react';
import { api, type ReviewRequest } from '../../lib/api';

export function ReviewsTab({
  repositoryId,
  isAdmin,
}: {
  repositoryId: string;
  isAdmin: boolean;
}) {
  const [reviews, setReviews] = useState<ReviewRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    svnPath: '/trunk',
    revision: '',
    description: '',
  });
  const [note, setNote] = useState('');

  const load = () => {
    api.listReviewRequests(repositoryId).then(setReviews).catch((e) => setError(String(e)));
  };

  useEffect(() => {
    load();
  }, [repositoryId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createReviewRequest(repositoryId, {
        title: form.title.trim(),
        svnPath: form.svnPath.trim(),
        revision: form.revision ? Number(form.revision) : undefined,
        description: form.description.trim() || undefined,
      });
      setForm({ title: '', svnPath: '/trunk', revision: '', description: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create review');
    }
  };

  const decide = async (reviewId: string, status: 'APPROVED' | 'REJECTED') => {
    setError(null);
    try {
      await api.decideReviewRequest(repositoryId, reviewId, { status, reviewNote: note.trim() || undefined });
      setNote('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit decision');
    }
  };

  return (
    <div>
      <form onSubmit={create} className="mb-8 max-w-xl space-y-3 rounded border border-slate-800 p-4">
        <h3 className="font-medium">Request SVN review</h3>
        <p className="text-xs text-slate-500">
          Ask an admin to review changes at a path/revision before merge (uses log/diff from Browse tab).
        </p>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Title"
          required
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <input
          value={form.svnPath}
          onChange={(e) => setForm({ ...form, svnPath: e.target.value })}
          placeholder="SVN path"
          required
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono"
        />
        <input
          value={form.revision}
          onChange={(e) => setForm({ ...form, revision: e.target.value })}
          placeholder="Revision (optional)"
          type="number"
          min={1}
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Notes for reviewer"
          rows={2}
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm">
          Submit request
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <ul className="space-y-4">
        {reviews.map((r) => (
          <li key={r.id} className="rounded border border-slate-800 p-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  {r.svnPath}
                  {r.revision != null ? ` @ r${r.revision}` : ''}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>
            {r.description && <p className="mt-2 text-slate-400">{r.description}</p>}
            <p className="mt-2 text-xs text-slate-500">
              Requested by {r.requesterUsername} · {new Date(r.createdAt).toLocaleString()}
            </p>
            {r.reviewNote && (
              <p className="mt-2 text-xs text-slate-400">
                Review note ({r.reviewerUsername}): {r.reviewNote}
              </p>
            )}
            {isAdmin && r.status === 'PENDING' && (
              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-800 pt-3">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Review note (optional)"
                  className="flex-1 min-w-[200px] rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => decide(r.id, 'APPROVED')}
                  className="rounded bg-green-800 px-3 py-1.5 text-xs"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => decide(r.id, 'REJECTED')}
                  className="rounded bg-red-900 px-3 py-1.5 text-xs"
                >
                  Reject
                </button>
              </div>
            )}
          </li>
        ))}
        {reviews.length === 0 && <li className="text-slate-500">No review requests yet.</li>}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-900/50 text-amber-300',
    APPROVED: 'bg-green-900/50 text-green-300',
    REJECTED: 'bg-red-900/50 text-red-300',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs uppercase ${styles[status] ?? styles.PENDING}`}>
      {status}
    </span>
  );
}
