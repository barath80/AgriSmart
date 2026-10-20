from datetime import datetime
from typing import Any

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin, UTCDateTime


class Pest(IdMixin, TimestampMixin, Base):
    """Knowledge for one pest classifier label. See `Disease` for the review rules."""

    __tablename__ = "pests"

    slug: Mapped[str] = mapped_column(String(64), unique=True)
    names: Mapped[dict[str, Any]] = mapped_column()
    is_beneficial: Mapped[bool] = mapped_column(default=False)
    description: Mapped[str] = mapped_column(String(1000), default="")
    damage: Mapped[list[Any]] = mapped_column(default=list)
    affected_crops: Mapped[list[Any]] = mapped_column(default=list)
    control_measures: Mapped[list[Any]] = mapped_column(default=list)
    prevention: Mapped[list[Any]] = mapped_column(default=list)
    safety_warnings: Mapped[list[Any]] = mapped_column(default=list)
    verified_by: Mapped[str | None] = mapped_column(String(120))
    verified_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
