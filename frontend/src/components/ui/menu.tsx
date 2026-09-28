import { cn } from "@/lib/utils";
import { Ellipsis, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type MenuItem = {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};

/** ⋯ button with a small action menu; closes on outside click or Escape. */
export function OverflowMenu({
  items,
  placement = "down",
  label = "More",
}: {
  items: MenuItem[];
  placement?: "up" | "down";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex cursor-pointer rounded-(--radius-sm) p-1.5 text-(--color-muted) transition-colors duration-150 hover:bg-(--color-surface-raised) hover:text-(--color-foreground)"
      >
        <Ellipsis className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-20 flex min-w-[170px] flex-col rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) p-1 shadow-(--shadow-dialog)",
            placement === "up"
              ? "bottom-[calc(100%+4px)]"
              : "top-[calc(100%+4px)]",
          )}
        >
          {items.map(
            ({ label: text, icon: Icon, onSelect, danger, disabled }) => (
              <button
                key={text}
                type="button"
                role="menuitem"
                disabled={disabled}
                onClick={() => {
                  setOpen(false);
                  onSelect();
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-(--radius-sm) px-2.5 py-2 text-left text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50",
                  danger
                    ? "text-(--color-danger) hover:bg-(--color-danger)/10"
                    : "text-(--color-foreground) hover:bg-(--color-surface-raised)",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {text}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
