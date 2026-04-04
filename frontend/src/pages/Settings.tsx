import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/ui/status-dot";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { api } from "@/lib/api";
import type { AppSettings } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Plug, Save, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

export function SettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const [form, setForm] = useState<AppSettings | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (q.data && !form) setForm(q.data);
  }, [q.data, form]);

  const save = useMutation({
    mutationFn: (body: AppSettings) => api.putSettings(body),
    onSuccess: (data) => {
      setForm(data);
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const test = useMutation({
    mutationFn: () =>
      api.testDispatcharr(form?.dispatcharr_url, form?.dispatcharr_token),
  });

  function update(patch: Partial<AppSettings>) {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  }

  if (q.isLoading || !form) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (q.isError) {
    return <div className="text-(--color-danger)">Failed to load settings</div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">
          Settings
        </h1>
        <p className="mt-1 text-sm text-(--color-muted)">
          Configure Dispatcharr connection and scheduler behavior.
        </p>
      </header>

      {/* Connection */}
      <Card>
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-(--color-muted)" />
          <CardTitle>Connection</CardTitle>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="dispatcharr-url">Dispatcharr URL</Label>
            <Input
              id="dispatcharr-url"
              value={form.dispatcharr_url}
              onChange={(e) => update({ dispatcharr_url: e.target.value })}
              placeholder="http://dispatcharr.local:8400"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="dispatcharr-token">API Token</Label>
            <Input
              id="dispatcharr-token"
              type="password"
              value={form.dispatcharr_token}
              onChange={(e) => update({ dispatcharr_token: e.target.value })}
              placeholder="Bearer or API key"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => test.mutate()}
            disabled={test.isPending}
          >
            {test.isPending ? "Testing..." : "Test Connection"}
          </Button>
          {test.isSuccess && test.data && (
            <span className="flex items-center gap-1.5 text-sm">
              {test.data.ok ? (
                <>
                  <CheckCircle className="h-4 w-4 text-(--color-success)" />
                  <span className="text-(--color-success)">
                    {test.data.message}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-(--color-danger)" />
                  <span className="text-(--color-danger)">
                    {test.data.message}
                  </span>
                </>
              )}
            </span>
          )}
          {test.isError && (
            <span className="flex items-center gap-1.5 text-sm text-(--color-danger)">
              <XCircle className="h-4 w-4" />
              {(test.error as Error)?.message ?? "Test failed"}
            </span>
          )}
        </div>
      </Card>

      {/* Schedule */}
      <Card>
        <div className="flex items-center gap-2">
          <StatusDot status="online" />
          <CardTitle>Schedule</CardTitle>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="scan-interval">Scan Interval (minutes)</Label>
            <Input
              id="scan-interval"
              type="number"
              min={1}
              max={1440}
              value={form.scan_interval_minutes}
              onChange={(e) =>
                update({ scan_interval_minutes: +e.target.value })
              }
            />
            <p className="mt-1 text-xs text-(--color-muted)">
              How often the scheduler checks for games to route.
            </p>
          </div>
          <div>
            <Label htmlFor="pre-game">Pre-Game Window (minutes)</Label>
            <Input
              id="pre-game"
              type="number"
              min={0}
              max={1440}
              value={form.pre_game_minutes}
              onChange={(e) => update({ pre_game_minutes: +e.target.value })}
            />
            <p className="mt-1 text-xs text-(--color-muted)">
              Start routing this many minutes before game time.
            </p>
          </div>
          <div>
            <Label htmlFor="lookahead">Schedule Lookahead (days)</Label>
            <Input
              id="lookahead"
              type="number"
              min={1}
              max={14}
              value={form.schedule_lookahead_days}
              onChange={(e) =>
                update({ schedule_lookahead_days: +e.target.value })
              }
            />
            <p className="mt-1 text-xs text-(--color-muted)">
              How many days ahead to fetch from ESPN.
            </p>
          </div>
          <div>
            <Label htmlFor="refresh">Schedule Refresh (hours)</Label>
            <Input
              id="refresh"
              type="number"
              min={1}
              max={168}
              value={form.schedule_refresh_hours}
              onChange={(e) =>
                update({ schedule_refresh_hours: +e.target.value })
              }
            />
            <p className="mt-1 text-xs text-(--color-muted)">
              Minimum hours between ESPN schedule re-fetches.
            </p>
          </div>
        </div>
      </Card>

      {/* Display */}
      <Card>
        <CardTitle>Display</CardTitle>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={form.timezone}
              onChange={(e) => update({ timezone: e.target.value })}
              placeholder="America/New_York"
            />
            <p className="mt-1 text-xs text-(--color-muted)">
              IANA timezone for schedule display.
            </p>
          </div>
          <div>
            <Label>Theme</Label>
            <div className="mt-1">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </Card>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 -mx-5 border-t border-(--color-border) bg-(--color-background)/95 px-5 py-3 backdrop-blur-sm md:-mx-8 md:px-8 lg:-mx-10 lg:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-sm text-(--color-muted)">
            {dirty ? "You have unsaved changes." : "All changes saved."}
          </span>
          <Button
            type="button"
            size="sm"
            disabled={!dirty || save.isPending}
            onClick={() => form && save.mutate(form)}
          >
            <Save className="h-3.5 w-3.5" />
            {save.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
