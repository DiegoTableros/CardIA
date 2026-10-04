"""Configuracion de la aplicacion (variables de entorno / .env)."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = BACKEND_DIR.parent
DATA_DIR = BACKEND_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPO_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = "development"
    debug: bool = True
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:4200"]

    database_url: str = f"sqlite+aiosqlite:///{(DATA_DIR / 'cardia.db').as_posix()}"

    jwt_secret: str = "cardia-dev-secret-solo-local-cambia-esto-en-produccion"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 120

    seed_admin_email: str = "admin@cardia.local"
    seed_admin_password: str = "admin1234"
    seed_demo_email: str = "demo@cardia.local"
    seed_demo_password: str = "demo1234"

    openai_api_key: str = ""
    llm_model: str = "gpt-5.1"
    llm_model_fast: str = "gpt-5.1-mini"
    llm_reasoning_effort: str = "low"  # vacio para modelos sin razonamiento
    llm_max_plan_steps: int = 6
    llm_timeout_seconds: float = 45.0
    llm_history_turns: int = 4

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v: object) -> object:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def llm_enabled(self) -> bool:
        return bool(self.openai_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
