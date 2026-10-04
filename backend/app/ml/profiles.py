"""Perfiles = los 6 clusters de tarjetas del modelo (columna `Cluster` del Excel, D9).

Nombres y textos viven en data/clusters.json (editables sin tocar codigo).
"""

import json
from dataclasses import dataclass
from functools import lru_cache

from app.core.config import DATA_DIR
from app.domain.models import CardRecord

MODEL_VERSION = "ward-k6"
IS_STUB = False
MODEL_DESCRIPTION = (
    "Clustering jerárquico (Ward) sobre 59 variables de costos, requisitos, comisiones y beneficios, "
    "reducidas a 12 componentes principales. Resultado: 6 perfiles de tarjetas."
)
FEATURES = ["costos", "requisitos", "comisiones", "beneficios"]


@dataclass(frozen=True, slots=True)
class Profile:
    id: int
    key: str
    label: str
    analytic_name: str
    tagline: str
    description: str
    color: str
    icon: str
    traits: tuple[str, ...]
    caution: str


@lru_cache
def _load() -> tuple[Profile, ...]:
    raw = json.loads((DATA_DIR / "clusters.json").read_text(encoding="utf-8"))["profiles"]
    return tuple(Profile(**{**p, "traits": tuple(p["traits"])}) for p in raw)


PROFILES: tuple[Profile, ...] = _load()
PROFILES_BY_ID = {p.id: p for p in PROFILES}


def assign_card_profile(card: CardRecord) -> Profile:
    """Perfil de la tarjeta = su cluster en el Excel (sin cluster: el de costo bajo)."""
    return PROFILES_BY_ID.get(card.cluster if card.cluster is not None else 1, PROFILES[1])
