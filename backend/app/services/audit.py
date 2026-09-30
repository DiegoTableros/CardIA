"""Trazabilidad: registro de eventos (login, recomendacion, chat, consultas)."""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditEvent


async def record(
    session: AsyncSession,
    action: str,
    user_email: str | None,
    detail: str = "",
    duration_ms: int = 0,
    payload: dict[str, Any] | None = None,
) -> None:
    session.add(
        AuditEvent(
            action=action,
            user_email=user_email,
            detail=detail[:500],
            duration_ms=duration_ms,
            payload=payload,
        )
    )
    await session.commit()
