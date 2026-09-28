import type { BadgeVariant } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { ESPN_LEAGUE_PRESETS } from "./espnLeagues";
import type { DispatcharrChannel, RoutingStatus } from "./types";

/** Badge for a team's next game on the Team Channels overview. */
export function teamStatusBadge(
  status: RoutingStatus,
  fitCount: number,
  routingEnabled: boolean,
): { label: string; variant: BadgeVariant } {
  if (!routingEnabled) return { label: "Off", variant: "muted" };
  switch (status) {
    case "ready":
      return { label: "Ready", variant: "success" };
    case "conflict":
      return { label: `${fitCount} fit`, variant: "warning" };
    case "near_miss":
      return { label: "No match", variant: "warning" };
    case "override":
      return { label: "Override", variant: "override" };
    case "not_listed":
      return { label: "Not listed", variant: "muted" };
    case "no_game":
      return { label: "No games", variant: "muted" };
    case "error":
      return { label: "Error", variant: "danger" };
  }
}

/** Badge on a game card in the team detail page. */
export function gameStatusBadge(
  status: RoutingStatus,
  fitCount: number,
): { label: string; variant: BadgeVariant } {
  switch (status) {
    case "ready":
      return { label: "Ready", variant: "success" };
    case "conflict":
      return { label: `${fitCount} streams fit`, variant: "warning" };
    case "near_miss":
      return { label: "Near miss", variant: "warning" };
    case "override":
      return { label: "Manual override", variant: "override" };
    case "not_listed":
    case "no_game":
      return { label: "Not listed yet", variant: "muted" };
    case "error":
      return { label: "Error", variant: "danger" };
  }
}

export function leagueLabel(league: string): string {
  return (
    ESPN_LEAGUE_PRESETS.find((p) => p.league === league)?.label ??
    league.toUpperCase()
  );
}

export function channelNumber(ch: DispatcharrChannel | undefined): string {
  const n = ch?.channel_number;
  if (n === null || n === undefined || n === "") return "";
  const num = Number(n);
  return Number.isFinite(num) && Number.isInteger(num)
    ? String(num)
    : String(n);
}

export function channelLabel(ch: DispatcharrChannel): string {
  const num = channelNumber(ch);
  const name = ch.name ?? `Channel ${ch.id}`;
  return num ? `${num} · ${name}` : name;
}

export function useDispatcharrChannels() {
  return useQuery({
    queryKey: ["dispatcharr-channels"],
    queryFn: async () => {
      const list = await api.dispatcharrChannels("");
      return [...list].sort(
        (a, b) =>
          (Number(a.channel_number) || Infinity) -
          (Number(b.channel_number) || Infinity),
      );
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}
