"""SQLite database setup and queries."""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import aiosqlite

from app.config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS app_kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS league_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    stream_pattern TEXT NOT NULL,
    stream_name_filter TEXT NOT NULL DEFAULT '',
    espn_sport TEXT NOT NULL,
    espn_league TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    exclude_terms_json TEXT NOT NULL DEFAULT '[]',
    m3u_account_id INTEGER,
    channel_group TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS team_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name TEXT NOT NULL,
    espn_team_id TEXT NOT NULL,
    espn_team_abbr TEXT NOT NULL DEFAULT '',
    league_profile_id INTEGER NOT NULL REFERENCES league_profiles(id) ON DELETE CASCADE,
    dispatcharr_channel_id INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    aliases_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedule_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_profile_id INTEGER NOT NULL REFERENCES league_profiles(id) ON DELETE CASCADE,
    espn_event_id TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    home_team_id TEXT NOT NULL,
    away_team_id TEXT NOT NULL,
    game_time TEXT NOT NULL,
    status TEXT NOT NULL,
    raw_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(league_profile_id, espn_event_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_league_time ON schedule_cache(league_profile_id, game_time);

CREATE TABLE IF NOT EXISTS switch_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_channel_id INTEGER NOT NULL REFERENCES team_channels(id) ON DELETE CASCADE,
    from_stream_name TEXT,
    to_stream_name TEXT,
    to_stream_id INTEGER,
    reason TEXT NOT NULL,
    switched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_switch_log_time ON switch_log(switched_at DESC);

-- One-game manual stream choice; removed once the game is over.
CREATE TABLE IF NOT EXISTS stream_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_channel_id INTEGER NOT NULL REFERENCES team_channels(id) ON DELETE CASCADE,
    espn_event_id TEXT NOT NULL,
    stream_id INTEGER NOT NULL,
    stream_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(team_channel_id, espn_event_id)
);
"""

# (table, column, DDL) for columns added after the first release.
_COLUMN_MIGRATIONS: list[tuple[str, str, str]] = [
    ("team_channels", "espn_team_abbr", "TEXT NOT NULL DEFAULT ''"),
    ("league_profiles", "exclude_terms_json", "TEXT NOT NULL DEFAULT '[]'"),
    ("league_profiles", "m3u_account_id", "INTEGER"),
    ("league_profiles", "channel_group", "TEXT NOT NULL DEFAULT ''"),
]


async def init_db() -> None:
    settings = get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(settings.database_path) as db:
        await db.executescript(SCHEMA)
        for table, column, ddl in _COLUMN_MIGRATIONS:
            cur = await db.execute(f"PRAGMA table_info({table})")
            cols = {row[1] for row in await cur.fetchall()}
            if column not in cols:
                await db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
        await db.commit()


@asynccontextmanager
async def get_db() -> AsyncIterator[aiosqlite.Connection]:
    settings = get_settings()
    db = await aiosqlite.connect(settings.database_path)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()


async def kv_get(
    db: aiosqlite.Connection, key: str, default: str | None = None
) -> str | None:
    cur = await db.execute("SELECT value FROM app_kv WHERE key = ?", (key,))
    row = await cur.fetchone()
    if row is None:
        return default
    return row[0]


async def kv_set(db: aiosqlite.Connection, key: str, value: str) -> None:
    await db.execute(
        "INSERT INTO app_kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
    await db.commit()


def _json_dumps(obj: Any) -> str:
    return json.dumps(obj, separators=(",", ":"))


def _json_loads(s: str | None, default: Any) -> Any:
    if not s:
        return default
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return default
