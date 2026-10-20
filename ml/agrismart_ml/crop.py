"""Crop recommendation: XGBoost multi-class classifier on soil nutrients and climate.

Dataset: Kaggle "Crop Recommendation Dataset" — columns N, P, K, temperature, humidity,
ph, rainfall, label. Season, irrigation, soil type and crop rotation are applied by the
backend as transparent agronomic rules (`backend/app/crop/rules.py`) because this dataset
does not contain them; the model is never asked to guess them.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, f1_score, log_loss
from sklearn.model_selection import StratifiedKFold, cross_val_score, cross_validate, train_test_split
from xgboost import XGBClassifier

from agrismart_ml.catalog import AREA_CROPS, CROP_RECOMMENDATION_LABELS, YIELD_SEASONS, normalize_state
from agrismart_ml.encoding import encode_frame
from agrismart_ml.registry import create_version_dir, dataset_fingerprint, write_metadata

FEATURE_VERSION = "crop_features_v1"
# Dataset column → name the backend sends (`app.crop.service.recommend`)
COLUMNS = {"N": "nitrogen", "P": "phosphorus", "K": "potassium", "temperature": "temperature",
           "humidity": "humidity", "ph": "ph", "rainfall": "rainfall"}
NUMERIC = list(COLUMNS.values())
SPEC = {"numeric": NUMERIC, "categorical": {}}


def load(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(path)
    missing = (set(COLUMNS) | {"label"}) - set(frame.columns)
    if missing:
        raise ValueError(f"{path.name} is missing columns {sorted(missing)}")
    frame = frame.rename(columns=COLUMNS)
    unknown = set(frame["label"]) - set(CROP_RECOMMENDATION_LABELS)
    if unknown:
        raise ValueError(f"labels without a catalog mapping: {sorted(unknown)} — add them to catalog.py")
    frame["crop"] = frame["label"].map(CROP_RECOMMENDATION_LABELS)
    before = len(frame)
    frame = frame.dropna(subset=NUMERIC).drop_duplicates()
    print(f"Loaded {len(frame)} rows ({before - len(frame)} dropped), {frame['crop'].nunique()} crops")
    return frame


@dataclass
class TrainedCropModel:
    model: XGBClassifier
    labels: list[str]
    metrics: dict[str, Any]
    feature_ranges: dict[str, list[float]]
    test_frame: pd.DataFrame
    test_predictions: np.ndarray


def default_params(num_classes: int, seed: int = 42) -> dict[str, Any]:
    return dict(
        n_estimators=300, max_depth=6, learning_rate=0.1, subsample=0.9, colsample_bytree=0.9,
        objective="multi:softprob", num_class=num_classes, eval_metric="mlogloss",
        tree_method="hist", random_state=seed, n_jobs=-1,
    )


SEARCH_SPACE: dict[str, list[Any]] = {
    "n_estimators": [200, 300, 500, 800],
    "max_depth": [3, 4, 5, 6, 8],
    "learning_rate": [0.03, 0.05, 0.1, 0.2],
    "subsample": [0.7, 0.8, 0.9, 1.0],
    "colsample_bytree": [0.6, 0.8, 1.0],
    "min_child_weight": [1, 2, 4],
    "reg_lambda": [0.5, 1.0, 2.0, 5.0],
}


def _split(frame: pd.DataFrame, seed: int):
    labels = sorted(frame["crop"].unique())
    index = {label: i for i, label in enumerate(labels)}
    x = encode_frame(frame, SPEC)
    y = frame["crop"].map(index).to_numpy()
    return labels, train_test_split(x, y, np.arange(len(frame)), test_size=0.2, stratify=y, random_state=seed)


def tune(frame: pd.DataFrame, *, trials: int = 30, seed: int = 42, cv_folds: int = 5) -> pd.DataFrame:
    """Random search scored by cross-validated log loss on the *training* split only — the
    hold-out test rows are never seen, so the final test score stays an honest estimate.
    Returns all trials, best first; pass `results.iloc[0].params` to `train`."""
    labels, (x_train, _, y_train, _, _, _) = _split(frame, seed)
    rng = np.random.default_rng(seed)
    cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=seed)
    rows = []
    for trial in range(trials):
        choice = {k: v[rng.integers(len(v))] for k, v in SEARCH_SPACE.items()}
        params = {**default_params(len(labels), seed), **choice}
        scores = cross_validate(XGBClassifier(**params), x_train, y_train, cv=cv,
                                scoring=["neg_log_loss", "accuracy"])
        rows.append({"trial": trial, "cv_log_loss": -scores["test_neg_log_loss"].mean(),
                     "cv_accuracy": scores["test_accuracy"].mean(), "params": choice})
    return pd.DataFrame(rows).sort_values(["cv_log_loss", "cv_accuracy"], ascending=[True, False],
                                          ignore_index=True)


def train(frame: pd.DataFrame, *, seed: int = 42, cv_folds: int = 5,
          params: dict[str, Any] | None = None) -> TrainedCropModel:
    labels, (x_train, x_test, y_train, y_test, _, test_rows) = _split(frame, seed)
    params = {**default_params(len(labels), seed), **(params or {})}

    cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=seed)
    cv_scores = cross_val_score(XGBClassifier(**params), x_train, y_train, cv=cv, scoring="accuracy")

    model = XGBClassifier(**params)
    model.fit(x_train, y_train)
    probabilities = model.predict_proba(x_test)
    predictions = probabilities.argmax(axis=1)
    top3 = np.mean([y in np.argsort(p)[-3:] for y, p in zip(y_test, probabilities, strict=True)])

    metrics = {
        "test_accuracy": round(float(accuracy_score(y_test, predictions)), 4),
        "test_macro_f1": round(float(f1_score(y_test, predictions, average="macro")), 4),
        "test_top3_accuracy": round(float(top3), 4),
        "test_log_loss": round(float(log_loss(y_test, probabilities, labels=range(len(labels)))), 4),
        "cv_accuracy_mean": round(float(cv_scores.mean()), 4),
        "cv_accuracy_std": round(float(cv_scores.std()), 4),
        "train_rows": int(len(x_train)),
        "test_rows": int(len(x_test)),
    }
    ranges = {name: [float(frame[name].min()), float(frame[name].max())] for name in NUMERIC}
    return TrainedCropModel(model, labels, metrics, ranges, frame.iloc[test_rows], predictions)


def report(trained: TrainedCropModel) -> str:
    y_true = trained.test_frame["crop"].map({l: i for i, l in enumerate(trained.labels)})
    return classification_report(y_true, trained.test_predictions, target_names=trained.labels, digits=3)


def regional_prior(area_csv: Path, *, since: int = 2010, min_share: float = 0.001) -> dict[str, dict[str, dict[str, float]]]:
    """What farmers actually plant: each crop's share of cropped area per state and season.

    Built from the government crop statistics in the yield dataset (state × crop × season ×
    year). The backend multiplies the soil/climate model's probability by this prior, so the
    answer reflects soil, climate *and* what grows in the farmer's region and season.
    Whole-year crops (sugarcane, banana, coconut) count in every season.
    Returns {state: {season: {crop_slug: share}}} with shares summing to 1 per season.
    """
    raw = pd.read_csv(area_csv)
    raw.columns = [c.strip() for c in raw.columns]
    frame = pd.DataFrame({
        "crop": raw["Crop"].str.strip().map(AREA_CROPS),
        "season": raw["Season"].str.strip().str.lower().map(YIELD_SEASONS),
        "state": raw["State"].map(normalize_state),
        "year": raw["Crop_Year"],
        "area": pd.to_numeric(raw["Area"], errors="coerce"),
    }).dropna()
    frame = frame[(frame["year"] >= since) & (frame["area"] > 0)]
    # Average yearly area, so states with more reported years are not over-weighted.
    years = frame.groupby("state")["year"].nunique()
    area = frame.groupby(["state", "season", "crop"])["area"].sum() / years.reindex(
        frame.groupby(["state", "season", "crop"])["area"].sum().index.get_level_values("state")).to_numpy()
    prior: dict[str, dict[str, dict[str, float]]] = {}
    for state in area.index.get_level_values("state").unique():
        by_state = area.loc[state]
        whole_year = by_state.loc["whole_year"] if "whole_year" in by_state.index.get_level_values(0) else pd.Series(dtype=float)
        prior[state] = {}
        for season in ("kharif", "rabi", "zaid"):
            seasonal = by_state.loc[season] if season in by_state.index.get_level_values(0) else pd.Series(dtype=float)
            combined = seasonal.add(whole_year, fill_value=0)
            if combined.sum() <= 0:
                continue
            shares = combined / combined.sum()
            shares = shares[shares >= min_share]
            prior[state][season] = {crop: round(float(v / shares.sum()), 4)
                                    for crop, v in shares.sort_values(ascending=False).items()}
    return prior


def export(trained: TrainedCropModel, dataset_path: Path, version: str | None = None,
           artifacts_dir: Path | None = None, *, prior: dict | None = None,
           prior_path: Path | None = None) -> Path:
    kwargs = {"artifacts_dir": artifacts_dir} if artifacts_dir else {}
    directory = create_version_dir("crop", version, **kwargs)
    trained.model.get_booster().save_model(directory / "model.json")
    write_metadata(
        directory,
        framework="xgboost",
        task="classification",
        artifact="model.json",
        dataset_version=dataset_fingerprint(dataset_path),
        feature_version=FEATURE_VERSION,
        metrics=trained.metrics,
        features=SPEC,
        labels=trained.labels,
        feature_ranges=trained.feature_ranges,
        hyperparameters={k: trained.model.get_params()[k] for k in SEARCH_SPACE},
        **({"regional_prior": prior,
            "regional_prior_dataset": dataset_fingerprint(prior_path) if prior_path else None}
           if prior else {}),
    )
    print(f"Exported {directory}")
    return directory
