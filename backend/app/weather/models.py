from datetime import datetime
from typing import Any

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, UTCDateTime, utcnow


class WeatherCache(IdMixin, Base):
    """Provider responses keyed by rounded coordinates (~1 km), shared by all instances."""

    __tablename__ = "weather_cache"

    cache_key: Mapped[str] = mapped_column(String(64), unique=True)
    payload: Mapped[dict[str, Any]] = mapped_column()
    fetched_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
