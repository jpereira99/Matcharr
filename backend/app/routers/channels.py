"""Team channel mappings API."""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.database import get_db
from app.models import (
    StreamOverrideIn,
    TeamChannelCreate,
    TeamChannelOut,
    TeamChannelUpdate,
)
from app.services.matcher import route_team_now, team_games, team_status

router = APIRouter(prefix="/team-channels", tags=["team-channels"])
logger = logging.getLogger(__name__)


async def _route_in_background(tc_id: int) -> None:
    try:
        async with get_db() as db:
            await route_team_now(db, tc_id)
    except Exception:
        logger.exception("Immediate routing for team channel %s failed", tc_id)


def _aliases_load(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        d = json.loads(raw)
        return [str(x) for x in d] if isinstance(d, list) else []
    except json.JSONDecodeError:
        return []


def _row_out(row: dict[str, Any]) -> TeamChannelOut:
    return TeamChannelOut(
        id=row["id"],
        team_name=row["team_name"],
        espn_team_id=str(row["espn_team_id"]),
        espn_team_abbr=str(row.get("espn_team_abbr") or ""),
        league_profile_id=row["league_profile_id"],
        dispatcharr_channel_id=row["dispatcharr_channel_id"],
        enabled=bool(row["enabled"]),
        aliases=_aliases_load(row.get("aliases_json")),
        created_at=str(row["created_at"]),
    )


@router.get("", response_model=list[TeamChannelOut])
async def list_team_channels() -> list[TeamChannelOut]:
    async with get_db() as db:
        cur = await db.execute("SELECT * FROM team_channels ORDER BY id")
        rows = await cur.fetchall()
    return [_row_out(dict(r)) for r in rows]


@router.get("/status")
async def get_team_status() -> dict[str, Any]:
    """Per team: next game, routing status, chosen stream and any override."""
    async with get_db() as db:
        return await team_status(db)


@router.get("/{tc_id}/games")
async def get_team_games(tc_id: int) -> dict[str, Any]:
    """Upcoming games for one team, each with ranked candidate streams and reasons."""
    async with get_db() as db:
        out = await team_games(db, tc_id)
    if out is None:
        raise HTTPException(404, "Not found")
    return out


@router.put("/{tc_id}/overrides/{espn_event_id}")
async def put_override(
    tc_id: int,
    espn_event_id: str,
    body: StreamOverrideIn,
    background: BackgroundTasks,
) -> dict[str, Any]:
    async with get_db() as db:
        cur = await db.execute("SELECT id FROM team_channels WHERE id = ?", (tc_id,))
        if not await cur.fetchone():
            raise HTTPException(404, "Not found")
        await db.execute(
            """
            INSERT INTO stream_overrides(team_channel_id, espn_event_id, stream_id, stream_name)
            VALUES(?,?,?,?)
            ON CONFLICT(team_channel_id, espn_event_id) DO UPDATE SET
                stream_id = excluded.stream_id,
                stream_name = excluded.stream_name,
                created_at = datetime('now')
            """,
            (tc_id, espn_event_id, body.stream_id, body.stream_name),
        )
        await db.commit()
    background.add_task(_route_in_background, tc_id)
    return {
        "team_channel_id": tc_id,
        "espn_event_id": espn_event_id,
        "stream_id": body.stream_id,
    }


@router.delete("/{tc_id}/overrides/{espn_event_id}")
async def delete_override(
    tc_id: int, espn_event_id: str, background: BackgroundTasks
) -> dict[str, str]:
    async with get_db() as db:
        await db.execute(
            "DELETE FROM stream_overrides WHERE team_channel_id = ? AND espn_event_id = ?",
            (tc_id, espn_event_id),
        )
        await db.commit()
    background.add_task(_route_in_background, tc_id)
    return {"status": "ok"}


@router.post("", response_model=TeamChannelOut)
async def create_team_channel(body: TeamChannelCreate) -> TeamChannelOut:
    aliases_json = json.dumps(body.aliases) if body.aliases else None
    async with get_db() as db:
        cur = await db.execute(
            "SELECT id FROM league_profiles WHERE id = ?", (body.league_profile_id,)
        )
        if not await cur.fetchone():
            raise HTTPException(400, "Invalid league_profile_id")
        await db.execute(
            """
            INSERT INTO team_channels(
                team_name, espn_team_id, espn_team_abbr, league_profile_id,
                dispatcharr_channel_id, enabled, aliases_json
            ) VALUES(?,?,?,?,?,?,?)
            """,
            (
                body.team_name,
                body.espn_team_id,
                body.espn_team_abbr,
                body.league_profile_id,
                body.dispatcharr_channel_id,
                1 if body.enabled else 0,
                aliases_json,
            ),
        )
        await db.commit()
        cur = await db.execute("SELECT last_insert_rowid()")
        rid = (await cur.fetchone())[0]
        cur = await db.execute("SELECT * FROM team_channels WHERE id = ?", (rid,))
        row = await cur.fetchone()
    return _row_out(dict(row))


@router.put("/{tc_id}", response_model=TeamChannelOut)
@router.patch("/{tc_id}", response_model=TeamChannelOut)
async def update_team_channel(tc_id: int, body: TeamChannelUpdate) -> TeamChannelOut:
    async with get_db() as db:
        cur = await db.execute("SELECT * FROM team_channels WHERE id = ?", (tc_id,))
        row = await cur.fetchone()
        if not row:
            raise HTTPException(404, "Not found")
        sets: list[str] = []
        vals: list[Any] = []
        if body.team_name is not None:
            sets.append("team_name = ?")
            vals.append(body.team_name)
        if body.espn_team_id is not None:
            sets.append("espn_team_id = ?")
            vals.append(body.espn_team_id)
        if body.espn_team_abbr is not None:
            sets.append("espn_team_abbr = ?")
            vals.append(body.espn_team_abbr)
        if body.league_profile_id is not None:
            sets.append("league_profile_id = ?")
            vals.append(body.league_profile_id)
        if body.dispatcharr_channel_id is not None:
            sets.append("dispatcharr_channel_id = ?")
            vals.append(body.dispatcharr_channel_id)
        if body.enabled is not None:
            sets.append("enabled = ?")
            vals.append(1 if body.enabled else 0)
        if body.aliases is not None:
            sets.append("aliases_json = ?")
            vals.append(json.dumps(body.aliases))
        if sets:
            vals.append(tc_id)
            await db.execute(
                f"UPDATE team_channels SET {', '.join(sets)} WHERE id = ?", vals
            )
            await db.commit()
        cur = await db.execute("SELECT * FROM team_channels WHERE id = ?", (tc_id,))
        row = await cur.fetchone()
    return _row_out(dict(row))


@router.delete("/{tc_id}")
async def delete_team_channel(tc_id: int) -> dict[str, str]:
    async with get_db() as db:
        for table in ("stream_overrides", "channel_restore"):
            await db.execute(f"DELETE FROM {table} WHERE team_channel_id = ?", (tc_id,))
        await db.execute("DELETE FROM team_channels WHERE id = ?", (tc_id,))
        await db.commit()
    return {"status": "ok"}
