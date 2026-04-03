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
  created_at: string;
  team_channel_count?: number;
};

export type TeamChannel = {
  id: number;
  team_name: string;
  espn_team_id: string;
  league_profile_id: number;
  dispatcharr_channel_id: number;
  enabled: boolean;
  aliases: string[];
  created_at: string;
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
