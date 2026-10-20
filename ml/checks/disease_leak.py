from pathlib import Path
import os, re, sys, collections, json
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1])); sys.stdout.reconfigure(encoding="utf-8")
import eval_robustness as er
from agrismart_ml.catalog import PLANTVILLAGE_LABELS
R = str(Path(__file__).resolve().parents[1] / "data" / "raw" / "plant_disease")
def base(n):
    n = os.path.splitext(n)[0]
    return re.sub(r'(_(new)?\d*deg(Flip(LR|TB))?|_flip(LR|TB))+$', '', n)
tr = collections.defaultdict(set)
for c in os.listdir(f"{R}/train"):
    for f in os.listdir(f"{R}/train/{c}"): tr[c].add(base(f))
files = []
for c in sorted(os.listdir(f"{R}/valid")):
    for f in os.listdir(f"{R}/valid/{c}"):
        files.append((c, f, base(f) in tr[c], bool(re.search(r'deg|flip', f))))
seen = sum(x[2] for x in files); print(f"valid files: {len(files)} | source photo also in train: {seen} ({100*seen/len(files):.1f}%) | never in train: {len(files)-seen}")
M = er.Model("disease")
lab = {k: v for k, v in PLANTVILLAGE_LABELS.items()} if isinstance(PLANTVILLAGE_LABELS, dict) else None
print("sample folder->label:", list(lab.items())[:2] if lab else PLANTVILLAGE_LABELS[:2])
def truth(c):
    return lab[c] if lab and c in lab else c
rng = np.random.default_rng(0)
def evaluate(group, name, n=3000):
    sel = [files[i] for i in rng.permutation(len(files)) if group(files[i])][:n]
    ok = acc_ok = acc_n = 0; ims = [Image.open(f"{R}/valid/{c}/{f}") for c, f, *_ in sel]
    P = M.probs(ims); pred = P.argmax(1); conf = P.max(1)
    t = np.array([M.labels.index(truth(c)) for c, *_ in sel])
    a = (pred == t).mean(); acc_mask = conf >= M.thr
    print(f"  {name:<52} n={len(sel):>5}  accuracy {a:.4f}  | answers {acc_mask.mean():.3f}, correct-when-answering {(pred==t)[acc_mask].mean():.4f}")
    return sel, pred, t
print("\nACCURACY of the served model by how 'new' the test photo is")
evaluate(lambda x: True, "all test files (the reported number)")
evaluate(lambda x: x[2], "source photo ALSO in training (leaked)")
s, p, t = evaluate(lambda x: not x[2], "source photo NEVER in training (clean)")
evaluate(lambda x: (not x[2]) and (not x[3]), "clean AND not rotated/flipped (original photos only)")
wrong = collections.Counter((M.labels[a], M.labels[b]) for a, b in zip(t, p) if a != b)
print("\nmost common mistakes on clean set (true -> predicted):")
for (a, b), n in wrong.most_common(8): print(f"  {n:>3}  {a} -> {b}")
perc = collections.defaultdict(lambda: [0, 0])
for (c, *_), a, b in zip(s, t, p): perc[M.labels[a]][0] += 1; perc[M.labels[a]][1] += (a == b)
worst = sorted(((v[1] / v[0], k, v[0]) for k, v in perc.items() if v[0] >= 20))[:6]
print("\nweakest classes on clean set:"); [print(f"  {k:<36} {a:.3f} (n={n})") for a, k, n in worst]
