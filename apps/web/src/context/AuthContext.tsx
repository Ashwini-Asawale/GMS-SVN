import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type ApiUser } from '../lib/api';

interface AuthContextValue {
  user: ApiUser | null;
  loading: boolean;
  login: (tenantSlug: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.loadFromStorage();
    api.setOnUnauthorized(() => {
      api.clearStorage();
      setUser(null);
    });

    const token = localStorage.getItem('accessToken');
    if (token) {
      api
        .me()
        .then(setUser)
        .catch(() => api.clearStorage())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (tenantSlug: string, email: string, password: string) => {
    const res = await api.login(tenantSlug, email, password);
    api.setTokens(res.accessToken, res.refreshToken);
    api.setStoredTenantSlug(tenantSlug);
    api.saveToStorage();
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      api.clearStorage();
      setUser(null);
    }
  };

  const refreshUser = async () => {
    const me = await api.me();
    setUser(me);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
