import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent"
  | "muted";

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-(--color-surface-raised) text-(--color-foreground)",
  success: "bg-(--color-success)/15 text-(--color-success)",
  warning: "bg-(--color-warning)/15 text-(--color-warning)",
  danger: "bg-(--color-danger)/15 text-(--color-danger)",
  info: "bg-(--color-info)/15 text-(--color-info)",
  accent: "bg-(--color-accent)/15 text-(--color-accent)",
  muted: "bg-(--color-muted)/10 text-(--color-muted)",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-(--radius-sm) px-2 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
