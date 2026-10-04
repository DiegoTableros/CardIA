"""perfilamiento_clusters.docx -> backend/data/cluster_report.json (texto tal cual, para la vista admin).

Uso: uv run python -m scripts.build_cluster_report
"""

import json
import re

import docx
from docx.oxml.ns import qn

from app.core.config import DATA_DIR, REPO_DIR

SOURCE = REPO_DIR / "perfilamiento_clusters.docx"
OUT = DATA_DIR / "cluster_report.json"

METHOD = [
    "El usuario responde el cuestionario (edad, ingreso, historial, uso, forma de pago, preferencias e intereses).",
    "Cada tarjeta se resume en 9 dimensiones entre 0 y 1: anualidad, tasa, comisiones, puntos, viaje, promociones, "
    "MSI, transferencia de saldo y requisitos accesibles. Se calculan con las variables de ingeniería "
    "(benef_*, com_*) y se escalan por percentiles 5-95 para que los extremos no aplanen la escala.",
    "Las respuestas se convierten en pesos por dimensión (p. ej. evitar anualidad pesa 6.0; quien financia pesa "
    "más la tasa; cada interés marcado suma peso a su dimensión). Se pueden elegir varios intereses.",
    "Elegibilidad: se descartan las tarjetas cuyos requisitos publicados no cumple (edad, ingreso, score). "
    "Si falta un dato del usuario o de la tarjeta, queda «por confirmar» y su puntaje baja 8%.",
    "Puntaje de tarjeta = 75% utilidad propia (suma ponderada de dimensiones) + 25% afinidad de su cluster "
    "(utilidad media de las tarjetas del cluster, ajustada por elegibilidad). Si el usuario evita anualidad, "
    "las tarjetas con anualidad se multiplican por 0.75.",
    "Perfil del usuario = cluster de la tarjeta mejor calificada (Top 1). Al usuario solo se le muestra el orden "
    "Top 1, Top 2, ... y no el puntaje.",
    "Advertencias (sin penalización extra): anualidad contra lo que pidió, tasa o CAT altos si no paga el total, "
    "comisiones altas si las quiere evitar, y beneficios buscados que la tarjeta no ofrece. Las tarjetas "
    "periféricas de su cluster solo se advierten; no se degradan.",
]


def main() -> None:
    d = docx.Document(str(SOURCE))
    intro: list[dict[str, str]] = []
    closing: list[dict[str, str]] = []
    clusters: dict[int, dict] = {}
    current: list[dict[str, str]] = intro
    for p in d.paragraphs:
        text = p.text.strip()
        if not text:
            continue
        m = re.match(r"^Cluster\s+(\d+)\s+—\s*(.*)$", text)
        if m:
            title = m.group(2).replace("“”", "").strip(" —")
            blocks: list[dict[str, str]] = []
            clusters[int(m.group(1))] = {"id": int(m.group(1)), "title": title, "blocks": blocks}
            current = blocks
            continue
        if text.startswith("Cómo leer los seis clusters"):
            current = closing
            closing.append({"kind": "h", "text": text})
            continue
        kind = (
            "li"
            if "List" in (p.style.name if p.style is not None else "")
            or p._p.pPr is not None
            and p._p.pPr.find(qn("w:numPr")) is not None
            else "p"
        )
        current.append({"kind": kind, "text": text})
    out = {
        "source": SOURCE.name,
        "method": METHOD,
        "intro": intro,
        "closing": closing,
        "clusters": [clusters[k] for k in sorted(clusters)],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"OK {len(clusters)} clusters, {sum(len(c['blocks']) for c in clusters.values())} bloques -> {OUT}")


if __name__ == "__main__":
    main()
