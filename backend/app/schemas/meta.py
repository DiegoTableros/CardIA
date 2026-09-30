from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    version: str
    environment: str
    llm_enabled: bool
    cards_loaded: int


class DisclaimerResponse(BaseModel):
    disclaimer: str
