import uuid
from typing import Any

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin


class Crop(IdMixin, TimestampMixin, Base):
    """Agronomic metadata for a crop. Facts live here — never in a model or an LLM."""

    __tablename__ = "crops"

    slug: Mapped[str] = mapped_column(String(48), unique=True)
    names: Mapped[dict[str, Any]] = mapped_column()  # {"en": "Rice", "ta": "நெல்", ...}
    aliases: Mapped[list[Any]] = mapped_column(default=list)  # extra spoken forms for voice NLU
    category: Mapped[str] = mapped_column(String(32))  # cereal, pulse, fruit, ...
    seasons: Mapped[list[Any]] = mapped_column(default=list)
    duration_days_min: Mapped[int] = mapped_column(Integer)
    duration_days_max: Mapped[int] = mapped_column(Integer)
    water_requirement: Mapped[str] = mapped_column(String(16))  # low | medium | high
    suitable_soils: Mapped[list[Any]] = mapped_column(default=list)
    fertilizer_guidance: Mapped[str] = mapped_column(String(1000), default="")
    yield_min_q_per_acre: Mapped[float] = mapped_column(Float)
    yield_max_q_per_acre: Mapped[float] = mapped_column(Float)
    market_commodity: Mapped[str | None] = mapped_column(String(80))  # Agmarknet commodity name
    calendar_template: Mapped[list[Any]] = mapped_column(default=list)
    # Main producing states (empty = grown widely); a soft regional rule, not a hard filter.
    growing_states: Mapped[list[Any]] = mapped_column(default=list, server_default="[]")
    min_elevation_m: Mapped[int | None] = mapped_column(Integer)  # hill crops: coffee, apple


class CropRecommendation(IdMixin, TimestampMixin, Base):
    __tablename__ = "crop_recommendations"

    farmer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("farmers.id", ondelete="SET NULL"), index=True
    )
    model_version: Mapped[str] = mapped_column(String(32))
    inputs: Mapped[dict[str, Any]] = mapped_column()
    recommended_crop: Mapped[str] = mapped_column(String(48))
    confidence: Mapped[float] = mapped_column(Float)
    alternatives: Mapped[list[Any]] = mapped_column()
    latency_ms: Mapped[float] = mapped_column(Float)
