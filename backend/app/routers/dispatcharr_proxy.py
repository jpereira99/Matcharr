"""Proxy Dispatcharr list endpoints using saved credentials."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.services.dispatcharr import DispatcharrClient
from app.settings_store import load_settings
from app.database import get_db

router = APIRouter(prefix="/dispatcharr", tags=["dispatcharr"])


async def _client() -> DispatcharrClient:
    async with get_db() as db:
        s = await load_settings(db)
    if not s.dispatcharr_url or not s.dispatcharr_token:
        raise HTTPException(400, "Configure Dispatcharr in Settings first")
    return DispatcharrClient(s.dispatcharr_url, s.dispatcharr_token)


@router.get("/channels")
async def da_channels(
    search: str = Query("", description="Search filter")
) -> list[dict[str, Any]]:
    client = await _client()
    try:
        return await client.list_channels(search=search)
    except Exception as e:
        raise HTTPException(502, str(e)) from e


@router.get("/streams")
async def da_streams(
    name: str = Query("", description="Name contains filter")
) -> list[dict[str, Any]]:
    client = await _client()
    try:
        return await client.list_streams(name_contains=name)
    except Exception as e:
        raise HTTPException(502, str(e)) from e
