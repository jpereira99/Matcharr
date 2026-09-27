import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  step?: number;
  title: string;
  helper?: ReactNode;
  children: ReactNode;
  /** Full-bleed bar under the body (raised surface, top border). */
  footer?: ReactNode;
};

export function SettingsCard({ step, title, helper, children, footer }: Props) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-3.5 p-5">
        <div>
          <div className="flex items-center gap-2.5">
            {step !== undefined && (
              <span className="inline-flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-(--color-accent)/15 text-xs font-bold text-(--color-accent)">
                {step}
              </span>
            )}
            <h2 className="font-heading text-base font-extrabold tracking-tight">
              {title}
            </h2>
          </div>
          {helper && (
            <p
              className={cn(
                "mt-1.5 text-xs text-(--color-muted)",
                step !== undefined && "ml-8",
              )}
            >
              {helper}
            </p>
          )}
        </div>
        {children}
      </div>
      {footer && (
        <div className="flex items-center gap-3 border-t border-(--color-border) bg-(--color-surface-raised) px-5 py-3">
          {footer}
        </div>
      )}
    </Card>
  );
}
