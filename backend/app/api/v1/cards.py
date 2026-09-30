from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CardsDep, CurrentUser
from app.schemas.cards import CardDetail, CardFacets, CardListResponse, CardQuery
from app.services.catalog import facets, filter_cards, get_card, to_detail, to_summary

router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("", response_model=CardListResponse)
async def list_cards(
    cards: CardsDep, _: CurrentUser, query: Annotated[CardQuery, Query()]
) -> CardListResponse:
    items = filter_cards(cards, query)
    return CardListResponse(total=len(items), items=[to_summary(c) for c in items])


@router.get("/facets", response_model=CardFacets)
async def card_facets(cards: CardsDep, _: CurrentUser) -> CardFacets:
    return facets(cards)


@router.get("/{card_id}", response_model=CardDetail)
async def card_detail(card_id: str, cards: CardsDep, _: CurrentUser) -> CardDetail:
    return to_detail(get_card(cards, card_id))
