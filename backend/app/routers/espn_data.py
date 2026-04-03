"""ESPN teams helper API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.services.espn import fetch_teams

router = APIRouter(prefix="/espn", tags=["espn"])


@router.get("/teams")
async def espn_teams(
    sport: str = Query(..., description="e.g. football, basketball, baseball, hockey"),
    league: str = Query(..., description="e.g. nfl, nba, mlb, nhl"),
) -> list[dict]:
    try:
        return await fetch_teams(sport, league)
    except Exception as e:
        raise HTTPException(502, f"ESPN error: {e}") from e
