import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin, UTCDateTime


class Disease(IdMixin, TimestampMixin, Base):
    """Agricultural knowledge for one classifier label.

    The image model answers "what is this?". This row answers why it happened and what
    to do. Content is authored in English and must be reviewed by an agronomist
    (`verified_at`) before it is shown without a caution notice.
    """

    __tablename__ = "diseases"

    slug: Mapped[str] = mapped_column(String(96), unique=True)  # equals the model's class label
    crop_slug: Mapped[str] = mapped_column(String(48), index=True)
    names: Mapped[dict[str, Any]] = mapped_column()
    is_healthy: Mapped[bool] = mapped_column(Boolean, default=False)
    pathogen_type: Mapped[str] = mapped_column(
        String(32), default=""
    )  # fungus, bacterium, virus...
    cause: Mapped[str] = mapped_column(String(1000), default="")
    symptoms: Mapped[list[Any]] = mapped_column(default=list)
    favorable_conditions: Mapped[list[Any]] = mapped_column(default=list)
    treatment: Mapped[list[Any]] = mapped_column(default=list)
    prevention: Mapped[list[Any]] = mapped_column(default=list)
    fertilizer_guidance: Mapped[list[Any]] = mapped_column(default=list)
    safety_warnings: Mapped[list[Any]] = mapped_column(default=list)
    verified_by: Mapped[str | None] = mapped_column(String(120))
    verified_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class DiagnosisPrediction(IdMixin, TimestampMixin, Base):
    """Every disease/pest image prediction, for audit, analytics and model monitoring."""

    __tablename__ = "disease_predictions"

    request_id: Mapped[str] = mapped_column(String(64), unique=True)  # idempotency key
    farmer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("farmers.id", ondelete="SET NULL"), index=True
    )
    kind: Mapped[str] = mapped_column(String(16), index=True)  # disease | pest
    model_version: Mapped[str] = mapped_column(String(32))
    predicted_label: Mapped[str] = mapped_column(String(96))
    confidence: Mapped[float] = mapped_column(Float)
    top_k: Mapped[list[Any]] = mapped_column()
    accepted: Mapped[bool] = mapped_column(Boolean)  # False when below confidence threshold
    image_sha256: Mapped[str] = mapped_column(String(64))
    latency_ms: Mapped[float] = mapped_column(Float)
