import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Badge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "success" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "default" && "bg-white/10 text-[var(--color-foreground)]",
        variant === "success" && "bg-[var(--color-success)]/20 text-[var(--color-success)]",
        variant === "muted" && "bg-white/5 text-[var(--color-muted)]",
      )}
    >
      {children}
    </span>
  );
}
