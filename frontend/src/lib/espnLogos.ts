/**
 * Deterministic ESPN CDN URLs for team and league logos.
 * These don't require API calls — the URL pattern is stable.
 */

export function teamLogoUrl(sport: string, abbr: string, dark = false): string {
  if (!sport || !abbr) return "";
  const base = `https://a.espncdn.com/i/teamlogos/${sport}/500`;
  return `${dark ? `${base}-dark` : base}/${abbr.toLowerCase()}.png`;
}

export function leagueLogoUrl(league: string): string {
  if (!league) return "";
  return `https://a.espncdn.com/combiner/i?img=/i/leaguelogos/500/${league}.png&w=80&h=80&transparent=true`;
}

/**
 * Map from espn_league slug to a human-readable sport string for logo URLs.
 * ESPN uses the sport in logo paths, not the league.
 */
const LEAGUE_TO_SPORT: Record<string, string> = {
  mlb: "baseball",
  nfl: "football",
  "college-football": "football",
  nba: "basketball",
  wnba: "basketball",
  "mens-college-basketball": "basketball",
  nhl: "hockey",
  "mens-college-hockey": "hockey",
  "usa.1": "soccer",
  "eng.1": "soccer",
  "uefa.champions": "soccer",
  "usa.nwsl": "soccer",
};

export function sportForLeague(league: string): string {
  return LEAGUE_TO_SPORT[league] ?? "";
}
