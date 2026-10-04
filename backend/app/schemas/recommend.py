"""Contrato de recomendacion (D4/D9). El stub y el pipeline real comparten este contrato."""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.cards import CardSummary

IncomeRange = Literal["lt_7k", "7k_15k", "15k_30k", "30k_60k", "gt_60k"]
ScoreBand = Literal["unknown", "none", "low", "medium", "high"]
MainUse = Literal["diario", "viajes", "compras_meses", "historial", "transferir_saldo", "emergencias"]
BenefitInterest = Literal[
    "Meses sin intereses", "Puntos", "Descuentos", "Preventas", "Transferencia de Saldo", "Seguros"
]
Eligibility = Literal["cumple", "por_confirmar", "no_cumple"]


class UserProfileIn(BaseModel):
    """Datos NO sensibles: rangos y preferencias. Nunca RFC, CURP ni cuentas (D11)."""

    age: int = Field(ge=18, le=99, description="Edad en anios")
    income_range: IncomeRange
    credit_score: ScoreBand = "unknown"
    work_seniority_months: int | None = Field(default=None, ge=0, le=600)
    main_use: MainUse = "diario"
    avoid_annual_fee: bool = False
    pays_in_full: bool = Field(default=False, description="Obsoleto: usar payment_habit")
    payment_habit: Literal["full", "sometimes", "revolving"] | None = Field(
        default=None, description="full=totalero, sometimes=a veces financia, revolving=suele financiar"
    )
    residence_months: int | None = Field(default=None, ge=0, le=600, description="Antiguedad en el domicilio")
    avoid_fees: bool = Field(default=False, description="Quiere evitar comisiones y penalizaciones altas")
    benefits: list[BenefitInterest] = Field(default_factory=list, max_length=6)


class ProfileOut(BaseModel):
    id: int
    key: str
    label: str
    analytic_name: str = ""
    tagline: str
    description: str
    color: str
    icon: str
    traits: list[str]
    card_count: int = 0


class Recommendation(BaseModel):
    card: CardSummary
    score: float = Field(ge=0, le=100)
    eligibility: Eligibility
    reasons: list[str]
    warnings: list[str]


class ProfileScore(BaseModel):
    id: int
    label: str
    color: str
    score: float = Field(ge=0, le=100)


class ModelInfo(BaseModel):
    version: str
    is_stub: bool
    features: list[str]
    description: str


class RecommendResponse(BaseModel):
    profile: ProfileOut
    profile_reason: str
    profile_scores: list[ProfileScore]
    recommendations: list[Recommendation]
    excluded_count: int
    assumptions: list[str]
    model: ModelInfo
    disclaimer: str
