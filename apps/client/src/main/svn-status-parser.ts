export interface SvnStatusEntry {
  /** Primary status column (e.g. M, A, ?, C) */
  status: string;
  /** Full 7-column status when available */
  columns: string;
  path: string;
}

const STATUS_LABELS: Record<string, string> = {
  M: 'Modified',
  A: 'Added',
  D: 'Deleted',
  R: 'Replaced',
  C: 'Conflicted',
  '?': 'Unversioned',
  '!': 'Missing',
  L: 'Locked',
  K: 'Unlocked',
  I: 'Ignored',
  T: 'Tree switched',
  X: 'External',
};

export function statusLabel(code: string): string {
  return STATUS_LABELS[code] ?? code;
}

export function parseSvnStatus(stdout: string): SvnStatusEntry[] {
  const entries: SvnStatusEntry[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (line.length < 4) continue;
    const columns = line.slice(0, 7);
    const path = line.slice(8).trim();
    if (!path) continue;
    const status = columns.trim()[0] ?? columns[0] ?? '';
    if (!status || status === ' ') continue;
    entries.push({ status, columns, path });
  }
  return entries;
}

export function isChangedEntry(entry: SvnStatusEntry): boolean {
  return entry.status !== ' ' && entry.status !== 'I';
}
