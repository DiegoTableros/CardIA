from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.cards import CardSummary

AgentName = Literal["FundamentalsAgent", "ComisionesAgent", "EducativeAgent", "PerfilAgent"]
StepStatus = Literal["pending", "running", "ok", "error", "skipped"]


class PlanStep(BaseModel):
    id: str
    agent: AgentName
    tool: str
    args: dict[str, Any]
    depends_on: list[str] = Field(default_factory=list)
    rationale: str
    status: StepStatus = "pending"
    summary: str = ""
    duration_ms: int = 0


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    session_id: str = Field(min_length=1, max_length=60)


class ChatPlanResponse(BaseModel):
    run_id: str
    session_id: str
    plan: list[PlanStep]
    mode: Literal["rules", "llm"]


class TopicOut(BaseModel):
    term: str
    category: str
    question: str


class ChatTopicsResponse(BaseModel):
    featured: list[TopicOut]
    total_terms: int
    source: str


class ChatRunResponse(BaseModel):
    run_id: str
    session_id: str
    question: str
    plan: list[PlanStep]
    answer: str
    mode: Literal["rules", "llm"]
    status: Literal["planned", "ok", "error"]
    cards: list[CardSummary]
    suggestions: list[str]
    disclaimer: str
    created_at: datetime
    duration_ms: int
