"""Match ESPN games to Dispatcharr streams and switch channels."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone, tzinfo
from typing import Any
from zoneinfo import ZoneInfo

import aiosqlite

from app.database import kv_get, kv_set
from app.models import AppSettings
from app.services.candidates import (
    GameEvaluation,
    alias_suggestions,
    rank_candidates,
    summarize,
)
from app.services.dispatcharr import DispatcharrClient, DispatcharrError
from app.services.patterns import CompiledPattern, compile_league_pattern
from app.settings_store import load_settings

# Games that started longer ago than this are treated as over for display.
_DISPLAY_LOOKBACK = timedelta(hours=6)


def _json_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    return [str(x) for x in data] if isinstance(data, list) else []


def _aliases(row: dict[str, Any]) -> list[str]:
    return _json_list(row.get("aliases_json"))


def local_tz(settings: AppSettings) -> tzinfo:
    try:
        return ZoneInfo(settings.timezone)
    except Exception:
        return timezone.utc


def parse_game_time(game: dict[str, Any]) -> datetime | None:
    try:
        gt = datetime.fromisoformat(str(game["game_time"]))
    except Exception:
        return None
    return gt if gt.tzinfo else gt.replace(tzinfo=timezone.utc)


def _client_for(settings: AppSettings) -> DispatcharrClient | None:
    if not settings.dispatcharr_url or not settings.dispatcharr_token:
        return None
    return DispatcharrClient(settings.dispatcharr_url, settings.dispatcharr_token)


async def _get_profiles(db: aiosqlite.Connection) -> list[dict[str, Any]]:
    cur = await db.execute("SELECT * FROM league_profiles WHERE enabled = 1")
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


_TEAM_ROWS_SQL = """
    SELECT tc.*, lp.name AS profile_name, lp.stream_pattern, lp.stream_name_filter,
           lp.espn_sport, lp.espn_league, lp.exclude_terms_json, lp.m3u_account_id,
           lp.channel_group, lp.enabled AS profile_enabled
    FROM team_channels tc
    JOIN league_profiles lp ON lp.id = tc.league_profile_id
"""


async def _get_team_channels(
    db: aiosqlite.Connection, *, include_disabled: bool = False
) -> list[dict[str, Any]]:
    sql = _TEAM_ROWS_SQL
    if not include_disabled:
        sql += " WHERE tc.enabled = 1 AND lp.enabled = 1"
    cur = await db.execute(sql + " ORDER BY tc.id")
    return [dict(r) for r in await cur.fetchall()]


async def get_team_channel_row(
    db: aiosqlite.Connection, tc_id: int
) -> dict[str, Any] | None:
    cur = await db.execute(_TEAM_ROWS_SQL + " WHERE tc.id = ?", (tc_id,))
    row = await cur.fetchone()
    return dict(row) if row else None


def _game_active_for_team(
    game: dict[str, Any],
    now: datetime,
    pre_game_minutes: int,
) -> bool:
    gt = parse_game_time(game)
    if gt is None:
        return False
    now_aware = (
        now.astimezone(timezone.utc) if now.tzinfo else now.replace(tzinfo=timezone.utc)
    )
    status = str(game.get("status", "")).lower()
    if status == "post":
        return False
    if status == "in":
        # Trust live status, but cap at 8 h from game_time to guard against stale cache
        return now_aware <= gt + timedelta(hours=8)
    # pre / scheduled — route within pre-game window through end of typical broadcast
    window_start = gt - timedelta(minutes=pre_game_minutes)
    window_end = gt + timedelta(hours=12)
    return window_start <= now_aware <= window_end


def _upcoming_games_for_team(
    games: list[dict[str, Any]], team_id: str, now: datetime
) -> list[tuple[dict[str, Any], bool]]:
    """Non-post games involving team_id, soonest first, as (game, my_team_is_home).

    Uses a 6-hour lookback as a display-only heuristic: any game that started
    more than 6 h ago is almost certainly over, even if the cached ESPN status
    hasn't flipped to "post" yet.
    """
    cutoff = now - _DISPLAY_LOOKBACK
    mine: list[tuple[dict[str, Any], bool]] = []
    for g in games:
        if str(g.get("status", "")).lower() == "post":
            continue
        gt = parse_game_time(g)
        if gt is not None and gt < cutoff:
            continue
        hid, aid = str(g["home_team_id"]), str(g["away_team_id"])
        if hid == team_id:
            mine.append((g, True))
        elif aid == team_id:
            mine.append((g, False))
    mine.sort(key=lambda gh: str(gh[0].get("game_time", "")))
    return mine


def _next_scheduled_game_for_team(
    games: list[dict[str, Any]],
    team_id: str,
) -> tuple[dict[str, Any] | None, bool]:
    """Earliest non-post game involving team_id. Returns (game, my_team_is_home)."""
    mine = _upcoming_games_for_team(games, team_id, datetime.now(timezone.utc))
    return mine[0] if mine else (None, False)


def _pick_game_for_team(
    games: list[dict[str, Any]],
    team_id: str,
    now: datetime,
    pre_game_minutes: int,
) -> tuple[dict[str, Any] | None, bool]:
    """Returns (game, my_team_is_home)."""
    mine: list[tuple[dict[str, Any], bool]] = []
    for g in games:
        if str(g.get("status", "")).lower() == "post":
            continue
        hid, aid = str(g["home_team_id"]), str(g["away_team_id"])
        if hid == team_id:
            mine.append((g, True))
        elif aid == team_id:
            mine.append((g, False))
    if not mine:
        return None, False
    active = [
        (g, h) for g, h in mine if _game_active_for_team(g, now, pre_game_minutes)
    ]
    if not active:
        return None, False
    active.sort(key=lambda gh: str(gh[0].get("game_time", "")))
    return active[0]


async def _ensure_schedule_cache(
    db: aiosqlite.Connection,
    profile_row: dict[str, Any],
    settings,
) -> list[dict[str, Any]]:
    from app.services import espn as espn_service

    pid = profile_row["id"]
    sport = profile_row["espn_sport"]
    league = profile_row["espn_league"]
    games = await espn_service.fetch_games_for_league(
        sport, league, settings.schedule_lookahead_days
    )
    for g in games:
        raw = json.dumps(g.raw, default=str)
        await db.execute(
            """
            INSERT INTO schedule_cache(
                league_profile_id, espn_event_id, home_team, away_team,
                home_team_id, away_team_id, game_time, status, raw_json, updated_at
            ) VALUES(?,?,?,?,?,?,?,?,?, datetime('now'))
            ON CONFLICT(league_profile_id, espn_event_id) DO UPDATE SET
                home_team=excluded.home_team,
                away_team=excluded.away_team,
                home_team_id=excluded.home_team_id,
                away_team_id=excluded.away_team_id,
                game_time=excluded.game_time,
                status=excluded.status,
                raw_json=excluded.raw_json,
                updated_at=datetime('now')
            """,
            (
                pid,
                g.event_id,
                g.home_team_name,
                g.away_team_name,
                g.home_team_id,
                g.away_team_id,
                g.game_time_utc.isoformat(),
                g.status_state,
                raw,
            ),
        )
    await db.commit()
    return await _cached_games(db, pid)


async def refresh_all_schedules(db: aiosqlite.Connection) -> None:
    settings = await load_settings(db)
    profiles = await _get_profiles(db)
    for p in profiles:
        await _ensure_schedule_cache(db, p, settings)
    await kv_set(db, "last_schedule_refresh", datetime.now(timezone.utc).isoformat())


async def maybe_refresh_schedules(db: aiosqlite.Connection) -> None:
    """Throttle ESPN schedule pulls using settings.schedule_refresh_hours."""
    settings = await load_settings(db)
    last = await kv_get(db, "last_schedule_refresh")
    if last:
        try:
            lt = datetime.fromisoformat(last)
            if lt.tzinfo is None:
                lt = lt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - lt < timedelta(
                hours=settings.schedule_refresh_hours
            ):
                return
        except Exception:
            pass
    await refresh_all_schedules(db)


def compute_next_espn_refresh_at(
    *,
    last_schedule_refresh_iso: str | None,
    schedule_refresh_hours: int,
    next_scan_iso: str | None,
    scan_interval_minutes: int,
) -> str | None:
    """Earliest time the periodic match job will next pull ESPN schedules (same throttle as maybe_refresh)."""
    if not next_scan_iso:
        return None
    try:
        next_scan = datetime.fromisoformat(next_scan_iso.replace("Z", "+00:00"))
        if next_scan.tzinfo is None:
            next_scan = next_scan.replace(tzinfo=timezone.utc)
    except Exception:
        return None

    if not last_schedule_refresh_iso:
        return next_scan_iso

    try:
        last = datetime.fromisoformat(last_schedule_refresh_iso.replace("Z", "+00:00"))
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
    except Exception:
        return next_scan_iso

    threshold = last + timedelta(hours=schedule_refresh_hours)
    now = datetime.now(timezone.utc)
    if now >= threshold:
        return next_scan_iso

    interval = timedelta(minutes=max(1, scan_interval_minutes))
    t = next_scan
    guard = 0
    while t < threshold and guard < 1_000_000:
        t += interval
        guard += 1
    return t.isoformat()


# ── Schedule / alias / override lookups ─────────────────────────────────────


async def _cached_games(db: aiosqlite.Connection, lp_id: int) -> list[dict[str, Any]]:
    cur = await db.execute(
        """
        SELECT espn_event_id AS id, home_team, away_team, home_team_id, away_team_id, game_time, status
        FROM schedule_cache WHERE league_profile_id = ? ORDER BY game_time
        """,
        (lp_id,),
    )
    return [dict(r) for r in await cur.fetchall()]


def team_meta_from_event(raw: dict[str, Any] | None) -> dict[str, dict[str, str]]:
    """ESPN team id -> {abbreviation, short_name} from a scoreboard event."""
    out: dict[str, dict[str, str]] = {}
    if not isinstance(raw, dict):
        return out
    comps = raw.get("competitions") or []
    if not comps:
        return out
    for t in comps[0].get("competitors") or []:
        team = t.get("team") or {}
        tid = str(team.get("id", ""))
        if tid:
            out[tid] = {
                "abbreviation": str(team.get("abbreviation") or ""),
                "short_name": str(
                    team.get("shortDisplayName") or team.get("displayName") or ""
                ),
            }
    return out


async def _event_team_meta(
    db: aiosqlite.Connection, lp_id: int, event_id: str
) -> dict[str, dict[str, str]]:
    cur = await db.execute(
        "SELECT raw_json FROM schedule_cache WHERE league_profile_id = ? AND espn_event_id = ?",
        (lp_id, event_id),
    )
    row = await cur.fetchone()
    if not row or not row[0]:
        return {}
    try:
        return team_meta_from_event(json.loads(row[0]))
    except json.JSONDecodeError:
        return {}


async def aliases_by_team(
    db: aiosqlite.Connection, sport: str, league: str
) -> dict[str, list[str]]:
    """User aliases for every tracked team in an ESPN league, keyed by ESPN team id."""
    cur = await db.execute(
        """
        SELECT tc.espn_team_id, tc.aliases_json
        FROM team_channels tc JOIN league_profiles lp ON lp.id = tc.league_profile_id
        WHERE lp.espn_sport = ? AND lp.espn_league = ?
        """,
        (sport, league),
    )
    out: dict[str, list[str]] = {}
    for r in await cur.fetchall():
        bucket = out.setdefault(str(r[0]), [])
        for a in _json_list(r[1]):
            if a not in bucket:
                bucket.append(a)
    return out


async def cleanup_overrides(db: aiosqlite.Connection) -> None:
    """Drop overrides whose game is over; an override never outlives its game."""
    await db.execute("""
        DELETE FROM stream_overrides
        WHERE team_channel_id NOT IN (SELECT id FROM team_channels)
           OR EXISTS (
                SELECT 1 FROM schedule_cache sc
                JOIN team_channels tc ON tc.league_profile_id = sc.league_profile_id
                WHERE tc.id = stream_overrides.team_channel_id
                  AND sc.espn_event_id = stream_overrides.espn_event_id
                  AND (sc.status = 'post' OR datetime(sc.game_time) < datetime('now', '-1 day'))
           )
        """)
    await db.commit()


async def overrides_for_team(
    db: aiosqlite.Connection, tc_id: int
) -> dict[str, dict[str, Any]]:
    cur = await db.execute(
        "SELECT * FROM stream_overrides WHERE team_channel_id = ?", (tc_id,)
    )
    return {str(r["espn_event_id"]): dict(r) for r in await cur.fetchall()}


# ── Streams per league profile ──────────────────────────────────────────────


def _ref_id(value: Any) -> int | None:
    if isinstance(value, dict):
        value = value.get("id")
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


@dataclass
class ProfileStreams:
    compiled: CompiledPattern | None = None
    streams: list[dict[str, Any]] = field(default_factory=list)
    skip_terms: list[str] = field(default_factory=list)
    error_status: str | None = None  # "pattern_error" | "dispatcharr_error"
    error: str | None = None


class StreamSource:
    """Fetches (and caches for one request/cycle) each profile's stream pool."""

    def __init__(self, client: DispatcharrClient | None) -> None:
        self.client = client
        self._profiles: dict[int, ProfileStreams] = {}
        self._groups: list[dict[str, Any]] | None = None

    async def _group_ids(self, name: str) -> set[int] | None:
        if self._groups is None:
            try:
                self._groups = await self.client.list_channel_groups()
            except Exception:
                return None
        want = name.strip().casefold()
        return {
            gid
            for g in self._groups
            if str(g.get("name", "")).strip().casefold() == want
            and (gid := _ref_id(g.get("id"))) is not None
        }

    async def fetch(
        self,
        *,
        name_filter: str,
        m3u_account_id: int | None,
        channel_group: str,
    ) -> list[dict[str, Any]]:
        """Streams in the pool, filtered server-side and re-checked locally."""
        if self.client is None:
            raise DispatcharrError("Dispatcharr not configured")
        group = channel_group.strip()
        streams = await self.client.list_streams(
            name_contains=name_filter.strip(),
            m3u_account_id=m3u_account_id,
            channel_group_name=group,
        )
        if m3u_account_id is not None:
            streams = [
                s
                for s in streams
                if "m3u_account" not in s
                or _ref_id(s.get("m3u_account")) == m3u_account_id
            ]
        if group:
            ids = await self._group_ids(group)
            if ids is not None:
                streams = [
                    s
                    for s in streams
                    if "channel_group" not in s
                    or _ref_id(s.get("channel_group")) in ids
                ]
        return streams

    async def for_profile(self, row: dict[str, Any]) -> ProfileStreams:
        lp_id = int(row["league_profile_id"])
        if lp_id in self._profiles:
            return self._profiles[lp_id]
        ps = ProfileStreams(skip_terms=_json_list(row.get("exclude_terms_json")))
        try:
            ps.compiled = compile_league_pattern(str(row["stream_pattern"]))
        except ValueError as e:
            ps.error_status, ps.error = "pattern_error", str(e)
        if ps.error is None:
            try:
                ps.streams = await self.fetch(
                    name_filter=str(row.get("stream_name_filter") or ""),
                    m3u_account_id=_ref_id(row.get("m3u_account_id")),
                    channel_group=str(row.get("channel_group") or ""),
                )
            except Exception as e:
                ps.error_status, ps.error = "dispatcharr_error", str(e)
        self._profiles[lp_id] = ps
        return ps


class RoutingContext:
    """Per-request caches shared by the match cycle and the read-only views."""

    def __init__(self, db: aiosqlite.Connection, settings: AppSettings) -> None:
        self.db = db
        self.settings = settings
        self.tz = local_tz(settings)
        self.client = _client_for(settings)
        self.source = StreamSource(self.client)
        self._games: dict[int, list[dict[str, Any]]] = {}
        self._aliases: dict[tuple[str, str], dict[str, list[str]]] = {}

    async def games(self, lp_id: int) -> list[dict[str, Any]]:
        if lp_id not in self._games:
            self._games[lp_id] = await _cached_games(self.db, lp_id)
        return self._games[lp_id]

    async def aliases(self, sport: str, league: str) -> dict[str, list[str]]:
        key = (sport, league)
        if key not in self._aliases:
            self._aliases[key] = await aliases_by_team(self.db, sport, league)
        return self._aliases[key]

    async def evaluate(
        self,
        ps: ProfileStreams,
        row: dict[str, Any],
        game: dict[str, Any],
        is_home: bool,
        override_row: dict[str, Any] | None,
    ) -> GameEvaluation:
        by_team = await self.aliases(str(row["espn_sport"]), str(row["espn_league"]))
        opp_id = str(game["away_team_id"] if is_home else game["home_team_id"])
        opp_name = str(game["away_team"] if is_home else game["home_team"])
        assert ps.compiled is not None
        cands = rank_candidates(
            ps.compiled,
            ps.streams,
            team_name=str(row["team_name"]),
            team_aliases=_aliases(row),
            opp_name=opp_name,
            opp_aliases=by_team.get(opp_id, []),
            is_home=is_home,
            skip_terms=ps.skip_terms,
            game_time=parse_game_time(game),
            local_tz=self.tz,
        )
        return summarize(cands, ps.streams, override_row)


def _matchup(game: dict[str, Any]) -> str:
    return f'{game.get("away_team")} @ {game.get("home_team")}'


# ── Match cycle ─────────────────────────────────────────────────────────────


async def _log_switch(
    db: aiosqlite.Connection,
    tc_id: int,
    from_name: str | None,
    to_name: str | None,
    to_id: int | None,
    reason: str,
) -> None:
    await db.execute(
        """
        INSERT INTO switch_log(team_channel_id, from_stream_name, to_stream_name, to_stream_id, reason)
        VALUES(?,?,?,?,?)
        """,
        (tc_id, from_name, to_name, to_id, reason),
    )
    await db.commit()


async def _route_team(
    ctx: RoutingContext,
    row: dict[str, Any],
    now: datetime,
    errors: list[str],
    reported: set[int],
) -> bool:
    """Switch one team's channel if its game is in the routing window. True if switched."""
    db, client = ctx.db, ctx.client
    assert client is not None
    lp_id = int(row["league_profile_id"])
    ps = await ctx.source.for_profile(row)
    if ps.error:
        if lp_id not in reported:
            reported.add(lp_id)
            label = (
                f"Profile {lp_id} pattern"
                if ps.error_status == "pattern_error"
                else "Dispatcharr streams"
            )
            errors.append(f"{label}: {ps.error}")
        return False

    games = await ctx.games(lp_id)
    game, is_home = _pick_game_for_team(
        games, str(row["espn_team_id"]), now, ctx.settings.pre_game_minutes
    )
    if not game:
        return False

    tc_id = int(row["id"])
    team_name = str(row["team_name"])
    opp = str(game["away_team"]) if is_home else str(game["home_team"])
    override_row = (await overrides_for_team(db, tc_id)).get(str(game["id"]))
    ev = await ctx.evaluate(ps, row, game, is_home, override_row)
    if not ev.winner:
        await _log_switch(
            db,
            tc_id,
            None,
            None,
            None,
            f"No matching stream for game {game.get('id')} ({team_name} vs {opp})",
        )
        return False

    new_id = int(ev.winner["stream_id"])
    to_name = str(ev.winner["name"])
    ch_id = int(row["dispatcharr_channel_id"])
    try:
        current = await client.get_channel_streams(ch_id)
    except Exception as e:
        errors.append(f"Channel {ch_id} streams: {e}")
        return False

    cur_ids = [int(s["id"]) for s in current] if current else []
    if cur_ids and cur_ids[0] == new_id:
        return False
    from_name = str(current[0]["name"]) if current else None

    try:
        await client.patch_channel_streams(ch_id, [new_id])
    except DispatcharrError as e:
        errors.append(str(e))
        await _log_switch(db, tc_id, from_name, to_name, new_id, f"Switch failed: {e}")
        return False

    how = " · manual override" if ev.status == "override" else ""
    await _log_switch(
        db,
        tc_id,
        from_name,
        to_name,
        new_id,
        f"Routed to game {game.get('id')} ({to_name}){how}",
    )
    return True


async def run_match_cycle(
    db: aiosqlite.Connection, *, force_schedule_refresh: bool = False
) -> dict[str, Any]:
    """Refresh schedules and switch Dispatcharr streams when a game is in the routing window.

    Manual /run-now uses force_schedule_refresh=True so ESPN is always queried; the periodic job uses
    False so schedule_refresh_hours throttling still applies.
    """
    settings = await load_settings(db)
    if not settings.dispatcharr_url or not settings.dispatcharr_token:
        await kv_set(db, "last_match_cycle_at", datetime.now(timezone.utc).isoformat())
        return {"ok": False, "message": "Dispatcharr not configured", "switches": 0}

    if force_schedule_refresh:
        await refresh_all_schedules(db)
    else:
        await maybe_refresh_schedules(db)
    await cleanup_overrides(db)

    ctx = RoutingContext(db, settings)
    now = datetime.now(timezone.utc)
    switches = 0
    errors: list[str] = []
    reported: set[int] = set()

    for row in await _get_team_channels(db):
        if await _route_team(ctx, row, now, errors, reported):
            switches += 1

    msg = f"Completed: {switches} switch(es)"
    if errors:
        msg += "; " + "; ".join(errors[:5])
    if force_schedule_refresh:
        cur = await db.execute("SELECT COUNT(*) FROM schedule_cache")
        n_cached = (await cur.fetchone())[0]
        msg += f" ESPN schedule cache: {n_cached} game row(s). If 0, check league profile ESPN sport/league slugs."
    await kv_set(db, "last_match_cycle_at", datetime.now(timezone.utc).isoformat())
    return {"ok": True, "message": msg, "switches": switches, "errors": errors}


async def route_team_now(db: aiosqlite.Connection, tc_id: int) -> None:
    """Apply routing for one team right away (e.g. after an override change)."""
    settings = await load_settings(db)
    row = await get_team_channel_row(db, tc_id)
    if (
        not row
        or not row["enabled"]
        or not row["profile_enabled"]
        or not settings.dispatcharr_url
        or not settings.dispatcharr_token
    ):
        return
    ctx = RoutingContext(db, settings)
    await _route_team(ctx, row, datetime.now(timezone.utc), [], set())


# ── Dashboard previews ──────────────────────────────────────────────────────


async def preview_routing(db: aiosqlite.Connection) -> dict[str, Any]:
    """Dry-run: classify stream matching per enabled team channel (no writes, no Dispatcharr PATCH)."""
    settings = await load_settings(db)
    if not settings.dispatcharr_url or not settings.dispatcharr_token:
        return {"ok": False, "message": "Dispatcharr not configured", "items": []}

    ctx = RoutingContext(db, settings)
    now = datetime.now(timezone.utc)
    items: list[dict[str, Any]] = []

    for row in await _get_team_channels(db):
        tid = str(row["espn_team_id"])
        base: dict[str, Any] = {
            "team_channel_id": int(row["id"]),
            "team_name": str(row["team_name"]),
            "league_profile_id": int(row["league_profile_id"]),
            "dispatcharr_channel_id": int(row["dispatcharr_channel_id"]),
            "next_game": None,
            "matched_stream_name": None,
        }
        ps = await ctx.source.for_profile(row)
        if ps.error:
            items.append({**base, "status": ps.error_status, "reason": ps.error})
            continue

        games = await ctx.games(int(row["league_profile_id"]))
        game, is_home = _pick_game_for_team(games, tid, now, settings.pre_game_minutes)
        if not game:
            mine = [
                g
                for g in games
                if str(g.get("status", "")).lower() != "post"
                and tid in (str(g["home_team_id"]), str(g["away_team_id"]))
            ]
            if not mine:
                items.append(
                    {
                        **base,
                        "status": "no_active_game",
                        "reason": "No games in schedule cache for this team—confirm ESPN sport/league on the profile, then use Run match now (refreshes ESPN data).",
                    }
                )
            else:
                items.append(
                    {
                        **base,
                        "status": "outside_window",
                        "reason": "Game scheduled but outside the routing window (pre-game / in-progress window)",
                        "next_game": _matchup(mine[0]),
                    }
                )
            continue

        override_row = (await overrides_for_team(db, int(row["id"]))).get(
            str(game["id"])
        )
        ev = await ctx.evaluate(ps, row, game, is_home, override_row)
        if not ev.winner:
            items.append(
                {
                    **base,
                    "status": "no_stream_match",
                    "reason": "No Dispatcharr stream title matched the pattern for this matchup",
                    "next_game": _matchup(game),
                }
            )
        else:
            items.append(
                {
                    **base,
                    "status": "stream_found",
                    "reason": "Would route to this stream if in window and channel differs",
                    "next_game": _matchup(game),
                    "matched_stream_name": ev.winner["name"],
                }
            )

    return {
        "ok": True,
        "message": f"Preview for {len(items)} mapping(s)",
        "items": items,
    }


async def upcoming_stream_matches(db: aiosqlite.Connection) -> dict[str, Any]:
    """For each tracked team: next schedule-cache game + best Dispatcharr stream title match from the live list."""
    settings = await load_settings(db)
    if not settings.dispatcharr_url or not settings.dispatcharr_token:
        return {"ok": False, "message": "Dispatcharr not configured", "items": []}

    ctx = RoutingContext(db, settings)
    now = datetime.now(timezone.utc)
    items: list[dict[str, Any]] = []

    for row in await _get_team_channels(db):
        base: dict[str, Any] = {
            "team_channel_id": int(row["id"]),
            "team_name": str(row["team_name"]),
            "league_profile_id": int(row["league_profile_id"]),
            "dispatcharr_channel_id": int(row["dispatcharr_channel_id"]),
            "next_game": None,
            "game_time": None,
            "in_routing_window": False,
            "matched_stream_name": None,
            "matched_stream_id": None,
            "streams_in_list": 0,
        }
        ps = await ctx.source.for_profile(row)
        if ps.error:
            items.append({**base, "status": ps.error_status, "reason": ps.error})
            continue
        base["streams_in_list"] = len(ps.streams)

        games = await ctx.games(int(row["league_profile_id"]))
        game, is_home = _next_scheduled_game_for_team(games, str(row["espn_team_id"]))
        if not game:
            items.append(
                {
                    **base,
                    "status": "no_upcoming_game",
                    "reason": "No non-final games in schedule cache for this team",
                }
            )
            continue

        base["next_game"] = _matchup(game)
        base["game_time"] = str(game.get("game_time", "") or "")
        base["in_routing_window"] = _game_active_for_team(
            game, now, settings.pre_game_minutes
        )
        override_row = (await overrides_for_team(db, int(row["id"]))).get(
            str(game["id"])
        )
        ev = await ctx.evaluate(ps, row, game, is_home, override_row)
        if not ev.winner:
            items.append(
                {
                    **base,
                    "status": "no_stream_match",
                    "reason": "No stream title in the current Dispatcharr list matched the pattern for this matchup",
                }
            )
        else:
            items.append(
                {
                    **base,
                    "status": "stream_found",
                    "reason": "A stream title matches; auto-switch only when the game is in the routing window",
                    "matched_stream_name": ev.winner["name"],
                    "matched_stream_id": ev.winner["stream_id"],
                }
            )

    return {
        "ok": True,
        "message": f"Compared {len(items)} mapping(s) to Dispatcharr streams",
        "items": items,
    }


# ── Team Channels views ─────────────────────────────────────────────────────


def _game_out(
    game: dict[str, Any],
    is_home: bool,
    meta: dict[str, dict[str, str]],
    settings: AppSettings,
    now: datetime,
) -> dict[str, Any]:
    gt = parse_game_time(game)
    opp_id = str(game["away_team_id"] if is_home else game["home_team_id"])
    opp_name = str(game["away_team"] if is_home else game["home_team"])
    opp_meta = meta.get(opp_id, {})
    return {
        "id": str(game["id"]),
        "home_team": game["home_team"],
        "away_team": game["away_team"],
        "home_team_id": str(game["home_team_id"]),
        "away_team_id": str(game["away_team_id"]),
        "is_home": is_home,
        "opponent": {
            "id": opp_id,
            "name": opp_name,
            "short_name": opp_meta.get("short_name") or opp_name,
            "abbreviation": opp_meta.get("abbreviation", ""),
        },
        "game_time": gt.isoformat() if gt else game.get("game_time"),
        "switch_at": (
            (gt - timedelta(minutes=settings.pre_game_minutes)).isoformat()
            if gt
            else None
        ),
        "state": str(game.get("status", "")),
        "in_window": _game_active_for_team(game, now, settings.pre_game_minutes),
    }


def _evaluation_out(ev: GameEvaluation) -> dict[str, Any]:
    return {
        "status": ev.status,
        "winner": ev.winner,
        "override": ev.override,
        "rank_reason": ev.rank_reason,
        "fit_count": len(ev.fits),
        "candidate_count": len(ev.candidates),
    }


async def team_status(db: aiosqlite.Connection) -> dict[str, Any]:
    """Per team: next game and which stream would route to it."""
    settings = await load_settings(db)
    await cleanup_overrides(db)
    ctx = RoutingContext(db, settings)
    now = datetime.now(timezone.utc)
    items: list[dict[str, Any]] = []

    for row in await _get_team_channels(db, include_disabled=True):
        tc_id = int(row["id"])
        lp_id = int(row["league_profile_id"])
        item: dict[str, Any] = {
            "team_channel_id": tc_id,
            "routing_enabled": bool(row["enabled"]) and bool(row["profile_enabled"]),
            "status": "no_game",
            "error": None,
            "next_game": None,
            "winner": None,
            "override": None,
            "rank_reason": None,
            "fit_count": 0,
            "candidate_count": 0,
        }
        upcoming = _upcoming_games_for_team(
            await ctx.games(lp_id), str(row["espn_team_id"]), now
        )
        if not upcoming:
            items.append(item)
            continue
        game, is_home = upcoming[0]
        meta = await _event_team_meta(db, lp_id, str(game["id"]))
        item["next_game"] = _game_out(game, is_home, meta, settings, now)

        ps = await ctx.source.for_profile(row)
        if ps.error:
            item.update(status="error", error=ps.error)
            items.append(item)
            continue
        override_row = (await overrides_for_team(db, tc_id)).get(str(game["id"]))
        ev = await ctx.evaluate(ps, row, game, is_home, override_row)
        item.update(_evaluation_out(ev))
        items.append(item)

    return {
        "ok": True,
        "checked_at": now.isoformat(),
        "items": items,
    }


async def team_games(
    db: aiosqlite.Connection, tc_id: int, *, limit: int = 6
) -> dict[str, Any] | None:
    """Upcoming games for one team, each with every ranked candidate stream."""
    row = await get_team_channel_row(db, tc_id)
    if not row:
        return None
    settings = await load_settings(db)
    await cleanup_overrides(db)
    ctx = RoutingContext(db, settings)
    now = datetime.now(timezone.utc)
    lp_id = int(row["league_profile_id"])

    upcoming = _upcoming_games_for_team(
        await ctx.games(lp_id), str(row["espn_team_id"]), now
    )[:limit]
    ps = await ctx.source.for_profile(row) if upcoming else ProfileStreams()
    overrides = await overrides_for_team(db, tc_id)

    current_stream: dict[str, Any] | None = None
    current_error: str | None = None
    if ctx.client is not None:
        try:
            current = await ctx.client.get_channel_streams(
                int(row["dispatcharr_channel_id"])
            )
            if current:
                current_stream = {
                    "id": int(current[0]["id"]),
                    "name": str(current[0].get("name", "")),
                }
        except Exception as e:
            current_error = str(e)

    games_out: list[dict[str, Any]] = []
    suggestions: list[str] = []
    for game, is_home in upcoming:
        meta = await _event_team_meta(db, lp_id, str(game["id"]))
        g = _game_out(game, is_home, meta, settings, now)
        if ps.error:
            g.update(_evaluation_out(GameEvaluation()), status="error", candidates=[])
        else:
            ev = await ctx.evaluate(
                ps, row, game, is_home, overrides.get(str(game["id"]))
            )
            g.update(_evaluation_out(ev))
            g["candidates"] = [c.to_dict() for c in ev.candidates]
            for s in alias_suggestions(ev.candidates, _aliases(row) + suggestions):
                suggestions.append(s)
        games_out.append(g)

    return {
        "ok": ps.error is None,
        "error": ps.error,
        "team_channel_id": tc_id,
        "routing_enabled": bool(row["enabled"]) and bool(row["profile_enabled"]),
        "profile": {
            "id": lp_id,
            "name": row["profile_name"],
            "espn_league": row["espn_league"],
        },
        "pre_game_minutes": settings.pre_game_minutes,
        "scan_interval_minutes": settings.scan_interval_minutes,
        "current_stream": current_stream,
        "current_stream_error": current_error,
        "games": games_out,
        "alias_suggestions": suggestions,
    }


# ── League Profile preview data ─────────────────────────────────────────────

_LIVE_GAMES_TTL_SECONDS = 600
_live_games_cache: dict[tuple[str, str, int], tuple[float, list[dict[str, Any]]]] = {}


async def _live_games(sport: str, league: str, lookahead: int) -> list[dict[str, Any]]:
    from app.services import espn as espn_service

    key = (sport, league, lookahead)
    hit = _live_games_cache.get(key)
    if hit and time.monotonic() - hit[0] < _LIVE_GAMES_TTL_SECONDS:
        return hit[1]
    games = await espn_service.fetch_games_for_league(sport, league, lookahead)
    rows = [
        {
            "id": g.event_id,
            "home_team": g.home_team_name,
            "away_team": g.away_team_name,
            "home_team_id": g.home_team_id,
            "away_team_id": g.away_team_id,
            "game_time": g.game_time_utc.isoformat(),
            "status": g.status_state,
            "meta": team_meta_from_event(g.raw),
        }
        for g in games
    ]
    _live_games_cache[key] = (time.monotonic(), rows)
    return rows


async def stream_check(
    db: aiosqlite.Connection,
    *,
    profile_id: int | None,
    espn_sport: str,
    espn_league: str,
    m3u_account_id: int | None,
    channel_group: str,
    contains: str,
) -> dict[str, Any]:
    """Stream titles in a profile's pool plus upcoming ESPN games, for the client preview."""
    settings = await load_settings(db)
    now = datetime.now(timezone.utc)

    games: list[dict[str, Any]] = []
    if profile_id is not None:
        cur = await db.execute(
            "SELECT espn_sport, espn_league FROM league_profiles WHERE id = ?",
            (profile_id,),
        )
        prow = await cur.fetchone()
        if prow and (prow[0], prow[1]) == (espn_sport, espn_league):
            cur = await db.execute(
                """
                SELECT espn_event_id AS id, home_team, away_team, home_team_id, away_team_id,
                       game_time, status, raw_json
                FROM schedule_cache WHERE league_profile_id = ? AND status != 'post'
                ORDER BY game_time
                """,
                (profile_id,),
            )
            for r in await cur.fetchall():
                g = dict(r)
                raw = g.pop("raw_json", None)
                try:
                    g["meta"] = team_meta_from_event(json.loads(raw) if raw else None)
                except json.JSONDecodeError:
                    g["meta"] = {}
                games.append(g)
    games_error: str | None = None
    if not games:
        try:
            games = await _live_games(
                espn_sport, espn_league, settings.schedule_lookahead_days
            )
        except Exception as e:
            games_error = str(e)

    cutoff = now - _DISPLAY_LOOKBACK
    upcoming: list[dict[str, Any]] = []
    for g in games:
        gt = parse_game_time(g)
        if str(g.get("status", "")).lower() == "post" or (gt and gt < cutoff):
            continue
        meta = g.get("meta") or {}
        hid, aid = str(g["home_team_id"]), str(g["away_team_id"])
        upcoming.append(
            {
                "id": str(g["id"]),
                "home_team": g["home_team"],
                "away_team": g["away_team"],
                "home_team_id": hid,
                "away_team_id": aid,
                "home_short": (meta.get(hid) or {}).get("short_name") or g["home_team"],
                "away_short": (meta.get(aid) or {}).get("short_name") or g["away_team"],
                "game_time": gt.isoformat() if gt else g.get("game_time"),
                "status": g.get("status"),
            }
        )

    streams: list[dict[str, Any]] = []
    error: str | None = None
    try:
        rows = await StreamSource(_client_for(settings)).fetch(
            name_filter=contains,
            m3u_account_id=m3u_account_id,
            channel_group=channel_group,
        )
        streams = [
            {"id": sid, "name": str(s.get("name", ""))}
            for s in rows
            if (sid := _ref_id(s.get("id"))) is not None
        ]
    except Exception as e:
        error = str(e)

    return {
        "ok": error is None,
        "error": error,
        "games_error": games_error,
        "streams": streams,
        "games": upcoming,
        "aliases_by_team_id": await aliases_by_team(db, espn_sport, espn_league),
        "timezone": settings.timezone,
    }
