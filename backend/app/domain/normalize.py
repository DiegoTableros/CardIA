"""Normalizacion de encabezados y valores del Excel fuente.

Funcion unica compartida por el ETL (scripts/build_data.py), los notebooks y el backend.
"""

import re
import unicodedata

FEE_TYPE_KEYS = {
    "obligatoria": "obligatoria",
    "por evento": "por_evento",
    "penalizacion": "penalizacion",
}

DENOMINATION_KEYS = {
    "pesos": "MXN",
    "dolares": "USD",
    "del monto de la transaccion": "PCT",
}


def strip_accents(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def normalize_header(header: object) -> str:
    """'CAT\\npublicidad\\n(%)' -> 'cat_publicidad'; 'Anualidad\\n($)*' -> 'anualidad'."""
    text = strip_accents(str(header or "")).lower()
    text = re.sub(r"\(.*?\)", " ", text)
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def slug(text: str) -> str:
    return normalize_header(text).replace("_", "-")


def to_float(value: object) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, int | float):
        return float(value)
    cleaned = re.sub(r"[^0-9.\-]", "", str(value))
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def to_int(value: object) -> int | None:
    f = to_float(value)
    return int(round(f)) if f is not None else None


def fee_type_key(raw: object) -> str:
    return FEE_TYPE_KEYS.get(strip_accents(str(raw or "")).strip().lower(), "otro")


def denomination_key(raw: object) -> str:
    return DENOMINATION_KEYS.get(strip_accents(str(raw or "")).strip().lower(), "MXN")


def clean_benefit_text(benefit_type: str, text: str) -> str:
    """El Excel repite el tipo al inicio del texto ('Puntos Puntos Premia...')."""
    t = (text or "").strip()
    if benefit_type and t.lower().startswith(benefit_type.lower()):
        t = t[len(benefit_type) :].strip(" :.-")
    return re.sub(r"\s+", " ", t)
