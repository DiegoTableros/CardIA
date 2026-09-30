"""Modelos SQLAlchemy 2.0 (tipado con Mapped)."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(300))
    role: Mapped[str] = mapped_column(String(20), default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    institution: Mapped[str] = mapped_column(String(100), index=True)
    card_class: Mapped[str] = mapped_column(String(40), index=True)
    cat: Mapped[float | None] = mapped_column(Float, nullable=True)
    annual_fee: Mapped[float | None] = mapped_column(Float, nullable=True)
    interest_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    credit_line_min: Mapped[float | None] = mapped_column(Float, nullable=True)

    age_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    age_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    work_seniority_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    residence_seniority_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    monthly_income_min: Mapped[float | None] = mapped_column(Float, nullable=True)

    fees: Mapped[list["Fee"]] = relationship(back_populates="card", cascade="all, delete-orphan")
    benefits: Mapped[list["Benefit"]] = relationship(back_populates="card", cascade="all, delete-orphan")


class Fee(Base):
    __tablename__ = "fees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    card_id: Mapped[str] = mapped_column(ForeignKey("cards.id"), index=True)
    concept: Mapped[str] = mapped_column(String(200))
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    denomination: Mapped[str] = mapped_column(String(10))
    fee_type: Mapped[str] = mapped_column(String(20), index=True)

    card: Mapped[Card] = relationship(back_populates="fees")


class Benefit(Base):
    __tablename__ = "benefits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    card_id: Mapped[str] = mapped_column(ForeignKey("cards.id"), index=True)
    benefit_type: Mapped[str] = mapped_column(String(60), index=True)
    text: Mapped[str] = mapped_column(Text)

    card: Mapped[Card] = relationship(back_populates="benefits")


class AuditEvent(Base):
    """Trazabilidad: login, recomendaciones, chat, consultas."""

    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    user_email: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(40), index=True)
    detail: Mapped[str] = mapped_column(String(500), default="")
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)


class ChatRun(Base):
    """Run del orquestador: plan explicito, estados y respuesta."""

    __tablename__ = "chat_runs"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    user_email: Mapped[str] = mapped_column(String(200), index=True)
    session_id: Mapped[str] = mapped_column(String(60), index=True)
    question: Mapped[str] = mapped_column(Text)
    plan: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    answer: Mapped[str] = mapped_column(Text, default="")
    mode: Mapped[str] = mapped_column(String(20), default="rules")
    status: Mapped[str] = mapped_column(String(20), default="ok")
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
