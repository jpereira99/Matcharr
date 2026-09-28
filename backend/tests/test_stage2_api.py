"""Dashboard, Activity Log, League Profiles list and routing-rule endpoints."""

from datetime import datetime, timedelta, timezone


def _log(env, outcome, reason, *, hours_ago=0.0, team=1, to_name="x"):
    at = (datetime.now(timezone.utc) - timedelta(hours=hours_ago)).strftime(
        "%Y-%m-%d %H:%M:%S"
    )
    env.sql(
        "INSERT INTO switch_log(team_channel_id, to_stream_name, reason, outcome, switched_at) VALUES(?,?,?,?,?)",
        (team, to_name, reason, outcome, at),
    )


def test_logs_filters_counts_and_pagination(env):
    _log(
        env, "switched", "Routed to game 1", hours_ago=1, to_name="Rockies x White Sox"
    )
    _log(env, "no_match", "No matching stream for Giants", hours_ago=2)
    _log(env, "failed", "Switch failed: 502", hours_ago=3)
    _log(env, "switched", "Routed to game 2", hours_ago=30)
    c = env.client

    page = c.get("/api/logs", params={"page_size": 2}).json()
    assert page["total"] == 4
    assert len(page["items"]) == 2
    assert page["items"][0]["reason"] == "Routed to game 1"
    assert page["counts_by_outcome"] == {
        "switched": 2,
        "no_match": 1,
        "failed": 1,
        "override": 0,
    }
    assert (
        c.get("/api/logs", params={"page_size": 2, "page": 2}).json()["items"][1][
            "reason"
        ]
        == "Routed to game 2"
    )

    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    f = c.get(
        "/api/logs",
        params=[("since", since), ("outcome", "no_match"), ("outcome", "failed")],
    ).json()
    assert f["total"] == 2
    # Counts ignore the outcome filter but respect the rest.
    assert f["counts_by_outcome"]["switched"] == 1

    assert c.get("/api/logs", params={"q": "white sox"}).json()["total"] == 1
    assert c.get("/api/logs", params={"league_profile_id": 99}).json()["total"] == 0
    assert c.get("/api/logs", params={"team_channel_id": 1}).json()["total"] == 4


def test_outcome_logging_and_restore_after_game(env):
    env.fake.channel_streams[103] = [env.fake.streams[3]]  # "MLS 360" before routing
    env.set_settings(after_game_action="restore")

    env.run_cycle()
    assert env.fake.patches == [(103, [2])]
    assert env.sql("SELECT stream_ids_json FROM channel_restore") == [("[4]",)]
    assert env.sql("SELECT outcome FROM switch_log") == [("switched",)]

    env.sql("UPDATE schedule_cache SET status = 'post'")
    env.run_cycle()
    assert env.fake.patches[-1] == (103, [4])
    assert env.sql("SELECT COUNT(*) FROM channel_restore") == [(0,)]
    last = env.sql("SELECT reason, outcome FROM switch_log ORDER BY id DESC LIMIT 1")
    assert last[0][1] == "switched" and last[0][0].startswith("Restored")


def test_clear_after_game_and_override_outcome(env):
    env.set_settings(after_game_action="clear")
    env.client.put("/api/team-channels/1/overrides/g1", json={"stream_id": 1})
    assert env.sql("SELECT outcome FROM switch_log") == [("override",)]
    env.sql("UPDATE schedule_cache SET status = 'post'")
    env.run_cycle()
    assert env.fake.patches[-1] == (103, [])


def test_dashboard_timeline_and_attention(env):
    d = env.client.get("/api/dashboard").json()
    assert d["health"]["dispatcharr_latency_ms"] == 12
    row = d["timeline"][0]
    g = row["games"][0]
    assert (g["status"], g["label"], g["duration_min"]) == ("ok", "vs STL", 120)
    assert g["stream_name"].endswith(env.game_time.strftime("(%Y-%m-%d %H:%M:%S)"))
    assert {s[2] for s in g["spans"]} == {"n", "home", "away", "time"}
    assert d["tracked_summary"]["ready"] == 1
    assert d["attention"] == []

    # Without the skip term both feeds fit -> needs a look.
    env.client.patch("/api/profiles/1", json={"exclude_terms": []})
    d = env.client.get("/api/dashboard").json()
    g = d["timeline"][0]["games"][0]
    assert (g["status"], g["fit_count"]) == ("warn", 2)
    assert d["attention"][0]["game"]["event_id"] == "g1"
    assert d["tracked_summary"]["attention"] == 1


def test_profiles_summary_duplicate_delete_and_default_terms(env):
    env.sql(
        "UPDATE schedule_cache SET game_time = ?",
        (datetime.now(timezone.utc).replace(microsecond=0).isoformat(),),
    )
    s = env.client.get("/api/profiles/summary").json()
    p = s["profiles"][0]
    assert [t["name"] for t in p["teams"]] == ["New York City FC"]
    assert p["games_today"][0]["status"] == "ok"
    assert p["games_today"][0]["label"] == "NYCFC vs St. Louis"
    assert p["note"] is None

    dup = env.client.post("/api/profiles/1/duplicate").json()
    assert (dup["name"], dup["enabled"], dup["team_channel_count"]) == (
        "MLS Apple copy",
        False,
        0,
    )
    names = [
        x["name"] for x in env.client.get("/api/profiles/summary").json()["profiles"]
    ]
    assert names == ["MLS Apple", "MLS Apple copy"]

    created = env.client.post(
        "/api/profiles",
        json={
            "name": "Draft",
            "stream_pattern": "",
            "espn_sport": "soccer",
            "espn_league": "usa.1",
            "enabled": False,
        },
    ).json()
    assert created["exclude_terms"] == ["(Spanish)", "(Alt)", "(FR)"]

    env.client.delete("/api/profiles/1")
    assert env.sql("SELECT COUNT(*) FROM team_channels") == [(0,)]
    assert env.client.get("/api/team-channels").json() == []
