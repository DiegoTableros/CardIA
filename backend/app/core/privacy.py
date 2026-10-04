"""Proteccion de datos personales en el chat (D11): CardIA no los necesita ni los guarda."""

import re

MASK = "[dato omitido]"

_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b", re.IGNORECASE),  # CURP
    re.compile(r"\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b", re.IGNORECASE),  # RFC con homoclave
    re.compile(r"\b(?:\d[ -]?){13,19}\b"),  # numero de tarjeta / CLABE / cuenta
    re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"),  # correo
    re.compile(r"(?<!\d)(?:\+?52[ -]?)?(?:\d[ -]?){10}(?!\d)"),  # telefono MX
)

PRIVACY_NOTE = (
    "> Por tu seguridad omití un dato personal de tu mensaje. No compartas RFC, CURP, números de tarjeta, "
    "cuentas ni datos de contacto: para orientarte no los necesito."
)


def mask_personal_data(text: str) -> tuple[str, bool]:
    """Devuelve (texto_enmascarado, hubo_datos_personales)."""
    masked = text
    for pattern in _PATTERNS:
        masked = pattern.sub(MASK, masked)
    return masked, masked != text
