"""League stream name pattern engine.

Mirrored client-side in frontend/src/lib/patterns.ts; keep the two in sync.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone, tzinfo

# Placeholder -> regex fragment (non-greedy text capture where needed)
PLACEHOLDERS: dict[str, str] = {
    "n": r"(\d+)",
    "away": r"(.+?)",
    "home": r"(.+?)",
    "time": r"(.+?)",
    "league": r"(.+?)",
}

_WS_RUN = re.compile(r"\s+")


@dataclass
class CompiledPattern:
    pattern: str
    regex: re.Pattern[str]
    field_order: list[str]


def _literal_regex(text: str) -> str:
    """Escape literal text; any whitespace run matches one or more whitespace chars."""
    parts = _WS_RUN.split(text)
    return r"\s+".join(re.escape(p) for p in parts)


def compile_league_pattern(user_pattern: str) -> CompiledPattern:
    """
    Convert a template like 'MLB {n} | {away} vs {home} | {time}' into a regex.
    Literal braces must be doubled as {{ and }}.
    """
    source = user_pattern.strip()
    field_order: list[str] = []
    out: list[str] = []
    literal: list[str] = []
    i = 0
    n = len(source)

    def flush() -> None:
        if literal:
            out.append(_literal_regex("".join(literal)))
            literal.clear()

    while i < n:
        if source[i : i + 2] == "{{":
            literal.append("{")
            i += 2
            continue
        if source[i : i + 2] == "}}":
            literal.append("}")
            i += 2
            continue
        if source[i] == "{":
            j = source.find("}", i + 1)
            if j == -1:
                raise ValueError("Unclosed '{' in pattern")
            name = source[i + 1 : j].strip()
            if name not in PLACEHOLDERS:
                raise ValueError(f"Unknown placeholder '{{{name}}}'")
            flush()
            field_order.append(name)
            out.append(PLACEHOLDERS[name])
            i = j + 1
            continue
        literal.append(source[i])
        i += 1
    flush()
    regex = re.compile("^" + "".join(out) + "$", re.IGNORECASE | re.DOTALL)
    return CompiledPattern(pattern=user_pattern, regex=regex, field_order=field_order)


Span = tuple[int, int, str]


def match_stream_spans(
    compiled: CompiledPattern, stream_name: str
) -> tuple[bool, dict[str, str], list[Span]]:
    """Match a title; return captured groups and their (start, end, field) ranges.

    Ranges index into ``stream_name.strip()`` and exclude surrounding whitespace.
    """
    title = stream_name.strip()
    m = compiled.regex.match(title)
    if not m:
        return False, {}, []
    groups: dict[str, str] = {}
    spans: list[Span] = []
    for idx, name in enumerate(compiled.field_order):
        gi = idx + 1
        if gi > len(m.groups()) or m.group(gi) is None:
            continue
        raw = m.group(gi)
        groups[name] = raw.strip()
        start, end = m.span(gi)
        start += len(raw) - len(raw.lstrip())
        end -= len(raw) - len(raw.rstrip())
        if end > start:
            spans.append((start, end, name))
    return True, groups, spans


def match_stream_name(
    compiled: CompiledPattern, stream_name: str
) -> tuple[bool, dict[str, str]]:
    ok, groups, _ = match_stream_spans(compiled, stream_name)
    return ok, groups


def normalize_team_name(name: str) -> str:
    return " ".join(name.lower().split())


def _contains_words(haystack: str, needle: str) -> bool:
    """True when ``needle`` appears in ``haystack`` on word boundaries."""
    if not needle or not haystack:
        return False
    return re.search(r"(?<!\w)" + re.escape(needle) + r"(?!\w)", haystack) is not None


def match_how(
    official: str,
    text: str,
    aliases: list[str] | None = None,
) -> str | None:
    """Explain how a captured title fragment refers to an ESPN team.

    Returns ``"matches"`` (same name), ``"part"`` (one name contains the other),
    ``"alias:<alias>"`` (via a user alias) or ``None`` when it isn't this team.
    """
    a = normalize_team_name(official)
    b = normalize_team_name(text or "")
    if not b:
        return None
    if a == b:
        return "matches"
    if _contains_words(a, b) or _contains_words(b, a):
        return "part"
    for alias in aliases or []:
        al = normalize_team_name(alias)
        if not al:
            continue
        if al == b or _contains_words(al, b) or _contains_words(b, al):
            return f"alias:{alias}"
    return None


def teams_match(
    a: str,
    b: str,
    extra_aliases: list[str] | None = None,
) -> bool:
    return match_how(a, b, extra_aliases) is not None


# ── Stream time stamps ──────────────────────────────────────────────────────

# A stamp further than this from ESPN's start time belongs to a different game
# (e.g. the next day of a series).
STAMP_WINDOW_MINUTES = 8 * 60

_ISO_STAMP = re.compile(
    r"(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?"
)
_US_DATE = re.compile(r"(?<![\d/])(\d{1,2})/(\d{1,2})(?:/(\d{2}|\d{4}))?(?![\d/])")


@dataclass
class StreamStamp:
    day: date
    hour: int | None = None
    minute: int | None = None


def parse_stream_stamp(
    text: str, default_year: int | None = None
) -> StreamStamp | None:
    """Find the first date (optionally with a time) in a stream title fragment."""
    if not text:
        return None
    m = _ISO_STAMP.search(text)
    if m:
        try:
            d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            d = None
        if d:
            if m.group(4) is not None:
                hh, mm = int(m.group(4)), int(m.group(5))
                if hh < 24 and mm < 60:
                    return StreamStamp(d, hh, mm)
            return StreamStamp(d)
    m = _US_DATE.search(text)
    if m:
        year = m.group(3)
        if year:
            y = int(year) + (2000 if len(year) == 2 else 0)
        else:
            y = default_year or datetime.now(timezone.utc).year
        try:
            return StreamStamp(date(y, int(m.group(1)), int(m.group(2))))
        except ValueError:
            return None
    return None


def stamp_delta_minutes(
    stamp: StreamStamp, game_time_utc: datetime, local_tz: tzinfo
) -> int:
    """Minutes between a stream stamp and the game start.

    Providers stamp titles in either UTC or local time, so both readings are tried
    and the closer one wins. Date-only stamps compare calendar days.
    """
    gt = (
        game_time_utc
        if game_time_utc.tzinfo
        else game_time_utc.replace(tzinfo=timezone.utc)
    )
    if stamp.hour is None:
        days = min(
            abs((stamp.day - gt.astimezone(local_tz).date()).days),
            abs((stamp.day - gt.astimezone(timezone.utc).date()).days),
        )
        return days * 24 * 60
    naive = datetime(
        stamp.day.year, stamp.day.month, stamp.day.day, stamp.hour, stamp.minute or 0
    )
    readings = [naive.replace(tzinfo=timezone.utc), naive.replace(tzinfo=local_tz)]
    return min(int(abs((r - gt) / timedelta(minutes=1))) for r in readings)
