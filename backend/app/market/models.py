import uuid
from datetime import date, datetime

from sqlalchemy import Date, Float, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, IdMixin, TimestampMixin, UTCDateTime, utcnow


class Market(IdMixin, TimestampMixin, Base):
    """A mandi (APMC market)."""

    __tablename__ = "markets"
    __table_args__ = (
        UniqueConstraint("state", "district", "name", name="uq_markets_place"),
        Index("ix_markets_state_district", "state", "district"),
    )

    name: Mapped[str] = mapped_column(String(120))
    state: Mapped[str] = mapped_column(String(64))
    district: Mapped[str] = mapped_column(String(64))


class MarketPrice(IdMixin, Base):
    """An observed mandi price (₹ per quintal). The upstream API keeps no history, so
    every fetch is persisted here — this table *is* the price history."""

    __tablename__ = "market_prices"
    __table_args__ = (
        UniqueConstraint(
            "market_id",
            "commodity",
            "variety",
            "grade",
            "arrival_date",
            name="uq_market_prices_obs",
        ),
        Index("ix_market_prices_commodity_date", "commodity", "arrival_date"),
    )

    market_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("markets.id", ondelete="CASCADE"))
    commodity: Mapped[str] = mapped_column(String(80))
    variety: Mapped[str] = mapped_column(String(80), default="")
    grade: Mapped[str] = mapped_column(String(40), default="")
    arrival_date: Mapped[date] = mapped_column(Date)
    min_price: Mapped[float] = mapped_column(Float)
    max_price: Mapped[float] = mapped_column(Float)
    modal_price: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(32))
    fetched_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    market: Mapped[Market] = relationship(lazy="joined")
