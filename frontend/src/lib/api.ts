import type {
  AppSettings,
  Dashboard,
  DispatcharrChannel,
  EspnTeam,
  Health,
  LeagueProfile,
  LeagueProfileCreate,
  LeagueProfileInput,
  LogPage,
  LogQuery,
  M3uAccount,
  ProfilesSummary,
  StreamCheck,
  TeamChannel,
  TeamGamesResponse,
  TeamStatusResponse,
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
    let message = t || r.statusText;
    try {
      const detail = (JSON.parse(t) as { detail?: unknown }).detail;
      if (typeof detail === "string") message = detail;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  if (r.status === 204) return undefined as T;
  return r.json() as Promise<T>;
}

type QueryValue = string | number | null | undefined;

function query(params: Record<string, QueryValue | QueryValue[]>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    for (const item of Array.isArray(v) ? v : [v]) {
      if (item !== null && item !== undefined) q.append(k, String(item));
    }
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export type StreamCheckParams = {
  espn_sport: string;
  espn_league: string;
  m3u_account_id: number | null;
  channel_group: string;
  contains: string;
};

export const api = {
  getSettings: () => req<AppSettings>("/settings"),
  putSettings: (body: AppSettings) =>
    req<AppSettings>("/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  health: () => req<Health>("/health"),
  testDispatcharr: (dispatcharr_url?: string, dispatcharr_token?: string) =>
    req<{
      ok: boolean;
      message: string;
      detail?: {
        latency_ms?: number;
        channels?: number | null;
        streams?: number | null;
        [key: string]: unknown;
      } | null;
    }>("/settings/test-dispatcharr", {
      method: "POST",
      body: JSON.stringify({ dispatcharr_url, dispatcharr_token }),
    }),

  listProfiles: () => req<LeagueProfile[]>("/profiles"),
  getProfile: (id: number) => req<LeagueProfile>(`/profiles/${id}`),
  profilesSummary: () => req<ProfilesSummary>("/profiles/summary"),
  createProfile: (body: LeagueProfileCreate) =>
    req<LeagueProfile>("/profiles", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  duplicateProfile: (id: number) =>
    req<LeagueProfile>(`/profiles/${id}/duplicate`, { method: "POST" }),
  updateProfile: (id: number, body: Partial<LeagueProfileInput>) =>
    req<LeagueProfile>(`/profiles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteProfile: (id: number) => req(`/profiles/${id}`, { method: "DELETE" }),
  streamCheck: (profileId: number | null, p: StreamCheckParams) =>
    req<StreamCheck>(
      `/profiles/${profileId ?? ""}${profileId ? "/" : ""}stream-check${query(p)}`,
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
  teamStatus: () => req<TeamStatusResponse>("/team-channels/status"),
  teamGames: (id: number) =>
    req<TeamGamesResponse>(`/team-channels/${id}/games`),
  putOverride: (
    id: number,
    eventId: string,
    body: { stream_id: number; stream_name: string },
  ) =>
    req(`/team-channels/${id}/overrides/${encodeURIComponent(eventId)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteOverride: (id: number, eventId: string) =>
    req(`/team-channels/${id}/overrides/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
    }),

  dashboard: () => req<Dashboard>("/dashboard"),
  logs: (q: LogQuery) => req<LogPage>(`/logs${query(q)}`),
  espnTeams: (sport: string, league: string) =>
    req<EspnTeam[]>(
      `/espn/teams?sport=${encodeURIComponent(sport)}&league=${encodeURIComponent(league)}`,
    ),
  dispatcharrChannels: (search = "") =>
    req<DispatcharrChannel[]>(
      `/dispatcharr/channels?search=${encodeURIComponent(search)}`,
    ),
  sampleStreams: (p: {
    m3u_account_id: number | null;
    channel_group: string;
    limit: number;
  }) => req<{ id: number; name: string }[]>(`/dispatcharr/streams${query(p)}`),
  m3uAccounts: () => req<M3uAccount[]>("/dispatcharr/m3u-accounts"),
  streamGroups: () => req<string[]>("/dispatcharr/stream-groups"),
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
