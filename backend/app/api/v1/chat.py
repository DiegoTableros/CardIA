from typing import Annotated

from fastapi import APIRouter, Query

from app.agents import orchestrator
from app.api.deps import CardsDep, CurrentUser, SessionDep
from app.domain.glossary import SOURCE as GLOSSARY_SOURCE
from app.domain.glossary import featured_terms, load_terms
from app.schemas.chat import ChatPlanResponse, ChatRequest, ChatRunResponse, ChatTopicsResponse, TopicOut
from app.services import audit

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/topics", response_model=ChatTopicsResponse)
async def topics(_: CurrentUser) -> ChatTopicsResponse:
    """Temas para aprender (glosario oficial de CONDUSEF)."""
    return ChatTopicsResponse(
        featured=[
            TopicOut(term=t.term, category=t.category, question=f"¿Qué significa «{t.term}»?")
            for t in featured_terms()
        ],
        total_terms=len(load_terms()),
        source=GLOSSARY_SOURCE,
    )


@router.post("/plan", response_model=ChatPlanResponse)
async def plan(
    body: ChatRequest, cards: CardsDep, user: CurrentUser, session: SessionDep
) -> ChatPlanResponse:
    """Paso 1 (D8): devuelve el plan explicito de tool calls antes de ejecutar."""
    return await orchestrator.create_plan(session, cards, user.email, body.session_id, body.message)


@router.post("/runs/{run_id}/execute", response_model=ChatRunResponse)
async def execute(run_id: str, cards: CardsDep, user: CurrentUser, session: SessionDep) -> ChatRunResponse:
    """Paso 2: ejecuta el plan por niveles y genera la respuesta."""
    run = await orchestrator.get_run(session, run_id, user.email, user.role == "admin")
    result = await orchestrator.execute_run(session, cards, run)
    await audit.record(
        session,
        "chat",
        user.email,
        run.question[:200],
        duration_ms=result.duration_ms,
        payload={"run_id": run.id, "steps": [f"{s.agent}.{s.tool}" for s in result.plan]},
    )
    return result


@router.get("/runs/{run_id}", response_model=ChatRunResponse)
async def get_run(run_id: str, cards: CardsDep, user: CurrentUser, session: SessionDep) -> ChatRunResponse:
    run = await orchestrator.get_run(session, run_id, user.email, user.role == "admin")
    return orchestrator.run_response(run, cards)


@router.get("/runs", response_model=list[ChatRunResponse])
async def list_runs(
    cards: CardsDep,
    user: CurrentUser,
    session: SessionDep,
    session_id: Annotated[str | None, Query(max_length=60)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> list[ChatRunResponse]:
    runs = await orchestrator.list_runs(session, user.email, session_id, limit)
    return [orchestrator.run_response(r, cards) for r in runs]
