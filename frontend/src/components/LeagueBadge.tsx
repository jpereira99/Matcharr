import { leagueLogoUrl } from "@/lib/espnLogos";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { useState } from "react";

/** League mark on its own (page headers); falls back to a trophy tile. */
export function LeagueLogo({
  league,
  size = 44,
  className,
}: {
  league: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = leagueLogoUrl(league);
  if (!url || failed)
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-(--radius-lg) bg-(--color-surface-raised) text-(--color-muted)",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Trophy style={{ width: size * 0.45, height: size * 0.45 }} />
      </div>
    );
  return (
    <img
      src={url}
      alt={league.toUpperCase()}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

type Props = {
  league: string;
  label?: string;
  size?: number;
  className?: string;
};

export function LeagueBadge({ league, label, size = 20, className }: Props) {
  const [failed, setFailed] = useState(false);
  const url = leagueLogoUrl(league);
  const displayLabel = label || league.toUpperCase();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-(--radius-sm) bg-(--color-surface-raised) px-2 py-0.5 text-xs font-medium text-(--color-muted)",
        className,
      )}
    >
      {url && !failed && (
        <img
          src={url}
          alt={displayLabel}
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
          className="shrink-0 object-contain"
        />
      )}
      {displayLabel}
    </span>
  );
}
