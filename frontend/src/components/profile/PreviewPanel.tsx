import { HighlightedTitle } from "@/components/HighlightedTitle";
import { BigStat, StackedBar } from "@/components/StatSummary";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { fmtDay, fmtTime, isToday } from "@/lib/date";
import type { PreviewResult } from "@/lib/patterns";
import type { Span, StreamCheckGame } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CircleAlert } from "lucide-react";
import { useMemo, useState } from "react";

const MAX_ROWS = 200;

type Group = "matched" | "skipped" | "other";
type Tone = "ok" | "warn" | "bad" | "muted";

type Row = {
  id: number;
  title: string;
  spans: Span[];
  dim: boolean;
  badge: string;
  variant: BadgeVariant;
  status: string;
  strong: boolean;
  group: Group;
  tone: Tone;
};

export type PreviewItem = {
  stream: { id: number; name: string };
  result: PreviewResult;
};

function gameLabel(g: StreamCheckGame) {
  const when = isToday(g.game_time)
    ? fmtTime(g.game_time)
    : `${fmtDay(g.game_time)} ${fmtTime(g.game_time)}`;
  return `${g.home_short} vs ${g.away_short} · ${when}`;
}

function toRows(items: PreviewItem[]): Row[] {
  const perGame = new Map<string, number>();
  for (const { result } of items)
    if (result.kind === "matched")
      perGame.set(result.game.id, (perGame.get(result.game.id) ?? 0) + 1);

  return items.map(({ stream, result: r }) => {
    const base = {
      id: stream.id,
      title: stream.name,
      spans: "spans" in r ? r.spans : [],
      dim: r.kind === "skipped" || r.kind === "nofit",
    };
    switch (r.kind) {
      case "matched": {
        const n = perGame.get(r.game.id) ?? 0;
        return n > 1
          ? {
              ...base,
              badge: "Conflict",
              variant: "warning",
              status: `${n} streams fit ${r.game.home_short} vs ${r.game.away_short}. Add a skip term.`,
              strong: true,
              group: "matched",
              tone: "warn",
            }
          : {
              ...base,
              badge: "Matched",
              variant: "success",
              status: gameLabel(r.game),
              strong: true,
              group: "matched",
              tone: "ok",
            };
      }
      case "skipped":
        return {
          ...base,
          badge: "Skipped",
          variant: "danger",
          status: `contains ${r.term}`,
          strong: false,
          group: "skipped",
          tone: "bad",
        };
      case "nofit":
        return {
          ...base,
          badge: "No fit",
          variant: "muted",
          status: "doesn't fit the title format",
          strong: false,
          group: "other",
          tone: "muted",
        };
      case "noteam":
        return {
          ...base,
          badge: "No game",
          variant: "muted",
          status: `no upcoming ESPN game for “${r.groups.home}” vs “${r.groups.away}”`,
          strong: false,
          group: "other",
          tone: "muted",
        };
      case "fit":
        return {
          ...base,
          badge: "Fits",
          variant: "muted",
          status: "tag a Home and an Away to check teams",
          strong: false,
          group: "other",
          tone: "muted",
        };
      case "error":
        return {
          ...base,
          badge: "Error",
          variant: "danger",
          status: r.message,
          strong: false,
          group: "other",
          tone: "muted",
        };
    }
  });
}

type Props = {
  items: PreviewItem[];
  gameCount: number;
  loading: boolean;
  error: string | null;
};

export function PreviewPanel({ items, gameCount, loading, error }: Props) {
  const [filter, setFilter] = useState<"all" | Group>("all");
  const rows = useMemo(() => toRows(items), [items]);

  const tone = (t: Tone) => rows.filter((r) => r.tone === t).length;
  const count = (g: Group) => rows.filter((r) => r.group === g).length;
  const visible =
    filter === "all" ? rows : rows.filter((r) => r.group === filter);
  const nOk = tone("ok");
  const nConflict = tone("warn");

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-(--radius-lg) border border-(--color-border)">
      <div className="flex flex-col gap-3 border-b border-(--color-border) px-5 py-4">
        <div className="flex flex-wrap items-end gap-5">
          <BigStat
            value={nOk}
            label="ready to route"
            colorClass="text-(--color-success)"
          />
          {nConflict > 0 && (
            <BigStat
              value={nConflict}
              label="in conflict"
              colorClass="text-(--color-warning)"
            />
          )}
          <div className="ml-auto text-right text-xs text-(--color-muted)">
            {rows.length} streams checked
            <br />
            against {gameCount} upcoming ESPN game{gameCount === 1 ? "" : "s"}
          </div>
        </div>
        <StackedBar
          segments={[
            { count: nOk, colorClass: "bg-(--color-success)" },
            { count: nConflict, colorClass: "bg-(--color-warning)" },
            { count: tone("bad"), colorClass: "bg-(--color-danger)" },
            { count: tone("muted"), colorClass: "bg-(--color-border-strong)" },
          ]}
        />
        <Tabs
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          className="flex-wrap self-start"
          items={[
            { id: "all", label: `All ${rows.length}` },
            { id: "matched", label: `Matched ${count("matched")}` },
            { id: "skipped", label: `Skipped ${count("skipped")}` },
            { id: "other", label: `No match ${count("other")}` },
          ]}
        />
      </div>

      <div className="min-h-0 overflow-y-auto">
        {error ? (
          <div className="flex items-start gap-2 px-5 py-6 text-xs text-(--color-foreground)">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 flex-none text-(--color-warning)" />
            <span>Couldn&apos;t load streams from Dispatcharr: {error}</span>
          </div>
        ) : loading ? (
          [1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-2 border-b border-(--color-border) px-5 py-3"
            >
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))
        ) : visible.length === 0 ? (
          <div className="px-5 py-6 text-xs text-(--color-muted)">
            Nothing in this view.
          </div>
        ) : (
          <>
            {visible.slice(0, MAX_ROWS).map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-1.5 border-b border-(--color-border) px-5 py-3 last:border-b-0"
              >
                <HighlightedTitle title={r.title} spans={r.spans} dim={r.dim} />
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant={r.variant} className="flex-none">
                    {r.badge}
                  </Badge>
                  <span
                    className={cn(
                      r.strong
                        ? "text-(--color-foreground)"
                        : "text-(--color-muted)",
                    )}
                  >
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
            {visible.length > MAX_ROWS && (
              <div className="px-5 py-3 text-xs text-(--color-muted)">
                Showing the first {MAX_ROWS} of {visible.length}. Narrow the
                stream filters to see the rest.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
