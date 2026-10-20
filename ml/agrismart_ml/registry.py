"""Versioned artifact export. Versions are immutable: exporting never overwrites."""

import hashlib
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ML_ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = ML_ROOT / "artifacts"
DATA_DIR = ML_ROOT / "data" / "raw"


def next_version(name: str, artifacts_dir: Path = ARTIFACTS_DIR) -> str:
    base = artifacts_dir / name
    taken = [int(m.group(1)) for p in base.glob(f"{name}_v*") if (m := re.fullmatch(rf"{name}_v(\d+)", p.name))]
    return f"{name}_v{max(taken, default=0) + 1}"


def dataset_fingerprint(path: Path) -> str:
    """A short hash identifying exactly which data trained a model.

    Files are hashed by content; image folders by relative file names and sizes (fast,
    and any added, removed or replaced image changes it).
    """
    digest = hashlib.sha256()
    if path.is_file():
        digest.update(path.read_bytes())
    else:
        for file in sorted(p for p in path.rglob("*") if p.is_file()):
            digest.update(file.relative_to(path).as_posix().encode())
            digest.update(str(file.stat().st_size).encode())
    return f"{path.name}@{digest.hexdigest()[:12]}"


def create_version_dir(name: str, version: str | None = None, artifacts_dir: Path = ARTIFACTS_DIR) -> Path:
    version = version or next_version(name, artifacts_dir)
    if not re.fullmatch(rf"{name}_v\d+", version):
        raise ValueError(f"version must look like {name}_v1")
    directory = artifacts_dir / name / version
    if directory.exists():
        raise FileExistsError(f"{directory} exists — versions are immutable; use a new version")
    directory.mkdir(parents=True)
    return directory


def write_metadata(directory: Path, **metadata: Any) -> Path:
    required = {"framework", "task", "artifact", "dataset_version", "feature_version", "metrics"}
    missing = required - metadata.keys()
    if missing:
        raise ValueError(f"metadata missing {sorted(missing)}")
    name, version = directory.parent.name, directory.name
    payload = {"name": name, "version": version, "trained_at": datetime.now(UTC).isoformat(), **metadata}
    path = directory / "metadata.json"
    path.write_text(json.dumps(payload, indent=2, default=_json_default), encoding="utf-8")
    return path


def _json_default(value: Any) -> Any:
    if hasattr(value, "item"):  # numpy scalars
        return value.item()
    if hasattr(value, "tolist"):
        return value.tolist()
    raise TypeError(f"not JSON serialisable: {type(value)}")
