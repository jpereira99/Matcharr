import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Breadcrumb({
  parent,
  to,
  current,
}: {
  parent: string;
  to: string;
  current: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-xs text-(--color-muted)"
    >
      <Link
        to={to}
        className="transition-colors duration-150 hover:text-(--color-foreground)"
      >
        {parent}
      </Link>
      <ChevronRight className="h-3 w-3" />
      <span className="truncate text-(--color-foreground)">{current}</span>
    </nav>
  );
}

/** 10px uppercase column caption used above the settings / preview columns. */
export function ColumnCaption({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-medium tracking-[.08em] text-(--color-muted) uppercase">
      {children}
    </span>
  );
}
