import { contextBridge, ipcRenderer } from 'electron';

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  username: string;
  email?: string;
  svnPassword?: string;
  isAdmin: boolean;
}

export interface WorkingCopy {
  id: string;
  localPath: string;
  svnUrl: string;
  repositoryName: string;
  lastRevision: number | null;
  lastUpdated: string | null;
}

export interface SvnStatusEntry {
  status: string;
  columns: string;
  path: string;
}

export interface SvnResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  workingCopy?: WorkingCopy | null;
  entries?: SvnStatusEntry[];
}

contextBridge.exposeInMainWorld('gmsClient', {
  auth: {
    load: (): Promise<StoredAuth | null> => ipcRenderer.invoke('auth:load'),
    save: (auth: StoredAuth): Promise<boolean> => ipcRenderer.invoke('auth:save', auth),
    clear: (): Promise<boolean> => ipcRenderer.invoke('auth:clear'),
    refresh: (refreshToken: string): Promise<string | null> => ipcRenderer.invoke('auth:refresh', refreshToken),
  },
  system: {
    hostname: (): Promise<string> => ipcRenderer.invoke('system:hostname'),
    svnExePath: (): Promise<string> => ipcRenderer.invoke('svn:exePath'),
    svnIsBundled: (): Promise<boolean> => ipcRenderer.invoke('svn:isBundled'),
    svnIsAvailable: (): Promise<boolean> => ipcRenderer.invoke('svn:isAvailable'),
    svnIsMockMode: (): Promise<boolean> => ipcRenderer.invoke('svn:isMockMode'),
    selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder'),
  },
  workingCopies: {
    list: (): Promise<WorkingCopy[]> => ipcRenderer.invoke('wc:list'),
    remove: (id: string): Promise<WorkingCopy[]> => ipcRenderer.invoke('wc:remove', id),
  },
  svn: {
    checkout: (input: {
      url: string;
      localPath: string;
      repositoryName: string;
      accessToken: string;
    }): Promise<SvnResult> => ipcRenderer.invoke('svn:checkout', input),
    status: (input: { id: string }): Promise<SvnResult> => ipcRenderer.invoke('svn:status', input),
    update: (input: { id: string; accessToken: string }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:update', input),
    commit: (input: { id: string; message: string; accessToken: string; paths?: string[] }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:commit', input),
    add: (input: { id: string; path: string; accessToken: string }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:add', input),
    delete: (input: { id: string; path: string; accessToken: string }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:delete', input),
    move: (input: { id: string; from: string; to: string; accessToken: string }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:move', input),
    cleanup: (input: { id: string; accessToken: string }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:cleanup', input),
    diff: (input: { id: string; accessToken: string; path?: string }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:diff', input),
    log: (input: { id: string; accessToken: string; limit?: number }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:log', input),
    blame: (input: { id: string; accessToken: string; path?: string }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:blame', input),
    revert: (input: { id: string; accessToken: string; path?: string }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:revert', input),
    resolve: (input: {
      id: string;
      path: string;
      accept: 'working' | 'mine-full' | 'theirs-full' | 'base';
      accessToken: string;
    }): Promise<SvnResult> => ipcRenderer.invoke('svn:resolve', input),
    lock: (input: { id: string; path: string; message?: string; accessToken: string }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:lock', input),
    unlock: (input: { id: string; path: string; accessToken: string }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:unlock', input),
    proplist: (input: { id: string; accessToken: string; path?: string }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:proplist', input),
    propget: (input: { id: string; propName: string; accessToken: string; path?: string }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:propget', input),
    propset: (input: {
      id: string;
      propName: string;
      value: string;
      accessToken: string;
      path?: string;
    }): Promise<SvnResult> => ipcRenderer.invoke('svn:propset', input),
    list: (input: {
      id: string;
      accessToken: string;
      path?: string;
      fromRepoRoot?: boolean;
    }): Promise<SvnResult> => ipcRenderer.invoke('svn:list', input),
    export: (input: {
      id: string;
      targetPath: string;
      accessToken: string;
      path?: string;
      revision?: string;
    }): Promise<SvnResult> => ipcRenderer.invoke('svn:export', input),
    switch: (input: { id: string; url: string; accessToken: string }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:switch', input),
    relocate: (input: { id: string; fromUrl: string; toUrl: string; accessToken: string }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:relocate', input),
    copy: (input: {
      id: string;
      destUrl: string;
      message: string;
      accessToken: string;
      sourcePath?: string;
    }): Promise<SvnResult> => ipcRenderer.invoke('svn:copy', input),
    merge: (input: { id: string; sourceUrl: string; accessToken: string }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:merge', input),
    import: (input: { localPath: string; url: string; message: string; accessToken: string }): Promise<SvnResult> =>
      ipcRenderer.invoke('svn:import', input),
  },
  audit: {
    queue: (event: Record<string, unknown>): Promise<boolean> => ipcRenderer.invoke('audit:queue', event),
    flush: (accessToken: string): Promise<number> => ipcRenderer.invoke('audit:flush', accessToken),
  },
  settings: {
    getApiBaseUrl: (): Promise<string> => ipcRenderer.invoke('settings:getApiBaseUrl'),
    setApiBaseUrl: (url: string): Promise<string> => ipcRenderer.invoke('settings:setApiBaseUrl', url),
  },
});
