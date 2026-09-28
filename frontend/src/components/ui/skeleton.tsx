import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-(--radius-sm)", className)}
      style={style}
      aria-hidden
    />
  );
}
