export type AppSettings = {
  dispatcharr_url: string;
  dispatcharr_token: string;
  timezone: string;
  scan_interval_minutes: number;
  pre_game_minutes: number;
  schedule_refresh_hours: number;
  schedule_lookahead_days: number;
};

export type LeagueProfile = {
  id: number;
  name: string;
  stream_pattern: string;
  stream_name_filter: string;
  espn_sport: string;
  espn_league: string;
  enabled: boolean;
  exclude_terms: string[];
  m3u_account_id: number | null;
  channel_group: string;
  created_at: string;
  team_channel_count?: number;
};

export type LeagueProfileInput = Omit<
  LeagueProfile,
  "id" | "created_at" | "team_channel_count"
>;

export type StreamCheckGame = {
  id: string;
  home_team: string;
  away_team: string;
  home_team_id: string;
  away_team_id: string;
  home_short: string;
  away_short: string;
  game_time: string;
  status: string;
};

export type StreamCheck = {
  ok: boolean;
  error: string | null;
  games_error: string | null;
  streams: { id: number; name: string }[];
  games: StreamCheckGame[];
  aliases_by_team_id: Record<string, string[]>;
  timezone: string;
};

export type M3uAccount = { id: number; name: string; is_active: boolean };

export type DispatcharrChannel = {
  id: number;
  name?: string;
  channel_number?: number | string | null;
  [key: string]: unknown;
};

/** Pattern capture range: [start, end, field] into the trimmed title. */
export type Span = [number, number, string];

export type RoutingStatus =
  | "override"
  | "ready"
  | "conflict"
  | "near_miss"
  | "not_listed"
  | "no_game"
  | "error";

export type TeamGame = {
  id: string;
  home_team: string;
  away_team: string;
  home_team_id: string;
  away_team_id: string;
  is_home: boolean;
  opponent: {
    id: string;
    name: string;
    short_name: string;
    abbreviation: string;
  };
  game_time: string;
  switch_at: string | null;
  state: string;
  in_window: boolean;
};

export type StreamWinner = {
  stream_id: number;
  name: string;
  n: string | null;
};

export type StreamOverride = {
  stream_id: number;
  stream_name: string;
  created_at: string | null;
  missing: boolean;
};

export type RoutingEvaluation = {
  status: RoutingStatus;
  winner: StreamWinner | null;
  override: StreamOverride | null;
  rank_reason: "only_fit" | "closest_time" | "listed_first" | null;
  fit_count: number;
  candidate_count: number;
};

export type TeamStatusItem = RoutingEvaluation & {
  team_channel_id: number;
  routing_enabled: boolean;
  error: string | null;
  next_game: TeamGame | null;
};

export type TeamStatusResponse = {
  ok: boolean;
  checked_at: string;
  items: TeamStatusItem[];
};

export type Candidate = {
  stream_id: number;
  name: string;
  kind: "fit" | "skipped" | "rejected";
  groups: Record<string, string>;
  spans: Span[];
  our_side: "home" | "away";
  our_side_result: string | null;
  opp_side_result: string | null;
  skip_term: string | null;
  time_delta_minutes: number | null;
};

export type TeamGameDetail = TeamGame &
  RoutingEvaluation & {
    candidates: Candidate[];
  };

export type TeamGamesResponse = {
  ok: boolean;
  error: string | null;
  team_channel_id: number;
  routing_enabled: boolean;
  profile: { id: number; name: string; espn_league: string };
  pre_game_minutes: number;
  scan_interval_minutes: number;
  current_stream: { id: number; name: string } | null;
  current_stream_error: string | null;
  games: TeamGameDetail[];
  alias_suggestions: string[];
};

export type TeamChannel = {
  id: number;
  team_name: string;
  espn_team_id: string;
  espn_team_abbr: string;
  league_profile_id: number;
  dispatcharr_channel_id: number;
  enabled: boolean;
  aliases: string[];
  created_at: string;
};

export type EspnTeam = {
  id: string;
  name: string;
  abbreviation: string;
  logo: string;
  logo_dark: string;
  color: string;
  alternateColor: string;
};

export type UpcomingGameExtraLeague = {
  league_profile_id: number;
  league: string;
  games: Record<string, unknown>[];
};

export type Dashboard = {
  dispatcharr_configured: boolean;
  next_scan_at: string | null;
  tracked_teams: number;
  upcoming_games: Record<string, unknown>[];
  upcoming_games_extra_by_league: UpcomingGameExtraLeague[];
  recent_switches: Record<string, unknown>[];
  health: Record<string, unknown>;
};
