import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CUSTOM_PRESET_ID, ESPN_LEAGUE_PRESETS, presetById, presetIdForSlug } from "@/lib/espnLeagues";

const selectClass =
  "w-full rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-foreground) outline-none focus:border-(--color-accent) focus:ring-2 focus:ring-(--color-accent)/30";

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
        <Label>ESPN League</Label>
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
          <option value={CUSTOM_PRESET_ID}>Other (manual sport &amp; league slugs)...</option>
        </select>
        <p className="mt-1 text-xs text-(--color-muted)">
          ESPN&apos;s public API for schedules and team lists.
        </p>
      </div>
      {selectVal === CUSTOM_PRESET_ID && (
        <>
          <div>
            <Label>ESPN Sport Slug</Label>
            <Input
              value={sport}
              onChange={(e) => onChange({ espn_sport: e.target.value, espn_league: league })}
              placeholder="e.g. baseball"
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label>ESPN League Slug</Label>
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
