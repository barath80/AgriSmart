"""Yield prediction: one XGBoost model emitting P10 / P50 / P90 (quantile regression).

Dataset: Kaggle "Crop Yield in Indian States" — Crop, Crop_Year, Season, State, Area (ha),
Production (tonnes), Annual_Rainfall (mm), Fertilizer (kg), Pesticide (kg), Yield.

Honest evaluation: the split is *by year* (train on the past, test on later years), which
is how the model is used in reality. A random split would leak each state's trend.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from agrismart_ml.catalog import YIELD_CROPS, YIELD_SEASONS, normalize_state
from agrismart_ml.encoding import build_spec, encode_frame
from agrismart_ml.registry import create_version_dir, dataset_fingerprint, write_metadata

FEATURE_VERSION = "yield_features_v1"
QUANTILES = [0.1, 0.5, 0.9]
NUMERIC = ["crop_year", "annual_rainfall", "fertilizer_per_ha", "pesticide_per_ha"]
CATEGORICAL = ["crop", "season", "state"]
REQUIRED = {"Crop", "Crop_Year", "Season", "State", "Area", "Production", "Annual_Rainfall",
            "Fertilizer", "Pesticide"}


def load(path: Path) -> pd.DataFrame:
    raw = pd.read_csv(path)
    missing = REQUIRED - set(raw.columns)
    if missing:
        raise ValueError(f"{path.name} is missing columns {sorted(missing)}")

    frame = pd.DataFrame({
        "crop": raw["Crop"].str.strip().map(YIELD_CROPS),
        "season": raw["Season"].str.strip().str.lower().map(YIELD_SEASONS),
        "state": raw["State"].map(normalize_state),
        "crop_year": raw["Crop_Year"].astype(int),
        "area_ha": raw["Area"].astype(float),
        "production_t": raw["Production"].astype(float),
        "annual_rainfall": raw["Annual_Rainfall"].astype(float),
        "fertilizer_kg": raw["Fertilizer"].astype(float),
        "pesticide_kg": raw["Pesticide"].astype(float),
    })
    frame = frame.dropna(subset=["crop", "season"])
    frame = frame[(frame["area_ha"] > 0) & (frame["production_t"] > 0)]
    frame["fertilizer_per_ha"] = frame["fertilizer_kg"] / frame["area_ha"]
    frame["pesticide_per_ha"] = frame["pesticide_kg"] / frame["area_ha"]
    frame["yield_t_ha"] = frame["production_t"] / frame["area_ha"]

    # Remove recording errors: per-crop yields outside the 1st–99th percentile.
    bounds = frame.groupby("crop")["yield_t_ha"].quantile([0.01, 0.99]).unstack()
    low, high = frame["crop"].map(bounds[0.01]), frame["crop"].map(bounds[0.99])
    frame = frame[frame["yield_t_ha"].between(low, high)].reset_index(drop=True)
    print(f"Loaded {len(frame)} rows: {frame['crop'].nunique()} crops, {frame['state'].nunique()} states, "
          f"years {frame['crop_year'].min()}–{frame['crop_year'].max()}")
    return frame


@dataclass
class TrainedYieldModel:
    booster: xgb.Booster
    spec: dict[str, Any]
    metrics: dict[str, Any]
    defaults: dict[str, dict[str, float]]
    test_frame: pd.DataFrame
    test_quantiles: np.ndarray
    hyperparameters: dict[str, Any] = field(default_factory=dict)


TARGET_COVERAGE = 0.80


def widen(log_q: np.ndarray, scale: float) -> np.ndarray:
    """Scale each quantile's distance from the median (column 1), in log space.

    Must match `TabularQuantileRegressor.predict` in the backend."""
    median = log_q[:, [1]]
    return median + (log_q - median) * scale


def calibrate_interval(log_q: np.ndarray, log_actual: np.ndarray) -> float:
    for scale in np.arange(1.0, 6.01, 0.05):
        widened = widen(log_q, scale)
        if np.mean((log_actual >= widened[:, 0]) & (log_actual <= widened[:, 2])) >= TARGET_COVERAGE:
            return float(scale)
    return 6.0


def temporal_split(frame: pd.DataFrame, test_years: int = 3, valid_years: int = 2):
    last = frame["crop_year"].max()
    test = frame[frame["crop_year"] > last - test_years]
    valid = frame[(frame["crop_year"] > last - test_years - valid_years) & (frame["crop_year"] <= last - test_years)]
    train = frame[frame["crop_year"] <= last - test_years - valid_years]
    return train, valid, test


DEFAULT_PARAMS: dict[str, Any] = {
    "learning_rate": 0.05, "max_depth": 7, "min_child_weight": 3, "subsample": 0.85,
    "colsample_bytree": 0.85, "lambda": 1.0,
}
SEARCH_SPACE: dict[str, list[Any]] = {
    "learning_rate": [0.03, 0.05, 0.08],
    "max_depth": [5, 6, 7, 8, 10],
    "min_child_weight": [1, 3, 5, 10],
    "subsample": [0.7, 0.85, 1.0],
    "colsample_bytree": [0.6, 0.85, 1.0],
    "lambda": [0.5, 1.0, 3.0, 10.0],
}


def _booster_params(seed: int, params: dict[str, Any] | None) -> dict[str, Any]:
    return {"objective": "reg:quantileerror", "quantile_alpha": np.array(QUANTILES), "tree_method": "hist",
            "seed": seed, **DEFAULT_PARAMS, **(params or {})}


def _matrix(df: pd.DataFrame, spec) -> xgb.DMatrix:
    return xgb.DMatrix(encode_frame(df, spec), label=np.log1p(df["yield_t_ha"].to_numpy()))


def tune(frame: pd.DataFrame, *, trials: int = 25, seed: int = 42, max_rounds: int = 4000) -> pd.DataFrame:
    """Random search scored by quantile (pinball) loss on the *validation* years. Test years
    are never touched, so `train`'s test metrics remain an honest forward-looking estimate.
    Returns all trials, best first; pass `results.iloc[0].params` to `train`."""
    train_df, valid_df, _ = temporal_split(frame)
    spec = build_spec(train_df, NUMERIC, CATEGORICAL)
    dtrain, dvalid = _matrix(train_df, spec), _matrix(valid_df, spec)
    rng = np.random.default_rng(seed)
    rows = []
    for trial in range(trials):
        choice = {k: v[rng.integers(len(v))] for k, v in SEARCH_SPACE.items()}
        booster = xgb.train(_booster_params(seed, choice), dtrain, num_boost_round=max_rounds,
                            evals=[(dvalid, "valid")], early_stopping_rounds=50, verbose_eval=False)
        rows.append({"trial": trial, "valid_pinball": float(booster.best_score),
                     "rounds": booster.best_iteration + 1, "params": choice})
    return pd.DataFrame(rows).sort_values("valid_pinball", ignore_index=True)


def train(frame: pd.DataFrame, *, seed: int = 42, max_rounds: int = 4000,
          params: dict[str, Any] | None = None) -> TrainedYieldModel:
    train_df, valid_df, test_df = temporal_split(frame)
    spec = build_spec(train_df, NUMERIC, CATEGORICAL)
    params = _booster_params(seed, params)
    dtrain, dvalid = _matrix(train_df, spec), _matrix(valid_df, spec)
    booster = xgb.train(params, dtrain, num_boost_round=max_rounds, evals=[(dvalid, "valid")],
                        early_stopping_rounds=50, verbose_eval=200)

    best = (0, booster.best_iteration + 1)

    def log_quantiles(df: pd.DataFrame) -> np.ndarray:
        return np.sort(booster.inplace_predict(encode_frame(df, spec), iteration_range=best), axis=1)

    # Quantile models trained on the past are over-confident about later years. Widen the
    # band around the median until it covers TARGET_COVERAGE of the *validation* years
    # (split-conformal style), then report honest coverage on the untouched test years.
    valid_actual = np.log1p(valid_df["yield_t_ha"].to_numpy())
    interval_scale = calibrate_interval(log_quantiles(valid_df), valid_actual)

    raw_test = log_quantiles(test_df)
    test_q = np.maximum(np.expm1(widen(raw_test, interval_scale)), 0)
    actual = test_df["yield_t_ha"].to_numpy()
    median = test_q[:, 1]
    coverage = np.mean((actual >= test_q[:, 0]) & (actual <= test_q[:, 2]))
    raw_bounds = np.expm1(raw_test)
    raw_coverage = np.mean((actual >= raw_bounds[:, 0]) & (actual <= raw_bounds[:, 2]))

    metrics = {
        "test_mae_t_ha": round(float(mean_absolute_error(actual, median)), 4),
        "test_rmse_t_ha": round(float(np.sqrt(mean_squared_error(actual, median))), 4),
        "test_r2": round(float(r2_score(actual, median)), 4),
        "test_mape_pct": round(float(np.mean(np.abs(median - actual) / actual) * 100), 2),
        "test_median_ape_pct": round(float(np.median(np.abs(median - actual) / actual) * 100), 2),
        "p10_p90_coverage": round(float(coverage), 4),  # ideal ≈ 0.80
        "p10_p90_coverage_uncalibrated": round(float(raw_coverage), 4),
        "interval_scale": round(float(interval_scale), 3),
        "best_iteration": int(booster.best_iteration),
        "train_years": f"{train_df['crop_year'].min()}-{train_df['crop_year'].max()}",
        "test_years": f"{test_df['crop_year'].min()}-{test_df['crop_year'].max()}",
        "train_rows": int(len(train_df)),
        "test_rows": int(len(test_df)),
    }
    # Trim trees after the best iteration so the exported model is exactly what was tested.
    booster = booster[: booster.best_iteration + 1]

    defaults = {
        "annual_rainfall": {**train_df.groupby("state")["annual_rainfall"].median().round(1).to_dict(),
                            "__all__": float(train_df["annual_rainfall"].median())},
        "fertilizer_per_ha": {**train_df.groupby("crop")["fertilizer_per_ha"].median().round(2).to_dict(),
                              "__all__": float(train_df["fertilizer_per_ha"].median())},
        "pesticide_per_ha": {**train_df.groupby("crop")["pesticide_per_ha"].median().round(3).to_dict(),
                             "__all__": float(train_df["pesticide_per_ha"].median())},
    }
    hyperparameters = {k: params[k] for k in SEARCH_SPACE}
    return TrainedYieldModel(booster, spec, metrics, defaults, test_df, test_q, hyperparameters)


def per_crop_errors(trained: TrainedYieldModel) -> pd.DataFrame:
    frame = trained.test_frame.assign(predicted=trained.test_quantiles[:, 1])
    frame["abs_pct_error"] = (frame["predicted"] - frame["yield_t_ha"]).abs() / frame["yield_t_ha"] * 100
    return (frame.groupby("crop")
            .agg(rows=("crop", "size"), median_abs_pct_error=("abs_pct_error", "median"))
            .sort_values("median_abs_pct_error"))


def export(trained: TrainedYieldModel, dataset_path: Path, version: str | None = None,
           artifacts_dir: Path | None = None) -> Path:
    kwargs = {"artifacts_dir": artifacts_dir} if artifacts_dir else {}
    directory = create_version_dir("yield", version, **kwargs)
    trained.booster.save_model(directory / "model.json")
    write_metadata(
        directory,
        framework="xgboost",
        task="quantile_regression",
        artifact="model.json",
        dataset_version=dataset_fingerprint(dataset_path),
        feature_version=FEATURE_VERSION,
        metrics=trained.metrics,
        features=trained.spec,
        quantiles=QUANTILES,
        target="yield_t_ha",
        target_transform="log1p",
        interval_scale=trained.metrics["interval_scale"],
        defaults=trained.defaults,
        hyperparameters=trained.hyperparameters,
    )
    print(f"Exported {directory}")
    return directory
