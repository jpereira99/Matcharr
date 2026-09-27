"""League profiles API."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.database import get_db
from app.models import (
    LeagueProfileCreate,
    LeagueProfileOut,
    LeagueProfileUpdate,
    PatternTestRequest,
    PatternTestResponse,
)
from app.services.matcher import stream_check
from app.services.patterns import compile_league_pattern, match_stream_name

router = APIRouter(prefix="/profiles", tags=["profiles"])

_SELECT_WITH_COUNT = """
    SELECT lp.*, (SELECT COUNT(*) FROM team_channels tc WHERE tc.league_profile_id = lp.id) AS team_channel_count
    FROM league_profiles lp
"""


def _clean_terms(terms: list[str]) -> list[str]:
    out: list[str] = []
    for t in terms:
        t = t.strip()
        if t and t.lower() not in {x.lower() for x in out}:
            out.append(t)
    return out


async def _fetch_profile(db, profile_id: int) -> LeagueProfileOut:
    cur = await db.execute(_SELECT_WITH_COUNT + " WHERE lp.id = ?", (profile_id,))
    row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Profile not found")
    return _row_to_out(dict(row))


@router.get("", response_model=list[LeagueProfileOut])
async def list_profiles() -> list[LeagueProfileOut]:
    async with get_db() as db:
        cur = await db.execute(_SELECT_WITH_COUNT + " ORDER BY lp.id")
        rows = await cur.fetchall()
    return [_row_to_out(dict(r)) for r in rows]


@router.post("", response_model=LeagueProfileOut)
async def create_profile(body: LeagueProfileCreate) -> LeagueProfileOut:
    try:
        compile_league_pattern(body.stream_pattern)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    async with get_db() as db:
        cur = await db.execute(
            """
            INSERT INTO league_profiles(
                name, stream_pattern, stream_name_filter, espn_sport, espn_league, enabled,
                exclude_terms_json, m3u_account_id, channel_group
            )
            VALUES(?,?,?,?,?,?,?,?,?)
            """,
            (
                body.name,
                body.stream_pattern,
                body.stream_name_filter,
                body.espn_sport,
                body.espn_league,
                1 if body.enabled else 0,
                json.dumps(_clean_terms(body.exclude_terms)),
                body.m3u_account_id,
                body.channel_group.strip(),
            ),
        )
        await db.commit()
        return await _fetch_profile(db, cur.lastrowid)


@router.get("/stream-check")
async def stream_check_unsaved(
    espn_sport: str = Query(...),
    espn_league: str = Query(...),
    m3u_account_id: int | None = Query(None),
    channel_group: str = Query(""),
    contains: str = Query(""),
) -> dict[str, Any]:
    """Preview data for a profile that hasn't been saved yet."""
    async with get_db() as db:
        return await stream_check(
            db,
            profile_id=None,
            espn_sport=espn_sport,
            espn_league=espn_league,
            m3u_account_id=m3u_account_id,
            channel_group=channel_group,
            contains=contains,
        )


@router.post("/test-pattern", response_model=PatternTestResponse)
async def test_pattern(body: PatternTestRequest) -> PatternTestResponse:
    try:
        c = compile_league_pattern(body.pattern)
    except ValueError as e:
        return PatternTestResponse(matched=False, groups={}, error=str(e))
    ok, groups = match_stream_name(c, body.stream_name)
    return PatternTestResponse(matched=ok, groups=groups, error=None)


@router.get("/{profile_id}", response_model=LeagueProfileOut)
async def get_profile(profile_id: int) -> LeagueProfileOut:
    async with get_db() as db:
        return await _fetch_profile(db, profile_id)


@router.get("/{profile_id}/stream-check")
async def stream_check_saved(
    profile_id: int,
    espn_sport: str | None = Query(None),
    espn_league: str | None = Query(None),
    m3u_account_id: int | None = Query(None),
    channel_group: str | None = Query(None),
    contains: str | None = Query(None),
) -> dict[str, Any]:
    """Stream titles in the profile's pool plus upcoming ESPN games.

    Query params override the saved values so the editor can preview unsaved filters.
    """
    async with get_db() as db:
        p = await _fetch_profile(db, profile_id)
        return await stream_check(
            db,
            profile_id=profile_id,
            espn_sport=espn_sport or p.espn_sport,
            espn_league=espn_league or p.espn_league,
            m3u_account_id=(
                m3u_account_id if m3u_account_id is not None else p.m3u_account_id
            ),
            channel_group=(
                channel_group if channel_group is not None else p.channel_group
            ),
            contains=contains if contains is not None else p.stream_name_filter,
        )


async def _update_profile(
    profile_id: int, body: LeagueProfileUpdate
) -> LeagueProfileOut:
    async with get_db() as db:
        cur = await db.execute(
            "SELECT * FROM league_profiles WHERE id = ?", (profile_id,)
        )
        row = await cur.fetchone()
        if not row:
            raise HTTPException(404, "Profile not found")
        data = dict(row)
        pattern = (
            body.stream_pattern
            if body.stream_pattern is not None
            else data["stream_pattern"]
        )
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
        if body.exclude_terms is not None:
            sets.append("exclude_terms_json = ?")
            vals.append(json.dumps(_clean_terms(body.exclude_terms)))
        if "m3u_account_id" in body.model_fields_set:
            sets.append("m3u_account_id = ?")
            vals.append(body.m3u_account_id)
        if body.channel_group is not None:
            sets.append("channel_group = ?")
            vals.append(body.channel_group.strip())
        if sets:
            vals.append(profile_id)
            await db.execute(
                f"UPDATE league_profiles SET {', '.join(sets)} WHERE id = ?",
                vals,
            )
            await db.commit()
        return await _fetch_profile(db, profile_id)


@router.put("/{profile_id}", response_model=LeagueProfileOut)
async def update_profile(
    profile_id: int, body: LeagueProfileUpdate
) -> LeagueProfileOut:
    return await _update_profile(profile_id, body)


@router.patch("/{profile_id}", response_model=LeagueProfileOut)
async def patch_profile(profile_id: int, body: LeagueProfileUpdate) -> LeagueProfileOut:
    return await _update_profile(profile_id, body)


@router.delete("/{profile_id}")
async def delete_profile(profile_id: int) -> dict[str, str]:
    async with get_db() as db:
        await db.execute("DELETE FROM league_profiles WHERE id = ?", (profile_id,))
        await db.commit()
    return {"status": "ok"}


def _row_to_out(row: dict[str, Any]) -> LeagueProfileOut:
    try:
        terms = json.loads(row.get("exclude_terms_json") or "[]")
    except json.JSONDecodeError:
        terms = []
    return LeagueProfileOut(
        id=row["id"],
        name=row["name"],
        stream_pattern=row["stream_pattern"],
        stream_name_filter=row.get("stream_name_filter") or "",
        espn_sport=row["espn_sport"],
        espn_league=row["espn_league"],
        enabled=bool(row["enabled"]),
        exclude_terms=[str(t) for t in terms] if isinstance(terms, list) else [],
        m3u_account_id=row.get("m3u_account_id"),
        channel_group=row.get("channel_group") or "",
        created_at=str(row["created_at"]),
        team_channel_count=int(row.get("team_channel_count") or 0),
    )
