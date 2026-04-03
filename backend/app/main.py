"""Matcharr FastAPI application."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import ensure_data_dir, get_settings
from app.database import get_db, init_db
from app.routers import channels, dashboard, dispatcharr_proxy, espn_data, logs, profiles, routing_preview, run
from app.routers import settings as settings_router
from app.services.scheduler import schedule_match_cycle, scheduler
from app.settings_store import load_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_data_dir()
    await init_db()
    async with get_db() as db:
        s = await load_settings(db)
    schedule_match_cycle(s.scan_interval_minutes)
    logger.info("Matcharr started; scan interval %s min", s.scan_interval_minutes)
    yield
    if scheduler.running:
        scheduler.shutdown(wait=False)


def create_app() -> FastAPI:
    settings_obj = get_settings()
    app = FastAPI(title="Matcharr", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(settings_router.router, prefix="/api")
    app.include_router(profiles.router, prefix="/api")
    app.include_router(channels.router, prefix="/api")
    app.include_router(dashboard.router, prefix="/api")
    app.include_router(logs.router, prefix="/api")
    app.include_router(espn_data.router, prefix="/api")
    app.include_router(dispatcharr_proxy.router, prefix="/api")
    app.include_router(run.router, prefix="/api")
    app.include_router(routing_preview.router, prefix="/api")

    static_dir = settings_obj.static_dir
    if static_dir and Path(static_dir).is_dir():
        assets = Path(static_dir) / "assets"
        if assets.is_dir():
            app.mount("/assets", StaticFiles(directory=assets), name="assets")

        @app.get("/")
        async def index() -> FileResponse:
            return FileResponse(Path(static_dir) / "index.html")

        @app.get("/{full_path:path}")
        async def spa(full_path: str) -> FileResponse:
            if full_path.startswith("api"):
                raise HTTPException(404)
            idx = Path(static_dir) / "index.html"
            if idx.is_file():
                return FileResponse(idx)
            raise HTTPException(404)

    return app


app = create_app()
