"""Modelos de dominio independientes del ORM (usados por ML, tools y servicios)."""

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class FeeRecord:
    concept: str
    amount: float | None
    denomination: str
    fee_type: str


@dataclass(frozen=True, slots=True)
class BenefitRecord:
    benefit_type: str
    text: str


@dataclass(slots=True)
class CardRecord:
    id: str
    name: str
    institution: str
    card_class: str
    cat: float | None
    annual_fee: float | None
    interest_rate: float | None
    credit_line_min: float | None
    age_min: int | None = None
    age_max: int | None = None
    score_min: int | None = None
    work_seniority_min: int | None = None
    residence_seniority_min: int | None = None
    monthly_income_min: float | None = None
    fees: list[FeeRecord] = field(default_factory=list)
    benefits: list[BenefitRecord] = field(default_factory=list)

    @property
    def benefit_types(self) -> list[str]:
        return sorted({b.benefit_type for b in self.benefits})

    def fee_counts(self) -> dict[str, int]:
        counts = {"obligatoria": 0, "por_evento": 0, "penalizacion": 0}
        for f in self.fees:
            if f.fee_type in counts:
                counts[f.fee_type] += 1
        return counts

    def find_fee(self, *keywords: str) -> FeeRecord | None:
        for f in self.fees:
            name = f.concept.lower()
            if all(k in name for k in keywords):
                return f
        return None
