"""Rank Dispatcharr streams for one team's game and pick the one to route."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, tzinfo
from typing import Any, Literal

from app.services.patterns import (
    STAMP_WINDOW_MINUTES,
    CompiledPattern,
    Span,
    match_how,
    match_stream_spans,
    parse_stream_stamp,
    stamp_delta_minutes,
)

CandidateKind = Literal["fit", "skipped", "rejected"]
GameStatus = Literal["override", "ready", "conflict", "near_miss", "not_listed"]
RankReason = Literal["only_fit", "closest_time", "listed_first"]


@dataclass
class Candidate:
    stream_id: int
    name: str
    kind: CandidateKind
    groups: dict[str, str]
    spans: list[Span]
    our_side: Literal["home", "away"]
    our_side_result: str | None
    opp_side_result: str | None
    skip_term: str | None
    time_delta_minutes: int | None
    order: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "stream_id": self.stream_id,
            "name": self.name,
            "kind": self.kind,
            "groups": self.groups,
            "spans": [list(s) for s in self.spans],
            "our_side": self.our_side,
            "our_side_result": self.our_side_result,
            "opp_side_result": self.opp_side_result,
            "skip_term": self.skip_term,
            "time_delta_minutes": self.time_delta_minutes,
        }


@dataclass
class GameEvaluation:
    candidates: list[Candidate] = field(default_factory=list)
    fits: list[Candidate] = field(default_factory=list)
    winner: dict[str, Any] | None = None
    status: GameStatus = "not_listed"
    rank_reason: RankReason | None = None
    override: dict[str, Any] | None = None


def find_skip_term(name: str, terms: list[str]) -> str | None:
    lower = name.lower()
    for t in terms:
        if t.strip() and t.strip().lower() in lower:
            return t
    return None


def _stream_id(stream: dict[str, Any]) -> int | None:
    try:
        return int(stream["id"])
    except (KeyError, TypeError, ValueError):
        return None


def rank_candidates(
    compiled: CompiledPattern,
    streams: list[dict[str, Any]],
    *,
    team_name: str,
    team_aliases: list[str],
    opp_name: str,
    opp_aliases: list[str],
    is_home: bool,
    skip_terms: list[str],
    game_time: datetime | None,
    local_tz: tzinfo,
) -> list[Candidate]:
    """Every stream relevant to the game, ordered fits → rejected → skipped.

    A stream is relevant when it fits the pattern and at least one side names a
    team in this game. Streams stamped with a date/time for a different game are
    dropped. Fits are ranked by stamp closeness to ESPN's start, then Dispatcharr
    order.
    """
    our_side: Literal["home", "away"] = "home" if is_home else "away"
    opp_side = "away" if is_home else "home"
    out: list[Candidate] = []
    for order, s in enumerate(streams):
        sid = _stream_id(s)
        if sid is None:
            continue
        name = str(s.get("name", "")).strip()
        ok, groups, spans = match_stream_spans(compiled, name)
        if not ok:
            continue
        ours = match_how(team_name, groups.get(our_side, ""), team_aliases)
        theirs = match_how(opp_name, groups.get(opp_side, ""), opp_aliases)
        if not ours and not theirs:
            continue
        delta: int | None = None
        if game_time is not None:
            stamp = parse_stream_stamp(
                groups.get("time") or name, default_year=game_time.year
            )
            if stamp is not None:
                delta = stamp_delta_minutes(stamp, game_time, local_tz)
                if delta > STAMP_WINDOW_MINUTES:
                    continue
        skip = find_skip_term(name, skip_terms)
        if ours and theirs:
            kind: CandidateKind = "skipped" if skip else "fit"
        else:
            kind = "rejected"
        out.append(
            Candidate(
                stream_id=sid,
                name=name,
                kind=kind,
                groups=groups,
                spans=spans,
                our_side=our_side,
                our_side_result=ours,
                opp_side_result=theirs,
                skip_term=skip,
                time_delta_minutes=delta,
                order=order,
            )
        )

    fits = sorted(
        (c for c in out if c.kind == "fit"),
        key=lambda c: (
            c.time_delta_minutes is None,
            c.time_delta_minutes or 0,
            c.order,
        ),
    )
    rest = sorted(
        (c for c in out if c.kind != "fit"),
        key=lambda c: (c.kind == "skipped", c.order),
    )
    return fits + rest


def _winner_dict(stream_id: int, name: str, groups: dict[str, str]) -> dict[str, Any]:
    return {"stream_id": stream_id, "name": name, "n": groups.get("n")}


def summarize(
    candidates: list[Candidate],
    streams: list[dict[str, Any]],
    override_row: dict[str, Any] | None,
) -> GameEvaluation:
    """Pick the stream to route: an active override first, else the top fit."""
    fits = [c for c in candidates if c.kind == "fit"]
    ev = GameEvaluation(candidates=candidates, fits=fits)

    if override_row is not None:
        oid = int(override_row["stream_id"])
        listed = next((s for s in streams if _stream_id(s) == oid), None)
        ev.override = {
            "stream_id": oid,
            "stream_name": str(override_row.get("stream_name") or ""),
            "created_at": override_row.get("created_at"),
            "missing": listed is None,
        }
        if listed is not None:
            cand = next((c for c in candidates if c.stream_id == oid), None)
            ev.winner = _winner_dict(
                oid,
                cand.name if cand else str(listed.get("name", "")),
                cand.groups if cand else {},
            )
            ev.status = "override"
            return ev

    if fits:
        top = fits[0]
        ev.winner = _winner_dict(top.stream_id, top.name, top.groups)
        if len(fits) == 1:
            ev.status, ev.rank_reason = "ready", "only_fit"
        else:
            ev.status = "conflict"
            second = fits[1]
            closer = top.time_delta_minutes is not None and (
                second.time_delta_minutes is None
                or top.time_delta_minutes < second.time_delta_minutes
            )
            ev.rank_reason = "closest_time" if closer else "listed_first"
    elif candidates:
        ev.status = "near_miss"
    return ev


def alias_suggestions(candidates: list[Candidate], existing: list[str]) -> list[str]:
    """Names in our side of titles where only the opponent matched."""
    have = {a.strip().lower() for a in existing}
    out: list[str] = []
    for c in candidates:
        text = c.groups.get(c.our_side, "").strip()
        if (
            c.kind == "rejected"
            and not c.our_side_result
            and c.opp_side_result
            and text
            and text.lower() not in have
            and text not in out
        ):
            out.append(text)
    return out
