from fastapi import APIRouter

from app.api.deps import CardsDep
from app.core.config import get_settings
from app.core.disclaimer import DISCLAIMER
from app.schemas.meta import DisclaimerResponse, HealthResponse

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/health", response_model=HealthResponse)
async def health(cards: CardsDep) -> HealthResponse:
    s = get_settings()
    return HealthResponse(
        status="ok" if cards else "degraded",
        version="0.1.0",
        environment=s.environment,
        llm_enabled=s.llm_enabled,
        cards_loaded=len(cards),
    )


@router.get("/disclaimer", response_model=DisclaimerResponse)
async def disclaimer() -> DisclaimerResponse:
    return DisclaimerResponse(disclaimer=DISCLAIMER)
