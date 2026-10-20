import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import Enum, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin, UTCDateTime


class NotificationCategory(StrEnum):
    WEATHER = "weather"
    SCHEME = "scheme"
    CALENDAR = "calendar"
    MARKET = "market"
    DISEASE = "disease"
    EMERGENCY = "emergency"


class DeliveryStatus(StrEnum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    SKIPPED = "skipped"


class Notification(IdMixin, TimestampMixin, Base):
    """A targeted message. Fan-out produces one `NotificationDelivery` per farmer."""

    __tablename__ = "notifications"

    idempotency_key: Mapped[str] = mapped_column(String(80), unique=True)
    category: Mapped[NotificationCategory] = mapped_column(
        Enum(NotificationCategory, native_enum=False, length=16), index=True
    )
    title: Mapped[dict[str, Any]] = mapped_column()  # per-language text
    body: Mapped[dict[str, Any]] = mapped_column()
    target: Mapped[dict[str, Any]] = mapped_column()  # {"states": [], "districts": [], "crops": []}
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    recipients: Mapped[int] = mapped_column(Integer, default=0)


class NotificationDelivery(IdMixin, TimestampMixin, Base):
    __tablename__ = "notification_deliveries"
    __table_args__ = (
        UniqueConstraint("notification_id", "farmer_id", name="uq_notification_deliveries_target"),
        Index("ix_notification_deliveries_status", "status", "created_at"),
    )

    notification_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("notifications.id", ondelete="CASCADE")
    )
    farmer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("farmers.id", ondelete="CASCADE"), index=True
    )
    channel: Mapped[str] = mapped_column(String(16))  # push | sms
    status: Mapped[DeliveryStatus] = mapped_column(
        Enum(DeliveryStatus, native_enum=False, length=16), default=DeliveryStatus.PENDING
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(String(300))
    sent_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    read_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
