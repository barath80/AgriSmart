import json, sys
import numpy as np, pandas as pd
from pathlib import Path
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.neighbors import KNeighborsClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
sys.stdout.reconfigure(encoding="utf-8")
ML = Path(str(Path(__file__).resolve().parents[1]))
meta = json.load(open(ML/"artifacts/crop/crop_v3/metadata.json"))
df = pd.read_csv(ML/"data/raw/crop_recommendation/Crop_recommendation.csv")
cols = ["N","P","K","temperature","humidity","ph","rainfall"]
print("rows", len(df), "dups", df.duplicated().sum(), "classes", df.label.nunique(), "rows/class", df.label.value_counts().unique())
labels = sorted(df.label.unique()); idx = {l:i for i,l in enumerate(labels)}
X = df[cols].to_numpy(float); y = df.label.map(idx).to_numpy()
hp = {k:v for k,v in meta["hyperparameters"].items()}
mk = lambda: XGBClassifier(**hp, objective="multi:softprob", tree_method="hist", random_state=42, n_jobs=4)
Xtr,Xte,ytr,yte = train_test_split(X,y,test_size=0.2,stratify=y,random_state=42)
m = mk().fit(Xtr,ytr)
acc = lambda mm,A,b: (mm.predict(A)==b).mean()
print(f"\n[1] random split accuracy (what the notebook reports): {acc(m,Xte,yte):.4f}")

print("\n[2] SIMPLE BASELINES on same split (if easy models also ~97-99%, the dataset is easy, not the model magic)")
for name, mdl in [("kNN k=5 (scaled)", make_pipeline(StandardScaler(),KNeighborsClassifier(5))), ("LogisticRegression", make_pipeline(StandardScaler(),LogisticRegression(max_iter=2000)))]:
    mdl.fit(Xtr,ytr); print(f"  {name}: {mdl.score(Xte,yte):.4f}")

print("\n[3] INPUT NOISE (farmer estimates / cheap sensors): gaussian noise = % of each feature's std")
sd = X.std(0); rng = np.random.default_rng(0)
for pct in [0,10,25,50,100]:
    accs=[acc(m, Xte + rng.normal(0,1,Xte.shape)*sd*pct/100, yte) for _ in range(5)]
    print(f"  noise {pct:>3}% of std -> accuracy {np.mean(accs):.4f}")

print("\n[4] UNSEEN EXTREMES: train on the middle 80% of each crop, test on its most atypical 20%")
Z = np.zeros(len(X)); 
for c in range(len(labels)):
    mask = y==c; mu = X[mask].mean(0); s = X[mask].std(0)+1e-9
    Z[mask] = np.sqrt((((X[mask]-mu)/s)**2).sum(1))
test_mask = np.zeros(len(X),bool)
for c in range(len(labels)):
    mask = np.where(y==c)[0]; thr = np.quantile(Z[mask],0.8); test_mask[mask[Z[mask]>=thr]] = True
m2 = mk().fit(X[~test_mask],y[~test_mask])
print(f"  trained on {(~test_mask).sum()}, tested on {test_mask.sum()} atypical rows -> accuracy {acc(m2,X[test_mask],y[test_mask]):.4f}")

print("\n[5] UNSEEN CONDITIONS: hold out one climate band entirely (train hot, test cool, etc.)")
for col in ["temperature","rainfall","humidity"]:
    j = cols.index(col); lo,hi = np.quantile(X[:,j],[0.2,0.8])
    for name,tm in [(f"{col} lowest 20%", X[:,j]<=lo),(f"{col} highest 20%", X[:,j]>=hi)]:
        ytrn = y[~tm]; classes = np.unique(ytrn); remap = {c:i for i,c in enumerate(classes)}
        mm = mk().fit(X[~tm], np.array([remap[v] for v in ytrn]))
        keep = np.array([v in remap for v in y[tm]])
        pred = classes[mm.predict(X[tm][keep])]
        print(f"  held out {name:<26} n={tm.sum():>3}: accuracy {(pred==y[tm][keep]).mean():.4f}  ({(~keep).sum()} rows of crops that only grow there were skipped)")

print("\n[6] Out-of-distribution input (nonsense soil): model still names a crop?")
junk = np.array([[0,0,0,-10,0,2,0],[500,500,500,70,100,14,3000],[50,50,50,25,60,2.0,100]],float)
p = m.predict_proba(junk); 
for row,pp in zip(junk,p): print("  ", row.tolist(), "->", labels[pp.argmax()], f"conf {pp.max():.2f}")
