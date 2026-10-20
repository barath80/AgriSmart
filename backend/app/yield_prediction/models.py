import uuid
from typing import Any

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin


class YieldPrediction(IdMixin, TimestampMixin, Base):
    __tablename__ = "yield_predictions"

    farmer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("farmers.id", ondelete="SET NULL"), index=True
    )
    crop_slug: Mapped[str] = mapped_column(String(48), index=True)
    model_version: Mapped[str] = mapped_column(String(32))
    inputs: Mapped[dict[str, Any]] = mapped_column()
    expected_q_per_acre: Mapped[float] = mapped_column(Float)
    low_q_per_acre: Mapped[float] = mapped_column(Float)
    high_q_per_acre: Mapped[float] = mapped_column(Float)
    latency_ms: Mapped[float] = mapped_column(Float)
