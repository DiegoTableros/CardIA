# CardIA - comandos del monorepo. Recetas compatibles con cmd (Windows) y sh.

.PHONY: help setup setup-backend setup-frontend data seed dev dev-backend dev-frontend test test-backend test-frontend lint format contracts build

help:
	@echo setup      - instala dependencias (uv + npm)
	@echo data       - Excel -> backend/data/cards.json
	@echo seed       - crea esquema y siembra SQLite
	@echo dev        - backend :8000 + frontend :4200
	@echo test       - pytest + vitest
	@echo lint       - ruff + tsc
	@echo contracts  - OpenAPI -> frontend/src/app/core/api/schema.d.ts
	@echo build      - build de produccion del frontend

setup: setup-backend setup-frontend

setup-backend:
	cd backend && uv sync

setup-frontend:
	cd frontend && npm install

data:
	cd backend && uv run python -m scripts.build_data

seed:
	cd backend && uv run python -m app.db.seed

dev:
	npx -y concurrently@9 -n api,web -c cyan,magenta "make dev-backend" "make dev-frontend"

dev-backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm start

test: test-backend test-frontend

test-backend:
	cd backend && uv run pytest -q

test-frontend:
	cd frontend && npx ng test --watch=false

lint:
	cd backend && uv run ruff check . && uv run ruff format --check .
	cd frontend && npx tsc -p tsconfig.app.json --noEmit

format:
	cd backend && uv run ruff format . && uv run ruff check . --fix
	cd frontend && npx prettier --write "src/**/*.{ts,html,css}"

contracts:
	cd backend && uv run python -m scripts.dump_openapi
	cd frontend && npx -y openapi-typescript@7.13.0 openapi.json -o src/app/core/api/schema.d.ts

build:
	cd frontend && npm run build
