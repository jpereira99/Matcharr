import { TeamLogo } from "@/components/TeamLogo";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { api } from "@/lib/api";
import { dayKey, fmtDay, fmtTime, parseUtc, startOfDay } from "@/lib/date";
import { OUTCOMES } from "@/lib/outcomes";
import type { LogEntry, SwitchOutcome } from "@/lib/types";
import { cn } from "@/lib/utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

type Range = "today" | "7d" | "30d" | "all";
const RANGE_DAYS: Record<Range, number | null> = {
  today: 0,
  "7d": 6,
  "30d": 29,
  all: null,
};
const PAGE_SIZES = [10, 25, 50];
const OUTCOME_ORDER: SwitchOutcome[] = [
  "switched",
  "no_match",
  "failed",
  "override",
];

/** 1 … 4 5 6 … 12: first, last and current ±1. */
function pageList(page: number, pages: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) out.push(p);
    else if (out[out.length - 1] !== "…") out.push("…");
  }
  return out;
}

function fromLabel(e: LogEntry) {
  if (e.from_stream_name) return e.from_stream_name;
  return e.outcome === "switched" || e.outcome === "override"
    ? "Empty Stream"
    : "—";
}

export function ActivityLogPage() {
  const [params, setParams] = useSearchParams();
  const range = (params.get("range") as Range) || "7d";
  const teamId = params.get("team") ? Number(params.get("team")) : undefined;
  const leagueId = params.get("league")
    ? Number(params.get("league"))
    : undefined;
  const outcomes = params.getAll("outcome") as SwitchOutcome[];
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = PAGE_SIZES.includes(Number(params.get("size")))
    ? Number(params.get("size"))
    : 10;

  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDebouncedValue(search, 250);

  /** Apply filter changes; anything but a page change resets to page 1. */
  function update(patch: Record<string, string | string[] | null>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          next.delete(k);
          for (const item of Array.isArray(v) ? v : v === null ? [] : [v])
            next.append(k, item);
        }
        if (!("page" in patch)) next.delete("page");
        return next;
      },
      { replace: true },
    );
  }

  useEffect(() => {
    if ((params.get("q") ?? "") !== q) update({ q: q || null });
  }, [q]);

  const days = RANGE_DAYS[range] ?? null;
  const since = days === null ? undefined : startOfDay(days).toISOString();
  const logsQ = useQuery({
    queryKey: ["logs", q, teamId, leagueId, outcomes, since, page, pageSize],
    queryFn: () =>
      api.logs({
        q,
        team_channel_id: teamId,
        league_profile_id: leagueId,
        outcome: outcomes,
        since,
        page,
        page_size: pageSize,
      }),
    placeholderData: keepPreviousData,
  });
  const teamsQ = useQuery({
    queryKey: ["team-channels"],
    queryFn: api.listTeamChannels,
  });
  const profilesQ = useQuery({
    queryKey: ["profiles"],
    queryFn: api.listProfiles,
  });

  const teamById = useMemo(
    () => new Map((teamsQ.data ?? []).map((t) => [t.id, t])),
    [teamsQ.data],
  );
  const leagueByProfile = useMemo(
    () => new Map((profilesQ.data ?? []).map((p) => [p.id, p.espn_league])),
    [profilesQ.data],
  );

  const data = logsQ.data;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const hasFilters =
    !!q ||
    teamId !== undefined ||
    leagueId !== undefined ||
    outcomes.length > 0 ||
    range !== "7d";
  const todayKey = dayKey(new Date());

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">
          Activity Log
        </h1>
        <p className="mt-1 text-sm text-(--color-muted)">
          Stream switch attempts and outcomes.
        </p>
      </header>

      <Card className="flex flex-col gap-3.5 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-[1_1_240px]">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--color-muted)" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search streams or reasons…"
              className="py-[7px] pl-9 text-[13px]"
            />
          </div>
          <Select
            aria-label="Team"
            value={teamId ?? ""}
            onChange={(e) => update({ team: e.target.value || null })}
            className="py-[7px] text-[13px]"
          >
            <option value="">All teams</option>
            {(teamsQ.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.team_name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="League"
            value={leagueId ?? ""}
            onChange={(e) => update({ league: e.target.value || null })}
            className="py-[7px] text-[13px]"
          >
            <option value="">All leagues</option>
            {(profilesQ.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Tabs
            value={range}
            onChange={(v) => update({ range: v === "7d" ? null : v })}
            items={[
              { id: "today", label: "Today" },
              { id: "7d", label: "7 days" },
              { id: "30d", label: "30 days" },
              { id: "all", label: "All" },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-(--color-muted)">Outcome</span>
          {OUTCOME_ORDER.map((o) => {
            const meta = OUTCOMES[o];
            const on = outcomes.includes(o);
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  update({
                    outcome: on
                      ? outcomes.filter((x) => x !== o)
                      : [...outcomes, o],
                  })
                }
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-(--radius-sm) border px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                  on
                    ? cn(meta.active, "text-(--color-foreground)")
                    : "border-(--color-border) text-(--color-text-secondary) hover:text-(--color-foreground)",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                {meta.label}
                <span className="text-(--color-muted) tabular-nums">
                  {data?.counts_by_outcome[o] ?? 0}
                </span>
              </button>
            );
          })}
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setParams({}, { replace: true });
              }}
              className="ml-auto cursor-pointer text-xs font-medium text-(--color-accent) hover:text-(--color-accent-hover)"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {logsQ.isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : logsQ.isError ? (
          <p className="p-5 text-sm text-(--color-danger)">
            {logsQ.error.message}
          </p>
        ) : !data?.items.length ? (
          <EmptyState
            icon={Activity}
            title="No events"
            description="No log entries match your filters."
          />
        ) : (
          <div className={cn(logsQ.isPlaceholderData && "opacity-60")}>
            {data.items.map((e, i) => {
              const at = parseUtc(e.switched_at);
              const key = dayKey(at);
              const newDay =
                i === 0 ||
                dayKey(parseUtc(data.items[i - 1].switched_at)) !== key;
              const tc = teamById.get(e.team_channel_id);
              const meta = OUTCOMES[e.outcome] ?? OUTCOMES.switched;
              return (
                <Fragment key={e.id}>
                  {newDay && (
                    <div className="border-b border-(--color-border) bg-(--color-surface-raised) px-5 py-2 text-xs font-semibold text-(--color-text-secondary)">
                      {key === todayKey ? "Today · " : ""}
                      {fmtDay(at.toISOString())}
                    </div>
                  )}
                  <div className="flex flex-col gap-2 border-b border-(--color-border) px-5 py-3 transition-colors duration-150 hover:bg-(--color-surface-raised)/50">
                    <div className="flex items-center gap-3">
                      <span className="w-16 flex-none font-mono text-xs text-(--color-muted)">
                        {fmtTime(at)}
                      </span>
                      {tc ? (
                        <TeamLogo
                          league={
                            leagueByProfile.get(tc.league_profile_id) ?? ""
                          }
                          abbreviation={tc.espn_team_abbr}
                          espnTeamId={tc.espn_team_id}
                          teamName={tc.team_name}
                          size={22}
                        />
                      ) : (
                        <span className="h-[22px] w-[22px] flex-none" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                        {e.team_name ?? "Removed team"}
                      </span>
                      <Badge variant={meta.variant} className="flex-none">
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="flex min-w-0 flex-col gap-[3px] pl-[76px]">
                      <div className="flex items-start gap-1.5 font-mono text-xs leading-normal break-words text-(--color-foreground)">
                        <ArrowRight className="mt-[3px] h-3 w-3 flex-none text-(--color-accent)" />
                        <span className="min-w-0">
                          {e.to_stream_name ?? "—"}
                        </span>
                      </div>
                      <div className="text-xs break-words text-(--color-muted)">
                        from <span className="font-mono">{fromLabel(e)}</span> ·{" "}
                        {e.reason}
                      </div>
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <span className="text-xs text-(--color-muted)">
            {total
              ? `Showing ${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, total)} of ${total}`
              : "0 events"}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-(--color-muted)">
            Rows
            <Select
              value={pageSize}
              onChange={(e) => update({ size: e.target.value })}
              className="gap-1 px-2 py-[3px] text-xs"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
          <nav
            aria-label="Pagination"
            className="ml-auto flex items-center gap-1"
          >
            <PageButton
              label="Previous page"
              disabled={current <= 1}
              onClick={() => update({ page: String(current - 1) })}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </PageButton>
            {pageList(current, pages).map((p, i) =>
              p === "…" ? (
                <span
                  key={`gap-${i}`}
                  className="flex h-[30px] min-w-[30px] items-center justify-center rounded-(--radius-sm) border border-(--color-border) text-xs text-(--color-muted)"
                >
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  aria-current={p === current ? "page" : undefined}
                  onClick={() => update({ page: String(p) })}
                  className={cn(
                    "h-[30px] min-w-[30px] cursor-pointer rounded-(--radius-sm) border px-2 text-xs font-medium tabular-nums",
                    p === current
                      ? "border-(--color-accent) bg-(--color-surface-raised) text-(--color-foreground)"
                      : "border-(--color-border) text-(--color-text-secondary) hover:text-(--color-foreground)",
                  )}
                >
                  {p}
                </button>
              ),
            )}
            <PageButton
              label="Next page"
              disabled={current >= pages}
              onClick={() => update({ page: String(current + 1) })}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </PageButton>
          </nav>
        </div>
      </Card>
    </div>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-[30px] w-[30px] items-center justify-center rounded-(--radius-sm) border border-(--color-border)",
        disabled
          ? "cursor-default text-(--color-border-strong)"
          : "cursor-pointer text-(--color-foreground) hover:border-(--color-muted)",
      )}
    >
      {children}
    </button>
  );
}
