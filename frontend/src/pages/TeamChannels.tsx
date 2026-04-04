import { AliasesFieldHelp } from "@/components/PatternPlaceholderHelp";
import { LeagueBadge } from "@/components/LeagueBadge";
import { TeamLogo } from "@/components/TeamLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/ui/status-dot";
import { Tabs } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { api } from "@/lib/api";
import type { EspnTeam, LeagueProfile, TeamChannel } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type CreateForm = {
  league_profile_id: number;
  espn_team_id: string;
  espn_team_abbr: string;
  team_name: string;
  dispatcharr_channel_id: string;
  aliases: string;
  enabled: boolean;
};

const emptyCreate: CreateForm = {
  league_profile_id: 0,
  espn_team_id: "",
  espn_team_abbr: "",
  team_name: "",
  dispatcharr_channel_id: "",
  aliases: "",
  enabled: true,
};

export function TeamChannelsPage() {
  const qc = useQueryClient();
  const profilesQ = useQuery({
    queryKey: ["profiles"],
    queryFn: api.listProfiles,
  });
  const channelsQ = useQuery({
    queryKey: ["team-channels"],
    queryFn: api.listTeamChannels,
  });

  const [activeProfile, setActiveProfile] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyCreate);

  // ESPN teams for selected profile in create form
  const selectedProfile = profilesQ.data?.find(
    (p) => p.id === form.league_profile_id,
  );
  const espnTeamsQ = useQuery({
    queryKey: [
      "espn-teams",
      selectedProfile?.espn_sport,
      selectedProfile?.espn_league,
    ],
    queryFn: () =>
      api.espnTeams(selectedProfile!.espn_sport, selectedProfile!.espn_league),
    enabled: !!selectedProfile,
  });

  // Edit state (declared early — dispatcharrQ.enabled references editId)
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CreateForm>(emptyCreate);

  // Dispatcharr channel search
  const [channelSearch, setChannelSearch] = useState("");
  const debouncedChannelSearch = useDebouncedValue(channelSearch, 400);
  const dispatcharrQ = useQuery({
    queryKey: ["dispatcharr-channels", debouncedChannelSearch],
    queryFn: () => api.dispatcharrChannels(debouncedChannelSearch),
    enabled: showCreate || editId !== null,
  });
  const [editChannelSearch, setEditChannelSearch] = useState("");
  const debouncedEditSearch = useDebouncedValue(editChannelSearch, 400);
  const editDispatcharrQ = useQuery({
    queryKey: ["dispatcharr-channels-edit", debouncedEditSearch],
    queryFn: () => api.dispatcharrChannels(debouncedEditSearch),
    enabled: editId !== null,
  });

  const editProfile = profilesQ.data?.find(
    (p) => p.id === editForm.league_profile_id,
  );
  const editEspnTeamsQ = useQuery({
    queryKey: [
      "espn-teams-edit",
      editProfile?.espn_sport,
      editProfile?.espn_league,
    ],
    queryFn: () =>
      api.espnTeams(editProfile!.espn_sport, editProfile!.espn_league),
    enabled: !!editProfile && editId !== null,
  });

  // When profiles load, set default
  useEffect(() => {
    if (profilesQ.data?.length && form.league_profile_id === 0) {
      setForm((f) => ({ ...f, league_profile_id: profilesQ.data![0].id }));
    }
  }, [profilesQ.data, form.league_profile_id]);

  const create = useMutation({
    mutationFn: (body: Omit<TeamChannel, "id" | "created_at">) =>
      api.createTeamChannel(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["team-channels"] });
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      setForm((f) => ({
        ...emptyCreate,
        league_profile_id: f.league_profile_id,
      }));
      setShowCreate(false);
    },
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: Partial<TeamChannel> & { id: number }) =>
      api.updateTeamChannel(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["team-channels"] });
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      setEditId(null);
    },
  });

  const remove = useMutation({
    mutationFn: api.deleteTeamChannel,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["team-channels"] });
      void qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });

  // Build a map from profile id to profile for easy lookup
  const profileMap = useMemo(() => {
    const m = new Map<number, LeagueProfile>();
    for (const p of profilesQ.data ?? []) m.set(p.id, p);
    return m;
  }, [profilesQ.data]);

  // Filter channels
  const filtered = useMemo(() => {
    let items = channelsQ.data ?? [];
    if (activeProfile !== "all") {
      const pid = Number(activeProfile);
      items = items.filter((c) => c.league_profile_id === pid);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      items = items.filter(
        (c) =>
          c.team_name.toLowerCase().includes(term) ||
          c.aliases.some((a) => a.toLowerCase().includes(term)),
      );
    }
    return items;
  }, [channelsQ.data, activeProfile, searchTerm]);

  // Tab items
  const tabItems = useMemo(
    () => [
      { id: "all", label: "All" },
      ...(profilesQ.data ?? []).map((p) => ({
        id: String(p.id),
        label: p.name,
      })),
    ],
    [profilesQ.data],
  );

  function openEdit(tc: TeamChannel) {
    setEditForm({
      league_profile_id: tc.league_profile_id,
      espn_team_id: tc.espn_team_id,
      espn_team_abbr: tc.espn_team_abbr,
      team_name: tc.team_name,
      dispatcharr_channel_id: String(tc.dispatcharr_channel_id),
      aliases: tc.aliases.join(", "),
      enabled: tc.enabled,
    });
    setEditChannelSearch("");
    setEditId(tc.id);
  }

  function handleCreate() {
    const aliases = form.aliases
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    create.mutate({
      team_name: form.team_name,
      espn_team_id: form.espn_team_id,
      espn_team_abbr: form.espn_team_abbr,
      league_profile_id: form.league_profile_id,
      dispatcharr_channel_id: Number(form.dispatcharr_channel_id) || 0,
      enabled: form.enabled,
      aliases,
    });
  }

  function handleUpdate() {
    if (editId == null) return;
    const aliases = editForm.aliases
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    update.mutate({
      id: editId,
      team_name: editForm.team_name,
      espn_team_id: editForm.espn_team_id,
      espn_team_abbr: editForm.espn_team_abbr,
      league_profile_id: editForm.league_profile_id,
      dispatcharr_channel_id: Number(editForm.dispatcharr_channel_id) || 0,
      enabled: editForm.enabled,
      aliases,
    });
  }

  function selectTeam(
    team: EspnTeam,
    formSetter: (fn: (f: CreateForm) => CreateForm) => void,
  ) {
    formSetter((f) => ({
      ...f,
      espn_team_id: team.id,
      espn_team_abbr: team.abbreviation,
      team_name: team.name,
    }));
  }

  if (profilesQ.isLoading || channelsQ.isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">
            Team Channels
          </h1>
          <p className="mt-1 text-sm text-(--color-muted)">
            Map ESPN teams to Dispatcharr channels.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Team
        </Button>
      </header>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs
          value={activeProfile}
          onChange={setActiveProfile}
          items={tabItems}
          className="min-w-0 flex-1"
        />
        <div className="relative w-full sm:w-64">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--color-muted)" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter teams..."
            className="pl-9"
            inputSize="sm"
          />
        </div>
      </div>

      {/* Create panel */}
      {showCreate && (
        <Card>
          <h3 className="font-heading text-base font-extrabold">
            Add Team Mapping
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <Label>League Profile</Label>
              <select
                className="w-full rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-foreground)"
                value={form.league_profile_id}
                onChange={(e) =>
                  setForm({ ...form, league_profile_id: +e.target.value })
                }
              >
                {profilesQ.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>ESPN Team</Label>
              <div className="flex items-center gap-2">
                {form.espn_team_id && selectedProfile && (
                  <TeamLogo
                    league={selectedProfile.espn_league}
                    abbreviation={form.espn_team_abbr}
                    espnTeamId={form.espn_team_id}
                    teamName={form.team_name}
                    size={32}
                  />
                )}
                <select
                  className="w-full rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-foreground)"
                  value={form.espn_team_id}
                  onChange={(e) => {
                    const team = espnTeamsQ.data?.find(
                      (t) => t.id === e.target.value,
                    );
                    if (team) selectTeam(team, setForm);
                  }}
                >
                  <option value="">Select a team...</option>
                  {espnTeamsQ.data?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.abbreviation})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Dispatcharr Channel</Label>
              <Input
                placeholder="Search channels..."
                value={channelSearch}
                onChange={(e) => setChannelSearch(e.target.value)}
                inputSize="sm"
              />
              {dispatcharrQ.data && channelSearch && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-(--radius-md) border border-(--color-border) bg-(--color-surface)">
                  {dispatcharrQ.data.map((ch) => (
                    <button
                      key={String(ch.id)}
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-(--color-surface-raised)"
                      onClick={() => {
                        setForm({
                          ...form,
                          dispatcharr_channel_id: String(ch.id),
                        });
                        setChannelSearch(String(ch.name ?? ch.id));
                      }}
                    >
                      <span className="text-(--color-foreground)">
                        {String(ch.name ?? ch.id)}
                      </span>
                      <span className="text-(--color-muted)">
                        #{String(ch.id)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {form.dispatcharr_channel_id && (
                <p className="mt-1 text-xs text-(--color-muted)">
                  Channel ID:{" "}
                  <span className="font-mono text-(--color-foreground)">
                    {form.dispatcharr_channel_id}
                  </span>
                </p>
              )}
            </div>
            <div>
              <Label>Aliases</Label>
              <Input
                value={form.aliases}
                onChange={(e) => setForm({ ...form, aliases: e.target.value })}
                placeholder="Comma-separated aliases"
                inputSize="sm"
              />
              <AliasesFieldHelp />
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button
                type="button"
                size="sm"
                disabled={
                  create.isPending ||
                  !form.team_name ||
                  !form.dispatcharr_channel_id
                }
                onClick={handleCreate}
              >
                {create.isPending ? "Creating..." : "Create Mapping"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Team cards grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team mappings"
          description={
            searchTerm || activeProfile !== "all"
              ? "No teams match your filter."
              : "Add a team mapping to start routing Dispatcharr channels."
          }
          action={
            !showCreate ? (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Team
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((tc) => {
            const profile = profileMap.get(tc.league_profile_id);
            return (
              <Card
                key={tc.id}
                colorAccent={undefined}
                className="group relative flex flex-col"
              >
                <div className="flex items-start gap-3">
                  <TeamLogo
                    league={profile?.espn_league ?? ""}
                    abbreviation={tc.espn_team_abbr}
                    espnTeamId={tc.espn_team_id}
                    teamName={tc.team_name}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">
                        {tc.team_name}
                      </h3>
                      <StatusDot status={tc.enabled ? "online" : "offline"} />
                    </div>
                    {profile && (
                      <div className="flex items-center gap-1.5">
                        <LeagueBadge league={profile.espn_league} size={14} />
                        <p className="text-xs text-(--color-muted)">
                          {profile.name}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-(--color-muted)">
                  <Link2 className="h-3 w-3" />
                  <span>
                    Channel{" "}
                    <span className="font-mono text-(--color-foreground)">
                      {tc.dispatcharr_channel_id}
                    </span>
                  </span>
                </div>

                {tc.aliases.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tc.aliases.map((alias) => (
                      <Badge key={alias} variant="muted">
                        {alias}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Hover actions */}
                <div className="mt-auto flex justify-end gap-1 pt-3 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => openEdit(tc)}
                    className="cursor-pointer rounded-(--radius-sm) p-1.5 text-(--color-muted) transition-colors hover:bg-(--color-surface-raised) hover:text-(--color-foreground)"
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete "${tc.team_name}"?`))
                        remove.mutate(tc.id);
                    }}
                    className="cursor-pointer rounded-(--radius-sm) p-1.5 text-(--color-muted) transition-colors hover:bg-(--color-danger)/10 hover:text-(--color-danger)"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog
        open={editId !== null}
        onClose={() => setEditId(null)}
        title="Edit Team Mapping"
        variant="panel"
      >
        <div className="grid gap-4">
          <div className="flex items-center gap-3">
            <Label className="mb-0">Enabled</Label>
            <Toggle
              checked={editForm.enabled}
              onChange={(v) => setEditForm({ ...editForm, enabled: v })}
            />
          </div>
          <div>
            <Label>League Profile</Label>
            <select
              className="w-full rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-foreground)"
              value={editForm.league_profile_id}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  league_profile_id: +e.target.value,
                })
              }
            >
              {profilesQ.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>ESPN Team</Label>
            <div className="flex items-center gap-2">
              {editForm.espn_team_id && editProfile && (
                <TeamLogo
                  league={editProfile.espn_league}
                  abbreviation={editForm.espn_team_abbr}
                  espnTeamId={editForm.espn_team_id}
                  teamName={editForm.team_name}
                  size={32}
                />
              )}
              <select
                className="w-full rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-foreground)"
                value={editForm.espn_team_id}
                onChange={(e) => {
                  const team = editEspnTeamsQ.data?.find(
                    (t) => t.id === e.target.value,
                  );
                  if (team) selectTeam(team, setEditForm);
                }}
              >
                <option value="">Select a team...</option>
                {editEspnTeamsQ.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.abbreviation})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label>Dispatcharr Channel ID</Label>
            <Input
              value={editForm.dispatcharr_channel_id}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  dispatcharr_channel_id: e.target.value,
                })
              }
              className="font-mono"
              inputSize="sm"
            />
            <div className="mt-1">
              <Input
                placeholder="Search channels..."
                value={editChannelSearch}
                onChange={(e) => setEditChannelSearch(e.target.value)}
                inputSize="sm"
              />
              {editDispatcharrQ.data && editChannelSearch && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-(--radius-md) border border-(--color-border) bg-(--color-surface)">
                  {editDispatcharrQ.data.map((ch) => (
                    <button
                      key={String(ch.id)}
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-(--color-surface-raised)"
                      onClick={() => {
                        setEditForm({
                          ...editForm,
                          dispatcharr_channel_id: String(ch.id),
                        });
                        setEditChannelSearch(String(ch.name ?? ch.id));
                      }}
                    >
                      <span className="text-(--color-foreground)">
                        {String(ch.name ?? ch.id)}
                      </span>
                      <span className="text-(--color-muted)">
                        #{String(ch.id)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <Label>Aliases</Label>
            <Input
              value={editForm.aliases}
              onChange={(e) =>
                setEditForm({ ...editForm, aliases: e.target.value })
              }
              placeholder="Comma-separated"
              inputSize="sm"
            />
            <AliasesFieldHelp />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              disabled={update.isPending}
              onClick={handleUpdate}
            >
              {update.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditId(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
