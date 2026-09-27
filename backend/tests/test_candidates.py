from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.services.candidates import alias_suggestions, rank_candidates, summarize
from app.services.patterns import compile_league_pattern

NY = ZoneInfo("America/New_York")
MLS = compile_league_pattern("(Apple) (MLS) {n} |  {home} vs. {away} ({time})")
GAME_0930PM_UTC = datetime(2026, 9, 26, 23, 30, tzinfo=timezone.utc)


def _streams(*names: str) -> list[dict]:
    return [{"id": i + 1, "name": n} for i, n in enumerate(names)]


def _rank(
    streams,
    *,
    skip=(),
    team="New York City FC",
    aliases=("New_York",),
    opp="St. Louis City SC",
    is_home=True,
    pattern=MLS,
    game_time=GAME_0930PM_UTC,
    opp_aliases=(),
):
    return rank_candidates(
        pattern,
        streams,
        team_name=team,
        team_aliases=list(aliases),
        opp_name=opp,
        opp_aliases=list(opp_aliases),
        is_home=is_home,
        skip_terms=list(skip),
        game_time=game_time,
        local_tz=NY,
    )


# Dispatcharr's default `-name` ordering lists the Spanish feed first.
NYCFC_STREAMS = _streams(
    "(Apple) (MLS) 009 |  New_York vs. St. Louis (Spanish) (2026-09-26 19:25:25)",
    "(Apple) (MLS) 009 |  New_York vs. St. Louis (2026-09-26 19:25:25)",
    "(Apple) (MLS) 014 |  New_York vs. Montréal (2026-09-26 19:30:00)",
    "(Apple) (MLS) 005 |  Charlotte vs. Chicago (2026-09-26 19:25:10)",
)


def test_spanish_feed_no_longer_wins_with_skip_term():
    cands = _rank(NYCFC_STREAMS, skip=["(Spanish)"])
    ev = summarize(cands, NYCFC_STREAMS, None)
    assert ev.status == "ready"
    assert ev.winner["stream_id"] == 2
    assert ev.rank_reason == "only_fit"
    kinds = {c.stream_id: c.kind for c in cands}
    assert kinds == {2: "fit", 3: "rejected", 1: "skipped"}
    skipped = next(c for c in cands if c.kind == "skipped")
    assert skipped.skip_term == "(Spanish)"
    rejected = next(c for c in cands if c.kind == "rejected")
    assert rejected.our_side_result == "alias:New_York"
    assert rejected.opp_side_result is None


def test_without_skip_term_both_feeds_fit_and_conflict():
    ev = summarize(_rank(NYCFC_STREAMS), NYCFC_STREAMS, None)
    assert ev.status == "conflict"
    assert len(ev.fits) == 2
    assert ev.rank_reason == "listed_first"


def test_closest_stamp_ranks_first():
    streams = _streams(
        "(Apple) (MLS) 005 |  Charlotte vs. Chicago (2026-09-26 23:00:00)",
        "(Apple) (MLS) 006 |  Charlotte vs. Chicago (2026-09-26 19:25:10)",
    )
    ev = summarize(
        _rank(streams, team="Charlotte FC", aliases=(), opp="Chicago Fire FC"),
        streams,
        None,
    )
    assert ev.winner["stream_id"] == 2
    assert ev.rank_reason == "closest_time"


def test_stream_stamped_for_another_game_is_dropped():
    mlb = compile_league_pattern("MLB {n} : {away} x {home} start:{time}")
    streams = _streams(
        "MLB 08 : Rockies x White Sox start:2026-09-27 00:10:00 stop:2026-09-27 07:23:20"
    )
    sat_game = datetime(2026, 9, 27, 0, 10, tzinfo=timezone.utc)
    sun_game = datetime(2026, 9, 27, 18, 10, tzinfo=timezone.utc)
    common = dict(
        team="Chicago White Sox", aliases=(), opp="Colorado Rockies", pattern=mlb
    )
    assert len(_rank(streams, game_time=sat_game, **common)) == 1
    assert _rank(streams, game_time=sun_game, **common) == []


def test_near_miss_suggests_alias_for_our_side():
    nfl = compile_league_pattern("NFL | {n} - {time} {away} at {home}")
    streams = _streams("NFL  | 07 - 1pm Titans at NY Giants")
    cands = _rank(
        streams,
        pattern=nfl,
        team="New York Giants",
        aliases=(),
        opp="Tennessee Titans",
        game_time=datetime(2026, 9, 27, 17, 0, tzinfo=timezone.utc),
    )
    ev = summarize(cands, streams, None)
    assert ev.status == "near_miss"
    assert ev.winner is None
    assert alias_suggestions(cands, []) == ["NY Giants"]
    assert alias_suggestions(cands, ["ny giants"]) == []

    cands = _rank(
        streams,
        pattern=nfl,
        team="New York Giants",
        aliases=("NY Giants",),
        opp="Tennessee Titans",
        game_time=datetime(2026, 9, 27, 17, 0, tzinfo=timezone.utc),
    )
    assert summarize(cands, streams, None).status == "ready"


def test_override_beats_automatic_winner_even_when_skipped():
    cands = _rank(NYCFC_STREAMS, skip=["(Spanish)"])
    ev = summarize(cands, NYCFC_STREAMS, {"stream_id": 1, "stream_name": "x"})
    assert ev.status == "override"
    assert ev.winner["stream_id"] == 1
    assert ev.override["missing"] is False


def test_override_for_vanished_stream_falls_back_to_automatic():
    cands = _rank(NYCFC_STREAMS, skip=["(Spanish)"])
    ev = summarize(cands, NYCFC_STREAMS, {"stream_id": 999})
    assert ev.status == "ready"
    assert ev.winner["stream_id"] == 2
    assert ev.override["missing"] is True


def test_opponent_aliases_are_used():
    streams = _streams(
        "(Apple) (MLS) 020 |  LA Galaxy vs. Los Angeles (2026-09-26 19:25:00)"
    )
    cands = _rank(
        streams, team="LA Galaxy", aliases=(), opp="LAFC", opp_aliases=("Los Angeles",)
    )
    assert cands[0].kind == "fit"
    assert cands[0].opp_side_result == "alias:Los Angeles"
