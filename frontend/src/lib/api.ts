import type {
  AppSettings,
  Dashboard,
  EspnTeam,
  LeagueProfile,
  TeamChannel,
} from "./types";

const BASE = "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  if (r.status === 204) return undefined as T;
  return r.json() as Promise<T>;
}

export const api = {
  getSettings: () => req<AppSettings>("/settings"),
  putSettings: (body: AppSettings) =>
    req<AppSettings>("/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  testDispatcharr: (dispatcharr_url?: string, dispatcharr_token?: string) =>
    req<{
      ok: boolean;
      message: string;
      detail?: Record<string, unknown> | null;
    }>("/settings/test-dispatcharr", {
      method: "POST",
      body: JSON.stringify({ dispatcharr_url, dispatcharr_token }),
    }),

  listProfiles: () => req<LeagueProfile[]>("/profiles"),
  createProfile: (
    body: Partial<LeagueProfile> & {
      name: string;
      stream_pattern: string;
      espn_sport: string;
      espn_league: string;
    },
  ) =>
    req<LeagueProfile>("/profiles", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateProfile: (id: number, body: Partial<LeagueProfile>) =>
    req<LeagueProfile>(`/profiles/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteProfile: (id: number) => req(`/profiles/${id}`, { method: "DELETE" }),
  testPattern: (pattern: string, stream_name: string) =>
    req<{ matched: boolean; groups: Record<string, string>; error?: string }>(
      "/profiles/test-pattern",
      {
        method: "POST",
        body: JSON.stringify({ pattern, stream_name }),
      },
    ),

  listTeamChannels: () => req<TeamChannel[]>("/team-channels"),
  createTeamChannel: (body: Omit<TeamChannel, "id" | "created_at">) =>
    req<TeamChannel>("/team-channels", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateTeamChannel: (id: number, body: Partial<TeamChannel>) =>
    req<TeamChannel>(`/team-channels/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteTeamChannel: (id: number) =>
    req(`/team-channels/${id}`, { method: "DELETE" }),

  dashboard: () => req<Dashboard>("/dashboard"),
  logs: (limit = 100) => req<Record<string, unknown>[]>(`/logs?limit=${limit}`),
  espnTeams: (sport: string, league: string) =>
    req<EspnTeam[]>(
      `/espn/teams?sport=${encodeURIComponent(sport)}&league=${encodeURIComponent(league)}`,
    ),
  dispatcharrChannels: (search = "") =>
    req<Record<string, unknown>[]>(
      `/dispatcharr/channels?search=${encodeURIComponent(search)}`,
    ),
  runNow: () =>
    req<{ ok: boolean; message: string }>("/run-now", { method: "POST" }),
  routingPreview: () =>
    req<{
      ok: boolean;
      message: string;
      items: {
        team_channel_id: number;
        team_name: string;
        league_profile_id: number;
        dispatcharr_channel_id: number;
        status: string;
        reason: string;
        next_game: string | null;
        matched_stream_name: string | null;
      }[];
    }>("/routing-preview"),
  upcomingStreamMatches: () =>
    req<{
      ok: boolean;
      message: string;
      items: {
        team_channel_id: number;
        team_name: string;
        league_profile_id: number;
        dispatcharr_channel_id: number;
        status: string;
        reason: string;
        next_game: string | null;
        game_time: string | null;
        in_routing_window: boolean;
        matched_stream_name: string | null;
        matched_stream_id: number | null;
        streams_in_list: number;
      }[];
    }>("/upcoming-stream-matches"),
};
