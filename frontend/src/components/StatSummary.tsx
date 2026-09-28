import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function BigStat({
  value,
  label,
  colorClass,
}: {
  value: ReactNode;
  label: string;
  colorClass: string;
}) {
  return (
    <div>
      <div
        className={cn(
          "font-heading text-3xl leading-9 font-extrabold tracking-tight tabular-nums",
          colorClass,
        )}
      >
        {value}
      </div>
      <div className="text-xs text-(--color-muted)">{label}</div>
    </div>
  );
}

/** Equal-width columns (as wide as the widest stat) so numbers sit evenly. */
export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none">
      {children}
    </div>
  );
}

/** 6px segmented bar; segments with a zero count are omitted. */
export function StackedBar({
  segments,
}: {
  segments: { count: number; colorClass: string }[];
}) {
  return (
    <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-(--color-surface-raised)">
      {segments
        .filter((s) => s.count > 0)
        .map((s, i) => (
          <span
            key={i}
            className={cn("basis-0 transition-all duration-150", s.colorClass)}
            style={{ flexGrow: s.count }}
          />
        ))}
    </div>
  );
}
