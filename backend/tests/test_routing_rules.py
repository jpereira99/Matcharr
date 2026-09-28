from datetime import datetime, timedelta, timezone

from app.models import AppSettings
from app.services.candidates import rank_candidates, summarize
from app.services.matcher import _game_active_for_team, game_routing_stopped
from app.services.patterns import compile_league_pattern
from zoneinfo import ZoneInfo

KICKOFF = datetime(2026, 9, 26, 23, 30, tzinfo=timezone.utc)
MLS = compile_league_pattern("(Apple) (MLS) {n} |  {home} vs. {away} ({time})")


def _game(status="pre"):
    return {"game_time": KICKOFF.isoformat(), "status": status}


def test_final_stop_mode_follows_espn_status():
    s = AppSettings()
    assert not _game_active_for_team(_game(), KICKOFF - timedelta(minutes=31), s)
    assert _game_active_for_team(_game(), KICKOFF - timedelta(minutes=29), s)
    assert _game_active_for_team(_game("in"), KICKOFF + timedelta(hours=5), s)
    assert not _game_active_for_team(_game("post"), KICKOFF + timedelta(hours=2), s)
    assert game_routing_stopped(_game("post"), KICKOFF + timedelta(hours=2), s)
    assert not game_routing_stopped(_game("in"), KICKOFF + timedelta(hours=2), s)


def test_fixed_stop_mode_uses_hours_after_kickoff():
    s = AppSettings(routing_stop_mode="fixed", routing_stop_hours=4)
    later = KICKOFF + timedelta(hours=3, minutes=59)
    assert _game_active_for_team(_game("post"), later, s)
    assert not game_routing_stopped(_game("post"), later, s)
    after = KICKOFF + timedelta(hours=4, minutes=1)
    assert not _game_active_for_team(_game("in"), after, s)
    assert game_routing_stopped(_game("in"), after, s)


def _rank(tie_break, preferred=None):
    streams = [
        {
            "id": 1,
            "name": "(Apple) (MLS) 005 |  Charlotte vs. Chicago (2026-09-26 19:00:00)",
            "m3u_account": 1,
        },
        {
            "id": 2,
            "name": "(Apple) (MLS) 006 |  Charlotte vs. Chicago (2026-09-26 19:25:00)",
            "m3u_account": 2,
        },
    ]
    kw = dict(
        team_name="Charlotte FC",
        team_aliases=[],
        opp_name="Chicago Fire FC",
        opp_aliases=[],
        is_home=True,
        skip_terms=[],
        game_time=KICKOFF,
        local_tz=ZoneInfo("America/New_York"),
        tie_break=tie_break,
        preferred_account_id=preferred,
    )
    cands = rank_candidates(MLS, streams, **kw)
    ev = summarize(
        cands, streams, None, tie_break=tie_break, preferred_account_id=preferred
    )
    return ev.winner["stream_id"], ev.rank_reason


def test_tie_break_modes():
    assert _rank("closest_time") == (2, "closest_time")
    assert _rank("first_listed") == (1, "listed_first")
    assert _rank("prefer_account", preferred=1) == (1, "preferred_account")
    assert _rank("prefer_account", preferred=None) == (2, "closest_time")
