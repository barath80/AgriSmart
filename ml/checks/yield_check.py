import json, sys
import numpy as np, pandas as pd, xgboost as xgb
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.stdout.reconfigure(encoding="utf-8")
from agrismart_ml import yield_model as ym
from agrismart_ml.encoding import encode_frame
ML = Path(str(Path(__file__).resolve().parents[1]))
meta = json.load(open(ML/"artifacts/yield/yield_v3/metadata.json"))
spec = meta["features"]; scale = meta["interval_scale"]
fr = ym.load(ML/"data/raw/crop_yield/crop_yield.csv")
tr, va, te = ym.temporal_split(fr)
print("train", len(tr), tr.crop_year.min(), tr.crop_year.max(), "| valid", len(va), "| test", len(te), te.crop_year.min(), te.crop_year.max())
b = xgb.Booster(); b.load_model(str(ML/"artifacts/yield/yield_v3/model.json"))
def predict(b, df, spec, scale=scale):
    q = b.predict(xgb.DMatrix(encode_frame(df, spec))); q = np.sort(q.reshape(len(df), -1), axis=1)
    w = ym.widen(q, scale); return np.expm1(w)
P = predict(b, te, spec); y = te.yield_t_ha.to_numpy(); p50 = P[:,1]
def metrics(y, p):
    ape = np.abs(p-y)/y
    return dict(MAE=np.abs(p-y).mean(), RMSE=np.sqrt(((p-y)**2).mean()), R2=1-((p-y)**2).sum()/((y-y.mean())**2).sum(), MAPE=100*ape.mean(), medAPE=100*np.median(ape), within20=100*(ape<=0.2).mean(), within50=100*(ape<=0.5).mean())
fmt = lambda d: "  ".join(f"{k} {v:.2f}" for k,v in d.items())
print("\n[1] SERVED MODEL on unseen future years:", fmt(metrics(y,p50)))
print("    P10-P90 coverage:", round(((y>=P[:,0])&(y<=P[:,2])).mean(),4))

print("\n[2] BASELINES (no ML) on the same test years  -> does the model add value?")
cs = tr.groupby(["crop","state"]).yield_t_ha.median(); c = tr.groupby("crop").yield_t_ha.median()
base_cs = np.array([cs.get((r.crop,r.state), c.get(r.crop, tr.yield_t_ha.median())) for r in te.itertuples()])
base_c = te.crop.map(c).fillna(tr.yield_t_ha.median()).to_numpy()
print("    crop median only        :", fmt(metrics(y, base_c)))
print("    crop+state median       :", fmt(metrics(y, base_cs)))

print("\n[3] WHERE IT FAILS: error by crop (test years)")
d = te.assign(p=p50, ape=np.abs(p50-y)/y*100)
t = d.groupby("crop").agg(n=("ape","size"), mean_yield=("yield_t_ha","mean"), medAPE=("ape","median"), MAPE=("ape","mean")).sort_values("MAPE")
print(t.round(1).to_string())
print("    R2 without sugarcane/banana/potato/onion (big-yield crops):", round(metrics(y[~te.crop.isin(["sugarcane","banana","potato","onion"]).to_numpy()], p50[~te.crop.isin(["sugarcane","banana","potato","onion"]).to_numpy()])["R2"],3))

print("\n[4] ABLATION: drop rainfall/fertilizer/pesticide (retrain, fixed 468 rounds) -> how much do the 'real' inputs matter?")
def fit(trn, sp, rounds=468):
    params = ym._booster_params(42, None)
    dm = xgb.DMatrix(encode_frame(trn, sp), label=np.log1p(trn.yield_t_ha.to_numpy()))
    return xgb.train(params, dm, num_boost_round=rounds)
def run(sp, trn, tst):
    bb = fit(trn, sp); pp = predict(bb, tst, sp, 1.0)[:,1]; return metrics(tst.yield_t_ha.to_numpy(), pp)
full = {"numeric": spec["numeric"], "categorical": spec["categorical"]}
nofarm = {"numeric": ["crop_year"], "categorical": spec["categorical"]}
cropstate = {"numeric": [], "categorical": {k: spec["categorical"][k] for k in ["crop","state"]}}
print("    all features      :", fmt(run(full, tr, te)))
print("    only year+cat     :", fmt(run(nofarm, tr, te)))
print("    only crop+state   :", fmt(run(cropstate, tr, te)))

print("\n[5] UNSEEN STATE: hold out a whole state (never seen in training), all years")
rng = np.random.default_rng(1); states = fr.state.value_counts(); states = states[states>=60].index.tolist()
res=[]
for s in rng.choice(states, 6, replace=False):
    trn = fr[fr.state!=s]; tst = fr[fr.state==s]
    m = run(full, trn, tst); res.append(m); print(f"    {s:<18} n={len(tst):>4}:", fmt(m))
print("    AVERAGE over held-out states:", fmt({k: np.mean([r[k] for r in res]) for k in res[0]}))

print("\n[6] UNSEEN CROP: hold out a whole crop")
res=[]
for cname in ["wheat","rice","maize","groundnut","chickpea","mustard"]:
    trn = fr[fr.crop!=cname]; tst = fr[fr.crop==cname]
    sp = {"numeric": spec["numeric"], "categorical": spec["categorical"]}
    m = run(sp, trn, tst); res.append(m); print(f"    {cname:<10} n={len(tst):>4}:", fmt(m))
print("    AVERAGE:", fmt({k: np.mean([r[k] for r in res]) for k in res[0]}))
