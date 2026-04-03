import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { AppSettings } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";

export function SettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const [form, setForm] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (q.data) setForm(q.data);
  }, [q.data]);

  const save = useMutation({
    mutationFn: (body: AppSettings) => api.putSettings(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  const test = useMutation({
    mutationFn: () => api.testDispatcharr(form?.dispatcharr_url, form?.dispatcharr_token),
  });

  if (q.isLoading || !form) return <div className="text-[var(--color-muted)]">Loading…</div>;
  if (q.isError) return <div className="text-red-400">Failed to load settings</div>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Dispatcharr connection, scan intervals, and schedule lookahead.
        </p>
      </header>

      <Card>
        <CardTitle>Dispatcharr</CardTitle>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Base URL</Label>
            <Input
              value={form.dispatcharr_url}
              onChange={(e) => setForm({ ...form, dispatcharr_url: e.target.value })}
              placeholder="http://dispatcharr:8000"
            />
          </div>
          <div className="md:col-span-2">
            <Label>API token</Label>
            <Input
              type="password"
              value={form.dispatcharr_token}
              onChange={(e) => setForm({ ...form, dispatcharr_token: e.target.value })}
              placeholder="JWT access token or API key (Copy API Key)"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" variant="ghost" onClick={() => test.mutate()} disabled={test.isPending}>
            {test.isPending ? "Testing…" : "Test connection"}
          </Button>
          {test.data && (
            <div className="min-w-0 flex-1 space-y-2">
              <span className={`text-sm ${test.data.ok ? "text-[var(--color-success)]" : "text-red-400"}`}>
                {test.data.message}
              </span>
              {!test.data.ok && test.data.detail && Object.keys(test.data.detail).length > 0 && (
                <pre className="max-h-48 overflow-auto rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs leading-relaxed text-[var(--color-muted)]">
                  {JSON.stringify(test.data.detail, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Routing</CardTitle>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label>Timezone (IANA)</Label>
            <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </div>
          <div>
            <Label>Scan interval (minutes)</Label>
            <Input
              type="number"
              value={form.scan_interval_minutes}
              onChange={(e) => setForm({ ...form, scan_interval_minutes: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Pre-game window (minutes)</Label>
            <Input
              type="number"
              value={form.pre_game_minutes}
              onChange={(e) => setForm({ ...form, pre_game_minutes: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Schedule lookahead (days)</Label>
            <Input
              type="number"
              value={form.schedule_lookahead_days}
              onChange={(e) => setForm({ ...form, schedule_lookahead_days: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Schedule refresh (hours)</Label>
            <Input
              type="number"
              value={form.schedule_refresh_hours}
              onChange={(e) => setForm({ ...form, schedule_refresh_hours: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={() => save.mutate(form)} disabled={save.isPending}>
            <Save className="h-4 w-4" />
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
