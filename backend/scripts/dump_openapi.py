"""Exporta el OpenAPI de la app a frontend/openapi.json (usado por `make contracts`)."""

import json

from app.core.config import REPO_DIR
from app.main import create_app

OUT = REPO_DIR / "frontend" / "openapi.json"


def main() -> None:
    spec = create_app().openapi()
    OUT.write_text(json.dumps(spec, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"OpenAPI -> {OUT} ({len(spec['paths'])} rutas)")


if __name__ == "__main__":
    main()
