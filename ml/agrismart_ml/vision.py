"""Image classification for diseases and pests: transfer learning → ONNX.

    folder of class sub-folders → stratified split → MobileNetV3 / EfficientNet-B0
    (ImageNet weights) → head warm-up → full fine-tune → evaluation → ONNX export
    → numerical check against PyTorch → optional INT8 quantisation

Pre-processing at inference (backend `ImageClassifier.preprocess`) is: resize the short
side to size/0.875, centre-crop `size`, scale to [0,1], normalise. `eval_transform`
below is the same pipeline, so training and serving see identical inputs.
"""

import copy
import json
import random
import time
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import torch
from PIL import Image
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms

from agrismart_ml.registry import create_version_dir, dataset_fingerprint, write_metadata

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


# --- Data ---------------------------------------------------------------------------------

def find_class_root(root: Path, known_labels: dict[str, str], named: str | None = None) -> Path:
    """Locate the directory whose sub-folders are the class folders (datasets nest them).

    `named` restricts the search to directories with that name, e.g. "train" or "valid".
    """
    candidates = [root, *(p for p in root.rglob("*") if p.is_dir())]
    if named:
        candidates = [p for p in candidates if p.name == named]

    def score(directory: Path) -> int:
        return sum((directory / name).is_dir() for name in known_labels)

    best = max(candidates, key=score, default=None)
    if best is None or score(best) == 0:
        where = f"a '{named}' folder under {root}" if named else str(root)
        raise FileNotFoundError(f"No class folders from the label map found in {where}")
    return best


def subsample(samples: list[tuple[Path, str]], per_class: int | None, seed: int = 42) -> list[tuple[Path, str]]:
    """Keep at most `per_class` images per class — for quick CPU experiments only."""
    if per_class is None:
        return samples
    rng, by_label = random.Random(seed), {}
    for sample in samples:
        by_label.setdefault(sample[1], []).append(sample)
    return [s for items in by_label.values() for s in rng.sample(items, min(per_class, len(items)))]


def scan(class_root: Path, label_map: dict[str, str]) -> list[tuple[Path, str]]:
    """List (image, slug). Fails on unmapped class folders instead of silently skipping."""
    unknown = sorted(d.name for d in class_root.iterdir() if d.is_dir() and d.name not in label_map)
    if unknown:
        raise ValueError(f"Class folders without a label mapping (add them to catalog.py): {unknown}")
    samples = [
        (path, label_map[folder.name])
        for folder in sorted(class_root.iterdir()) if folder.is_dir()
        for path in sorted(folder.iterdir()) if path.suffix.lower() in IMAGE_SUFFIXES
    ]
    if not samples:
        raise FileNotFoundError(f"No images under {class_root}")
    return samples


def stratified_split(samples: list[tuple[Path, str]], valid: float = 0.15, test: float = 0.15,
                     seed: int = 42) -> tuple[list, list, list]:
    rng = random.Random(seed)
    by_label: dict[str, list] = {}
    for sample in samples:
        by_label.setdefault(sample[1], []).append(sample)
    train_s, valid_s, test_s = [], [], []
    for items in by_label.values():
        items = items[:]
        rng.shuffle(items)
        # At least one image per class in each requested split; none when a fraction is 0.
        n_test = max(1, round(len(items) * test)) if test > 0 else 0
        n_valid = max(1, round(len(items) * valid)) if valid > 0 else 0
        test_s += items[:n_test]
        valid_s += items[n_test:n_test + n_valid]
        train_s += items[n_test + n_valid:]
    return train_s, valid_s, test_s


def train_transform(size: int) -> transforms.Compose:
    return transforms.Compose([
        transforms.RandomResizedCrop(size, scale=(0.6, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.25, hue=0.03),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])


def eval_transform(size: int) -> transforms.Compose:
    return transforms.Compose([
        transforms.Resize(round(size / 0.875)),
        transforms.CenterCrop(size),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])


class ImageDataset(Dataset):
    def __init__(self, samples: list[tuple[Path, str]], labels: list[str], transform) -> None:
        self.samples = samples
        self.index = {label: i for i, label in enumerate(labels)}
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, i: int):
        path, label = self.samples[i]
        with Image.open(path) as image:
            return self.transform(image.convert("RGB")), self.index[label]


# --- Model --------------------------------------------------------------------------------

def build_model(architecture: str, num_classes: int, pretrained: bool = True) -> nn.Module:
    if architecture == "mobilenet_v3_large":
        weights = models.MobileNet_V3_Large_Weights.IMAGENET1K_V2 if pretrained else None
        model = models.mobilenet_v3_large(weights=weights)
        model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, num_classes)
    elif architecture == "efficientnet_b0":
        weights = models.EfficientNet_B0_Weights.IMAGENET1K_V1 if pretrained else None
        model = models.efficientnet_b0(weights=weights)
        model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, num_classes)
    else:
        raise ValueError("architecture must be 'mobilenet_v3_large' or 'efficientnet_b0'")
    return model


def _head_parameters(model: nn.Module):
    return model.classifier.parameters()


@dataclass
class TrainConfig:
    architecture: str = "mobilenet_v3_large"
    image_size: int = 224
    batch_size: int = 32
    head_epochs: int = 2          # train only the new classifier first
    finetune_epochs: int = 10     # then the whole network at a lower learning rate
    head_lr: float = 1e-3
    finetune_lr: float = 2e-4
    weight_decay: float = 1e-4
    label_smoothing: float = 0.1
    patience: int = 3
    num_workers: int = 2
    pretrained: bool = True
    seed: int = 42
    max_train_batches: int | None = None  # for quick smoke runs only


@dataclass
class TrainedImageModel:
    model: nn.Module
    labels: list[str]
    config: TrainConfig
    history: list[dict[str, float]] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)
    min_confidence: float = 0.55


def _device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def _run_epoch(model, loader, criterion, optimizer, device, scaler, max_batches=None) -> tuple[float, float]:
    training = optimizer is not None
    model.train(training)
    total_loss, correct, seen = 0.0, 0, 0
    with torch.set_grad_enabled(training):
        for batch, (images, targets) in enumerate(loader):
            if max_batches is not None and batch >= max_batches:
                break
            images, targets = images.to(device, non_blocking=True), targets.to(device, non_blocking=True)
            with torch.autocast(device_type=device.type, enabled=scaler is not None):
                logits = model(images)
                loss = criterion(logits, targets)
            if training:
                optimizer.zero_grad(set_to_none=True)
                if scaler is not None:
                    scaler.scale(loss).backward()
                    scaler.step(optimizer)
                    scaler.update()
                else:
                    loss.backward()
                    optimizer.step()
            total_loss += loss.item() * targets.size(0)
            correct += (logits.argmax(1) == targets).sum().item()
            seen += targets.size(0)
    return total_loss / max(seen, 1), correct / max(seen, 1)


def train(train_samples, valid_samples, config: TrainConfig) -> TrainedImageModel:
    torch.manual_seed(config.seed)
    labels = sorted({label for _, label in train_samples})
    device = _device()
    print(f"Training {config.architecture} on {device} — {len(train_samples)} train / "
          f"{len(valid_samples)} valid images, {len(labels)} classes")

    loader_args = {"batch_size": config.batch_size, "num_workers": config.num_workers,
                   "pin_memory": device.type == "cuda", "persistent_workers": config.num_workers > 0}
    train_loader = DataLoader(ImageDataset(train_samples, labels, train_transform(config.image_size)),
                              shuffle=True, **loader_args)
    valid_loader = DataLoader(ImageDataset(valid_samples, labels, eval_transform(config.image_size)),
                              shuffle=False, **loader_args)

    model = build_model(config.architecture, len(labels), config.pretrained).to(device)
    criterion = nn.CrossEntropyLoss(label_smoothing=config.label_smoothing)
    scaler = torch.amp.GradScaler("cuda") if device.type == "cuda" else None
    result = TrainedImageModel(model, labels, config)

    def stage(name: str, params, lr: float, epochs: int) -> None:
        if epochs <= 0:
            return
        optimizer = torch.optim.AdamW(params, lr=lr, weight_decay=config.weight_decay)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
        best_loss, best_state, stale = float("inf"), copy.deepcopy(model.state_dict()), 0
        for epoch in range(1, epochs + 1):
            start = time.time()
            train_loss, train_acc = _run_epoch(model, train_loader, criterion, optimizer, device, scaler,
                                               config.max_train_batches)
            valid_loss, valid_acc = _run_epoch(model, valid_loader, criterion, None, device, None,
                                               config.max_train_batches)
            scheduler.step()
            result.history.append({"stage": name, "epoch": epoch, "train_loss": train_loss, "train_acc": train_acc,
                                   "valid_loss": valid_loss, "valid_acc": valid_acc})
            print(f"[{name}] epoch {epoch}/{epochs}  train {train_loss:.3f}/{train_acc:.3f}  "
                  f"valid {valid_loss:.3f}/{valid_acc:.3f}  ({time.time() - start:.0f}s)")
            if valid_loss < best_loss - 1e-4:
                best_loss, best_state, stale = valid_loss, copy.deepcopy(model.state_dict()), 0
            else:
                stale += 1
                if stale >= config.patience:
                    print(f"[{name}] early stop")
                    break
        model.load_state_dict(best_state)

    for parameter in model.parameters():
        parameter.requires_grad = False
    for parameter in _head_parameters(model):
        parameter.requires_grad = True
    stage("head", _head_parameters(model), config.head_lr, config.head_epochs)

    for parameter in model.parameters():
        parameter.requires_grad = True
    stage("finetune", model.parameters(), config.finetune_lr, config.finetune_epochs)
    return result


@torch.no_grad()
def predict_probabilities(model: nn.Module, samples, labels, size: int, batch_size: int = 64) -> tuple[np.ndarray, np.ndarray]:
    device = next(model.parameters()).device
    model.eval()
    loader = DataLoader(ImageDataset(samples, labels, eval_transform(size)), batch_size=batch_size)
    probabilities, targets = [], []
    for images, y in loader:
        probabilities.append(torch.softmax(model(images.to(device)), dim=1).cpu().numpy())
        targets.append(y.numpy())
    return np.concatenate(probabilities), np.concatenate(targets)


def evaluate(trained: TrainedImageModel, test_samples, target_precision: float = 0.97) -> dict[str, Any]:
    """Test metrics plus a confidence threshold for the backend.

    Below the threshold the app asks for a better photo instead of guessing. It is the
    lowest confidence at which accepted predictions reach `target_precision` accuracy.
    """
    from sklearn.metrics import accuracy_score, f1_score

    probabilities, targets = predict_probabilities(trained.model, test_samples, trained.labels,
                                                   trained.config.image_size)
    predictions = probabilities.argmax(1)
    confidence = probabilities.max(1)
    threshold = 0.95
    for candidate in np.arange(0.30, 0.96, 0.05):
        accepted = confidence >= candidate
        if accepted.any() and (predictions[accepted] == targets[accepted]).mean() >= target_precision:
            threshold = float(round(candidate, 2))
            break
    accepted = confidence >= threshold
    trained.min_confidence = threshold
    trained.metrics = {
        "test_accuracy": round(float(accuracy_score(targets, predictions)), 4),
        "test_macro_f1": round(float(f1_score(targets, predictions, average="macro")), 4),
        "test_top3_accuracy": round(float(np.mean([t in np.argsort(p)[-3:] for t, p in zip(targets, probabilities, strict=True)])), 4),
        "min_confidence": threshold,
        "coverage_at_min_confidence": round(float(accepted.mean()), 4),
        "accuracy_at_min_confidence": round(float((predictions[accepted] == targets[accepted]).mean()) if accepted.any() else 0.0, 4),
        "test_images": int(len(targets)),
        "class_counts_test": dict(Counter(trained.labels[t] for t in targets)),
    }
    return trained.metrics


# --- Export -------------------------------------------------------------------------------

def export_onnx(trained: TrainedImageModel, name: str, dataset_path: Path, version: str | None = None,
                artifacts_dir: Path | None = None, quantize_with: list | None = None) -> Path:
    """Export to ONNX, check it matches PyTorch, optionally add an INT8 variant."""
    import onnxruntime as ort

    kwargs = {"artifacts_dir": artifacts_dir} if artifacts_dir else {}
    directory = create_version_dir(name, version, **kwargs)
    size = trained.config.image_size
    model = trained.model.to("cpu").eval()
    dummy = torch.randn(2, 3, size, size)
    onnx_path = directory / "model.onnx"
    batch = torch.export.Dim("batch", min=1, max=256)
    torch.onnx.export(
        model, (dummy,), str(onnx_path), input_names=["input"], output_names=["logits"],
        dynamic_shapes=({0: batch},), opset_version=18, dynamo=True, external_data=False,
    )

    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    with torch.no_grad():
        expected = model(dummy).numpy()
    actual = session.run(None, {"input": dummy.numpy()})[0]
    max_diff = float(np.abs(expected - actual).max())
    if max_diff > 1e-3:
        raise RuntimeError(f"ONNX output differs from PyTorch by {max_diff}")
    print(f"ONNX matches PyTorch (max abs diff {max_diff:.2e})")

    artifact = "model.onnx"
    extra: dict[str, Any] = {"onnx_max_abs_diff": max_diff}
    if quantize_with:
        artifact, extra["quantization"] = _quantize(directory, onnx_path, quantize_with, trained)

    write_metadata(
        directory,
        framework="onnx",
        task="image_classification",
        artifact=artifact,
        dataset_version=dataset_fingerprint(dataset_path),
        feature_version=f"rgb{size}_imagenet_norm",
        metrics={**trained.metrics, **extra},
        labels=trained.labels,
        input={"size": size, "mean": IMAGENET_MEAN, "std": IMAGENET_STD},
        min_confidence=trained.min_confidence,
        architecture=trained.config.architecture,
        training_history=trained.history,
    )
    (directory / "labels.json").write_text(json.dumps(trained.labels, indent=1), encoding="utf-8")
    print(f"Exported {directory}")
    return directory


def _onnx_accuracy(path: Path, samples: list, labels: list[str], size: int) -> float:
    import onnxruntime as ort

    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    transform, index, correct = eval_transform(size), {l: i for i, l in enumerate(labels)}, 0
    for image_path, label in samples:
        with Image.open(image_path) as image:
            batch = transform(image.convert("RGB")).unsqueeze(0).numpy()
        correct += int(session.run(None, {"input": batch})[0].argmax() == index[label])
    return correct / max(len(samples), 1)


def _quantize(directory: Path, onnx_path: Path, samples: list, trained: TrainedImageModel) -> tuple[str, dict]:
    """Static INT8 quantisation (QDQ) calibrated on real images: ~4x smaller, faster on CPU.

    The INT8 model is used only if it loses at most one accuracy point on held-out
    images; otherwise the FP32 model stays the served artifact.
    """
    from onnxruntime.quantization import CalibrationDataReader, QuantFormat, QuantType, quantize_static

    size = trained.config.image_size
    transform = eval_transform(size)
    calibration, check = samples[:200], samples[200:600] or samples[:200]

    class Reader(CalibrationDataReader):
        def __init__(self) -> None:
            self._items = iter(calibration)

        def get_next(self):
            item = next(self._items, None)
            if item is None:
                return None
            with Image.open(item[0]) as image:
                return {"input": transform(image.convert("RGB")).unsqueeze(0).numpy()}

    int8_path = directory / "model.int8.onnx"
    quantize_static(str(onnx_path), str(int8_path), Reader(), quant_format=QuantFormat.QDQ,
                    activation_type=QuantType.QUInt8, weight_type=QuantType.QInt8, per_channel=True)
    fp32_acc = _onnx_accuracy(onnx_path, check, trained.labels, size)
    int8_acc = _onnx_accuracy(int8_path, check, trained.labels, size)
    use_int8 = fp32_acc - int8_acc <= 0.01
    info = {"fp32_accuracy": round(fp32_acc, 4), "int8_accuracy": round(int8_acc, 4), "served": "int8" if use_int8 else "fp32",
            "fp32_mb": round(onnx_path.stat().st_size / 1e6, 1), "int8_mb": round(int8_path.stat().st_size / 1e6, 1)}
    print(f"Quantisation: {info}")
    return (int8_path.name if use_int8 else onnx_path.name), info
