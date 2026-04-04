import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-(--radius-sm)", className)}
      aria-hidden
    />
  );
}
