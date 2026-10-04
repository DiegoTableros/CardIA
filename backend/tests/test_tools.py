import pytest

from app.agents.planner import build_plan
from app.core.errors import NotFoundError
from app.tools.registry import TOOLS, run_tool
from tests.test_domain import _cards


@pytest.fixture(scope="module")
def cards():
    return _cards()


def test_every_tool_has_valid_schema() -> None:
    agents = {"FundamentalsAgent", "ComisionesAgent", "EducativeAgent", "PerfilAgent"}
    for t in TOOLS.values():
        s = t.openai_schema()
        assert s["type"] == "function" and s["parameters"]["type"] == "object"
        assert t.agent in agents
    assert {t.agent for t in TOOLS.values()} == agents


def test_search_cards_no_annual_fee(cards) -> None:
    res = run_tool("search_cards", cards, {"no_annual_fee": True, "limit": 10})
    assert res.data["count"] > 0
    assert all((c["annual_fee"] or 0) == 0 for c in res.data["cards"])


def test_get_card_details_and_fees(cards) -> None:
    d = run_tool("get_card_details", cards, {"card_id": "002"})
    assert d.data["name"] == "Black Unlimited"
    assert d.data["requirements"]["score_min"] == 580
    f = run_tool("get_card_fees", cards, {"card_id": "002"})
    assert f.data["fees"] and f.data["impacts"]


def test_get_card_unknown_raises(cards) -> None:
    with pytest.raises(NotFoundError):
        run_tool("get_card_details", cards, {"card_id": "999"})


def test_compare_education_profiles(cards) -> None:
    assert len(run_tool("compare_cards", cards, {"card_ids": ["001", "002"]}).data["cards"]) == 2
    assert "Banxico" in run_tool("get_education_topic", cards, {"topic_id": "pago_minimo"}).data["body"]
    assert len(run_tool("explain_profiles", cards, {}).data["profiles"]) == 6
    assert run_tool("get_card_profile", cards, {"card_id": "002"}).data["profile"]


def test_planner_card_fees_with_dependencies(cards) -> None:
    plan, _ = build_plan("¿Qué comisiones cobra Black Unlimited?", cards)
    tools = [s.tool for s in plan]
    assert tools[0] == "get_card_details"
    fees = next(s for s in plan if s.tool == "get_card_fees")
    assert fees.agent == "ComisionesAgent"
    assert fees.depends_on == [plan[0].id]


def test_planner_education_and_search(cards) -> None:
    plan, _ = build_plan("¿Qué es el pago mínimo?", cards)
    assert any(s.tool == "get_education_topic" and s.args["topic_id"] == "pago_minimo" for s in plan)
    plan, _ = build_plan("¿Qué tarjetas no cobran anualidad? sin anualidad", cards)
    assert any(s.tool == "search_cards" and s.args.get("no_annual_fee") for s in plan)


def test_planner_fallback(cards) -> None:
    plan, suggestions = build_plan("hola", cards)
    assert plan and suggestions
