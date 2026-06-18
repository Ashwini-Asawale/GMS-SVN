import type { StoredAuth, WorkingCopy, SvnResult, SvnStatusEntry } from '../../preload/index';

declare global {
  interface Window {
    gmsClient: {
      auth: {
        load: () => Promise<StoredAuth | null>;
        save: (auth: StoredAuth) => Promise<boolean>;
        clear: () => Promise<boolean>;
        refresh: (refreshToken: string) => Promise<string | null>;
      };
      system: {
        hostname: () => Promise<string>;
        svnExePath: () => Promise<string>;
        svnIsBundled: () => Promise<boolean>;
        svnIsAvailable: () => Promise<boolean>;
        svnIsMockMode: () => Promise<boolean>;
        selectFolder: () => Promise<string | null>;
      };
      workingCopies: {
        list: () => Promise<WorkingCopy[]>;
        remove: (id: string) => Promise<WorkingCopy[]>;
      };
      svn: {
        checkout: (input: {
          url: string;
          localPath: string;
          repositoryName: string;
          accessToken: string;
        }) => Promise<SvnResult>;
        status: (input: { id: string }) => Promise<SvnResult & { entries?: SvnStatusEntry[] }>;
        update: (input: { id: string; accessToken: string }) => Promise<SvnResult>;
        commit: (input: {
          id: string;
          message: string;
          accessToken: string;
          paths?: string[];
        }) => Promise<SvnResult>;
        add: (input: { id: string; path: string; accessToken: string }) => Promise<SvnResult>;
        delete: (input: { id: string; path: string; accessToken: string }) => Promise<SvnResult>;
        move: (input: { id: string; from: string; to: string; accessToken: string }) => Promise<SvnResult>;
        cleanup: (input: { id: string; accessToken: string }) => Promise<SvnResult>;
        diff: (input: { id: string; accessToken: string; path?: string }) => Promise<SvnResult>;
        log: (input: { id: string; accessToken: string; limit?: number }) => Promise<SvnResult>;
        blame: (input: { id: string; accessToken: string; path?: string }) => Promise<SvnResult>;
        revert: (input: { id: string; accessToken: string; path?: string }) => Promise<SvnResult>;
        resolve: (input: {
          id: string;
          path: string;
          accept: 'working' | 'mine-full' | 'theirs-full' | 'base';
          accessToken: string;
        }) => Promise<SvnResult>;
        lock: (input: { id: string; path: string; message?: string; accessToken: string }) => Promise<SvnResult>;
        unlock: (input: { id: string; path: string; accessToken: string }) => Promise<SvnResult>;
        proplist: (input: { id: string; accessToken: string; path?: string }) => Promise<SvnResult>;
        propget: (input: { id: string; propName: string; accessToken: string; path?: string }) => Promise<SvnResult>;
        propset: (input: {
          id: string;
          propName: string;
          value: string;
          accessToken: string;
          path?: string;
        }) => Promise<SvnResult>;
        list: (input: {
          id: string;
          accessToken: string;
          path?: string;
          fromRepoRoot?: boolean;
        }) => Promise<SvnResult>;
        export: (input: {
          id: string;
          targetPath: string;
          accessToken: string;
          path?: string;
          revision?: string;
        }) => Promise<SvnResult>;
        switch: (input: { id: string; url: string; accessToken: string }) => Promise<SvnResult>;
        relocate: (input: { id: string; fromUrl: string; toUrl: string; accessToken: string }) => Promise<SvnResult>;
        copy: (input: {
          id: string;
          destUrl: string;
          message: string;
          accessToken: string;
          sourcePath?: string;
        }) => Promise<SvnResult>;
        merge: (input: { id: string; sourceUrl: string; accessToken: string }) => Promise<SvnResult>;
        import: (input: { localPath: string; url: string; message: string; accessToken: string }) => Promise<SvnResult>;
      };
      audit: {
        queue: (event: Record<string, unknown>) => Promise<boolean>;
        flush: (accessToken: string) => Promise<number>;
      };
      settings: {
        getApiBaseUrl: () => Promise<string>;
        setApiBaseUrl: (url: string) => Promise<string>;
      };
    };
  }
}

export {};
