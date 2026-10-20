"""Run the training notebooks top to bottom, saving outputs (logs, charts, metrics) in place.

    python train_all.py                 # all four, in order
    python train_all.py crop yield      # just these

Training lives in the notebooks; this only executes them unattended (e.g. overnight or on a
GPU box) and stops at the first failing cell. Each notebook exports a new model version.
"""

import sys
import time
from pathlib import Path

import nbformat
from nbclient import NotebookClient
from nbclient.exceptions import CellExecutionError

NOTEBOOKS = {
    "crop": "01_crop_recommendation.ipynb",
    "yield": "02_yield_prediction.ipynb",
    "disease": "03_disease_classification.ipynb",
    "pest": "04_pest_classification.ipynb",
}
NOTEBOOK_DIR = Path(__file__).parent / "notebooks"


def keep_awake() -> None:
    """Stop Windows from sleeping while training runs (no-op elsewhere; ends with the process).

    Sleep pauses training mid-epoch — a 2-minute epoch once took 10 hours overnight."""
    if sys.platform == "win32":
        import ctypes

        es_continuous, es_system_required = 0x80000000, 0x00000001
        ctypes.windll.kernel32.SetThreadExecutionState(es_continuous | es_system_required)


def run(name: str) -> bool:
    path = NOTEBOOK_DIR / NOTEBOOKS[name]
    notebook = nbformat.read(path, as_version=4)
    client = NotebookClient(notebook, timeout=None, kernel_name="python3",
                            resources={"metadata": {"path": str(NOTEBOOK_DIR)}})
    start = time.time()
    print(f"[{time.strftime('%H:%M:%S')}] {name}: running {path.name}", flush=True)
    try:
        client.execute()
        ok = True
    except CellExecutionError as error:
        print(f"{name}: FAILED\n{str(error)[-2000:]}", flush=True)
        ok = False
    nbformat.write(notebook, path)  # keep outputs, including the failing cell's traceback
    print(f"[{time.strftime('%H:%M:%S')}] {name}: {'done' if ok else 'failed'} in {(time.time() - start) / 60:.1f} min",
          flush=True)
    return ok


if __name__ == "__main__":
    keep_awake()
    selected = sys.argv[1:] or list(NOTEBOOKS)
    unknown = set(selected) - set(NOTEBOOKS)
    if unknown:
        sys.exit(f"unknown notebook(s) {sorted(unknown)}; choose from {list(NOTEBOOKS)}")
    results = {name: run(name) for name in selected}
    print("summary:", results, flush=True)
    sys.exit(0 if all(results.values()) else 1)
