"""Glosario oficial de CONDUSEF (data/glossary.json), usado por el agente Educativo."""

import difflib
import json
from dataclasses import dataclass
from functools import lru_cache

from app.core.config import DATA_DIR
from app.domain.normalize import strip_accents

GLOSSARY_JSON = DATA_DIR / "glossary.json"
SOURCE = "Glosario de Tarjetas de Crédito de CONDUSEF"

# Terminos destacados para "Temas para aprender" (orden de aparicion en la UI).
FEATURED = (
    "Pago mínimo",
    "Pago para no generar intereses",
    "Fecha de corte",
    "Fecha límite de pago",
    "Costo Anual Total (CAT)",
    "Anualidad",
    "Tasa de interés",
    "Intereses moratorios",
    "Disposición de efectivo",
    "Línea de crédito",
    "Crédito disponible",
    "Saldo vencido",
    "Mensualidades sin intereses",
    "Transferencia de saldos",
    "Programa de puntos",
    "Seguro por robo o extravío",
    "Seguro de compra protegida",
    "Cargos recurrentes",
)


@dataclass(frozen=True, slots=True)
class Term:
    term: str
    category: str
    definition: str


def _fold(text: str) -> str:
    return strip_accents(text).lower().strip()


@lru_cache
def load_terms() -> tuple[Term, ...]:
    raw = json.loads(GLOSSARY_JSON.read_text(encoding="utf-8"))
    return tuple(Term(t["term"], t["category"], t["definition"]) for t in raw["terms"])


@lru_cache
def category_notes() -> dict[str, str]:
    return json.loads(GLOSSARY_JSON.read_text(encoding="utf-8")).get("notes", {})


def _base(term: str) -> str:
    """'Costo Anual Total (CAT)' -> 'costo anual total'."""
    return _fold(term.split("(")[0])


def find_terms(text: str, limit: int = 3) -> list[Term]:
    """Terminos del glosario mencionados en el texto (exactos, siglas o difusos)."""
    folded = f" {_fold(text)} "
    hits: list[tuple[int, Term]] = []
    for t in load_terms():
        base = _base(t.term)
        acronym = t.term[t.term.find("(") + 1 : t.term.find(")")].lower() if "(" in t.term else ""
        if base and base in folded:
            hits.append((len(base), t))
        elif acronym and f" {acronym} " in folded.replace("?", " ").replace("¿", " "):
            hits.append((len(acronym) + 20, t))
    if not hits:
        names = {_base(t.term): t for t in load_terms()}
        for m in difflib.get_close_matches(_fold(text), names.keys(), n=limit, cutoff=0.75):
            hits.append((len(m), names[m]))
    hits.sort(key=lambda h: -h[0])
    out: list[Term] = []
    for _, t in hits:
        if t not in out:
            out.append(t)
    return out[:limit]


def featured_terms() -> list[Term]:
    by_name = {t.term: t for t in load_terms()}
    return [by_name[n] for n in FEATURED if n in by_name]
