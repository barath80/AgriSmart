import uuid
from datetime import datetime

from sqlalchemy import Enum, Float, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin, UTCDateTime, utcnow
from app.core.language import Language
from app.farmer.models import Channel


class VoiceSession(IdMixin, TimestampMixin, Base):
    __tablename__ = "voice_sessions"

    farmer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("farmers.id", ondelete="SET NULL"), index=True
    )
    chat_session_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="SET NULL")
    )
    channel: Mapped[Channel] = mapped_column(Enum(Channel, native_enum=False, length=8), index=True)
    language: Mapped[Language] = mapped_column(Enum(Language, native_enum=False, length=16))
    provider: Mapped[str] = mapped_column(String(32))
    external_call_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    turns: Mapped[int] = mapped_column(Integer, default=0)
    end_reason: Mapped[str | None] = mapped_column(String(32))


class VoiceClip(IdMixin, TimestampMixin, Base):
    """Short-lived synthesized audio for outbound alert calls (fetched by the telephony
    provider through a signed URL). Rows past `expires_at` are deleted by the worker."""

    __tablename__ = "voice_clips"

    audio: Mapped[bytes] = mapped_column(LargeBinary)
    mime: Mapped[str] = mapped_column(String(32), default="audio/wav")
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
