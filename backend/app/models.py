"""Pydantic models for API."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

DEFAULT_EXCLUDE_TERMS = ["(Spanish)", "(Alt)", "(FR)"]


class AppSettings(BaseModel):
    dispatcharr_url: str = ""
    dispatcharr_token: str = ""
    timezone: str = "America/New_York"
    scan_interval_minutes: int = Field(default=5, ge=1, le=1440)
    pre_game_minutes: int = Field(default=30, ge=0, le=24 * 60)
    schedule_refresh_hours: int = Field(default=6, ge=1, le=168)
    schedule_lookahead_days: int = Field(default=3, ge=1, le=14)
    routing_stop_mode: Literal["final", "fixed"] = "final"
    routing_stop_hours: int = Field(default=4, ge=1, le=12)
    after_game_action: Literal["leave", "restore", "clear"] = "leave"
    tie_break: Literal["closest_time", "first_listed", "prefer_account"] = (
        "closest_time"
    )
    preferred_m3u_account_id: int | None = None
    default_exclude_terms: list[str] = Field(
        default_factory=lambda: list(DEFAULT_EXCLUDE_TERMS)
    )


class LeagueProfileCreate(BaseModel):
    name: str
    stream_pattern: str
    stream_name_filter: str = ""
    espn_sport: str
    espn_league: str
    enabled: bool = True
    # Omitted: start from AppSettings.default_exclude_terms.
    exclude_terms: list[str] | None = None
    m3u_account_id: int | None = None
    channel_group: str = ""


class LeagueProfileUpdate(BaseModel):
    name: str | None = None
    stream_pattern: str | None = None
    stream_name_filter: str | None = None
    espn_sport: str | None = None
    espn_league: str | None = None
    enabled: bool | None = None
    exclude_terms: list[str] | None = None
    # An explicit null clears the account filter (checked via model_fields_set).
    m3u_account_id: int | None = None
    channel_group: str | None = None


class LeagueProfileOut(BaseModel):
    id: int
    name: str
    stream_pattern: str
    stream_name_filter: str
    espn_sport: str
    espn_league: str
    enabled: bool
    exclude_terms: list[str] = Field(default_factory=list)
    m3u_account_id: int | None = None
    channel_group: str = ""
    created_at: str
    team_channel_count: int = 0


class TeamChannelCreate(BaseModel):
    team_name: str
    espn_team_id: str
    espn_team_abbr: str = ""
    league_profile_id: int
    dispatcharr_channel_id: int
    enabled: bool = True
    aliases: list[str] = Field(default_factory=list)


class TeamChannelUpdate(BaseModel):
    team_name: str | None = None
    espn_team_id: str | None = None
    espn_team_abbr: str | None = None
    league_profile_id: int | None = None
    dispatcharr_channel_id: int | None = None
    enabled: bool | None = None
    aliases: list[str] | None = None


class TeamChannelOut(BaseModel):
    id: int
    team_name: str
    espn_team_id: str
    espn_team_abbr: str
    league_profile_id: int
    dispatcharr_channel_id: int
    enabled: bool
    aliases: list[str]
    created_at: str


class StreamOverrideIn(BaseModel):
    stream_id: int
    stream_name: str = ""


class PatternTestRequest(BaseModel):
    pattern: str
    stream_name: str


class PatternTestResponse(BaseModel):
    matched: bool
    groups: dict[str, str] = Field(default_factory=dict)
    error: str | None = None


class DispatcharrTestRequest(BaseModel):
    dispatcharr_url: str | None = None
    dispatcharr_token: str | None = None


class DispatcharrTestResponse(BaseModel):
    ok: bool
    message: str
    detail: Any | None = None


class DashboardOut(BaseModel):
    dispatcharr_configured: bool
    next_scan_at: str | None
    tracked_teams: int
    upcoming_games: list[dict[str, Any]]
    upcoming_games_extra_by_league: list[dict[str, Any]]
    recent_switches: list[dict[str, Any]]
    health: dict[str, Any]
    timeline: list[dict[str, Any]] = Field(default_factory=list)
    tracked_summary: dict[str, int] = Field(default_factory=dict)
    attention: list[dict[str, Any]] = Field(default_factory=list)


SwitchOutcome = Literal["switched", "no_match", "failed", "override"]


class SwitchLogEntry(BaseModel):
    id: int
    team_channel_id: int
    team_name: str | None = None
    league_profile_id: int | None = None
    from_stream_name: str | None
    to_stream_name: str | None
    to_stream_id: int | None
    reason: str
    outcome: SwitchOutcome
    switched_at: str


class LogPage(BaseModel):
    items: list[SwitchLogEntry]
    total: int
    counts_by_outcome: dict[str, int]


class HealthOut(BaseModel):
    database: bool = True
    dispatcharr_reachable: bool | None = None
    dispatcharr_latency_ms: int | None = None
    dispatcharr_checked_at: str | None = None
    last_schedule_refresh: str | None = None
    last_scan_at: str | None = None
    next_scan_at: str | None = None
    scheduler_running: bool = False


class ManualRunResponse(BaseModel):
    ok: bool
    message: str
