from typing import Literal

from pydantic import BaseModel, Field

FeeType = Literal["obligatoria", "por_evento", "penalizacion", "otro"]
Denomination = Literal["MXN", "USD", "PCT"]


class ProfileTag(BaseModel):
    """Perfil (cluster) al que pertenece una tarjeta."""

    id: int
    key: str
    label: str
    color: str


class Requirements(BaseModel):
    age_min: int | None = None
    age_max: int | None = None
    score_min: int | None = None
    work_seniority_min: int | None = None
    residence_seniority_min: int | None = None
    monthly_income_min: float | None = None


class FeeOut(BaseModel):
    concept: str
    amount: float | None
    denomination: Denomination
    fee_type: FeeType


class BenefitOut(BaseModel):
    benefit_type: str
    text: str


class FeeCounts(BaseModel):
    obligatoria: int = 0
    por_evento: int = 0
    penalizacion: int = 0


class CardSummary(BaseModel):
    id: str
    name: str
    institution: str
    card_class: str
    cat: float | None
    annual_fee: float | None
    interest_rate: float | None
    credit_line_min: float | None
    monthly_income_min: float | None
    benefit_types: list[str]
    fee_counts: FeeCounts
    profile: ProfileTag


class CardDetail(CardSummary):
    requirements: Requirements
    fees: list[FeeOut]
    benefits: list[BenefitOut]
    disclaimer: str


class CardListResponse(BaseModel):
    total: int
    items: list[CardSummary]


class RangeOut(BaseModel):
    min: float
    max: float


class CardFacets(BaseModel):
    institutions: list[str]
    classes: list[str]
    benefit_types: list[str]
    profiles: list[ProfileTag]
    annual_fee: RangeOut
    cat: RangeOut
    interest_rate: RangeOut


SortKey = Literal["name", "annual_fee", "cat", "interest_rate", "credit_line_min", "benefits"]


class CardQuery(BaseModel):
    q: str | None = Field(default=None, max_length=100)
    institution: str | None = None
    card_class: str | None = None
    benefit_type: str | None = None
    profile_id: int | None = None
    max_annual_fee: float | None = Field(default=None, ge=0)
    no_annual_fee: bool = False
    sort: SortKey = "name"
    limit: int = Field(default=100, ge=1, le=100)
