"""Orquestador: plan (persistido antes de ejecutar, D8) -> ejecucion por niveles -> narrativa.

Modo `llm` si hay OPENAI_API_KEY y el plan del LLM es valido; si no, modo `rules` con el mismo contrato.
"""

import time
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import llm
from app.agents.narrator import narrate
from app.agents.planner import build_plan
from app.core.config import get_settings
from app.core.disclaimer import DISCLAIMER
from app.core.errors import DomainError, NotFoundError
from app.core.privacy import PRIVACY_NOTE, mask_personal_data
from app.db.models import ChatRun
from app.domain.models import CardRecord
from app.schemas.chat import ChatPlanResponse, ChatRunResponse, PlanStep
from app.services.catalog import get_card, to_summary
from app.tools.registry import run_tool

META_KEYS = ("_suggestions", "_cards", "_privacy")


def _levels(plan: list[PlanStep]) -> list[list[PlanStep]]:
    done: set[str] = set()
    pending = list(plan)
    levels: list[list[PlanStep]] = []
    while pending:
        ready = [s for s in pending if all(d in done for d in s.depends_on)]
        if not ready:
            raise DomainError("El plan tiene dependencias circulares")
        levels.append(ready)
        done |= {s.id for s in ready}
        pending = [s for s in pending if s.id not in done]
    return levels


async def _history(session: AsyncSession, user_email: str, session_id: str) -> list[tuple[str, str]]:
    n = get_settings().llm_history_turns
    rows = await session.scalars(
        select(ChatRun)
        .where(ChatRun.user_email == user_email, ChatRun.session_id == session_id, ChatRun.status == "ok")
        .order_by(ChatRun.created_at.desc())
        .limit(n)
    )
    return [(r.question, r.answer) for r in reversed(list(rows))]


async def create_plan(
    session: AsyncSession, cards: list[CardRecord], user_email: str, session_id: str, message: str
) -> ChatPlanResponse:
    clean, had_personal = mask_personal_data(message)
    rules_plan, suggestions = build_plan(clean, cards)
    plan: list[PlanStep] | None = None
    mode = "rules"
    if llm.get_client() is not None:
        plan = await llm.llm_plan(clean, await _history(session, user_email, session_id), cards)
        if plan is not None:
            mode = "llm"
    if plan is None:
        plan = rules_plan
    run = ChatRun(
        id=uuid.uuid4().hex,
        user_email=user_email,
        session_id=session_id,
        question=clean,
        plan=[s.model_dump() for s in plan] + [{"_suggestions": suggestions}, {"_privacy": had_personal}],
        mode=mode,
        status="planned",
        answer="",
    )
    session.add(run)
    await session.commit()
    return ChatPlanResponse(run_id=run.id, session_id=session_id, plan=plan, mode=mode)  # type: ignore[arg-type]


def _split(raw: list[dict[str, Any]]) -> tuple[list[PlanStep], dict[str, Any]]:
    steps: list[PlanStep] = []
    meta: dict[str, Any] = {"_suggestions": [], "_cards": [], "_privacy": False}
    for item in raw:
        key = next((k for k in META_KEYS if k in item), None)
        if key:
            meta[key] = item[key]
        else:
            steps.append(PlanStep.model_validate(item))
    return steps, meta


def _response(run: ChatRun, cards: list[CardRecord]) -> ChatRunResponse:
    steps, meta = _split(run.plan)
    shown = []
    for cid in meta["_cards"]:
        try:
            shown.append(to_summary(get_card(cards, cid)))
        except NotFoundError:
            continue
    return ChatRunResponse(
        run_id=run.id,
        session_id=run.session_id,
        question=run.question,
        plan=steps,
        answer=run.answer,
        mode=run.mode,  # type: ignore[arg-type]
        status=run.status,  # type: ignore[arg-type]
        cards=shown,
        suggestions=list(meta["_suggestions"]),
        disclaimer=DISCLAIMER,
        created_at=run.created_at,
        duration_ms=run.duration_ms,
    )


async def get_run(session: AsyncSession, run_id: str, user_email: str, is_admin: bool) -> ChatRun:
    run = await session.get(ChatRun, run_id)
    if run is None or (run.user_email != user_email and not is_admin):
        raise NotFoundError("No existe ese run de chat")
    return run


async def execute_run(session: AsyncSession, cards: list[CardRecord], run: ChatRun) -> ChatRunResponse:
    if run.status != "planned":
        return _response(run, cards)
    started = time.perf_counter()
    plan, meta = _split(run.plan)
    results: dict[str, dict[str, Any]] = {}
    touched: list[str] = []
    failed: set[str] = set()
    for level in _levels(plan):
        for step in level:
            if any(d in failed for d in step.depends_on):
                step.status = "skipped"
                step.summary = "Omitido: falló un paso previo"
                failed.add(step.id)
                continue
            t0 = time.perf_counter()
            try:
                res = run_tool(step.tool, cards, step.args)
                results[step.id] = res.data
                step.status = "ok"
                step.summary = res.summary
                touched += [c.id for c in res.cards if c.id not in touched]
            except (DomainError, KeyError, ValueError, TypeError) as exc:
                step.status = "error"
                step.summary = str(exc)[:200]
                failed.add(step.id)
            step.duration_ms = int((time.perf_counter() - t0) * 1000)

    answer: str | None = None
    if run.mode == "llm":
        history = await _history(session, run.user_email, run.session_id)
        answer = await llm.llm_narrate(run.question, history, plan, results)
    if answer is None:
        answer = narrate(plan, results) if plan else _empty_answer()
    if meta["_privacy"]:
        answer = f"{PRIVACY_NOTE}\n\n{answer}"

    run.answer = answer
    run.status = "error" if plan and all(s.status != "ok" for s in plan) else "ok"
    run.plan = [s.model_dump() for s in plan] + [
        {"_suggestions": meta["_suggestions"]},
        {"_privacy": meta["_privacy"]},
        {"_cards": touched[:6]},
    ]
    run.duration_ms = int((time.perf_counter() - started) * 1000)
    await session.commit()
    return _response(run, cards)


def _empty_answer() -> str:
    return (
        "¡Hola! Puedo ayudarte con dudas sobre tarjetas de crédito: cómo funcionan, qué cobra cada una, "
        "qué significan conceptos como el pago mínimo o el CAT, y cómo interpretar tu perfil."
    )


async def list_runs(
    session: AsyncSession, user_email: str, session_id: str | None, limit: int
) -> list[ChatRun]:
    stmt = select(ChatRun).where(ChatRun.user_email == user_email)
    if session_id:
        stmt = stmt.where(ChatRun.session_id == session_id)
    rows = await session.scalars(stmt.order_by(ChatRun.created_at.desc()).limit(limit))
    return list(rows)


def run_response(run: ChatRun, cards: list[CardRecord]) -> ChatRunResponse:
    return _response(run, cards)
