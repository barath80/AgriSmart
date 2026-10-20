"""Unpack the downloaded Kaggle archives into the layout the notebooks expect.

    ml/data/archives/crop_recommendation.zip  → ml/data/raw/crop_recommendation/Crop_recommendation.csv
    ml/data/archives/crop_yield.zip           → ml/data/raw/crop_yield/crop_yield.csv
    ml/data/archives/plant_disease.zip        → ml/data/raw/plant_disease/{train,valid}/<class>/
    ml/data/archives/agricultural_pests.zip   → ml/data/raw/pests/<class>/

Run from `ml/`:  python -m agrismart_ml.datasets

Why not just "extract all": the plant-disease zip contains the whole dataset twice under
folder names that differ only in letter case (they collide on Windows), nests it three
folders deep (exceeds Windows' 260-character path limit) and adds an unlabelled `test/`
folder. Only one labelled copy is extracted, flattened. Safe to re-run: files already
present with the same size are skipped.
"""

import shutil
import sys
import zipfile
from pathlib import Path, PurePosixPath

from agrismart_ml.registry import DATA_DIR

ARCHIVES_DIR = DATA_DIR.parent / "archives"
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def _extract(archive: zipfile.ZipFile, members: list[tuple[zipfile.ZipInfo, Path]]) -> int:
    written = 0
    for info, target in members:
        if target.exists() and target.stat().st_size == info.file_size:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        with archive.open(info) as source, target.open("wb") as destination:
            shutil.copyfileobj(source, destination, length=1024 * 1024)
        written += 1
    return written


def extract_single_csv(zip_path: Path, destination: Path) -> Path:
    with zipfile.ZipFile(zip_path) as archive:
        csvs = [i for i in archive.infolist() if i.filename.lower().endswith(".csv")]
        if len(csvs) != 1:
            raise ValueError(f"{zip_path.name}: expected one CSV, found {[i.filename for i in csvs]}")
        _extract(archive, [(csvs[0], destination)])
    return destination


def extract_split_images(zip_path: Path, destination: Path, splits: tuple[str, ...] = ("train", "valid")) -> dict[str, int]:
    """Extract `<root>/<split>/<class>/<image>` for ONE root only, flattened to `destination/<split>/...`."""
    with zipfile.ZipFile(zip_path) as archive:
        images = [i for i in archive.infolist() if PurePosixPath(i.filename).suffix.lower() in IMAGE_SUFFIXES]
        roots = sorted({
            "/".join(parts[: parts.index(split)])
            for info in images
            for parts in [PurePosixPath(info.filename).parts]
            for split in splits
            if split in parts[:-2]
        })
        if not roots:
            raise ValueError(f"{zip_path.name}: no {splits} folders found")
        root = roots[0]  # the duplicate copy under a differently-cased name is ignored
        members, counts = [], dict.fromkeys(splits, 0)
        for info in images:
            parts = PurePosixPath(info.filename).parts
            if "/".join(parts[: len(PurePosixPath(root).parts)]) != root:
                continue
            relative = parts[len(PurePosixPath(root).parts):]
            if len(relative) == 3 and relative[0] in splits:
                members.append((info, destination.joinpath(*relative)))
                counts[relative[0]] += 1
        _extract(archive, members)
    return counts


def extract_class_folders(zip_path: Path, destination: Path) -> dict[str, int]:
    """Extract `.../<class>/<image>` (class = the image's parent folder) to `destination/<class>/`."""
    with zipfile.ZipFile(zip_path) as archive:
        members, counts = [], {}
        for info in archive.infolist():
            path = PurePosixPath(info.filename)
            if path.suffix.lower() not in IMAGE_SUFFIXES or len(path.parts) < 2:
                continue
            label = path.parts[-2]
            members.append((info, destination / label / path.name))
            counts[label] = counts.get(label, 0) + 1
        _extract(archive, members)
    return dict(sorted(counts.items()))


def prepare_all(archives_dir: Path = ARCHIVES_DIR, raw_dir: Path = DATA_DIR) -> None:
    jobs = {
        "crop_recommendation.zip": lambda p: extract_single_csv(p, raw_dir / "crop_recommendation" / "Crop_recommendation.csv"),
        "crop_yield.zip": lambda p: extract_single_csv(p, raw_dir / "crop_yield" / "crop_yield.csv"),
        "plant_disease.zip": lambda p: extract_split_images(p, raw_dir / "plant_disease"),
        "agricultural_pests.zip": lambda p: extract_class_folders(p, raw_dir / "pests"),
    }
    for name, job in jobs.items():
        path = archives_dir / name
        if not path.exists():
            print(f"skip   {name} (not found in {archives_dir})")
            continue
        print(f"unpack {name} … ", end="", flush=True)
        print(job(path))


if __name__ == "__main__":
    prepare_all(*(Path(a) for a in sys.argv[1:3]))
