import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
};

const variantStyles: Record<NonNullable<Props["variant"]>, string> = {
  primary:
    "bg-(--color-accent) text-(--color-accent-foreground) shadow-sm hover:bg-(--color-accent-hover)",
  secondary:
    "bg-(--color-secondary) text-white shadow-sm hover:brightness-110",
  ghost:
    "bg-transparent hover:bg-(--color-surface-raised) text-(--color-foreground)",
  outline:
    "border border-(--color-accent) text-(--color-accent) bg-transparent hover:bg-(--color-accent)/10",
  danger:
    "bg-(--color-danger) text-white shadow-sm hover:brightness-110",
  success:
    "bg-(--color-success) text-white shadow-sm hover:brightness-110",
};

const sizeStyles: Record<NonNullable<Props["size"]>, string> = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5 rounded-(--radius-sm)",
  md: "px-4 py-2 text-sm gap-2 rounded-(--radius-md)",
  lg: "px-5 py-2.5 text-base gap-2.5 rounded-(--radius-md)",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer",
        variantStyles[variant],
        sizeStyles[size],
        props.disabled && "opacity-50 pointer-events-none",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
