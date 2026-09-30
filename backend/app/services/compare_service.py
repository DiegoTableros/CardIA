from app.core.disclaimer import DISCLAIMER
from app.domain.models import CardRecord
from app.schemas.compare import CompareMetric, CompareResponse
from app.services.catalog import get_card, to_detail

_METRICS: list[tuple[str, str, str, str]] = [
    ("annual_fee", "Anualidad", "MXN", "lower"),
    ("cat", "CAT (publicidad)", "%", "lower"),
    ("interest_rate", "Tasa de interés", "%", "lower"),
    ("credit_line_min", "Línea de crédito desde", "MXN", "higher"),
    ("monthly_income_min", "Ingreso mínimo", "MXN", "lower"),
    ("benefits", "Tipos de beneficio", "count", "higher"),
    ("penalties", "Comisiones por penalización", "count", "lower"),
]


def _value(card: CardRecord, key: str) -> float | None:
    if key == "benefits":
        return float(len(card.benefit_types))
    if key == "penalties":
        return float(card.fee_counts()["penalizacion"])
    value = getattr(card, key)
    return float(value) if value is not None else None


def compare(cards: list[CardRecord], ids: list[str]) -> CompareResponse:
    unique = list(dict.fromkeys(ids))
    selected = [get_card(cards, i) for i in unique]
    metrics: list[CompareMetric] = []
    for key, label, unit, better in _METRICS:
        values = {c.id: _value(c, key) for c in selected}
        present = {k: v for k, v in values.items() if v is not None}
        best = None
        if present and len(set(present.values())) > 1:
            pick = min if better == "lower" else max
            best = pick(present, key=present.__getitem__)
        metrics.append(
            CompareMetric(key=key, label=label, unit=unit, better=better, values=values, best_id=best)  # type: ignore[arg-type]
        )
    return CompareResponse(cards=[to_detail(c) for c in selected], metrics=metrics, disclaimer=DISCLAIMER)
