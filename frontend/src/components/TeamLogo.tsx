import { useTheme } from "@/hooks/useTheme";
import { teamLogoUrl } from "@/lib/espnLogos";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Props = {
  sport: string;
  abbreviation: string;
  teamName?: string;
  teamColor?: string;
  size?: number;
  className?: string;
};

export function TeamLogo({
  sport,
  abbreviation,
  teamName,
  teamColor,
  size = 32,
  className,
}: Props) {
  const { isDark } = useTheme();
  const [failed, setFailed] = useState(false);
  const url = teamLogoUrl(sport, abbreviation, isDark);

  if (!url || failed) {
    const initials = (abbreviation || teamName || "?").slice(0, 3).toUpperCase();
    const bg = teamColor ? `#${teamColor}` : "var(--color-surface-raised)";
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
          className,
        )}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.35,
          backgroundColor: bg,
        }}
        title={teamName || abbreviation}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={teamName || abbreviation}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
