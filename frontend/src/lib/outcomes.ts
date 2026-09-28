import type { BadgeVariant } from "@/components/ui/badge";
import type { SwitchOutcome, TimelineGame, TimelineStatus } from "./types";
import { fmtTime, fmtWeekdayTime, isToday } from "./date";

export const OUTCOMES: Record<
  SwitchOutcome,
  { label: string; variant: BadgeVariant; dot: string; active: string }
> = {
  switched: {
    label: "Switched",
    variant: "success",
    dot: "bg-(--color-success)",
    active: "border-(--color-success) bg-(--color-success)/15",
  },
  no_match: {
    label: "No match",
    variant: "warning",
    dot: "bg-(--color-warning)",
    active: "border-(--color-warning) bg-(--color-warning)/15",
  },
  failed: {
    label: "Failed",
    variant: "danger",
    dot: "bg-(--color-danger)",
    active: "border-(--color-danger) bg-(--color-danger)/15",
  },
  override: {
    label: "Override",
    variant: "override",
    dot: "bg-(--color-override)",
    active: "border-(--color-override) bg-(--color-override)/15",
  },
};

export const TIMELINE_STATUS: Record<
  TimelineStatus,
  { label: string; variant: BadgeVariant; block: string }
> = {
  ok: {
    label: "Ready",
    variant: "success",
    block:
      "border-(--color-success) bg-(--color-success)/15 text-(--color-success)",
  },
  warn: {
    label: "Needs a look",
    variant: "warning",
    block:
      "border-(--color-warning) bg-(--color-warning)/15 text-(--color-warning)",
  },
  override: {
    label: "Override",
    variant: "override",
    block:
      "border-(--color-override) bg-(--color-override)/16 text-(--color-override)",
  },
  none: {
    label: "Not listed yet",
    variant: "muted",
    block: "border-(--color-border-strong) bg-transparent text-(--color-muted)",
  },
};

const PICKED: Record<string, string> = {
  listed_first: "the one listed first",
  closest_time: "the one closest to kickoff",
  preferred_account: "the one from your preferred M3U account",
};

function when(iso: string) {
  return isToday(iso) ? `at ${fmtTime(iso)}` : fmtWeekdayTime(iso);
}

/** One-line explanation of a timeline game's routing state. */
export function gameNote(g: TimelineGame, now = Date.now()): string {
  if (g.error) return `Couldn't check streams: ${g.error}`;
  const switched = g.switched_at
    ? ` Switched at ${fmtTime(g.switched_at)}.`
    : "";
  const started = Date.parse(g.start) <= now;
  const windowOpen = g.switch_at ? Date.parse(g.switch_at) <= now : started;
  switch (g.routing_status) {
    case "override":
      return `Manual override for this game.${switched}`;
    case "ready":
      if (g.switched_at)
        return started
          ? `Switched at ${fmtTime(g.switched_at)}.`
          : `In the pre-game window.${switched}`;
      if (windowOpen)
        return "In the routing window. Switches at the next check.";
      return `Stream ready. Switches ${g.switch_at ? when(g.switch_at) : "before kickoff"}.`;
    case "conflict":
      return `${g.fit_count} streams fit. Using ${PICKED[g.rank_reason ?? "listed_first"]}. Override from the team page.`;
    case "near_miss":
      return g.near_miss?.text
        ? `Near miss: “${g.near_miss.text}” isn't a known name for ${g.near_miss.official}.`
        : "Streams mention this game, but none fit the title format.";
    default:
      return "Streams not listed yet. Providers usually add them a few hours before.";
  }
}

/** Short issue line for the "Needs a look" list. */
export function attentionIssue(
  g: TimelineGame | null,
  failedReason: string | null,
): string {
  if (failedReason)
    return `Last switch failed: ${failedReason.replace(/^Switch failed:\s*/i, "")}`;
  if (!g) return "";
  if (g.routing_status === "conflict")
    return `${g.fit_count} streams fit. Using ${PICKED[g.rank_reason ?? "listed_first"]}.`;
  if (g.near_miss?.text)
    return `No match: “${g.near_miss.text}” isn't a known name.`;
  return "No match: no stream fits the title format.";
}
