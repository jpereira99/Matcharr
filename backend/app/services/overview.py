"""Read-only aggregates for the League Profiles list and the Dashboard timeline.

Both reuse the per-game candidate ranking and read stream pools cached for one
scan interval, so page visits don't hit Dispatcharr every time.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import aiosqlite

from app.models import AppSettings
from app.services.candidates import Candidate, GameEvaluation, rank_candidates
from app.services.matcher import (
    RoutingContext,
    _get_team_channels,
    _json_list,
    overrides_for_team,
    parse_game_time,
    team_meta_from_event,
)

_DURATION_BY_SPORT = {"soccer": 120, "basketball": 150, "hockey": 150}
_DEFAULT_DURATION = 180


def game_duration_minutes(sport: str) -> int:
    return _DURATION_BY_SPORT.get(sport, _DEFAULT_DURATION)


def _utc_sql(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


async def _games_between(
    db: aiosqlite.Connection, lp_id: int, start: datetime, end: datetime
) -> list[dict[str, Any]]:
    """Cached games for a profile starting in [start, end), with team meta from ESPN."""
    cur = await db.execute(
        """
        SELECT espn_event_id AS id, home_team, away_team, home_team_id, away_team_id,
               game_time, status, raw_json
        FROM schedule_cache
        WHERE league_profile_id = ? AND datetime(game_time) >= ? AND datetime(game_time) < ?
        ORDER BY datetime(game_time)
        """,
        (lp_id, _utc_sql(start), _utc_sql(end)),
    )
    out = []
    for r in await cur.fetchall():
        g = dict(r)
        raw = g.pop("raw_json", None)
        try:
            g["meta"] = team_meta_from_event(json.loads(raw) if raw else None)
        except json.JSONDecodeError:
            g["meta"] = {}
        out.append(g)
    return out


def _short(game: dict[str, Any], side: str) -> str:
    tid = str(game[f"{side}_team_id"])
    return (game.get("meta") or {}).get(tid, {}).get("short_name") or str(
        game[f"{side}_team"]
    )


def matchup_label(game: dict[str, Any], sport: str) -> str:
    """Soccer reads home-first ("NYCFC vs St. Louis"); US leagues away-first."""
    home, away = _short(game, "home"), _short(game, "away")
    return f"{home} vs {away}" if sport == "soccer" else f"{away} at {home}"


# ── League Profiles list ────────────────────────────────────────────────────


async def profiles_summary(
    db: aiosqlite.Connection, settings: AppSettings
) -> dict[str, Any]:
    """Per profile: pattern, teams, and today's ESPN games with a stream status each."""
    ctx = RoutingContext(db, settings, cached_streams=True)
    now = datetime.now(timezone.utc)
    local_now = now.astimezone(ctx.tz)
    day_start = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)

    cur = await db.execute(
        "SELECT * FROM league_profiles ORDER BY name COLLATE NOCASE, id"
    )
    profiles = [dict(r) for r in await cur.fetchall()]
    cur = await db.execute(
        "SELECT id, team_name, espn_team_id, espn_team_abbr, league_profile_id FROM team_channels ORDER BY id"
    )
    teams_by_lp: dict[int, list[dict[str, Any]]] = {}
    for r in await cur.fetchall():
        teams_by_lp.setdefault(int(r["league_profile_id"]), []).append(
            {
                "id": r["id"],
                "name": r["team_name"],
                "espn_team_id": str(r["espn_team_id"]),
                "abbr": r["espn_team_abbr"] or "",
            }
        )
    cur = await db.execute("""
        SELECT tc.league_profile_id, so.espn_event_id
        FROM stream_overrides so JOIN team_channels tc ON tc.id = so.team_channel_id
        """)
    overridden = {(int(r[0]), str(r[1])) for r in await cur.fetchall()}

    out: list[dict[str, Any]] = []
    for p in profiles:
        lp_id = int(p["id"])
        sport = str(p["espn_sport"])
        item: dict[str, Any] = {
            "id": lp_id,
            "name": p["name"],
            "espn_sport": sport,
            "espn_league": p["espn_league"],
            "stream_pattern": p["stream_pattern"],
            "stream_name_filter": p.get("stream_name_filter") or "",
            "exclude_terms": _json_list(p.get("exclude_terms_json")),
            "m3u_account_id": p.get("m3u_account_id"),
            "channel_group": p.get("channel_group") or "",
            "enabled": bool(p["enabled"]),
            "teams": teams_by_lp.get(lp_id, []),
            "games_today": [],
            "note": None,
            "error": None,
        }
        games = await _games_between(db, lp_id, day_start, day_end)
        ps = None
        if item["enabled"] and games and p["stream_pattern"].strip():
            ps = await ctx.source.for_profile(
                {
                    "league_profile_id": lp_id,
                    "stream_pattern": p["stream_pattern"],
                    "stream_name_filter": p.get("stream_name_filter"),
                    "m3u_account_id": p.get("m3u_account_id"),
                    "channel_group": p.get("channel_group"),
                    "exclude_terms_json": p.get("exclude_terms_json"),
                }
            )
            if ps.error:
                item["error"] = ps.error
        by_team = await ctx.aliases(sport, str(p["espn_league"]))

        for g in games:
            status = "none"
            fit_count = 0
            if ps is not None and ps.compiled is not None and not ps.error:
                cands = rank_candidates(
                    ps.compiled,
                    ps.streams,
                    team_name=str(g["home_team"]),
                    team_aliases=by_team.get(str(g["home_team_id"]), []),
                    opp_name=str(g["away_team"]),
                    opp_aliases=by_team.get(str(g["away_team_id"]), []),
                    is_home=True,
                    skip_terms=ps.skip_terms,
                    game_time=parse_game_time(g),
                    local_tz=ctx.tz,
                )
                fit_count = sum(1 for c in cands if c.kind == "fit")
                if (lp_id, str(g["id"])) in overridden or fit_count == 1:
                    status = "ok"
                elif fit_count > 1:
                    status = "warn"
            item["games_today"].append(
                {
                    "event_id": str(g["id"]),
                    "label": matchup_label(g, sport),
                    "start": g["game_time"],
                    "state": g["status"],
                    "status": status,
                    "fit_count": fit_count,
                }
            )

        todays = item["games_today"]
        warn = next((x for x in todays if x["status"] == "warn"), None)
        missing = next(
            (x for x in todays if x["status"] == "none" and x["state"] != "post"),
            None,
        )
        if item["enabled"] and warn:
            item["note"] = (
                f"{warn['fit_count']} streams fit {warn['label']}. "
                "Add a skip term to pick one."
            )
        elif item["enabled"] and missing and ps is not None and not ps.error:
            item["note"] = (
                f"{missing['label']} has no stream listed yet. "
                "Providers usually add it a few hours before kickoff."
            )
        out.append(item)

    checked = ctx.source.checked_at
    return {
        "checked_at": (
            datetime.fromtimestamp(checked, timezone.utc).isoformat()
            if checked
            else now.isoformat()
        ),
        "profiles": out,
    }


# ── Dashboard timeline ──────────────────────────────────────────────────────

_TIMELINE_STATUS = {
    "override": "override",
    "ready": "ok",
    "conflict": "warn",
    "near_miss": "warn",
    "not_listed": "none",
}


def _shown_candidate(ev: GameEvaluation) -> Candidate | None:
    """The stream to show for a game: the winner, else the closest near miss."""
    if ev.winner:
        wid = ev.winner["stream_id"]
        return next((c for c in ev.candidates if c.stream_id == wid), None)
    return next((c for c in ev.candidates if c.kind == "rejected"), None)


def _near_miss(c: Candidate, team_name: str, opp_name: str) -> dict[str, str] | None:
    """The side that failed to match (ours first), for "isn't a known name" copy."""
    opp_side = "away" if c.our_side == "home" else "home"
    if not c.our_side_result:
        return {
            "side": c.our_side,
            "text": c.groups.get(c.our_side, ""),
            "official": team_name,
        }
    if not c.opp_side_result:
        return {
            "side": opp_side,
            "text": c.groups.get(opp_side, ""),
            "official": opp_name,
        }
    return None


async def _latest_logs(db: aiosqlite.Connection) -> dict[int, list[dict[str, Any]]]:
    cur = await db.execute("""
        SELECT team_channel_id, switched_at, outcome, reason, from_stream_name, to_stream_id
        FROM switch_log WHERE datetime(switched_at) >= datetime('now', '-2 days')
        ORDER BY id DESC
        """)
    out: dict[int, list[dict[str, Any]]] = {}
    for r in await cur.fetchall():
        out.setdefault(int(r["team_channel_id"]), []).append(dict(r))
    return out


def _log_time(row: dict[str, Any]) -> datetime:
    return datetime.fromisoformat(str(row["switched_at"])).replace(tzinfo=timezone.utc)


async def dashboard_overview(
    db: aiosqlite.Connection, settings: AppSettings
) -> dict[str, Any]:
    """Timeline of every tracked channel's games, plus what needs a look."""
    ctx = RoutingContext(db, settings, cached_streams=True)
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=6)
    end = now + timedelta(days=settings.schedule_lookahead_days)
    logs = await _latest_logs(db)

    timeline: list[dict[str, Any]] = []
    attention: list[dict[str, Any]] = []
    summary = {"ready": 0, "attention": 0, "override": 0, "waiting": 0, "total": 0}

    for row in await _get_team_channels(db):
        tc_id = int(row["id"])
        lp_id = int(row["league_profile_id"])
        sport = str(row["espn_sport"])
        tid = str(row["espn_team_id"])
        duration = game_duration_minutes(sport)
        team_logs = logs.get(tc_id, [])
        games = [
            g
            for g in await _games_between(db, lp_id, start, end)
            if tid in (str(g["home_team_id"]), str(g["away_team_id"]))
        ]
        ps = await ctx.source.for_profile(row) if games else None
        overrides = await overrides_for_team(db, tc_id)
        team_short = (
            (games[0].get("meta") or {}).get(tid, {}).get("short_name")
            if games
            else None
        ) or str(row["team_name"])

        games_out: list[dict[str, Any]] = []
        for g in games:
            is_home = str(g["home_team_id"]) == tid
            opp_side = "away" if is_home else "home"
            opp_id = str(g[f"{opp_side}_team_id"])
            opp_name = str(g[f"{opp_side}_team"])
            opp_meta = (g.get("meta") or {}).get(opp_id, {})
            gt = parse_game_time(g)
            item: dict[str, Any] = {
                "event_id": str(g["id"]),
                "start": gt.isoformat() if gt else g["game_time"],
                "duration_min": duration,
                "switch_at": (
                    (gt - timedelta(minutes=settings.pre_game_minutes)).isoformat()
                    if gt
                    else None
                ),
                "is_home": is_home,
                "label": f"{'vs' if is_home else '@'} {opp_meta.get('abbreviation') or opp_meta.get('short_name') or opp_name}",
                "title": f"{team_short} {'vs' if is_home else '@'} {opp_name}",
                "opponent": opp_name,
                "live": str(g["status"]).lower() == "in",
                "state": g["status"],
                "status": "none",
                "routing_status": "not_listed",
                "fit_count": 0,
                "rank_reason": None,
                "stream_name": None,
                "spans": [],
                "near_miss": None,
                "switched_at": None,
                "error": ps.error if ps else None,
            }
            if ps is not None and not ps.error:
                ev = await ctx.evaluate(
                    ps, row, g, is_home, overrides.get(str(g["id"]))
                )
                item["routing_status"] = ev.status
                item["status"] = _TIMELINE_STATUS[ev.status]
                item["fit_count"] = len(ev.fits)
                item["rank_reason"] = ev.rank_reason
                shown = _shown_candidate(ev)
                if shown is not None:
                    item["stream_name"] = shown.name
                    miss = (
                        None
                        if ev.winner
                        else _near_miss(shown, str(row["team_name"]), opp_name)
                    )
                    item["near_miss"] = miss
                    item["spans"] = [
                        [a, b, "failed" if miss and f == miss["side"] else f]
                        for a, b, f in shown.spans
                    ]
                elif ev.winner:
                    item["stream_name"] = ev.winner["name"]
                if ev.winner and gt:
                    since = gt - timedelta(minutes=settings.pre_game_minutes + 60)
                    hit = next(
                        (
                            r
                            for r in team_logs
                            if r["outcome"] in ("switched", "override")
                            and r["to_stream_id"] == ev.winner["stream_id"]
                            and _log_time(r) >= since
                        ),
                        None,
                    )
                    if hit:
                        item["switched_at"] = _log_time(hit).isoformat()
            games_out.append(item)

        timeline.append(
            {
                "team_channel_id": tc_id,
                "team_name": row["team_name"],
                "espn_team_id": tid,
                "espn_team_abbr": row.get("espn_team_abbr") or "",
                "espn_league": row["espn_league"],
                "dispatcharr_channel_id": row["dispatcharr_channel_id"],
                "games": games_out,
            }
        )

        def unfinished(x: dict[str, Any], g: dict[str, Any]) -> bool:
            if str(g["status"]).lower() == "post":
                return False
            if x["live"]:
                return True
            gt = parse_game_time(g)
            return gt is None or gt + timedelta(minutes=duration) > now

        nxt = next((x for x, g in zip(games_out, games) if unfinished(x, g)), None)
        # A failed switch needs a look until a later attempt succeeds.
        recent = [
            r
            for r in team_logs
            if r["outcome"] != "no_match" and _log_time(r) >= now - timedelta(hours=12)
        ]
        failed = recent[0] if recent and recent[0]["outcome"] == "failed" else None
        summary["total"] += 1
        if nxt is None:
            summary["waiting"] += 1
        elif nxt["status"] == "warn" or failed:
            summary["attention"] += 1
        elif nxt["status"] == "override":
            summary["override"] += 1
        elif nxt["status"] == "ok":
            summary["ready"] += 1
        else:
            summary["waiting"] += 1
        if (nxt and nxt["status"] == "warn") or failed:
            attention.append(
                {
                    "team_channel_id": tc_id,
                    "team_name": row["team_name"],
                    "espn_team_id": tid,
                    "espn_team_abbr": row.get("espn_team_abbr") or "",
                    "espn_league": row["espn_league"],
                    "game": nxt,
                    "failed_reason": failed["reason"] if failed else None,
                }
            )

    return {"timeline": timeline, "tracked_summary": summary, "attention": attention}
