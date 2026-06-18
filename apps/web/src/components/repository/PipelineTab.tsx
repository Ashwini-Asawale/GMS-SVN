import { useEffect, useState } from 'react';
import { api, type PipelineBuild, type PipelineConfig } from '../../lib/api';

export function PipelineTab({
  repositoryId,
  isAdmin,
}: {
  repositoryId: string;
  isAdmin: boolean;
}) {
  const [config, setConfig] = useState<PipelineConfig | null>(null);
  const [builds, setBuilds] = useState<PipelineBuild[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    enabled: false,
    webhookUrl: '',
    webhookSecret: '',
    triggerPaths: '/trunk',
    triggerBranches: 'trunk',
  });

  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([api.getPipelineConfig(repositoryId), api.listPipelineBuilds(repositoryId)])
      .then(([cfg, b]) => {
        setConfig(cfg);
        setBuilds(b);
        setForm({
          enabled: cfg.enabled,
          webhookUrl: cfg.webhookUrl ?? '',
          webhookSecret: '',
          triggerPaths: cfg.triggerPaths.join(', '),
          triggerBranches: cfg.triggerBranches.join(', '),
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [repositoryId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('save');
    setError(null);
    try {
      await api.updatePipelineConfig(repositoryId, {
        enabled: form.enabled,
        webhookUrl: form.webhookUrl.trim() || null,
        webhookSecret: form.webhookSecret.trim() || undefined,
        triggerPaths: form.triggerPaths.split(',').map((s) => s.trim()).filter(Boolean),
        triggerBranches: form.triggerBranches.split(',').map((s) => s.trim()).filter(Boolean),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(null);
    }
  };

  const installHook = async () => {
    setBusy('hook');
    setError(null);
    try {
      await api.installPipelineHook(repositoryId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Install failed');
    } finally {
      setBusy(null);
    }
  };

  const simulate = async () => {
    setBusy('sim');
    setError(null);
    try {
      await api.simulatePipeline(repositoryId, { revision: (builds[0]?.revision ?? 0) + 1 });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulate failed');
    } finally {
      setBusy(null);
    }
  };

  if (loading && !config) {
    return <p className="text-slate-500">Loading pipeline…</p>;
  }

  if (error && !config) {
    return (
      <div className="rounded border border-red-900/50 bg-red-950/30 p-4 text-sm">
        <p className="text-red-400">{error}</p>
        <p className="text-slate-400 mt-2">
          Restart the API after running <code className="font-mono">npm run db:migrate</code> and{' '}
          <code className="font-mono">npm run db:generate</code> (stop dev:api first if generate fails).
        </p>
        <button type="button" onClick={load} className="mt-3 text-blue-400 text-sm hover:underline">
          Retry
        </button>
      </div>
    );
  }

  if (!config) {
    return null;
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="font-medium">CI pipeline config</h3>
        <p className="text-sm text-slate-400 mt-1">
          Post-commit hook notifies this API, which triggers your external runner (Jenkins, Azure DevOps, etc.).
        </p>

        {isAdmin ? (
          <form onSubmit={save} className="mt-4 max-w-xl space-y-3 rounded border border-slate-800 p-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              Enable pipeline for this repository
            </label>
            <Field
              label="Webhook URL"
              value={form.webhookUrl}
              onChange={(v) => setForm({ ...form, webhookUrl: v })}
              placeholder="https://jenkins.example.com/generic-webhook-trigger/..."
            />
            <Field
              label="Webhook secret (leave blank to keep current)"
              value={form.webhookSecret}
              onChange={(v) => setForm({ ...form, webhookSecret: v })}
              type="password"
            />
            <Field
              label="Trigger paths (comma-separated)"
              value={form.triggerPaths}
              onChange={(v) => setForm({ ...form, triggerPaths: v })}
              mono
            />
            <Field
              label="Trigger branches (comma-separated)"
              value={form.triggerBranches}
              onChange={(v) => setForm({ ...form, triggerBranches: v })}
              mono
            />
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={busy === 'save'}
                className="rounded bg-blue-600 px-4 py-2 text-sm disabled:opacity-50"
              >
                {busy === 'save' ? 'Saving…' : 'Save config'}
              </button>
              <button
                type="button"
                onClick={installHook}
                disabled={busy === 'hook'}
                className="rounded border border-slate-600 px-4 py-2 text-sm disabled:opacity-50"
              >
                {busy === 'hook' ? 'Installing…' : 'Install post-commit hook'}
              </button>
              <button
                type="button"
                onClick={simulate}
                disabled={busy === 'sim' || !form.enabled}
                className="rounded border border-slate-600 px-4 py-2 text-sm disabled:opacity-50"
              >
                {busy === 'sim' ? 'Triggering…' : 'Simulate commit hook'}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Hook script: <code className="font-mono">infra/hooks/gms-svn-post-commit.ps1</code>
              {config.hookInstalled ? ' · Installed' : ' · Not installed'}
            </p>
          </form>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Pipeline {config.enabled ? 'enabled' : 'disabled'}
            {config.hookInstalled ? ' · Hook installed' : ''}
          </p>
        )}
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <section>
        <h3 className="font-medium">Build history</h3>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-800">
              <th className="pb-2">Revision</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Duration</th>
              <th className="pb-2">Triggered</th>
              <th className="pb-2">Log</th>
            </tr>
          </thead>
          <tbody>
            {builds.map((b) => (
              <tr key={b.id} className="border-b border-slate-800/50">
                <td className="py-2 font-mono">r{b.revision}</td>
                <td className="py-2">
                  <BuildBadge status={b.status} />
                </td>
                <td className="py-2">{b.durationMs != null ? `${b.durationMs} ms` : '—'}</td>
                <td className="py-2 text-slate-400">{new Date(b.triggeredAt).toLocaleString()}</td>
                <td className="py-2">
                  {b.logUrl ? (
                    <a href={b.logUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                      View
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {builds.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-slate-500">
                  No builds yet. Enable the pipeline and commit to SVN, or use Simulate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {builds.some((b) => b.errorMessage) && (
          <p className="mt-2 text-xs text-red-400">
            Latest error: {builds.find((b) => b.errorMessage)?.errorMessage}
          </p>
        )}
      </section>
    </div>
  );
}

function BuildBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    QUEUED: 'bg-slate-800 text-slate-300',
    RUNNING: 'bg-blue-900/50 text-blue-300',
    SUCCESS: 'bg-green-900/50 text-green-300',
    FAILED: 'bg-red-900/50 text-red-300',
    SKIPPED: 'bg-slate-800 text-slate-400',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs uppercase ${styles[status] ?? styles.QUEUED}`}>
      {status}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  mono,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 ${mono ? 'font-mono text-xs' : ''}`}
      />
    </label>
  );
}
