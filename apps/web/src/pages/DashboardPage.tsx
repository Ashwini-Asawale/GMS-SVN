import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { PRODUCT_NAMES } from '@gms-svn/shared';
import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<{
    userCount: number;
    groupCount: number;
    repoCount: number;
    latestRevision: { repository: string; revision: number } | null;
    pipelineFailedBuilds?: number;
    pipelineRunningBuilds?: number;
  } | null>(null);

  useEffect(() => {
    api.dashboardStats().then(setStats).catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-slate-400 mt-1">
        {user?.isAdmin ? 'Administrator view' : 'Read-only view'} — connects to {PRODUCT_NAMES.server}
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Users" value={stats?.userCount ?? '—'} />
        <StatCard label="Groups" value={stats?.groupCount ?? '—'} />
        <StatCard label="Repositories" value={stats?.repoCount ?? '—'} />
      </div>

      <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="font-medium">Latest revision</h2>
        <p className="mt-2 text-sm text-slate-400">
          {stats?.latestRevision
            ? `${stats.latestRevision.repository} — r${stats.latestRevision.revision}`
            : 'No repository data yet (Phase 3+ sync from GMS SVN SERVER)'}
        </p>
      </section>

      {(stats?.pipelineFailedBuilds != null || stats?.pipelineRunningBuilds != null) && (
        <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="font-medium">Build automation</h2>
          <p className="mt-2 text-sm text-slate-400">
            {stats.pipelineRunningBuilds ?? 0} running ·{' '}
            <span className={stats.pipelineFailedBuilds ? 'text-red-400' : ''}>
              {stats.pipelineFailedBuilds ?? 0} failed
            </span>
          </p>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-3xl font-semibold mt-1">{value}</p>
    </div>
  );
}
