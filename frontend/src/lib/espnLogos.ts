/**
 * ESPN CDN URLs for team and league logos.
 * Paths follow what ESPN serves (see team `logos[].href` from the public teams API).
 */

/** Pro / WNBA leagues: filename is lowercase team abbreviation. */
const ABBR_LOGO_LEAGUES = new Set(["mlb", "nfl", "nba", "nhl", "wnba"]);

/**
 * Maps `espn_league` (API league slug) → CDN folder under /i/teamlogos/{folder}/500/...
 */
const LEAGUE_TO_CDN_FOLDER: Record<string, string> = {
  mlb: "mlb",
  nfl: "nfl",
  nba: "nba",
  nhl: "nhl",
  wnba: "wnba",
  "college-football": "ncaa",
  "mens-college-basketball": "ncaa",
  "mens-college-hockey": "ncaa",
  "usa.1": "soccer",
  "eng.1": "soccer",
  "uefa.champions": "soccer",
  "usa.nwsl": "soccer",
};

function normalizeLeagueSlug(league: string): string {
  return league.trim().toLowerCase();
}

function cdnFolderForLeague(league: string): string {
  return LEAGUE_TO_CDN_FOLDER[normalizeLeagueSlug(league)] ?? "";
}

/** True when the logo file is {espn_team_id}.png (soccer, NCAA), not abbreviation. */
function logoUsesEspnTeamId(league: string): boolean {
  return !ABBR_LOGO_LEAGUES.has(normalizeLeagueSlug(league));
}

/**
 * Build team logo URL. For abbreviation leagues pass `espnTeamId` for consistency but only
 * `abbreviation` is used; for soccer/NCAA, `espnTeamId` is required.
 */
export function teamLogoUrl(
  league: string,
  abbreviation: string,
  espnTeamId: string,
  dark = false,
): string {
  const folder = cdnFolderForLeague(league);
  if (!folder) return "";

  const id = espnTeamId.trim();
  const abbr = abbreviation.trim().toLowerCase();

  let segment: string;
  if (logoUsesEspnTeamId(league)) {
    segment = id;
  } else {
    // Pro / WNBA: filename is usually the team abbreviation (e.g. nyy.png).
    // If abbr is missing (legacy rows), ESPN also serves by internal team id (e.g. 1.png for BAL).
    segment = abbr || id;
  }
  if (!segment) return "";

  const base = `https://a.espncdn.com/i/teamlogos/${folder}/500`;
  return `${dark ? `${base}-dark` : base}/${segment}.png`;
}

/**
 * League mark under /i/teamlogos/leagues/500/{file}.png — slug often differs from `espn_league`.
 */
const LEAGUE_LOGO_FILE: Record<string, string> = {
  mlb: "mlb",
  nfl: "nfl",
  nba: "nba",
  nhl: "nhl",
  wnba: "wnba",
  "usa.1": "mls",
  "usa.nwsl": "nwsl",
};

export function leagueLogoUrl(league: string): string {
  const file = LEAGUE_LOGO_FILE[normalizeLeagueSlug(league)];
  if (!file) return "";
  return `https://a.espncdn.com/i/teamlogos/leagues/500/${file}.png`;
}
