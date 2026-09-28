"""Switch log API."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.database import get_db
from app.models import LogPage, SwitchLogEntry, SwitchOutcome

router = APIRouter(prefix="/logs", tags=["logs"])

OUTCOMES: tuple[SwitchOutcome, ...] = ("switched", "no_match", "failed", "override")


def _sql_time(iso: str, name: str) -> str:
    """ISO timestamp -> switch_log's UTC 'YYYY-MM-DD HH:MM:SS' format."""
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError as e:
        raise HTTPException(422, f"{name} must be an ISO timestamp") from e
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


@router.get("", response_model=LogPage)
async def list_logs(
    q: str = Query("", description="Matches team, streams and reason"),
    team_channel_id: int | None = Query(None),
    league_profile_id: int | None = Query(None),
    outcome: list[SwitchOutcome] = Query(default=[]),
    since: str | None = Query(None, description="ISO timestamp, inclusive"),
    until: str | None = Query(None, description="ISO timestamp, exclusive"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
) -> LogPage:
    where: list[str] = []
    args: list[Any] = []
    if q.strip():
        like = f"%{q.strip().lower()}%"
        where.append(
            "(lower(coalesce(tc.team_name,'')) LIKE ? OR lower(coalesce(sl.from_stream_name,'')) LIKE ?"
            " OR lower(coalesce(sl.to_stream_name,'')) LIKE ? OR lower(sl.reason) LIKE ?)"
        )
        args += [like] * 4
    if team_channel_id is not None:
        where.append("sl.team_channel_id = ?")
        args.append(team_channel_id)
    if league_profile_id is not None:
        where.append("tc.league_profile_id = ?")
        args.append(league_profile_id)
    if since:
        where.append("sl.switched_at >= ?")
        args.append(_sql_time(since, "since"))
    if until:
        where.append("sl.switched_at < ?")
        args.append(_sql_time(until, "until"))

    base = "FROM switch_log sl LEFT JOIN team_channels tc ON tc.id = sl.team_channel_id"
    base_where = f" WHERE {' AND '.join(where)}" if where else ""

    async with get_db() as db:
        cur = await db.execute(
            f"SELECT sl.outcome, COUNT(*) {base}{base_where} GROUP BY sl.outcome", args
        )
        counts = {o: 0 for o in OUTCOMES}
        for r in await cur.fetchall():
            counts[str(r[0])] = int(r[1])

        full_where, full_args = list(where), list(args)
        if outcome:
            full_where.append(f"sl.outcome IN ({','.join('?' * len(outcome))})")
            full_args += outcome
        where_sql = f" WHERE {' AND '.join(full_where)}" if full_where else ""
        cur = await db.execute(f"SELECT COUNT(*) {base}{where_sql}", full_args)
        total = int((await cur.fetchone())[0])
        cur = await db.execute(
            f"""
            SELECT sl.*, tc.team_name, tc.league_profile_id {base}{where_sql}
            ORDER BY sl.switched_at DESC, sl.id DESC LIMIT ? OFFSET ?
            """,
            [*full_args, page_size, (page - 1) * page_size],
        )
        rows = [dict(r) for r in await cur.fetchall()]

    return LogPage(
        items=[
            SwitchLogEntry(**{**r, "switched_at": str(r["switched_at"])}) for r in rows
        ],
        total=total,
        counts_by_outcome=counts,
    )
