import { AddChip, Chip } from "@/components/ChipEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { useTheme } from "@/hooks/useTheme";
import { api } from "@/lib/api";
import { fmtAgo, fmtTime, fmtWeekdayTime, isToday } from "@/lib/date";
import type { ThemePreference } from "@/lib/theme";
import type { AppSettings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleCheck,
  Clock,
  Eye,
  EyeOff,
  Monitor,
  Moon,
  Plug,
  Route,
  Save,
  Sun,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

/** Mirrors DispatcharrClient._looks_like_jwt: three non-empty dot-separated parts. */
function looksLikeJwt(token: string) {
  const parts = token.trim().split(".");
  return parts.length === 3 && parts.every((p) => p.trim());
}

function tzLabel(tz: string, at: Date) {
  const part = (style: "shortOffset" | "shortGeneric") =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: style })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  const offset = part("shortOffset").replace("GMT", "UTC").replace("-", "−");
  const generic = part("shortGeneric");
  const short =
    generic.length <= 4 && !generic.startsWith("GMT") ? generic : "";
  return `${tz} (${short ? `${short}, ` : ""}${offset || "UTC"})`;
}

function useTimeZones(current: string) {
  return useMemo(() => {
    const now = new Date();
    const zones: string[] =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [];
    const all = zones.includes(current) ? zones : [current, ...zones];
    if (!all.includes("UTC")) all.push("UTC");
    return all.map((tz) => ({ tz, label: tzLabel(tz, now) }));
  }, [current]);
}

function SettingsCard({
  icon: Icon,
  title,
  subtitle,
  right,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-(--radius-md) bg-(--color-accent)/15 text-(--color-accent)">
          <Icon className="h-[13px] w-[13px]" />
        </span>
        <h2 className="font-heading text-base font-extrabold tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <span className="text-xs text-(--color-muted)">{subtitle}</span>
        )}
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children}
    </Card>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          className="w-[90px]"
        />
        <span className="text-[13px] text-(--color-muted)">{suffix}</span>
      </div>
    </div>
  );
}

const AFTER_GAME: {
  id: AppSettings["after_game_action"];
  label: string;
  hint: string;
}[] = [
  {
    id: "leave",
    label: "Leave the stream",
    hint: "Channel keeps the game stream until the next routing.",
  },
  {
    id: "restore",
    label: "Restore previous",
    hint: "Switch back to what was on before routing started.",
  },
  {
    id: "clear",
    label: "Clear the channel",
    hint: "Remove all streams from the channel.",
  },
];

export function SettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const healthQ = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 60_000,
  });
  const accountsQ = useQuery({
    queryKey: ["m3u-accounts"],
    queryFn: api.m3uAccounts,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const { preference, setTheme } = useTheme();
  const [form, setForm] = useState<AppSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (q.data && !form) setForm(q.data);
  }, [q.data, form]);
  const zones = useTimeZones(form?.timezone ?? "UTC");

  const save = useMutation({
    mutationFn: (body: AppSettings) => api.putSettings(body),
    onSuccess: (data) => {
      setForm(data);
      setDirty(false);
      qc.setQueryData(["settings"], data);
      void qc.invalidateQueries({ queryKey: ["health"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
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

  if (q.isError)
    return <div className="text-(--color-danger)">Failed to load settings</div>;
  if (q.isLoading || !form)
    return (
      <div className="flex max-w-[880px] flex-col gap-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-80" />
      </div>
    );

  const health = healthQ.data;
  const configured = !!(q.data?.dispatcharr_url && q.data?.dispatcharr_token);
  const connection = !configured
    ? {
        text: "Not configured",
        tone: "text-(--color-muted)",
        dot: "bg-(--color-muted)",
      }
    : health?.dispatcharr_reachable
      ? {
          text: `Connected${health.dispatcharr_latency_ms != null ? ` · ${health.dispatcharr_latency_ms} ms` : ""} · ${fmtAgo(health.dispatcharr_checked_at)}`,
          tone: "text-(--color-success)",
          dot: "bg-(--color-success)",
        }
      : health
        ? {
            text: "Unreachable",
            tone: "text-(--color-warning)",
            dot: "bg-(--color-warning)",
          }
        : null;

  const scanChanged =
    form.scan_interval_minutes !== q.data?.scan_interval_minutes;
  const nextScan = scanChanged
    ? new Date(Date.now() + form.scan_interval_minutes * 60_000).toISOString()
    : health?.next_scan_at;
  const jwt = looksLikeJwt(form.dispatcharr_token);
  const testDetail = test.data?.detail;

  return (
    <div className="flex max-w-[880px] flex-col gap-5">
      <header>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">
          Settings
        </h1>
        <p className="mt-1 text-sm text-(--color-muted)">
          Dispatcharr connection, routing rules, and scheduler behavior.
        </p>
      </header>

      <SettingsCard
        icon={Plug}
        title="Connection"
        right={
          connection && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs",
                connection.tone,
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", connection.dot)} />
              {connection.text}
            </span>
          )
        }
      >
        <div>
          <Label htmlFor="dispatcharr-url">Dispatcharr URL</Label>
          <Input
            id="dispatcharr-url"
            value={form.dispatcharr_url}
            onChange={(e) => update({ dispatcharr_url: e.target.value })}
            placeholder="http://dispatcharr:9191"
          />
        </div>
        <div>
          <Label htmlFor="dispatcharr-token">API Token</Label>
          <div className="flex items-center rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) pr-1 transition-all duration-150 focus-within:border-(--color-accent) focus-within:ring-2 focus-within:ring-(--color-accent)/30">
            <input
              id="dispatcharr-token"
              type={showToken ? "text" : "password"}
              value={form.dispatcharr_token}
              onChange={(e) => update({ dispatcharr_token: e.target.value })}
              spellCheck={false}
              autoComplete="off"
              placeholder="API key or JWT access token"
              className="min-w-0 flex-1 border-none bg-transparent px-3 py-2 font-mono text-[13px] text-(--color-foreground) outline-none placeholder:font-sans placeholder:text-(--color-muted) focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              aria-label={showToken ? "Hide token" : "Show token"}
              className="flex cursor-pointer rounded-(--radius-sm) p-1.5 text-(--color-muted) transition-colors duration-150 hover:bg-(--color-surface-raised) hover:text-(--color-foreground)"
            >
              {showToken ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-1 text-xs text-(--color-muted)">
            {form.dispatcharr_token.trim() ? (
              <>
                Detected as {jwt ? "a JWT access token" : "an API key"}. Sent as{" "}
                <span className="font-mono text-(--color-foreground)">
                  Authorization: {jwt ? "Bearer" : "ApiKey"} …
                </span>
              </>
            ) : (
              "Paste a Dispatcharr API key or a JWT access token."
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => test.mutate()}
            disabled={test.isPending}
          >
            {test.isPending ? "Testing..." : "Test Connection"}
          </Button>
          {test.data?.ok && (
            <span className="flex items-center gap-1.5 text-[13px] text-(--color-success)">
              <CircleCheck className="h-4 w-4" />
              OK
              {testDetail?.streams != null &&
                ` · ${testDetail.streams} streams, ${testDetail.channels ?? 0} channels visible`}
            </span>
          )}
          {(test.data && !test.data.ok) || test.isError ? (
            <span className="flex items-center gap-1.5 text-[13px] text-(--color-danger)">
              <XCircle className="h-4 w-4" />
              {test.data?.message ?? test.error?.message ?? "Test failed"}
            </span>
          ) : null}
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Route}
        title="Routing"
        subtitle="Defaults for every team channel"
      >
        <div
          className="grid gap-3.5"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          }}
        >
          <NumberField
            id="pre-game"
            label="Start routing"
            value={form.pre_game_minutes}
            min={0}
            max={1440}
            suffix="min before kickoff"
            onChange={(v) => update({ pre_game_minutes: v })}
          />
          <div>
            <Label>Stop routing</Label>
            <Tabs
              className="w-max"
              value={form.routing_stop_mode}
              onChange={(v) =>
                update({
                  routing_stop_mode: v as AppSettings["routing_stop_mode"],
                })
              }
              items={[
                { id: "final", label: "When ESPN marks it final" },
                { id: "fixed", label: "Fixed time" },
              ]}
            />
            {form.routing_stop_mode === "fixed" && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  aria-label="Hours after kickoff"
                  type="number"
                  min={1}
                  max={12}
                  inputSize="sm"
                  value={form.routing_stop_hours}
                  onChange={(e) =>
                    update({ routing_stop_hours: +e.target.value })
                  }
                  className="w-[70px] text-[13px]"
                />
                <span className="text-xs text-(--color-muted)">
                  hours after kickoff
                </span>
              </div>
            )}
          </div>
        </div>

        <div>
          <Label className="mb-1.5">After the game ends</Label>
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
            }}
          >
            {AFTER_GAME.map((o) => {
              const on = form.after_game_action === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update({ after_game_action: o.id })}
                  className={cn(
                    "flex cursor-pointer flex-col gap-[3px] rounded-(--radius-md) border px-3 py-2.5 text-left transition-colors duration-150",
                    on
                      ? "border-(--color-accent) bg-(--color-accent)/6"
                      : "border-(--color-border) hover:border-(--color-muted)",
                  )}
                >
                  <span className="text-[13px] font-semibold">{o.label}</span>
                  <span className="text-xs text-(--color-muted)">{o.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label htmlFor="tie-break" className="mb-1.5">
            When several streams fit
          </Label>
          <div className="flex flex-wrap gap-2">
            <Select
              id="tie-break"
              wrapperClassName="w-full max-w-[420px]"
              value={form.tie_break}
              onChange={(e) =>
                update({
                  tie_break: e.target.value as AppSettings["tie_break"],
                })
              }
            >
              <option value="closest_time">
                Pick the one whose start time is closest to kickoff
              </option>
              <option value="first_listed">
                Pick the one listed first in Dispatcharr
              </option>
              <option value="prefer_account">
                Prefer a specific M3U account
              </option>
            </Select>
            {form.tie_break === "prefer_account" && (
              <Select
                aria-label="Preferred M3U account"
                wrapperClassName="w-full max-w-[260px]"
                value={form.preferred_m3u_account_id ?? ""}
                onChange={(e) =>
                  update({
                    preferred_m3u_account_id: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              >
                <option value="">Choose an account…</option>
                {(accountsQ.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <p className="mt-1 text-xs text-(--color-muted)">
            {form.tie_break === "prefer_account"
              ? "Streams from this account win ties, then the closest start time. "
              : ""}
            You can still override any game from its team page.
          </p>
        </div>

        <div className="border-t border-(--color-border) pt-4">
          <Label className="mb-1">Default skip terms</Label>
          <p className="mb-2.5 text-xs text-(--color-muted)">
            New league profiles start with these. Each profile can add or remove
            its own.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {form.default_exclude_terms.map((t) => (
              <Chip
                key={t}
                term={t}
                tone="danger"
                onRemove={() =>
                  update({
                    default_exclude_terms: form.default_exclude_terms.filter(
                      (x) => x !== t,
                    ),
                  })
                }
              />
            ))}
            <AddChip
              placeholder="(Alt)"
              onAdd={(t) => {
                if (
                  !form.default_exclude_terms.some(
                    (x) => x.toLowerCase() === t.toLowerCase(),
                  )
                )
                  update({
                    default_exclude_terms: [...form.default_exclude_terms, t],
                  });
              }}
            />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard icon={Clock} title="Scheduler">
        <div
          className="grid gap-3.5"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          }}
        >
          <NumberField
            id="scan-interval"
            label="Check streams every"
            value={form.scan_interval_minutes}
            min={1}
            max={1440}
            suffix="minutes"
            onChange={(v) => update({ scan_interval_minutes: v })}
          />
          <NumberField
            id="lookahead"
            label="Look ahead"
            value={form.schedule_lookahead_days}
            min={1}
            max={14}
            suffix="days of ESPN games"
            onChange={(v) => update({ schedule_lookahead_days: v })}
          />
          <NumberField
            id="refresh"
            label="Refresh ESPN every"
            value={form.schedule_refresh_hours}
            min={1}
            max={168}
            suffix="hours"
            onChange={(v) => update({ schedule_refresh_hours: v })}
          />
        </div>
        <p className="text-xs text-(--color-muted)">
          With these values the next stream check is{" "}
          <span className="text-(--color-foreground)">
            {nextScan
              ? isToday(nextScan)
                ? `at ${fmtTime(nextScan)}`
                : fmtWeekdayTime(nextScan)
              : "not scheduled"}
          </span>
          , and the Dashboard timeline shows{" "}
          <span className="text-(--color-foreground)">
            {form.schedule_lookahead_days} day
            {form.schedule_lookahead_days === 1 ? "" : "s"}
          </span>
          .
        </p>
      </SettingsCard>

      <SettingsCard icon={Monitor} title="Display">
        <div
          className="grid gap-3.5"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          }}
        >
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              id="timezone"
              value={form.timezone}
              onChange={(e) => update({ timezone: e.target.value })}
            >
              {zones.map((z) => (
                <option key={z.tz} value={z.tz}>
                  {z.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-(--color-muted)">
              Used for game times and the timeline.
            </p>
          </div>
          <div>
            <Label>Theme</Label>
            <Tabs
              className="w-max"
              value={preference}
              onChange={(v) => setTheme(v as ThemePreference)}
              items={[
                {
                  id: "dark",
                  label: "Dark",
                  icon: <Moon className="h-[13px] w-[13px]" />,
                },
                {
                  id: "light",
                  label: "Light",
                  icon: <Sun className="h-[13px] w-[13px]" />,
                },
                {
                  id: "system",
                  label: "System",
                  icon: <Monitor className="h-[13px] w-[13px]" />,
                },
              ]}
            />
          </div>
        </div>
      </SettingsCard>

      {save.error && (
        <p className="text-sm text-(--color-danger)">{save.error.message}</p>
      )}

      <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-(--color-border) bg-(--color-background)/95 px-5 py-3 backdrop-blur-sm md:-mx-8 md:-mb-8 md:px-8 lg:-mx-10 lg:-mb-10 lg:px-10">
        <div className="flex max-w-[880px] items-center justify-between">
          <span className="text-sm text-(--color-muted)">
            {dirty ? "You have unsaved changes." : "All changes saved."}
          </span>
          <Button
            size="sm"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate(form)}
          >
            <Save className="h-3.5 w-3.5" />
            {save.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
