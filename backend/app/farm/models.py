import uuid
from datetime import date
from enum import StrEnum

from sqlalchemy import Date, Enum, Float, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, IdMixin, TimestampMixin
from app.crop.models import Crop


class Irrigation(StrEnum):
    RAINFED = "rainfed"
    CANAL = "canal"
    BOREWELL = "borewell"
    DRIP = "drip"
    SPRINKLER = "sprinkler"

    @property
    def is_irrigated(self) -> bool:
        return self is not Irrigation.RAINFED


class SoilType(StrEnum):
    ALLUVIAL = "alluvial"
    BLACK = "black"
    RED = "red"
    LATERITE = "laterite"
    SANDY = "sandy"
    CLAY = "clay"
    LOAMY = "loamy"


class Season(StrEnum):
    KHARIF = "kharif"
    RABI = "rabi"
    ZAID = "zaid"
    WHOLE_YEAR = "whole_year"


class CycleStatus(StrEnum):
    PLANNED = "planned"
    ACTIVE = "active"
    HARVESTED = "harvested"


class Farm(IdMixin, TimestampMixin, Base):
    __tablename__ = "farms"

    farmer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("farmers.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(80), default="")
    area_acres: Mapped[float] = mapped_column(Float)
    location_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("locations.id"), index=True)
    soil_type: Mapped[SoilType | None] = mapped_column(Enum(SoilType, native_enum=False, length=16))
    irrigation: Mapped[Irrigation] = mapped_column(
        Enum(Irrigation, native_enum=False, length=16), default=Irrigation.RAINFED
    )


class SoilRecord(IdMixin, TimestampMixin, Base):
    """A soil test result. Values in kg/ha (N, P, K) as printed on Soil Health Cards."""

    __tablename__ = "soil_records"

    farm_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("farms.id", ondelete="CASCADE"), index=True
    )
    nitrogen: Mapped[float] = mapped_column(Float)
    phosphorus: Mapped[float] = mapped_column(Float)
    potassium: Mapped[float] = mapped_column(Float)
    ph: Mapped[float] = mapped_column(Float)
    organic_carbon: Mapped[float | None] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(32), default="manual")
    tested_on: Mapped[date] = mapped_column(Date)


class CropCycle(IdMixin, TimestampMixin, Base):
    """One crop grown on one farm for one season — the anchor for calendar and yield."""

    __tablename__ = "crop_cycles"
    __table_args__ = (Index("ix_crop_cycles_farm_status", "farm_id", "status"),)

    farm_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"))
    crop_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("crops.id"), index=True)
    season: Mapped[Season] = mapped_column(Enum(Season, native_enum=False, length=16))
    sowing_date: Mapped[date] = mapped_column(Date)
    area_acres: Mapped[float] = mapped_column(Float)
    status: Mapped[CycleStatus] = mapped_column(
        Enum(CycleStatus, native_enum=False, length=16), default=CycleStatus.ACTIVE
    )
    actual_yield_quintals: Mapped[float | None] = mapped_column(Float)

    crop: Mapped[Crop] = relationship(lazy="joined")
