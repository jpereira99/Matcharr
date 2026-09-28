import { ConfirmDialog, deleteProfileBody } from "@/components/ConfirmDialog";
import { CreateProfileDialog } from "@/components/profile/CreateProfileDialog";
import { PatternPill } from "@/components/profile/PatternStrip";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { BigStat, StackedBar, StatRow } from "@/components/StatSummary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { fmtAgo } from "@/lib/date";
import type { ProfileSummary, ProfilesSummary } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const SUMMARY_KEY = ["profiles", "summary"];

export function LeagueProfilesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: api.profilesSummary,
    refetchInterval: 60_000,
  });
  const accountsQ = useQuery({
    queryKey: ["m3u-accounts"],
    queryFn: api.m3uAccounts,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const patchSummary = (fn: (list: ProfileSummary[]) => ProfileSummary[]) =>
    qc.setQueryData<ProfilesSummary>(SUMMARY_KEY, (d) =>
      d ? { ...d, profiles: fn(d.profiles) } : d,
    );
  const optimistic = async (
    fn: (list: ProfileSummary[]) => ProfileSummary[],
  ) => {
    await qc.cancelQueries({ queryKey: SUMMARY_KEY });
    const prev = qc.getQueryData<ProfilesSummary>(SUMMARY_KEY);
    patchSummary(fn);
    return { prev };
  };
  const settle = {
    onError: (_e: unknown, _v: unknown, ctx?: { prev?: ProfilesSummary }) =>
      qc.setQueryData(SUMMARY_KEY, ctx?.prev),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      void qc.invalidateQueries({ queryKey: ["team-channels"] });
    },
  };

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.updateProfile(id, { enabled }),
    onMutate: ({ id, enabled }) =>
      optimistic((list) =>
        list.map((p) => (p.id === id ? { ...p, enabled } : p)),
      ),
    onSuccess: (p) => qc.setQueryData(["profile", p.id], p),
    ...settle,
  });
  const duplicate = useMutation({
    mutationFn: (id: number) => api.duplicateProfile(id),
    onMutate: (id) =>
      optimistic((list) => {
        const i = list.findIndex((p) => p.id === id);
        if (i < 0) return list;
        const copy: ProfileSummary = {
          ...list[i],
          id: -Date.now(),
          name: `${list[i].name} copy`,
          enabled: false,
          teams: [],
          note: null,
        };
        return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)];
      }),
    ...settle,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteProfile(id),
    onMutate: (id) => optimistic((list) => list.filter((p) => p.id !== id)),
    ...settle,
  });

  const profiles = useMemo(() => q.data?.profiles ?? [], [q.data]);
  const accountName = (id: number | null) =>
    id === null
      ? "All accounts"
      : (accountsQ.data?.find((a) => a.id === id)?.name ?? `Account #${id}`);

  const games = profiles.filter((p) => p.enabled).flatMap((p) => p.games_today);
  const count = (s: "ok" | "warn" | "none") =>
    games.filter((g) => g.status === s).length;
  const toDelete = profiles.find((p) => p.id === deleteId);

  if (q.isLoading)
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">
            League Profiles
          </h1>
          <p className="mt-1 text-sm text-(--color-muted)">
            How each provider titles its streams, and which ESPN league they
            belong to.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Create Profile
        </Button>
      </header>

      {q.isError && (
        <p className="text-sm text-(--color-danger)">{q.error.message}</p>
      )}

      {profiles.length === 0 && !q.isError ? (
        <div className="flex flex-col items-center gap-4 rounded-(--radius-lg) border border-dashed border-(--color-border) px-6 py-12 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-(--radius-lg) bg-(--color-accent)/10 text-(--color-accent)">
            <Trophy className="h-[22px] w-[22px]" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-extrabold tracking-tight">
              No league profiles yet
            </h2>
            <p className="mx-auto mt-1.5 max-w-[420px] text-sm text-pretty text-(--color-muted)">
              A profile tells Matcharr where a league&apos;s streams live in
              Dispatcharr and how their titles are written. You&apos;ll pick an
              example title and tag the teams in it.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-5 text-xs text-(--color-text-secondary)">
            {["Pick streams", "Tag the title", "Skip variants"].map((s, i) => (
              <span key={s} className="inline-flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-(--color-accent)/15 text-[11px] font-bold text-(--color-accent)">
                  {i + 1}
                </span>
                {s}
              </span>
            ))}
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Create Profile
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-(--radius-lg) border border-(--color-border) px-5 py-4">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <StatRow>
                <BigStat
                  value={count("ok")}
                  label="games with a stream"
                  colorClass="text-(--color-success)"
                />
                <BigStat
                  value={count("warn")}
                  label="in conflict"
                  colorClass="text-(--color-warning)"
                />
                <BigStat
                  value={count("none")}
                  label="no stream yet"
                  colorClass="text-(--color-muted)"
                />
              </StatRow>
              <div className="ml-auto text-right text-xs text-(--color-muted)">
                {profiles.filter((p) => p.enabled).length} of {profiles.length}{" "}
                profiles on · today&apos;s ESPN games
                <br />
                Checked against Dispatcharr {fmtAgo(q.data?.checked_at)}
              </div>
            </div>
            <StackedBar
              segments={[
                { count: count("ok"), colorClass: "bg-(--color-success)" },
                { count: count("warn"), colorClass: "bg-(--color-warning)" },
                {
                  count: count("none"),
                  colorClass: "bg-(--color-border-strong)",
                },
              ]}
            />
          </div>

          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(100%, 440px), 1fr))",
            }}
          >
            {profiles.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                sourceLabel={`${accountName(p.m3u_account_id)} · ${p.channel_group || "All groups"}`}
                onOpen={() => p.id > 0 && navigate(`/profiles/${p.id}`)}
                onToggle={(enabled) => toggle.mutate({ id: p.id, enabled })}
                onDuplicate={() => duplicate.mutate(p.id)}
                onDelete={() => setDeleteId(p.id)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3.5 text-xs text-(--color-muted)">
            <span className="inline-flex items-center gap-1.5">
              <PatternPill
                field="home"
                className="tracking-[.06em] uppercase"
              />
              <PatternPill
                field="away"
                className="tracking-[.06em] uppercase"
              />
              team names checked against ESPN
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PatternPill
                field="time"
                className="tracking-[.06em] uppercase"
              />
              other captured parts
            </span>
            <span>Plain text must appear exactly.</span>
          </div>
        </>
      )}

      <CreateProfileDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete ${toDelete?.name ?? ""}?`}
        confirmLabel="Delete profile"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete.id);
          setDeleteId(null);
        }}
      >
        {deleteProfileBody(toDelete?.teams.length ?? 0)}
      </ConfirmDialog>
    </div>
  );
}
