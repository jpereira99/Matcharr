import { EspnLeaguePick } from "@/components/EspnLeaguePick";
import { LeagueProfileSetupIntro } from "@/components/PatternPlaceholderHelp";
import { PatternTester } from "@/components/PatternTester";
import { StreamPatternField } from "@/components/StreamPatternField";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { LeagueProfile } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const empty: Partial<LeagueProfile> = {
  name: "",
  stream_pattern: "MLB {n} | {away} vs {home} | {time}",
  stream_name_filter: "MLB",
  espn_sport: "baseball",
  espn_league: "mlb",
  enabled: true,
};

function profileToDraft(p: LeagueProfile): Partial<LeagueProfile> {
  return {
    name: p.name,
    stream_pattern: p.stream_pattern,
    stream_name_filter: p.stream_name_filter,
    espn_sport: p.espn_sport,
    espn_league: p.espn_league,
    enabled: p.enabled,
  };
}

export function LeagueProfilesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["profiles"], queryFn: api.listProfiles });
  const [draft, setDraft] = useState<Partial<LeagueProfile>>(empty);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<LeagueProfile>>(empty);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!editOpen || editId == null) return;
    const p = q.data?.find((x) => x.id === editId);
    if (p) setEditDraft(profileToDraft(p));
  }, [editOpen, editId, q.data]);

  const create = useMutation({
    mutationFn: () =>
      api.createProfile({
        name: draft.name || "New league",
        stream_pattern: draft.stream_pattern || "",
        stream_name_filter: draft.stream_name_filter || "",
        espn_sport: draft.espn_sport || "",
        espn_league: draft.espn_league || "",
        enabled: draft.enabled ?? true,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      setDraft(empty);
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteProfile(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["profiles"] }),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (editId == null) throw new Error("No profile selected");
      return api.updateProfile(editId, {
        name: editDraft.name,
        stream_pattern: editDraft.stream_pattern,
        stream_name_filter: editDraft.stream_name_filter,
        espn_sport: editDraft.espn_sport,
        espn_league: editDraft.espn_league,
        enabled: editDraft.enabled,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      setEditError(null);
      setEditOpen(false);
      setEditId(null);
    },
    onError: (err: Error) => {
      setEditError(err.message || "Update failed");
    },
  });

  const openEdit = (p: LeagueProfile) => {
    setEditError(null);
    setEditId(p.id);
    setEditDraft(profileToDraft(p));
    setEditOpen(true);
  };

  if (q.isLoading) return <div className="text-[var(--color-muted)]">Loading…</div>;
  if (q.isError) return <div className="text-red-400">Failed to load profiles</div>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">League profiles</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Tell the router how Dispatcharr titles are shaped, and which ESPN league to load schedules from.
        </p>
      </header>

      <LeagueProfileSetupIntro />

      {!q.data?.length && (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">
            No profiles yet. Add one below, then map teams in{" "}
            <Link to="/teams" className="text-[var(--color-accent)] underline-offset-2 hover:underline">
              Team channels
            </Link>
            .
          </p>
        </Card>
      )}

      <Card id="create-profile">
        <CardTitle>Create profile</CardTitle>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <Label>Stream name filter (Dispatcharr search)</Label>
            <Input
              value={draft.stream_name_filter}
              onChange={(e) => setDraft({ ...draft, stream_name_filter: e.target.value })}
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Same idea as searching streams in Dispatcharr—only titles containing this substring are considered.
            </p>
          </div>
          <StreamPatternField
            value={draft.stream_pattern || ""}
            onChange={(next) => setDraft({ ...draft, stream_pattern: next })}
            idSuffix="-create"
          />
          <EspnLeaguePick
            sport={draft.espn_sport || ""}
            league={draft.espn_league || ""}
            onChange={(next) => setDraft({ ...draft, ...next })}
          />
        </div>
        <PatternTester pattern={draft.stream_pattern || ""} />
        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="h-4 w-4" />
            Add profile
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {q.data?.map((p) => (
          <Card key={p.id}>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  {!p.enabled && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-[var(--color-muted)]">Disabled</span>
                  )}
                </div>
                <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">{p.stream_pattern}</p>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  ESPN: {p.espn_sport}/{p.espn_league} · filter: {p.stream_name_filter || "(none)"} ·{" "}
                  {(p.team_channel_count ?? 0) === 0 ? (
                    <span className="text-amber-400/90">No team mappings</span>
                  ) : (
                    <span>
                      {p.team_channel_count} team mapping{(p.team_channel_count ?? 0) === 1 ? "" : "s"}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={() => openEdit(p)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button type="button" variant="danger" onClick={() => remove.mutate(p.id)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
            <PatternTester pattern={p.stream_pattern} />
          </Card>
        ))}
      </div>

      <Dialog
        open={editOpen}
        onClose={() => {
          if (!update.isPending) {
            setEditOpen(false);
            setEditId(null);
            setEditError(null);
          }
        }}
        title="Edit league profile"
        className="max-w-2xl"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input value={editDraft.name ?? ""} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
          </div>
          <div>
            <Label>Stream name filter (Dispatcharr search)</Label>
            <Input
              value={editDraft.stream_name_filter ?? ""}
              onChange={(e) => setEditDraft({ ...editDraft, stream_name_filter: e.target.value })}
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Same idea as searching streams in Dispatcharr—only titles containing this substring are considered.
            </p>
          </div>
          <StreamPatternField
            value={editDraft.stream_pattern ?? ""}
            onChange={(next) => setEditDraft({ ...editDraft, stream_pattern: next })}
            idSuffix={editId != null ? `-edit-${editId}` : "-edit"}
            compactHelp
          />
          <EspnLeaguePick
            sport={editDraft.espn_sport ?? ""}
            league={editDraft.espn_league ?? ""}
            onChange={(next) => setEditDraft({ ...editDraft, ...next })}
          />
          <div className="md:col-span-2 flex items-center gap-2">
            <input
              id="edit-enabled"
              type="checkbox"
              className="h-4 w-4 rounded border-white/20"
              checked={editDraft.enabled ?? true}
              onChange={(e) => setEditDraft({ ...editDraft, enabled: e.target.checked })}
            />
            <Label htmlFor="edit-enabled" className="cursor-pointer">
              Enabled
            </Label>
          </div>
        </div>
        <PatternTester pattern={editDraft.stream_pattern || ""} />
        {editError && <p className="mt-3 text-sm text-[var(--color-danger)]">{editError}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setEditOpen(false);
              setEditId(null);
              setEditError(null);
            }}
            disabled={update.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => update.mutate()} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
