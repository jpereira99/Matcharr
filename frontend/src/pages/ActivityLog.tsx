import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

function reasonVariant(
  reason: string,
): "success" | "warning" | "danger" | "muted" {
  const r = reason.toLowerCase();
  if (r.includes("error") || r.includes("fail")) return "danger";
  if (r.includes("no match") || r.includes("outside")) return "warning";
  if (r.includes("match") || r.includes("routed") || r.includes("switch"))
    return "success";
  return "muted";
}

export function ActivityLogPage() {
  const q = useQuery({ queryKey: ["logs"], queryFn: () => api.logs(200) });
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!q.data) return [];
    if (!search.trim()) return q.data;
    const term = search.toLowerCase();
    return q.data.filter((row) => {
      const team = String(row.team_name ?? "").toLowerCase();
      const from = String(row.from_stream_name ?? "").toLowerCase();
      const to = String(row.to_stream_name ?? "").toLowerCase();
      const reason = String(row.reason ?? "").toLowerCase();
      return (
        team.includes(term) ||
        from.includes(term) ||
        to.includes(term) ||
        reason.includes(term)
      );
    });
  }, [q.data, search]);

  if (q.isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-96" />
      </div>
    );
  if (q.isError)
    return (
      <div className="text-(--color-danger)">Failed to load logs</div>
    );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight font-heading">
          Activity Log
        </h1>
        <p className="mt-1 text-sm text-(--color-muted)">
          Stream switch attempts and outcomes.
        </p>
      </header>

      {/* Filter */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-muted)" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by team, stream, or reason..."
          className="pl-9"
          inputSize="sm"
        />
      </div>

      <Card>
        <CardTitle>
          Recent Events{" "}
          {filtered.length !== (q.data?.length ?? 0) && (
            <span className="text-sm font-normal text-(--color-muted)">
              ({filtered.length} of {q.data?.length})
            </span>
          )}
        </CardTitle>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No events"
            description={
              search
                ? "No log entries match your filter."
                : "No stream switch events have been recorded yet."
            }
          />
        ) : (
          <div className="relative mt-5 ml-3 border-l-2 border-(--color-border) pl-6">
            {filtered.map((row, i) => {
              const reason = String(row.reason ?? "");
              return (
                <div key={i} className="relative pb-6 last:pb-0">
                  {/* Timeline dot */}
                  <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-(--color-border) bg-(--color-surface)">
                    <span className="h-1.5 w-1.5 rounded-full bg-(--color-accent)" />
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-(--color-muted)">
                      {String(row.switched_at)}
                    </span>
                    {row.team_name && (
                      <span className="text-sm font-medium text-(--color-foreground)">
                        {String(row.team_name)}
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex items-center gap-1.5 font-mono text-xs">
                    <span className="text-(--color-muted) truncate max-w-[200px]">
                      {String(row.from_stream_name ?? "—")}
                    </span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-(--color-accent)" />
                    <span className="text-(--color-foreground) truncate max-w-[200px]">
                      {String(row.to_stream_name ?? "—")}
                    </span>
                  </div>

                  <div className="mt-1.5">
                    <Badge variant={reasonVariant(reason)}>{reason}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
