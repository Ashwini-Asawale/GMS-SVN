import { Navigate, Routes, Route } from 'react-router-dom';
import { PRODUCT_NAMES } from '@gms-svn/shared';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { WorkingCopyPage } from './pages/WorkingCopyPage';

export default function App() {
  const { auth, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Loading {PRODUCT_NAMES.client}…
      </div>
    );
  }

  if (!window.gmsClient) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center text-red-400">
        Client bridge failed to load. Rebuild with npm run build:client and try again.
      </div>
    );
  }

  if (!auth) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">{PRODUCT_NAMES.client}</p>
          <p className="text-sm font-medium">{auth.username}</p>
        </div>
      </header>
      <main className="flex-1 p-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/wc/:id" element={<WorkingCopyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
