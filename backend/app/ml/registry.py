"""Model registry: which version of each model is live, loaded lazily per process.

Versions are immutable directories under MODEL_DIR (`crop/crop_v1/`, `crop/crop_v2/`).
The `ml_models` table records which one is active. Every API instance re-checks that
table periodically, so activating or rolling back a version reaches all instances without
a restart and without shared in-memory state.
"""

import asyncio
import logging
import re
import time
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from pathlib import Path
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.concurrency import run_cpu_bound
from app.core.config import get_settings
from app.core.database import SessionFactory
from app.core.errors import Conflict, InvalidInput, NotFound, ServiceUnavailable
from app.ml.models import MLModel
from app.ml.runtime import (
    ImageClassifier,
    TabularClassifier,
    TabularQuantileRegressor,
    load_runtime,
    read_metadata,
)

logger = logging.getLogger(__name__)

_VERSION_PATTERN = re.compile(r"^[a-z]+_v\d{1,4}$")


class ModelName(StrEnum):
    CROP = "crop"
    YIELD = "yield"
    DISEASE = "disease"
    PEST = "pest"
    SUBJECT = "subject"  # optional gate: is the photo a leaf or pest at all?


@dataclass(slots=True)
class _Slot:
    version: str | None = None
    runtime: Any = None
    checked_at: float = 0.0


class ModelRegistry:
    def __init__(self) -> None:
        self._slots: dict[ModelName, _Slot] = {name: _Slot() for name in ModelName}
        self._locks: dict[ModelName, asyncio.Lock] = {name: asyncio.Lock() for name in ModelName}

    async def get(self, name: ModelName) -> tuple[str, Any]:
        """Return `(version, runtime)` for the active model, loading it if needed."""
        slot = self._slots[name]
        refresh_after = get_settings().ml_registry_refresh_seconds
        if slot.runtime is not None and time.monotonic() - slot.checked_at < refresh_after:
            return slot.version, slot.runtime  # type: ignore[return-value]

        async with self._locks[name]:
            if slot.runtime is not None and time.monotonic() - slot.checked_at < refresh_after:
                return slot.version, slot.runtime  # type: ignore[return-value]
            async with SessionFactory() as session:
                active = await session.scalar(
                    select(MLModel).where(MLModel.name == name.value, MLModel.is_active.is_(True))
                )
            slot.checked_at = time.monotonic()
            if active is None:
                slot.version, slot.runtime = None, None
                raise ServiceUnavailable(
                    f"No active {name} model. Train one in ml/ and register it.",
                    code="model_unavailable",
                    model=name.value,
                )
            if active.version != slot.version:
                directory = get_settings().model_dir / active.artifact_path
                logger.info("model_loading", extra={"model": name.value, "version": active.version})
                slot.runtime = await run_cpu_bound(load_runtime, directory)
                slot.version = active.version
            return slot.version, slot.runtime  # type: ignore[return-value]

    async def classifier(self, name: ModelName) -> tuple[str, TabularClassifier]:
        return await self.get(name)

    async def regressor(self, name: ModelName) -> tuple[str, TabularQuantileRegressor]:
        return await self.get(name)

    async def image_classifier(self, name: ModelName) -> tuple[str, ImageClassifier]:
        return await self.get(name)

    def invalidate(self, name: ModelName) -> None:
        self._slots[name].checked_at = 0.0

    def loaded_versions(self) -> dict[str, str | None]:
        return {name.value: slot.version for name, slot in self._slots.items()}


registry = ModelRegistry()


# --- Administration ----------------------------------------------------------------------


def _artifact_dir(name: ModelName, version: str) -> Path:
    if not _VERSION_PATTERN.match(version) or not version.startswith(f"{name.value}_"):
        raise InvalidInput(
            f"Version must look like '{name.value}_v1'", code="invalid_model_version"
        )
    return get_settings().model_dir / name.value / version


async def register_model(session: AsyncSession, name: ModelName, version: str) -> MLModel:
    """Validate an artifact directory and record it. Never overwrites an existing version."""
    directory = _artifact_dir(name, version)
    try:
        metadata = read_metadata(directory)
    except (FileNotFoundError, ValueError) as exc:
        raise InvalidInput(str(exc), code="invalid_model_artifact") from exc
    if metadata["name"] != name.value or metadata["version"] != version:
        raise InvalidInput("metadata.json name/version do not match", code="invalid_model_artifact")
    if await session.scalar(
        select(MLModel.id).where(MLModel.name == name, MLModel.version == version)
    ):
        raise Conflict(f"{version} is already registered", code="model_version_exists")

    # Prove the artifact actually loads before it can ever be activated.
    try:
        await run_cpu_bound(load_runtime, directory)
    except Exception as exc:
        raise InvalidInput(
            f"Artifact failed to load: {exc}", code="invalid_model_artifact"
        ) from exc

    model = MLModel(
        name=name.value,
        version=version,
        framework=metadata["framework"],
        artifact_path=f"{name.value}/{version}",
        dataset_version=metadata["dataset_version"],
        feature_version=metadata["feature_version"],
        metrics=metadata["metrics"],
        trained_at=datetime.fromisoformat(metadata["trained_at"]),
        is_active=False,
    )
    session.add(model)
    await session.flush()
    return model


async def activate_model(session: AsyncSession, name: ModelName, version: str) -> MLModel:
    """Make `version` live (also how rollback works: activate the previous version)."""
    model = await session.scalar(
        select(MLModel).where(MLModel.name == name.value, MLModel.version == version)
    )
    if model is None:
        raise NotFound(f"{version} is not registered", code="model_not_found")
    await session.execute(update(MLModel).where(MLModel.name == name.value).values(is_active=False))
    model.is_active = True
    await session.flush()
    registry.invalidate(name)
    return model


def discover_artifacts() -> list[dict[str, str]]:
    """Artifact directories present on disk, registered or not (for the admin UI)."""
    root = get_settings().model_dir
    found = []
    for name in ModelName:
        base = root / name.value
        if base.is_dir():
            for child in sorted(base.iterdir()):
                if child.is_dir() and (child / "metadata.json").is_file():
                    found.append({"name": name.value, "version": child.name})
    return found
