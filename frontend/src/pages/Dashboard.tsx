import { ScheduleTimeline } from "@/components/ScheduleTimeline";
import { StackedBar } from "@/components/StatSummary";
import { TeamLogo } from "@/components/TeamLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/ui/status-dot";
import { api } from "@/lib/api";
import { fmtAgo, fmtTime, fmtWeekdayTime, isToday, parseUtc } from "@/lib/date";
import { attentionIssue, OUTCOMES } from "@/lib/outcomes";
import { channelNumber, useDispatcharrChannels } from "@/lib/teams";
import type { Dashboard, TimelineRow } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  ArrowRight,
  Clock,
  Radio,
  Route,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";

const previewStatus: Record<
  string,
  { label: string; variant: "success" | "warning" | "danger" | "muted" }
> = {
  stream_found: { label: "Stream matched", variant: "success" },
  no_stream_match: { label: "No stream match", variant: "warning" },
  no_active_game: { label: "No game in cache", variant: "muted" },
  outside_window: { label: "Outside window", variant: "muted" },
  pattern_error: { label: "Pattern error", variant: "danger" },
  dispatcharr_error: { label: "Dispatcharr error", variant: "danger" },
};

function shortTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return isToday(iso) ? fmtTime(iso) : fmtWeekdayTime(iso);
}

/** Channels with the soonest unfinished game first. */
function sortRows(rows: TimelineRow[], now: number) {
  const nextStart = (r: TimelineRow) => {
    const g = r.games.find(
      (x) => x.live || Date.parse(x.start) + x.duration_min * 60_000 > now,
    );
    return g ? Date.parse(g.start) : Infinity;
  };
  return [...rows].sort((a, b) => nextStart(a) - nextStart(b));
}

function CardHeader({
  icon,
  title,
  right,
}: {
  icon: ReactNode;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-(--color-border) px-5 py-4">
      {icon}
      <h2 className="font-heading text-base font-extrabold tracking-tight">
        {title}
      </h2>
      <div className="ml-auto">{right}</div>
    </div>
  );
}

function StatusStrip({ d }: { d: Dashboard }) {
  const reachable = d.health.dispatcharr_reachable;
  const t = d.tracked_summary;
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
      }}
    >
      <Card>
        <div className="flex items-center gap-2 text-(--color-muted)">
          <Radio className="h-4 w-4" />
          <span className="text-xs font-semibold tracking-wide uppercase">
            Dispatcharr
          </span>
          <StatusDot
            status={
              !d.dispatcharr_configured || reachable === false
                ? "offline"
                : reachable
                  ? "online"
                  : "warning"
            }
            className="ml-auto"
          />
        </div>
        <div className="mt-3 text-xl font-semibold">
          {!d.dispatcharr_configured ? (
            <span className="text-(--color-danger)">Not configured</span>
          ) : reachable ? (
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
              {d.health.dispatcharr_latency_ms != null &&
                `${d.health.dispatcharr_latency_ms} ms · `}
              checked {fmtAgo(d.health.dispatcharr_checked_at)}.{" "}
            </>
          ) : (
            "Set the URL and token in "
          )}
          <Link
            to="/settings"
            className="text-(--color-accent) hover:underline"
          >
            Settings
          </Link>
        </p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-(--color-muted)">
          <Users className="h-4 w-4" />
          <span className="text-xs font-semibold tracking-wide uppercase">
            Tracked Teams
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2.5">
          <span className="text-3xl font-bold tabular-nums">
            {d.tracked_teams}
          </span>
          <span className="text-xs text-(--color-muted)">
            {d.tracked_teams === 0 ? (
              <>
                Add teams in{" "}
                <Link
                  to="/teams"
                  className="text-(--color-accent) hover:underline"
                >
                  Team Channels
                </Link>
              </>
            ) : (
              <>
                <span className="text-(--color-success)">{t.ready} ready</span>
                {" · "}
                <span className="text-(--color-warning)">
                  {t.attention} need{t.attention === 1 ? "s" : ""} a look
                </span>
                {t.override > 0 && (
                  <>
                    {" · "}
                    <span className="text-(--color-override)">
                      {t.override} overridden
                    </span>
                  </>
                )}
              </>
            )}
          </span>
        </div>
        {t.total > 0 && (
          <div className="mt-2">
            <StackedBar
              segments={[
                { count: t.ready, colorClass: "bg-(--color-success)" },
                { count: t.attention, colorClass: "bg-(--color-warning)" },
                { count: t.override, colorClass: "bg-(--color-override)" },
                { count: t.waiting, colorClass: "bg-(--color-border-strong)" },
              ]}
            />
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-(--color-muted)">
          <Clock className="h-4 w-4" />
          <span className="text-xs font-semibold tracking-wide uppercase">
            Scheduler
          </span>
          <StatusDot
            status={d.health.scheduler_running ? "online" : "warning"}
            className="ml-auto"
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-(--color-muted)">
          <div>
            <div className="text-[10px] font-semibold tracking-wide uppercase">
              Stream matching
            </div>
            <div className="mt-0.5">
              Next{" "}
              <span className="text-(--color-foreground)">
                {shortTime(d.next_scan_at)}
              </span>
            </div>
            <div>Last {shortTime(d.health.last_scan_at)}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold tracking-wide uppercase">
              ESPN cache
            </div>
            <div className="mt-0.5">
              Next{" "}
              <span className="text-(--color-foreground)">
                {shortTime(d.health.next_schedule_refresh_at)}
              </span>
            </div>
            <div>Last {shortTime(d.health.last_schedule_refresh)}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function DashboardPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.dashboard,
    refetchInterval: 60_000,
  });
  const settingsQ = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    staleTime: Infinity,
  });
  const teamsQ = useQuery({
    queryKey: ["team-channels"],
    queryFn: api.listTeamChannels,
  });
  const profilesQ = useQuery({
    queryKey: ["profiles"],
    queryFn: api.listProfiles,
  });
  const channelsQ = useDispatcharrChannels();
  const preview = useMutation({ mutationFn: api.routingPreview });
  const run = useMutation({
    mutationFn: api.runNow,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      preview.reset();
    },
  });

  const now = q.dataUpdatedAt || Date.now();
  const rows = useMemo(
    () => sortRows(q.data?.timeline ?? [], now),
    [q.data, now],
  );
  const teamById = useMemo(
    () => new Map((teamsQ.data ?? []).map((t) => [t.id, t])),
    [teamsQ.data],
  );
  const leagueByProfile = useMemo(
    () => new Map((profilesQ.data ?? []).map((p) => [p.id, p.espn_league])),
    [profilesQ.data],
  );
  const channelNum = (id: number) =>
    channelNumber(channelsQ.data?.find((c) => c.id === id)) || String(id);

  if (q.isLoading)
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  if (q.isError || !q.data)
    return (
      <div className="text-(--color-danger)">Failed to load dashboard</div>
    );

  const d = q.data;
  const latest = d.recent_switches.slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-(--color-muted)">
            Live routing status and what&apos;s coming up.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => preview.mutate()}
            disabled={preview.isPending}
          >
            <Route className="h-3.5 w-3.5" />
            {preview.isPending ? "Previewing..." : "Preview Routing"}
          </Button>
          <Button
            size="sm"
            onClick={() => run.mutate()}
            disabled={run.isPending}
          >
            <Zap className="h-3.5 w-3.5" />
            {run.isPending ? "Running..." : "Run Match Now"}
          </Button>
        </div>
      </header>

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
          {run.error.message}
        </div>
      )}

      {(preview.data || preview.isError) && (
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Routing Preview</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => preview.reset()}>
              Dismiss
            </Button>
          </div>
          {preview.isError && (
            <p className="mt-2 text-sm text-(--color-danger)">
              {preview.error.message}
            </p>
          )}
          {preview.data && (
            <>
              <p className="mt-1 text-xs text-(--color-muted)">
                {preview.data.message}
              </p>
              <div className="mt-4 space-y-2">
                {preview.data.items.map((row) => {
                  const st = previewStatus[row.status];
                  return (
                    <div
                      key={row.team_channel_id}
                      className="rounded-(--radius-md) border border-(--color-border) bg-(--color-surface-raised)/50 px-4 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {row.team_name}
                        </span>
                        <Badge variant={st?.variant ?? "muted"}>
                          {st?.label ?? row.status}
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
                  );
                })}
              </div>
            </>
          )}
        </Card>
      )}

      <StatusStrip d={d} />

      <ScheduleTimeline
        rows={rows}
        lookaheadDays={settingsQ.data?.schedule_lookahead_days ?? 3}
        preGameMinutes={settingsQ.data?.pre_game_minutes ?? 30}
        channelNumber={channelNum}
        now={now}
      />

      <div
        className="grid items-start gap-4"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 380px), 1fr))",
        }}
      >
        <Card className="overflow-hidden p-0">
          <CardHeader
            icon={<TriangleAlert className="h-4 w-4 text-(--color-warning)" />}
            title="Needs a look"
            right={
              <Badge variant={d.attention.length ? "warning" : "muted"}>
                {d.attention.length}
              </Badge>
            }
          />
          {d.attention.length === 0 && (
            <p className="px-5 py-6 text-sm text-(--color-muted)">
              Every tracked team&apos;s next game has one clear stream.
            </p>
          )}
          {d.attention.map((a) => (
            <div
              key={a.team_channel_id}
              className="flex gap-3 border-b border-(--color-border) px-5 py-3.5 last:border-b-0"
            >
              <TeamLogo
                league={a.espn_league}
                abbreviation={a.espn_team_abbr}
                espnTeamId={a.espn_team_id}
                teamName={a.team_name}
                size={32}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="text-sm font-semibold">{a.team_name}</div>
                {a.game && (
                  <div className="text-xs text-(--color-muted)">
                    {fmtWeekdayTime(a.game.start)} {a.game.is_home ? "vs" : "@"}{" "}
                    {a.game.opponent}
                    {a.game.live && " · live"}
                  </div>
                )}
                <div className="text-xs">
                  {attentionIssue(a.game, a.failed_reason)}
                </div>
              </div>
              <Link
                to={`/teams/${a.team_channel_id}`}
                className="inline-flex flex-none items-center gap-1 self-center rounded-(--radius-sm) border border-(--color-border) px-2.5 py-1.5 text-xs font-medium text-(--color-foreground) transition-colors duration-150 hover:border-(--color-muted)"
              >
                Review
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </Card>

        <Card className="overflow-hidden p-0">
          <CardHeader
            icon={<ArrowLeftRight className="h-4 w-4 text-(--color-accent)" />}
            title="Latest switches"
            right={
              <Link
                to="/activity"
                className="text-xs text-(--color-accent) hover:text-(--color-accent-hover)"
              >
                View all
              </Link>
            }
          />
          {latest.length === 0 && (
            <p className="px-5 py-6 text-sm text-(--color-muted)">
              No switch events yet.
            </p>
          )}
          {latest.map((s) => {
            const tc = teamById.get(s.team_channel_id);
            const outcome = OUTCOMES[s.outcome] ?? OUTCOMES.switched;
            const at = parseUtc(s.switched_at);
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 border-b border-(--color-border) px-5 py-3 last:border-b-0"
              >
                <span className="w-14 flex-none font-mono text-[11.5px] text-(--color-muted)">
                  {isToday(at) ? fmtTime(at) : fmtWeekdayTime(at.toISOString())}
                </span>
                {tc && (
                  <TeamLogo
                    league={leagueByProfile.get(tc.league_profile_id) ?? ""}
                    abbreviation={tc.espn_team_abbr}
                    espnTeamId={tc.espn_team_id}
                    teamName={tc.team_name}
                    size={22}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">
                    {s.team_name ?? "Removed team"}
                  </div>
                  <div className="truncate font-mono text-[11px] text-(--color-text-secondary)">
                    → {s.to_stream_name ?? "—"}
                  </div>
                </div>
                <Badge variant={outcome.variant} className="flex-none">
                  {outcome.label}
                </Badge>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
