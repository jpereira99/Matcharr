import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";

type CardProps = {
  className?: string;
  children: ReactNode;
  variant?: "default" | "outlined" | "raised";
  colorAccent?: string;
};

export function Card({
  className,
  children,
  variant = "default",
  colorAccent,
}: CardProps) {
  const style: CSSProperties | undefined = colorAccent
    ? { borderTopColor: colorAccent, borderTopWidth: "3px" }
    : undefined;

  return (
    <div
      style={style}
      className={cn(
        "rounded-(--radius-lg) border border-(--color-border) p-5 transition-shadow duration-150",
        variant === "default" && "bg-(--color-surface) shadow-(--shadow-card)",
        variant === "outlined" && "bg-transparent",
        variant === "raised" &&
          "bg-(--color-surface-raised) shadow-(--shadow-card-hover)",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold tracking-tight font-heading",
        className,
      )}
    >
      {children}
    </h2>
  );
}
