import uuid
from enum import StrEnum
from typing import Any

from sqlalchemy import Enum, Float, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, IdMixin, TimestampMixin
from app.core.language import Language


class Channel(StrEnum):
    APP = "app"
    PHONE = "phone"


class Location(IdMixin, TimestampMixin, Base):
    __tablename__ = "locations"
    __table_args__ = (
        UniqueConstraint("state", "district", "village", name="uq_locations_place"),
        Index("ix_locations_state_district", "state", "district"),
    )

    state: Mapped[str] = mapped_column(String(64))
    district: Mapped[str] = mapped_column(String(64))
    village: Mapped[str] = mapped_column(String(128), default="")
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)


class Farmer(IdMixin, TimestampMixin, Base):
    __tablename__ = "farmers"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )
    name: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[str] = mapped_column(String(16), index=True)
    preferred_language: Mapped[Language] = mapped_column(
        Enum(Language, native_enum=False, length=16), default=Language.ENGLISH, index=True
    )
    primary_channel: Mapped[Channel] = mapped_column(Enum(Channel, native_enum=False, length=8))
    location_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("locations.id"), index=True)
    birth_year: Mapped[int | None]
    push_token: Mapped[str | None] = mapped_column(String(255))
    notification_preferences: Mapped[dict[str, Any]] = mapped_column(default=dict)
    # {"gender": "female"|"male", "pace": 0.75–1.25, "voice": provider voice id or null}
    voice_preferences: Mapped[dict[str, Any]] = mapped_column(default=dict, server_default="{}")

    location: Mapped[Location | None] = relationship(lazy="joined")
