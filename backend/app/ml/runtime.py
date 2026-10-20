"""Inference runtimes for the artifact formats produced by `ml/` notebooks.

Artifacts are framework-native (XGBoost JSON, ONNX) — never pickles — so loading a model
cannot execute arbitrary code. Each artifact directory carries a `metadata.json` that
fully describes its inputs, so the backend needs no per-model code.
"""

import io
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, UnidentifiedImageError

from app.core.errors import InvalidInput

Image.MAX_IMAGE_PIXELS = 40_000_000  # refuse decompression bombs
_ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}
# _SINGLE_ROW_THREADS: XGBoost defaults to every core per prediction. For one row that only
# adds OpenMP spin-waiting (measured: 54.6 ms CPU vs 7.4 ms single-threaded, and slower
# wall time). Request concurrency already comes from the bounded CPU pool.


def encode_tabular(features_spec: dict[str, Any], values: dict[str, Any]) -> np.ndarray:
    """Numeric features in order, then one-hot blocks for each categorical feature.

    Must stay identical to `agrismart_ml.encoding.encode_row` used at training time.
    Unknown categories encode as all zeros rather than failing.
    """
    row: list[float] = [float(values[name]) for name in features_spec["numeric"]]
    for name, categories in features_spec.get("categorical", {}).items():
        current = values.get(name)
        row.extend(1.0 if current == category else 0.0 for category in categories)
    return np.asarray([row], dtype=np.float32)


@dataclass(slots=True)
class Prediction:
    label: str
    probability: float


class TabularClassifier:
    def __init__(self, directory: Path, metadata: dict[str, Any]) -> None:
        import xgboost as xgb  # heavy import, only when a model is actually loaded

        self.metadata = metadata
        self.labels: list[str] = metadata["labels"]
        self._booster = xgb.Booster()
        self._booster.load_model(directory / metadata["artifact"])
        self._booster.set_param({"nthread": 1})  # see _SINGLE_ROW_THREADS

    def predict(self, values: dict[str, Any], top_k: int = 4) -> list[Prediction]:
        probabilities = self._booster.inplace_predict(
            encode_tabular(self.metadata["features"], values)
        )[0]
        order = np.argsort(probabilities)[::-1][:top_k]
        return [Prediction(self.labels[i], float(probabilities[i])) for i in order]


class TabularQuantileRegressor:
    """One XGBoost model emitting several quantiles (e.g. P10/P50/P90) per row."""

    def __init__(self, directory: Path, metadata: dict[str, Any]) -> None:
        import xgboost as xgb

        self.metadata = metadata
        self.quantiles: list[float] = metadata["quantiles"]
        self._booster = xgb.Booster()
        self._booster.load_model(directory / metadata["artifact"])
        self._booster.set_param({"nthread": 1})  # see _SINGLE_ROW_THREADS

    def predict(self, values: dict[str, Any]) -> dict[float, float]:
        raw = np.atleast_1d(
            self._booster.inplace_predict(encode_tabular(self.metadata["features"], values))[0]
        )
        raw = np.sort(raw)
        # Calibrated widening of the band around the median, fitted at training time
        # (agrismart_ml.yield_model.widen) so the shown range covers ~80% of outcomes.
        scale = self.metadata.get("interval_scale")
        if scale:
            median = raw[self.quantiles.index(0.5)]
            raw = median + (raw - median) * scale
        if self.metadata.get("target_transform") == "log1p":
            raw = np.expm1(raw)
        ordered = np.sort(np.maximum(raw, 0.0))  # enforce monotonic, non-negative quantiles
        return dict(zip(self.quantiles, (float(v) for v in ordered), strict=True))


# Laplacian variance of the 224px crop. Sharp leaf/pest photos sit at 50+ (1st percentile of
# the test sets); blur, flat colours and gradients fall below 20; sensor-style noise is above
# 30000. Measured by ml/eval_robustness.py: without this gate the disease model accepted 99% of
# gradients and 84% of noise images at its confidence threshold.
_MIN_SHARPNESS = 20.0
_MAX_SHARPNESS = 30000.0


def _reject_unclear(image: Image.Image) -> None:
    grey = np.asarray(image.convert("L"), dtype=np.float32)
    laplacian = (
        grey[1:-1, 1:-1] * 4 - grey[:-2, 1:-1] - grey[2:, 1:-1] - grey[1:-1, :-2] - grey[1:-1, 2:]
    )
    if not _MIN_SHARPNESS <= float(laplacian.var()) <= _MAX_SHARPNESS:
        raise InvalidInput("The photo is blurry or not a clear subject", code="image_unclear")


class ImageClassifier:
    def __init__(self, directory: Path, metadata: dict[str, Any]) -> None:
        import onnxruntime as ort

        self.metadata = metadata
        self.labels: list[str] = metadata["labels"]
        spec = metadata["input"]
        self._size: int = spec["size"]
        self._mean = np.asarray(spec["mean"], dtype=np.float32).reshape(3, 1, 1)
        self._std = np.asarray(spec["std"], dtype=np.float32).reshape(3, 1, 1)
        options = ort.SessionOptions()
        options.intra_op_num_threads = 2  # concurrency is bounded by the caller's limiter
        self._session = ort.InferenceSession(
            str(directory / metadata["artifact"]), options, providers=["CPUExecutionProvider"]
        )
        self._input_name = self._session.get_inputs()[0].name

    def preprocess(self, image_bytes: bytes) -> np.ndarray:
        """Resize the short side to size/0.875, centre-crop, normalise — as in training."""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            if image.format not in _ALLOWED_IMAGE_FORMATS:
                raise InvalidInput("Unsupported image format", code="invalid_image")
            image.draft("RGB", (self._size * 2, self._size * 2))  # fast JPEG downscale
            image = image.convert("RGB")
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
            raise InvalidInput("The file is not a readable image", code="invalid_image") from exc

        width, height = image.size
        if min(width, height) < 64:
            raise InvalidInput("Image is too small", code="image_too_small")
        resize_to = round(self._size / 0.875)
        scale = resize_to / min(width, height)
        image = image.resize(
            (round(width * scale), round(height * scale)), Image.Resampling.BILINEAR
        )
        left = (image.width - self._size) // 2
        top = (image.height - self._size) // 2
        image = image.crop((left, top, left + self._size, top + self._size))

        _reject_unclear(image)
        array = np.asarray(image, dtype=np.float32).transpose(2, 0, 1) / 255.0
        return ((array - self._mean) / self._std)[np.newaxis, ...]

    def predict(self, image_bytes: bytes, top_k: int = 3) -> list[Prediction]:
        logits = self._session.run(None, {self._input_name: self.preprocess(image_bytes)})[0][0]
        exp = np.exp(logits - logits.max())
        probabilities = exp / exp.sum()
        order = np.argsort(probabilities)[::-1][:top_k]
        return [Prediction(self.labels[i], float(probabilities[i])) for i in order]


RUNTIMES = {
    ("xgboost", "classification"): TabularClassifier,
    ("xgboost", "quantile_regression"): TabularQuantileRegressor,
    ("onnx", "image_classification"): ImageClassifier,
}


def read_metadata(directory: Path) -> dict[str, Any]:
    metadata_file = directory / "metadata.json"
    if not metadata_file.is_file():
        raise FileNotFoundError(f"{metadata_file} not found")
    metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
    for key in (
        "name",
        "version",
        "framework",
        "task",
        "artifact",
        "dataset_version",
        "feature_version",
        "trained_at",
        "metrics",
    ):
        if key not in metadata:
            raise ValueError(f"metadata.json is missing '{key}'")
    if (metadata["framework"], metadata["task"]) not in RUNTIMES:
        raise ValueError(f"unsupported framework/task {metadata['framework']}/{metadata['task']}")
    if not (directory / metadata["artifact"]).is_file():
        raise FileNotFoundError(f"artifact {metadata['artifact']} missing in {directory}")
    return metadata


def load_runtime(directory: Path) -> TabularClassifier | TabularQuantileRegressor | ImageClassifier:
    metadata = read_metadata(directory)
    runtime_cls = RUNTIMES[(metadata["framework"], metadata["task"])]
    return runtime_cls(directory, metadata)
