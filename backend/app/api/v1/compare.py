from fastapi import APIRouter

from app.api.deps import CardsDep, CurrentUser, SessionDep
from app.schemas.compare import CompareRequest, CompareResponse
from app.services import audit
from app.services.compare_service import compare

router = APIRouter(prefix="/compare", tags=["compare"])


@router.post("", response_model=CompareResponse)
async def compare_cards(
    body: CompareRequest, cards: CardsDep, user: CurrentUser, session: SessionDep
) -> CompareResponse:
    result = compare(cards, body.card_ids)
    await audit.record(
        session,
        "compare",
        user.email,
        ", ".join(c.name for c in result.cards),
        payload={"ids": body.card_ids},
    )
    return result
