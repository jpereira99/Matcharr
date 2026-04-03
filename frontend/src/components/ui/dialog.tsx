import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  variant?: "center" | "panel";
};

export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  variant = "center",
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 shadow-(--shadow-dialog)",
          variant === "center" &&
            "w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-6 animate-in fade-in zoom-in-95",
          variant === "panel" &&
            "fixed right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-(--color-border) bg-(--color-surface) p-6 animate-in slide-in-from-right",
          className,
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight font-heading">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-(--radius-sm) p-1.5 text-(--color-muted) hover:bg-(--color-surface-raised) hover:text-(--color-foreground) transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
