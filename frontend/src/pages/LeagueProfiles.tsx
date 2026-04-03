import { EspnLeaguePick } from "@/components/EspnLeaguePick";
import { LeagueBadge } from "@/components/LeagueBadge";
import { LeagueProfileSetupIntro } from "@/components/PatternPlaceholderHelp";
import { PatternTester } from "@/components/PatternTester";
import { StreamPatternField } from "@/components/StreamPatternField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { api } from "@/lib/api";
import type { LeagueProfile } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { useState } from "react";

type FormState = {
  name: string;
  stream_pattern: string;
  stream_name_filter: string;
  espn_sport: string;
  espn_league: string;
};

const emptyForm: FormState = {
  name: "",
  stream_pattern: "",
  stream_name_filter: "",
  espn_sport: "baseball",
  espn_league: "mlb",
};

export function LeagueProfilesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["profiles"], queryFn: api.listProfiles });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [editEnabled, setEditEnabled] = useState(true);

  const create = useMutation({
    mutationFn: (body: FormState) => api.createProfile(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      setForm(emptyForm);
      setShowCreate(false);
    },
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: Partial<LeagueProfile> & { id: number }) =>
      api.updateProfile(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      setEditId(null);
    },
  });

  const remove = useMutation({
    mutationFn: api.deleteProfile,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["profiles"] }),
  });

  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.updateProfile(id, { enabled }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["profiles"] }),
  });

  function openEdit(p: LeagueProfile) {
    setEditForm({
      name: p.name,
      stream_pattern: p.stream_pattern,
      stream_name_filter: p.stream_name_filter,
      espn_sport: p.espn_sport,
      espn_league: p.espn_league,
    });
    setEditEnabled(p.enabled);
    setEditId(p.id);
  }

  if (q.isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">
            League Profiles
          </h1>
          <p className="mt-1 text-sm text-(--color-muted)">
            Define stream patterns and ESPN league mappings.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="h-3.5 w-3.5" />
          Create Profile
        </Button>
      </header>

      {/* Create panel */}
      {showCreate && (
        <Card>
          <CardTitle>New Profile</CardTitle>
          <div className="mt-3">
            <LeagueProfileSetupIntro />
          </div>
          <form
            className="mt-4 grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate(form);
            }}
          >
            <div>
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. MLB Streams"
              />
            </div>
            <div>
              <Label htmlFor="new-filter">Stream Name Filter</Label>
              <Input
                id="new-filter"
                value={form.stream_name_filter}
                onChange={(e) =>
                  setForm({ ...form, stream_name_filter: e.target.value })
                }
                placeholder="Optional Dispatcharr filter"
              />
            </div>
            <EspnLeaguePick
              sport={form.espn_sport}
              league={form.espn_league}
              onChange={(v) =>
                setForm({ ...form, espn_sport: v.espn_sport, espn_league: v.espn_league })
              }
            />
            <StreamPatternField
              value={form.stream_pattern}
              onChange={(v) => setForm({ ...form, stream_pattern: v })}
            />
            <PatternTester pattern={form.stream_pattern} />
            <div className="md:col-span-2 flex gap-2 pt-2">
              <Button type="submit" disabled={create.isPending || !form.name || !form.stream_pattern}>
                {create.isPending ? "Creating..." : "Create Profile"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowCreate(false);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Profile grid */}
      {!q.data?.length && !showCreate ? (
        <EmptyState
          icon={Trophy}
          title="No league profiles"
          description="Create a profile to start mapping ESPN schedules to your Dispatcharr streams."
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" /> Create Profile
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data?.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <LeagueBadge league={p.espn_league} />
                  <h3 className="text-sm font-semibold truncate">{p.name}</h3>
                </div>
                <Toggle
                  checked={p.enabled}
                  onChange={(v) =>
                    toggleEnabled.mutate({ id: p.id, enabled: v })
                  }
                  label={p.enabled ? "Enabled" : "Disabled"}
                />
              </div>

              <div className="mt-3 rounded-(--radius-sm) bg-(--color-surface-raised) px-3 py-2 font-mono text-xs text-(--color-foreground) break-all">
                {p.stream_pattern || "—"}
              </div>

              {p.stream_name_filter && (
                <div className="mt-2 text-xs text-(--color-muted)">
                  Filter: <span className="font-mono text-(--color-foreground)">{p.stream_name_filter}</span>
                </div>
              )}

              <div className="mt-auto flex items-center justify-between pt-4">
                <Badge variant="muted">
                  {p.team_channel_count ?? 0} team{(p.team_channel_count ?? 0) !== 1 ? "s" : ""} mapped
                </Badge>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="rounded-(--radius-sm) p-1.5 text-(--color-muted) hover:bg-(--color-surface-raised) hover:text-(--color-foreground) transition-colors cursor-pointer"
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete "${p.name}"?`)) remove.mutate(p.id);
                    }}
                    className="rounded-(--radius-sm) p-1.5 text-(--color-muted) hover:bg-(--color-danger)/10 hover:text-(--color-danger) transition-colors cursor-pointer"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog
        open={editId !== null}
        onClose={() => setEditId(null)}
        title="Edit Profile"
        variant="panel"
      >
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (editId == null) return;
            update.mutate({
              id: editId,
              ...editForm,
              enabled: editEnabled,
            });
          }}
        >
          <div className="flex items-center gap-3">
            <Label className="mb-0">Enabled</Label>
            <Toggle checked={editEnabled} onChange={setEditEnabled} />
          </div>
          <div>
            <Label>Name</Label>
            <Input
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Stream Name Filter</Label>
            <Input
              value={editForm.stream_name_filter}
              onChange={(e) =>
                setEditForm({ ...editForm, stream_name_filter: e.target.value })
              }
              placeholder="Optional"
            />
          </div>
          <EspnLeaguePick
            sport={editForm.espn_sport}
            league={editForm.espn_league}
            onChange={(v) =>
              setEditForm({
                ...editForm,
                espn_sport: v.espn_sport,
                espn_league: v.espn_league,
              })
            }
          />
          <StreamPatternField
            value={editForm.stream_pattern}
            onChange={(v) =>
              setEditForm({ ...editForm, stream_pattern: v })
            }
            idSuffix="-edit"
            compactHelp
          />
          <PatternTester pattern={editForm.stream_pattern} />
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditId(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
