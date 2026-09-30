"""recommend(profile) -> resultado (D4). STUB por reglas con el contrato definitivo (D9).

Todo numero sale de la base de tarjetas; los supuestos se devuelven explicitos.
"""

from dataclasses import dataclass, field

from app.domain.models import CardRecord
from app.ml.profiles import FEATURES, IS_STUB, MODEL_VERSION, PROFILES_BY_ID, Profile, assign_card_profile
from app.schemas.recommend import UserProfileIn

FEE_CAP = 3000.0
AVOID_FEE_PENALTY = 0.7

INCOME_VALUE: dict[str, tuple[float, str]] = {
    "lt_7k": (5000.0, "menos de $7,000"),
    "7k_15k": (7000.0, "$7,000 a $15,000"),
    "15k_30k": (15000.0, "$15,000 a $30,000"),
    "30k_60k": (30000.0, "$30,000 a $60,000"),
    "gt_60k": (60000.0, "más de $60,000"),
}

SCORE_VALUE: dict[str, int | None] = {
    "unknown": None,
    "none": None,
    "low": 550,
    "medium": 640,
    "high": 720,
}

USE_BENEFITS: dict[str, tuple[str, ...]] = {
    "diario": ("Descuentos", "Puntos", "Meses sin intereses"),
    "viajes": ("Puntos", "Seguros"),
    "compras_meses": ("Meses sin intereses",),
    "historial": (),
    "transferir_saldo": ("Transferencia de Saldo",),
    "emergencias": (),
}

USE_LABEL = {
    "diario": "compras del día a día",
    "viajes": "viajes",
    "compras_meses": "compras a meses",
    "historial": "construir historial",
    "transferir_saldo": "transferir un saldo",
    "emergencias": "emergencias",
}


@dataclass(slots=True)
class ScoredCard:
    card: CardRecord
    profile: Profile
    score: float
    eligibility: str
    reasons: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass(slots=True)
class RecommendResult:
    profile: Profile
    profile_reason: str
    items: list[ScoredCard]
    excluded_count: int
    assumptions: list[str]
    model_version: str = MODEL_VERSION
    is_stub: bool = IS_STUB
    features: list[str] = field(default_factory=lambda: list(FEATURES))


def assign_user_profile(p: UserProfileIn) -> tuple[Profile, str]:
    income, _ = INCOME_VALUE[p.income_range]
    if p.main_use == "viajes" and income >= 30000:
        return PROFILES_BY_ID[3], "Tu ingreso y tu interés en viajes coinciden con tarjetas de gama alta."
    if not p.pays_in_full or p.main_use in ("transferir_saldo", "emergencias"):
        reason = "Como podrías financiar compras, la tasa de interés pesa más que los premios."
        return PROFILES_BY_ID[2], reason
    if p.avoid_annual_fee and income < 30000:
        reason = "Buscas no pagar anualidad: este perfil agrupa tarjetas de costo bajo o nulo."
        return PROFILES_BY_ID[0], reason
    if p.main_use == "historial" or income < 7000 or p.credit_score in ("none", "unknown"):
        return PROFILES_BY_ID[0], "Tu perfil apunta a construir historial con costos bajos."
    if income >= 30000:
        return PROFILES_BY_ID[3], "Eres totalero y tu ingreso te permite aprovechar recompensas premium."
    return PROFILES_BY_ID[1], "Eres totalero: puedes aprovechar beneficios de uso diario sin pagar intereses."


def _eligibility(card: CardRecord, p: UserProfileIn, income: float) -> tuple[str, list[str]]:
    notes: list[str] = []
    if card.age_min is not None and p.age < card.age_min:
        return "no_cumple", [f"Edad mínima {card.age_min} años"]
    if card.age_max is not None and p.age > card.age_max:
        return "no_cumple", [f"Edad máxima {card.age_max} años"]
    if card.monthly_income_min is not None and income < card.monthly_income_min:
        return "no_cumple", [f"Ingreso mínimo ${card.monthly_income_min:,.0f}"]
    status = "cumple"
    score = SCORE_VALUE[p.credit_score]
    if card.score_min is not None:
        if score is None:
            status = "por_confirmar"
            notes.append(f"Pide score mínimo de {card.score_min}; no lo indicaste")
        elif score < card.score_min:
            return "no_cumple", [f"Score mínimo {card.score_min}"]
    if card.work_seniority_min is not None:
        if p.work_seniority_months is None:
            status = "por_confirmar"
            notes.append(f"Pide antigüedad laboral mínima ({card.work_seniority_min})")
        elif p.work_seniority_months < card.work_seniority_min:
            status = "por_confirmar"
            notes.append(
                f"Antigüedad laboral mínima {card.work_seniority_min}; confirma la unidad con el banco"
            )
    return status, notes


def _norm(value: float | None, lo: float, hi: float, default: float = 0.5) -> float:
    if value is None or hi <= lo:
        return default
    return min(1.0, max(0.0, (value - lo) / (hi - lo)))


def recommend(p: UserProfileIn, cards: list[CardRecord], top_k: int = 6) -> RecommendResult:
    income, income_label = INCOME_VALUE[p.income_range]
    user_profile, reason = assign_user_profile(p)
    desired = set(p.benefits) | set(USE_BENEFITS[p.main_use])

    fees = [c.annual_fee for c in cards if c.annual_fee is not None]
    rates = [c.interest_rate for c in cards if c.interest_rate is not None]
    # Tope de 3,000: por encima la diferencia de costo ya no cambia la decision y evita que
    # unas pocas tarjetas premium aplanen la escala del resto.
    fee_lo, fee_hi = (min(fees), min(max(fees), FEE_CAP)) if fees else (0.0, 1.0)
    rate_lo, rate_hi = (min(rates), max(rates)) if rates else (0.0, 1.0)

    w_cost = 0.35 if p.avoid_annual_fee else 0.2
    w_rate = 0.05 if p.pays_in_full else 0.35
    w_ben = 0.3 if desired else 0.1
    w_prof = 0.15

    scored: list[ScoredCard] = []
    excluded = 0
    for card in cards:
        status, notes = _eligibility(card, p, income)
        if status == "no_cumple":
            excluded += 1
            continue
        profile = assign_card_profile(card)
        cost = 1 - _norm(card.annual_fee, fee_lo, fee_hi)
        rate = 1 - _norm(card.interest_rate, rate_lo, rate_hi)
        matched = sorted(desired & set(card.benefit_types))
        ben = len(matched) / len(desired) if desired else min(1.0, len(card.benefit_types) / 4)
        prof = 1.0 if profile.id == user_profile.id else 0.0
        raw = w_cost * cost + w_rate * rate + w_ben * ben + w_prof * prof
        raw /= w_cost + w_rate + w_ben + w_prof

        reasons: list[str] = []
        warnings = list(notes)
        if (card.annual_fee or 0) == 0:
            reasons.append("Sin anualidad")
        elif p.avoid_annual_fee:
            warnings.append(f"Cobra anualidad de ${card.annual_fee:,.0f}")
            raw *= AVOID_FEE_PENALTY
        if matched:
            reasons.append("Incluye " + ", ".join(matched))
        if not p.pays_in_full and card.interest_rate is not None and card.interest_rate <= 40:
            reasons.append(f"Tasa de interés de {card.interest_rate:.1f}%, por debajo del promedio")
        if prof:
            reasons.append(f"Pertenece a tu perfil «{profile.label}»")
        if card.interest_rate is not None and card.interest_rate >= 60 and not p.pays_in_full:
            warnings.append(f"Tasa de interés alta ({card.interest_rate:.1f}%) si no pagas el total")
        if status == "por_confirmar":
            raw *= 0.9
        scored.append(
            ScoredCard(
                card, profile, round(raw * 100, 1), status, reasons or ["Cumple tus datos básicos"], warnings
            )
        )

    scored.sort(key=lambda s: (-s.score, s.card.annual_fee or 0, s.card.name))
    assumptions = [
        f"Ingreso mensual considerado: ${income:,.0f} (rango {income_label}).",
        f"Uso principal: {USE_LABEL[p.main_use]}.",
        "Pagas el total del periodo (totalero)." if p.pays_in_full else "Podrías no pagar el total cada mes.",
        "Prefieres no pagar anualidad."
        if p.avoid_annual_fee
        else "Aceptas pagar anualidad si hay beneficios.",
        "No indicaste score: los requisitos de score quedan por confirmar."
        if SCORE_VALUE[p.credit_score] is None
        else f"Score aproximado considerado: {SCORE_VALUE[p.credit_score]}.",
        "Datos de tarjetas: compilado propio de Banxico y CONDUSEF; pueden cambiar sin aviso.",
        f"Modelo {MODEL_VERSION}: perfiles preliminares por reglas hasta integrar el clustering.",
    ]
    return RecommendResult(user_profile, reason, scored[:top_k], excluded, assumptions)
