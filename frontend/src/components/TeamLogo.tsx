import { useTheme } from "@/hooks/useTheme";
import { teamLogoUrl } from "@/lib/espnLogos";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type Props = {
  /** ESPN league slug from the league profile (e.g. `mlb`, `usa.1`). */
  league: string;
  abbreviation: string;
  /** Required for soccer and NCAA; ESPN internal team id string. */
  espnTeamId: string;
  teamName?: string;
  teamColor?: string;
  size?: number;
  className?: string;
};

export function TeamLogo({
  league,
  abbreviation,
  espnTeamId,
  teamName,
  teamColor,
  size = 32,
  className,
}: Props) {
  const { isDark } = useTheme();
  const [failed, setFailed] = useState(false);
  /** If dark asset 404s, retry default (light) asset — ESPN serves light for all teams more reliably. */
  const [preferLightAsset, setPreferLightAsset] = useState(false);
  const urlLight = teamLogoUrl(league, abbreviation, espnTeamId, false);
  const urlDark = teamLogoUrl(league, abbreviation, espnTeamId, true);
  const url =
    !isDark || preferLightAsset ? urlLight : urlDark;

  useEffect(() => {
    setFailed(false);
    setPreferLightAsset(false);
  }, [league, abbreviation, espnTeamId, isDark]);

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
      onError={() => {
        if (isDark && !preferLightAsset && urlDark && urlLight && urlDark !== urlLight) {
          setPreferLightAsset(true);
        } else {
          setFailed(true);
        }
      }}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
