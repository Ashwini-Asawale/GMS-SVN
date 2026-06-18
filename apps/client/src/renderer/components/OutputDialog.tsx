import { ModalShell } from './ModalShell';

interface OutputDialogProps {
  title: string;
  subtitle?: string;
  repoUrl?: string;
  localPath?: string;
  content: string;
  onClose: () => void;
}

export function OutputDialog({ title, subtitle, repoUrl, localPath, content, onClose }: OutputDialogProps) {
  return (
    <ModalShell title={title} subtitle={subtitle} onClose={onClose} widthClass="max-w-4xl">
      {(repoUrl || localPath) && (
        <div className="mb-3 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono space-y-1">
          {localPath && <p className="text-slate-400">Working copy: {localPath}</p>}
          {repoUrl && <p className="text-blue-300/90 break-all">URL: {repoUrl}</p>}
        </div>
      )}
      <pre className="max-h-[60vh] overflow-auto rounded border border-slate-700 bg-slate-950 p-3 text-xs font-mono whitespace-pre-wrap">
        {content || 'No output.'}
      </pre>
    </ModalShell>
  );
}
