import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { api } from "@/lib/api";
import { ESPN_LEAGUE_PRESETS } from "@/lib/espnLeagues";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function CreateProfileDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [presetId, setPresetId] = useState(ESPN_LEAGUE_PRESETS[0].id);
  const [account, setAccount] = useState<number | null>(null);
  const [group, setGroup] = useState("");

  const accountsQ = useQuery({
    queryKey: ["m3u-accounts"],
    queryFn: api.m3uAccounts,
    staleTime: 5 * 60_000,
    retry: false,
    enabled: open,
  });
  const groupsQ = useQuery({
    queryKey: ["stream-groups"],
    queryFn: api.streamGroups,
    staleTime: 5 * 60_000,
    retry: false,
    enabled: open,
  });
  const sourceKey = useDebouncedValue(JSON.stringify([account, group]), 250);
  const examplesQ = useQuery({
    queryKey: ["stream-sample", sourceKey],
    queryFn: () => {
      const [m3u, grp] = JSON.parse(sourceKey) as [number | null, string];
      return api.sampleStreams({
        m3u_account_id: m3u,
        channel_group: grp,
        limit: 3,
      });
    },
    enabled: open,
    staleTime: 60_000,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () => {
      const preset = ESPN_LEAGUE_PRESETS.find((p) => p.id === presetId)!;
      return api.createProfile({
        name: name.trim(),
        stream_pattern: "",
        stream_name_filter: "",
        espn_sport: preset.sport,
        espn_league: preset.league,
        enabled: false,
        m3u_account_id: account,
        channel_group: group,
      });
    },
    onSuccess: (p) => {
      qc.setQueryData(["profile", p.id], p);
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      close();
      navigate(`/profiles/${p.id}?step=title`);
    },
  });

  function close() {
    setName("");
    create.reset();
    onClose();
  }

  const examples = examplesQ.data ?? [];

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Create Profile"
      className="max-w-[520px]"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="new-profile-name">Name</Label>
            <Input
              id="new-profile-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. NWSL Prime"
            />
          </div>
          <div>
            <Label htmlFor="new-profile-league">ESPN League</Label>
            <Select
              id="new-profile-league"
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
            >
              {ESPN_LEAGUE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="new-profile-account">M3U Account</Label>
            <Select
              id="new-profile-account"
              value={account ?? ""}
              onChange={(e) =>
                setAccount(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">All accounts</option>
              {(accountsQ.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="new-profile-group">Channel Group</Label>
            <Select
              id="new-profile-group"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              <option value="">All groups</option>
              {(groupsQ.data ?? []).map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 rounded-(--radius-md) bg-(--color-surface-raised) px-3 py-2.5">
          <div className="text-xs text-(--color-muted)">
            Example titles in this group
          </div>
          <div className="font-mono text-xs leading-[1.6] break-words text-(--color-text-secondary)">
            {examplesQ.isLoading ? (
              "Loading…"
            ) : examplesQ.isError ? (
              <span className="font-sans text-(--color-warning)">
                Couldn&apos;t load streams from Dispatcharr.
              </span>
            ) : examples.length ? (
              examples.map((s) => <div key={s.id}>{s.name}</div>)
            ) : (
              <span className="font-sans text-(--color-muted)">
                No streams in this account and group yet.
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-(--color-muted)">
          Next you&apos;ll pick one of these and tag its Home and Away teams.
        </p>
        {create.error && (
          <p className="text-xs text-(--color-danger)">
            {create.error.message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            {create.isPending ? "Creating..." : "Continue to title format"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
