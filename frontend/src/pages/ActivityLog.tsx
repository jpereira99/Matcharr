import { Card, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function ActivityLogPage() {
  const q = useQuery({ queryKey: ["logs"], queryFn: () => api.logs(200) });

  if (q.isLoading) return <div className="text-[var(--color-muted)]">Loading…</div>;
  if (q.isError) return <div className="text-red-400">Failed to load logs</div>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Activity log</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Stream switch attempts and outcomes.</p>
      </header>

      <Card>
        <CardTitle>Recent events</CardTitle>
        <div className="mt-4 space-y-2">
          {q.data?.map((row, i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-black/25 p-4 font-mono text-xs">
              <div className="flex flex-wrap justify-between gap-2 text-[var(--color-muted)]">
                <span>{String(row.switched_at)}</span>
                <span>{String(row.team_name ?? "")}</span>
              </div>
              <div className="mt-2 text-sm text-[var(--color-foreground)]">
                {String(row.from_stream_name ?? "—")} → {String(row.to_stream_name ?? "—")}
              </div>
              <div className="mt-1 text-[var(--color-muted)]">{String(row.reason)}</div>
            </div>
          ))}
          {!q.data?.length && <p className="text-sm text-[var(--color-muted)]">No entries.</p>}
        </div>
      </Card>
    </div>
  );
}
