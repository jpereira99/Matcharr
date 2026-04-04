import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  inputSize?: "sm" | "md";
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, inputSize = "md", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) text-(--color-foreground) outline-none transition-all duration-150",
        "placeholder:text-(--color-muted)",
        "focus:border-(--color-accent) focus:ring-2 focus:ring-(--color-accent)/30 focus:ring-offset-0",
        "aria-[invalid=true]:border-(--color-danger) aria-[invalid=true]:focus:ring-(--color-danger)/30",
        inputSize === "sm" && "px-2.5 py-1.5 text-xs",
        inputSize === "md" && "px-3 py-2 text-sm",
        className,
      )}
      {...props}
    />
  );
});
