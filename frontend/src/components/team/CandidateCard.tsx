import { SuggestionChip } from "@/components/ChipEditor";
import { HighlightedTitle } from "@/components/HighlightedTitle";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { Candidate, TeamGameDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Ban, Check, Hand, X } from "lucide-react";

export type CandidateRole =
  | "override"
  | "winner"
  | "also"
  | "skipped"
  | "rejected";

export function candidateRole(
  c: Candidate,
  game: TeamGameDetail,
): CandidateRole {
  const ov = game.override && !game.override.missing ? game.override : null;
  if (ov && ov.stream_id === c.stream_id) return "override";
  if (!ov && game.winner?.stream_id === c.stream_id) return "winner";
  if (c.kind === "fit") return "also";
  return c.kind;
}

const RANK_NOTES = {
  only_fit: "Only stream that fits",
  closest_time: "Closest start time to kickoff",
  listed_first: "Listed first in Dispatcharr",
  preferred_account: "From your preferred M3U account",
};

const ROLE_STYLE: Record<
  CandidateRole,
  { badge: string; variant: BadgeVariant; edge: string; faded?: boolean }
> = {
  override: {
    badge: "Override",
    variant: "override",
    edge: "var(--color-override)",
  },
  winner: {
    badge: "Will route",
    variant: "success",
    edge: "var(--color-success)",
  },
  also: {
    badge: "Also fits",
    variant: "warning",
    edge: "var(--color-warning)",
  },
  skipped: {
    badge: "Skipped",
    variant: "danger",
    edge: "var(--color-border)",
    faded: true,
  },
  rejected: {
    badge: "Rejected",
    variant: "muted",
    edge: "var(--color-border)",
    faded: true,
  },
};

function reasonText(result: string | null, text: string, official: string) {
  if (!text) return `No team in this part of the title`;
  if (!result) return `“${text}” isn't a known name for ${official}`;
  if (result === "matches") return `“${text}” matches ${official}`;
  if (result === "part") return `“${text}” is part of ${official}`;
  return `“${text}” is an alias of ${official}`;
}

type Props = {
  candidate: Candidate;
  game: TeamGameDetail;
  teamName: string;
  profileName: string;
  knownAliases: string[];
  onOverride: (on: boolean) => void;
  onAddAlias: (alias: string) => void;
  busy?: boolean;
};

export function CandidateCard({
  candidate: c,
  game,
  teamName,
  profileName,
  knownAliases,
  onOverride,
  onAddAlias,
  busy,
}: Props) {
  const role = candidateRole(c, game);
  const style = ROLE_STYLE[role];
  const oppSide = c.our_side === "home" ? "away" : "home";
  const rank =
    role === "override"
      ? "This game only. Goes back to automatic after the game ends."
      : role === "winner"
        ? RANK_NOTES[game.rank_reason ?? "listed_first"]
        : role === "also"
          ? "Override to use this one instead"
          : "";
  const canOverride =
    role !== "rejected" &&
    !(role === "winner" && game.fit_count === 1 && !game.override);

  const sides = [
    {
      side: c.our_side,
      result: c.our_side_result,
      text: c.groups[c.our_side] ?? "",
      official: teamName,
      ours: true,
    },
    {
      side: oppSide,
      result: c.opp_side_result,
      text: c.groups[oppSide] ?? "",
      official: game.opponent.name,
      ours: false,
    },
  ];
  const known = new Set(knownAliases.map((a) => a.toLowerCase()));

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-4 transition-opacity duration-150",
        style.faded && "opacity-80",
      )}
      style={{ borderTopWidth: 3, borderTopColor: style.edge }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Badge variant={style.variant}>{style.badge}</Badge>
        {rank && <span className="text-xs text-(--color-muted)">{rank}</span>}
      </div>
      <HighlightedTitle
        title={c.name}
        spans={c.spans}
        className="rounded-(--radius-sm) bg-(--color-background) px-3 py-2"
      />
      <div className="flex flex-col gap-1.5">
        {sides.map((s) => (
          <div
            key={s.side}
            className="flex flex-wrap items-center gap-2 text-xs"
          >
            {s.result ? (
              <Check className="h-3.5 w-3.5 flex-none text-(--color-success)" />
            ) : (
              <X className="h-3.5 w-3.5 flex-none text-(--color-danger)" />
            )}
            <span
              className={cn(
                "w-[62px] flex-none",
                s.side === "home"
                  ? "text-(--color-capture-home-text)"
                  : "text-(--color-capture-away-text)",
              )}
            >
              {s.side === "home" ? "Home" : "Away"}
            </span>
            <span className="text-(--color-foreground)">
              {reasonText(s.result, s.text, s.official)}
            </span>
            {s.ours &&
              !s.result &&
              s.text &&
              !known.has(s.text.toLowerCase()) && (
                <SuggestionChip
                  term={s.text}
                  tone="accent"
                  title={`Add “${s.text}” as a name for ${teamName}`}
                  onAdd={() => onAddAlias(s.text)}
                  className="py-0.5"
                />
              )}
          </div>
        ))}
        {c.skip_term && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Ban className="h-3.5 w-3.5 flex-none text-(--color-danger)" />
            <span className="w-[62px] flex-none text-(--color-muted)">
              Skip list
            </span>
            <span className="text-(--color-foreground)">
              contains {c.skip_term}, skipped by {profileName}
            </span>
          </div>
        )}
      </div>
      {canOverride && (
        <div>
          <button
            type="button"
            disabled={busy}
            onClick={() => onOverride(role !== "override")}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-(--radius-sm) border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 disabled:cursor-wait disabled:opacity-60",
              role === "override"
                ? "border-(--color-border) bg-transparent text-(--color-foreground) hover:border-(--color-muted)"
                : "border-(--color-override)/50 bg-(--color-override)/12 text-(--color-override) hover:bg-(--color-override)/20",
            )}
          >
            <Hand className="h-3 w-3" />
            {role === "override"
              ? "Remove override"
              : role === "skipped"
                ? "Override anyway"
                : "Override for this game"}
          </button>
        </div>
      )}
    </div>
  );
}
