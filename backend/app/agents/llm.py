"""Planner y narrador con el SDK oficial de OpenAI (Responses API).

- El planner devuelve un plan estructurado (structured outputs con Pydantic) que se VALIDA contra el
  registro de tools y el catalogo antes de aceptarse (D8). Si falla, el orquestador usa el planner por reglas.
- El narrador redacta la respuesta SOLO con los resultados de las tools (D3). Si falla, se usa el narrador
  por reglas. Nunca se lanza una excepcion de OpenAI hacia el usuario.
"""

import json
import logging
from typing import Any

from openai import AsyncOpenAI, BadRequestError, OpenAIError
from pydantic import BaseModel, Field, ValidationError

from app.core.config import get_settings
from app.domain.models import CardRecord
from app.schemas.chat import PlanStep
from app.tools.registry import TOOLS

log = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI | None:
    """Cliente OpenAI o None si no hay clave (los tests lo sustituyen con un falso)."""
    global _client
    s = get_settings()
    if not s.llm_enabled:
        return None
    if _client is None:
        _client = AsyncOpenAI(api_key=s.openai_api_key, timeout=s.llm_timeout_seconds, max_retries=1)
    return _client


# ---------------------------------------------------------------- planner


class PlannedStep(BaseModel):
    id: str = Field(description="Identificador corto: s1, s2, ...")
    tool: str = Field(description="Nombre exacto de una herramienta disponible")
    args_json: str = Field(description="Argumentos de la herramienta como objeto JSON serializado")
    depends_on: list[str] = Field(description="IDs de pasos previos de los que depende")
    rationale: str = Field(description="Por qué se necesita este paso, en español, una frase")


class PlanOut(BaseModel):
    steps: list[PlannedStep]


PLANNER_INSTRUCTIONS = """Eres el planificador de CardIA, un asistente de educación financiera sobre tarjetas de
crédito en México. NO respondes al usuario: decides qué herramientas consultar para poder responder.

Reglas:
- Usa solo herramientas de la lista y argumentos válidos según su esquema. `args_json` es un objeto JSON.
- Para tarjetas concretas usa el `card_id` exacto del catálogo (nunca inventes IDs). Máximo 4 tarjetas por comparación.
- Preguntas de concepto (pago mínimo, CAT, fecha de corte, seguros, beneficios...): usa `get_education_topic`
  si hay un tema que coincida y/o `search_glossary` con el término.
- Preguntas de comisiones o de "qué pasa si la tengo contratada": `get_card_fees`.
- Preguntas sobre perfiles o resultados de "Encuentra tu tarjeta": `explain_profiles` y/o `get_card_profile`.
- Búsquedas ("tarjetas sin anualidad", "con puntos", "de Banamex"): `search_cards` con filtros.
- Declara `depends_on` cuando un paso use el contexto de otro (p. ej. comisiones después de la ficha).
- Mínimo de pasos necesarios (máximo {max_steps}). Saludos o mensajes sin contenido financiero: lista vacía.
- Usa la conversación previa para resolver referencias como "esa tarjeta" o "y la otra".
"""

NARRATOR_INSTRUCTIONS = """Eres CardIA, un asistente de educación financiera sobre tarjetas de crédito en México.

Cómo responder:
- Español de México, cálido, claro y directo. Explica como a alguien que nunca ha tenido tarjeta.
- Formato markdown simple: párrafos cortos, **negritas**, listas, encabezados ### y tablas cuando comparas.
- Cifras de tarjetas (anualidad, CAT, tasa, comisiones, requisitos, beneficios): usa EXCLUSIVAMENTE los datos de
  RESULTADOS. Si un dato no viene o es nulo, di que no está publicado. Nunca inventes ni estimes cifras de tarjetas.
- Conceptos: apóyate en el glosario oficial de CONDUSEF y los temas incluidos en RESULTADOS. Los ejemplos numéricos
  son solo ilustrativos y debes decir que lo son.
- Montos en pesos con formato $1,234. Las comisiones con denominación PCT son porcentaje del monto.

Límites (obligatorios):
- Nunca pidas datos personales (nombre, RFC, CURP, números de tarjeta o cuenta, CLABE, NIP, contraseñas, domicilio,
  teléfono, correo). Para orientar solo se necesitan rangos y preferencias como los de "Encuentra tu tarjeta".
  Si el usuario comparte datos personales, recuérdale amablemente que no lo haga y no los repitas.
- No digas que el usuario debe contratar o solicitar una tarjeta, ni garantices aprobación. Puedes comparar y
  explicar ventajas, riesgos y para quién suele convenir cada opción.
- No te promociones ni digas "en CardIA puedes...". No menciones herramientas, agentes, planes, modelos ni bases.
- No agregues avisos legales al final: la aplicación ya los muestra.
- Si la pregunta no trata de tarjetas de crédito o finanzas personales, redirige con amabilidad.
"""


def _catalog_index(cards: list[CardRecord]) -> str:
    return "\n".join(f"{c.id} | {c.name} | {c.institution} | {c.card_class}" for c in cards)


def _tools_index() -> str:
    return "\n".join(
        f"- {t.name}: {t.description} Args: {json.dumps(t.parameters['properties'], ensure_ascii=False)}"
        for t in TOOLS.values()
    )


def _history_text(history: list[tuple[str, str]]) -> str:
    if not history:
        return "(sin conversación previa)"
    return "\n".join(f"Usuario: {q}\nCardIA: {a[:600]}" for q, a in history)


async def _call(kind: str, **kwargs: Any) -> Any:
    client = get_client()
    if client is None:
        return None
    s = get_settings()
    if s.llm_reasoning_effort:
        kwargs["reasoning"] = {"effort": s.llm_reasoning_effort}
    if kind == "create" and s.llm_verbosity:
        kwargs["text"] = {"verbosity": s.llm_verbosity}
    fn = client.responses.parse if kind == "parse" else client.responses.create
    try:
        return await fn(**kwargs)
    except BadRequestError:
        optional = [k for k in ("reasoning", "text") if k in kwargs and k != "text_format"]
        if not optional:
            raise
        for k in optional:  # modelos que no soportan razonamiento/verbosidad rechazan el parametro
            kwargs.pop(k)
        return await fn(**kwargs)


def validate_plan(raw: PlanOut, cards: list[CardRecord], max_steps: int) -> list[PlanStep]:
    """Convierte la salida del LLM en PlanSteps validos o lanza ValueError."""
    ids = {c.id for c in cards}
    steps: list[PlanStep] = []
    seen: set[str] = set()
    for i, s in enumerate(raw.steps[:max_steps], start=1):
        spec = TOOLS.get(s.tool)
        if spec is None:
            raise ValueError(f"Tool desconocida: {s.tool}")
        args = json.loads(s.args_json or "{}")
        if not isinstance(args, dict):
            raise ValueError("args_json no es un objeto")
        for req in spec.parameters.get("required", []):
            if req not in args:
                raise ValueError(f"{s.tool}: falta {req}")
        allowed = set(spec.parameters.get("properties", {}))
        args = {k: v for k, v in args.items() if k in allowed}
        card_refs = [args["card_id"]] if "card_id" in args else list(args.get("card_ids", []))
        if any(str(c) not in ids for c in card_refs):
            raise ValueError(f"{s.tool}: card_id inexistente")
        sid = f"s{i}"
        mapping = {old.id: f"s{j}" for j, old in enumerate(raw.steps[:max_steps], start=1)}
        depends = [mapping[d] for d in s.depends_on if d in mapping and mapping[d] in seen]
        steps.append(
            PlanStep(
                id=sid,
                agent=spec.agent,  # type: ignore[arg-type]
                tool=s.tool,
                args=args,
                depends_on=depends,
                rationale=s.rationale[:200],
            )
        )
        seen.add(sid)
    return steps


async def llm_plan(
    message: str, history: list[tuple[str, str]], cards: list[CardRecord]
) -> list[PlanStep] | None:
    s = get_settings()
    prompt = (
        f"HERRAMIENTAS:\n{_tools_index()}\n\nCATÁLOGO (id | nombre | institución | clase):\n"
        f"{_catalog_index(cards)}\n\nCONVERSACIÓN PREVIA:\n{_history_text(history)}\n\n"
        f"PREGUNTA ACTUAL:\n{message}"
    )
    try:
        resp = await _call(
            "parse",
            model=s.llm_model_fast,
            instructions=PLANNER_INSTRUCTIONS.format(max_steps=s.llm_max_plan_steps),
            input=prompt,
            text_format=PlanOut,
        )
        if resp is None or resp.output_parsed is None:
            return None
        return validate_plan(resp.output_parsed, cards, s.llm_max_plan_steps)
    except (OpenAIError, ValidationError, ValueError, json.JSONDecodeError, KeyError) as exc:
        log.warning("Planner LLM descartado, se usa el de reglas: %s", exc)
        return None


async def llm_narrate(
    message: str,
    history: list[tuple[str, str]],
    plan: list[PlanStep],
    results: dict[str, dict[str, Any]],
) -> str | None:
    s = get_settings()
    payload = [
        {
            "tool": st.tool,
            "status": st.status,
            "data": results.get(st.id),
            "error": st.summary if st.status == "error" else None,
        }
        for st in plan
    ]
    prompt = (
        f"CONVERSACIÓN PREVIA:\n{_history_text(history)}\n\nPREGUNTA:\n{message}\n\n"
        f"RESULTADOS (JSON):\n{json.dumps(payload, ensure_ascii=False, default=str)}"
    )
    try:
        resp = await _call("create", model=s.llm_model, instructions=NARRATOR_INSTRUCTIONS, input=prompt)
        text = (getattr(resp, "output_text", "") or "").strip() if resp is not None else ""
        return text or None
    except OpenAIError as exc:
        log.warning("Narrador LLM descartado, se usa el de reglas: %s", exc)
        return None
