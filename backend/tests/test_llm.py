"""Capa LLM con un cliente OpenAI FALSO (sin red)."""

import json
from types import SimpleNamespace

import httpx
import pytest

from app.agents import llm
from app.core.privacy import mask_personal_data
from app.domain.glossary import find_terms
from app.tools.registry import run_tool

API = "/api/v1"


class FakeResponses:
    def __init__(self, plan: llm.PlanOut | None, answer: str) -> None:
        self.plan = plan
        self.answer = answer
        self.calls: list[dict] = []

    async def parse(self, **kwargs):  # noqa: ANN003
        self.calls.append({"kind": "parse", **kwargs})
        return SimpleNamespace(output_parsed=self.plan)

    async def create(self, **kwargs):  # noqa: ANN003
        self.calls.append({"kind": "create", **kwargs})
        return SimpleNamespace(output_text=self.answer)


def _install(monkeypatch: pytest.MonkeyPatch, plan: llm.PlanOut | None, answer: str) -> FakeResponses:
    fake = FakeResponses(plan, answer)
    monkeypatch.setattr(llm, "get_client", lambda: SimpleNamespace(responses=fake))
    return fake


def _step(sid: str, tool: str, args: dict, depends: list[str] | None = None) -> llm.PlannedStep:
    return llm.PlannedStep(
        id=sid, tool=tool, args_json=json.dumps(args), depends_on=depends or [], rationale="x"
    )


def test_glossary_and_privacy() -> None:
    assert find_terms("¿Qué es el CAT?")[0].term == "Costo Anual Total (CAT)"
    assert find_terms("explícame la fecha de corte")[0].term == "Fecha de corte"
    data = run_tool("search_glossary", [], {"query": "seguro por robo o extravío"}).data
    assert data["terms"] and "note" in data["terms"][0]
    masked, flag = mask_personal_data("mi tarjeta 4152 3133 1234 5678 y CURP GODE561231HDFRRN09")
    assert flag and "4152" not in masked and "GODE" not in masked
    assert mask_personal_data("¿cuánto cobra de anualidad?") == ("¿cuánto cobra de anualidad?", False)


async def test_llm_plan_and_narration(client: httpx.AsyncClient, user_headers, monkeypatch) -> None:
    plan = llm.PlanOut(
        steps=[
            _step("a", "get_card_details", {"card_id": "002"}),
            _step("b", "get_card_fees", {"card_id": "002", "extra": 1}, ["a"]),
        ]
    )
    fake = _install(monkeypatch, plan, "### Black Unlimited\nRespuesta redactada por el LLM.")
    body = {"message": "¿Qué cobra la Black?", "session_id": "llm1"}
    p = (await client.post(f"{API}/chat/plan", json=body, headers=user_headers)).json()
    assert p["mode"] == "llm"
    assert [s["tool"] for s in p["plan"]] == ["get_card_details", "get_card_fees"]
    assert p["plan"][1]["depends_on"] == ["s1"] and "extra" not in p["plan"][1]["args"]
    run = (await client.post(f"{API}/chat/runs/{p['run_id']}/execute", headers=user_headers)).json()
    assert run["answer"].startswith("### Black Unlimited") and run["mode"] == "llm"
    narr = next(c for c in fake.calls if c["kind"] == "create")
    assert "Black Unlimited" in narr["input"]  # el narrador recibe los datos de las tools
    assert "datos personales" in narr["instructions"]


async def test_invalid_llm_plan_falls_back_to_rules(
    client: httpx.AsyncClient, user_headers, monkeypatch
) -> None:
    bad = llm.PlanOut(steps=[_step("a", "get_card_details", {"card_id": "999"})])
    _install(monkeypatch, bad, "")
    body = {"message": "¿Qué es el pago mínimo?", "session_id": "llm2"}
    p = (await client.post(f"{API}/chat/plan", json=body, headers=user_headers)).json()
    assert p["mode"] == "rules"
    run = (await client.post(f"{API}/chat/runs/{p['run_id']}/execute", headers=user_headers)).json()
    assert run["status"] == "ok" and "pago mínimo" in run["answer"].lower()


async def test_personal_data_is_masked(client: httpx.AsyncClient, user_headers) -> None:
    body = {"message": "Mi RFC es GODE561231AB1, ¿qué es el CAT?", "session_id": "pii"}
    p = (await client.post(f"{API}/chat/plan", json=body, headers=user_headers)).json()
    run = (await client.post(f"{API}/chat/runs/{p['run_id']}/execute", headers=user_headers)).json()
    assert "GODE561231AB1" not in run["question"]
    assert "omití un dato personal" in run["answer"]


async def test_topics(client: httpx.AsyncClient, user_headers) -> None:
    t = (await client.get(f"{API}/chat/topics", headers=user_headers)).json()
    assert len(t["featured"]) >= 10 and t["total_terms"] > 50


async def test_ask_single_request(client: httpx.AsyncClient, user_headers) -> None:
    body = {"message": "¿Qué es el pago mínimo?", "session_id": "ask1"}
    run = (await client.post(f"{API}/chat/ask", json=body, headers=user_headers)).json()
    assert run["status"] == "ok" and "pago mínimo" in run["answer"].lower() and run["plan"]
