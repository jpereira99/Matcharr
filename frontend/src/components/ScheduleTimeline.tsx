import { HighlightedTitle } from "@/components/HighlightedTitle";
import { TeamLogo } from "@/components/TeamLogo";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import {
  fmtDay,
  fmtHour,
  fmtWeekdayTime,
  isToday,
  startOfDay,
} from "@/lib/date";
import { gameNote, TIMELINE_STATUS } from "@/lib/outcomes";
import type { TimelineGame, TimelineRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const HOUR = 3_600_000;
const HATCH =
  "repeating-linear-gradient(45deg, rgb(100 116 139 / .35) 0 3px, transparent 3px 6px)";

type Span = "today" | "lookahead";

type Window = {
  t0: number;
  t1: number;
  cells: number;
  ticks: { at: number; label: string; accent: boolean }[];
};

/**
 * Today: 2-hour cells from noon to 2 AM, stretched earlier or later to fit
 * today's games and the current time. Lookahead: one cell per day.
 */
function buildWindow(
  span: Span,
  rows: TimelineRow[],
  lookaheadDays: number,
  preMs: number,
  now: number,
): Window {
  const midnight = startOfDay(0, new Date(now)).getTime();
  if (span === "lookahead") {
    const cells = Math.max(1, lookaheadDays);
    const ticks = Array.from({ length: cells }, (_, i) => {
      const at = startOfDay(-i, new Date(now)).getTime();
      return {
        at,
        label:
          i === 0
            ? `${fmtDay(new Date(at).toISOString())} · Today`
            : fmtDay(new Date(at).toISOString()),
        accent: i === 0,
      };
    });
    return {
      t0: midnight,
      t1: startOfDay(-cells, new Date(now)).getTime(),
      cells,
      ticks,
    };
  }
  let startH = 12;
  let endH = 26;
  for (const r of rows)
    for (const g of r.games) {
      const s = Date.parse(g.start);
      if (!isToday(g.start)) continue;
      startH = Math.min(startH, (s - preMs - midnight) / HOUR);
      endH = Math.max(endH, (s + g.duration_min * 60_000 - midnight) / HOUR);
    }
  const nowH = (now - midnight) / HOUR;
  startH = Math.min(startH, nowH - 1);
  startH = Math.max(0, Math.floor(startH / 2) * 2);
  endH = Math.min(36, Math.ceil(Math.max(endH, nowH + 1) / 2) * 2);
  const cells = Math.max(1, (endH - startH) / 2);
  const t0 = midnight + startH * HOUR;
  const ticks = Array.from({ length: cells }, (_, i) => ({
    at: t0 + i * 2 * HOUR,
    label: fmtHour(t0 + i * 2 * HOUR),
    accent: false,
  }));
  return { t0, t1: midnight + endH * HOUR, cells, ticks };
}

type Props = {
  rows: TimelineRow[];
  lookaheadDays: number;
  preGameMinutes: number;
  channelNumber: (dispatcharrChannelId: number) => string;
  now?: number;
};

export function ScheduleTimeline({
  rows,
  lookaheadDays,
  preGameMinutes,
  channelNumber,
  now = Date.now(),
}: Props) {
  const [span, setSpan] = useState<Span>("today");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const preMs = preGameMinutes * 60_000;
  const win = useMemo(
    () => buildWindow(span, rows, lookaheadDays, preMs, now),
    [span, rows, lookaheadDays, preMs, now],
  );
  const total = win.t1 - win.t0;
  const pct = (ms: number) => `${((ms / total) * 100).toFixed(3)}%`;

  const visible = rows.flatMap((r) =>
    r.games
      .filter((g) => {
        const s = Date.parse(g.start);
        return s + g.duration_min * 60_000 > win.t0 && s < win.t1;
      })
      .map((g) => ({ row: r, game: g })),
  );
  const fallback =
    visible.find((v) => v.game.live) ??
    visible.find((v) => Date.parse(v.game.start) >= now) ??
    visible[0];
  const selected =
    visible.find(
      (v) => v.game.event_id + v.row.team_channel_id === selectedId,
    ) ?? fallback;
  const showNow = now >= win.t0 && now <= win.t1;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-(--color-border) px-5 py-4">
        <div>
          <h2 className="font-heading text-lg font-extrabold tracking-tight">
            Schedule
          </h2>
          <p className="mt-0.5 text-xs text-(--color-muted)">
            Each block is a game. Color shows whether its stream is ready. Click
            one for details.
          </p>
        </div>
        <Tabs
          className="ml-auto"
          value={span}
          onChange={(v) => setSpan(v as Span)}
          items={[
            { id: "today", label: "Today" },
            { id: "lookahead", label: `Next ${lookaheadDays} days` },
          ]}
        />
      </div>

      <div className="overflow-x-auto">
        <div className="relative min-w-[900px]">
          <div className="grid grid-cols-[200px_minmax(0,1fr)] border-b border-(--color-border)">
            <span className="px-5 py-2 text-[10px] font-medium tracking-[.08em] text-(--color-muted) uppercase">
              Channel
            </span>
            <div className="relative h-[30px]">
              {win.ticks.map((t) => (
                <span
                  key={t.at}
                  className={cn(
                    "absolute inset-y-0 border-l border-(--color-border) px-1.5 py-2 text-[11px] font-medium whitespace-nowrap",
                    t.accent ? "text-(--color-accent)" : "text-(--color-muted)",
                  )}
                  style={{ left: pct(t.at - win.t0) }}
                >
                  {t.label}
                </span>
              ))}
            </div>
          </div>

          {rows.map((r) => {
            const games = r.games.filter((g) => {
              const s = Date.parse(g.start);
              return s + g.duration_min * 60_000 > win.t0 && s < win.t1;
            });
            const next = r.games.find((g) => Date.parse(g.start) >= win.t1);
            return (
              <div
                key={r.team_channel_id}
                className="grid grid-cols-[200px_minmax(0,1fr)] border-b border-(--color-border)"
              >
                <div className="flex min-w-0 items-center gap-2.5 px-5 py-2.5">
                  <TeamLogo
                    league={r.espn_league}
                    abbreviation={r.espn_team_abbr}
                    espnTeamId={r.espn_team_id}
                    teamName={r.team_name}
                    size={26}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">
                      {r.team_name}
                    </div>
                    <div className="font-mono text-[11px] text-(--color-muted)">
                      ch {channelNumber(r.dispatcharr_channel_id)}
                    </div>
                  </div>
                </div>
                <div
                  className="relative h-[50px] overflow-hidden"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, color-mix(in srgb, var(--color-border) 60%, transparent) 1px, transparent 1px)",
                    backgroundSize: `${100 / win.cells}% 100%`,
                  }}
                >
                  {games.map((g) => {
                    const s = Date.parse(g.start);
                    const style = TIMELINE_STATUS[g.status];
                    const id = g.event_id + r.team_channel_id;
                    const isSelected =
                      selected?.game.event_id === g.event_id &&
                      selected.row.team_channel_id === r.team_channel_id;
                    return (
                      <div key={g.event_id}>
                        <span
                          className="absolute top-[11px] h-7 rounded-l-[4px]"
                          style={{
                            left: pct(s - preMs - win.t0),
                            width: pct(preMs),
                            background: HATCH,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedId(id)}
                          aria-pressed={isSelected}
                          title={`${g.title} · ${fmtWeekdayTime(g.start)}`}
                          className={cn(
                            "absolute top-[11px] flex h-7 min-w-[84px] cursor-pointer items-center gap-[5px] overflow-hidden rounded-(--radius-sm) border px-2 text-[11px] font-medium whitespace-nowrap transition-shadow duration-150",
                            style.block,
                            isSelected && "ring-2 ring-(--color-accent)/45",
                          )}
                          style={{
                            left: pct(s - win.t0),
                            width: pct(g.duration_min * 60_000),
                          }}
                        >
                          {g.live && (
                            <span className="h-1.5 w-1.5 flex-none rounded-full bg-(--color-danger)" />
                          )}
                          {g.label}
                        </button>
                      </div>
                    );
                  })}
                  {games.length === 0 && next && (
                    <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-(--color-muted)">
                      Next: {fmtWeekdayTime(next.start)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {showNow && (
            <div className="pointer-events-none absolute inset-0 z-10 grid grid-cols-[200px_minmax(0,1fr)]">
              <span />
              <div className="relative">
                <span
                  className="absolute top-[22px] bottom-0 border-l-2 border-(--color-accent)"
                  style={{ left: pct(now - win.t0) }}
                />
                <span
                  className="absolute top-[7px] -translate-x-1/2 rounded-[4px] bg-(--color-accent) px-[5px] py-px text-[10px] font-semibold text-(--color-accent-foreground)"
                  style={{ left: pct(now - win.t0) }}
                >
                  NOW
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {rows.length === 0 && (
        <p className="px-5 py-8 text-center text-sm text-(--color-muted)">
          No tracked team channels yet.
        </p>
      )}

      {selected && (
        <SelectedGame row={selected.row} game={selected.game} now={now} />
      )}

      <div className="flex flex-wrap gap-4 border-t border-(--color-border) px-5 py-2.5 text-xs text-(--color-muted)">
        {(["ok", "warn", "override", "none"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className={cn(
                "h-2.5 w-4 rounded-[3px] border",
                TIMELINE_STATUS[s].block,
              )}
            />
            {
              {
                ok: "Stream ready",
                warn: "Needs a look",
                override: "Override",
                none: "Streams not listed yet",
              }[s]
            }
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-4 rounded-[3px]"
            style={{ background: HATCH }}
          />
          Pre-game window
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-(--color-danger)" />
          Live
        </span>
      </div>
    </Card>
  );
}

function SelectedGame({
  row,
  game,
  now,
}: {
  row: TimelineRow;
  game: TimelineGame;
  now: number;
}) {
  const status = TIMELINE_STATUS[game.status];
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-t border-(--color-border) bg-(--color-surface-raised) px-5 py-3.5">
      <TeamLogo
        league={row.espn_league}
        abbreviation={row.espn_team_abbr}
        espnTeamId={row.espn_team_id}
        teamName={row.team_name}
        size={32}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{game.title}</span>
          <span className="text-xs text-(--color-muted)">
            {fmtWeekdayTime(game.start)}
          </span>
          {game.live ? (
            <Badge className="bg-(--color-danger)/15 text-(--color-capture-failed-text)">
              Live
            </Badge>
          ) : (
            <Badge variant={status.variant}>{status.label}</Badge>
          )}
        </div>
        {game.stream_name ? (
          <HighlightedTitle
            title={game.stream_name}
            spans={game.spans}
            className="text-[11.5px] leading-normal"
          />
        ) : (
          <div className="font-mono text-[11.5px] text-(--color-muted)">
            No stream yet
          </div>
        )}
        <div className="text-xs text-(--color-muted)">
          {gameNote(game, now)}
        </div>
      </div>
      <Link
        to={`/teams/${row.team_channel_id}`}
        className="inline-flex flex-none items-center gap-1.5 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-(--color-foreground) transition-colors duration-150 hover:border-(--color-muted)"
      >
        Open team
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
