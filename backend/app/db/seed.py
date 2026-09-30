"""Seed idempotente: esquema + tarjetas (desde data/cards.json) + usuarios.

Rapido para correr en cada cold start de Vercel (D1). Uso: uv run python -m app.db.seed
"""

import asyncio
import json
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import DATA_DIR, get_settings
from app.core.security import hash_password
from app.db.models import Base, Benefit, Card, Fee, User
from app.db.session import get_engine, get_sessionmaker

CARDS_JSON = DATA_DIR / "cards.json"


def load_cards_json(path: Path = CARDS_JSON) -> list[dict[str, object]]:
    return json.loads(path.read_text(encoding="utf-8"))["cards"]


async def _seed_cards(session: AsyncSession) -> int:
    existing = await session.scalar(select(func.count()).select_from(Card))
    if existing:
        return 0
    cards = load_cards_json()
    for c in cards:
        r = c["requirements"]
        card = Card(
            id=c["id"],
            name=c["name"],
            institution=c["institution"],
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
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with get_sessionmaker()() as session:
        n = await _seed_cards(session)
        await _seed_users(session)
        await session.commit()
    return n


def main() -> None:
    n = asyncio.run(seed())
    print(f"Seed OK ({n} tarjetas nuevas)")


if __name__ == "__main__":
    main()
