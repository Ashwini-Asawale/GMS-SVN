import { useEffect, useState } from 'react';
import { api, type ApiUser } from '../lib/api';

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  members: { id: string; user: { id: string; username: string } }[];
};

export function GroupsPage() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [addMember, setAddMember] = useState<Record<string, string>>({});

  const load = async () => {
    const [g, u] = await Promise.all([api.listGroups(), api.listUsers()]);
    setGroups(g);
    setUsers(u);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createGroup({ name, description: description || undefined });
    setName('');
    setDescription('');
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Groups</h1>

      <form onSubmit={createGroup} className="mt-6 flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <span className="text-slate-400">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-400">Description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm">
          Add group
        </button>
      </form>

      <div className="mt-8 space-y-6">
        {groups.map((g) => (
          <div key={g.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-medium">{g.name}</h2>
                {g.description && <p className="text-sm text-slate-400 mt-1">{g.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => api.deleteGroup(g.id).then(load)}
                className="text-sm text-red-400 hover:underline"
              >
                Delete
              </button>
            </div>

            <ul className="mt-4 space-y-1 text-sm">
              {g.members.map((m) => (
                <li key={m.id} className="flex justify-between">
                  <span>{m.user.username}</span>
                  <button
                    type="button"
                    onClick={() => api.removeGroupMember(g.id, m.user.id).then(load)}
                    className="text-blue-400 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
              {g.members.length === 0 && <li className="text-slate-500">No members</li>}
            </ul>

            <div className="mt-4 flex gap-2">
              <select
                value={addMember[g.id] ?? ''}
                onChange={(e) => setAddMember({ ...addMember, [g.id]: e.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="">Add member...</option>
                {users
                  .filter((u) => !g.members.some((m) => m.user.id === u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={!addMember[g.id]}
                onClick={() =>
                  api.addGroupMember(g.id, addMember[g.id]!).then(() => {
                    setAddMember({ ...addMember, [g.id]: '' });
                    load();
                  })
                }
                className="rounded-lg bg-slate-700 px-3 py-2 text-sm disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
