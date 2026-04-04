"""App settings API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.database import get_db
from app.models import AppSettings, DispatcharrTestRequest, DispatcharrTestResponse
from app.services.dispatcharr import DispatcharrClient
from app.services.scheduler import schedule_match_cycle
from app.settings_store import load_settings, save_settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=AppSettings)
async def get_settings() -> AppSettings:
    async with get_db() as db:
        return await load_settings(db)


@router.put("", response_model=AppSettings)
async def put_settings(body: AppSettings) -> AppSettings:
    async with get_db() as db:
        await save_settings(db, body)
    schedule_match_cycle(body.scan_interval_minutes)
    return body


@router.post("/test-dispatcharr", response_model=DispatcharrTestResponse)
async def test_dispatcharr(body: DispatcharrTestRequest) -> DispatcharrTestResponse:
    async with get_db() as db:
        s = await load_settings(db)
    url = body.dispatcharr_url or s.dispatcharr_url
    token = body.dispatcharr_token or s.dispatcharr_token
    if not url or not token:
        return DispatcharrTestResponse(
            ok=False, message="URL and token required", detail=None
        )
    client = DispatcharrClient(url, token)
    ok, msg, detail = await client.test_connection()
    return DispatcharrTestResponse(ok=ok, message=msg, detail=detail)
