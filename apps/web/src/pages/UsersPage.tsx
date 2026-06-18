import { useEffect, useState } from 'react';
import { api, type ApiUser } from '../lib/api';

export function UsersPage() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', email: '', password: '', isAdmin: false });

  const load = () => api.listUsers().then(setUsers).catch((e) => setError(String(e)));

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.createUser(form);
      setForm({ username: '', email: '', password: '', isAdmin: false });
      load();
    } catch (err) {
      setError(String(err));
    }
  };

  const toggleActive = async (user: ApiUser) => {
    await api.updateUser(user.id, { isActive: !user.isActive });
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Users</h1>

      <form onSubmit={handleCreate} className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
        <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
        <label className="flex items-center gap-2 text-sm pb-2">
          <input
            type="checkbox"
            checked={form.isAdmin}
            onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })}
          />
          Admin
        </label>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
          Add user
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-800">
            <th className="pb-2">Username</th>
            <th className="pb-2">Email</th>
            <th className="pb-2">Groups</th>
            <th className="pb-2">Admin</th>
            <th className="pb-2">Status</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-slate-800/50">
              <td className="py-3">{u.username}</td>
              <td className="py-3">{u.email}</td>
              <td className="py-3">{u.groups?.map((g) => g.name).join(', ') || '—'}</td>
              <td className="py-3">{u.isAdmin ? 'Yes' : 'No'}</td>
              <td className="py-3">{u.isActive ? 'Active' : 'Disabled'}</td>
              <td className="py-3">
                <button
                  type="button"
                  onClick={() => toggleActive(u)}
                  className="text-blue-400 hover:underline"
                >
                  {u.isActive ? 'Disable' : 'Enable'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-slate-400">{label}</span>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-blue-500"
      />
    </label>
  );
}
