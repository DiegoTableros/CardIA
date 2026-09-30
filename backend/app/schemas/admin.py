from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.schemas.auth import UserOut


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    user_email: str | None
    action: str
    detail: str
    duration_ms: int
    payload: dict[str, Any] | None


class ChatRunSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    user_email: str
    session_id: str
    question: str
    mode: str
    status: str
    duration_ms: int
    steps: int


class ActionCount(BaseModel):
    action: str
    count: int


class AdminOverview(BaseModel):
    users: int
    cards: int
    fees: int
    benefits: int
    events: int
    chat_runs: int
    recommendations: int
    by_action: list[ActionCount]
    llm_enabled: bool
    database: str
    data_generated_at: str | None


class AuditEventPage(BaseModel):
    total: int
    items: list[AuditEventOut]


class AdminUsers(BaseModel):
    items: list[UserOut]
