import { NavLink } from 'react-router-dom';
import { PRODUCT_NAMES } from '@gms-svn/shared';
import { useAuth } from '../context/AuthContext';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`;

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-slate-800 bg-slate-900 p-4 flex flex-col">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-slate-500">{PRODUCT_NAMES.webAdmin}</p>
          <p className="font-semibold text-sm mt-1">{user?.username}</p>
          {user?.isAdmin && (
            <span className="text-xs text-blue-400">Administrator</span>
          )}
        </div>

        <nav className="space-y-1 flex-1">
          <NavLink to="/" end className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/repositories" className={linkClass}>
            Repositories
          </NavLink>
          {user?.isAdmin && (
            <>
              <NavLink to="/users" className={linkClass}>
                Users
              </NavLink>
              <NavLink to="/groups" className={linkClass}>
                Groups
              </NavLink>
              <NavLink to="/settings" className={linkClass}>
                Settings
              </NavLink>
              <NavLink to="/audit" className={linkClass}>
                Audit Log
              </NavLink>
              <NavLink to="/reports" className={linkClass}>
                Reports
              </NavLink>
            </>
          )}
        </nav>

        <button
          type="button"
          onClick={() => logout()}
          className="mt-4 text-left text-sm text-slate-400 hover:text-white"
        >
          Sign out
        </button>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
