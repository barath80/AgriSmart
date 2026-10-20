"""Worst-case evaluation of the served ONNX image models.

For each model: clean accuracy, accuracy under realistic photo damage (blur, noise, dark,
bright, tiny, heavy JPEG, rotation, partial cover, field-like clutter), and how often images
the model must NOT classify (the other model's images, noise, flat colours, gradients) are
wrongly accepted at the model's confidence threshold. Same pre-processing as the backend.

    python eval_robustness.py disease|pest [--n 1200] [--version disease_v2] [--out report.json]
"""
import argparse
import io
import json
import random
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageEnhance, ImageFilter

from agrismart_ml.catalog import PEST_LABELS, PLANTVILLAGE_LABELS
from agrismart_ml.vision import find_class_root, scan, stratified_split

ROOT = Path(__file__).parent
rng = random.Random(7)
nprng = np.random.default_rng(7)


def latest(name):
    d = sorted((ROOT / "artifacts" / name).glob(f"{name}_v*"), key=lambda p: int(p.name.split("_v")[1]))[-1]
    return d, json.load(open(d / "metadata.json"))


class Model:
    def __init__(self, name, version=None):
        if version:
            self.dir = ROOT / "artifacts" / name / version
            self.meta = json.load(open(self.dir / "metadata.json"))
        else:
            self.dir, self.meta = latest(name)
        self.sess = ort.InferenceSession(str(self.dir / self.meta["artifact"]), providers=["CPUExecutionProvider"])
        i = self.meta["input"]
        self.size, self.mean, self.std = i["size"], np.array(i["mean"], "f"), np.array(i["std"], "f")
        self.labels = self.meta["labels"]
        self.thr = self.meta["min_confidence"]
        self.inp = self.sess.get_inputs()[0].name

    def prep(self, im):
        im = im.convert("RGB")
        w, h = im.size
        s = round(self.size / 0.875) / min(w, h)
        im = im.resize((round(w * s), round(h * s)), Image.BILINEAR)
        left, top = (im.width - self.size) // 2, (im.height - self.size) // 2
        im = im.crop((left, top, left + self.size, top + self.size))
        a = (np.asarray(im, "f") / 255 - self.mean) / self.std
        return a.transpose(2, 0, 1)

    def probs(self, ims, bs=64):
        out = []
        for k in range(0, len(ims), bs):
            x = np.stack([self.prep(i) for i in ims[k:k + bs]])
            z = self.sess.run(None, {self.inp: x})[0]
            z = z - z.max(1, keepdims=True)
            e = np.exp(z)
            out.append(e / e.sum(1, keepdims=True))
        return np.concatenate(out)


# --- damage -------------------------------------------------------------------------------
def jpeg(q):
    def f(im):
        b = io.BytesIO()
        im.convert("RGB").save(b, "JPEG", quality=q)
        b.seek(0)
        return Image.open(b).convert("RGB")
    return f


def motion(k):
    def f(im):
        a = np.asarray(im.convert("RGB"), "f")
        out = np.zeros_like(a)
        for s in range(k):
            out += np.roll(a, s - k // 2, axis=1)
        return Image.fromarray((out / k).astype("uint8"))
    return f


def noise(sd):
    return lambda im: Image.fromarray(
        np.clip(np.asarray(im.convert("RGB"), "f") + nprng.normal(0, sd, (im.height, im.width, 3)), 0, 255).astype("uint8")
    )


def tiny(px):
    return lambda im: im.convert("RGB").resize((px, px), Image.BILINEAR)


def cover(frac):
    def f(im):
        im = im.convert("RGB").copy()
        w, h = im.size
        cw, ch = int(w * frac ** 0.5), int(h * frac ** 0.5)
        x, y = rng.randint(0, w - cw), rng.randint(0, h - ch)
        im.paste((90, 70, 50), (x, y, x + cw, y + ch))
        return im
    return f


def lowlight(im):
    a = np.asarray(ImageEnhance.Brightness(im.convert("RGB")).enhance(0.3), "f")
    return Image.fromarray(np.clip(a + nprng.normal(0, 8, a.shape), 0, 255).astype("uint8"))


def washed(im):
    return ImageEnhance.Contrast(ImageEnhance.Brightness(im.convert("RGB")).enhance(2.0)).enhance(0.5)


def field(im):
    """A leaf photographed in the field: off-centre, soil-coloured clutter, shadow, blur, JPEG."""
    im = im.convert("RGB")
    w, h = im.size
    bg = Image.fromarray(nprng.integers(40, 140, (h * 2, w * 2, 3), dtype="uint8")).filter(ImageFilter.GaussianBlur(25))
    bg.paste(im, (rng.randint(0, w), rng.randint(0, h)))
    bg = bg.crop((rng.randint(0, w // 2), rng.randint(0, h // 2), w + rng.randint(0, w // 2), h + rng.randint(0, h // 2)))
    bg = ImageEnhance.Brightness(bg).enhance(rng.uniform(0.5, 1.2)).filter(ImageFilter.GaussianBlur(rng.uniform(0, 1.5)))
    return jpeg(rng.randint(30, 80))(bg.rotate(rng.uniform(-30, 30)))


DAMAGE = {
    "clean": lambda im: im.convert("RGB"),
    "blur_light(r=2)": lambda im: im.convert("RGB").filter(ImageFilter.GaussianBlur(2)),
    "blur_medium(r=5)": lambda im: im.convert("RGB").filter(ImageFilter.GaussianBlur(5)),
    "blur_heavy(r=10)": lambda im: im.convert("RGB").filter(ImageFilter.GaussianBlur(10)),
    "motion_blur": motion(15),
    "noise_sd25": noise(25),
    "noise_sd60": noise(60),
    "dark(0.3x)": lowlight,
    "overexposed": washed,
    "tiny_64px": tiny(64),
    "jpeg_q10": jpeg(10),
    "rotate_45": lambda im: im.convert("RGB").rotate(45),
    "covered_30pct": cover(0.3),
    "field_like": field,
}


def unknowns(k, other_images):
    out = {"other_model_images": other_images[:k]}
    out["random_noise"] = [Image.fromarray(nprng.integers(0, 256, (256, 256, 3), dtype="uint8")) for _ in range(k)]
    out["flat_colour"] = [Image.new("RGB", (256, 256), tuple(int(x) for x in nprng.integers(0, 256, 3))) for _ in range(k)]
    grads = []
    for _ in range(k):
        x = np.linspace(0, 255, 256, dtype="f")
        a = np.stack([np.tile(x, (256, 1)) * nprng.random(), np.tile(x[:, None], (1, 256)) * nprng.random(),
                      np.full((256, 256), nprng.random() * 255, "f")], -1)
        grads.append(Image.fromarray(a.astype("uint8")))
    out["gradients"] = grads
    out["heavy_blur_of_other"] = [i.convert("RGB").filter(ImageFilter.GaussianBlur(25)) for i in other_images[k:2 * k]]
    return out


def load(name, n):
    if name == "disease":
        root = find_class_root(ROOT / "data/raw/plant_disease", PLANTVILLAGE_LABELS, named="valid")
        samples = scan(root, PLANTVILLAGE_LABELS)
    else:
        root = find_class_root(ROOT / "data/raw/pests", PEST_LABELS)
        samples = stratified_split(scan(root, PEST_LABELS))[2]
    rng.shuffle(samples)
    return samples[:n]


def run(name, n, version=None):
    m = Model(name, version)
    other = "pest" if name == "disease" else "disease"
    samples = load(name, n)
    ims = [Image.open(p).convert("RGB") for p, _ in samples]
    y = np.array([m.labels.index(label) for _, label in samples])
    rep = {"model": m.meta["version"], "images": len(ims), "threshold": m.thr, "damage": {}, "unknown": {}}
    for dn, fn in DAMAGE.items():
        p = m.probs([fn(i) for i in ims])
        top, conf = p.argmax(1), p.max(1)
        acc, ok = top == y, conf >= m.thr
        rep["damage"][dn] = {
            "accuracy": round(float(acc.mean()), 4),
            "mean_conf": round(float(conf.mean()), 3),
            "accepted": round(float(ok.mean()), 4),
            "acc_when_accepted": round(float(acc[ok].mean()), 4) if ok.any() else None,
            "wrong_and_accepted": round(float((ok & ~acc).mean()), 4),
        }
        print(name, f"{dn:20s}", rep["damage"][dn], flush=True)
    k = max(20, n // 3)
    oim = [Image.open(p).convert("RGB") for p, _ in load(other, 2 * k)]
    for un, group in unknowns(k, oim).items():
        conf = m.probs(group).max(1)
        rep["unknown"][un] = {"false_accept_rate": round(float((conf >= m.thr).mean()), 4), "mean_conf": round(float(conf.mean()), 3)}
        print(name, "UNKNOWN", f"{un:22s}", rep["unknown"][un], flush=True)
    return rep


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("model", choices=["disease", "pest"])
    ap.add_argument("--n", type=int, default=1200)
    ap.add_argument("--version")
    ap.add_argument("--out")
    a = ap.parse_args()
    r = run(a.model, a.n, a.version)
    if a.out:
        json.dump(r, open(a.out, "w"), indent=1)
