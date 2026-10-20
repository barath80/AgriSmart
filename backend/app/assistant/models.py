import uuid
from datetime import datetime

from sqlalchemy import Enum, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin, UTCDateTime, utcnow
from app.core.language import Language
from app.farmer.models import Channel


class ChatSession(IdMixin, TimestampMixin, Base):
    __tablename__ = "chat_sessions"

    farmer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("farmers.id", ondelete="CASCADE"), index=True
    )
    channel: Mapped[Channel] = mapped_column(Enum(Channel, native_enum=False, length=8))
    language: Mapped[Language] = mapped_column(Enum(Language, native_enum=False, length=16))
    last_activity_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class ChatMessage(IdMixin, TimestampMixin, Base):
    __tablename__ = "chat_messages"
    __table_args__ = (Index("ix_chat_messages_session_created", "session_id", "created_at"),)

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="CASCADE")
    )
    role: Mapped[str] = mapped_column(String(16))  # farmer | assistant
    text: Mapped[str] = mapped_column(Text)
    intent: Mapped[str | None] = mapped_column(String(32), index=True)
    handled_by: Mapped[str | None] = mapped_column(String(32))  # tool name, "llm" or "fallback"
    latency_ms: Mapped[float | None] = mapped_column(Float)
