"""Hash de contrasenas (argon2) y tokens JWT."""

from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import get_settings

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, password)
    except VerifyMismatchError:
        return False


def create_access_token(subject: str, role: str) -> tuple[str, int]:
    settings = get_settings()
    ttl = settings.access_token_ttl_minutes * 60
    now = datetime.now(UTC)
    payload = {"sub": subject, "role": role, "iat": now, "exp": now + timedelta(seconds=ttl)}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, ttl


def decode_token(token: str) -> dict[str, object]:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
