"""APScheduler integration for periodic match cycles."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone=timezone.utc)
_next_scan_at: datetime | None = None
_last_scan_at: datetime | None = None
_scheduler_started = False


def get_scheduler_status() -> tuple[str | None, str | None, bool]:
    return (
        _last_scan_at.isoformat() if _last_scan_at else None,
        _next_scan_at.isoformat() if _next_scan_at else None,
        _scheduler_started,
    )


async def _run_job() -> None:
    global _last_scan_at, _next_scan_at
    from app.database import get_db
    from app.services.matcher import run_match_cycle

    async with get_db() as db:
        result = await run_match_cycle(db)
    _last_scan_at = datetime.now(timezone.utc)
    logger.info("Match cycle: %s", result.get("message"))
    job = scheduler.get_job("match_cycle")
    nrt = getattr(job, "next_run_time", None) if job else None
    if nrt:
        _next_scan_at = nrt


def schedule_match_cycle(minutes: int) -> None:
    """Replace interval job with new minutes."""
    global _scheduler_started
    if scheduler.get_job("match_cycle"):
        scheduler.remove_job("match_cycle")
    scheduler.add_job(
        _run_job,
        IntervalTrigger(minutes=max(1, minutes)),
        id="match_cycle",
        replace_existing=True,
    )
    job = scheduler.get_job("match_cycle")
    global _next_scan_at
    nrt = getattr(job, "next_run_time", None) if job else None
    if nrt:
        _next_scan_at = nrt
    else:
        _next_scan_at = datetime.now(timezone.utc) + timedelta(minutes=max(1, minutes))
    if not _scheduler_started:
        scheduler.start()
        _scheduler_started = True


def start_scheduler_from_config(minutes: int) -> None:
    schedule_match_cycle(minutes)
