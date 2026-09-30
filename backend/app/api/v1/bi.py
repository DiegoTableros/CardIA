from fastapi import APIRouter

from app.api.deps import CardsDep, CurrentUser
from app.schemas.bi import BIResponse
from app.services.bi_service import build_bi

router = APIRouter(prefix="/bi", tags=["bi"])


@router.get("", response_model=BIResponse)
async def bi(cards: CardsDep, _: CurrentUser) -> BIResponse:
    return build_bi(cards)
