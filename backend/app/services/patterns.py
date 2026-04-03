"""League stream name pattern engine."""

from __future__ import annotations

import re
from dataclasses import dataclass

# Placeholder -> regex fragment (non-greedy text capture where needed)
PLACEHOLDERS: dict[str, str] = {
    "n": r"(\d+)",
    "away": r"(.+?)",
    "home": r"(.+?)",
    "time": r"(.+?)",
    "league": r"(.+?)",
}


@dataclass
class CompiledPattern:
    pattern: str
    regex: re.Pattern[str]
    field_order: list[str]


def compile_league_pattern(user_pattern: str) -> CompiledPattern:
    """
    Convert a template like 'MLB {n} | {away} vs {home} | {time}' into a regex.
    Literal braces must be doubled as {{ and }}.
    """
    field_order: list[str] = []
    out: list[str] = []
    i = 0
    n = len(user_pattern)
    while i < n:
        if user_pattern[i : i + 2] == "{{":
            out.append(re.escape("{"))
            i += 2
            continue
        if user_pattern[i : i + 2] == "}}":
            out.append(re.escape("}"))
            i += 2
            continue
        if user_pattern[i] == "{":
            j = user_pattern.find("}", i + 1)
            if j == -1:
                raise ValueError("Unclosed '{' in pattern")
            name = user_pattern[i + 1 : j].strip()
            if name not in PLACEHOLDERS:
                raise ValueError(f"Unknown placeholder '{{{name}}}'")
            field_order.append(name)
            out.append(PLACEHOLDERS[name])
            i = j + 1
            continue
        # literal
        start = i
        while i < n and user_pattern[i] != "{":
            i += 1
        out.append(re.escape(user_pattern[start:i]))
    regex = re.compile("^" + "".join(out) + "$", re.IGNORECASE | re.DOTALL)
    return CompiledPattern(pattern=user_pattern, regex=regex, field_order=field_order)


def match_stream_name(compiled: CompiledPattern, stream_name: str) -> tuple[bool, dict[str, str]]:
    m = compiled.regex.match(stream_name.strip())
    if not m:
        return False, {}
    groups: dict[str, str] = {}
    for idx, name in enumerate(compiled.field_order):
        if idx < len(m.groups()):
            groups[name] = m.group(idx + 1).strip()
    return True, groups


def normalize_team_name(name: str) -> str:
    return " ".join(name.lower().split())


def teams_match(
    a: str,
    b: str,
    extra_aliases: list[str] | None = None,
) -> bool:
    na = normalize_team_name(a)
    nb = normalize_team_name(b)
    if na == nb:
        return True
    if na in nb or nb in na:
        return True
    if extra_aliases:
        for alias in extra_aliases:
            al = normalize_team_name(alias)
            if al == na or al == nb or al in na or na in al or al in nb or nb in al:
                return True
    return False
