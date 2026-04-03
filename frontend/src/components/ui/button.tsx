import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  children: ReactNode;
};

export function Button({ className, variant = "primary", children, ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
        variant === "primary" &&
          "bg-[var(--color-accent)] text-[var(--color-accent-foreground)] shadow-lg shadow-black/20 hover:brightness-110",
        variant === "ghost" && "bg-white/5 hover:bg-white/10 text-[var(--color-foreground)]",
        variant === "danger" && "bg-[var(--color-danger)] text-white hover:brightness-110",
        props.disabled && "opacity-50 pointer-events-none",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
