import time

from fastapi import APIRouter

from app.api.deps import CardsDep, CurrentUser, SessionDep
from app.schemas.recommend import RecommendResponse, UserProfileIn
from app.services import audit
from app.services.recommend_service import run_recommendation

router = APIRouter(prefix="/recommend", tags=["recommend"])


@router.post("", response_model=RecommendResponse)
async def recommend(
    body: UserProfileIn, cards: CardsDep, user: CurrentUser, session: SessionDep
) -> RecommendResponse:
    t0 = time.perf_counter()
    result = run_recommendation(body, cards)
    await audit.record(
        session,
        "recommend",
        user.email,
        f"Perfil {result.profile.label} · {len(result.recommendations)} tarjetas",
        duration_ms=int((time.perf_counter() - t0) * 1000),
        payload={
            "input": body.model_dump(),
            "profile": result.profile.key,
            "top": [r.card.id for r in result.recommendations],
            "model": result.model.version,
        },
    )
    return result
