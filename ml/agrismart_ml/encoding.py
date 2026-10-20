"""Tabular feature encoding shared by training and the backend.

Layout: numeric features in order, then one one-hot block per categorical feature, in
the order the categories are listed in `metadata["features"]`. The backend re-implements
this in `app.ml.runtime.encode_tabular`; `tests/test_contract.py` keeps them identical.
"""

from typing import Any

import numpy as np
import pandas as pd


def build_spec(frame: pd.DataFrame, numeric: list[str], categorical: list[str]) -> dict[str, Any]:
    return {
        "numeric": list(numeric),
        "categorical": {name: sorted(frame[name].dropna().unique().tolist()) for name in categorical},
    }


def encode_frame(frame: pd.DataFrame, spec: dict[str, Any]) -> np.ndarray:
    blocks = [frame[spec["numeric"]].to_numpy(dtype=np.float32)]
    for name, categories in spec["categorical"].items():
        values = frame[name].to_numpy()
        blocks.append(np.stack([(values == c) for c in categories], axis=1).astype(np.float32))
    return np.hstack(blocks)


def feature_names(spec: dict[str, Any]) -> list[str]:
    names = list(spec["numeric"])
    for name, categories in spec["categorical"].items():
        names += [f"{name}={c}" for c in categories]
    return names
