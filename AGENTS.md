# AGENTS.md - CardIA

Guia para agentes (OpenCode, Cursor) que trabajen en este repo. Leer completo antes de tocar codigo.
Si algo aqui contradice el prompt del usuario, gana el prompt del usuario, pero avisa de la contradiccion.

## 1. Que es CardIA

Aplicacion **educativa** de finanzas personales sobre tarjetas de credito en Mexico.

Flujo principal:
1. El usuario llena un formulario (edad, ingreso, score, antiguedad laboral/residencial, preferencias).
2. Un pipeline de ML **no supervisado** (clustering) agrupa las 69 tarjetas en tipos y asigna el perfil del usuario a un cluster.
3. La app recomienda tarjetas, indica el cluster, y muestra beneficios, comisiones y requisitos.
4. Un **chatbot LLM (OpenAI)** conversa con el usuario y usa **tools** para consultar la base de tarjetas.

Contexto academico: proyecto final de un diplomado de machine learning. Debe integrar un modelo de ML con agentes IA.
Repo destino: https://github.com/DiegoTableros/CardIA
Referencia de estructura (del profesor): https://github.com/FernandoBRdgz/inverai

> CardIA es una herramienta educativa, NO un asesor financiero. No se garantiza aprobacion de credito ni se hacen
> recomendaciones vinculantes. Toda respuesta con recomendacion o comparacion lleva disclaimer.

## 2. Stack decidido

| Capa | Tecnologia |
|---|---|
| Frontend | Angular 22+ SOLO standalone (signals) + Tailwind. `src/app/{core,shared,features,viz}` |
| Backend | Python 3.12, FastAPI, Pydantic v2 (structured outputs), SQLAlchemy 2.0 async + SQLite (aiosqlite), httpx |
| ML | scikit-learn (clustering), joblib para serializar el pipeline |
| Agentes / chat | SDK oficial `openai`, tool calling, orquestador con plan explicito |
| Datos | Excel -> seed de SQLite (datos estaticos). Comisiones ERCO Banxico (TBD, descarga manual) |
| Contratos | `/openapi.json` -> tipos TS con `openapi-typescript` (`make contracts`) |
| Infra | Monorepo, Docker + docker compose, Makefile |
| Despliegue | Vercel (frontend estatico + backend FastAPI serverless, SQLite efimero) |
| Gestion Python | `uv` |

Versiones: **Python 3.12** (compatible con Vercel y wheels de scikit-learn). Node LTS. No usar versiones "ultimas" de Python.
Fijar versiones exactas al crear `pyproject.toml` / `package.json` y anotarlas aqui en la seccion 8.

## 3. Estructura objetivo del repo

```
CardIA/
  AGENTS.md
  opencode.json
  README.md
  .env.example            # plantilla, sin secretos
  .gitignore
  Makefile                # (opcional) setup, dev, test, lint
  vercel.json
  backend/
    app/
      main.py
      api/v1/             # routers: auth, cards, compare, recommend, chat, admin, bi, meta
      agents/             # orquestador (plan) + Fundamentals, Comisiones, Educative, Perfil
      tools/              # tools que consultan la base de tarjetas
      domain/             # modelos de dominio y reglas (normalizacion de datos)
      ml/                 # clustering, features, recommend() (sustituye a `valuation/` de InverAI)
      services/           # logica de negocio, repositorio
      schemas/            # modelos Pydantic v2
      db/                 # modelos SQLAlchemy, sesion, seed
      core/               # config, seguridad (JWT), errores, disclaimer
    data/                 # artefactos de solo lectura para el seed
    models/               # pipeline.joblib + metadata (version, features, fecha)
    tests/
    pyproject.toml
  frontend/
    src/app/{core,shared,features,viz}
    package.json
  notebooks/
    01_eda.ipynb
    02_clustering.ipynb   # el notebook del diplomado
  datos_consolidados/     # Excel fuente versionado
  datos/                  # fuentes originales (PDFs, CONDUSEF, Banxico): NO versionar (ver .gitignore)
```

Los notebooks y el backend deben compartir la misma logica de features. El backend importa, no copia, el codigo de preprocesamiento.

## 4. Datos

Fuente principal: `datos_consolidados/tarjetas.xlsx` (tambien existe `tarjetas_v1.0.xlsx`, respaldo: no modificar).

Hojas de trabajo, todas relacionadas por `ID_Tarjeta`:

| Hoja | Filas aprox. | Columnas |
|---|---|---|
| `Tarjetas` | 69 | ID_Tarjeta, Nombre de la tarjeta, Institucion, CAT publicidad (%), Anualidad ($), Tasa de interes de contrato (%), Linea de credito desde ($), Clase, Duplicado, Conteo requisitos, Conteo comisiones, Conteo beneficios |
| `Requisitos` | 69 | Tarjeta, Edad minima, Edad maxima, Score de credito minimo, Antiguedad laboral minima, Antiguedad residencial minima, Ingreso mensual minimo, ID_Tarjeta |
| `Comisiones` | 652 | Tarjeta, Concepto, Monto, Denominacion, Tipo (penalizacion / por evento / obligatoria), ID_Tarjeta |
| `Beneficios` | 316 | Tarjeta, Tipo, Texto (descriptivo), ID_Tarjeta |

Hojas de respaldo (no usar para el modelo): `88_BANXICO`, `48_BANXICO`, `PDFs Banxico`.

Reglas de datos:
- Los encabezados tienen saltos de linea y caracteres especiales (`\n`, `*`, `($)`). Normalizarlos a `snake_case` sin acentos en una sola funcion.
- La columna `Duplicado` existe: revisar antes de clusterizar.
- Hay valores faltantes (requisitos sin dato, tasas no publicadas). Documentar la estrategia de imputacion en el notebook; nunca inventar valores en silencio.
- El Excel se abre con `openpyxl`. Si Excel lo tiene abierto existe `~$tarjetas.xlsx`: pedir al usuario que lo cierre.
- **Nunca** leer el Excel en tiempo de request. El proceso de datos lo convierte a artefactos en `backend/data/` y el backend solo lee esos.
- No versionar `datos/` (PDFs pesados y fuentes crudas) salvo que el usuario lo pida.

## 5. Decisiones de arquitectura (no cambiar sin avisar)

- **D1 - SQLite efimero en Vercel (decidido 2026-09-29).** Local/Docker: SQLite en archivo. Vercel: SQLite en `/tmp`,
  se re-siembra en cada cold start; usuarios, trazas y planes de chat se pierden al reiniciar (aceptado: es demo).
  Historial de chat tambien en el cliente (localStorage). El seed debe ser rapido e idempotente.
- **D2 - Backend ligero.** Limite de tamano de funcion en Vercel (~250 MB descomprimido). Dependencias minimas en
  runtime: evitar `matplotlib`, `seaborn`, `jupyter`, `plotly` y similares fuera del grupo `dev`. Valorar no depender de `pandas` en inferencia.
- **D3 - El LLM nunca calcula ni inventa datos de tarjetas.** Todo dato (anualidad, tasa, requisitos, beneficios)
  viene de una tool que consulta la base. El cluster y las recomendaciones vienen del pipeline de ML, no del LLM.
- **D4 - Pipeline de ML reproducible y llamable.** Un unico objeto/funcion `recommend(profile) -> resultado`
  con: cluster asignado, tarjetas recomendadas con score, y explicacion. Artefacto versionado con metadata
  (features, version de sklearn, fecha, semilla).
- **D5 - Contrato API estable.** Modelos Pydantic v2 para toda entrada/salida. El frontend consume tipos generados
  desde el OpenAPI, no escritos a mano.
- **D6 - Disclaimer siempre.** Respuestas de recomendacion y de chat incluyen el aviso de herramienta educativa.
- **D7 - Sin secretos en el repo.** `OPENAI_API_KEY` solo en `.env` local y en variables de entorno de Vercel.
- **D8 - Plan explicito antes de ejecutar.** El orquestador devuelve el plan (tool calls + dependencias) y el front lo muestra.
- **D9 - Un solo modelo.** El "perfil de cliente" es la etiqueta interpretada del cluster. Mientras no exista el pipeline,
  `recommend()` usa un stub con el mismo contrato.
- **D10 - Sin cashback en el formulario.** El Excel no tiene ese tipo de beneficio.
- **D11 - Alcance prohibido.** Sin scraping, sin conexion a bancos, sin ejecucion de ordenes, sin datos sensibles
  (nada de RFC, CURP, cuentas). Sin sugerir contratar. Datos ERCO se descargan a mano.

## 6. Convenciones de codigo

Python:
- Formato y lint con `ruff`. Tipado con type hints en todo codigo de `app/`.
- Tests con `pytest`. Sin llamadas de red en tests (mockear OpenAI). Cada tool y el endpoint de recomendacion deben tener tests.
- Semilla fija (`random_state`) en todo el ML.
- Nombres de codigo en ingles; textos de UI, docstrings de usuario y mensajes al usuario en **espanol de Mexico**.

Frontend:
- Solo componentes standalone, senales (`signal()`), sin NgModules.
- Estilos con Tailwind; sistema de diseno con tokens en un solo archivo de estilos.
- UI en espanol, moderna, llamativa y responsive (mobile first). Estados de carga, error y vacio en cada vista.
- Accesibilidad basica: contraste, labels en formularios, foco visible.

Git:
- Commits pequenos y descriptivos (imperativo, en espanol o ingles, pero consistente).
- No commitear: `.env`, `node_modules`, `.venv`, `datos/`, checkpoints de notebooks, `~$*.xlsx`.
- Los notebooks se guardan con salidas limpias o ligeras.

## 7. Flujo de trabajo para agentes

1. Antes de escribir codigo, lee este archivo y el prompt de la fase actual.
2. Usa la lista de tareas (todo) para tareas de 3 o mas pasos.
3. Verifica lo que construyes: ejecuta tests, lint y build antes de dar algo por terminado.
4. Cambios en datos o esquema de features -> reentrenar y regenerar artefactos, actualizar tests y documentar.
5. No hagas `git push`, no despliegues a produccion ni instales software global sin confirmacion del usuario.
6. Si encuentras una trampa o decision nueva (bug de version, limitacion de Vercel, etc.), agregala a la seccion 8.

### Estilo de respuesta (ahorro de tokens)

- Responde corto: resultado y proximos pasos, sin resumenes largos ni repetir lo que ya se dijo.
- No pegues archivos completos ni salidas largas de comandos; resume y cita `archivo:linea`.
- Lee solo lo necesario (usa `offset`/`limit` o grep); no releas archivos ya leidos.
- Comandos con salida acotada (`| Select-Object -First N`, `--quiet`, `-q`).
- Pregunta solo si hay una decision real; no pidas confirmacion de pasos triviales.

### Git

- Commits y push **siempre con confirmacion del usuario** (configurado como `ask` en `opencode.json`).
- Antes de proponer un commit: `git status`, `git diff --stat` y mensaje corto en imperativo.
- Nunca `--force`, nunca `--no-verify`, nunca commitear secretos.

## 8. Trampas y decisiones verificadas

- 2026-09-29 - El equipo de desarrollo (Windows) no tenia Python, Node, git, gh ni uv en el PATH al iniciar. Ver README para setup.
- 2026-09-29 - Instalados: Python 3.12.10, uv 0.12.21, Node 24.19.0, npm 11.17.0, git 2.55, gh 2.101, make (ezwinports). Docker pendiente (fase 6).
- 2026-09-29 - `npm.ps1` bloqueado por ExecutionPolicy: resuelto con `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- 2026-09-29 - Datos: 69 tarjetas, sin duplicados. Clase: Clasica 27, Oro 21, Platino 18, Basica 2, Todas 1.
  Requisitos faltantes: score 31/69, antig. laboral 27/69, antig. residencial 44/69, ingreso 3/69, edad max 2/69.
  Beneficios: MSI 168, Descuentos 44, Puntos 42, Preventas 25, Transf. saldo 22, Seguros 9, Anualidad 6. No hay cashback.
- 2026-09-30 - `datos/comisiones.xls` CONFIRMADO como descarga ERCO (Banxico). 2176 filas, 23 cols, encabezado en
  filas 3-4 (celdas combinadas). NO tiene `ID_Tarjeta`: cruzar por `Entidad Financiera` + `Nombre del producto`.
  Pendiente de integrar (ComisionesAgent). Se lee con `xlrd` (formato .xls).
- 2026-09-30 - Versiones fijadas. Backend (uv.lock): fastapi 0.142, pydantic 2.13, pydantic-settings 2.15,
  sqlalchemy 2.1 (async), aiosqlite 0.22, openai 3.22, pyjwt 2.15, argon2-cffi 25.1, pytest 9.1, ruff 0.16.
  Frontend: Angular 22.2 (CLI), TypeScript 6.0, tailwindcss 4.3.3 (+ @tailwindcss/postcss), vitest 5.
- 2026-09-30 - `openapi-typescript@7.13` declara peer `typescript@^5` y choca con TS 6 de Angular 22: NO instalarlo
  como devDependency; se ejecuta con `npx -y openapi-typescript@7.13.0` en `make contracts`. Nunca `npm i typescript@latest`.
- 2026-09-30 - Tailwind v4: una clase propia que se reutiliza con `@apply` (p. ej. `btn`, `surface`) debe declararse con
  `@utility`, no dentro de `@layer components`, o falla "Cannot apply unknown utility class".
- 2026-09-30 - Tailwind con Angular 22: `.postcssrc.json` con `@tailwindcss/postcss` + `@import "tailwindcss"` en
  `styles.css` (guia oficial angular.dev/guide/tailwind).
- 2026-09-30 - Dev: el front usa `proxy.conf.json` (`/api` -> `127.0.0.1:8000`), asi no hay CORS en local.
- 2026-09-30 - Guards de Angular devuelven `UrlTree`, nunca `false` (evita pantalla en blanco).
- 2026-09-30 - JWT: pyjwt avisa si el secreto HMAC tiene < 32 bytes; usar secretos largos.
- 2026-09-30 - Stub de recomendacion: con `avoid_annual_fee`, el perfil pasa a Arranque, penalizacion x0.7 a tarjetas con
  anualidad y escala de costo con tope $3,000 (sin eso, el peso del perfil dejaba fuera a las tarjetas de $0). Test en
  `tests/test_domain.py::test_avoid_annual_fee_prioritizes_zero_fee_cards`.
- 2026-09-30 - El chat hoy corre en modo `rules` (planner + narrador deterministas con las mismas tools y el mismo
  contrato `PlanStep`). La fase 4 cambia planner/narrador por OpenAI sin tocar tools ni frontend.
- 2026-09-30 - Algunos nombres del Excel vienen crudos (`Plata_Credito_Basico_531722`, `Tarjeta de Credito Basica`).
  Corregirlos en el Excel y correr `make data` (no se renombran en codigo).

## 9. Comandos

| Comando | Que hace |
|---|---|
| `make setup` | `uv sync` (backend) + `npm install` (frontend) |
| `make data` | Excel -> `backend/data/cards.json` (falla si el Excel esta abierto) |
| `make seed` | Esquema + tarjetas + usuarios en SQLite (idempotente; tambien corre al arrancar la API) |
| `make dev` | API :8000 + front :4200 (o por separado: `make dev-backend`, `make dev-frontend`) |
| `make test` | pytest (23) + vitest (3) |
| `make lint` / `make format` | ruff + tsc / ruff format + prettier |
| `make contracts` | `/openapi.json` -> `frontend/src/app/core/api/schema.d.ts` |
| `make build` | Build de produccion del front (`frontend/dist/`) |

Usuarios semilla: `admin@cardia.local / admin1234` (admin) y `demo@cardia.local / demo1234`.

API (`/api/v1`): `meta/health`, `meta/disclaimer`, `auth/{login,me,logout}`, `cards`, `cards/facets`, `cards/{id}`,
`compare`, `recommend`, `chat/plan`, `chat/runs/{id}/execute`, `chat/runs/{id}`, `chat/runs`, `bi`,
`admin/{overview,events,chat-runs,users}`. Todo excepto `meta/*` y `auth/login` requiere Bearer.

Rutas front: `/login`, `/` (home), `/tarjetas`, `/tarjetas/:id`, `/comparar`, `/para-ti`, `/asistente`, `/perfiles` (BI),
`/admin` (solo admin).

## 10. Estado del proyecto

- [x] Excel consolidado con 69 tarjetas (`datos_consolidados/tarjetas.xlsx`)
- [x] Entorno instalado (Python 3.12, uv, Node, git, gh, make). Falta Docker (fase 6)
- [x] Repo git inicializado (`main`). Falta conectar remoto y primer commit (con permiso del usuario)
- [x] Fase 0: monorepo, uv, Angular 22, Makefile, `.env.example`, `.gitignore`
- [x] Fase 1: ETL Excel -> JSON -> SQLite (seed idempotente), esquemas Pydantic
- [ ] Fase 2: EDA y notebook de clustering, pipeline joblib (hoy `recommend()` es STUB por reglas, `app/ml/`)
- [x] Fase 3: API v1 completa + trazabilidad + tests
- [~] Fase 4: orquestador con plan explicito + 7 tools + 4 agentes en modo reglas. Falta LLM (OpenAI) y ERCO
- [x] Fase 5 (v1): UI completa: login, home, catalogo, detalle, comparador, recomendador, chat, BI, admin
- [ ] Fase 6: Docker compose + Vercel
