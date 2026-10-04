from fastapi import APIRouter

from app.api.deps import AdminUser, CardsDep
from app.schemas.bi import BIResponse
from app.services.bi_service import build_bi

router = APIRouter(prefix="/bi", tags=["bi"])


@router.get("", response_model=BIResponse)
async def bi(cards: CardsDep, _: AdminUser) -> BIResponse:
    """BI de perfiles: solo administradores."""
    return build_bi(cards)
