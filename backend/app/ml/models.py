from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin, UTCDateTime


class MLModel(IdMixin, TimestampMixin, Base):
    """A registered model version. Versions are immutable; rollback = activate an older one."""

    __tablename__ = "ml_models"
    __table_args__ = (UniqueConstraint("name", "version", name="uq_ml_models_name_version"),)

    name: Mapped[str] = mapped_column(String(32), index=True)  # crop | disease | pest | yield
    version: Mapped[str] = mapped_column(String(32))  # crop_v1, crop_v2 ...
    framework: Mapped[str] = mapped_column(String(32))
    artifact_path: Mapped[str] = mapped_column(String(255))  # relative to MODEL_DIR
    dataset_version: Mapped[str] = mapped_column(String(64))
    feature_version: Mapped[str] = mapped_column(String(32))
    metrics: Mapped[dict[str, Any]] = mapped_column()
    trained_at: Mapped[datetime] = mapped_column(UTCDateTime)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
