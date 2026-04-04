import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type TabItem = {
  id: string;
  label: string;
  icon?: ReactNode;
};

type Props = {
  value: string;
  onChange: (id: string) => void;
  items: TabItem[];
  className?: string;
};

export function Tabs({ value, onChange, items, className }: Props) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1 rounded-(--radius-md) bg-(--color-surface-raised) p-1",
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          type="button"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-(--radius-sm) px-3 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer",
            value === item.id
              ? "bg-(--color-surface) text-(--color-foreground) shadow-sm"
              : "text-(--color-muted) hover:text-(--color-foreground)",
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
