import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CUSTOM_PRESET_ID, ESPN_LEAGUE_PRESETS, presetById, presetIdForSlug } from "@/lib/espnLeagues";

const selectClass =
  "w-full rounded-lg border border-[var(--color-card-border)] bg-black/30 px-3 py-2 text-sm";

type Props = {
  sport: string;
  league: string;
  onChange: (next: { espn_sport: string; espn_league: string }) => void;
};

export function EspnLeaguePick({ sport, league, onChange }: Props) {
  const selectVal = presetIdForSlug(sport, league);

  return (
    <>
      <div className="md:col-span-2">
        <Label>ESPN league</Label>
        <select
          className={selectClass}
          value={selectVal}
          onChange={(e) => {
            const v = e.target.value;
            if (v === CUSTOM_PRESET_ID) {
              onChange({ espn_sport: sport, espn_league: league });
              return;
            }
            const p = presetById(v);
            if (p) onChange({ espn_sport: p.sport, espn_league: p.league });
          }}
        >
          {ESPN_LEAGUE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value={CUSTOM_PRESET_ID}>Other (manual sport &amp; league slugs)…</option>
        </select>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Uses ESPN’s public API paths for schedules and team lists. Pick “Other” if your league is not in the list.
        </p>
      </div>
      {selectVal === CUSTOM_PRESET_ID && (
        <>
          <div>
            <Label>ESPN sport slug</Label>
            <Input
              value={sport}
              onChange={(e) => onChange({ espn_sport: e.target.value, espn_league: league })}
              placeholder="e.g. baseball"
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label>ESPN league slug</Label>
            <Input
              value={league}
              onChange={(e) => onChange({ espn_sport: sport, espn_league: e.target.value })}
              placeholder="e.g. mlb"
              className="font-mono text-xs"
            />
          </div>
        </>
      )}
    </>
  );
}
