import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { channelLabel, useDispatcharrChannels } from "@/lib/teams";
import type { LeagueProfile, TeamChannel } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  profiles: LeagueProfile[];
  teams: TeamChannel[];
};

export function AddTeamDialog({ open, onClose, profiles, teams }: Props) {
  const qc = useQueryClient();
  const [profileId, setProfileId] = useState<number | null>(null);
  const [teamId, setTeamId] = useState("");
  const [channelId, setChannelId] = useState("");

  const profile =
    profiles.find((p) => p.id === profileId) ?? profiles[0] ?? null;
  const espnTeamsQ = useQuery({
    queryKey: ["espn-teams", profile?.espn_sport, profile?.espn_league],
    queryFn: () => api.espnTeams(profile!.espn_sport, profile!.espn_league),
    enabled: open && !!profile,
    staleTime: 60 * 60_000,
  });
  const channelsQ = useDispatcharrChannels();

  const taken = new Set(
    teams
      .filter((t) => t.league_profile_id === profile?.id)
      .map((t) => t.espn_team_id),
  );
  const espnTeams = (espnTeamsQ.data ?? []).filter((t) => !taken.has(t.id));

  const close = () => {
    setTeamId("");
    setChannelId("");
    create.reset();
    onClose();
  };

  const create = useMutation({
    mutationFn: () => {
      const team = espnTeams.find((t) => t.id === teamId)!;
      return api.createTeamChannel({
        team_name: team.name,
        espn_team_id: team.id,
        espn_team_abbr: team.abbreviation,
        league_profile_id: profile!.id,
        dispatcharr_channel_id: Number(channelId),
        enabled: true,
        aliases: [],
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["team-channels"] });
      void qc.invalidateQueries({ queryKey: ["team-status"] });
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      close();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add Team"
      className="max-w-[480px]"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div>
          <Label htmlFor="add-profile">League Profile</Label>
          <Select
            id="add-profile"
            value={profile?.id ?? ""}
            onChange={(e) => {
              setProfileId(Number(e.target.value));
              setTeamId("");
            }}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="add-team">ESPN Team</Label>
          <Select
            id="add-team"
            value={teamId}
            disabled={!profile || espnTeamsQ.isLoading}
            onChange={(e) => setTeamId(e.target.value)}
          >
            <option value="">
              {espnTeamsQ.isLoading
                ? "Loading teams…"
                : espnTeamsQ.isError
                  ? "Couldn't load ESPN teams"
                  : "Select a team…"}
            </option>
            {espnTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="add-channel">Dispatcharr Channel</Label>
          <Select
            id="add-channel"
            value={channelId}
            disabled={channelsQ.isLoading || channelsQ.isError}
            onChange={(e) => setChannelId(e.target.value)}
          >
            <option value="">
              {channelsQ.isError
                ? "Couldn't load channels from Dispatcharr"
                : "Select a channel…"}
            </option>
            {(channelsQ.data ?? []).map((ch) => (
              <option key={ch.id} value={ch.id}>
                {channelLabel(ch)}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-(--color-muted)">
          Once added, the team shows up here with its next game and candidate
          streams.
        </p>
        {espnTeamsQ.error && (
          <p className="text-xs text-(--color-danger)">
            {espnTeamsQ.error.message}
          </p>
        )}
        {create.error && (
          <p className="text-xs text-(--color-danger)">
            {create.error.message}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={!profile || !teamId || !channelId || create.isPending}
          >
            {create.isPending ? "Adding..." : "Add Team"}
          </Button>
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
