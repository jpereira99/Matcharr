import { LeagueLogo } from "@/components/LeagueBadge";
import { TeamLogo } from "@/components/TeamLogo";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import { fmtTime } from "@/lib/date";
import { leagueLabel } from "@/lib/teams";
import type { ProfileSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { OverflowMenu } from "@/components/ui/menu";
import { Ban, Copy, Trash2 } from "lucide-react";
import { PatternStrip } from "./PatternStrip";

const PILL_COLOR = {
  ok: "bg-(--color-success)",
  warn: "bg-(--color-warning)",
  none: "bg-(--color-border-strong)",
};

function statusBadge(p: ProfileSummary): {
  label: string;
  variant: BadgeVariant;
} {
  if (!p.enabled) return { label: "Off", variant: "muted" };
  if (p.games_today.some((g) => g.status === "warn"))
    return { label: "Conflict", variant: "warning" };
  if (!p.games_today.length)
    return { label: "No games today", variant: "muted" };
  return { label: "Ready", variant: "success" };
}

type Props = {
  profile: ProfileSummary;
  sourceLabel: string;
  onOpen: () => void;
  onToggle: (enabled: boolean) => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function ProfileCard({
  profile: p,
  sourceLabel,
  onOpen,
  onToggle,
  onDuplicate,
  onDelete,
}: Props) {
  const badge = statusBadge(p);
  const games = p.games_today;
  const ok = games.filter((g) => g.status === "ok").length;
  const warn = games.filter((g) => g.status === "warn").length;
  const note = !p.enabled
    ? "Off: Matcharr won't route these streams. Teams keep their channels."
    : p.error
      ? `Couldn't check streams in Dispatcharr: ${p.error}`
      : p.note;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
      }}
      className={cn(
        "flex cursor-pointer flex-col gap-3.5 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) px-5 py-[18px] shadow-(--shadow-card) transition-all duration-150 hover:border-(--color-border-strong) hover:shadow-(--shadow-card-hover)",
        !p.enabled && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <LeagueLogo league={p.espn_league} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{p.name}</div>
          <div className="mt-0.5 truncate text-xs text-(--color-muted)">
            {leagueLabel(p.espn_league)} · {sourceLabel}
          </div>
        </div>
        <Badge variant={badge.variant} className="flex-none">
          {badge.label}
        </Badge>
      </div>

      <PatternStrip pattern={p.stream_pattern} />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-(--color-muted)">Today</span>
          <span className="text-(--color-foreground)">
            {games.length
              ? `${ok} of ${games.length} ${games.length === 1 ? "game has" : "games have"} a stream${warn ? ` · ${warn} in conflict` : ""}`
              : "No ESPN games"}
          </span>
        </div>
        {games.length > 0 && (
          <div className="flex h-1.5 gap-[3px]">
            {games.map((g) => (
              <span
                key={g.event_id}
                title={`${g.label} · ${fmtTime(g.start)}`}
                className={cn(
                  "flex-1 rounded-full",
                  p.enabled ? PILL_COLOR[g.status] : "bg-(--color-border)",
                )}
              />
            ))}
          </div>
        )}
        {note && <div className="text-xs text-(--color-muted)">{note}</div>}
      </div>

      <div className="mt-auto flex items-center gap-2.5 border-t border-(--color-border) pt-3">
        {p.teams.length > 0 && (
          <div className="flex items-center">
            {p.teams.slice(0, 6).map((t) => (
              <span
                key={t.id}
                title={t.name}
                className="-mr-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-(--color-border) bg-(--color-background)"
              >
                <TeamLogo
                  league={p.espn_league}
                  abbreviation={t.abbr}
                  espnTeamId={t.espn_team_id}
                  teamName={t.name}
                  size={16}
                />
              </span>
            ))}
          </div>
        )}
        <span
          className={cn(
            "text-xs text-(--color-muted)",
            p.teams.length > 0 && "ml-1",
          )}
        >
          {p.teams.length
            ? `${p.teams.length} team${p.teams.length === 1 ? "" : "s"}`
            : "No teams yet"}
        </span>
        {p.exclude_terms.length > 0 && (
          <span className="inline-flex min-w-0 items-center gap-1 text-xs text-(--color-muted)">
            <Ban className="h-3 w-3 flex-none" />
            skips
            <span className="truncate font-mono text-(--color-text-secondary)">
              {p.exclude_terms.join(" ")}
            </span>
          </span>
        )}
        <div
          className="ml-auto flex flex-none items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Toggle
            checked={p.enabled}
            onChange={onToggle}
            label={p.enabled ? "Turn off" : "Turn on"}
          />
          <OverflowMenu
            placement="up"
            items={[
              { label: "Duplicate", icon: Copy, onSelect: onDuplicate },
              {
                label: "Delete…",
                icon: Trash2,
                onSelect: onDelete,
                danger: true,
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
