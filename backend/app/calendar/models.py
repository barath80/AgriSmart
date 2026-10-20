import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin


class CalendarEvent(IdMixin, TimestampMixin, Base):
    __tablename__ = "calendar_events"
    __table_args__ = (Index("ix_calendar_events_farmer_date", "farmer_id", "scheduled_on"),)

    farmer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"))
    crop_cycle_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("crop_cycles.id", ondelete="CASCADE"), index=True
    )
    event_type: Mapped[str] = mapped_column(String(32))  # sowing, fertilizer, irrigation, ...
    detail_key: Mapped[str] = mapped_column(String(64))  # localisable label key
    scheduled_on: Mapped[date] = mapped_column(Date)
    window_days: Mapped[int] = mapped_column(default=0)
    done: Mapped[bool] = mapped_column(default=False)
