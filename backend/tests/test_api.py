def test_status_games_and_override_flow(env):
    client, fake = env

    status = client.get("/api/team-channels/status").json()
    item = status["items"][0]
    assert item["status"] == "ready"
    assert item["winner"]["stream_id"] == 2
    assert item["next_game"]["opponent"]["short_name"] == "St. Louis"
    assert fake.stream_calls[0] == {
        "name": "(MLS)",
        "m3u": 7,
        "group": "MLS Season Pass",
    }

    games = client.get("/api/team-channels/1/games").json()
    g = games["games"][0]
    kinds = [(c["stream_id"], c["kind"]) for c in g["candidates"]]
    assert kinds == [(2, "fit"), (3, "rejected"), (1, "skipped")]
    assert g["rank_reason"] == "only_fit"
    assert games["current_stream"] is None

    r = client.put(
        "/api/team-channels/1/overrides/g1", json={"stream_id": 1, "stream_name": "x"}
    )
    assert r.status_code == 200
    # Game is inside the routing window, so the override is applied right away.
    assert fake.patches == [(103, [1])]
    item = client.get("/api/team-channels/status").json()["items"][0]
    assert item["status"] == "override"
    assert item["winner"]["stream_id"] == 1

    client.delete("/api/team-channels/1/overrides/g1")
    assert fake.patches[-1] == (103, [2])
    assert (
        client.get("/api/team-channels/status").json()["items"][0]["status"] == "ready"
    )


def test_profile_patch_and_stream_check(env):
    client, _ = env

    check = client.get("/api/profiles/1/stream-check").json()
    names = [s["id"] for s in check["streams"]]
    # Account 8 and the "MLS Extras" group are filtered out locally.
    assert names == [1, 2, 3]
    assert check["games"][0]["home_short"] == "NYCFC"
    assert check["aliases_by_team_id"] == {"17606": ["New_York"]}

    r = client.patch(
        "/api/profiles/1",
        json={
            "m3u_account_id": None,
            "channel_group": "",
            "exclude_terms": ["(FR)", " (fr) ", ""],
        },
    )
    body = r.json()
    assert body["m3u_account_id"] is None
    assert body["channel_group"] == ""
    assert body["exclude_terms"] == ["(FR)"]

    check = client.get("/api/profiles/1/stream-check").json()
    assert [s["id"] for s in check["streams"]] == [1, 2, 3, 4, 5]

    # Omitting m3u_account_id leaves it untouched.
    client.patch("/api/profiles/1", json={"m3u_account_id": 7})
    assert (
        client.patch("/api/profiles/1", json={"name": "Renamed"}).json()[
            "m3u_account_id"
        ]
        == 7
    )


def test_spa_serves_root_static_files(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    from app.config import get_settings
    from app.main import create_app

    static = tmp_path / "static"
    static.mkdir()
    (static / "index.html").write_text("<html>app</html>")
    (static / "favicon.ico").write_bytes(b"ico")
    (static / "espn-assets-sw.js").write_text(
        "self.addEventListener('fetch', () => {})"
    )
    (tmp_path / "secret.txt").write_text("nope")
    monkeypatch.setenv("MA_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("MA_STATIC_DIR", str(static))
    get_settings.cache_clear()
    try:
        client = TestClient(create_app())
        assert client.get("/favicon.ico").content == b"ico"
        sw = client.get("/espn-assets-sw.js")
        assert "javascript" in sw.headers["content-type"]
        assert client.get("/teams/3").text == "<html>app</html>"
        assert client.get("/..%2Fsecret.txt").text == "<html>app</html>"
    finally:
        get_settings.cache_clear()
