import { cn } from "@/lib/utils";

type Props = {
  status: "online" | "offline" | "warning";
  className?: string;
};

const statusColors: Record<Props["status"], string> = {
  online: "bg-(--color-success)",
  offline: "bg-(--color-danger)",
  warning: "bg-(--color-warning)",
};

export function StatusDot({ status, className }: Props) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        statusColors[status],
        className,
      )}
      aria-label={status}
    />
  );
}
