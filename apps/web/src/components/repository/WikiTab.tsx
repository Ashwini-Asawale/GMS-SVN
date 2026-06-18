import { useEffect, useState } from 'react';
import { api, type WikiPage } from '../../lib/api';

export function WikiTab({ repositoryId }: { repositoryId: string }) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [page, setPage] = useState<WikiPage | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ slug: '', title: '', content: '' });

  const loadList = () => {
    api.listWikiPages(repositoryId).then(setPages).catch((e) => setError(String(e)));
  };

  useEffect(() => {
    loadList();
  }, [repositoryId]);

  useEffect(() => {
    if (!selectedSlug) {
      setPage(null);
      return;
    }
    api
      .getWikiPage(repositoryId, selectedSlug)
      .then(setPage)
      .catch((e) => setError(String(e)));
  }, [repositoryId, selectedSlug]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.createWikiPage(repositoryId, {
        slug: form.slug.trim(),
        title: form.title.trim(),
        content: form.content,
      });
      setForm({ slug: '', title: '', content: '' });
      loadList();
      setSelectedSlug(created.slug);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create page');
    }
  };

  const save = async () => {
    if (!page) return;
    setError(null);
    try {
      const updated = await api.updateWikiPage(repositoryId, page.slug, {
        title: page.title,
        content: page.content,
      });
      setPage(updated);
      setEditing(false);
      loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside>
        <button
          type="button"
          onClick={() => {
            setSelectedSlug(null);
            setEditing(true);
            setPage(null);
          }}
          className="w-full rounded bg-blue-600 px-3 py-2 text-sm mb-3"
        >
          New page
        </button>
        <ul className="space-y-1 text-sm">
          {pages.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedSlug(p.slug);
                  setEditing(false);
                }}
                className={`w-full text-left rounded px-2 py-1.5 ${
                  selectedSlug === p.slug ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900'
                }`}
              >
                {p.title}
              </button>
            </li>
          ))}
          {pages.length === 0 && <li className="text-slate-500 text-xs px-2">No wiki pages yet</li>}
        </ul>
      </aside>

      <div>
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {editing && !page && (
          <form onSubmit={create} className="space-y-3 max-w-2xl">
            <h3 className="font-medium">New wiki page</h3>
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="slug (e.g. getting-started)"
              required
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono"
            />
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Title"
              required
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Markdown content"
              rows={12}
              required
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono"
            />
            <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm">
              Create page
            </button>
          </form>
        )}

        {page && !editing && (
          <div>
            <div className="flex justify-between items-start gap-4">
              <div>
                <h3 className="text-lg font-semibold">{page.title}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  /{page.slug} · updated by {page.updatedByUsername}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded border border-slate-600 px-3 py-1 text-sm"
              >
                Edit
              </button>
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded border border-slate-800 bg-slate-950 p-4 text-sm">
              {page.content}
            </pre>
          </div>
        )}

        {page && editing && (
          <div className="space-y-3 max-w-2xl">
            <input
              value={page.title}
              onChange={(e) => setPage({ ...page, title: e.target.value })}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <textarea
              value={page.content}
              onChange={(e) => setPage({ ...page, content: e.target.value })}
              rows={14}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono"
            />
            <div className="flex gap-2">
              <button type="button" onClick={save} className="rounded bg-blue-600 px-4 py-2 text-sm">
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded border border-slate-600 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!editing && !page && !selectedSlug && pages.length > 0 && (
          <p className="text-slate-500 text-sm">Select a page from the sidebar.</p>
        )}
      </div>
    </div>
  );
}
