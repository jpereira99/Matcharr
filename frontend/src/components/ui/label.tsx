import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Label({
  children,
  htmlFor,
  className,
}: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1 block text-xs font-medium uppercase tracking-wide text-(--color-muted)",
        className,
      )}
    >
      {children}
    </label>
  );
}
