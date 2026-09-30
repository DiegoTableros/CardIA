from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.cards import CardDetail


class CompareRequest(BaseModel):
    card_ids: list[str] = Field(min_length=2, max_length=4)


class CompareMetric(BaseModel):
    key: str
    label: str
    unit: Literal["MXN", "%", "count"]
    better: Literal["lower", "higher"]
    values: dict[str, float | None]
    best_id: str | None


class CompareResponse(BaseModel):
    cards: list[CardDetail]
    metrics: list[CompareMetric]
    disclaimer: str
