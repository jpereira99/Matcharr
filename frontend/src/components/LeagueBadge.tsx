import { leagueLogoUrl } from "@/lib/espnLogos";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
