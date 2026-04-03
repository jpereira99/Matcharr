/** ESPN site.api.espn.com path segments: /sports/{sport}/{league}/... */

export type EspnLeaguePreset = {
  id: string;
  sport: string;
  league: string;
  label: string;
};

export const ESPN_LEAGUE_PRESETS: EspnLeaguePreset[] = [
  { id: "baseball|mlb", sport: "baseball", league: "mlb", label: "MLB" },
  { id: "football|nfl", sport: "football", league: "nfl", label: "NFL" },
  { id: "football|college-football", sport: "football", league: "college-football", label: "NCAA Football" },
  { id: "basketball|nba", sport: "basketball", league: "nba", label: "NBA" },
  { id: "basketball|wnba", sport: "basketball", league: "wnba", label: "WNBA" },
  {
    id: "basketball|mens-college-basketball",
    sport: "basketball",
    league: "mens-college-basketball",
    label: "NCAA Men's Basketball",
  },
  { id: "hockey|nhl", sport: "hockey", league: "nhl", label: "NHL" },
  { id: "hockey|mens-college-hockey", sport: "hockey", league: "mens-college-hockey", label: "NCAA Men's Hockey" },
  { id: "soccer|usa.1", sport: "soccer", league: "usa.1", label: "MLS" },
  { id: "soccer|eng.1", sport: "soccer", league: "eng.1", label: "English Premier League" },
  { id: "soccer|uefa.champions", sport: "soccer", league: "uefa.champions", label: "UEFA Champions League" },
  { id: "soccer|usa.nwsl", sport: "soccer", league: "usa.nwsl", label: "NWSL" },
];

export const CUSTOM_PRESET_ID = "__custom__";

export function presetIdForSlug(sport: string, league: string): string {
  const hit = ESPN_LEAGUE_PRESETS.find((p) => p.sport === sport && p.league === league);
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

export function presetById(id: string): EspnLeaguePreset | undefined {
  return ESPN_LEAGUE_PRESETS.find((p) => p.id === id);
}
