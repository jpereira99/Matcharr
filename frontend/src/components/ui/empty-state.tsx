import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-(--color-surface-raised)">
        <Icon className="h-7 w-7 text-(--color-muted)" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-(--color-foreground)">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-(--color-muted)">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
