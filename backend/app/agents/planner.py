"""Planner por reglas: produce un plan explicito de tool calls con dependencias ANTES de ejecutar."""

from app.domain.education import TOPICS
from app.domain.models import CardRecord
from app.domain.normalize import strip_accents
from app.ml.profiles import assign_card_profile
from app.schemas.chat import PlanStep
from app.services.catalog import find_cards_in_text
from app.tools.registry import TOOLS

FEE_WORDS = ("comision", "cobra", "cobro", "penaliz", "pago tardio", "cuanto cuesta", "costo", "cargo")
COMPARE_WORDS = ("compar", " vs ", "versus", "diferencia")
PROFILE_WORDS = ("perfil", "cluster", "recomiend", "me conviene", "mejor tarjeta", "cual elijo", "para mi")
SEARCH_WORDS = (
    "cuales",
    "que tarjetas",
    "busca",
    "lista",
    "muestrame",
    "opciones",
    "hay tarjetas",
    "tarjetas con",
)
BENEFIT_WORDS = {
    "meses sin intereses": "Meses sin intereses",
    "msi": "Meses sin intereses",
    "puntos": "Puntos",
    "descuento": "Descuentos",
    "preventa": "Preventas",
    "seguro": "Seguros",
    "transferencia de saldo": "Transferencia de Saldo",
}


def _fold(text: str) -> str:
    return " " + strip_accents(text).lower() + " "


def _step(
    steps: list[PlanStep], tool: str, args: dict, rationale: str, depends: list[str] | None = None
) -> str:
    sid = f"s{len(steps) + 1}"
    steps.append(
        PlanStep(
            id=sid,
            agent=TOOLS[tool].agent,  # type: ignore[arg-type]
            tool=tool,
            args=args,
            depends_on=depends or [],
            rationale=rationale,
        )
    )
    return sid


def _topics(fold: str, exclude: set[str]) -> list[str]:
    scored: list[tuple[int, str]] = []
    for t in TOPICS:
        if t.id in exclude:
            continue
        hits = [len(k) for k in t.keywords if f"{k}" in fold]
        if hits:
            scored.append((max(hits), t.id))
    scored.sort(reverse=True)
    return [tid for _, tid in scored[:2]]


def build_plan(message: str, cards: list[CardRecord]) -> tuple[list[PlanStep], list[str]]:
    fold = _fold(message)
    steps: list[PlanStep] = []
    mentioned = find_cards_in_text(cards, message)
    wants_fees = any(w in fold for w in FEE_WORDS)
    wants_compare = any(w in fold for w in COMPARE_WORDS)
    wants_profile = any(w in fold for w in PROFILE_WORDS)
    institutions = sorted({c.institution for c in cards if c.institution != "No disponible"})
    institution = next((i for i in institutions if _fold(i).strip().split()[0] in fold), None)
    benefit = next((v for k, v in BENEFIT_WORDS.items() if k in fold), None)
    no_fee = "sin anualidad" in fold or "no cobre anualidad" in fold
    low_rate = any(w in fold for w in ("tasa baja", "menor tasa", "tasa mas baja", "cat bajo", "menor cat"))

    detail_ids: dict[str, str] = {}
    for c in mentioned:
        detail_ids[c.id] = _step(
            steps, "get_card_details", {"card_id": c.id}, f"Consultar la ficha de {c.name} en la base"
        )
    if wants_fees:
        for c in mentioned:
            _step(
                steps,
                "get_card_fees",
                {"card_id": c.id},
                f"Desglosar comisiones de {c.name} y su impacto",
                [detail_ids[c.id]],
            )
    if len(mentioned) >= 2:
        _step(
            steps,
            "compare_cards",
            {"card_ids": [c.id for c in mentioned]},
            "Comparar las tarjetas mencionadas lado a lado",
            list(detail_ids.values()),
        )
    elif wants_compare and len(mentioned) == 1:
        c = mentioned[0]
        _step(
            steps,
            "search_cards",
            {"profile_id": assign_card_profile(c).id, "limit": 4, "sort": "annual_fee"},
            f"Buscar tarjetas del mismo perfil que {c.name} para comparar",
            [detail_ids[c.id]],
        )
    if wants_profile:
        pid = _step(steps, "explain_profiles", {}, "Explicar los perfiles de tarjetas del modelo")
        for c in mentioned:
            _step(
                steps,
                "get_card_profile",
                {"card_id": c.id},
                f"Ubicar {c.name} en su perfil",
                [pid, detail_ids[c.id]],
            )

    has_filters = bool(institution or benefit or no_fee or low_rate)
    if not mentioned and (has_filters or any(w in fold for w in SEARCH_WORDS)):
        args: dict[str, object] = {"limit": 5, "sort": "interest_rate" if low_rate else "annual_fee"}
        if institution:
            args["institution"] = institution
        if benefit:
            args["benefit_type"] = benefit
        if no_fee:
            args["no_annual_fee"] = True
        _step(steps, "search_cards", args, "Buscar tarjetas que cumplan los criterios")

    exclude = {"comisiones"} if (mentioned and wants_fees) else set()
    if mentioned or has_filters:
        exclude |= {"beneficios", "anualidad"} if not wants_fees else set()
    for tid in _topics(fold, exclude):
        _step(steps, "get_education_topic", {"topic_id": tid}, "Explicar el concepto con lenguaje claro")

    if not steps:
        _step(steps, "get_education_topic", {"topic_id": "que_es_tdc"}, "Dar contexto básico sobre las TDC")
        _step(steps, "explain_profiles", {}, "Mostrar los tipos de tarjeta del mercado")

    suggestions = _suggestions(mentioned, wants_fees, wants_profile)
    return steps, suggestions


def _suggestions(mentioned: list[CardRecord], fees: bool, profile: bool) -> list[str]:
    out: list[str] = []
    if mentioned and not fees:
        out.append(f"¿Qué comisiones cobra {mentioned[0].name}?")
    if mentioned and not profile:
        out.append(f"¿A qué perfil pertenece {mentioned[0].name}?")
    out += [
        "¿Qué es el pago para no generar intereses?",
        "¿Qué tarjetas no cobran anualidad?",
        "¿Cómo se calcula el pago mínimo?",
    ]
    return out[:3]
