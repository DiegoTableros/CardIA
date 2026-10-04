"""Catalogo de tarjetas en memoria (datos estaticos: se carga una vez desde SQLite)."""

import asyncio
import difflib

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.disclaimer import DISCLAIMER
from app.core.errors import NotFoundError
from app.db.models import Card
from app.domain.models import BenefitRecord, CardRecord, FeeRecord
from app.domain.normalize import strip_accents
from app.ml.profiles import PROFILES, assign_card_profile
from app.schemas.cards import (
    BenefitOut,
    CardDetail,
    CardFacets,
    CardQuery,
    CardSummary,
    FeeCounts,
    FeeOut,
    ProfileTag,
    RangeOut,
    Requirements,
)

_cache: list[CardRecord] | None = None
_lock = asyncio.Lock()


def _to_record(c: Card) -> CardRecord:
    return CardRecord(
        id=c.id,
        name=c.name,
        institution=c.institution,
        card_class=c.card_class,
        cat=c.cat,
        annual_fee=c.annual_fee,
        interest_rate=c.interest_rate,
        credit_line_min=c.credit_line_min,
        age_min=c.age_min,
        age_max=c.age_max,
        score_min=c.score_min,
        work_seniority_min=c.work_seniority_min,
        residence_seniority_min=c.residence_seniority_min,
        monthly_income_min=c.monthly_income_min,
        institution_url=c.institution_url,
        image_url=c.image_url,
        image_orientation=c.image_orientation,
        cluster=c.cluster,
        features=c.features or {},
        fees=[FeeRecord(f.concept, f.amount, f.denomination, f.fee_type) for f in c.fees],
        benefits=[BenefitRecord(b.benefit_type, b.text) for b in c.benefits],
    )


async def load_cards(session: AsyncSession) -> list[CardRecord]:
    global _cache
    if _cache is not None:
        return _cache
    async with _lock:
        if _cache is None:
            rows = await session.scalars(
                select(Card).options(selectinload(Card.fees), selectinload(Card.benefits)).order_by(Card.id)
            )
            _cache = [_to_record(c) for c in rows]
    return _cache


def clear_cache() -> None:
    global _cache
    _cache = None


def get_card(cards: list[CardRecord], card_id: str) -> CardRecord:
    for c in cards:
        if c.id == card_id:
            return c
    raise NotFoundError(f"No existe la tarjeta {card_id}")


def _fold(text: str) -> str:
    return strip_accents(text).lower()


def find_cards_in_text(cards: list[CardRecord], text: str, limit: int = 3) -> list[CardRecord]:
    """Detecta tarjetas mencionadas por nombre (coincidencia exacta o difusa)."""
    folded = _fold(text)
    exact = [c for c in cards if _fold(c.name) in folded]
    exact.sort(key=lambda c: -len(c.name))
    picked: list[CardRecord] = []
    for c in exact:
        if not any(_fold(c.name) in _fold(p.name) for p in picked):
            picked.append(c)
    if picked:
        return picked[:limit]
    names = {_fold(c.name): c for c in cards}
    words = folded.split()
    candidates: list[CardRecord] = []
    for n in (2, 3):
        for i in range(len(words) - n + 1):
            chunk = " ".join(words[i : i + n])
            for m in difflib.get_close_matches(chunk, names.keys(), n=1, cutoff=0.82):
                if names[m] not in candidates:
                    candidates.append(names[m])
    return candidates[:limit]


def profile_tag(card: CardRecord) -> ProfileTag:
    p = assign_card_profile(card)
    return ProfileTag(id=p.id, key=p.key, label=p.label, color=p.color, icon=p.icon, tagline=p.tagline)


def to_summary(card: CardRecord) -> CardSummary:
    return CardSummary(
        id=card.id,
        name=card.name,
        institution=card.institution,
        card_class=card.card_class,
        cat=card.cat,
        annual_fee=card.annual_fee,
        interest_rate=card.interest_rate,
        credit_line_min=card.credit_line_min,
        monthly_income_min=card.monthly_income_min,
        image_url=card.image_url,
        image_orientation=card.image_orientation,
        benefit_types=card.benefit_types,
        fee_counts=FeeCounts(**card.fee_counts()),
        profile=profile_tag(card),
    )


def to_detail(card: CardRecord) -> CardDetail:
    return CardDetail(
        **to_summary(card).model_dump(),
        institution_url=card.institution_url,
        requirements=Requirements(
            age_min=card.age_min,
            age_max=card.age_max,
            score_min=card.score_min,
            work_seniority_min=card.work_seniority_min,
            residence_seniority_min=card.residence_seniority_min,
            monthly_income_min=card.monthly_income_min,
        ),
        fees=[FeeOut(**_slots(f)) for f in card.fees],
        benefits=[BenefitOut(**_slots(b)) for b in card.benefits],
        disclaimer=DISCLAIMER,
    )


def _slots(obj: object) -> dict[str, object]:
    return {k: getattr(obj, k) for k in obj.__slots__}  # type: ignore[attr-defined]


_SORTS = {
    "name": lambda c: c.name.lower(),
    "annual_fee": lambda c: (c.annual_fee is None, c.annual_fee or 0),
    "cat": lambda c: (c.cat is None, c.cat or 0),
    "interest_rate": lambda c: (c.interest_rate is None, c.interest_rate or 0),
    "credit_line_min": lambda c: (c.credit_line_min is None, c.credit_line_min or 0),
    "benefits": lambda c: -len(c.benefit_types),
}


def filter_cards(cards: list[CardRecord], q: CardQuery) -> list[CardRecord]:
    out = cards
    if q.q:
        needle = _fold(q.q)
        out = [c for c in out if needle in _fold(c.name) or needle in _fold(c.institution)]
    if q.institution:
        out = [c for c in out if c.institution == q.institution]
    if q.card_class:
        out = [c for c in out if c.card_class == q.card_class]
    if q.benefit_type:
        out = [c for c in out if q.benefit_type in c.benefit_types]
    if q.profile_id is not None:
        out = [c for c in out if assign_card_profile(c).id == q.profile_id]
    if q.no_annual_fee:
        out = [c for c in out if (c.annual_fee or 0) == 0]
    if q.max_annual_fee is not None:
        out = [c for c in out if (c.annual_fee or 0) <= q.max_annual_fee]
    return sorted(out, key=_SORTS[q.sort])[: q.limit]


def _range(values: list[float | None]) -> RangeOut:
    vals = [v for v in values if v is not None]
    return RangeOut(min=min(vals, default=0), max=max(vals, default=0))


def facets(cards: list[CardRecord]) -> CardFacets:
    return CardFacets(
        institutions=sorted({c.institution for c in cards}),
        classes=sorted({c.card_class for c in cards}),
        benefit_types=sorted({t for c in cards for t in c.benefit_types}),
        profiles=[
            ProfileTag(id=p.id, key=p.key, label=p.label, color=p.color, icon=p.icon, tagline=p.tagline)
            for p in PROFILES
        ],
        annual_fee=_range([c.annual_fee for c in cards]),
        cat=_range([c.cat for c in cards]),
        interest_rate=_range([c.interest_rate for c in cards]),
    )
