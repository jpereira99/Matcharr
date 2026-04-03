"""League profiles API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from app.database import get_db
from app.models import LeagueProfileCreate, LeagueProfileOut, LeagueProfileUpdate, PatternTestRequest, PatternTestResponse
from app.services.patterns import compile_league_pattern, match_stream_name

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("", response_model=list[LeagueProfileOut])
async def list_profiles() -> list[LeagueProfileOut]:
    async with get_db() as db:
        cur = await db.execute(
            """
            SELECT lp.*, (SELECT COUNT(*) FROM team_channels tc WHERE tc.league_profile_id = lp.id) AS team_channel_count
            FROM league_profiles lp ORDER BY lp.id
            """
        )
        rows = await cur.fetchall()
    return [_row_to_out(dict(r)) for r in rows]


@router.post("", response_model=LeagueProfileOut)
async def create_profile(body: LeagueProfileCreate) -> LeagueProfileOut:
    try:
        compile_league_pattern(body.stream_pattern)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO league_profiles(name, stream_pattern, stream_name_filter, espn_sport, espn_league, enabled)
            VALUES(?,?,?,?,?,?)
            """,
            (
                body.name,
                body.stream_pattern,
                body.stream_name_filter,
                body.espn_sport,
                body.espn_league,
                1 if body.enabled else 0,
            ),
        )
        await db.commit()
        cur = await db.execute("SELECT last_insert_rowid()")
        rid = (await cur.fetchone())[0]
        cur = await db.execute(
            """
            SELECT lp.*, (SELECT COUNT(*) FROM team_channels tc WHERE tc.league_profile_id = lp.id) AS team_channel_count
            FROM league_profiles lp WHERE lp.id = ?
            """,
            (rid,),
        )
        row = await cur.fetchone()
    return _row_to_out(dict(row))


@router.put("/{profile_id}", response_model=LeagueProfileOut)
async def update_profile(profile_id: int, body: LeagueProfileUpdate) -> LeagueProfileOut:
    async with get_db() as db:
        cur = await db.execute("SELECT * FROM league_profiles WHERE id = ?", (profile_id,))
        row = await cur.fetchone()
        if not row:
            raise HTTPException(404, "Profile not found")
        data = dict(row)
        pattern = body.stream_pattern if body.stream_pattern is not None else data["stream_pattern"]
        try:
            compile_league_pattern(pattern)
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
        sets: list[str] = []
        vals: list[Any] = []
        if body.name is not None:
            sets.append("name = ?")
            vals.append(body.name)
        if body.stream_pattern is not None:
            sets.append("stream_pattern = ?")
            vals.append(body.stream_pattern)
        if body.stream_name_filter is not None:
            sets.append("stream_name_filter = ?")
            vals.append(body.stream_name_filter)
        if body.espn_sport is not None:
            sets.append("espn_sport = ?")
            vals.append(body.espn_sport)
        if body.espn_league is not None:
            sets.append("espn_league = ?")
            vals.append(body.espn_league)
        if body.enabled is not None:
            sets.append("enabled = ?")
            vals.append(1 if body.enabled else 0)
        if sets:
            vals.append(profile_id)
            await db.execute(
                f"UPDATE league_profiles SET {', '.join(sets)} WHERE id = ?",
                vals,
            )
            await db.commit()
        cur = await db.execute(
            """
            SELECT lp.*, (SELECT COUNT(*) FROM team_channels tc WHERE tc.league_profile_id = lp.id) AS team_channel_count
            FROM league_profiles lp WHERE lp.id = ?
            """,
            (profile_id,),
        )
        row = await cur.fetchone()
    return _row_to_out(dict(row))


@router.delete("/{profile_id}")
async def delete_profile(profile_id: int) -> dict[str, str]:
    async with get_db() as db:
        await db.execute("DELETE FROM league_profiles WHERE id = ?", (profile_id,))
        await db.commit()
    return {"status": "ok"}


@router.post("/test-pattern", response_model=PatternTestResponse)
async def test_pattern(body: PatternTestRequest) -> PatternTestResponse:
    try:
        c = compile_league_pattern(body.pattern)
    except ValueError as e:
        return PatternTestResponse(matched=False, groups={}, error=str(e))
    ok, groups = match_stream_name(c, body.stream_name)
    return PatternTestResponse(matched=ok, groups=groups, error=None)


def _row_to_out(row: dict[str, Any]) -> LeagueProfileOut:
    return LeagueProfileOut(
        id=row["id"],
        name=row["name"],
        stream_pattern=row["stream_pattern"],
        stream_name_filter=row.get("stream_name_filter") or "",
        espn_sport=row["espn_sport"],
        espn_league=row["espn_league"],
        enabled=bool(row["enabled"]),
        created_at=str(row["created_at"]),
        team_channel_count=int(row.get("team_channel_count") or 0),
    )
