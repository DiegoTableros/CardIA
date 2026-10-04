"""Seed idempotente: esquema + tarjetas (desde data/cards.json) + usuarios.

Rapido para correr en cada cold start de Vercel (D1). Si cambia la version de los datos
(`generated_at` de cards.json), las tablas estaticas de tarjetas se recrean; usuarios y trazas no se tocan.
Uso: uv run python -m app.db.seed
"""

import asyncio
import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DATA_DIR, get_settings
from app.core.security import hash_password
from app.db.models import AppMeta, Base, Benefit, Card, Fee, User
from app.db.session import get_engine, get_sessionmaker

CARDS_JSON = DATA_DIR / "cards.json"
STATIC_TABLES = [Benefit.__table__, Fee.__table__, Card.__table__]
VERSION_KEY = "cards_version"


def read_cards_file(path: Path = CARDS_JSON) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_cards_json(path: Path = CARDS_JSON) -> list[dict[str, Any]]:
    return read_cards_file(path)["cards"]


async def _seed_cards(session: AsyncSession, cards: list[dict[str, Any]]) -> int:
    for c in cards:
        r = c["requirements"]
        card = Card(
            id=c["id"],
            name=c["name"],
            institution=c["institution"],
            institution_url=c.get("institution_url"),
            image_url=c.get("image_url"),
            image_orientation=c.get("image_orientation"),
            cluster=c.get("cluster"),
            features=c.get("features") or {},
            card_class=c["card_class"],
            cat=c["cat"],
            annual_fee=c["annual_fee"],
            interest_rate=c["interest_rate"],
            credit_line_min=c["credit_line_min"],
            age_min=r["age_min"],
            age_max=r["age_max"],
            score_min=r["score_min"],
            work_seniority_min=r["work_seniority_min"],
            residence_seniority_min=r["residence_seniority_min"],
            monthly_income_min=r["monthly_income_min"],
        )
        card.fees = [Fee(**f) for f in c["fees"]]
        card.benefits = [Benefit(**b) for b in c["benefits"]]
        session.add(card)
    return len(cards)


async def _seed_users(session: AsyncSession) -> None:
    s = get_settings()
    for email, pwd, name, role in (
        (s.seed_admin_email, s.seed_admin_password, "Administrador CardIA", "admin"),
        (s.seed_demo_email, s.seed_demo_password, "Usuario Demo", "user"),
    ):
        user = await session.scalar(select(User).where(User.email == email))
        if user is None:
            session.add(User(email=email, full_name=name, password_hash=hash_password(pwd), role=role))


async def seed() -> int:
    data = read_cards_file()
    version = str(data.get("generated_at", ""))
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with get_sessionmaker()() as session:
        current = await session.get(AppMeta, VERSION_KEY)
        stale = current is None or current.value != version
    n = 0
    if stale:
        async with engine.begin() as conn:
            await conn.run_sync(lambda c: Base.metadata.drop_all(c, tables=STATIC_TABLES))
            await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=STATIC_TABLES[::-1]))
    async with get_sessionmaker()() as session:
        if stale:
            n = await _seed_cards(session, data["cards"])
            await session.merge(AppMeta(key=VERSION_KEY, value=version))
        await _seed_users(session)
        await session.commit()
    return n


def main() -> None:
    n = asyncio.run(seed())
    print(f"Seed OK ({n} tarjetas sembradas)" if n else "Seed OK (datos ya al dia)")


if __name__ == "__main__":
    main()
