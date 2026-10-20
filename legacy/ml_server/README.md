# ML Server

This small Flask server loads the provided `crop_production_rf_model.pkl` and exposes two endpoints:

- POST /predict
  - body: { crop, season, state, area, year, rainfall }
  - returns: { predicted_tonnes }

- POST /other-crops
  - body: { crops: ["wheat","rice"...], season, state, area, year, rainfall }
  - returns: { results: [{ crop, predicted_tonnes }, ...] }

Run:

```bash
# make executable and run helper (safe on Linux/mac)
chmod +x run.sh
./run.sh

# then activate and start the server
source venv/bin/activate
python app.py
```

Note: use `requirements.txt` (not `requirement.txt`). The included `run.sh` will create the venv and install packages.

The server listens on port 5001 by default.
