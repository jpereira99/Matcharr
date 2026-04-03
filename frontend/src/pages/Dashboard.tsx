import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/ui/status-dot";
import { api } from "@/lib/api";
import { fmtDateTime, fmtDateTimeSec } from "@/lib/date";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  Radio,
  RefreshCw,
  Route,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const previewStatusLabel: Record<string, string> = {
  stream_found: "Stream matched",
  no_stream_match: "No stream match",
  no_active_game: "No game in cache",
  outside_window: "Outside window",
  pattern_error: "Pattern error",
  dispatcharr_error: "Dispatcharr error",
};

const previewStatusVariant: Record<string, "success" | "warning" | "danger" | "muted"> = {
  stream_found: "success",
  no_stream_match: "warning",
  no_active_game: "muted",
  outside_window: "muted",
  pattern_error: "danger",
  dispatcharr_error: "danger",
};

function CachedGameCard({
  g,
  highlighted,
}: {
  g: Record<string, unknown>;
  highlighted: boolean;
}) {
  const tracked = (g.tracked_team_names as string[] | undefined) ?? [];
  return (
    <div
      className={`flex items-center gap-3 rounded-(--radius-md) border px-4 py-3 transition-colors ${
        highlighted
          ? "border-(--color-accent)/25 bg-(--color-accent)/5"
          : "border-(--color-border) bg-(--color-surface-raised)/50"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">
            {String(g.away_team)} @ {String(g.home_team)}
          </span>
          <Badge variant="muted">{String(g.league ?? "")}</Badge>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-(--color-muted)">
          <span>{fmtDateTime(g.game_time as string | undefined) ?? "—"}</span>
          <span className="text-(--color-border)">|</span>
          <span>{String(g.status ?? "—")}</span>
        </div>
        {highlighted && tracked.length > 0 && (
          <div className="mt-1.5 text-xs font-medium text-(--color-accent)">
            Tracked: {tracked.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function DashboardPage() {
  const qc = useQueryClient();
  const [expandedLeagues, setExpandedLeagues] = useState<Set<number>>(
    () => new Set(),
  );
  const [showPreview, setShowPreview] = useState(false);

  const q = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const preview = useMutation({ mutationFn: api.routingPreview });
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

  if (q.isLoading) return <DashboardSkeleton />;
  if (q.isError)
    return (
      <div className="text-(--color-danger)">Failed to load dashboard</div>
    );

  const d = q.data!;
  const reachable = d.health?.dispatcharr_reachable as boolean | null | undefined;
  const lastSched = (d.health?.last_schedule_refresh as string | undefined) ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-(--color-muted)">
            Live routing status, upcoming games, and recent stream switches.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              preview.mutate();
              setShowPreview(true);
            }}
            disabled={preview.isPending}
          >
            <Route className="h-3.5 w-3.5" />
            {preview.isPending ? "Checking..." : "Check Routing"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => run.mutate()}
            disabled={run.isPending}
          >
            <Zap className="h-3.5 w-3.5" />
            {run.isPending ? "Running..." : "Run Match Now"}
          </Button>
        </div>
      </header>

      {/* Run result banner */}
      {run.isSuccess && run.data && (
        <div
          className={`rounded-(--radius-md) border px-4 py-3 text-sm ${
            run.data.ok
              ? "border-(--color-success)/30 bg-(--color-success)/10 text-(--color-success)"
              : "border-(--color-warning)/30 bg-(--color-warning)/10 text-(--color-warning)"
          }`}
        >
          {run.data.message}
        </div>
      )}
      {run.isError && (
        <div className="rounded-(--radius-md) border border-(--color-danger)/30 bg-(--color-danger)/10 px-4 py-3 text-sm text-(--color-danger)">
          {(run.error as Error)?.message ?? "Run failed"}
        </div>
      )}

      {/* Status strip */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden">
          <div className="flex items-center gap-2 text-(--color-muted)">
            <Radio className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Dispatcharr
            </span>
            <StatusDot
              status={
                !d.dispatcharr_configured
                  ? "offline"
                  : reachable === true
                    ? "online"
                    : reachable === false
                      ? "offline"
                      : "warning"
              }
              className="ml-auto"
            />
          </div>
          <div className="mt-3 text-xl font-semibold tabular-nums">
            {!d.dispatcharr_configured ? (
              <span className="text-(--color-danger)">Not configured</span>
            ) : reachable === true ? (
              <span className="text-(--color-success)">Connected</span>
            ) : reachable === false ? (
              <span className="text-(--color-warning)">Unreachable</span>
            ) : (
              <span className="text-(--color-muted)">Unknown</span>
            )}
          </div>
          <p className="mt-2 text-xs text-(--color-muted)">
            {d.dispatcharr_configured ? (
              <>
                API{" "}
                {reachable === true
                  ? "responded OK"
                  : reachable === false
                    ? "did not respond"
                    : "not checked"}
                .{" "}
                <Link
                  to="/settings"
                  className="text-(--color-accent) hover:underline"
                >
                  Settings
                </Link>
              </>
            ) : (
              <>
                Set URL + token in{" "}
                <Link
                  to="/settings"
                  className="text-(--color-accent) hover:underline"
                >
                  Settings
                </Link>
                .
              </>
            )}
          </p>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-(--color-muted)">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Tracked Teams
            </span>
          </div>
          <div className="mt-3 text-3xl font-bold tabular-nums">
            {d.tracked_teams}
          </div>
          <p className="mt-2 text-xs text-(--color-muted)">
            {d.tracked_teams === 0 ? (
              <>
                Add teams in{" "}
                <Link
                  to="/teams"
                  className="text-(--color-accent) hover:underline"
                >
                  Team Channels
                </Link>
                .
              </>
            ) : (
              "Enabled team channel mappings."
            )}
          </p>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-(--color-muted)">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Scheduler
            </span>
            <StatusDot
              status={d.health?.scheduler_running ? "online" : "warning"}
              className="ml-auto"
            />
          </div>
          <div className="mt-3">
            <Badge variant={d.health?.scheduler_running ? "success" : "muted"}>
              {d.health?.scheduler_running ? "Running" : "Idle"}
            </Badge>
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-(--color-muted)">
            <div>Next: {fmtDateTimeSec(d.next_scan_at) ?? "—"}</div>
            <div>
              Last:{" "}
              {fmtDateTimeSec(
                d.health?.last_scan_at as string | undefined,
              ) ?? "—"}
            </div>
            <div>ESPN refresh: {fmtDateTimeSec(lastSched) ?? "—"}</div>
          </div>
        </Card>
      </div>

      {/* Routing Preview (expandable) */}
      {showPreview && (preview.data != null || preview.isError) && (
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Routing Preview</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowPreview(false);
                preview.reset();
              }}
            >
              Dismiss
            </Button>
          </div>
          {preview.isError && (
            <p className="mt-2 text-sm text-(--color-danger)">
              {(preview.error as Error)?.message ?? "Preview failed"}
            </p>
          )}
          {preview.data && (
            <>
              <p className="mt-1 text-xs text-(--color-muted)">
                {preview.data.message}
              </p>
              <div className="mt-4 space-y-2">
                {preview.data.items?.map((row) => (
                  <div
                    key={row.team_channel_id}
                    className="flex items-center gap-3 rounded-(--radius-md) border border-(--color-border) bg-(--color-surface-raised)/50 px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {row.team_name}
                        </span>
                        <Badge
                          variant={previewStatusVariant[row.status] ?? "muted"}
                        >
                          {previewStatusLabel[row.status] ?? row.status}
                        </Badge>
                      </div>
                      {row.next_game && (
                        <div className="mt-1 text-xs text-(--color-muted)">
                          {row.next_game}
                        </div>
                      )}
                      {row.matched_stream_name && (
                        <div className="mt-1 font-mono text-xs text-(--color-success)">
                          {row.matched_stream_name}
                        </div>
                      )}
                      <div className="mt-0.5 text-xs text-(--color-muted)">
                        {row.reason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* Main 2-column area */}
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {/* Left: Stream Matches */}
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Upcoming Stream Matches</CardTitle>
              <p className="mt-1 text-xs text-(--color-muted)">
                Next game per tracked team vs. live Dispatcharr streams.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => void streamMatches.refetch()}
              disabled={streamMatches.isFetching}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${streamMatches.isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>

          {streamMatches.isError && (
            <p className="mt-3 text-sm text-(--color-danger)">
              {(streamMatches.error as Error)?.message ??
                "Could not load stream matches"}
            </p>
          )}
          {streamMatches.data && !streamMatches.data.ok && (
            <p className="mt-3 text-sm text-(--color-warning)">
              {streamMatches.data.message}
            </p>
          )}

          {streamMatches.data?.ok && (
            <div className="mt-4 space-y-2">
              {streamMatches.data.items.map((row) => (
                <div
                  key={row.team_channel_id}
                  className="flex items-start gap-3 rounded-(--radius-md) border border-(--color-border) bg-(--color-surface-raised)/30 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {row.team_name}
                      </span>
                      {row.status === "no_upcoming_game" ||
                      row.status === "pattern_error" ||
                      row.status === "dispatcharr_error" ? (
                        <Badge variant={previewStatusVariant[row.status] ?? "muted"}>
                          {previewStatusLabel[row.status] ?? row.status}
                        </Badge>
                      ) : row.in_routing_window ? (
                        <Badge variant="success">In Window</Badge>
                      ) : (
                        <Badge variant="muted">Not Yet</Badge>
                      )}
                    </div>
                    {row.next_game && (
                      <div className="mt-1 text-xs text-(--color-muted)">
                        {row.next_game}
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-3 text-xs text-(--color-muted)">
                      <span>
                        {fmtDateTime(row.game_time) ?? "No game"}
                      </span>
                      {row.streams_in_list > 0 && (
                        <>
                          <span className="text-(--color-border)">|</span>
                          <span className="tabular-nums">
                            {row.streams_in_list} stream
                            {row.streams_in_list !== 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                    </div>
                    {row.matched_stream_name ? (
                      <div className="mt-1.5 font-mono text-xs text-(--color-success)">
                        {row.matched_stream_name}
                      </div>
                    ) : (
                      row.status !== "no_upcoming_game" && (
                        <div className="mt-1 text-xs text-(--color-muted)">
                          {row.status === "no_stream_match"
                            ? "No match in list"
                            : row.status === "pattern_error"
                              ? "Pattern error"
                              : row.status === "dispatcharr_error"
                                ? "Dispatcharr error"
                                : "—"}
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
              {!streamMatches.data.items.length && (
                <p className="py-6 text-center text-sm text-(--color-muted)">
                  No team mappings to show.
                </p>
              )}
            </div>
          )}

          {!streamMatches.data && streamMatches.isLoading && (
            <div className="mt-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          )}
        </Card>

        {/* Right: Upcoming Games */}
        <Card>
          <CardTitle>Upcoming Games</CardTitle>
          <p className="mt-1 text-xs text-(--color-muted)">
            ESPN schedule cache — games involving your tracked teams.
          </p>
          <div className="mt-4 space-y-2">
            {d.upcoming_games?.length ? (
              d.upcoming_games.map((g, i) => (
                <CachedGameCard
                  key={i}
                  g={g as Record<string, unknown>}
                  highlighted
                />
              ))
            ) : d.tracked_teams > 0 ? (
              <p className="py-6 text-center text-sm text-(--color-muted)">
                No upcoming games in cache — run a match or wait for refresh.
              </p>
            ) : (
              <p className="py-6 text-center text-sm text-(--color-muted)">
                No schedule data yet — add profiles and teams first.
              </p>
            )}

            {(d.upcoming_games_extra_by_league ?? []).map((section) => {
              const id = section.league_profile_id;
              const n = section.games?.length ?? 0;
              if (n === 0) return null;
              const open = expandedLeagues.has(id);
              return (
                <div key={id} className="space-y-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedLeagues((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      })
                    }
                    className="flex w-full items-center gap-2 rounded-(--radius-md) border border-(--color-border) bg-(--color-surface-raised)/50 px-3 py-2 text-left text-xs font-medium text-(--color-muted) hover:text-(--color-foreground) transition-colors cursor-pointer"
                  >
                    {open ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-(--color-accent)" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>
                      {open ? "Hide" : "Show"} {n} more in {section.league}
                    </span>
                  </button>
                  {open &&
                    section.games.map((g, j) => (
                      <CachedGameCard
                        key={`${id}-${j}`}
                        g={g as Record<string, unknown>}
                        highlighted={false}
                      />
                    ))}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Recent Switches — Timeline */}
      <Card>
        <CardTitle>Recent Switches</CardTitle>
        {d.recent_switches?.length ? (
          <div className="relative mt-4 ml-3 border-l-2 border-(--color-border) pl-6">
            {d.recent_switches.map((s, i) => (
              <div key={i} className="relative pb-5 last:pb-0">
                {/* Timeline dot */}
                <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-(--color-border) bg-(--color-surface)">
                  <span className="h-1.5 w-1.5 rounded-full bg-(--color-accent)" />
                </span>
                <div className="text-xs text-(--color-muted)">
                  {String(s.switched_at)}
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <span className="font-medium">
                    {String(s.team_name ?? "?")}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 font-mono text-xs">
                  <span className="text-(--color-muted)">
                    {String(s.from_stream_name ?? "—")}
                  </span>
                  <ArrowRight className="h-3 w-3 text-(--color-accent)" />
                  <span className="text-(--color-foreground)">
                    {String(s.to_stream_name ?? "—")}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-(--color-muted)">
                  {String(s.reason)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 py-6 text-center text-sm text-(--color-muted)">
            No switch events yet.
          </p>
        )}
      </Card>
    </div>
  );
}
