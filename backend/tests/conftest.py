import socket
from collections.abc import AsyncIterator

import httpx
import pytest

from app.core.config import get_settings
from app.db import session as db_session
from app.services import catalog


@pytest.fixture(autouse=True)
def prohibir_red(monkeypatch: pytest.MonkeyPatch) -> None:
    """Los tests nunca salen a la red (mockear OpenAI)."""

    def guard(self, address):  # noqa: ANN001
        host = address[0] if isinstance(address, tuple) else address
        if host not in ("127.0.0.1", "localhost", "::1"):
            raise RuntimeError(f"Red bloqueada en tests: {address}")
        return _orig(self, address)

    _orig = socket.socket.connect
    monkeypatch.setattr(socket.socket, "connect", guard)


@pytest.fixture
async def client(tmp_path, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[httpx.AsyncClient]:
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{(tmp_path / 'test.db').as_posix()}")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    get_settings.cache_clear()
    await db_session.reset_engine()
    catalog.clear_cache()

    from app.main import create_app

    app = create_app()
    transport = httpx.ASGITransport(app=app)
    async with (
        app.router.lifespan_context(app),
        httpx.AsyncClient(transport=transport, base_url="http://test") as c,
    ):
        yield c
    await db_session.reset_engine()
    catalog.clear_cache()
    get_settings.cache_clear()


async def _login(client: httpx.AsyncClient, email: str, password: str) -> dict[str, str]:
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
async def user_headers(client: httpx.AsyncClient) -> dict[str, str]:
    return await _login(client, "demo@cardia.local", "demo1234")


@pytest.fixture
async def admin_headers(client: httpx.AsyncClient) -> dict[str, str]:
    return await _login(client, "admin@cardia.local", "admin1234")
