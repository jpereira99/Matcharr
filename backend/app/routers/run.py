"""Manual trigger for match cycle."""

from __future__ import annotations

from fastapi import APIRouter

from app.database import get_db
from app.models import ManualRunResponse
from app.services.matcher import run_match_cycle

router = APIRouter(tags=["run"])


@router.post("/run-now", response_model=ManualRunResponse)
async def run_now() -> ManualRunResponse:
    async with get_db() as db:
        result = await run_match_cycle(db, force_schedule_refresh=True)
    return ManualRunResponse(
        ok=bool(result.get("ok")), message=result.get("message", "")
    )
