"""Token, OTP and password primitives. Business rules live in `app.auth.service`."""

import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError

from app.core.config import get_settings
from app.core.errors import Unauthorized

_password_hasher = PasswordHasher()


class Role(StrEnum):
    FARMER = "farmer"
    ADMIN = "admin"


@dataclass(frozen=True, slots=True)
class Principal:
    """The authenticated identity attached to a request."""

    user_id: uuid.UUID
    role: Role


def create_access_token(user_id: uuid.UUID, role: Role) -> tuple[str, int]:
    settings = get_settings()
    ttl = timedelta(minutes=settings.access_token_ttl_minutes)
    now = datetime.now(UTC)
    claims = {
        "sub": str(user_id),
        "role": role.value,
        "iat": now,
        "exp": now + ttl,
        "typ": "access",
    }
    token = jwt.encode(claims, settings.jwt_secret.get_secret_value(), settings.jwt_algorithm)
    return token, int(ttl.total_seconds())


def decode_access_token(token: str) -> Principal:
    settings = get_settings()
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "exp", "role"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise Unauthorized("Session expired", code="token_expired") from exc
    except jwt.PyJWTError as exc:
        raise Unauthorized("Invalid token") from exc
    if claims.get("typ") != "access":
        raise Unauthorized("Invalid token")
    return Principal(user_id=uuid.UUID(claims["sub"]), role=Role(claims["role"]))


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    """Refresh tokens and OTPs are stored only as hashes."""
    return hashlib.sha256(token.encode()).hexdigest()


def new_otp(length: int = 6) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(length))


def constant_time_equals(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except VerificationError:
        return False
