import Store from 'electron-store';

export interface WorkingCopy {
  id: string;
  localPath: string;
  svnUrl: string;
  repositoryName: string;
  lastRevision: number | null;
  lastUpdated: string | null;
}

interface StoreSchema {
  workingCopies: WorkingCopy[];
  auditQueue: unknown[];
}

const store = new Store<StoreSchema>({
  name: 'gms-svn-client',
  defaults: {
    workingCopies: [],
    auditQueue: [],
  },
});

export function listWorkingCopies(): WorkingCopy[] {
  return store.get('workingCopies');
}

export function addWorkingCopy(wc: WorkingCopy): WorkingCopy[] {
  const list = listWorkingCopies();
  const next = [...list.filter((x) => x.localPath !== wc.localPath), wc];
  store.set('workingCopies', next);
  return next;
}

export function removeWorkingCopy(id: string): WorkingCopy[] {
  const next = listWorkingCopies().filter((x) => x.id !== id);
  store.set('workingCopies', next);
  return next;
}

export function updateWorkingCopy(id: string, patch: Partial<WorkingCopy>): WorkingCopy | null {
  const list = listWorkingCopies();
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch };
  store.set('workingCopies', list);
  return list[idx];
}

export function getAuditQueue(): unknown[] {
  return store.get('auditQueue');
}

export function setAuditQueue(queue: unknown[]): void {
  store.set('auditQueue', queue);
}
