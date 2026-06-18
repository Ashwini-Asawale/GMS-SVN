import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PRODUCT_NAMES } from '@gms-svn/shared';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const explorerAction = searchParams.get('explorerAction');
  const fromExplorer = searchParams.get('fromExplorer') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      await login({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        username: res.user.username,
        email: res.user.email,
        svnPassword: password,
        isAdmin: res.user.isAdmin,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-8">
        <h1 className="text-xl font-bold">{PRODUCT_NAMES.client}</h1>
        <p className="text-slate-400 text-sm mt-1">
          {fromExplorer
            ? `Sign in to continue${explorerAction ? ` (${explorerAction} from Explorer)` : ''}`
            : 'Sign in to access your SVN repositories'}
        </p>
        {fromExplorer && (
          <p className="text-amber-400/90 text-xs mt-2">
            You opened an SVN action from Windows Explorer. Sign in below, then run the action again.
          </p>
        )}
        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block text-sm">
            <span className="text-slate-400">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dev1@gms.local"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              required
              autoFocus
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              required
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-xs text-slate-500">Demo: dev1@gms.local / dev123</p>
      </div>
    </div>
  );
}
