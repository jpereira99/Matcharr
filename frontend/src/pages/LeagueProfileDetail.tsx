import { Breadcrumb, ColumnCaption } from "@/components/Breadcrumb";
import { AddChip, Chip, SuggestionChip } from "@/components/ChipEditor";
import { ConfirmDialog, deleteProfileBody } from "@/components/ConfirmDialog";
import { LeagueLogo } from "@/components/LeagueBadge";
import { PreviewPanel } from "@/components/profile/PreviewPanel";
import { SettingsCard } from "@/components/profile/SettingsCard";
import { TitleFormatCard } from "@/components/profile/TitleFormatCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OverflowMenu } from "@/components/ui/menu";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { api, type StreamCheckParams } from "@/lib/api";
import { isToday } from "@/lib/date";
import {
  CUSTOM_PRESET_ID,
  ESPN_LEAGUE_PRESETS,
  presetById,
  presetIdForSlug,
} from "@/lib/espnLeagues";
import {
  compilePattern,
  evaluateStream,
  suggestSkipTerms,
  type PreviewContext,
} from "@/lib/patterns";
import type {
  AppSettings,
  LeagueProfile,
  LeagueProfileInput,
} from "@/lib/types";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Copy, Trash2, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

const NEW_PROFILE: LeagueProfileInput = {
  name: "",
  stream_pattern: "",
  stream_name_filter: "",
  espn_sport: "baseball",
  espn_league: "mlb",
  enabled: true,
  exclude_terms: [],
  m3u_account_id: null,
  channel_group: "",
};

function toForm(p: LeagueProfile): LeagueProfileInput {
  return {
    name: p.name,
    stream_pattern: p.stream_pattern,
    stream_name_filter: p.stream_name_filter,
    espn_sport: p.espn_sport,
    espn_league: p.espn_league,
    enabled: p.enabled,
    exclude_terms: p.exclude_terms,
    m3u_account_id: p.m3u_account_id,
    channel_group: p.channel_group,
  };
}

export function LeagueProfileDetailPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const profileId = isNew ? null : Number(id);
  const q = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => api.getProfile(profileId!),
    enabled: profileId !== null && Number.isFinite(profileId),
    staleTime: Infinity,
  });

  const [searchParams] = useSearchParams();
  const openStep = searchParams.get("step");
  useEffect(() => {
    if (!openStep) window.scrollTo(0, 0);
  }, [id, openStep]);

  if (isNew) return <ProfileEditor key="new" profile={null} />;
  if (q.isLoading)
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-11 w-72" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  if (!q.data)
    return (
      <EmptyState
        icon={Trophy}
        title="Profile not found"
        description="It may have been deleted."
      />
    );
  return <ProfileEditor key={q.data.id} profile={q.data} />;
}

function ProfileEditor({ profile }: { profile: LeagueProfile | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [saved, setSaved] = useState<LeagueProfileInput>(() =>
    profile
      ? toForm(profile)
      : {
          ...NEW_PROFILE,
          exclude_terms:
            qc.getQueryData<AppSettings>(["settings"])?.default_exclude_terms ??
            [],
        },
  );
  // A draft from the Create dialog has no pattern yet; saving it turns it on.
  const [form, setForm] = useState<LeagueProfileInput>(() =>
    profile && !profile.stream_pattern.trim()
      ? { ...saved, enabled: true }
      : saved,
  );
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const patch = (p: Partial<LeagueProfileInput>) =>
    setForm((f) => ({ ...f, ...p }));

  const [streamsLoaded, setStreamsLoaded] = useState(false);
  // Runs again once example titles load, since they make the page tall enough.
  useEffect(() => {
    if (searchParams.get("step") === "title")
      document
        .getElementById("title-format")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [searchParams, streamsLoaded]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const contains = useDebouncedValue(form.stream_name_filter, 400);
  const checkParams: StreamCheckParams = {
    espn_sport: form.espn_sport,
    espn_league: form.espn_league,
    m3u_account_id: form.m3u_account_id,
    channel_group: form.channel_group,
    contains,
  };
  const checkQ = useQuery({
    queryKey: ["stream-check", profile?.id ?? "new", checkParams],
    queryFn: () => api.streamCheck(profile?.id ?? null, checkParams),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const accountsQ = useQuery({
    queryKey: ["m3u-accounts"],
    queryFn: api.m3uAccounts,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const groupsQ = useQuery({
    queryKey: ["stream-groups"],
    queryFn: api.streamGroups,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const check = checkQ.data;
  useEffect(() => {
    if (check?.streams.length) setStreamsLoaded(true);
  }, [check]);
  const compiled = useMemo(
    () => compilePattern(form.stream_pattern),
    [form.stream_pattern],
  );
  const ctx: PreviewContext = useMemo(
    () => ({
      skipTerms: form.exclude_terms,
      games: check?.games ?? [],
      aliases: check?.aliases_by_team_id ?? {},
      timezone: check?.timezone ?? "UTC",
    }),
    [form.exclude_terms, check],
  );
  const streams = useMemo(
    () =>
      [...(check?.streams ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      ),
    [check],
  );
  const items = useMemo(
    () =>
      streams.map((s) => ({
        stream: s,
        result: evaluateStream(s.name, compiled, ctx),
      })),
    [streams, compiled, ctx],
  );
  const streamError =
    check?.error ?? (checkQ.error ? checkQ.error.message : null);
  const poolFit = useMemo(() => {
    const kinds = items.map((i) => i.result.kind);
    return {
      fits: kinds.filter(
        (k) => k === "matched" || k === "noteam" || k === "fit",
      ).length,
      skipped: kinds.filter((k) => k === "skipped").length,
      total: kinds.length,
    };
  }, [items]);
  const evaluate = useCallback(
    (title: string) => evaluateStream(title, compiled, ctx),
    [compiled, ctx],
  );
  const titles = useMemo(() => streams.map((s) => s.name), [streams]);
  const suggestions = useMemo(
    () =>
      suggestSkipTerms(
        items.map((i) => i.result),
        form.exclude_terms,
      ),
    [items, form.exclude_terms],
  );
  const gamesToday = (check?.games ?? []).filter((g) =>
    isToday(g.game_time),
  ).length;

  const save = useMutation({
    mutationFn: (body: LeagueProfileInput) =>
      profile ? api.updateProfile(profile.id, body) : api.createProfile(body),
    onSuccess: (p) => {
      qc.setQueryData(["profile", p.id], p);
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      void qc.invalidateQueries({ queryKey: ["team-status"] });
      void qc.invalidateQueries({ queryKey: ["team-games"] });
      if (!profile) {
        navigate(`/profiles/${p.id}`, { replace: true });
        return;
      }
      setSaved(toForm(p));
      setForm(toForm(p));
    },
  });

  // Saved, finished profiles switch on/off immediately (like the list); new
  // profiles and drafts keep it as part of the form until they're saved.
  const savedLive = !!profile && !!profile.stream_pattern.trim();
  const toggleEnabled = useMutation({
    mutationFn: (enabled: boolean) =>
      api.updateProfile(profile!.id, { enabled }),
    onMutate: (enabled) => {
      setSaved((s) => ({ ...s, enabled }));
      setForm((f) => ({ ...f, enabled }));
    },
    onError: (_e, enabled) => {
      setSaved((s) => ({ ...s, enabled: !enabled }));
      setForm((f) => ({ ...f, enabled: !enabled }));
    },
    onSuccess: (p) => {
      qc.setQueryData(["profile", p.id], p);
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      void qc.invalidateQueries({ queryKey: ["team-status"] });
    },
  });
  function setEnabled(enabled: boolean) {
    if (savedLive) toggleEnabled.mutate(enabled);
    else patch({ enabled });
  }

  const [deleteOpen, setDeleteOpen] = useState(false);
  const duplicate = useMutation({
    mutationFn: () => api.duplicateProfile(profile!.id),
    onSuccess: (copy) => {
      qc.setQueryData(["profile", copy.id], copy);
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      navigate(`/profiles/${copy.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteProfile(profile!.id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["profile", profile!.id] });
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      void qc.invalidateQueries({ queryKey: ["team-channels"] });
      void qc.invalidateQueries({ queryKey: ["team-status"] });
      navigate("/profiles");
    },
  });

  const canSave =
    dirty &&
    !save.isPending &&
    form.name.trim() !== "" &&
    form.stream_pattern.trim() !== "" &&
    compiled.ok;

  function addTerm(term: string) {
    const t = term.trim();
    if (
      !t ||
      form.exclude_terms.some((x) => x.toLowerCase() === t.toLowerCase())
    )
      return;
    patch({ exclude_terms: [...form.exclude_terms, t] });
  }

  const presetId = presetIdForSlug(form.espn_sport, form.espn_league);
  const groupOptions = groupsQ.data ?? [];
  const accountOptions = accountsQ.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        parent="League Profiles"
        to="/profiles"
        current={form.name || "New profile"}
      />

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <LeagueLogo league={form.espn_league} size={44} />
          <div className="min-w-0">
            <h1 className="font-heading truncate text-2xl font-extrabold tracking-tight">
              {form.name || "New profile"}
            </h1>
            <p className="mt-0.5 text-sm text-(--color-muted)">
              {gamesToday} ESPN game{gamesToday === 1 ? "" : "s"} today ·{" "}
              {profile?.team_channel_count ?? 0} team
              {(profile?.team_channel_count ?? 0) === 1 ? "" : "s"} mapped
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && (
            <span className="mr-1 text-xs text-(--color-muted)">
              Unsaved changes
            </span>
          )}
          <div
            className="mr-2 flex items-center gap-2"
            title={
              savedLive
                ? "Takes effect right away"
                : "Saved with the rest of the profile"
            }
          >
            <span className="text-xs text-(--color-muted)">
              {form.enabled ? "On" : "Off"}
            </span>
            <Toggle
              checked={form.enabled}
              onChange={setEnabled}
              disabled={toggleEnabled.isPending}
              label={form.enabled ? "Turn profile off" : "Turn profile on"}
            />
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              save.reset();
              if (dirty) setForm(saved);
              else navigate("/profiles");
            }}
          >
            Cancel
          </Button>
          <Button onClick={() => save.mutate(form)} disabled={!canSave}>
            {save.isPending ? "Saving..." : "Save Changes"}
          </Button>
          {profile && (
            <OverflowMenu
              items={[
                {
                  label: "Duplicate",
                  icon: Copy,
                  onSelect: () => duplicate.mutate(),
                  disabled: duplicate.isPending,
                },
                {
                  label: "Delete…",
                  icon: Trash2,
                  onSelect: () => setDeleteOpen(true),
                  danger: true,
                },
              ]}
            />
          )}
        </div>
      </header>

      {(save.error || toggleEnabled.error || duplicate.error) && (
        <p className="-mt-3 text-right text-xs text-(--color-danger)">
          {(save.error ?? toggleEnabled.error ?? duplicate.error)?.message}
        </p>
      )}

      {profile && (
        <ConfirmDialog
          open={deleteOpen}
          title={`Delete ${profile.name}?`}
          confirmLabel="Delete profile"
          pending={remove.isPending}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => remove.mutate()}
        >
          {deleteProfileBody(profile.team_channel_count ?? 0)}
        </ConfirmDialog>
      )}

      <div
        className="grid items-start gap-5"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 440px), 1fr))",
        }}
      >
        <div className="flex min-w-0 flex-col gap-4">
          <ColumnCaption>Settings</ColumnCaption>

          <SettingsCard title="Basics">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="profile-name">Name</Label>
                <Input
                  id="profile-name"
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="e.g. MLS Apple"
                />
              </div>
              <div>
                <Label htmlFor="profile-league">ESPN League</Label>
                <Select
                  id="profile-league"
                  value={presetId}
                  onChange={(e) => {
                    const p = presetById(e.target.value);
                    if (p)
                      patch({ espn_sport: p.sport, espn_league: p.league });
                    else if (e.target.value === CUSTOM_PRESET_ID)
                      patch({ espn_sport: "", espn_league: "" });
                  }}
                >
                  {ESPN_LEAGUE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                  <option value={CUSTOM_PRESET_ID}>Other (ESPN slugs)…</option>
                </Select>
              </div>
              {presetId === CUSTOM_PRESET_ID && (
                <>
                  <div>
                    <Label htmlFor="profile-sport">ESPN sport slug</Label>
                    <Input
                      id="profile-sport"
                      value={form.espn_sport}
                      onChange={(e) => patch({ espn_sport: e.target.value })}
                      placeholder="e.g. baseball"
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label htmlFor="profile-league-slug">
                      ESPN league slug
                    </Label>
                    <Input
                      id="profile-league-slug"
                      value={form.espn_league}
                      onChange={(e) => patch({ espn_league: e.target.value })}
                      placeholder="e.g. mlb"
                      className="font-mono text-xs"
                    />
                  </div>
                </>
              )}
            </div>
          </SettingsCard>

          <SettingsCard
            step={1}
            title="Streams"
            helper={
              <>
                Which Dispatcharr streams to look through.{" "}
                <span className="text-(--color-foreground)">
                  {checkQ.isFetching && !check ? "…" : streams.length} streams
                </span>{" "}
                right now.
              </>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="m3u-account">M3U Account</Label>
                <Select
                  id="m3u-account"
                  value={form.m3u_account_id ?? ""}
                  disabled={accountsQ.isError}
                  onChange={(e) =>
                    patch({
                      m3u_account_id: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                >
                  <option value="">All accounts</option>
                  {accountOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                  {form.m3u_account_id !== null &&
                    !accountOptions.some(
                      (a) => a.id === form.m3u_account_id,
                    ) && (
                      <option value={form.m3u_account_id}>
                        Account #{form.m3u_account_id}
                      </option>
                    )}
                </Select>
              </div>
              <div>
                <Label htmlFor="channel-group">Channel Group</Label>
                <Select
                  id="channel-group"
                  value={form.channel_group}
                  disabled={groupsQ.isError && !form.channel_group}
                  onChange={(e) => patch({ channel_group: e.target.value })}
                >
                  <option value="">All groups</option>
                  {groupOptions.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                  {form.channel_group &&
                    !groupOptions.includes(form.channel_group) && (
                      <option value={form.channel_group}>
                        {form.channel_group}
                      </option>
                    )}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="title-contains">
                Title contains{" "}
                <span className="font-normal tracking-normal normal-case">
                  · optional
                </span>
              </Label>
              <Input
                id="title-contains"
                value={form.stream_name_filter}
                onChange={(e) => patch({ stream_name_filter: e.target.value })}
                placeholder="e.g. (MLS)"
                className="font-mono text-xs"
              />
            </div>
          </SettingsCard>

          <TitleFormatCard
            titles={titles}
            status={
              checkQ.isLoading ? "loading" : streamError ? "error" : "ready"
            }
            error={streamError}
            poolFit={poolFit}
            pattern={form.stream_pattern}
            compiled={compiled}
            evaluate={evaluate}
            onPatternChange={(p) => patch({ stream_pattern: p })}
          />

          <SettingsCard
            step={3}
            title="Skip variants"
            helper="Titles containing any of these are never routed."
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {form.exclude_terms.map((t) => (
                <Chip
                  key={t}
                  term={t}
                  tone="danger"
                  onRemove={() =>
                    patch({
                      exclude_terms: form.exclude_terms.filter((x) => x !== t),
                    })
                  }
                />
              ))}
              {suggestions.map((t) => (
                <SuggestionChip
                  key={t}
                  term={t}
                  tone="danger"
                  title="Seen in your streams"
                  onAdd={() => addTerm(t)}
                />
              ))}
              <AddChip onAdd={addTerm} placeholder="(Alt)" />
            </div>
            {suggestions.length > 0 && (
              <p className="text-xs text-(--color-muted)">
                Dashed terms were spotted in your streams. Click one to skip it.
              </p>
            )}
          </SettingsCard>
        </div>

        <div className="sticky top-6 flex max-h-[calc(100vh-3rem)] min-w-0 flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <ColumnCaption>Preview</ColumnCaption>
            <span className="text-right text-xs text-(--color-muted)">
              Updates as you edit · nothing is routed until you save
            </span>
          </div>
          <PreviewPanel
            items={items}
            gameCount={check?.games.length ?? 0}
            loading={checkQ.isLoading}
            error={streamError}
          />
        </div>
      </div>
    </div>
  );
}
