import { Breadcrumb } from "@/components/Breadcrumb";
import { AddChip, Chip, SuggestionChip } from "@/components/ChipEditor";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LeagueBadge } from "@/components/LeagueBadge";
import { CandidateCard } from "@/components/team/CandidateCard";
import { TeamLogo } from "@/components/TeamLogo";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { api } from "@/lib/api";
import { fmtDay, fmtTime, isToday } from "@/lib/date";
import {
  channelLabel,
  gameStatusBadge,
  leagueLabel,
  useDispatcharrChannels,
} from "@/lib/teams";
import type {
  Candidate,
  RoutingStatus,
  TeamChannel,
  TeamGameDetail,
  TeamGamesResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CircleAlert,
  Clock,
  Tag,
  Trash2,
  Tv,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-(--radius-md) bg-(--color-accent)/15 text-(--color-accent)">
      <Icon className="h-[13px] w-[13px]" />
    </span>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <IconTile icon={icon} />
      <h3 className="font-heading text-[15px] font-extrabold tracking-tight">
        {children}
      </h3>
    </div>
  );
}

function switchWhen(game: TeamGameDetail) {
  if (
    !game.switch_at ||
    game.in_window ||
    Date.parse(game.switch_at) <= Date.now()
  )
    return "at the next check";
  return isToday(game.switch_at)
    ? `at ${fmtTime(game.switch_at)}`
    : `${fmtDay(game.switch_at)} at ${fmtTime(game.switch_at)}`;
}

/** Status after an override change, derived from the server's ranked candidates. */
function withOverride(
  g: TeamGameDetail,
  stream: Candidate | null,
): TeamGameDetail {
  if (stream)
    return {
      ...g,
      status: "override",
      override: {
        stream_id: stream.stream_id,
        stream_name: stream.name,
        created_at: null,
        missing: false,
      },
      winner: {
        stream_id: stream.stream_id,
        name: stream.name,
        n: stream.groups.n ?? null,
      },
    };
  const top = g.candidates.find((c) => c.kind === "fit");
  const status: RoutingStatus =
    g.fit_count === 1
      ? "ready"
      : g.fit_count > 1
        ? "conflict"
        : g.candidates.length
          ? "near_miss"
          : "not_listed";
  return {
    ...g,
    status,
    override: null,
    winner: top
      ? { stream_id: top.stream_id, name: top.name, n: top.groups.n ?? null }
      : null,
  };
}

export function TeamChannelDetailPage() {
  const { id } = useParams();
  const tcId = Number(id);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const teamsQ = useQuery({
    queryKey: ["team-channels"],
    queryFn: api.listTeamChannels,
  });
  const profilesQ = useQuery({
    queryKey: ["profiles"],
    queryFn: api.listProfiles,
  });
  const gamesQ = useQuery({
    queryKey: ["team-games", tcId],
    queryFn: () => api.teamGames(tcId),
    refetchInterval: 60_000,
    enabled: Number.isFinite(tcId),
  });
  const channelsQ = useDispatcharrChannels();
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);

  useEffect(() => window.scrollTo(0, 0), [tcId]);

  const team = teamsQ.data?.find((t) => t.id === tcId);
  const profile = profilesQ.data?.find((p) => p.id === team?.league_profile_id);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["team-channels"] });
    void qc.invalidateQueries({ queryKey: ["team-status"] });
    void qc.invalidateQueries({ queryKey: ["team-games", tcId] });
  };

  const update = useMutation({
    mutationFn: (body: Partial<TeamChannel>) =>
      api.updateTeamChannel(tcId, body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["team-channels"] });
      const prev = qc.getQueryData<TeamChannel[]>(["team-channels"]);
      qc.setQueryData<TeamChannel[]>(["team-channels"], (list) =>
        list?.map((t) => (t.id === tcId ? { ...t, ...body } : t)),
      );
      return { prev };
    },
    onError: (_e, _b, ctx) => qc.setQueryData(["team-channels"], ctx?.prev),
    onSettled: invalidate,
  });

  const override = useMutation({
    mutationFn: ({
      gameId,
      stream,
    }: {
      gameId: string;
      stream: Candidate | null;
    }) =>
      stream
        ? api.putOverride(tcId, gameId, {
            stream_id: stream.stream_id,
            stream_name: stream.name,
          })
        : api.deleteOverride(tcId, gameId),
    onMutate: async ({ gameId, stream }) => {
      await qc.cancelQueries({ queryKey: ["team-games", tcId] });
      const prev = qc.getQueryData<TeamGamesResponse>(["team-games", tcId]);
      if (prev)
        qc.setQueryData<TeamGamesResponse>(["team-games", tcId], {
          ...prev,
          games: prev.games.map((g) =>
            g.id === gameId ? withOverride(g, stream) : g,
          ),
        });
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(["team-games", tcId], ctx?.prev),
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: () => api.deleteTeamChannel(tcId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["team-channels"] });
      void qc.invalidateQueries({ queryKey: ["team-status"] });
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      navigate("/teams");
    },
  });

  if (teamsQ.isLoading || profilesQ.isLoading)
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-14 w-80" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  if (!team)
    return (
      <EmptyState
        icon={Users}
        title="Team not found"
        description="It may have been removed."
      />
    );

  const data = gamesQ.data;
  const games = data?.games ?? [];
  const game = games.find((g) => g.id === selectedGameId) ?? games[0];
  const league = profile?.espn_league ?? data?.profile.espn_league ?? "";
  const profileName = profile?.name ?? data?.profile.name ?? "";
  const routingOn = team.enabled && (profile?.enabled ?? true);
  const aliases = team.aliases;

  const addAlias = (alias: string) => {
    const a = alias.trim();
    if (!a || aliases.some((x) => x.toLowerCase() === a.toLowerCase())) return;
    update.mutate({ aliases: [...aliases, a] });
  };
  const suggestions = (data?.alias_suggestions ?? []).filter(
    (s) => !aliases.some((a) => a.toLowerCase() === s.toLowerCase()),
  );

  // Switch note for the next game.
  const next = games[0];
  const current = data?.current_stream ?? null;
  let switchNote = "";
  let switchStrong = false;
  if (!routingOn) switchNote = "Routing is off for this team.";
  else if (!data) switchNote = "";
  else if (!next) switchNote = "No upcoming games in ESPN's schedule.";
  else if (!next.winner)
    switchNote = "Nothing to switch to yet for the next game.";
  else if (current?.id === next.winner.stream_id)
    switchNote = "Already on the chosen stream.";
  else {
    const label = next.winner.n
      ? `stream ${next.winner.n}`
      : "the chosen stream";
    switchNote = `Switches to ${label} ${switchWhen(next)}.`;
    switchStrong = true;
  }

  const channels = channelsQ.data ?? [];
  const hasChannel = channels.some((c) => c.id === team.dispatcharr_channel_id);
  const channelLabelFor = (id: number) => {
    const ch = channels.find((c) => c.id === id);
    return ch ? channelLabel(ch) : `#${id}`;
  };

  // Candidates: the active override first, then the server's ranking.
  const candidates = game
    ? [...game.candidates].sort(
        (a, b) =>
          Number(b.stream_id === game.override?.stream_id) -
          Number(a.stream_id === game.override?.stream_id),
      )
    : [];
  const activeOverride =
    game?.override && !game.override.missing ? game.override : null;

  let gameNote = "";
  if (game) {
    const when = game.in_window
      ? "In the routing window now"
      : game.switch_at
        ? `Switches ${isToday(game.switch_at) ? "" : `${fmtDay(game.switch_at)} `}at ${fmtTime(game.switch_at)}, ${data!.pre_game_minutes} min before kickoff`
        : "";
    const n = game.candidate_count;
    gameNote =
      game.status === "not_listed" || game.status === "error"
        ? `${when}.`
        : `${when} · ${n} stream${n === 1 ? "" : "s"} mention${n === 1 ? "s" : ""} this game${
            game.fit_count > 1 && !activeOverride
              ? `, ${game.fit_count} fit. Override one or add a skip term in ${profileName}.`
              : "."
          }`;
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb parent="Team Channels" to="/teams" current={team.team_name} />

      <div className="flex flex-wrap items-center gap-3.5">
        <TeamLogo
          league={league}
          abbreviation={team.espn_team_abbr}
          espnTeamId={team.espn_team_id}
          teamName={team.team_name}
          size={52}
        />
        <div className="min-w-[200px] flex-1">
          <h1 className="font-heading text-[22px] leading-7 font-extrabold tracking-tight">
            {team.team_name}
          </h1>
          <div className="mt-0.5 flex items-center gap-1.5">
            <LeagueBadge
              league={league}
              label={leagueLabel(league)}
              size={14}
            />
            {profile && (
              <Link
                to={`/profiles/${profile.id}`}
                className="text-xs text-(--color-muted) transition-colors duration-150 hover:text-(--color-foreground)"
              >
                {profile.name}
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-(--color-muted)">
            {team.enabled ? "Routing on" : "Routing off"}
          </span>
          <Toggle
            checked={team.enabled}
            onChange={(v) => update.mutate({ enabled: v })}
            label="Routing"
          />
          <button
            type="button"
            onClick={() => setRemoveOpen(true)}
            className="ml-1 cursor-pointer rounded-(--radius-sm) p-1.5 text-(--color-muted) transition-colors duration-150 hover:bg-(--color-danger)/10 hover:text-(--color-danger)"
            aria-label="Remove team"
            title="Remove team"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={removeOpen}
        title={`Remove ${team.team_name}?`}
        confirmLabel="Remove team"
        pending={remove.isPending}
        onCancel={() => setRemoveOpen(false)}
        onConfirm={() => remove.mutate()}
      >
        Matcharr stops switching channel{" "}
        {channelLabelFor(team.dispatcharr_channel_id)} for this team. The
        channel in Dispatcharr stays as it is, and any overrides for its games
        are removed.
      </ConfirmDialog>

      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
        }}
      >
        <Card className="flex flex-col gap-3 p-[18px]">
          <SectionTitle icon={Tv}>Channel</SectionTitle>
          <div>
            <Label htmlFor="team-channel" className="sr-only">
              Dispatcharr channel
            </Label>
            <Select
              id="team-channel"
              value={team.dispatcharr_channel_id}
              disabled={channelsQ.isLoading}
              onChange={(e) =>
                update.mutate({
                  dispatcharr_channel_id: Number(e.target.value),
                })
              }
            >
              {!hasChannel && (
                <option value={team.dispatcharr_channel_id}>
                  {channelsQ.isError
                    ? `Channel #${team.dispatcharr_channel_id} (couldn't load channel list)`
                    : `Channel #${team.dispatcharr_channel_id}`}
                </option>
              )}
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {channelLabel(ch)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs text-(--color-muted)">
              On the channel now
            </div>
            {gamesQ.isLoading ? (
              <Skeleton className="h-4 w-3/4" />
            ) : (
              <div className="font-mono text-[11.5px] leading-normal break-words text-(--color-text-secondary)">
                {current?.name ??
                  (data?.current_stream_error
                    ? `Couldn't read the channel: ${data.current_stream_error}`
                    : "Nothing playing")}
              </div>
            )}
            {switchNote && (
              <div
                className={cn(
                  "text-xs",
                  switchStrong
                    ? "text-(--color-foreground)"
                    : "text-(--color-muted)",
                )}
              >
                {switchNote}
              </div>
            )}
          </div>
        </Card>

        <Card className="flex flex-col gap-3 p-[18px]">
          <SectionTitle icon={Tag}>Names in titles</SectionTitle>
          <p className="text-xs text-(--color-muted)">
            ESPN calls this team{" "}
            <span className="text-(--color-foreground)">{team.team_name}</span>.
            Add any other names your provider uses.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {aliases.map((a) => (
              <Chip
                key={a}
                term={a}
                tone="neutral"
                onRemove={() =>
                  update.mutate({ aliases: aliases.filter((x) => x !== a) })
                }
              />
            ))}
            {suggestions.map((s) => (
              <SuggestionChip
                key={s}
                term={s}
                tone="accent"
                title="Seen in a stream title"
                onAdd={() => addAlias(s)}
              />
            ))}
            <AddChip onAdd={addAlias} placeholder="NY Giants" inputWidth={96} />
          </div>
          {suggestions.length > 0 && (
            <p className="text-xs text-(--color-muted)">
              Dashed names were spotted in stream titles for this team&apos;s
              games.
            </p>
          )}
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <SectionTitle icon={CalendarDays}>Games and streams</SectionTitle>
        {gamesQ.isLoading ? (
          <div className="flex flex-wrap gap-4">
            <div className="flex max-w-[300px] flex-[1_1_240px] flex-col gap-2">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-64 flex-[999_1_400px]" />
          </div>
        ) : gamesQ.isError ? (
          <p className="text-sm text-(--color-danger)">
            {gamesQ.error.message}
          </p>
        ) : !game ? (
          <div className="rounded-(--radius-lg) border border-(--color-border) px-5 py-8 text-center text-sm text-(--color-muted)">
            No upcoming games in ESPN&apos;s schedule for this team.
          </div>
        ) : (
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex max-w-[300px] flex-[1_1_240px] flex-col gap-2">
              <Label className="mb-0">Upcoming</Label>
              {games.map((g) => {
                const b = gameStatusBadge(g.status, g.fit_count);
                const selected = g.id === game.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedGameId(g.id)}
                    className={cn(
                      "flex w-full cursor-pointer flex-col items-start gap-2 rounded-(--radius-lg) border px-4 py-3.5 text-left transition-colors duration-150",
                      selected
                        ? "border-(--color-accent) bg-(--color-accent)/6"
                        : "border-(--color-border) hover:border-(--color-muted)",
                    )}
                  >
                    <span className="text-xs text-(--color-muted)">
                      {fmtDay(g.game_time)} · {fmtTime(g.game_time)}
                    </span>
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                      <span className="font-normal text-(--color-muted)">
                        {g.is_home ? "vs" : "@"}
                      </span>
                      <TeamLogo
                        league={league}
                        abbreviation={g.opponent.abbreviation}
                        espnTeamId={g.opponent.id}
                        teamName={g.opponent.name}
                        size={22}
                      />
                      <span className="truncate">{g.opponent.name}</span>
                    </span>
                    <span className="flex w-full items-center gap-2">
                      <Badge variant={b.variant}>{b.label}</Badge>
                      {g.switch_at && (
                        <span className="ml-auto text-[11px] text-(--color-muted)">
                          switches {fmtTime(g.switch_at)}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex min-w-0 flex-[999_1_400px] flex-col gap-3">
              <Label className="mb-0">
                Streams for {fmtDay(game.game_time)} {game.is_home ? "vs" : "@"}{" "}
                {game.opponent.name}
              </Label>
              <div className="overflow-hidden rounded-(--radius-lg) border border-(--color-border)">
                <div className="flex flex-wrap items-center gap-2 bg-(--color-surface-raised) px-[18px] py-2.5 text-xs text-(--color-muted)">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{gameNote}</span>
                  {game.override && (
                    <button
                      type="button"
                      onClick={() =>
                        override.mutate({ gameId: game.id, stream: null })
                      }
                      className="ml-auto cursor-pointer text-xs font-medium text-(--color-override) hover:underline"
                    >
                      Remove override
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-3 px-[18px] pt-3.5 pb-[18px]">
                  {game.override?.missing && (
                    <div className="flex items-start gap-2 text-xs text-(--color-foreground)">
                      <CircleAlert className="mt-0.5 h-3.5 w-3.5 flex-none text-(--color-warning)" />
                      The overridden stream{" "}
                      {game.override.stream_name &&
                        `“${game.override.stream_name}” `}
                      is no longer listed in Dispatcharr, so this game routes
                      automatically.
                    </div>
                  )}
                  {data?.error ? (
                    <div className="flex items-start gap-2 py-4 text-xs text-(--color-foreground)">
                      <CircleAlert className="mt-0.5 h-3.5 w-3.5 flex-none text-(--color-warning)" />
                      Couldn&apos;t check streams: {data.error}
                    </div>
                  ) : candidates.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-(--color-surface-raised) text-(--color-muted)">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div className="text-sm font-semibold">
                        No streams listed for this game yet
                      </div>
                      <div className="max-w-xs text-xs text-(--color-muted)">
                        Providers usually add them a few hours before kickoff.
                        Matcharr checks every {data?.scan_interval_minutes ?? 5}{" "}
                        minutes.
                      </div>
                    </div>
                  ) : (
                    candidates.map((c) => (
                      <CandidateCard
                        key={c.stream_id}
                        candidate={c}
                        game={game}
                        teamName={team.team_name}
                        profileName={profileName}
                        knownAliases={aliases}
                        busy={override.isPending}
                        onAddAlias={addAlias}
                        onOverride={(on) =>
                          override.mutate({
                            gameId: game.id,
                            stream: on ? c : null,
                          })
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
