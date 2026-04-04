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
        "mb-1 block text-xs font-medium tracking-wide text-(--color-muted) uppercase",
        className,
      )}
    >
      {children}
    </label>
  );
}
