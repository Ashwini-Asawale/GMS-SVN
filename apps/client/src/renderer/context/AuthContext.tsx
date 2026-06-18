import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { StoredAuth } from '../../preload/index';

interface AuthContextValue {
  auth: StoredAuth | null;
  loading: boolean;
  login: (auth: StoredAuth) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!window.gmsClient) {
      setLoading(false);
      return;
    }
    window.gmsClient.auth.load().then(async (stored) => {
      if (stored) {
        const flushed = await window.gmsClient.audit.flush(stored.accessToken).catch(() => 0);
        if (flushed > 0) console.info(`Flushed ${flushed} queued audit events`);
        setAuth(stored);
      }
      setLoading(false);
    });
  }, []);

  const login = async (next: StoredAuth) => {
    await window.gmsClient.auth.save(next);
    await window.gmsClient.audit.flush(next.accessToken).catch(() => 0);
    setAuth(next);
  };

  const logout = async () => {
    await window.gmsClient.auth.clear();
    setAuth(null);
  };

  const getAccessToken = useCallback(async () => {
    const current = auth ?? (await window.gmsClient.auth.load());
    if (!current) return null;

    const apiBase = await window.gmsClient.settings.getApiBaseUrl();
    const res = await fetch(`${apiBase}/auth/me`, {
      headers: { Authorization: `Bearer ${current.accessToken}` },
    });

    if (res.ok) return current.accessToken;

    const refreshed = await window.gmsClient.auth.refresh(current.refreshToken);
    if (!refreshed) {
      await logout();
      return null;
    }

    const updated = { ...current, accessToken: refreshed };
    await window.gmsClient.auth.save(updated);
    setAuth(updated);
    return refreshed;
  }, [auth]);

  return (
    <AuthContext.Provider value={{ auth, loading, login, logout, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
