"""Application configuration."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MA_", extra="ignore")

    data_dir: Path = Path("/app/data")
    database_name: str = "matcharr.db"
    host: str = "0.0.0.0"
    port: int = 8400
    static_dir: Path | None = None  # e.g. /app/static in Docker when UI is baked in

    @property
    def database_path(self) -> Path:
        return self.data_dir / self.database_name


@lru_cache
def get_settings() -> Settings:
    return Settings()


def ensure_data_dir() -> Path:
    s = get_settings()
    s.data_dir.mkdir(parents=True, exist_ok=True)
    return s.data_dir
