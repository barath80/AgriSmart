import sys, numpy as np
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1])); sys.stdout.reconfigure(encoding="utf-8")
import eval_robustness as er
from agrismart_ml.vision import find_class_root, scan, stratified_split
from agrismart_ml.catalog import PEST_LABELS
root = Path(__file__).resolve().parents[1] / "data" / "raw" / "pests"
cr = find_class_root(root, PEST_LABELS)
samples = scan(cr, PEST_LABELS)
tr, va, te = stratified_split(samples, valid=0.15, test=0.15, seed=42)
print("pest images", len(samples), "train", len(tr), "valid", len(va), "test", len(te))
def dh(p, n=16):
    im = Image.open(p).convert("L").resize((n+1, n), Image.BILINEAR); a = np.asarray(im, "f")
    return (a[:, 1:] > a[:, :-1]).flatten()
H_tr = np.stack([dh(p) for p, _ in tr + va]); H_te = np.stack([dh(p) for p, _ in te])
d = (H_te[:, None, :] != H_tr[None, :, :]).sum(2).min(1)
for thr in (0, 8, 20):
    print(f"test images with a training image within {thr}/256 differing bits: {(d <= thr).sum()} ({100*(d<=thr).mean():.1f}%)")
M = er.Model("pest")
ims = [Image.open(p) for p, _ in te]; P = M.probs(ims); pred = P.argmax(1)
t = np.array([M.labels.index(PEST_LABELS.get(l, l) if isinstance(PEST_LABELS, dict) else l) for _, l in te])
print(f"\nserved pest model on its test split: accuracy {(pred==t).mean():.4f}")
for thr in (8, 20):
    m = d > thr
    print(f"  excluding near-duplicates (<= {thr} bits): n={m.sum()} accuracy {(pred[m]==t[m]).mean():.4f}")
    m2 = d <= thr
    if m2.sum(): print(f"  only the near-duplicates (<= {thr}): n={m2.sum()} accuracy {(pred[m2]==t[m2]).mean():.4f}")
