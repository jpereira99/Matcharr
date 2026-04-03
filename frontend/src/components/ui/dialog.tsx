import { clsx } from "clsx";
import type { ReactNode } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
};

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className={clsx(
          "relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[var(--color-surface)] p-6 shadow-xl",
          className,
        )}
      >
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
