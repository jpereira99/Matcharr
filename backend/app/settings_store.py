"""Load/save application settings from app_kv."""

from __future__ import annotations

import json
from typing import Any

import aiosqlite

from app.database import kv_get, kv_set
from app.models import AppSettings

SETTINGS_KEY = "app_settings_json"


def default_settings() -> AppSettings:
    return AppSettings()


async def load_settings(db: aiosqlite.Connection) -> AppSettings:
    raw = await kv_get(db, SETTINGS_KEY)
    if not raw:
        return default_settings()
    try:
        data = json.loads(raw)
        return AppSettings.model_validate(data)
    except Exception:
        return default_settings()


async def save_settings(db: aiosqlite.Connection, settings: AppSettings) -> None:
    await kv_set(db, SETTINGS_KEY, settings.model_dump_json())
