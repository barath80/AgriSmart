"""Contract tests: what the notebooks export is exactly what the backend can serve.

Each test trains a tiny model on synthetic data shaped like the real dataset, exports it
through `agrismart_ml`, then loads and runs it with the backend's own runtime
(`backend/app/ml/runtime.py`). Run from `ml/`:  python -m pytest -q
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from PIL import Image

ML_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML_ROOT))
sys.path.insert(0, str(ML_ROOT.parent / "backend"))

from agrismart_ml import crop, vision, yield_model  # noqa: E402
from agrismart_ml.catalog import PEST_LABELS  # noqa: E402
from agrismart_ml.encoding import build_spec, encode_frame  # noqa: E402
from agrismart_ml.registry import create_version_dir, next_version  # noqa: E402
from app.ml.runtime import encode_tabular, load_runtime  # noqa: E402

SEEDS = ML_ROOT.parent / "backend" / "seeds"


def test_encoders_are_identical():
    frame = pd.DataFrame({"a": [1.0, 2.0], "b": [3.0, 4.0], "crop": ["rice", "wheat"], "season": ["rabi", "kharif"]})
    spec = build_spec(frame, ["a", "b"], ["crop", "season"])
    training = encode_frame(frame, spec)
    serving = np.vstack([encode_tabular(spec, row) for row in frame.to_dict("records")])
    assert np.array_equal(training, serving)


def test_versions_are_immutable(tmp_path):
    assert next_version("crop", tmp_path) == "crop_v1"
    create_version_dir("crop", "crop_v1", tmp_path)
    assert next_version("crop", tmp_path) == "crop_v2"
    with pytest.raises(FileExistsError):
        create_version_dir("crop", "crop_v1", tmp_path)


def test_every_trainable_label_has_knowledge():
    from agrismart_ml.catalog import CROP_RECOMMENDATION_LABELS, PLANTVILLAGE_LABELS, YIELD_CROPS

    crops = {c["slug"] for c in json.loads((SEEDS / "crops.json").read_text(encoding="utf-8"))}
    diseases = {d["slug"] for d in json.loads((SEEDS / "diseases.json").read_text(encoding="utf-8"))}
    pests = {p["slug"] for p in json.loads((SEEDS / "pests.json").read_text(encoding="utf-8"))}
    assert set(CROP_RECOMMENDATION_LABELS.values()) <= crops
    assert set(YIELD_CROPS.values()) <= crops
    assert set(PLANTVILLAGE_LABELS.values()) == diseases
    assert set(PEST_LABELS.values()) == pests


def test_crop_model_roundtrip(tmp_path):
    rng = np.random.default_rng(1)
    rows = []
    for label, centre in {"rice": [80, 45, 40, 24, 82, 6.4, 230], "chickpea": [40, 68, 80, 18, 17, 7.3, 80],
                          "mungbean": [20, 47, 20, 28, 85, 6.7, 50]}.items():
        for values in centre + rng.normal(0, [5, 5, 5, 1, 3, 0.2, 10], (40, 7)):
            rows.append(dict(zip(["N", "P", "K", "temperature", "humidity", "ph", "rainfall"], values, strict=True))
                        | {"label": label})
    csv = tmp_path / "Crop_recommendation.csv"
    pd.DataFrame(rows).to_csv(csv, index=False)

    trained = crop.train(crop.load(csv), cv_folds=3)
    assert trained.metrics["test_accuracy"] > 0.9
    directory = crop.export(trained, csv, artifacts_dir=tmp_path / "artifacts")

    runtime = load_runtime(directory)
    prediction = runtime.predict({"nitrogen": 80, "phosphorus": 45, "potassium": 40, "temperature": 24,
                                  "humidity": 82, "ph": 6.4, "rainfall": 230})
    assert prediction[0].label == "rice"
    assert {p.label for p in prediction} == {"rice", "chickpea", "green_gram"}  # slugs, not dataset names


def test_yield_model_roundtrip(tmp_path):
    rng = np.random.default_rng(2)
    base = {"Rice": 2.5, "Wheat": 3.2, "Gram": 1.0}
    rows = []
    for year in range(1997, 2021):
        for crop_name, mean_yield in base.items():
            for state in ["Tamil Nadu", "Punjab", "Orissa"]:
                area = rng.uniform(1000, 50000)
                rows.append({"Crop": crop_name, "Crop_Year": year, "Season": "Kharif     ", "State": state,
                             "Area": area, "Production": area * mean_yield * rng.uniform(0.85, 1.15),
                             "Annual_Rainfall": rng.uniform(600, 1800), "Fertilizer": area * 120,
                             "Pesticide": area * 0.3, "Yield": 0})
    csv = tmp_path / "crop_yield.csv"
    pd.DataFrame(rows).to_csv(csv, index=False)

    frame = yield_model.load(csv)
    assert "Odisha" in set(frame["state"])  # historic name normalised
    trained = yield_model.train(frame, max_rounds=200)
    directory = yield_model.export(trained, csv, artifacts_dir=tmp_path / "artifacts")

    runtime = load_runtime(directory)
    quantiles = runtime.predict({"crop": "wheat", "season": "kharif", "state": "Punjab", "crop_year": 2026,
                                 "annual_rainfall": 900, "fertilizer_per_ha": 120, "pesticide_per_ha": 0.3})
    low, mid, high = (quantiles[q] for q in yield_model.QUANTILES)
    assert low <= mid <= high
    assert 2.0 < mid < 4.5  # wheat ≈ 3.2 t/ha in the synthetic data
    assert json.loads((directory / "metadata.json").read_text())["defaults"]["annual_rainfall"]["__all__"] > 0


def test_image_model_roundtrip(tmp_path):
    """Train a randomly initialised MobileNet for a few batches; check export + serving."""
    root = tmp_path / "pests"
    colours = {"ants": (180, 30, 30), "bees": (30, 160, 40)}
    for folder, colour in colours.items():
        (root / folder).mkdir(parents=True)
        for i in range(12):
            jitter = tuple(int(np.clip(c + (i * 7 % 30) - 15, 0, 255)) for c in colour)
            # Textured, not flat: the serving gate rejects featureless images on purpose.
            texture = np.random.default_rng(i).normal(0, 20, (96, 96, 3))
            pixels = np.clip(np.array(jitter) + texture, 0, 255).astype("uint8")
            Image.fromarray(pixels).save(root / folder / f"{i}.jpg", quality=95)

    labels = {k: v for k, v in PEST_LABELS.items() if k in colours}
    samples = vision.scan(vision.find_class_root(tmp_path, labels), labels)
    train_s, valid_s, test_s = vision.stratified_split(samples, valid=0.2, test=0.2)
    config = vision.TrainConfig(image_size=64, batch_size=8, head_epochs=1, finetune_epochs=1,
                                num_workers=0, pretrained=False)
    trained = vision.train(train_s, valid_s, config)
    metrics = vision.evaluate(trained, test_s)
    assert "min_confidence" in metrics
    directory = vision.export_onnx(trained, "pest", root, artifacts_dir=tmp_path / "artifacts",
                                  quantize_with=train_s)

    runtime = load_runtime(directory)
    with (root / "ants" / "0.jpg").open("rb") as image:
        predictions = runtime.predict(image.read(), top_k=2)
    assert {p.label for p in predictions} == {"ants", "bees"}
    assert abs(sum(p.probability for p in predictions) - 1) < 1e-4
    metadata = json.loads((directory / "metadata.json").read_text())
    assert metadata["input"]["size"] == 64 and metadata["min_confidence"] == trained.min_confidence
    assert metadata["metrics"]["quantization"]["served"] in {"int8", "fp32"}
