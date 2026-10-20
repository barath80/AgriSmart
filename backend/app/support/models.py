import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin, UTCDateTime


class SupportMessage(IdMixin, TimestampMixin, Base):
    """One message in a farmer's conversation with the AgriSmart team (one thread per farmer)."""

    __tablename__ = "support_messages"
    __table_args__ = (Index("ix_support_messages_farmer_created", "farmer_id", "created_at"),)

    farmer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"))
    sender: Mapped[str] = mapped_column(String(8))  # farmer | admin
    body: Mapped[str] = mapped_column(Text)
    admin_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    # When the other side first saw it: the farmer opening an admin reply, or an admin opening
    # the farmer's message.
    read_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
