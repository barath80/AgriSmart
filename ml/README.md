# AgriSmart — model training

Four models, each trained in a notebook and exported as an immutable, versioned artifact
(`artifacts/<name>/<name>_vN/`) that the backend loads directly.

| Notebook | Model | Dataset (Kaggle) | Archive name |
|---|---|---|---|
| `01_crop_recommendation` | XGBoost classifier | [Crop Recommendation Dataset](https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset) | `crop_recommendation.zip` |
| `02_yield_prediction` | XGBoost quantile regression (P10/P50/P90) | [Crop Yield in Indian States](https://www.kaggle.com/datasets/akshatgupta7/crop-yield-in-indian-states-dataset) | `crop_yield.zip` |
| `03_disease_classification` | MobileNetV3 → ONNX | [New Plant Diseases Dataset](https://www.kaggle.com/datasets/vipoooool/new-plant-diseases-dataset) | `plant_disease.zip` |
| `04_pest_classification` | MobileNetV3 → ONNX | [Agricultural Pests Image Dataset](https://www.kaggle.com/datasets/vencerlanz09/agricultural-pests-image-dataset) | `agricultural_pests.zip` |

## 1. Set up (once)

```powershell
cd ml
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

## 2. Add the datasets

Put the downloaded zips in `ml/data/archives/` with the names above, then unpack:

```powershell
.venv\Scripts\python -m agrismart_ml.datasets
```

This creates:

```
ml/data/raw/crop_recommendation/Crop_recommendation.csv
ml/data/raw/crop_yield/crop_yield.csv
ml/data/raw/plant_disease/train/<38 class folders>
ml/data/raw/plant_disease/valid/<38 class folders>
ml/data/raw/pests/<12 class folders>
```

The plant-disease zip holds the dataset twice (folder names differing only in case) and
nests it too deep for Windows paths; the script extracts one copy, flattened. It is safe to
re-run. `ml/data/` and `ml/artifacts/` are git-ignored.

## 3. Train

```powershell
.venv\Scripts\jupyter lab notebooks
```

Run a notebook top to bottom. The last cell exports the next free version
(`crop_v1`, `crop_v2`, …) — existing versions are never overwritten.

Or run every notebook unattended, in order, with all cells executed and outputs saved
(it also stops Windows from sleeping mid-run):

```powershell
.venv\Scripts\python train_all.py              # crop, yield, disease, pest
.venv\Scripts\python train_all.py crop yield   # just these
```

| Model | Hardware | Time (approx.) |
|---|---|---|
| Crop (incl. 40-trial tuning) | any laptop CPU | 3–10 minutes |
| Yield (incl. 25-trial tuning) | any laptop CPU | 10–20 minutes |
| Pest (5.5k images) | CPU | 1–3 hours · GPU: ~10 min |
| Disease (87k images) | GPU recommended | GPU: ~1 h (all images) · CPU: ~1.5–2 h with the notebook's CPU profile (1,200 images per class, 192 px, full test set) |

The notebooks detect a GPU and switch profile on their own.

### Subject gate (optional)

`python train_gate.py` trains a small "is this a leaf or pest at all?" model (frozen ImageNet
MobileNetV3 features + a linear head, exported as `artifacts/subject/subject_vN`). It needs the
disease and pest datasets plus [Imagenette](https://s3.amazonaws.com/fast-ai-imageclas/imagenette2-320.tgz)
unpacked in `data/raw/negatives/` as non-plant photos. Register it like any model
(`register-model subject subject_v1 --activate`). Without it the API still works; with it,
photos of people, objects, walls or noise are answered "retake the photo" instead of being
forced into a disease class. `python eval_robustness.py disease|pest` measures the effect.

Measured on photos the gate never saw: 99.8 % of non-plant photos and 100 % of noise, flat and
gradient images rejected; 92–100 % of leaf and pest photos kept (field-style clutter included).
Limit: the negatives are 10 object classes, so unusual non-plant scenes may still get through.

### Hyperparameter tuning (crop and yield)

Each tabular notebook runs a random search before the final fit:

* **Crop:** 5-fold cross-validated log loss on the training split.
* **Yield:** quantile (pinball) loss on the two validation years.

The test rows or years are never used to choose parameters, so the reported test scores stay
honest. The chosen parameters are saved in `metadata.json → hyperparameters`. Raise
`TRIALS` for a wider search.

For a free GPU, open the notebook in Google Colab, upload `agrismart_ml/` and the zip,
and run `python -m agrismart_ml.datasets` there.

## 4. Put a model live

From `backend/`:

```powershell
.venv\Scripts\python -m app.cli register-model crop crop_v1 --activate
.venv\Scripts\python -m app.cli activate-model crop crop_v1   # rollback = activate an older version
```

or use **Admin → Models**. Every API instance picks up the change within a minute.

## Results on the real datasets

| Model | Version | Result |
|---|---|---|
| Crop recommendation | `crop_v3` (active) | 99.55 % hold-out accuracy, tuned 5-fold CV 99.26 % (default params 99.15 %), log loss 0.020. Ships with regional planting shares for 30 states (see below) |
| Yield | `yield_v3` (active) | On unseen years 2018–2020: R² 0.907 (0.861 before tuning), RMSE −18 %, median error 14.4 %; P10–P90 range covers 78.5 % of outcomes |
| Plant disease | `disease_v1` | 99.8 % accuracy, macro-F1 0.998 on the full 17,572-image held-out set (38 classes); served as INT8 ONNX (4.9 MB, about 20–60 ms per photo on CPU) |
| Pest | `pest_v1` | 93.2 % accuracy on 825 held-out images (12 classes). At the calibrated 0.6 confidence threshold it answers 88.7 % of photos with 97.4 % accuracy and asks for a clearer photo for the rest |

### How crop advice is decided

The Kaggle crop data has 22 crops and no region, season or irrigation. Its near-perfect
accuracy also comes from a partly synthetic dataset, so the model alone recommended jute and
coffee to a canal-irrigated paddy farmer in Thanjavur. The backend therefore ranks every crop
in the catalogue by

**score ∝ soil/climate fit (model) × regional share (government planting statistics) × agronomic rules**

* **Regional share:** each crop's share of the area planted in the farmer's state and
  season, 2010 onwards. It is computed in notebook 01 from the yield dataset and exported in
  `metadata.json → regional_prior`. This is how wheat (not in the Kaggle data) reaches Punjab
  farmers in rabi.
* **Irrigation:** an irrigated farm is not limited to rainfall, so the model is asked about
  a well-watered season (at least 200 mm). The observed rainfall is still reported.
* **Climate:** season averages over the last 90 days, matching how the training data was
  built, rather than one afternoon's reading.
* **Rules:**
  - season
  - soil type (×0.5 for a mismatch)
  - water risk on rain-fed land
  - crop rotation
  - hill-only crops (coffee, apple) below their minimum elevation
  - the main-states list, for crops the statistics do not track

Checked on live data for eight districts:

| District | Top advice |
|---|---|
| Thanjavur | rice |
| Ludhiana (kharif) | rice |
| Nadia | rice, then jute |
| Rajkot | groundnut |
| Barmer (no regional data) | moth bean, bajra |
| Meerut | rice, then sugarcane |
| Yavatmal | rice ≈ soybean ≈ cotton |
| Kodagu | coffee in the top 3 |

These numbers describe the public datasets, not field performance:

* The crop dataset is small and partly synthetic, so near-perfect accuracy here is a
  sanity check only. Retrain on local Soil Health Card data before relying on it.
* Yield data are state-level averages. The app always shows a range, never a single
  promised number.
* PlantVillage photos are lab images. Check field accuracy on
  [PlantDoc](https://github.com/pratikkayal/PlantDoc-Dataset) before launch, and have an
  agronomist verify the knowledge base (Admin → Diseases).

## Tests

```powershell
.venv\Scripts\python -m pytest tests -q
```

These tests train tiny models through the same code and load them with the backend's own
runtime, so a change that would break serving fails here first.
