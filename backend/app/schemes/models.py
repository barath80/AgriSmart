import uuid
from datetime import date
from typing import Any

from sqlalchemy import Boolean, Date, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, IdMixin, TimestampMixin


class GovernmentScheme(IdMixin, TimestampMixin, Base):
    """A scheme normalised from any provider (official API, dataset or verified admin entry)."""

    __tablename__ = "government_schemes"
    __table_args__ = (Index("ix_government_schemes_scope", "state", "district", "is_active"),)

    code: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    names: Mapped[dict[str, Any]] = mapped_column(default=dict)  # optional verified translations
    state: Mapped[str | None] = mapped_column(String(64))  # None = central scheme
    district: Mapped[str | None] = mapped_column(String(64))
    summary: Mapped[str] = mapped_column(Text)
    benefits: Mapped[str] = mapped_column(Text)
    eligibility_text: Mapped[str] = mapped_column(Text)
    application_process: Mapped[str] = mapped_column(Text)
    official_url: Mapped[str] = mapped_column(String(300))
    source: Mapped[str] = mapped_column(String(64))  # admin | data_gov_in | state_api ...
    last_verified_on: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    rules: Mapped[list["SchemeRule"]] = relationship(
        back_populates="scheme", cascade="all, delete-orphan", lazy="selectin"
    )


class SchemeRule(IdMixin, Base):
    """One machine-checkable eligibility condition, e.g. `max_land_acres <= 4.94`."""

    __tablename__ = "scheme_rules"

    scheme_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("government_schemes.id", ondelete="CASCADE"), index=True
    )
    rule_type: Mapped[str] = mapped_column(String(32))
    value: Mapped[dict[str, Any]] = mapped_column()  # {"value": ...} — JSON keeps types intact

    scheme: Mapped[GovernmentScheme] = relationship(back_populates="rules")
