"""Switch log API."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.database import get_db

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("")
async def list_logs(limit: int = Query(100, ge=1, le=500)) -> list[dict]:
    async with get_db() as db:
        cur = await db.execute(
            """
            SELECT sl.*, tc.team_name
            FROM switch_log sl
            LEFT JOIN team_channels tc ON tc.id = sl.team_channel_id
            ORDER BY sl.switched_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cur.fetchall()
    return [dict(r) for r in rows]
