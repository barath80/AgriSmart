"""Test harness: SQLite database, tiny real models, fake external providers.

Environment variables are set before any `app` import because the engine and settings
are created at import time.
"""

import json
import os
import tempfile
from datetime import date, timedelta
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="agrismart-test-"))
os.environ.update(
    ENVIRONMENT="test",
    # Set TEST_DATABASE_URL to an *empty, disposable* PostgreSQL database to run the suite
    # against PostgreSQL (CI does); otherwise a throwaway SQLite file is used.
    DATABASE_URL=os.environ.get(
        "TEST_DATABASE_URL", f"sqlite+aiosqlite:///{(_TMP / 'test.db').as_posix()}"
    ),
    MODEL_DIR=str(_TMP / "models"),
    JWT_SECRET="test-secret-that-is-long-enough-for-hs256",
    BOOTSTRAP_ADMIN_EMAIL="admin@agrismart.in",
    BOOTSTRAP_ADMIN_PASSWORD="correct-horse-battery",
    VOICE_PROVIDER="none",
    VOICE_FALLBACK_PROVIDER="none",
    GEMINI_API_KEY="test-gemini-key",  # never a real key: tests must not reach Google
    LLM_PROVIDER="none",
    MARKET_PROVIDER="none",
    ML_REGISTRY_REFRESH_SECONDS="0",
)

import httpx  # noqa: E402
import numpy as np  # noqa: E402
import pytest  # noqa: E402

from app import cli  # noqa: E402
from app.auth import service as auth_service  # noqa: E402
from app.core import rate_limit  # noqa: E402
from app.core.database import Base, SessionFactory, engine, utcnow  # noqa: E402
from app.main import app  # noqa: E402
from app.weather.schemas import CurrentWeather, DailyForecast, WeatherReport  # noqa: E402

ADMIN = {"email": "admin@agrismart.in", "password": "correct-horse-battery"}
MODEL_DIR = _TMP / "models"


class FakeSms:
    def __init__(self) -> None:
        self.sent: list[tuple[str, str]] = []

    async def send(self, phone: str, text: str) -> None:
        self.sent.append((phone, text))


class FakeWeather:
    name = "fake"
    calls = 0

    async def fetch(self, latitude: float, longitude: float) -> WeatherReport:
        FakeWeather.calls += 1
        today = date.today()
        daily = [
            DailyForecast(date=today + timedelta(days=i), temp_max_c=33, temp_min_c=24,
                          rain_mm=80 if i == 1 else 0, rain_probability_pct=90 if i == 1 else 10,
                          wind_max_kmh=8, condition="rain" if i == 1 else "clear")
            for i in range(7)
        ]
        return WeatherReport(
            latitude=latitude, longitude=longitude,
            current=CurrentWeather(temperature_c=28.4, humidity_pct=71, precipitation_mm=0,
                                   wind_kmh=6, condition="cloudy"),
            daily=daily, rainfall_last_90_days_mm=210.0, source=self.name, fetched_at=utcnow(),
        )


sms = FakeSms()


@pytest.fixture(scope="session", autouse=True)
async def database():
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    await cli.seed()
    async with SessionFactory() as session:
        await auth_service.ensure_bootstrap_admin(session)
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
def fakes(monkeypatch):
    # Every test client shares one IP; start each test with a fresh per-IP window.
    rate_limit._window._hits.clear()
    monkeypatch.setattr(auth_service, "get_sms_sender", lambda: sms)
    monkeypatch.setattr("app.notification.service.get_sms_sender", lambda: sms)
    monkeypatch.setattr("app.weather.service.get_weather_provider", lambda: FakeWeather())
    monkeypatch.setattr("app.farmer.service.geocode", fake_geocode)


async def fake_geocode(state: str, district: str, village: str = "") -> tuple[float, float] | None:
    return {"Pune": (18.52, 73.86)}.get(district)


@pytest.fixture(scope="session")
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        yield http


_phone_counter = iter(range(9_000_000_000, 9_999_999_999))


async def login_farmer(client: httpx.AsyncClient, language: str = "en") -> tuple[dict, str]:
    phone = str(next(_phone_counter))
    assert (await client.post("/api/v1/auth/otp", json={"phone": phone})).status_code == 200
    code = next(text.split(": ")[1][:6] for to, text in reversed(sms.sent) if to.endswith(phone))
    response = await client.post("/api/v1/auth/login", json={"phone": phone, "otp": code, "language": language})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}, phone


@pytest.fixture
async def farmer(client):
    headers, _ = await login_farmer(client)
    return headers


@pytest.fixture
async def onboarded_farmer(client):
    """A farmer with location, a farm and a soil test — enough for every tool."""
    headers, _ = await login_farmer(client)
    await client.put("/api/v1/farmer/profile", headers=headers, json={
        "name": "Murugan", "birth_year": 1990,
        "location": {"state": "Tamil Nadu", "district": "Thanjavur", "latitude": 10.78, "longitude": 79.13},
    })
    farm = (await client.post("/api/v1/farms", headers=headers, json={
        "name": "East field", "area_acres": 2.5, "soil_type": "clay", "irrigation": "canal",
    })).json()
    await client.post(f"/api/v1/farms/{farm['id']}/soil", headers=headers, json={
        "nitrogen": 90, "phosphorus": 42, "potassium": 43, "ph": 6.5, "tested_on": date.today().isoformat(),
    })
    headers["X-Farm-Id"] = farm["id"]
    return headers


@pytest.fixture(scope="session")
async def admin(client):
    response = await client.post("/api/v1/auth/admin/login", json=ADMIN)
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


# --- Tiny but real model artifacts (same format the ml/ notebooks export) ----------------

CROP_FEATURES = ["nitrogen", "phosphorus", "potassium", "temperature", "humidity", "ph", "rainfall"]
CROP_LABELS = ["rice", "maize", "chickpea", "cotton"]


def _write_metadata(directory: Path, **metadata) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")


def build_crop_model(version: str = "crop_v1", regional_prior: dict | None = None) -> None:
    import xgboost as xgb

    rng = np.random.default_rng(0)
    centers = np.array([[80, 45, 40, 24, 82, 6.4, 230], [78, 48, 20, 22, 65, 6.2, 85],
                        [40, 68, 80, 18, 17, 7.3, 80], [118, 46, 20, 24, 80, 6.9, 80]])
    x = np.vstack([c + rng.normal(0, [8, 6, 6, 1.5, 4, 0.3, 15], (60, 7)) for c in centers])
    y = np.repeat(np.arange(len(CROP_LABELS)), 60)
    params = {"objective": "multi:softprob", "num_class": len(CROP_LABELS), "max_depth": 3}
    booster = xgb.train(params, xgb.DMatrix(x, label=y), num_boost_round=30)
    directory = MODEL_DIR / "crop" / version
    directory.mkdir(parents=True, exist_ok=True)
    booster.save_model(directory / "model.json")
    _write_metadata(
        directory, name="crop", version=version, framework="xgboost", task="classification",
        artifact="model.json", dataset_version="synthetic-test", feature_version="crop_features_v1",
        trained_at="2026-01-01T00:00:00+00:00", metrics={"accuracy": 1.0},
        features={"numeric": CROP_FEATURES, "categorical": {}}, labels=CROP_LABELS,
        feature_ranges={"nitrogen": [0, 140], "ph": [3.5, 9.9]},
        **({"regional_prior": regional_prior} if regional_prior else {}),
    )


def build_image_model(name: str, labels: list[str], version: str) -> None:
    """A minimal ONNX classifier: global average pool over RGB → linear layer."""
    import onnx
    from onnx import TensorProto, helper

    weights = np.zeros((3, len(labels)), dtype=np.float32)
    weights[1, 0] = 6.0  # green images → first label
    weights[0, 1] = 6.0  # red images → second label
    graph = helper.make_graph(
        [
            helper.make_node("GlobalAveragePool", ["input"], ["pooled"]),
            helper.make_node("Flatten", ["pooled"], ["flat"]),
            helper.make_node("MatMul", ["flat", "W"], ["logits"]),
        ],
        "tiny",
        [helper.make_tensor_value_info("input", TensorProto.FLOAT, ["batch", 3, 64, 64])],
        [helper.make_tensor_value_info("logits", TensorProto.FLOAT, ["batch", len(labels)])],
        [helper.make_tensor("W", TensorProto.FLOAT, weights.shape, weights.flatten())],
    )
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)])
    model.ir_version = 8
    directory = MODEL_DIR / name / version
    directory.mkdir(parents=True, exist_ok=True)
    onnx.save(model, directory / "model.onnx")
    _write_metadata(
        directory, name=name, version=version, framework="onnx", task="image_classification",
        artifact="model.onnx", dataset_version="synthetic-test", feature_version="rgb64",
        trained_at="2026-01-01T00:00:00+00:00", metrics={"accuracy": 1.0}, labels=labels,
        input={"size": 64, "mean": [0.0, 0.0, 0.0], "std": [1.0, 1.0, 1.0]},
    )


def solid_jpeg(rgb: tuple[int, int, int], size: int = 200, *, textured: bool = True) -> bytes:
    """A single-colour photo. Textured by default, since flat images are rejected as unclear."""
    import io

    import numpy as np
    from PIL import Image

    base = np.full((size, size, 3), rgb, dtype=np.int16)
    if textured:
        base += np.random.default_rng(1).integers(-40, 41, (size, size, 1), dtype=np.int16)
    buffer = io.BytesIO()
    Image.fromarray(np.clip(base, 0, 255).astype("uint8")).save(buffer, format="JPEG", quality=95)
    return buffer.getvalue()
