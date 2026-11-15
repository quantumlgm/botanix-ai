import { AlertTriangle, RefreshCw } from "lucide-react";

interface FatalScreenProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function FatalScreen({
  title,
  message,
  actionLabel,
  onAction,
}: FatalScreenProps) {
  return (
    <div className="flex h-full items-center justify-center bg-slate-900 p-6 text-white">
      <div
        role="alert"
        className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-slate-800 bg-slate-800/60 p-6 text-center shadow-xl"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-white">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{message}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 active:scale-[0.99]"
          >
            <RefreshCw className="h-4 w-4" />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
