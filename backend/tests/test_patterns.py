from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.services.patterns import (
    compile_league_pattern,
    match_how,
    match_stream_name,
    match_stream_spans,
    parse_stream_stamp,
    stamp_delta_minutes,
    teams_match,
)


def test_mlb_pattern():
    c = compile_league_pattern(r"MLB {n} | {away} vs {home} | {time}")
    ok, g = match_stream_name(c, "MLB 5 | Red Sox vs Yankees | 7:00 PM")
    assert ok
    assert g["n"] == "5"
    assert "Red Sox" in g["away"]
    assert "Yankees" in g["home"]


def test_teams_match():
    assert teams_match("NY Yankees", "New York Yankees", ["Yankees"])


def test_literal_whitespace_is_flexible():
    c = compile_league_pattern("(Apple) (MLS) {n} |  {home} vs. {away} ({time})")
    ok, g = match_stream_name(
        c, "(Apple) (MLS) 005 |  Charlotte vs. Chicago  (2026-09-26 19:25:10)"
    )
    assert ok
    assert g["away"] == "Chicago"
    ok, _ = match_stream_name(
        c, "(Apple) (MLS) 005 | Charlotte vs. Chicago (2026-09-26 19:25:10)"
    )
    assert ok


def test_spans_exclude_whitespace():
    c = compile_league_pattern("NFL | {n} - {time} {away} at {home}")
    title = "NFL  | 07 - 1pm Titans at NY Giants"
    ok, g, spans = match_stream_spans(c, title)
    assert ok
    by_field = {f: title[a:b] for a, b, f in spans}
    assert by_field == {
        "n": "07",
        "time": "1pm",
        "away": "Titans",
        "home": "NY Giants",
    }


def test_escaped_braces():
    c = compile_league_pattern("{{LIVE}} {away} @ {home}")
    ok, g = match_stream_name(c, "{LIVE} Mets @ Phillies")
    assert ok and g == {"away": "Mets", "home": "Phillies"}


def test_match_how():
    assert match_how("St. Louis City SC", "St. Louis") == "part"
    assert match_how("New York City FC", "New_York", ["New_York"]) == "alias:New_York"
    assert match_how("Charlotte FC", "charlotte fc") == "matches"
    assert match_how("Atlanta United FC", "LA") is None
    assert match_how("Chicago Fire FC", "") is None


def test_alias_that_is_part_of_official_name_does_not_match_everything():
    assert not teams_match("New York Yankees", "Red Sox", ["Yankees"])


def test_parse_stream_stamp():
    s = parse_stream_stamp("2026-09-27 00:10:00 stop:2026-09-27 07:23:20")
    assert s and (s.day.isoformat(), s.hour, s.minute) == ("2026-09-27", 0, 10)
    s = parse_stream_stamp("Spanish) (2026-09-26 19:25:25")
    assert s and s.day.isoformat() == "2026-09-26" and s.hour == 19
    assert parse_stream_stamp("1pm") is None
    s = parse_stream_stamp("9/26", default_year=2026)
    assert s and s.day.isoformat() == "2026-09-26" and s.hour is None


def test_stamp_delta_reads_utc_or_local():
    ny = ZoneInfo("America/New_York")
    game = datetime(2026, 9, 26, 23, 30, tzinfo=timezone.utc)  # 7:30 PM ET
    local = parse_stream_stamp("2026-09-26 19:25:25")
    utc = parse_stream_stamp("2026-09-26 23:25:00")
    assert stamp_delta_minutes(local, game, ny) == 5
    assert stamp_delta_minutes(utc, game, ny) == 5
    late = datetime(2026, 9, 27, 0, 10, tzinfo=timezone.utc)  # 8:10 PM ET on 9/26
    assert stamp_delta_minutes(parse_stream_stamp("2026-09-26"), late, ny) == 0
    assert stamp_delta_minutes(parse_stream_stamp("2026-09-27"), late, ny) == 0
    assert stamp_delta_minutes(parse_stream_stamp("2026-09-28"), late, ny) == 1440
