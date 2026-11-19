import { AlertTriangle, RefreshCw } from "lucide-react";
import { BotanixMark } from "./BotanixMark";

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
    <div className="app-shell flex h-full items-center justify-center bg-canvas p-6 text-ink">
      <div
        role="alert"
        className="animate-rise w-full max-w-sm rounded-[30px] border border-line bg-surface p-7 text-center shadow-card"
      >
        <div className="flex items-center justify-center gap-2.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
            <BotanixMark className="h-6 w-6" />
          </span>
          <span className="font-serif text-[23px] leading-none font-semibold tracking-[-0.01em] text-ink">
            Botanix <span className="text-accent-ink">AI</span>
          </span>
        </div>

        <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-sand-soft text-sand">
          <AlertTriangle className="h-5 w-5" strokeWidth={1.7} />
        </div>

        <h1 className="mt-4 font-serif text-[26px] leading-tight font-semibold text-ink">
          {title}
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          {message}
        </p>

        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-6 flex h-[48px] w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-[13.5px] font-semibold text-primary-ink shadow-float transition active:scale-[0.985]"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.9} />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
