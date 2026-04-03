import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ChevronDown, ChevronRight, Clock, Info, Radio, Route, Zap } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

/** Hover / screen-reader help for the upcoming games card */
const UPCOMING_GAMES_TOOLTIP =
  "ESPN games stored in the local schedule cache (not Dispatcharr streams). " +
  "Only leagues where you have at least one enabled team mapping are included. " +
  "By default you see games that include one of your tracked teams. " +
  "Use “Show more in …” to reveal other upcoming games in the same league (no tracked team in that matchup). " +
  "Games are from about the last day forward, within your schedule lookahead setting, refreshed when you run “Run match now” or on the periodic scan (subject to schedule refresh throttling). " +
  "Each row: away @ home (ESPN names), your league profile name, then start time and ESPN status (e.g. pregame, live, final).";

const previewStatusLabel: Record<string, string> = {
  stream_found: "Stream match",
  no_stream_match: "No stream match",
  no_active_game: "No game in cache",
  outside_window: "Outside window",
  pattern_error: "Pattern error",
  dispatcharr_error: "Dispatcharr error",
};

function CachedGameCard({ g, highlighted }: { g: Record<string, unknown>; highlighted: boolean }) {
  const tracked = (g.tracked_team_names as string[] | undefined) ?? [];
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border px-4 py-3 ${
        highlighted ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5" : "border-white/5 bg-black/20"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          {String(g.away_team)} @ {String(g.home_team)}
        </span>
        <Badge variant="muted" title="League profile name for this schedule">
          {String(g.league ?? "")}
        </Badge>
      </div>
      <div
        className="text-xs text-[var(--color-muted)]"
        title="Game start (ISO/UTC from ESPN) and raw ESPN status state"
      >
        <span className="text-[var(--color-muted)]">Start </span>
        {String(g.game_time ?? "—")}
        <span className="text-[var(--color-muted)]"> · Status </span>
        {String(g.status ?? "—")}
      </div>
      {highlighted && tracked.length > 0 && (
        <div className="text-xs font-medium text-[var(--color-accent)]">Your tracked teams in this game: {tracked.join(", ")}</div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const qc = useQueryClient();
  const [expandedLeagueExtras, setExpandedLeagueExtras] = useState<Set<number>>(() => new Set());
  const q = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const preview = useMutation({
    mutationFn: api.routingPreview,
  });
  const run = useMutation({
    mutationFn: api.runNow,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["upcoming-stream-matches"] });
      preview.reset();
    },
  });

  const streamMatches = useQuery({
    queryKey: ["upcoming-stream-matches"],
    queryFn: api.upcomingStreamMatches,
    retry: false,
  });

  if (q.isLoading) {
    return <div className="text-[var(--color-muted)]">Loading dashboard…</div>;
  }
  if (q.isError) {
    return <div className="text-[var(--color-danger)]">Failed to load dashboard</div>;
  }

  const d = q.data!;
  const reachable = d.health?.dispatcharr_reachable as boolean | null | undefined;
  const lastSched = (d.health?.last_schedule_refresh as string | undefined) ?? null;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Live routing status, upcoming games, and recent stream switches.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => preview.mutate()} disabled={preview.isPending}>
            <Route className="h-4 w-4" />
            {preview.isPending ? "Checking…" : "Check routing now"}
          </Button>
          <Button type="button" onClick={() => run.mutate()} disabled={run.isPending}>
            <Zap className="h-4 w-4" />
            {run.isPending ? "Running…" : "Run match now"}
          </Button>
        </div>
      </header>

      {run.isSuccess && run.data && (
        <div
          className={
            run.data.ok
              ? "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
              : "rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          }
        >
          {run.data.message}
          {run.data.ok && (
            <span className="mt-2 block text-xs text-emerald-200/80">
              Run “Check routing now” again to re-evaluate streams against the updated schedule cache.
            </span>
          )}
        </div>
      )}
      {run.isError && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {(run.error as Error)?.message ?? "Run failed"}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden">
          <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-violet-500/10" />
          <div className="flex items-center gap-2 text-[var(--color-muted)]">
            <Radio className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Dispatcharr</span>
          </div>
          <div className="mt-3 text-2xl font-semibold">
            {!d.dispatcharr_configured ? (
              <span className="text-[var(--color-danger)]">Not configured</span>
            ) : reachable === true ? (
              <span className="text-[var(--color-success)]">Reachable</span>
            ) : reachable === false ? (
              <span className="text-amber-400">Unreachable</span>
            ) : (
              <span className="text-[var(--color-muted)]">Unknown</span>
            )}
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            {d.dispatcharr_configured ? (
              <>
                Credentials saved — API {reachable === true ? "responded OK" : reachable === false ? "did not respond" : "not checked"}.
                {" "}
                <Link to="/settings" className="text-[var(--color-accent)] underline-offset-2 hover:underline">
                  Settings
                </Link>
              </>
            ) : (
              <>
                Set URL + token in{" "}
                <Link to="/settings" className="text-[var(--color-accent)] underline-offset-2 hover:underline">
                  Settings
                </Link>
                .
              </>
            )}
          </p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-[var(--color-muted)]">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Tracked teams</span>
          </div>
          <div className="mt-3 text-3xl font-semibold tabular-nums">{d.tracked_teams}</div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            {d.tracked_teams === 0 ? (
              <>
                No enabled mappings — add teams in{" "}
                <Link to="/teams" className="text-[var(--color-accent)] underline-offset-2 hover:underline">
                  Team channels
                </Link>
                .
              </>
            ) : (
              <>Enabled team channel mappings (see Team channels).</>
            )}
          </p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-[var(--color-muted)]">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Scheduler</span>
          </div>
          <div className="mt-3 text-sm font-medium">
            {d.health?.scheduler_running ? (
              <Badge variant="success">Running</Badge>
            ) : (
              <Badge>Idle</Badge>
            )}
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Next scan: {d.next_scan_at ?? "—"}
            <br />
            Last scan: {(d.health?.last_scan_at as string | undefined) ?? "—"}
            <br />
            Last ESPN schedule refresh: {lastSched ?? "—"}
          </p>
        </Card>
      </div>

      {(preview.data != null || preview.isError) && (
        <Card>
          <CardTitle>Routing preview (Dispatcharr + cache)</CardTitle>
          {preview.isError && (
            <p className="mt-2 text-sm text-[var(--color-danger)]">
              {(preview.error as Error)?.message ?? "Preview failed"}
            </p>
          )}
          {preview.data && (
            <>
              <p className="mt-1 text-xs text-[var(--color-muted)]">{preview.data.message}</p>
              <div className="mt-4 space-y-2">
                {preview.data.items?.map((row) => (
                  <div
                    key={row.team_channel_id}
                    className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{row.team_name}</span>
                      <Badge
                        variant={
                          row.status === "stream_found"
                            ? "success"
                            : row.status === "outside_window" || row.status === "no_active_game"
                              ? "muted"
                              : "default"
                        }
                      >
                        {previewStatusLabel[row.status] ?? row.status}
                      </Badge>
                    </div>
                    {row.next_game && (
                      <div className="mt-1 text-xs text-[var(--color-muted)]">Game: {row.next_game}</div>
                    )}
                    {row.matched_stream_name && (
                      <div className="mt-1 font-mono text-xs text-[var(--color-success)]">{row.matched_stream_name}</div>
                    )}
                    <div className="mt-1 text-xs text-[var(--color-muted)]">{row.reason}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Next game vs Dispatcharr streams (live)</CardTitle>
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">
              For each tracked team, uses the next non-final game in your ESPN cache and searches Dispatcharr’s current
              stream list (profile filter + pattern). Unlike “Upcoming games” above, this reflects titles available now.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="shrink-0"
            onClick={() => void streamMatches.refetch()}
            disabled={streamMatches.isFetching}
          >
            {streamMatches.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
        {streamMatches.isError && (
          <p className="mt-3 text-sm text-[var(--color-danger)]">
            {(streamMatches.error as Error)?.message ?? "Could not load stream matches"}
          </p>
        )}
        {streamMatches.data && !streamMatches.data.ok && (
          <p className="mt-3 text-sm text-amber-200/90">{streamMatches.data.message}</p>
        )}
        {streamMatches.data?.ok && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-[var(--color-muted)]">
                  <th className="pb-2 pr-3">Team</th>
                  <th className="pb-2 pr-3">Next matchup</th>
                  <th className="pb-2 pr-3">Start</th>
                  <th className="pb-2 pr-3">In routing window</th>
                  <th className="pb-2 pr-3">Streams (filter)</th>
                  <th className="pb-2">Matched stream</th>
                </tr>
              </thead>
              <tbody>
                {streamMatches.data.items.map((row) => (
                  <tr key={row.team_channel_id} className="border-t border-white/5">
                    <td className="py-2 pr-3 font-medium">{row.team_name}</td>
                    <td className="py-2 pr-3">{row.next_game ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-[var(--color-muted)]">
                      {row.game_time ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {row.status === "no_upcoming_game" || row.status === "pattern_error" || row.status === "dispatcharr_error" ? (
                        <span className="text-[var(--color-muted)]">—</span>
                      ) : row.in_routing_window ? (
                        <Badge variant="success">Yes</Badge>
                      ) : (
                        <Badge variant="muted">Not yet</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-[var(--color-muted)]">{row.streams_in_list}</td>
                    <td className="py-2">
                      {row.matched_stream_name ? (
                        <span className="font-mono text-xs text-[var(--color-success)]">{row.matched_stream_name}</span>
                      ) : (
                        <span className="text-xs text-[var(--color-muted)]" title={row.reason}>
                          {row.status === "no_stream_match"
                            ? "No match in list"
                            : row.status === "no_upcoming_game"
                              ? "No game in cache"
                              : row.status === "pattern_error"
                                ? "Pattern error"
                                : row.status === "dispatcharr_error"
                                  ? "Dispatcharr error"
                                  : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!streamMatches.data.items.length && (
              <p className="text-sm text-[var(--color-muted)]">No team mappings to show.</p>
            )}
          </div>
        )}
        {!streamMatches.data && streamMatches.isLoading && (
          <p className="mt-4 text-sm text-[var(--color-muted)]">Loading Dispatcharr stream matches…</p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle>Upcoming games (cached)</CardTitle>
              <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">
                ESPN schedule rows saved on this server—same data used to decide when to route Dispatcharr. You only see
                games involving your tracked teams unless you expand a league to browse other matchups in that league.
              </p>
            </div>
            <button
              type="button"
              className="mt-0.5 shrink-0 rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-white/10 hover:text-[var(--color-foreground)]"
              title={UPCOMING_GAMES_TOOLTIP}
              aria-label="Full explanation of upcoming games"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {d.upcoming_games?.length ? (
              d.upcoming_games.map((g, i) => <CachedGameCard key={i} g={g as Record<string, unknown>} highlighted />)
            ) : d.tracked_teams > 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                No upcoming games involving your tracked teams in the cached window — run a match or wait for the next
                schedule refresh.
              </p>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">
                No schedule rows yet — run a match or add profiles/teams.
              </p>
            )}
            {(d.upcoming_games_extra_by_league ?? []).map((section) => {
              const id = section.league_profile_id;
              const n = section.games?.length ?? 0;
              if (n === 0) return null;
              const open = expandedLeagueExtras.has(id);
              return (
                <div key={id} className="space-y-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedLeagueExtras((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      })
                    }
                    className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-left text-sm text-[var(--color-muted)] hover:bg-black/25 hover:text-[var(--color-foreground)]"
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <span>
                      {open ? "Hide" : "Show"} {n} more in {section.league}
                    </span>
                  </button>
                  {open &&
                    section.games.map((g, j) => (
                      <CachedGameCard key={`${id}-${j}`} g={g as Record<string, unknown>} highlighted={false} />
                    ))}
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <CardTitle>Recent switches</CardTitle>
          <div className="mt-4 space-y-2">
            {d.recent_switches?.length ? (
              d.recent_switches.map((s, i) => (
                <div key={i} className="rounded-lg bg-black/25 px-3 py-2 font-mono text-xs">
                  <div className="text-[var(--color-muted)]">{String(s.switched_at)}</div>
                  <div>
                    {String(s.team_name ?? "?")}: {String(s.from_stream_name ?? "—")} →{" "}
                    {String(s.to_stream_name ?? "—")}
                  </div>
                  <div className="text-[var(--color-muted)]">{String(s.reason)}</div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--color-muted)]">No log entries yet.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
