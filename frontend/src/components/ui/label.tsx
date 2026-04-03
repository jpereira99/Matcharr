import type { ReactNode } from "react";

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
      {children}
    </label>
  );
}
