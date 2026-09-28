import asyncio
import json
import sqlite3
from datetime import datetime, timedelta, timezone

import aiosqlite
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.database import init_db
from app.services import matcher
from app.services.dispatcharr import DispatcharrClient

STREAMS = [
    {
        "id": 1,
        "name": "(Apple) (MLS) 009 |  New_York vs. St. Louis (Spanish) ({t})",
        "m3u_account": 7,
        "channel_group": 3,
    },
    {
        "id": 2,
        "name": "(Apple) (MLS) 009 |  New_York vs. St. Louis ({t})",
        "m3u_account": 7,
        "channel_group": 3,
    },
    {
        "id": 3,
        "name": "(Apple) (MLS) 014 |  New_York vs. Montréal ({t})",
        "m3u_account": 7,
        "channel_group": 3,
    },
    {
        "id": 4,
        "name": "(Apple) (MLS) 031 | MLS 360 ({t})",
        "m3u_account": 7,
        "channel_group": 4,
    },
    {
        "id": 5,
        "name": "(Apple) (MLS) 040 |  Seattle vs. Portland ({t})",
        "m3u_account": 8,
        "channel_group": 3,
    },
]

BASE_SETTINGS = {"dispatcharr_url": "http://da", "dispatcharr_token": "k"}


class FakeDispatcharr:
    def __init__(self, stamp: str) -> None:
        self.streams = [{**s, "name": s["name"].format(t=stamp)} for s in STREAMS]
        self.channel_streams: dict[int, list[dict]] = {103: []}
        self.patches: list[tuple[int, list[int]]] = []
        self.stream_calls: list[dict] = []

    def install(self, monkeypatch) -> None:
        fake = self

        async def list_streams(
            self,
            name_contains="",
            page_size=500,
            *,
            m3u_account_id=None,
            channel_group_name="",
        ):
            fake.stream_calls.append(
                {
                    "name": name_contains,
                    "m3u": m3u_account_id,
                    "group": channel_group_name,
                }
            )
            return [
                s for s in fake.streams if name_contains.lower() in s["name"].lower()
            ]

        async def list_channel_groups(self):
            return [
                {"id": 3, "name": "MLS Season Pass"},
                {"id": 4, "name": "MLS Extras"},
            ]

        async def get_channel_streams(self, channel_id):
            return fake.channel_streams.get(channel_id, [])

        async def patch_channel_streams(self, channel_id, stream_ids):
            fake.patches.append((channel_id, stream_ids))
            fake.channel_streams[channel_id] = [
                s for s in fake.streams if s["id"] in stream_ids
            ]
            return {}

        async def test_connection(self):
            return True, "OK", {"latency_ms": 12, "channels": 7, "streams": 42}

        for name, fn in {
            "list_streams": list_streams,
            "list_channel_groups": list_channel_groups,
            "get_channel_streams": get_channel_streams,
            "patch_channel_streams": patch_channel_streams,
            "test_connection": test_connection,
        }.items():
            monkeypatch.setattr(DispatcharrClient, name, fn)


def _raw(home: tuple[str, str, str], away: tuple[str, str, str]) -> str:
    def side(where, t):
        return {
            "homeAway": where,
            "team": {"id": t[0], "abbreviation": t[1], "shortDisplayName": t[2]},
        }

    return json.dumps(
        {"competitions": [{"competitors": [side("home", home), side("away", away)]}]}
    )


async def _seed(db_path, game_time: datetime) -> None:
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            "INSERT INTO app_kv(key, value) VALUES('app_settings_json', ?)",
            (json.dumps(BASE_SETTINGS),),
        )
        await db.execute(
            "INSERT INTO app_kv(key, value) VALUES('last_schedule_refresh', ?)",
            (datetime.now(timezone.utc).isoformat(),),
        )
        await db.execute("""
            INSERT INTO league_profiles(name, stream_pattern, stream_name_filter, espn_sport,
                espn_league, exclude_terms_json, m3u_account_id, channel_group)
            VALUES('MLS Apple', '(Apple) (MLS) {n} |  {home} vs. {away} ({time})', '(MLS)',
                'soccer', 'usa.1', '["(Spanish)"]', 7, 'MLS Season Pass')
            """)
        await db.execute("""
            INSERT INTO team_channels(team_name, espn_team_id, league_profile_id,
                dispatcharr_channel_id, aliases_json)
            VALUES('New York City FC', '17606', 1, 103, '["New_York"]')
            """)
        await db.execute(
            """
            INSERT INTO schedule_cache(league_profile_id, espn_event_id, home_team, away_team,
                home_team_id, away_team_id, game_time, status, raw_json)
            VALUES(1, 'g1', 'New York City FC', 'St. Louis City SC', '17606', '21812', ?, 'pre', ?)
            """,
            (
                game_time.isoformat(),
                _raw(("17606", "NYC", "NYCFC"), ("21812", "STL", "St. Louis")),
            ),
        )
        await db.commit()


class Env:
    def __init__(self, client: TestClient, fake: FakeDispatcharr, game_time: datetime):
        self.client = client
        self.fake = fake
        self.game_time = game_time

    def __iter__(self):
        return iter((self.client, self.fake))

    def sql(self, statement: str, args: tuple = ()) -> list[tuple]:
        con = sqlite3.connect(get_settings().database_path)
        try:
            rows = con.execute(statement, args).fetchall()
            con.commit()
            return rows
        finally:
            con.close()

    def set_settings(self, **values) -> None:
        self.sql(
            "UPDATE app_kv SET value = ? WHERE key = 'app_settings_json'",
            (json.dumps({**BASE_SETTINGS, **values}),),
        )

    def run_cycle(self) -> dict:
        async def go():
            from app.database import get_db

            async with get_db() as db:
                return await matcher.run_match_cycle(db)

        return asyncio.run(go())


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("MA_DATA_DIR", str(tmp_path))
    get_settings.cache_clear()
    matcher._POOL_CACHE.clear()
    asyncio.run(init_db())
    game_time = (datetime.now(timezone.utc) + timedelta(minutes=10)).replace(
        microsecond=0
    )
    asyncio.run(_seed(get_settings().database_path, game_time))
    fake = FakeDispatcharr(game_time.strftime("%Y-%m-%d %H:%M:%S"))
    fake.install(monkeypatch)
    from app.main import create_app

    yield Env(TestClient(create_app()), fake, game_time)
    get_settings.cache_clear()
