"""Tools que consultan la base de tarjetas (D3: el LLM nunca inventa datos).

Cada tool declara su agente, descripcion y JSON Schema de argumentos (compatible con tool calling
de OpenAI) y devuelve un ToolResult con datos estructurados + resumen para el plan.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from app.domain.education import TOPICS, TOPICS_BY_ID
from app.domain.glossary import SOURCE as GLOSSARY_SOURCE
from app.domain.glossary import category_notes, find_terms
from app.domain.models import CardRecord
from app.ml.profiles import PROFILES, assign_card_profile
from app.schemas.cards import CardQuery
from app.services.catalog import filter_cards, get_card

FEE_TYPE_LABEL = {"obligatoria": "Obligatoria", "por_evento": "Por evento", "penalizacion": "Penalización"}


@dataclass(slots=True)
class ToolResult:
    data: dict[str, Any]
    summary: str
    cards: list[CardRecord] = field(default_factory=list)


ToolFn = Callable[[list[CardRecord], dict[str, Any]], ToolResult]


@dataclass(frozen=True, slots=True)
class ToolSpec:
    name: str
    agent: str
    description: str
    parameters: dict[str, Any]
    fn: ToolFn

    def openai_schema(self) -> dict[str, Any]:
        return {
            "type": "function",
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        }


def _card_brief(c: CardRecord) -> dict[str, Any]:
    return {
        "id": c.id,
        "name": c.name,
        "institution": c.institution,
        "card_class": c.card_class,
        "annual_fee": c.annual_fee,
        "cat": c.cat,
        "interest_rate": c.interest_rate,
        "credit_line_min": c.credit_line_min,
        "monthly_income_min": c.monthly_income_min,
        "benefit_types": c.benefit_types,
        "profile": assign_card_profile(c).label,
    }


def search_cards(cards: list[CardRecord], args: dict[str, Any]) -> ToolResult:
    q = CardQuery(
        q=args.get("query"),
        institution=args.get("institution"),
        benefit_type=args.get("benefit_type"),
        no_annual_fee=bool(args.get("no_annual_fee", False)),
        max_annual_fee=args.get("max_annual_fee"),
        profile_id=args.get("profile_id"),
        sort=args.get("sort", "annual_fee"),
        limit=int(args.get("limit", 5)),
    )
    found = filter_cards(cards, q)
    return ToolResult(
        data={"count": len(found), "cards": [_card_brief(c) for c in found]},
        summary=f"{len(found)} tarjetas encontradas",
        cards=found,
    )


def get_card_details(cards: list[CardRecord], args: dict[str, Any]) -> ToolResult:
    c = get_card(cards, str(args["card_id"]))
    data = _card_brief(c) | {
        "requirements": {
            "age_min": c.age_min,
            "age_max": c.age_max,
            "score_min": c.score_min,
            "work_seniority_min": c.work_seniority_min,
            "residence_seniority_min": c.residence_seniority_min,
            "monthly_income_min": c.monthly_income_min,
        },
        "benefits": [{"type": b.benefit_type, "text": b.text} for b in c.benefits],
    }
    return ToolResult(data=data, summary=f"Ficha de {c.name}", cards=[c])


def compare_cards(cards: list[CardRecord], args: dict[str, Any]) -> ToolResult:
    ids = [str(i) for i in args["card_ids"]][:4]
    selected = [get_card(cards, i) for i in ids]
    return ToolResult(
        data={"cards": [_card_brief(c) for c in selected]},
        summary=f"Comparativa de {len(selected)} tarjetas",
        cards=selected,
    )


def get_card_fees(cards: list[CardRecord], args: dict[str, Any]) -> ToolResult:
    c = get_card(cards, str(args["card_id"]))
    fee_type = args.get("fee_type")
    fees = [f for f in c.fees if not fee_type or f.fee_type == fee_type]
    impacts: list[str] = []
    late = c.find_fee("pago tard")
    if late and late.amount:
        impacts.append(f"Pagar después de la fecha límite cuesta ${late.amount:,.0f} por evento, más IVA.")
    cash = c.find_fee("disposici", "otro banco") or c.find_fee("disposici")
    if cash and cash.amount:
        unit = "%" if cash.denomination == "PCT" else " pesos"
        impacts.append(
            f"Retirar efectivo ({cash.concept.lower()}) cobra {cash.amount:g}{unit} más intereses inmediatos."
        )
    annual = c.find_fee("anualidad titular")
    if annual and annual.amount:
        impacts.append(f"La anualidad del titular es de ${annual.amount:,.0f} al año.")
    data = {
        "card": c.name,
        "fees": [
            {
                "concept": f.concept,
                "amount": f.amount,
                "denomination": f.denomination,
                "type": FEE_TYPE_LABEL.get(f.fee_type, f.fee_type),
            }
            for f in fees
        ],
        "counts": c.fee_counts(),
        "impacts": impacts,
    }
    return ToolResult(data=data, summary=f"{len(fees)} comisiones de {c.name}", cards=[c])


def get_education_topic(_: list[CardRecord], args: dict[str, Any]) -> ToolResult:
    t = TOPICS_BY_ID.get(str(args.get("topic_id")), TOPICS_BY_ID["que_es_tdc"])
    return ToolResult(
        data={"id": t.id, "title": t.title, "summary": t.summary, "body": t.body},
        summary=t.title,
    )


def search_glossary(_: list[CardRecord], args: dict[str, Any]) -> ToolResult:
    query = str(args.get("query", ""))
    terms = find_terms(query)
    notes = category_notes()
    data = {
        "source": GLOSSARY_SOURCE,
        "terms": [
            {
                "term": t.term,
                "category": t.category,
                "definition": t.definition,
                **({"note": notes[t.category]} if t.category in notes else {}),
            }
            for t in terms
        ],
    }
    return ToolResult(data=data, summary=f"{len(terms)} términos del glosario")


def explain_profiles(cards: list[CardRecord], _: dict[str, Any]) -> ToolResult:
    items = []
    for p in PROFILES:
        members = [c for c in cards if assign_card_profile(c).id == p.id]
        examples = sorted(members, key=lambda c: c.annual_fee or 0)[:3]
        items.append(
            {
                "id": p.id,
                "label": p.label,
                "tagline": p.tagline,
                "description": p.description,
                "traits": list(p.traits),
                "count": len(members),
                "examples": [c.name for c in examples],
            }
        )
    return ToolResult(data={"profiles": items}, summary=f"{len(items)} perfiles de tarjetas")


def get_card_profile(cards: list[CardRecord], args: dict[str, Any]) -> ToolResult:
    c = get_card(cards, str(args["card_id"]))
    p = assign_card_profile(c)
    return ToolResult(
        data={"card": c.name, "profile": p.label, "tagline": p.tagline, "description": p.description},
        summary=f"{c.name} → perfil {p.label}",
        cards=[c],
    )


_CARD_ID = {"type": "string", "description": "ID de la tarjeta (p. ej. '002')"}

TOOLS: dict[str, ToolSpec] = {
    t.name: t
    for t in (
        ToolSpec(
            "search_cards",
            "FundamentalsAgent",
            "Busca tarjetas en la base por texto, institución, beneficio o anualidad.",
            {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "institution": {"type": "string"},
                    "benefit_type": {"type": "string"},
                    "no_annual_fee": {"type": "boolean"},
                    "max_annual_fee": {"type": "number"},
                    "profile_id": {"type": "integer"},
                    "sort": {
                        "type": "string",
                        "enum": ["annual_fee", "cat", "interest_rate", "benefits", "name"],
                    },
                    "limit": {"type": "integer", "minimum": 1, "maximum": 10},
                },
            },
            search_cards,
        ),
        ToolSpec(
            "get_card_details",
            "FundamentalsAgent",
            "Ficha completa de una tarjeta: costos, requisitos y beneficios.",
            {"type": "object", "properties": {"card_id": _CARD_ID}, "required": ["card_id"]},
            get_card_details,
        ),
        ToolSpec(
            "compare_cards",
            "FundamentalsAgent",
            "Compara de 2 a 4 tarjetas lado a lado.",
            {
                "type": "object",
                "properties": {
                    "card_ids": {"type": "array", "items": _CARD_ID, "minItems": 2, "maxItems": 4}
                },
                "required": ["card_ids"],
            },
            compare_cards,
        ),
        ToolSpec(
            "get_card_fees",
            "ComisionesAgent",
            "Desglose de comisiones de una tarjeta y su impacto si la tienes contratada.",
            {
                "type": "object",
                "properties": {
                    "card_id": _CARD_ID,
                    "fee_type": {"type": "string", "enum": ["obligatoria", "por_evento", "penalizacion"]},
                },
                "required": ["card_id"],
            },
            get_card_fees,
        ),
        ToolSpec(
            "get_education_topic",
            "EducativeAgent",
            "Explicación educativa de un tema de tarjetas de crédito.",
            {
                "type": "object",
                "properties": {"topic_id": {"type": "string", "enum": [t.id for t in TOPICS]}},
                "required": ["topic_id"],
            },
            get_education_topic,
        ),
        ToolSpec(
            "search_glossary",
            "EducativeAgent",
            "Busca definiciones oficiales en el glosario de tarjetas de crédito de CONDUSEF "
            "(términos generales, seguros y beneficios).",
            {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "Término o pregunta"}},
                "required": ["query"],
            },
            search_glossary,
        ),
        ToolSpec(
            "explain_profiles",
            "PerfilAgent",
            "Describe los perfiles (clusters) de tarjetas y ejemplos de cada uno.",
            {"type": "object", "properties": {}},
            explain_profiles,
        ),
        ToolSpec(
            "get_card_profile",
            "PerfilAgent",
            "Indica a qué perfil (cluster) pertenece una tarjeta y qué significa.",
            {"type": "object", "properties": {"card_id": _CARD_ID}, "required": ["card_id"]},
            get_card_profile,
        ),
    )
}


def run_tool(name: str, cards: list[CardRecord], args: dict[str, Any]) -> ToolResult:
    return TOOLS[name].fn(cards, args)
