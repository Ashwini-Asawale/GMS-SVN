import { useEffect, useState } from 'react';
import type { PlatformStorageSettings, StorageConnectionTestResult } from '@gms-svn/shared';
import { PRODUCT_NAMES } from '@gms-svn/shared';
import { api } from '../lib/api';

const emptyForm: PlatformStorageSettings = {
  gmsSvnServerHost: '',
  visualsvnUrl: '',
  visualsvnRepoRoot: '',
  storageBackend: 'iscsi',
  storageBackupPath: '',
  storageReportsPath: '',
  storageAttachmentsPath: '',
  storageLogsPath: '',
};

export function SettingsPage() {
  const [form, setForm] = useState<PlatformStorageSettings>(emptyForm);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<StorageConnectionTestResult | null>(null);

  useEffect(() => {
    api.getSettings().then(setForm).catch(console.error);
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = await api.updateSettings(form);
    setForm(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testStorageConnection();
      setTestResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-slate-400 mt-1 text-sm">
        {PRODUCT_NAMES.server} storage and VisualSVN configuration (Phase 2)
      </p>

      <form onSubmit={save} className="mt-8 max-w-2xl space-y-8">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">{PRODUCT_NAMES.server}</h2>
          <Field
            label="Server hostname"
            hint="DNS name of the Windows Server running VisualSVN"
            value={form.gmsSvnServerHost}
            onChange={(v) => setForm({ ...form, gmsSvnServerHost: v })}
          />
          <Field
            label="VisualSVN URL"
            hint="HTTPS base URL for SVN (e.g. https://gms-svn-server.local/svn)"
            value={form.visualsvnUrl}
            onChange={(v) => setForm({ ...form, visualsvnUrl: v })}
          />
          <Field
            label="Repository root path"
            hint="Local or iSCSI-mounted path on GMS SVN SERVER (e.g. D:\SVN\Repositories)"
            value={form.visualsvnRepoRoot}
            onChange={(v) => setForm({ ...form, visualsvnRepoRoot: v })}
          />
          <label className="block text-sm">
            <span className="text-slate-400">Repository storage backend</span>
            <select
              value={form.storageBackend}
              onChange={(e) =>
                setForm({ ...form, storageBackend: e.target.value as PlatformStorageSettings['storageBackend'] })
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-blue-500"
            >
              <option value="iscsi">iSCSI block volume (recommended)</option>
              <option value="smb">SMB network share (requires sign-off)</option>
            </select>
          </label>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">NAS storage paths</h2>
          <p className="text-sm text-slate-500">
            UNC paths on GMS-NAS for backups, reports, attachments, and log exports.
          </p>
          <Field
            label="Backup path"
            value={form.storageBackupPath}
            onChange={(v) => setForm({ ...form, storageBackupPath: v })}
          />
          <Field
            label="Reports path"
            value={form.storageReportsPath}
            onChange={(v) => setForm({ ...form, storageReportsPath: v })}
          />
          <Field
            label="Attachments path"
            value={form.storageAttachmentsPath}
            onChange={(v) => setForm({ ...form, storageAttachmentsPath: v })}
          />
          <Field
            label="Logs export path"
            value={form.storageLogsPath}
            onChange={(v) => setForm({ ...form, storageLogsPath: v })}
          />
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
            Save settings
          </button>
          <button
            type="button"
            onClick={testConnection}
            disabled={testing}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium hover:border-slate-500 disabled:opacity-50"
          >
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          {saved && <span className="text-sm text-green-400">Saved</span>}
        </div>
      </form>

      {testResult && <ConnectionTestResults result={testResult} />}
    </div>
  );
}

function ConnectionTestResults({ result }: { result: StorageConnectionTestResult }) {
  const overallColor =
    result.overall === 'pass' ? 'text-green-400' : result.overall === 'warn' ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="mt-8 max-w-2xl rounded-lg border border-slate-700 bg-slate-900/50 p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">Connection test</h2>
        <span className={`text-sm font-medium uppercase ${overallColor}`}>{result.overall}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Tested from {result.testedFrom} at {new Date(result.testedAt).toLocaleString()}
      </p>
      <ul className="mt-4 space-y-2">
        {result.checks.map((check) => (
          <li key={check.id} className="rounded border border-slate-800 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-200">{check.label}</span>
              <StatusBadge status={check.status} />
            </div>
            <p className="mt-1 text-slate-400">{check.message}</p>
            {check.deferredToAgent && (
              <p className="mt-1 text-xs text-slate-500">Full validation in Phase 3 (GMS SVN SERVER Agent)</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pass: 'bg-green-900/50 text-green-300',
    warn: 'bg-amber-900/50 text-amber-300',
    fail: 'bg-red-900/50 text-red-300',
    skip: 'bg-slate-800 text-slate-400',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs uppercase ${colors[status] ?? colors.skip}`}>{status}</span>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-slate-400">{label}</span>
      {hint && <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-blue-500 font-mono text-sm"
      />
    </label>
  );
}
