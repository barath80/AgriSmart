import uuid
from datetime import datetime

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin, UTCDateTime
from app.core.security import Role


class User(IdMixin, TimestampMixin, Base):
    """Login identity. Farmers and admins sign in with a password stored as an Argon2 hash."""

    __tablename__ = "users"

    role: Mapped[Role] = mapped_column(Enum(Role, native_enum=False, length=16), index=True)
    phone: Mapped[str | None] = mapped_column(String(16), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # Consecutive wrong passwords; at the limit the account is locked for a while.
    failed_logins: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(UTCDateTime)


class AuthSession(IdMixin, TimestampMixin, Base):
    """A refresh-token session. Rotated on every refresh; revocable."""

    __tablename__ = "auth_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    refresh_token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    user_agent: Mapped[str | None] = mapped_column(String(255))


class OtpCode(IdMixin, TimestampMixin, Base):
    __tablename__ = "otp_codes"

    # A normalised phone number or a lower-case e-mail address.
    phone: Mapped[str] = mapped_column(String(254), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    consumed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
