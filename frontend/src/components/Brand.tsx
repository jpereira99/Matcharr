import lockupOnDark from "@/assets/brand/lockup-on-dark.png";
import lockupOnLight from "@/assets/brand/lockup-on-light.png";
import markOnDark from "@/assets/brand/mark-on-dark.png";
import markOnLight from "@/assets/brand/mark-on-light.png";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

/** Matcharr logo: the full lockup, or just the mark when `markOnly`. Height set by the caller. */
export function Brand({
  markOnly = false,
  className,
}: {
  markOnly?: boolean;
  className?: string;
}) {
  const { resolved } = useTheme();
  const light = resolved === "light";
  const src = markOnly
    ? light
      ? markOnLight
      : markOnDark
    : light
      ? lockupOnLight
      : lockupOnDark;
  return (
    <img
      src={src}
      alt="Matcharr"
      className={cn("w-auto shrink-0", className)}
      draggable={false}
    />
  );
}
