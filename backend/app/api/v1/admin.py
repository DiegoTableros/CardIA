import json
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.api.deps import AdminUser, SessionDep
from app.core.config import get_settings
from app.db.models import AuditEvent, Benefit, Card, ChatRun, Fee, User
from app.db.seed import CARDS_JSON
from app.schemas.admin import (
    ActionCount,
    AdminOverview,
    AdminUsers,
    AuditEventOut,
    AuditEventPage,
    ChatRunSummary,
)
from app.schemas.auth import UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


async def _count(session: SessionDep, model: type) -> int:
    return int(await session.scalar(select(func.count()).select_from(model)) or 0)


@router.get("/overview", response_model=AdminOverview)
async def overview(_: AdminUser, session: SessionDep) -> AdminOverview:
    rows = await session.execute(
        select(AuditEvent.action, func.count()).group_by(AuditEvent.action).order_by(func.count().desc())
    )
    generated = None
    if CARDS_JSON.exists():
        generated = json.loads(CARDS_JSON.read_text(encoding="utf-8")).get("generated_at")
    url = get_settings().database_url
    return AdminOverview(
        users=await _count(session, User),
        cards=await _count(session, Card),
        fees=await _count(session, Fee),
        benefits=await _count(session, Benefit),
        events=await _count(session, AuditEvent),
        chat_runs=await _count(session, ChatRun),
        recommendations=int(
            await session.scalar(select(func.count()).where(AuditEvent.action == "recommend")) or 0
        ),
        by_action=[ActionCount(action=a, count=c) for a, c in rows.all()],
        llm_enabled=get_settings().llm_enabled,
        database=url.split("///")[0] + "///…" + url.rsplit("/", 1)[-1],
        data_generated_at=generated,
    )


@router.get("/events", response_model=AuditEventPage)
async def events(
    _: AdminUser,
    session: SessionDep,
    action: Annotated[str | None, Query(max_length=40)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AuditEventPage:
    base = select(AuditEvent)
    count = select(func.count()).select_from(AuditEvent)
    if action:
        base = base.where(AuditEvent.action == action)
        count = count.where(AuditEvent.action == action)
    rows = await session.scalars(base.order_by(AuditEvent.id.desc()).offset(offset).limit(limit))
    return AuditEventPage(
        total=int(await session.scalar(count) or 0),
        items=[AuditEventOut.model_validate(r) for r in rows],
    )


@router.get("/chat-runs", response_model=list[ChatRunSummary])
async def chat_runs(
    _: AdminUser, session: SessionDep, limit: Annotated[int, Query(ge=1, le=200)] = 50
) -> list[ChatRunSummary]:
    rows = await session.scalars(select(ChatRun).order_by(ChatRun.created_at.desc()).limit(limit))
    return [
        ChatRunSummary(
            id=r.id,
            created_at=r.created_at,
            user_email=r.user_email,
            session_id=r.session_id,
            question=r.question,
            mode=r.mode,
            status=r.status,
            duration_ms=r.duration_ms,
            steps=sum(1 for s in r.plan if "tool" in s),
        )
        for r in rows
    ]


@router.get("/users", response_model=AdminUsers)
async def users(_: AdminUser, session: SessionDep) -> AdminUsers:
    rows = await session.scalars(select(User).order_by(User.id))
    return AdminUsers(items=[UserOut.model_validate(u) for u in rows])
