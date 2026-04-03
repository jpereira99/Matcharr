"""ESPN public scoreboard API (no auth)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

BASE = "https://site.api.espn.com/apis/site/v2/sports"


@dataclass
class EspnGame:
    event_id: str
    name: str
    home_team_id: str
    away_team_id: str
    home_team_name: str
    away_team_name: str
    game_time_utc: datetime
    status_state: str
    status_detail: str
    raw: dict[str, Any]


def _parse_datetime(iso: str | None) -> datetime:
    if not iso:
        return datetime.now(timezone.utc)
    # ESPN uses Z suffix
    if iso.endswith("Z"):
        iso = iso[:-1] + "+00:00"
    return datetime.fromisoformat(iso)


async def fetch_scoreboard_day(
    sport: str,
    league: str,
    day: date,
) -> list[dict[str, Any]]:
    d = day.strftime("%Y%m%d")
    url = f"{BASE}/{sport}/{league}/scoreboard"
    params = {"dates": d, "limit": 1000}
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url, params=params)
    r.raise_for_status()
    data = r.json()
    return data.get("events", [])


def event_to_game(ev: dict[str, Any]) -> EspnGame | None:
    eid = str(ev.get("id", ""))
    name = str(ev.get("name", ""))
    comps = ev.get("competitions") or []
    if not comps:
        return None
    comp = comps[0]
    teams = comp.get("competitors") or []
    home = away = None
    for t in teams:
        team = t.get("team") or {}
        tid = str(team.get("id", ""))
        display = team.get("displayName") or team.get("shortDisplayName") or team.get("name") or ""
        if t.get("homeAway") == "home":
            home = (tid, display)
        elif t.get("homeAway") == "away":
            away = (tid, display)
    if not home or not away:
        return None
    status = ev.get("status") or {}
    stype = status.get("type") or {}
    state = str(stype.get("state", ""))
    detail = str(stype.get("shortDetail") or stype.get("detail") or "")
    date_info = comp.get("date") or ev.get("date")
    try:
        gt = _parse_datetime(str(date_info))
    except Exception:
        gt = datetime.now(timezone.utc)
    return EspnGame(
        event_id=eid,
        name=name,
        home_team_id=home[0],
        away_team_id=away[0],
        home_team_name=home[1],
        away_team_name=away[1],
        game_time_utc=gt,
        status_state=state,
        status_detail=detail,
        raw=ev,
    )


async def fetch_teams(sport: str, league: str) -> list[dict[str, Any]]:
    url = f"{BASE}/{sport}/{league}/teams"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url)
    r.raise_for_status()
    data = r.json()
    sports = data.get("sports", [])
    if not sports:
        return []
    leagues = sports[0].get("leagues", [])
    if not leagues:
        return []
    teams = leagues[0].get("teams", [])
    out: list[dict[str, Any]] = []
    for t in teams:
        team = t.get("team", {})
        tid = str(team.get("id", ""))
        name = team.get("displayName") or team.get("name") or ""
        abbr = team.get("abbreviation") or ""
        if tid:
            out.append({"id": tid, "name": name, "abbreviation": abbr})
    out.sort(key=lambda x: x["name"])
    return out


async def fetch_games_for_league(
    sport: str,
    league: str,
    lookahead_days: int,
) -> list[EspnGame]:
    today = date.today()
    out: list[EspnGame] = []
    seen: set[str] = set()
    for i in range(lookahead_days + 1):
        day = today + timedelta(days=i)
        try:
            events = await fetch_scoreboard_day(sport, league, day)
        except Exception:
            continue
        for ev in events:
            g = event_to_game(ev)
            if not g:
                continue
            if g.event_id in seen:
                continue
            seen.add(g.event_id)
            out.append(g)
    return out
