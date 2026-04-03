"""Match ESPN games to Dispatcharr streams and switch channels."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import aiosqlite

from app.database import kv_get, kv_set
from app.services.dispatcharr import DispatcharrClient, DispatcharrError
from app.services.patterns import CompiledPattern, compile_league_pattern, match_stream_name, teams_match
from app.settings_store import load_settings


async def _get_profiles(db: aiosqlite.Connection) -> list[dict[str, Any]]:
    cur = await db.execute("SELECT * FROM league_profiles WHERE enabled = 1")
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def _get_team_channels(db: aiosqlite.Connection) -> list[dict[str, Any]]:
    cur = await db.execute(
        """
        SELECT tc.*, lp.stream_pattern, lp.stream_name_filter, lp.espn_sport, lp.espn_league
        FROM team_channels tc
        JOIN league_profiles lp ON lp.id = tc.league_profile_id
        WHERE tc.enabled = 1 AND lp.enabled = 1
        """
    )
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


def _aliases(row: dict[str, Any]) -> list[str]:
    raw = row.get("aliases_json")
    if not raw:
        return []
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [str(x) for x in data]
    except json.JSONDecodeError:
        pass
    return []


def _game_active_for_team(
    game: dict[str, Any],
    now: datetime,
    pre_game_minutes: int,
) -> bool:
    try:
        gt = datetime.fromisoformat(str(game["game_time"]))
    except Exception:
        return False
    if gt.tzinfo is None:
        gt = gt.replace(tzinfo=timezone.utc)
    now_aware = now.astimezone(timezone.utc) if now.tzinfo else now.replace(tzinfo=timezone.utc)
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


def _next_scheduled_game_for_team(
    games: list[dict[str, Any]],
    team_id: str,
) -> tuple[dict[str, Any] | None, bool]:
    """Earliest non-post game involving team_id, by game_time. Returns (game, my_team_is_home).

    Uses a 6-hour lookback as a display-only heuristic: any game that started
    more than 6 h ago is almost certainly over, even if the cached ESPN status
    hasn't flipped to "post" yet.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=6)
    mine: list[tuple[dict[str, Any], bool]] = []
    for g in games:
        if str(g.get("status", "")).lower() == "post":
            continue
        try:
            gt = datetime.fromisoformat(str(g["game_time"]))
            if gt.tzinfo is None:
                gt = gt.replace(tzinfo=timezone.utc)
            if gt < cutoff:
                continue
        except Exception:
            pass
        hid, aid = str(g["home_team_id"]), str(g["away_team_id"])
        if hid == team_id:
            mine.append((g, True))
        elif aid == team_id:
            mine.append((g, False))
    if not mine:
        return None, False
    mine.sort(key=lambda gh: str(gh[0].get("game_time", "")))
    return mine[0]


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
    active = [(g, h) for g, h in mine if _game_active_for_team(g, now, pre_game_minutes)]
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
    games = await espn_service.fetch_games_for_league(sport, league, settings.schedule_lookahead_days)
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
    cur = await db.execute(
        """
        SELECT espn_event_id AS id, home_team, away_team, home_team_id, away_team_id, game_time, status
        FROM schedule_cache WHERE league_profile_id = ? ORDER BY game_time
        """,
        (pid,),
    )
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


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
            if datetime.now(timezone.utc) - lt < timedelta(hours=settings.schedule_refresh_hours):
                return
        except Exception:
            pass
    await refresh_all_schedules(db)


def _find_matching_stream(
    compiled: CompiledPattern,
    streams: list[dict[str, Any]],
    team_name: str,
    team_aliases: list[str],
    opp_name: str,
    my_team_is_home: bool,
) -> dict[str, Any] | None:
    for s in streams:
        name = str(s.get("name", ""))
        ok, groups = match_stream_name(compiled, name)
        if not ok:
            continue
        away = groups.get("away", "")
        home = groups.get("home", "")
        if my_team_is_home:
            if not teams_match(team_name, home, team_aliases):
                continue
            if not teams_match(opp_name, away, []):
                continue
        else:
            if not teams_match(team_name, away, team_aliases):
                continue
            if not teams_match(opp_name, home, []):
                continue
        return s
    return None


async def run_match_cycle(db: aiosqlite.Connection, *, force_schedule_refresh: bool = False) -> dict[str, Any]:
    """Refresh schedules and switch Dispatcharr streams when a game is in the routing window.

    Manual /run-now uses force_schedule_refresh=True so ESPN is always queried; the periodic job uses
    False so schedule_refresh_hours throttling still applies.
    """
    settings = await load_settings(db)
    if not settings.dispatcharr_url or not settings.dispatcharr_token:
        return {"ok": False, "message": "Dispatcharr not configured", "switches": 0}

    if force_schedule_refresh:
        await refresh_all_schedules(db)
    else:
        await maybe_refresh_schedules(db)

    client = DispatcharrClient(settings.dispatcharr_url, settings.dispatcharr_token)
    now = datetime.now(timezone.utc)
    team_rows = await _get_team_channels(db)
    switches = 0
    errors: list[str] = []

    # Cache compiled patterns and streams per league profile
    profile_cache: dict[int, tuple[CompiledPattern, list[dict[str, Any]]]] = {}

    for row in team_rows:
        lp_id = row["league_profile_id"]
        if lp_id not in profile_cache:
            try:
                compiled = compile_league_pattern(str(row["stream_pattern"]))
            except Exception as e:
                errors.append(f"Profile {lp_id} pattern: {e}")
                continue
            filt = (row.get("stream_name_filter") or "").strip()
            try:
                streams = await client.list_streams(name_contains=filt)
            except Exception as e:
                errors.append(f"Dispatcharr streams: {e}")
                continue
            profile_cache[lp_id] = (compiled, streams)

        compiled, streams = profile_cache[lp_id]

        cur = await db.execute(
            """
            SELECT espn_event_id AS id, home_team, away_team, home_team_id, away_team_id, game_time, status
            FROM schedule_cache WHERE league_profile_id = ? ORDER BY game_time
            """,
            (lp_id,),
        )
        games = [dict(r) for r in await cur.fetchall()]

        tid = str(row["espn_team_id"])
        game, is_home = _pick_game_for_team(games, tid, now, settings.pre_game_minutes)
        if not game:
            continue

        opp = (
            str(game["away_team"])
            if is_home
            else str(game["home_team"])
        )
        team_name = str(row["team_name"])
        aliases = _aliases(row)

        match = _find_matching_stream(compiled, streams, team_name, aliases, opp, is_home)
        if not match:
            await db.execute(
                """
                INSERT INTO switch_log(team_channel_id, from_stream_name, to_stream_name, to_stream_id, reason)
                VALUES(?,?,?,?,?)
                """,
                (
                    row["id"],
                    None,
                    None,
                    None,
                    f"No matching stream for game {game.get('id')} ({team_name} vs {opp})",
                ),
            )
            await db.commit()
            continue

        new_id = int(match["id"])
        ch_id = int(row["dispatcharr_channel_id"])

        try:
            current = await client.get_channel_streams(ch_id)
        except Exception as e:
            errors.append(f"Channel {ch_id} streams: {e}")
            continue

        cur_ids = [int(s["id"]) for s in current] if current else []
        if cur_ids and cur_ids[0] == new_id:
            continue

        from_name = str(current[0]["name"]) if current else None
        to_name = str(match.get("name", ""))

        try:
            await client.patch_channel_streams(ch_id, [new_id])
        except DispatcharrError as e:
            errors.append(str(e))
            await db.execute(
                """
                INSERT INTO switch_log(team_channel_id, from_stream_name, to_stream_name, to_stream_id, reason)
                VALUES(?,?,?,?,?)
                """,
                (row["id"], from_name, to_name, new_id, f"Switch failed: {e}"),
            )
            await db.commit()
            continue

        await db.execute(
            """
            INSERT INTO switch_log(team_channel_id, from_stream_name, to_stream_name, to_stream_id, reason)
            VALUES(?,?,?,?,?)
            """,
            (
                row["id"],
                from_name,
                to_name,
                new_id,
                f"Routed to game {game.get('id')} ({to_name})",
            ),
        )
        await db.commit()
        switches += 1

    msg = f"Completed: {switches} switch(es)"
    if errors:
        msg += "; " + "; ".join(errors[:5])
    if force_schedule_refresh:
        cur = await db.execute("SELECT COUNT(*) FROM schedule_cache")
        n_cached = (await cur.fetchone())[0]
        msg += f" ESPN schedule cache: {n_cached} game row(s). If 0, check league profile ESPN sport/league slugs."
    return {"ok": True, "message": msg, "switches": switches, "errors": errors}


async def preview_routing(db: aiosqlite.Connection) -> dict[str, Any]:
    """Dry-run: classify stream matching per enabled team channel (no writes, no Dispatcharr PATCH)."""
    settings = await load_settings(db)
    if not settings.dispatcharr_url or not settings.dispatcharr_token:
        return {"ok": False, "message": "Dispatcharr not configured", "items": []}

    client = DispatcharrClient(settings.dispatcharr_url, settings.dispatcharr_token)
    now = datetime.now(timezone.utc)
    team_rows = await _get_team_channels(db)
    items: list[dict[str, Any]] = []

    profile_streams: dict[int, tuple[CompiledPattern, list[dict[str, Any]]]] = {}
    profile_fail: dict[int, tuple[str, str]] = {}

    for row in team_rows:
        tc_id = int(row["id"])
        lp_id = int(row["league_profile_id"])
        team_name = str(row["team_name"])
        tid = str(row["espn_team_id"])

        base: dict[str, Any] = {
            "team_channel_id": tc_id,
            "team_name": team_name,
            "league_profile_id": lp_id,
            "dispatcharr_channel_id": int(row["dispatcharr_channel_id"]),
        }

        if lp_id in profile_fail:
            st, reason = profile_fail[lp_id]
            items.append(
                {
                    **base,
                    "status": st,
                    "reason": reason,
                    "next_game": None,
                    "matched_stream_name": None,
                }
            )
            continue

        if lp_id not in profile_streams:
            try:
                compiled = compile_league_pattern(str(row["stream_pattern"]))
            except Exception as e:
                profile_fail[lp_id] = ("pattern_error", str(e))
                items.append(
                    {
                        **base,
                        "status": "pattern_error",
                        "reason": str(e),
                        "next_game": None,
                        "matched_stream_name": None,
                    }
                )
                continue
            filt = (row.get("stream_name_filter") or "").strip()
            try:
                streams = await client.list_streams(name_contains=filt)
            except Exception as e:
                err = str(e)
                profile_fail[lp_id] = ("dispatcharr_error", err)
                items.append(
                    {
                        **base,
                        "status": "dispatcharr_error",
                        "reason": err,
                        "next_game": None,
                        "matched_stream_name": None,
                    }
                )
                continue
            profile_streams[lp_id] = (compiled, streams)

        compiled, streams = profile_streams[lp_id]

        cur = await db.execute(
            """
            SELECT espn_event_id AS id, home_team, away_team, home_team_id, away_team_id, game_time, status
            FROM schedule_cache WHERE league_profile_id = ? ORDER BY game_time
            """,
            (lp_id,),
        )
        games = [dict(r) for r in await cur.fetchall()]

        game, is_home = _pick_game_for_team(games, tid, now, settings.pre_game_minutes)
        if not game:
            mine: list[dict[str, Any]] = []
            for g in games:
                if str(g.get("status", "")).lower() == "post":
                    continue
                hid, aid = str(g["home_team_id"]), str(g["away_team_id"])
                if hid == tid or aid == tid:
                    mine.append(g)
            if not mine:
                items.append(
                    {
                        **base,
                        "status": "no_active_game",
                        "reason": "No games in schedule cache for this team—confirm ESPN sport/league on the profile, then use Run match now (refreshes ESPN data).",
                        "next_game": None,
                        "matched_stream_name": None,
                    }
                )
            else:
                g0 = mine[0]
                items.append(
                    {
                        **base,
                        "status": "outside_window",
                        "reason": "Game scheduled but outside the routing window (pre-game / in-progress window)",
                        "next_game": f'{g0.get("away_team")} @ {g0.get("home_team")}',
                        "matched_stream_name": None,
                    }
                )
            continue

        opp = str(game["away_team"]) if is_home else str(game["home_team"])
        aliases = _aliases(row)
        match = _find_matching_stream(compiled, streams, team_name, aliases, opp, is_home)
        next_game = f'{game.get("away_team")} @ {game.get("home_team")}'
        if not match:
            items.append(
                {
                    **base,
                    "status": "no_stream_match",
                    "reason": "No Dispatcharr stream title matched the pattern for this matchup",
                    "next_game": next_game,
                    "matched_stream_name": None,
                }
            )
        else:
            items.append(
                {
                    **base,
                    "status": "stream_found",
                    "reason": "Would route to this stream if in window and channel differs",
                    "next_game": next_game,
                    "matched_stream_name": str(match.get("name", "")),
                }
            )

    return {"ok": True, "message": f"Preview for {len(items)} mapping(s)", "items": items}


async def upcoming_stream_matches(db: aiosqlite.Connection) -> dict[str, Any]:
    """For each tracked team: next schedule-cache game + best Dispatcharr stream title match from the live list."""
    settings = await load_settings(db)
    if not settings.dispatcharr_url or not settings.dispatcharr_token:
        return {"ok": False, "message": "Dispatcharr not configured", "items": []}

    client = DispatcharrClient(settings.dispatcharr_url, settings.dispatcharr_token)
    now = datetime.now(timezone.utc)
    team_rows = await _get_team_channels(db)
    items: list[dict[str, Any]] = []

    profile_streams: dict[int, tuple[CompiledPattern, list[dict[str, Any]]]] = {}
    profile_fail: dict[int, tuple[str, str]] = {}

    for row in team_rows:
        tc_id = int(row["id"])
        lp_id = int(row["league_profile_id"])
        team_name = str(row["team_name"])
        tid = str(row["espn_team_id"])

        base: dict[str, Any] = {
            "team_channel_id": tc_id,
            "team_name": team_name,
            "league_profile_id": lp_id,
            "dispatcharr_channel_id": int(row["dispatcharr_channel_id"]),
        }

        if lp_id in profile_fail:
            st, reason = profile_fail[lp_id]
            items.append(
                {
                    **base,
                    "status": st,
                    "reason": reason,
                    "next_game": None,
                    "game_time": None,
                    "in_routing_window": False,
                    "matched_stream_name": None,
                    "matched_stream_id": None,
                    "streams_in_list": 0,
                }
            )
            continue

        if lp_id not in profile_streams:
            try:
                compiled = compile_league_pattern(str(row["stream_pattern"]))
            except Exception as e:
                profile_fail[lp_id] = ("pattern_error", str(e))
                items.append(
                    {
                        **base,
                        "status": "pattern_error",
                        "reason": str(e),
                        "next_game": None,
                        "game_time": None,
                        "in_routing_window": False,
                        "matched_stream_name": None,
                        "matched_stream_id": None,
                        "streams_in_list": 0,
                    }
                )
                continue
            filt = (row.get("stream_name_filter") or "").strip()
            try:
                streams = await client.list_streams(name_contains=filt)
            except Exception as e:
                err = str(e)
                profile_fail[lp_id] = ("dispatcharr_error", err)
                items.append(
                    {
                        **base,
                        "status": "dispatcharr_error",
                        "reason": err,
                        "next_game": None,
                        "game_time": None,
                        "in_routing_window": False,
                        "matched_stream_name": None,
                        "matched_stream_id": None,
                        "streams_in_list": 0,
                    }
                )
                continue
            profile_streams[lp_id] = (compiled, streams)

        compiled, streams = profile_streams[lp_id]
        streams_count = len(streams)

        cur = await db.execute(
            """
            SELECT espn_event_id AS id, home_team, away_team, home_team_id, away_team_id, game_time, status
            FROM schedule_cache WHERE league_profile_id = ? ORDER BY game_time
            """,
            (lp_id,),
        )
        games = [dict(r) for r in await cur.fetchall()]

        game, is_home = _next_scheduled_game_for_team(games, tid)
        if not game:
            items.append(
                {
                    **base,
                    "status": "no_upcoming_game",
                    "reason": "No non-final games in schedule cache for this team",
                    "next_game": None,
                    "game_time": None,
                    "in_routing_window": False,
                    "matched_stream_name": None,
                    "matched_stream_id": None,
                    "streams_in_list": streams_count,
                }
            )
            continue

        gt = str(game.get("game_time", "") or "")
        next_game = f'{game.get("away_team")} @ {game.get("home_team")}'
        in_window = _game_active_for_team(game, now, settings.pre_game_minutes)

        opp = str(game["away_team"]) if is_home else str(game["home_team"])
        aliases = _aliases(row)
        match = _find_matching_stream(compiled, streams, team_name, aliases, opp, is_home)
        mid = int(match["id"]) if match and match.get("id") is not None else None
        mname = str(match.get("name", "")) if match else None

        if not match:
            items.append(
                {
                    **base,
                    "status": "no_stream_match",
                    "reason": "No stream title in the current Dispatcharr list matched the pattern for this matchup",
                    "next_game": next_game,
                    "game_time": gt,
                    "in_routing_window": in_window,
                    "matched_stream_name": None,
                    "matched_stream_id": None,
                    "streams_in_list": streams_count,
                }
            )
        else:
            items.append(
                {
                    **base,
                    "status": "stream_found",
                    "reason": "A stream title matches; auto-switch only when the game is in the routing window",
                    "next_game": next_game,
                    "game_time": gt,
                    "in_routing_window": in_window,
                    "matched_stream_name": mname,
                    "matched_stream_id": mid,
                    "streams_in_list": streams_count,
                }
            )

    return {"ok": True, "message": f"Compared {len(items)} mapping(s) to Dispatcharr streams", "items": items}
