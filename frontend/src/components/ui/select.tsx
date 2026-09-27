import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { forwardRef, type SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  mono?: boolean;
  wrapperClassName?: string;
};

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { className, wrapperClassName, mono, children, ...props },
  ref,
) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        ref={ref}
        className={cn(
          "w-full cursor-pointer appearance-none truncate rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) py-2 pr-9 pl-3 text-(--color-foreground) transition-all duration-150 outline-none",
          "focus:border-(--color-accent) focus:ring-2 focus:ring-(--color-accent)/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          mono ? "font-mono text-xs" : "text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-(--color-foreground)" />
    </div>
  );
});
