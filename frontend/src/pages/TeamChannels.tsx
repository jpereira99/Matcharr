import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AliasesFieldHelp } from "@/components/PatternPlaceholderHelp";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { api } from "@/lib/api";
import type { TeamChannel } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function channelRowLabel(c: Record<string, unknown>): string {
  const id = c.id ?? c.pk;
  const name = c.name ?? c.title ?? "";
  return `${String(id)} — ${String(name)}`;
}

export function TeamChannelsPage() {
  const qc = useQueryClient();
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: api.listProfiles });
  const teams = useQuery({ queryKey: ["team-channels"], queryFn: api.listTeamChannels });

  const [leagueProfileId, setLeagueProfileId] = useState<number | "">("");
  const profile = useMemo(
    () => profiles.data?.find((p) => p.id === leagueProfileId),
    [profiles.data, leagueProfileId],
  );

  const espnTeams = useQuery({
    queryKey: ["espn-teams", profile?.espn_sport, profile?.espn_league],
    queryFn: () => api.espnTeams(profile!.espn_sport, profile!.espn_league),
    enabled: !!profile,
  });

  const [dispatcharrChannelId, setDispatcharrChannelId] = useState("");
  const [aliases, setAliases] = useState("");
  const [espnTeamId, setEspnTeamId] = useState("");
  const [daSearch, setDaSearch] = useState("");
  const debouncedDaSearch = useDebouncedValue(daSearch, 350);
  const daChannels = useQuery({
    queryKey: ["dispatcharr-channels", debouncedDaSearch],
    queryFn: () => api.dispatcharrChannels(debouncedDaSearch),
    retry: false,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<TeamChannel | null>(null);
  const [editLeagueProfileId, setEditLeagueProfileId] = useState<number | "">("");
  const [editEspnTeamId, setEditEspnTeamId] = useState("");
  const [editDispatcharrChannelId, setEditDispatcharrChannelId] = useState("");
  const [editAliases, setEditAliases] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editDaSearch, setEditDaSearch] = useState("");
  const debouncedEditDaSearch = useDebouncedValue(editDaSearch, 350);
  const editDaChannels = useQuery({
    queryKey: ["dispatcharr-channels", "edit", debouncedEditDaSearch],
    queryFn: () => api.dispatcharrChannels(debouncedEditDaSearch),
    retry: false,
    enabled: editOpen,
  });
  const [editError, setEditError] = useState<string | null>(null);

  const editProfile = useMemo(
    () => profiles.data?.find((p) => p.id === editLeagueProfileId),
    [profiles.data, editLeagueProfileId],
  );
  const editEspnTeams = useQuery({
    queryKey: ["espn-teams", "edit", editProfile?.espn_sport, editProfile?.espn_league],
    queryFn: () => api.espnTeams(editProfile!.espn_sport, editProfile!.espn_league),
    enabled: !!editProfile && editOpen,
  });

  useEffect(() => {
    if (profiles.data?.length && leagueProfileId === "") {
      setLeagueProfileId(profiles.data[0].id);
    }
  }, [profiles.data, leagueProfileId]);

  useEffect(() => {
    if (espnTeams.data?.length) {
      setEspnTeamId(espnTeams.data[0].id);
    } else {
      setEspnTeamId("");
    }
  }, [espnTeams.data, leagueProfileId]);

  useEffect(() => {
    if (!editOpen || !editEspnTeams.data?.length) return;
    if (!editEspnTeams.data.some((x) => x.id === editEspnTeamId)) {
      setEditEspnTeamId(editEspnTeams.data[0].id);
    }
  }, [editOpen, editEspnTeams.data, editEspnTeamId]);

  const create = useMutation({
    mutationFn: async () => {
      if (!profile || !espnTeams.data?.length) throw new Error("Pick a league with teams loaded");
      const pick = espnTeams.data.find((x) => x.id === espnTeamId) ?? espnTeams.data[0];
      return api.createTeamChannel({
        team_name: pick.name,
        espn_team_id: pick.id,
        league_profile_id: profile.id,
        dispatcharr_channel_id: Number(dispatcharrChannelId || 0),
        enabled: true,
        aliases: aliases
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["team-channels"] });
      void qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteTeamChannel(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["team-channels"] });
      void qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editRow) throw new Error("Nothing to edit");
      const pick = editEspnTeams.data?.find((x) => x.id === editEspnTeamId);
      return api.updateTeamChannel(editRow.id, {
        team_name: pick?.name ?? editRow.team_name,
        espn_team_id: editEspnTeamId || editRow.espn_team_id,
        league_profile_id: editLeagueProfileId === "" ? editRow.league_profile_id : Number(editLeagueProfileId),
        dispatcharr_channel_id: Number(editDispatcharrChannelId || 0),
        enabled: editEnabled,
        aliases: editAliases
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["team-channels"] });
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      setEditError(null);
      setEditOpen(false);
      setEditRow(null);
    },
    onError: (err: Error) => setEditError(err.message || "Update failed"),
  });

  const openEdit = (t: TeamChannel) => {
    setEditRow(t);
    setEditLeagueProfileId(t.league_profile_id);
    setEditEspnTeamId(t.espn_team_id);
    setEditDispatcharrChannelId(String(t.dispatcharr_channel_id));
    setEditAliases(t.aliases.join(", "));
    setEditEnabled(t.enabled);
    setEditDaSearch("");
    setEditError(null);
    setEditOpen(true);
  };

  if (profiles.isLoading || teams.isLoading) return <div className="text-[var(--color-muted)]">Loading…</div>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Team channels</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Map a Dispatcharr channel to an ESPN team. The schedule comes from ESPN; stream titles are matched using your
          league profile pattern.           Use the Dashboard “Check routing now” action to verify names and patterns against live Dispatcharr data.
        </p>
      </header>

      <Card>
        <CardTitle>Add team channel</CardTitle>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label>League profile</Label>
            <select
              className="w-full rounded-lg border border-[var(--color-card-border)] bg-black/30 px-3 py-2 text-sm"
              value={leagueProfileId === "" ? "" : String(leagueProfileId)}
              onChange={(e) => setLeagueProfileId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Select…</option>
              {profiles.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>ESPN team</Label>
            <select
              className="w-full rounded-lg border border-[var(--color-card-border)] bg-black/30 px-3 py-2 text-sm"
              disabled={!espnTeams.data?.length}
              value={espnTeamId}
              onChange={(e) => setEspnTeamId(e.target.value)}
            >
              {espnTeams.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {espnTeams.isLoading && <p className="mt-1 text-xs text-[var(--color-muted)]">Loading teams…</p>}
            {espnTeams.isError && <p className="mt-1 text-xs text-red-400">Could not load ESPN teams</p>}
            {espnTeams.data && espnTeamId ? (
              <p className="mt-2 rounded-lg bg-black/25 px-3 py-2 text-xs text-[var(--color-muted)]">
                <span className="font-medium text-[var(--color-foreground)]">ESPN uses this name for schedules:</span>{" "}
                {espnTeams.data.find((x) => x.id === espnTeamId)?.name ?? "—"} — match your pattern’s{" "}
                <code className="font-mono">away</code>/<code className="font-mono">home</code> text to this (or add
                aliases).
              </p>
            ) : null}
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Find Dispatcharr channel</Label>
            <div className="flex gap-2">
              <Input
                value={daSearch}
                onChange={(e) => setDaSearch(e.target.value)}
                placeholder="Search by name…"
                className="flex-1"
              />
              <span className="inline-flex items-center text-[var(--color-muted)]">
                <Search className="h-4 w-4" />
              </span>
            </div>
            {daChannels.isError && (
              <p className="text-xs text-[var(--color-danger)]">
                Could not load channels. Configure Dispatcharr in Settings or enter an ID manually.
              </p>
            )}
            {daChannels.data && daChannels.data.length > 0 && (
              <ul className="max-h-36 overflow-y-auto rounded-lg border border-white/10 bg-black/20 text-xs">
                {daChannels.data.slice(0, 50).map((c, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-white/10"
                      onClick={() => {
                        const id = c.id ?? c.pk;
                        setDispatcharrChannelId(String(id ?? ""));
                      }}
                    >
                      {channelRowLabel(c)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <Label>Dispatcharr channel ID</Label>
            <Input
              value={dispatcharrChannelId}
              onChange={(e) => setDispatcharrChannelId(e.target.value)}
              placeholder="e.g. 42"
              inputMode="numeric"
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">Set manually or pick from search results above.</p>
          </div>
          <div className="md:col-span-2">
            <Label>Aliases (comma-separated, optional)</Label>
            <Input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="Twins, Minnesota" />
            <AliasesFieldHelp />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            onClick={() => create.mutate()}
            disabled={create.isPending || !profile || !dispatcharrChannelId}
          >
            <Plus className="h-4 w-4" />
            Add mapping
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Current mappings</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[var(--color-muted)]">
                <th className="pb-2 pr-4">Team</th>
                <th className="pb-2 pr-4">ESPN ID</th>
                <th className="pb-2 pr-4">Profile</th>
                <th className="pb-2 pr-4">Dispatcharr ch.</th>
                <th className="pb-2 pr-4">On</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {teams.data?.map((t) => (
                <tr key={t.id} className="border-t border-white/5">
                  <td className="py-2 pr-4 font-medium">{t.team_name}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{t.espn_team_id}</td>
                  <td className="py-2 pr-4">{profiles.data?.find((p) => p.id === t.league_profile_id)?.name ?? t.league_profile_id}</td>
                  <td className="py-2 pr-4 font-mono">{t.dispatcharr_channel_id}</td>
                  <td className="py-2 pr-4 text-xs">{t.enabled ? "Yes" : "No"}</td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="danger" onClick={() => remove.mutate(t.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!teams.data?.length && <p className="text-sm text-[var(--color-muted)]">No mappings yet.</p>}
        </div>
      </Card>

      <Dialog
        open={editOpen}
        onClose={() => {
          if (!update.isPending) {
            setEditOpen(false);
            setEditRow(null);
            setEditError(null);
          }
        }}
        title="Edit team channel"
        className="max-w-2xl"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>League profile</Label>
            <select
              className="w-full rounded-lg border border-[var(--color-card-border)] bg-black/30 px-3 py-2 text-sm"
              value={editLeagueProfileId === "" ? "" : String(editLeagueProfileId)}
              onChange={(e) => setEditLeagueProfileId(e.target.value ? Number(e.target.value) : "")}
            >
              {profiles.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>ESPN team</Label>
            <select
              className="w-full rounded-lg border border-[var(--color-card-border)] bg-black/30 px-3 py-2 text-sm"
              disabled={!editEspnTeams.data?.length}
              value={editEspnTeamId}
              onChange={(e) => setEditEspnTeamId(e.target.value)}
            >
              {editEspnTeams.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {editEspnTeams.isLoading && <p className="mt-1 text-xs text-[var(--color-muted)]">Loading teams…</p>}
            {editEspnTeams.isError && <p className="mt-1 text-xs text-red-400">Could not load ESPN teams</p>}
            {editEspnTeams.data && editEspnTeamId ? (
              <p className="mt-2 rounded-lg bg-black/25 px-3 py-2 text-xs text-[var(--color-muted)]">
                <span className="font-medium text-[var(--color-foreground)]">ESPN schedule name:</span>{" "}
                {editEspnTeams.data.find((x) => x.id === editEspnTeamId)?.name ?? "—"}
              </p>
            ) : null}
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Find Dispatcharr channel</Label>
            <div className="flex gap-2">
              <Input
                value={editDaSearch}
                onChange={(e) => setEditDaSearch(e.target.value)}
                placeholder="Search by name…"
                className="flex-1"
              />
            </div>
            {editDaChannels.isError && (
              <p className="text-xs text-[var(--color-danger)]">Could not load channels from Dispatcharr.</p>
            )}
            {editDaChannels.data && editDaChannels.data.length > 0 && (
              <ul className="max-h-36 overflow-y-auto rounded-lg border border-white/10 bg-black/20 text-xs">
                {editDaChannels.data.slice(0, 50).map((c, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-white/10"
                      onClick={() => {
                        const id = c.id ?? c.pk;
                        setEditDispatcharrChannelId(String(id ?? ""));
                      }}
                    >
                      {channelRowLabel(c)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <Label>Dispatcharr channel ID</Label>
            <Input
              value={editDispatcharrChannelId}
              onChange={(e) => setEditDispatcharrChannelId(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Aliases (comma-separated)</Label>
            <Input value={editAliases} onChange={(e) => setEditAliases(e.target.value)} />
            <AliasesFieldHelp />
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <input
              id="edit-tc-enabled"
              type="checkbox"
              className="h-4 w-4 rounded border-white/20"
              checked={editEnabled}
              onChange={(e) => setEditEnabled(e.target.checked)}
            />
            <Label htmlFor="edit-tc-enabled" className="cursor-pointer">
              Enabled (tracked)
            </Label>
          </div>
        </div>
        {editError && <p className="mt-3 text-sm text-[var(--color-danger)]">{editError}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setEditOpen(false);
              setEditRow(null);
              setEditError(null);
            }}
            disabled={update.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => update.mutate()}
            disabled={update.isPending || !editDispatcharrChannelId}
          >
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
