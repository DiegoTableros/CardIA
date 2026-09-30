import httpx

API = "/api/v1"


async def test_health_and_auth_required(client: httpx.AsyncClient) -> None:
    r = await client.get(f"{API}/meta/health")
    assert r.status_code == 200 and r.json()["cards_loaded"] == 69
    assert (await client.get(f"{API}/cards")).status_code == 401


async def test_login_wrong_password(client: httpx.AsyncClient) -> None:
    r = await client.post(f"{API}/auth/login", json={"email": "demo@cardia.local", "password": "x"})
    assert r.status_code == 401


async def test_cards_list_filter_detail(client: httpx.AsyncClient, user_headers) -> None:
    r = await client.get(f"{API}/cards", headers=user_headers)
    assert r.json()["total"] == 69
    r = await client.get(f"{API}/cards", params={"no_annual_fee": True}, headers=user_headers)
    assert all(c["annual_fee"] == 0 for c in r.json()["items"])
    r = await client.get(f"{API}/cards/002", headers=user_headers)
    body = r.json()
    assert body["name"] == "Black Unlimited" and body["disclaimer"] and body["fees"]
    assert (await client.get(f"{API}/cards/999", headers=user_headers)).status_code == 404
    facets = (await client.get(f"{API}/cards/facets", headers=user_headers)).json()
    assert len(facets["profiles"]) == 4


async def test_compare(client: httpx.AsyncClient, user_headers) -> None:
    r = await client.post(f"{API}/compare", json={"card_ids": ["001", "002", "003"]}, headers=user_headers)
    assert r.status_code == 200
    assert len(r.json()["cards"]) == 3
    assert (
        await client.post(f"{API}/compare", json={"card_ids": ["001"]}, headers=user_headers)
    ).status_code == 422


async def test_recommend_endpoint(client: httpx.AsyncClient, user_headers) -> None:
    payload = {
        "age": 28,
        "income_range": "15k_30k",
        "credit_score": "medium",
        "main_use": "diario",
        "avoid_annual_fee": True,
        "pays_in_full": True,
        "benefits": ["Meses sin intereses"],
    }
    r = await client.post(f"{API}/recommend", json=payload, headers=user_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["disclaimer"] and body["assumptions"] and body["model"]["is_stub"]
    assert body["recommendations"]
    bad = await client.post(f"{API}/recommend", json=payload | {"age": 15}, headers=user_headers)
    assert bad.status_code == 422


async def test_chat_plan_then_execute(client: httpx.AsyncClient, user_headers) -> None:
    body = {"message": "¿Qué comisiones cobra Black Unlimited?", "session_id": "s1"}
    plan = (await client.post(f"{API}/chat/plan", json=body, headers=user_headers)).json()
    assert plan["plan"] and all(s["status"] == "pending" for s in plan["plan"])
    run = (await client.post(f"{API}/chat/runs/{plan['run_id']}/execute", headers=user_headers)).json()
    assert run["status"] == "ok"
    assert all(s["status"] == "ok" for s in run["plan"])
    assert "Black Unlimited" in run["answer"] and run["disclaimer"]
    assert run["cards"][0]["id"] == "002"
    runs = (await client.get(f"{API}/chat/runs", params={"session_id": "s1"}, headers=user_headers)).json()
    assert len(runs) == 1


async def test_bi(client: httpx.AsyncClient, user_headers) -> None:
    r = (await client.get(f"{API}/bi", headers=user_headers)).json()
    assert r["kpis"]["cards"] == 69 and len(r["profiles"]) == 4 and len(r["scatter"]) == 69


async def test_admin_requires_role_and_traces(client: httpx.AsyncClient, user_headers, admin_headers) -> None:
    assert (await client.get(f"{API}/admin/overview", headers=user_headers)).status_code == 403
    await client.post(f"{API}/recommend", json={"age": 30, "income_range": "7k_15k"}, headers=user_headers)
    ov = (await client.get(f"{API}/admin/overview", headers=admin_headers)).json()
    assert ov["cards"] == 69 and ov["recommendations"] == 1 and ov["users"] == 2
    ev = (
        await client.get(f"{API}/admin/events", params={"action": "recommend"}, headers=admin_headers)
    ).json()
    assert ev["total"] == 1
    assert (await client.get(f"{API}/admin/users", headers=admin_headers)).json()["items"]
