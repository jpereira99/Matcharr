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


@router.get("/m3u-accounts")
async def da_m3u_accounts() -> list[dict[str, Any]]:
    client = await _client()
    try:
        rows = await client.list_m3u_accounts()
    except Exception as e:
        raise HTTPException(502, str(e)) from e
    return [
        {
            "id": r.get("id"),
            "name": r.get("name") or f"Account {r.get('id')}",
            "is_active": r.get("is_active", True),
        }
        for r in rows
        if r.get("id") is not None
    ]


@router.get("/stream-groups")
async def da_stream_groups() -> list[str]:
    """Channel group names that contain streams."""
    client = await _client()
    try:
        return await client.list_stream_group_names()
    except Exception as e:
        raise HTTPException(502, str(e)) from e


@router.get("/streams")
async def da_streams(
    name: str = Query("", description="Name contains filter"),
    m3u_account_id: int | None = Query(None),
    channel_group: str = Query(""),
    limit: int | None = Query(
        None, ge=1, le=50, description="Return only the first N (one request)"
    ),
) -> list[dict[str, Any]]:
    client = await _client()
    try:
        if limit is not None:
            return await client.sample_streams(
                m3u_account_id=m3u_account_id,
                channel_group_name=channel_group,
                name_contains=name,
                limit=limit,
            )
        return await client.list_streams(
            name_contains=name,
            m3u_account_id=m3u_account_id,
            channel_group_name=channel_group,
        )
    except Exception as e:
        raise HTTPException(502, str(e)) from e
