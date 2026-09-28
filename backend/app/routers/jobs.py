"""Run scheduled jobs on demand (Settings → Scheduler)."""

from __future__ import annotations

import logging

from fastapi import APIRouter

from app.database import get_db
from app.models import ManualRunResponse
from app.services.matcher import refresh_all_schedules, run_match_cycle

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/espn-refresh", response_model=ManualRunResponse)
async def espn_refresh() -> ManualRunResponse:
    """Re-download ESPN games for every enabled league profile, ignoring the refresh interval."""
    try:
        async with get_db() as db:
            counts = await refresh_all_schedules(db)
    except Exception as e:
        logger.exception("Manual ESPN refresh failed")
        return ManualRunResponse(ok=False, message=f"ESPN refresh failed: {e}")
    if not counts:
        return ManualRunResponse(
            ok=True, message="No enabled league profiles to refresh."
        )
    games = sum(counts.values())
    empty = [name for name, n in counts.items() if n == 0]
    msg = (
        f"Cached {games} game{'' if games == 1 else 's'} for "
        f"{len(counts)} league profile{'' if len(counts) == 1 else 's'}."
    )
    if empty:
        msg += f" No games found for {', '.join(empty)}; check the ESPN league."
    return ManualRunResponse(ok=True, message=msg)


@router.post("/match-cycle", response_model=ManualRunResponse)
async def match_cycle() -> ManualRunResponse:
    """The periodic stream-matching job, run now (ESPN refresh throttling still applies)."""
    async with get_db() as db:
        result = await run_match_cycle(db)
    return ManualRunResponse(
        ok=bool(result.get("ok")), message=str(result.get("message", ""))
    )
