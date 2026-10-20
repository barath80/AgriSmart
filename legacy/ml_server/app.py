from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback
import os
import pickle
import numpy as np
from datetime import datetime

app = Flask(__name__)
CORS(app)

MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'crop_production_rf_model.pkl')

# Load model at startup
model = None
FEATURES = None
try:
    with open(MODEL_PATH, 'rb') as f:
        loaded = pickle.load(f)

    # If loader returned a dict, try to extract a model-like object
    if isinstance(loaded, dict):
        print('Loaded object is a dict. Keys:', list(loaded.keys()))
        # capture features list if present
        if 'features' in loaded:
            FEATURES = loaded['features']
            try:
                print(f'Found features list with length {len(FEATURES)}')
            except Exception:
                pass
        # look for common keys
        candidate = None
        for key in ('model', 'estimator', 'rf', 'pipeline'):
            if key in loaded and hasattr(loaded[key], 'predict'):
                candidate = loaded[key]
                print(f'Using dict["{key}"] as model')
                break
        # otherwise search values
        if candidate is None:
            for k, v in loaded.items():
                if hasattr(v, 'predict'):
                    candidate = v
                    print(f'Using dict["{k}"] as model (first predict found)')
                    break
        model = candidate
    else:
        model = loaded

    if model is None:
        print('No model with predict() found inside the pickle.')
    else:
        print('Model loaded and ready')

except Exception as e:
    print('Failed to load model:', e)
    traceback.print_exc()


def build_feature_vector(payload):
    """
    Build a feature vector matching the saved FEATURES list when available.
    Known keys we map: crop (one-hot or code), season (one-hot or code), state (one-hot), area, year, rainfall.
    Remaining features are filled with 0.
    """
    crop = (payload.get('crop') or '').lower()
    season = (payload.get('season') or '').lower()
    state = (payload.get('state') or '').lower()
    area = float(payload.get('area', 0))
    year = int(payload.get('year', datetime.now().year))
    rainfall = float(payload.get('rainfall', 0))

    if FEATURES is None:
        # default small vector (6 features)
        return np.array([[
            CROP_MAP.get(crop, -1),
            SEASON_MAP.get(season, -1),
            sum([ord(c) for c in state]) % 1000 if state else 0,
            area,
            year,
            rainfall
        ]], dtype=float)

    n = len(FEATURES)
    vec = np.zeros((1, n), dtype=float)

    # helper lowercase feature name
    for i, fname in enumerate(FEATURES):
        name = str(fname).lower()

        # one-hot style crop features: e.g. 'crop_wheat' or 'commodity_rice'
        if ('crop_' in name or 'commodity_' in name or name.startswith('crop') and name != 'crop'):
            if crop and crop in name:
                vec[0, i] = 1.0
            else:
                vec[0, i] = 0.0
            continue

        if name == 'crop' or name == 'commodity' or name == 'crop_code':
            vec[0, i] = CROP_MAP.get(crop, -1)
            continue

        # season one-hot
        if ('season_' in name) or (name.startswith('season') and name != 'season'):
            if season and season in name:
                vec[0, i] = 1.0
            else:
                vec[0, i] = 0.0
            continue

        if name == 'season' or name == 'season_code':
            vec[0, i] = SEASON_MAP.get(season, -1)
            continue

        if 'area' in name:
            vec[0, i] = area
            continue

        if 'year' in name:
            vec[0, i] = year
            continue

        if 'rain' in name or 'precip' in name:
            vec[0, i] = rainfall
            continue

        # state one-hot / state indicator
        if 'state_' in name or (name.startswith('state') and name != 'state'):
            # try to match state token inside feature name
            if state and state.replace(' ', '') in name:
                vec[0, i] = 1.0
            else:
                vec[0, i] = 0.0
            continue

        if name == 'state' or name == 'state_code':
            vec[0, i] = sum([ord(c) for c in state]) % 1000 if state else 0
            continue

        # fallback: leave as zero
        vec[0, i] = 0.0

    return vec

# A minimal mapping of crops to numeric encodings for example purposes.
# If your model expects different encoding, update this mapping or preprocessing accordingly.
CROP_MAP = {
    'wheat': 0,
    'rice': 1,
    'maize': 2,
    'sugarcane': 3,
    'cotton': 4,
}

SEASON_MAP = {
    'kharif': 0,
    'rabi': 1,
    'zaid': 2,
    'autumn': 3,
    'winter': 4,
}

@app.route('/predict', methods=['POST'])
def predict():
    try:
        payload = request.json or {}
        crop = (payload.get('crop') or '').lower()
        season = (payload.get('season') or '').lower()
        state = payload.get('state') or ''
        area = float(payload.get('area', 0))
        year = int(payload.get('year', datetime.now().year))
        rainfall = float(payload.get('rainfall', 0))

        # Prepare features in the order expected by the model.
        # This is a best-effort default. Adjust feature ordering to match your trained model.
        crop_code = CROP_MAP.get(crop, -1)
        season_code = SEASON_MAP.get(season, -1)
        # Simple state hashing to integer - replace with actual encoding used during training if available
        state_code = sum([ord(c) for c in state.lower()]) % 1000 if state else 0

        # Build full feature vector (may pad to required length)
        X = build_feature_vector(payload)

        if model is None:
            return jsonify({'error': 'Model not loaded'}), 500

        pred = model.predict(X)
        # Assume model predicts tonnes directly. If it predicts kg or other units, adjust accordingly.
        predicted_tonnes = float(pred[0])

        return jsonify({'predicted_tonnes': predicted_tonnes})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/other-crops', methods=['POST'])
def other_crops():
    try:
        payload = request.json or {}
        crops = payload.get('crops', [])
        season = (payload.get('season') or '').lower()
        state = payload.get('state') or ''
        area = float(payload.get('area', 0))
        year = int(payload.get('year', datetime.now().year))
        rainfall = float(payload.get('rainfall', 0))

        results = []
        for c in crops:
            payload_c = {'crop': c, 'season': season, 'state': state, 'area': area, 'year': year, 'rainfall': rainfall}
            X = build_feature_vector(payload_c)
            if model is None:
                results.append({'crop': c, 'predicted_tonnes': None})
            else:
                pred = model.predict(X)
                results.append({'crop': c, 'predicted_tonnes': float(pred[0])})

        return jsonify({'results': results})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    host = os.environ.get('ML_SERVER_HOST', '0.0.0.0')
    port = int(os.environ.get('ML_SERVER_PORT', '5001'))
    debug = os.environ.get('ML_SERVER_DEBUG', '0') in ('1', 'true', 'True')
    print(f'Starting ml_server on {host}:{port} (debug={debug})')
    app.run(host=host, port=port, debug=debug)