from app.services.patterns import compile_league_pattern, match_stream_name, teams_match


def test_mlb_pattern():
    c = compile_league_pattern(r"MLB {n} | {away} vs {home} | {time}")
    ok, g = match_stream_name(c, "MLB 5 | Red Sox vs Yankees | 7:00 PM")
    assert ok
    assert g["n"] == "5"
    assert "Red Sox" in g["away"]
    assert "Yankees" in g["home"]


def test_teams_match():
    assert teams_match("NY Yankees", "New York Yankees", ["Yankees"])
