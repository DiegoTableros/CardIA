"""Narrador por reglas: arma la respuesta en markdown SOLO con datos de las tools (D3)."""

from typing import Any

from app.schemas.chat import PlanStep


def _money(v: float | None) -> str:
    return "N/D" if v is None else f"${v:,.0f}"


def _pct(v: float | None) -> str:
    return "N/D" if v is None else f"{v:.1f}%"


def _card_block(d: dict[str, Any]) -> str:
    lines = [
        f"### {d['name']} · {d['institution']}",
        f"Clase **{d['card_class']}** · Perfil **{d['profile']}**",
        "",
        f"- **Anualidad:** {_money(d['annual_fee'])}",
        f"- **CAT (publicidad):** {_pct(d['cat'])} · **Tasa de interés:** {_pct(d['interest_rate'])}",
        f"- **Línea de crédito desde:** {_money(d['credit_line_min'])}",
        f"- **Ingreso mensual mínimo:** {_money(d['monthly_income_min'])}",
    ]
    req = d.get("requirements") or {}
    if req:
        age = f"{req.get('age_min') or '?'}–{req.get('age_max') or '?'} años"
        score = req.get("score_min") or "no publicado"
        lines.append(f"- **Requisitos:** edad {age}, score mínimo {score}")
    benefits = d.get("benefits") or []
    if benefits:
        lines += ["", "**Beneficios**"]
        lines += [f"- *{b['type']}*: {b['text']}" for b in benefits[:5]]
    return "\n".join(lines)


def _fees_block(d: dict[str, Any]) -> str:
    lines = [f"### Comisiones de {d['card']}", "", "| Concepto | Monto | Tipo |", "|---|---|---|"]
    for f in d["fees"][:10]:
        amount = f["amount"]
        if amount is None:
            shown = "N/D"
        elif f["denomination"] == "PCT":
            shown = f"{amount:g}%"
        elif f["denomination"] == "USD":
            shown = f"US${amount:,.0f}"
        else:
            shown = _money(amount)
        lines.append(f"| {f['concept']} | {shown} | {f['type']} |")
    if d["impacts"]:
        lines += ["", "**Si la tienes contratada, considera:**"]
        lines += [f"- {i}" for i in d["impacts"]]
    return "\n".join(lines)


def _compare_block(d: dict[str, Any]) -> str:
    cards = d["cards"]
    head = "| | " + " | ".join(c["name"] for c in cards) + " |"
    sep = "|---" * (len(cards) + 1) + "|"
    rows = [
        ("Anualidad", [_money(c["annual_fee"]) for c in cards]),
        ("CAT", [_pct(c["cat"]) for c in cards]),
        ("Tasa", [_pct(c["interest_rate"]) for c in cards]),
        ("Línea desde", [_money(c["credit_line_min"]) for c in cards]),
        ("Perfil", [c["profile"] for c in cards]),
    ]
    body = [f"| {label} | " + " | ".join(vals) + " |" for label, vals in rows]
    return "\n".join(["### Comparativa", "", head, sep, *body])


def _search_block(d: dict[str, Any]) -> str:
    if not d["cards"]:
        return "No encontré tarjetas con esos criterios."
    lines = [f"### Encontré {d['count']} tarjetas", ""]
    for c in d["cards"]:
        lines.append(
            f"- **{c['name']}** ({c['institution']}): anualidad {_money(c['annual_fee'])}, "
            f"tasa {_pct(c['interest_rate'])}, perfil *{c['profile']}*"
        )
    return "\n".join(lines)


def _profiles_block(d: dict[str, Any]) -> str:
    lines = ["### Perfiles de tarjetas", ""]
    for p in d["profiles"]:
        ex = ", ".join(p["examples"])
        lines.append(f"- **{p['label']}** ({p['count']} tarjetas): {p['tagline']}. Ejemplos: {ex}.")
    lines += [
        "",
        "Para ubicar tu perfil, responde las preguntas de **Encuentra tu tarjeta** (sin datos personales).",
    ]
    return "\n".join(lines)


def _profile_block(d: dict[str, Any]) -> str:
    return f"**{d['card']}** pertenece al perfil **{d['profile']}**: {d['description']}"


def _glossary_block(d: dict[str, Any]) -> str:
    if not d["terms"]:
        return "No encontré ese término en el glosario."
    lines: list[str] = []
    for t in d["terms"]:
        lines += [f"### {t['term']}", "", t["definition"]]
        if t.get("note"):
            lines += ["", f"*{t['note']}*"]
        lines.append("")
    lines.append(f"Fuente: {d['source']}.")
    return "\n".join(lines)


RENDER = {
    "search_glossary": _glossary_block,
    "get_card_details": _card_block,
    "get_card_fees": _fees_block,
    "compare_cards": _compare_block,
    "search_cards": _search_block,
    "explain_profiles": _profiles_block,
    "get_card_profile": _profile_block,
    "get_education_topic": lambda d: f"### {d['title']}\n\n{d['body']}",
}


def narrate(plan: list[PlanStep], results: dict[str, dict[str, Any]]) -> str:
    parts: list[str] = []
    for step in plan:
        if step.status == "ok" and step.id in results:
            parts.append(RENDER[step.tool](results[step.id]))
        elif step.status == "error":
            parts.append(f"> No pude completar *{step.tool}*: {step.summary}")
    return "\n\n".join(parts) if parts else "No encontré información para tu pregunta."
