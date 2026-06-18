import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { PRODUCT_NAMES, SVN_LABELS } from '@gms-svn/shared';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Internal server error') || msg.includes('500')) {
        setError('Server/database not ready. Start Docker Desktop, run npm run docker:up, then npm run db:seed.');
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setError('Cannot reach API. Run npm run dev on the server and open http://localhost:3001/health');
      } else {
        setError('Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <p className="text-xs uppercase tracking-widest text-slate-500">{PRODUCT_NAMES.webAdmin}</p>
        <h1 className="mt-1 text-2xl font-semibold">{PRODUCT_NAMES.platform}</h1>
        <p className="mt-2 text-sm text-slate-400">Sign in to manage users and repositories</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm">
            <span className="text-slate-300">Email</span>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@gms.local"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-blue-500"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-300">Password</span>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-blue-500"
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-500">
          Demo: admin@gms.local / admin123 · dev1@gms.local / dev123
        </p>
        <p className="mt-2 text-xs text-slate-600">
          {SVN_LABELS.checkout}, {SVN_LABELS.update}, {SVN_LABELS.commit}
        </p>
      </div>
    </div>
  );
}
