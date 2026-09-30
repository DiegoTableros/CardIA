"""Perfiles (clusters) de tarjetas.

STUB (D9): asignacion por reglas mientras se entrena el pipeline de clustering real
(notebooks/02_clustering.ipynb). Al tener el pipeline, `assign_card_profile` se reemplaza por
`pipeline.predict(features(card))` y las etiquetas se re-interpretan a partir de los centroides.
"""

from dataclasses import dataclass

from app.domain.models import CardRecord

MODEL_VERSION = "stub-0.1"
IS_STUB = True
FEATURES = [
    "annual_fee",
    "interest_rate",
    "cat",
    "credit_line_min",
    "monthly_income_min",
    "benefit_types",
]


@dataclass(frozen=True, slots=True)
class Profile:
    id: int
    key: str
    label: str
    tagline: str
    description: str
    color: str
    icon: str
    traits: tuple[str, ...]


PROFILES: tuple[Profile, ...] = (
    Profile(
        id=0,
        key="arranque",
        label="Arranque",
        tagline="Tu primera tarjeta, sin complicaciones",
        description=(
            "Tarjetas de costo bajo y requisitos accesibles, pensadas para construir historial crediticio. "
            "Líneas de crédito iniciales pequeñas y anualidad baja o nula."
        ),
        color="#10b981",
        icon="sprout",
        traits=("Anualidad baja o nula", "Ingreso mínimo accesible", "Línea inicial pequeña"),
    ),
    Profile(
        id=1,
        key="cotidiana",
        label="Cotidiana",
        tagline="Para el día a día con algunos beneficios",
        description=(
            "Tarjetas de uso diario con anualidad moderada, descuentos, puntos y meses sin intereses. "
            "Tasas de interés altas: conviene pagar el total del periodo."
        ),
        color="#6366f1",
        icon="cart",
        traits=("Anualidad moderada", "MSI y descuentos", "Tasa de interés alta"),
    ),
    Profile(
        id=2,
        key="tasa_baja",
        label="Tasa baja",
        tagline="Si a veces financias tus compras",
        description=(
            "Tarjetas con tasa de interés y CAT por debajo del promedio del mercado. "
            "Útiles para quien no siempre paga el total, aunque financiar siempre cuesta."
        ),
        color="#0ea5e9",
        icon="percent",
        traits=("Tasa de interés baja", "CAT competitivo", "Transferencia de saldo"),
    ),
    Profile(
        id=3,
        key="premium",
        label="Premium viajero",
        tagline="Recompensas, viajes y seguros",
        description=(
            "Tarjetas de gama alta: más puntos, seguros y beneficios de viaje, a cambio de anualidades "
            "altas e ingresos mínimos elevados."
        ),
        color="#f59e0b",
        icon="plane",
        traits=("Anualidad alta", "Puntos y seguros", "Ingreso mínimo elevado"),
    ),
)

PROFILES_BY_ID = {p.id: p for p in PROFILES}


def assign_card_profile(card: CardRecord) -> Profile:
    """Regla provisional que emula los grupos esperados del clustering."""
    fee = card.annual_fee or 0.0
    rate = card.interest_rate if card.interest_rate is not None else 60.0
    line = card.credit_line_min or 0.0
    income = card.monthly_income_min or 0.0
    if fee >= 2500 or income >= 30000 or line >= 50000:
        return PROFILES_BY_ID[3]
    if rate <= 36:
        return PROFILES_BY_ID[2]
    if fee <= 600 or card.card_class == "Básica":
        return PROFILES_BY_ID[0]
    return PROFILES_BY_ID[1]
