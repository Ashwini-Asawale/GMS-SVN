import type { ReactNode } from 'react';

interface ModalShellProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
}

export function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  widthClass = 'max-w-2xl',
}: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className={`flex w-full ${widthClass} flex-col rounded-lg border border-slate-600 bg-slate-900 shadow-2xl`}
        style={{ maxHeight: '90vh' }}
      >
        <div className="flex items-start justify-between border-b border-slate-700 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-400 font-mono break-all">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 rounded border border-slate-600 px-3 py-1 text-sm hover:bg-slate-800"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-auto px-4 py-3">{children}</div>
        {footer && <div className="border-t border-slate-700 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}
