"""Team channel mappings API."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException

from app.database import get_db
from app.models import TeamChannelCreate, TeamChannelOut, TeamChannelUpdate

router = APIRouter(prefix="/team-channels", tags=["team-channels"])


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
        await db.execute("DELETE FROM team_channels WHERE id = ?", (tc_id,))
        await db.commit()
    return {"status": "ok"}
