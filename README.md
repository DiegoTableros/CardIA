# CardIA

Plataforma **educativa** para entender, explorar y comparar las tarjetas de crédito del mercado mexicano, con
**machine learning** (perfiles de tarjeta por clustering) y un **asistente con agentes IA** que consulta la base de tarjetas.

> **Aviso.** CardIA es una herramienta educativa, no está afiliada a ninguna institución financiera y no es asesoría
> financiera. No garantiza la aprobación de ningún crédito ni sugiere contratar productos. Nunca pide datos sensibles.

## Qué responde

1. **¿Qué tarjetas hay y cómo son?** Catálogo visual, detalle con requisitos, beneficios y desglose de comisiones, y un
   dashboard comparativo.
2. **¿Cómo funciona una tarjeta?** Un asistente conversacional explica pago mínimo, pago para no generar intereses, CAT y
   más. Antes de responder muestra su **plan de consultas**.
3. **¿Qué tarjeta va conmigo?** Un formulario sencillo (rangos y preferencias) te ubica en un perfil y ordena las
   tarjetas por afinidad, con los supuestos a la vista.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python 3.12 · FastAPI · Pydantic v2 · SQLAlchemy 2 async + SQLite · OpenAI SDK · `uv` |
| Frontend | Angular 22 (standalone + signals) · Tailwind CSS 4 |
| ML | scikit-learn (clustering). **Hoy:** stub por reglas con el mismo contrato |
| Contratos | `/openapi.json` → tipos TS con `openapi-typescript` |

## Puesta en marcha (local)

Requisitos: Python 3.12, `uv`, Node 24 LTS y `make`.

```bash
cp .env.example .env     # opcional; hay valores por defecto para desarrollo
make setup               # dependencias backend + frontend
make dev                 # API http://localhost:8000 · UI http://localhost:4200
```

O en dos terminales:

```bash
make dev-backend         # uvicorn con recarga en :8000 (siembra la BD al arrancar)
make dev-frontend        # Angular en :4200 con proxy /api -> :8000
```

Cuentas de demo: `demo@cardia.local` / `demo1234` y `admin@cardia.local` / `admin1234`.

## Datos

- Fuente: `datos_consolidados/tarjetas.xlsx` (69 tarjetas; hojas Tarjetas, Requisitos, Comisiones y Beneficios).
- `make data` convierte el Excel en `backend/data/cards.json`. El backend **nunca** lee el Excel en tiempo de request.
- Al arrancar, la API siembra SQLite desde ese JSON (idempotente).

## Calidad

```bash
make test        # pytest (backend, sin red) + vitest (frontend)
make lint        # ruff + tsc
make contracts   # regenera los tipos TS desde el OpenAPI
```

## Estructura

```
backend/app/{api/v1, agents, tools, domain, ml, services, schemas, db, core}
backend/{data, scripts, tests}
frontend/src/app/{core, shared, features, viz}
datos_consolidados/   # Excel fuente
```

Las convenciones, decisiones y trampas verificadas están en [`AGENTS.md`](AGENTS.md).
