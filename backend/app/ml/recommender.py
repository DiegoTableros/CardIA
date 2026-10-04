"""recommend(profile) -> resultado (D4), v1 sobre los 6 clusters de tarjetas.

1. Cada tarjeta se resume en 9 dimensiones de "necesidad" (0..1, mayor = mejor) a partir de los datos
   del Excel y las variables de ingenieria (`features`).
2. Las respuestas del usuario se convierten en pesos por dimension.
3. Afinidad de un perfil (cluster) = utilidad media de sus tarjetas ponderada por elegibilidad. El perfil del
   usuario es el de mayor afinidad.
4. Puntaje de tarjeta = 75% utilidad propia + 25% afinidad de su perfil, solo tarjetas elegibles.
Todo es determinista y explicable; no hay llamadas al LLM (D3).
"""

from collections import defaultdict
from dataclasses import dataclass, field

from app.domain.models import CardRecord
from app.ml.profiles import FEATURES, IS_STUB, MODEL_VERSION, PROFILES, Profile, assign_card_profile
from app.schemas.recommend import UserProfileIn

INCOME_VALUE: dict[str, tuple[float, str]] = {
    "lt_7k": (5000.0, "menos de $7,000"),
    "7k_15k": (7000.0, "$7,000 a $15,000"),
    "15k_30k": (15000.0, "$15,000 a $30,000"),
    "30k_60k": (30000.0, "$30,000 a $60,000"),
    "gt_60k": (60000.0, "más de $60,000"),
}
SCORE_VALUE: dict[str, int | None] = {"unknown": None, "none": None, "low": 550, "medium": 640, "high": 720}
USE_LABEL = {
    "diario": "compras del día a día",
    "viajes": "viajes",
    "compras_meses": "compras a meses",
    "historial": "construir historial",
    "transferir_saldo": "transferir un saldo",
    "emergencias": "emergencias",
}
HABIT_LABEL = {
    "full": "Pagas el total cada mes (totalero).",
    "sometimes": "A veces financias tus compras.",
    "revolving": "Sueles financiar tus compras.",
}
DIMS = ("annual_fee", "rate", "fees", "rewards", "travel", "promos", "msi", "transfer", "access")
DIM_PHRASE = {
    "annual_fee": "anualidad baja",
    "rate": "tasa baja",
    "fees": "pocas comisiones",
    "rewards": "puntos",
    "travel": "beneficios de viaje",
    "promos": "descuentos y promociones",
    "msi": "meses sin intereses",
    "transfer": "transferencia de saldo",
    "access": "requisitos accesibles",
}
BENEFIT_DIM = {
    "Meses sin intereses": ("msi", 2.0),
    "Puntos": ("rewards", 2.0),
    "Descuentos": ("promos", 2.0),
    "Preventas": ("promos", 1.0),
    "Transferencia de Saldo": ("transfer", 2.0),
    "Seguros": ("travel", 1.5),
}
USE_WEIGHTS: dict[str, dict[str, float]] = {
    "diario": {"promos": 1.2, "rewards": 0.8, "msi": 0.8},
    "viajes": {"travel": 3.0, "rewards": 2.0},
    "compras_meses": {"msi": 3.0},
    "historial": {"access": 3.0, "annual_fee": 1.5, "fees": 1.0},
    "transferir_saldo": {"transfer": 3.0, "rate": 2.0},
    "emergencias": {"rate": 1.5, "fees": 1.5, "access": 1.0},
}
HABIT_WEIGHTS: dict[str, dict[str, float]] = {
    "full": {"rate": 0.2, "rewards": 1.0, "promos": 0.5},
    "sometimes": {"rate": 2.2},
    "revolving": {"rate": 3.0, "transfer": 0.5},
}
HIGH_RATE = 60.0
HIGH_CAT = 85.0


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
    profile_fit: list[tuple[Profile, float]]
    items: list[ScoredCard]
    excluded_count: int
    assumptions: list[str]
    model_version: str = MODEL_VERSION
    is_stub: bool = IS_STUB
    features: list[str] = field(default_factory=lambda: list(FEATURES))


# ------------------------------------------------------------------ dimensiones por tarjeta


def _f(card: CardRecord, key: str) -> float:
    return float(card.features.get(key) or 0.0)


def _percentile(values: list[float], q: float) -> float:
    s = sorted(values)
    return s[min(len(s) - 1, int(q * (len(s) - 1) + 0.5))]


class _Scale:
    """Min-max winsorizado (p5-p95) sobre las tarjetas; evita que extremos aplanen la escala."""

    def __init__(self, values: list[float]) -> None:
        lo, hi = _percentile(values, 0.05), _percentile(values, 0.95)
        if hi <= lo:
            lo, hi = min(values), max(values)
        self.lo, self.hi = lo, hi

    def __call__(self, x: float) -> float:
        return 0.0 if self.hi <= self.lo else min(1.0, max(0.0, (x - self.lo) / (self.hi - self.lo)))


def _insurance(c: CardRecord) -> float:
    return sum(
        _f(c, k)
        for k in (
            "benef_seguro_accidentes_viaje",
            "benef_seguro_emergencia_medica",
            "benef_seguro_equipaje",
            "benef_seguro_cancelacion_demora_vuelo",
            "benef_seguro_renta_auto",
        )
    )


def _presales(c: CardRecord) -> float:
    return sum(
        _f(c, k)
        for k in (
            "benef_preventa_conciertos_festivales",
            "benef_preventa_teatro",
            "benef_preventa_eventos_deportivos",
        )
    )


def card_dimensions(cards: list[CardRecord]) -> dict[str, dict[str, float]]:
    def scale(fn) -> _Scale:  # noqa: ANN001
        return _Scale([float(fn(c)) for c in cards])

    fee, rate, cat = (
        scale(lambda c: c.annual_fee or 0),
        scale(lambda c: c.interest_rate or 0),
        scale(lambda c: c.cat or 0),
    )
    pen = scale(lambda c: _f(c, "com_sum_penalizacion_pesos"))
    evt = scale(lambda c: _f(c, "com_sum_por_evento_pesos"))
    ppd, ppp = (
        scale(lambda c: _f(c, "benef_puntos_por_dolar_max")),
        scale(lambda c: _f(c, "benef_puntos_por_peso_max")),
    )
    msi_v, desc_v = (
        scale(lambda c: _f(c, "benef_msi_n_categorias_viaje")),
        scale(lambda c: _f(c, "benef_desc_n_categorias_viaje")),
    )
    desc_c, ben_n = (
        scale(lambda c: _f(c, "benef_desc_n_categorias_consumo")),
        scale(lambda c: _f(c, "benef_n_tipos")),
    )
    msi_all = scale(lambda c: _f(c, "benef_msi_n_categorias_viaje") + _f(c, "benef_msi_n_categorias_consumo"))
    ins, pre, tr_rate = scale(_insurance), scale(_presales), scale(lambda c: _f(c, "benef_transfer_tasa_min"))
    income = scale(lambda c: c.monthly_income_min or 0)

    out: dict[str, dict[str, float]] = {}
    for c in cards:
        has_transfer = _f(c, "benef_transfer_plazo_min") > 0
        req = (
            0.4 * ((c.score_min or 0) / 700)
            + 0.3 * min(1.0, max(c.work_seniority_min or 0, c.residence_seniority_min or 0) / 12)
            + 0.3 * income(c.monthly_income_min or 0)
        )
        out[c.id] = {
            "annual_fee": 1 - fee(c.annual_fee or 0),
            "rate": 1 - (rate(c.interest_rate or 0) + cat(c.cat or 0)) / 2,
            "fees": 1
            - (pen(_f(c, "com_sum_penalizacion_pesos")) + evt(_f(c, "com_sum_por_evento_pesos"))) / 2,
            "rewards": max(ppd(_f(c, "benef_puntos_por_dolar_max")), ppp(_f(c, "benef_puntos_por_peso_max"))),
            # viaje = promedio de sus 2 mejores componentes (cada grupo destaca por una via distinta)
            "travel": sum(
                sorted(
                    [
                        msi_v(_f(c, "benef_msi_n_categorias_viaje")),
                        desc_v(_f(c, "benef_desc_n_categorias_viaje")),
                        ins(_insurance(c)),
                        ppd(_f(c, "benef_puntos_por_dolar_max")),
                    ]
                )[-2:]
            )
            / 2,
            "promos": (
                desc_c(_f(c, "benef_desc_n_categorias_consumo"))
                + desc_v(_f(c, "benef_desc_n_categorias_viaje"))
                + pre(_presales(c))
                + ben_n(_f(c, "benef_n_tipos"))
            )
            / 4,
            "msi": msi_all(_f(c, "benef_msi_n_categorias_viaje") + _f(c, "benef_msi_n_categorias_consumo")),
            "transfer": (0.5 + 0.5 * (1 - tr_rate(_f(c, "benef_transfer_tasa_min"))))
            if has_transfer
            else 0.0,
            "access": 1 - req,
        }
    return out


# ------------------------------------------------------------------ usuario


def habit_of(p: UserProfileIn) -> str:
    return p.payment_habit or ("full" if p.pays_in_full else "sometimes")


def user_weights(p: UserProfileIn) -> dict[str, float]:
    w: dict[str, float] = defaultdict(float)
    w["annual_fee"] += 6.0 if p.avoid_annual_fee else 0.4
    for src in (HABIT_WEIGHTS[habit_of(p)], USE_WEIGHTS[p.main_use]):
        for dim, v in src.items():
            w[dim] += v
    for b in p.benefits:
        dim, v = BENEFIT_DIM[b]
        w[dim] += v
    if p.avoid_fees:
        w["fees"] += 2.5
    if p.credit_score in ("none", "low", "unknown"):
        w["access"] += 1.5
    return dict(w)


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
    for need, have, label in (
        (card.work_seniority_min, p.work_seniority_months, "laboral"),
        (card.residence_seniority_min, p.residence_months, "residencial"),
    ):
        if need is None:
            continue
        if have is None:
            status = "por_confirmar"
            notes.append(f"Pide antigüedad {label} mínima ({need}); no la indicaste")
        elif have < need:
            status = "por_confirmar"
            notes.append(f"Antigüedad {label} mínima {need}; confirma la unidad con el banco")
    return status, notes


def _reasons(card: CardRecord, dims: dict[str, float], w: dict[str, float]) -> list[str]:
    f = card.features
    text = {
        "annual_fee": "Sin anualidad" if not card.annual_fee else f"Anualidad baja (${card.annual_fee:,.0f})",
        "rate": f"Tasa de {card.interest_rate:.1f}%, de las más bajas" if card.interest_rate else "Tasa baja",
        "fees": "Comisiones y penalizaciones bajas",
        "rewards": "Acumula puntos"
        + (
            f" ({f['benef_puntos_por_dolar_max']:g} por dólar)" if f.get("benef_puntos_por_dolar_max") else ""
        ),
        "travel": f"MSI de viaje en {int(f.get('benef_msi_n_categorias_viaje') or 0)} categorías y beneficios de viaje",
        "promos": "Descuentos y preventas",
        "msi": "Meses sin intereses",
        "transfer": f"Transferencia de saldo a {f.get('benef_transfer_tasa_min', 0):g}% por {int(f.get('benef_transfer_plazo_min') or 0)} meses",
        "access": "No pide score" if not card.score_min else "Requisitos accesibles",
    }
    ranked = sorted((d for d in DIMS if w.get(d, 0) >= 1 and dims[d] >= 0.6), key=lambda d: -w[d] * dims[d])
    return [text[d] for d in ranked[:3]]


def _warnings(card: CardRecord, dims: dict[str, float], p: UserProfileIn, w: dict[str, float]) -> list[str]:
    out: list[str] = []
    habit = habit_of(p)
    if p.avoid_annual_fee and (card.annual_fee or 0) > 0:
        out.append(f"Cobra anualidad de ${card.annual_fee:,.0f} y dijiste que preferías no pagarla")
    if habit != "full" and (card.interest_rate or 0) >= HIGH_RATE:
        out.append(f"Tasa de {card.interest_rate:.1f}%: si no pagas el total, financiar sale caro")
    elif habit != "full" and (card.cat or 0) >= HIGH_CAT:
        out.append(f"CAT de {card.cat:.1f}%: si no pagas el total, financiar sale caro")
    if p.avoid_fees and dims["fees"] < 0.35:
        late = card.features.get("com_pago_tardio_pesos")
        out.append("Comisiones y penalizaciones altas" + (f" (pago tardío ${late:,.0f})" if late else ""))
    if w.get("rewards", 0) >= 2 and dims["rewards"] == 0:
        out.append("No acumula puntos y los buscabas")
    if w.get("transfer", 0) >= 2 and dims["transfer"] == 0:
        out.append("No ofrece transferencia de saldo y la buscabas")
    if w.get("msi", 0) >= 2 and dims["msi"] == 0:
        out.append("No tiene meses sin intereses y los buscabas")
    return out


def recommend(p: UserProfileIn, cards: list[CardRecord], top_k: int = 6) -> RecommendResult:
    income, income_label = INCOME_VALUE[p.income_range]
    dims, w = card_dimensions(cards), user_weights(p)
    total_w = sum(w.values())

    def utility(cid: str) -> float:
        return sum(w.get(d, 0.0) * dims[cid][d] for d in DIMS) / total_w

    status = {c.id: _eligibility(c, p, income) for c in cards}
    fits: list[tuple[Profile, float]] = []
    for prof in PROFILES:
        members = [c for c in cards if assign_card_profile(c).id == prof.id]
        if not members:
            fits.append((prof, 0.0))
            continue
        share = sum({"cumple": 1.0, "por_confirmar": 0.6}.get(status[c.id][0], 0.0) for c in members) / len(
            members
        )
        fits.append((prof, sum(utility(c.id) for c in members) / len(members) * (0.5 + 0.5 * share)))
    best = max(fits, key=lambda t: t[1])[0]
    fit_by_id = {prof.id: f for prof, f in fits}
    top = sorted(w, key=lambda d: -w[d])[:2]
    reason = (
        f"Priorizaste {' y '.join(DIM_PHRASE[d] for d in top)}: el grupo «{best.label}» es el que mejor "
        "cumple lo que buscas."
    )

    scored: list[ScoredCard] = []
    excluded = 0
    for c in cards:
        st, notes = status[c.id]
        if st == "no_cumple":
            excluded += 1
            continue
        prof = assign_card_profile(c)
        raw = 0.75 * utility(c.id) + 0.25 * fit_by_id[prof.id]
        warnings = notes + _warnings(c, dims[c.id], p, w)
        if p.avoid_annual_fee and (c.annual_fee or 0) > 0:
            raw *= 0.75
        if st == "por_confirmar":
            raw *= 0.92
        reasons = _reasons(c, dims[c.id], w)
        scored.append(
            ScoredCard(c, prof, round(raw * 100, 1), st, reasons or ["Cumple tus datos básicos"], warnings)
        )
    scored.sort(key=lambda s: (-s.score, s.card.annual_fee or 0, s.card.name))
    if scored:
        # Metodo: el perfil del usuario es el cluster de su tarjeta mejor calificada (Top 1).
        best = scored[0].profile
        reason = (
            f"Tu mejor opción es {scored[0].card.name}, del grupo «{best.label}». "
            f"Priorizaste {' y '.join(DIM_PHRASE[d] for d in top)}."
        )
        for s in scored:
            if s.profile.id == best.id:
                s.reasons.append("Coincide con tu perfil")

    assumptions = [
        f"Edad: {p.age} años.",
        f"Ingreso mensual considerado: ${income:,.0f} (rango {income_label}).",
        f"Uso principal: {USE_LABEL[p.main_use]}.",
        HABIT_LABEL[habit_of(p)],
        "Prefieres no pagar anualidad."
        if p.avoid_annual_fee
        else "Aceptas pagar anualidad si hay beneficios.",
        "No indicaste score: los requisitos de score quedan por confirmar."
        if SCORE_VALUE[p.credit_score] is None
        else f"Score aproximado considerado: {SCORE_VALUE[p.credit_score]}.",
    ]
    if p.avoid_fees:
        assumptions.append("Quieres evitar comisiones y penalizaciones altas.")
    if p.benefits:
        assumptions.append("Beneficios que te interesan: " + ", ".join(p.benefits) + ".")
    fit_pct = [(prof, min(1.0, f)) for prof, f in fits]
    return RecommendResult(best, reason, fit_pct, scored[:top_k], excluded, assumptions)
