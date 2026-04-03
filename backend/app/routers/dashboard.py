"""Dashboard aggregate API."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from fastapi import APIRouter

from app.database import get_db, kv_get
from app.models import DashboardOut, HealthOut
from app.services.dispatcharr import DispatcharrClient
from app.services.matcher import compute_next_espn_refresh_at
from app.services.scheduler import get_scheduler_status
from app.settings_store import load_settings

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardOut)
async def dashboard() -> DashboardOut:
    async with get_db() as db:
        settings = await load_settings(db)
        cur = await db.execute("SELECT COUNT(*) FROM team_channels WHERE enabled = 1")
        tracked = (await cur.fetchone())[0]

        # ESPN team IDs are not unique across sports/leagues; match only within the same league profile
        # as the schedule row (same as matcher routing).
        cur = await db.execute(
            "SELECT espn_team_id, team_name, league_profile_id FROM team_channels WHERE enabled = 1",
        )
        tracked_by_league: dict[int, dict[str, str]] = {}
        for row in await cur.fetchall():
            lp = int(row["league_profile_id"])
            tracked_by_league.setdefault(lp, {})[str(row["espn_team_id"])] = str(row["team_name"])

        cur = await db.execute(
            """
            SELECT sc.*, lp.name AS league_name
            FROM schedule_cache sc
            JOIN league_profiles lp ON lp.id = sc.league_profile_id
            WHERE EXISTS (
                SELECT 1 FROM team_channels tc
                WHERE tc.league_profile_id = lp.id AND tc.enabled = 1
            )
            AND sc.status != 'post'
            AND datetime(sc.game_time) >= datetime('now', '-6 hours')
            ORDER BY datetime(sc.game_time)
            """
        )
        games_raw = await cur.fetchall()
        upcoming: list[dict[str, Any]] = []
        seen: set[str] = set()
        for r in games_raw:
            d = dict(r)
            eid = str(d.get("espn_event_id", ""))
            if eid in seen:
                continue
            seen.add(eid)
            hid = str(d.get("home_team_id", ""))
            aid = str(d.get("away_team_id", ""))
            lp_id = int(d.get("league_profile_id", 0))
            names_for_lp = tracked_by_league.get(lp_id, {})
            tracked_names: list[str] = []
            if hid in names_for_lp:
                tracked_names.append(names_for_lp[hid])
            if aid in names_for_lp and aid != hid:
                tracked_names.append(names_for_lp[aid])
            upcoming.append(
                {
                    "event_id": d.get("espn_event_id"),
                    "league_profile_id": lp_id,
                    "league": d.get("league_name"),
                    "home_team": d.get("home_team"),
                    "away_team": d.get("away_team"),
                    "home_team_id": hid,
                    "away_team_id": aid,
                    "game_time": d.get("game_time"),
                    "status": d.get("status"),
                    "tracked_team_names": tracked_names,
                }
            )

        tracked_rows = [g for g in upcoming if g["tracked_team_names"]]
        extra_by_lp: dict[int, list[dict[str, Any]]] = defaultdict(list)
        for g in upcoming:
            if g["tracked_team_names"]:
                continue
            extra_by_lp[int(g["league_profile_id"])].append(g)

        extra_leagues: list[dict[str, Any]] = []
        for lp_id in sorted(extra_by_lp.keys(), key=lambda x: (extra_by_lp[x][0].get("game_time") or "")):
            games = extra_by_lp[lp_id]
            league_name = str(games[0].get("league") or "")
            extra_leagues.append(
                {
                    "league_profile_id": lp_id,
                    "league": league_name,
                    "games": games,
                }
            )

        cur = await db.execute(
            """
            SELECT sl.*, tc.team_name
            FROM switch_log sl
            LEFT JOIN team_channels tc ON tc.id = sl.team_channel_id
            ORDER BY sl.switched_at DESC
            LIMIT 20
            """
        )
        logs = [dict(x) for x in await cur.fetchall()]

        last_refresh = await kv_get(db, "last_schedule_refresh")
        last_match_cycle = await kv_get(db, "last_match_cycle_at")

    next_s, sched_running = get_scheduler_status()
    next_espn = compute_next_espn_refresh_at(
        last_schedule_refresh_iso=last_refresh,
        schedule_refresh_hours=settings.schedule_refresh_hours,
        next_scan_iso=next_s,
        scan_interval_minutes=settings.scan_interval_minutes,
    )
    da_ok: bool | None = None
    if settings.dispatcharr_url and settings.dispatcharr_token:
        client = DispatcharrClient(settings.dispatcharr_url, settings.dispatcharr_token)
        da_ok, _, _ = await client.test_connection()

    return DashboardOut(
        dispatcharr_configured=bool(settings.dispatcharr_url and settings.dispatcharr_token),
        next_scan_at=next_s,
        tracked_teams=int(tracked),
        upcoming_games=tracked_rows[:50],
        upcoming_games_extra_by_league=extra_leagues,
        recent_switches=logs[:15],
        health={
            "dispatcharr_reachable": da_ok,
            "last_schedule_refresh": last_refresh,
            "next_schedule_refresh_at": next_espn,
            "scheduler_running": sched_running,
            "last_scan_at": last_match_cycle,
        },
    )


@router.get("/health", response_model=HealthOut)
async def health() -> HealthOut:
    async with get_db() as db:
        await db.execute("SELECT 1")
        last_refresh = await kv_get(db, "last_schedule_refresh")
        settings = await load_settings(db)
    _next_s, sched_running = get_scheduler_status()
    da_ok: bool | None = None
    if settings.dispatcharr_url and settings.dispatcharr_token:
        client = DispatcharrClient(settings.dispatcharr_url, settings.dispatcharr_token)
        da_ok, _, _ = await client.test_connection()
    return HealthOut(
        database=True,
        dispatcharr_reachable=da_ok,
        last_schedule_refresh=last_refresh,
        scheduler_running=sched_running,
    )
