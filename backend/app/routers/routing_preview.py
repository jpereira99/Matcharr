"""Dry-run routing preview (no side effects)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.database import get_db
from app.services.matcher import preview_routing, upcoming_stream_matches

router = APIRouter(tags=["routing-preview"])


@router.get("/routing-preview")
async def get_routing_preview() -> dict[str, Any]:
    async with get_db() as db:
        return await preview_routing(db)


@router.get("/upcoming-stream-matches")
async def get_upcoming_stream_matches() -> dict[str, Any]:
    async with get_db() as db:
        return await upcoming_stream_matches(db)
