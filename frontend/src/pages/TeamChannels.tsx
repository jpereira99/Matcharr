import { BigStat, StackedBar } from "@/components/StatSummary";
import { AddTeamDialog } from "@/components/team/AddTeamDialog";
import { TeamLogo } from "@/components/TeamLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { fmtAgo, fmtDay, fmtTime } from "@/lib/date";
import {
  channelNumber,
  leagueLabel,
  teamStatusBadge,
  useDispatcharrChannels,
} from "@/lib/teams";
import type {
  DispatcharrChannel,
  LeagueProfile,
  TeamChannel,
  TeamStatusItem,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link2, Plus, TriangleAlert, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const needsLook = (s?: TeamStatusItem) =>
  !!s &&
  s.routing_enabled &&
  (s.status === "conflict" || s.status === "near_miss");

export function TeamChannelsPage() {
  const teamsQ = useQuery({
    queryKey: ["team-channels"],
    queryFn: api.listTeamChannels,
  });
  const profilesQ = useQuery({
    queryKey: ["profiles"],
    queryFn: api.listProfiles,
  });
  const statusQ = useQuery({
    queryKey: ["team-status"],
    queryFn: api.teamStatus,
    refetchInterval: 60_000,
  });
  const channelsQ = useDispatcharrChannels();

  const [league, setLeague] = useState("all");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [adding, setAdding] = useState(false);

  const teams = useMemo(() => teamsQ.data ?? [], [teamsQ.data]);
  const profileMap = useMemo(
    () => new Map((profilesQ.data ?? []).map((p) => [p.id, p])),
    [profilesQ.data],
  );
  const statusMap = useMemo(
    () =>
      new Map((statusQ.data?.items ?? []).map((s) => [s.team_channel_id, s])),
    [statusQ.data],
  );
  const channelMap = useMemo(
    () => new Map((channelsQ.data ?? []).map((c) => [c.id, c])),
    [channelsQ.data],
  );

  const leagues = useMemo(() => {
    const seen: string[] = [];
    for (const t of teams) {
      const lg = profileMap.get(t.league_profile_id)?.espn_league;
      if (lg && !seen.includes(lg)) seen.push(lg);
    }
    return seen;
  }, [teams, profileMap]);

  const active = teams
    .map((t) => statusMap.get(t.id))
    .filter((s): s is TeamStatusItem => !!s && s.routing_enabled);
  const count = (st: TeamStatusItem["status"]) =>
    active.filter((s) => s.status === st).length;
  const nReady = count("ready");
  const nLook = active.filter((s) => needsLook(s)).length;
  const nOverride = count("override");
  const nWaiting = count("not_listed");
  const firstError = active.find((s) => s.status === "error")?.error;

  const shown = teams.filter(
    (t) =>
      (league === "all" ||
        profileMap.get(t.league_profile_id)?.espn_league === league) &&
      (!attentionOnly || needsLook(statusMap.get(t.id))),
  );

  if (teamsQ.isLoading || profilesQ.isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );

  const loadingStatus = statusQ.isLoading;
  const stat = (n: number) => (loadingStatus ? "–" : n);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">
            Team Channels
          </h1>
          <p className="mt-1 text-sm text-(--color-muted)">
            Which stream each team&apos;s channel will use for its next game.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setAdding(true)}
          disabled={!profilesQ.data?.length}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Team
        </Button>
      </header>

      {teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team channels"
          description={
            profilesQ.data?.length
              ? "Add a team to start routing Dispatcharr channels."
              : "Create a league profile first, then add teams to it."
          }
          action={
            profilesQ.data?.length ? (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Team
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-(--radius-lg) border border-(--color-border) px-5 py-4">
            <div className="flex flex-wrap items-end gap-7">
              <BigStat
                value={stat(nReady)}
                label="ready"
                colorClass="text-(--color-success)"
              />
              <BigStat
                value={stat(nLook)}
                label="need a look"
                colorClass="text-(--color-warning)"
              />
              <BigStat
                value={stat(nOverride)}
                label="overridden"
                colorClass="text-(--color-override)"
              />
              <BigStat
                value={stat(nWaiting)}
                label="streams not listed yet"
                colorClass="text-(--color-muted)"
              />
              <div className="ml-auto text-right text-xs text-(--color-muted)">
                {teams.length} team{teams.length === 1 ? "" : "s"} · next game
                for each
                <br />
                {firstError ? (
                  <span className="text-(--color-warning)">
                    Dispatcharr: {firstError}
                  </span>
                ) : statusQ.data ? (
                  `Checked against Dispatcharr ${fmtAgo(statusQ.data.checked_at)}`
                ) : (
                  "Checking Dispatcharr…"
                )}
              </div>
            </div>
            <StackedBar
              segments={[
                { count: nReady, colorClass: "bg-(--color-success)" },
                { count: nOverride, colorClass: "bg-(--color-override)" },
                { count: nLook, colorClass: "bg-(--color-warning)" },
                { count: nWaiting, colorClass: "bg-(--color-border-strong)" },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {leagues.length > 1 && (
              <Tabs
                value={league}
                onChange={setLeague}
                className="flex-wrap"
                items={[
                  { id: "all", label: "All" },
                  ...leagues.map((lg) => ({ id: lg, label: leagueLabel(lg) })),
                ]}
              />
            )}
            <button
              type="button"
              aria-pressed={attentionOnly}
              onClick={() => setAttentionOnly(!attentionOnly)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 self-start rounded-(--radius-sm) border border-dashed px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                attentionOnly
                  ? "border-(--color-warning) bg-(--color-warning)/15 text-(--color-warning)"
                  : "border-(--color-border) text-(--color-muted) hover:text-(--color-foreground)",
              )}
            >
              <TriangleAlert className="h-3 w-3" />
              Only teams that need a look
            </button>
          </div>

          {shown.length === 0 ? (
            <p className="py-6 text-sm text-(--color-muted)">
              No teams match this filter.
            </p>
          ) : (
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
              }}
            >
              {shown.map((t) => (
                <TeamCard
                  key={t.id}
                  team={t}
                  profile={profileMap.get(t.league_profile_id)}
                  status={statusMap.get(t.id)}
                  statusLoading={loadingStatus}
                  channel={channelMap.get(t.dispatcharr_channel_id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <AddTeamDialog
        open={adding}
        onClose={() => setAdding(false)}
        profiles={profilesQ.data ?? []}
        teams={teams}
      />
    </div>
  );
}

function TeamCard({
  team,
  profile,
  status,
  statusLoading,
  channel,
}: {
  team: TeamChannel;
  profile?: LeagueProfile;
  status?: TeamStatusItem;
  statusLoading: boolean;
  channel?: DispatcharrChannel;
}) {
  const league = profile?.espn_league ?? "";
  const enabled = team.enabled && (profile?.enabled ?? true);
  const badge = status
    ? teamStatusBadge(status.status, status.fit_count, enabled)
    : enabled
      ? null
      : teamStatusBadge("no_game", 0, false);
  const next = status?.next_game;

  return (
    <Link
      to={`/teams/${team.id}`}
      className={cn(
        "flex flex-col gap-3.5 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) px-5 py-[18px] text-(--color-foreground) shadow-(--shadow-card) transition-all duration-150 hover:border-(--color-border-strong) hover:shadow-(--shadow-card-hover)",
        !enabled && "opacity-50",
      )}
    >
      <div className="flex w-full items-start gap-3">
        <TeamLogo
          league={league}
          abbreviation={team.espn_team_abbr}
          espnTeamId={team.espn_team_id}
          teamName={team.team_name}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{team.team_name}</div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-(--color-muted)">
            <Link2 className="h-3 w-3 flex-none" />
            <span className="font-mono text-(--color-foreground)">
              {channelNumber(channel) || `#${team.dispatcharr_channel_id}`}
            </span>
            {channel?.name && <span className="truncate">{channel.name}</span>}
          </div>
        </div>
        {badge ? (
          <Badge variant={badge.variant} className="flex-none">
            {badge.label}
          </Badge>
        ) : (
          statusLoading && <Skeleton className="h-5 w-14 flex-none" />
        )}
      </div>
      <div className="flex w-full min-w-0 items-center gap-2 rounded-(--radius-md) bg-(--color-surface-raised) px-2.5 py-2 text-xs">
        {next ? (
          <>
            <span className="flex-none text-(--color-muted)">
              {fmtDay(next.game_time)} {fmtTime(next.game_time)}
            </span>
            <span className="text-(--color-muted)">
              {next.is_home ? "vs" : "@"}
            </span>
            <TeamLogo
              league={league}
              abbreviation={next.opponent.abbreviation}
              espnTeamId={next.opponent.id}
              teamName={next.opponent.name}
              size={18}
            />
            <span className="truncate">{next.opponent.short_name}</span>
          </>
        ) : statusLoading ? (
          <Skeleton className="h-4 w-40" />
        ) : (
          <span className="text-(--color-muted)">
            No upcoming games in ESPN&apos;s schedule
          </span>
        )}
      </div>
    </Link>
  );
}
