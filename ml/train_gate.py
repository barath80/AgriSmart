"""Train the 'subject gate': is this photo a plant leaf or a pest at all?

The disease and pest classifiers always pick one of their classes, so a photo of a person or a
wall still gets a confident-looking disease. This gate is a linear head on frozen ImageNet
MobileNetV3 features (so it generalises beyond the few negative photos we have), exported as
one ONNX file in the same format as the other image models (labels: other, subject).

    positives: plant-disease + pest photos, half of them with field-style damage
    negatives: Imagenette photos (10 non-plant object classes) + synthetic noise/flat/gradients

    python train_gate.py [--per-class 40]
"""
import argparse
import random
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from sklearn.linear_model import LogisticRegression
from torch import nn
from torchvision import models

import eval_robustness as E
from agrismart_ml.catalog import PEST_LABELS, PLANTVILLAGE_LABELS
from agrismart_ml.registry import create_version_dir, dataset_fingerprint, write_metadata
from agrismart_ml.vision import IMAGENET_MEAN, IMAGENET_STD, find_class_root, scan

ROOT = Path(__file__).parent
SIZE = 224
rng = random.Random(3)
nprng = np.random.default_rng(3)


def sample(samples, per_class):
    by = {}
    for p, label in samples:
        by.setdefault(label, []).append(p)
    out = []
    for label, ps in by.items():
        rng.shuffle(ps)
        out += ps[:per_class]
    return out


def synthetic(n):
    ims = []
    for i in range(n):
        kind = i % 4
        if kind == 0:
            a = nprng.integers(0, 256, (256, 256, 3), dtype="uint8")
        elif kind == 1:
            a = np.full((256, 256, 3), nprng.integers(0, 256, 3), dtype="uint8")
        elif kind == 2:
            x = np.linspace(0, 255, 256, dtype="f")
            a = np.stack([np.tile(x, (256, 1)) * nprng.random(), np.tile(x[:, None], (1, 256)) * nprng.random(),
                          np.full((256, 256), nprng.random() * 255, "f")], -1).astype("uint8")
        else:
            a = (nprng.random((8, 8, 3)) * 255).astype("uint8")
            a = np.asarray(Image.fromarray(a).resize((256, 256), Image.BICUBIC))
        ims.append(Image.fromarray(a))
    return ims


class Net(nn.Module):
    def __init__(self, backbone, head):
        super().__init__()
        self.backbone, self.head = backbone, head

    def forward(self, x):
        return self.head(self.backbone(x))


def main(per_class):
    weights = models.MobileNet_V3_Large_Weights.IMAGENET1K_V2
    m = models.mobilenet_v3_large(weights=weights).eval()
    backbone = nn.Sequential(m.features, m.avgpool, nn.Flatten())
    mean = torch.tensor(IMAGENET_MEAN).view(1, 3, 1, 1)
    std = torch.tensor(IMAGENET_STD).view(1, 3, 1, 1)

    def feats(ims):
        out = []
        for k in range(0, len(ims), 64):
            x = torch.stack([torch.from_numpy(E.Model.prep(type("P", (), {"size": SIZE, "mean": np.array(IMAGENET_MEAN, "f"),
                                                                           "std": np.array(IMAGENET_STD, "f")})(), i)) for i in ims[k:k + 64]])
            with torch.no_grad():
                out.append(backbone(x).numpy())
        return np.concatenate(out)

    dis = scan(find_class_root(ROOT / "data/raw/plant_disease", PLANTVILLAGE_LABELS, named="train"), PLANTVILLAGE_LABELS)
    pest = scan(find_class_root(ROOT / "data/raw/pests", PEST_LABELS), PEST_LABELS)
    pos_paths = sample(dis, per_class) + sample(pest, per_class * 3)
    rng.shuffle(pos_paths)
    neg_root = next((ROOT / "data/raw/negatives").glob("imagenette2-320"))
    neg_paths = [p for p in (neg_root / "train").rglob("*.JPEG")]
    rng.shuffle(neg_paths)
    neg_paths = neg_paths[:len(pos_paths)]
    print(len(pos_paths), "positives", len(neg_paths), "natural negatives", flush=True)

    def load(paths, aug):
        ims = []
        for i, p in enumerate(paths):
            im = Image.open(p).convert("RGB")
            ims.append(E.field(im) if aug and i % 2 else im)
        return ims

    X, y, group = [], [], []
    for paths, label, aug, g in [(pos_paths, 1, True, "pos"), (neg_paths, 0, True, "neg")]:
        f = feats(load(paths, aug))
        X.append(f); y += [label] * len(f); group += [g] * len(f)
    syn = feats(synthetic(max(200, len(neg_paths) // 6)))
    X.append(syn); y += [0] * len(syn); group += ["syn"] * len(syn)
    X, y = np.concatenate(X), np.array(y)

    idx = np.arange(len(y)); nprng.shuffle(idx)
    cut = int(len(idx) * 0.8)
    tr, te = idx[:cut], idx[cut:]
    clf = LogisticRegression(C=0.5, max_iter=2000, class_weight="balanced").fit(X[tr], y[tr])
    p = clf.predict_proba(X[te])[:, 1]
    thr = 0.5
    acc = ((p >= thr) == y[te]).mean()
    pos_keep = (p[y[te] == 1] >= thr).mean()
    neg_rej = (p[y[te] == 0] < thr).mean()
    print(f"held-out: accuracy {acc:.4f}  leaves/pests kept {pos_keep:.4f}  non-plants rejected {neg_rej:.4f}", flush=True)

    # Final fit on everything, then export backbone+head as one ONNX.
    clf = LogisticRegression(C=0.5, max_iter=2000, class_weight="balanced").fit(X, y)
    head = nn.Linear(X.shape[1], 2)
    w = torch.tensor(clf.coef_[0], dtype=torch.float32)
    with torch.no_grad():
        head.weight.copy_(torch.stack([-w / 2, w / 2]))
        head.bias.copy_(torch.tensor([-clf.intercept_[0] / 2, clf.intercept_[0] / 2], dtype=torch.float32))
    net = Net(backbone, head).eval()

    directory = create_version_dir("subject")
    torch.onnx.export(net, torch.zeros(1, 3, SIZE, SIZE), str(directory / "model.onnx"),
                      input_names=["input"], output_names=["logits"], dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
                      opset_version=17, dynamo=False)
    import onnxruntime as ort
    sess = ort.InferenceSession(str(directory / "model.onnx"), providers=["CPUExecutionProvider"])
    probe = X[:1]
    sample_im = Image.open(pos_paths[0]).convert("RGB")
    xin = E.Model.prep(type("P", (), {"size": SIZE, "mean": np.array(IMAGENET_MEAN, "f"), "std": np.array(IMAGENET_STD, "f")})(), sample_im)[None]
    with torch.no_grad():
        ref = net(torch.from_numpy(xin)).numpy()
    got = sess.run(None, {"input": xin})[0]
    assert np.allclose(ref, got, atol=1e-3), "ONNX differs from PyTorch"
    write_metadata(
        directory, framework="onnx", task="image_classification", artifact="model.onnx",
        dataset_version=f"gate:{dataset_fingerprint(ROOT / 'data/raw/pests')}+imagenette",
        feature_version="rgb224_imagenet_norm", labels=["other", "subject"],
        input={"size": SIZE, "mean": IMAGENET_MEAN, "std": IMAGENET_STD},
        min_confidence=thr,
        metrics={"heldout_accuracy": round(float(acc), 4), "subjects_kept": round(float(pos_keep), 4),
                 "non_plants_rejected": round(float(neg_rej), 4), "train_images": int(len(y))},
    )
    print("exported", directory, flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-class", type=int, default=40)
    main(ap.parse_args().per_class)
