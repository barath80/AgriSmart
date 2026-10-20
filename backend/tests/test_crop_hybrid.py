"""Crop advice combines the soil/climate model with what the farmer's region plants."""

from datetime import date

from app.crop.rules import FarmConditions
from app.crop.schemas import CropInfo
from app.crop.service import _rank
from app.core.language import Language
from app.farm.models import Season, SoilType
from app.ml.runtime import Prediction
from tests.conftest import build_crop_model, login_farmer

API = "/api/v1"


def _info(slug: str, **extra) -> CropInfo:
    return CropInfo(slug=slug, names={"en": slug.title()}, aliases=[], category="cereal",
                    seasons=["kharif", "rabi"], duration_days_min=90, duration_days_max=120,
                    water_requirement="medium", suitable_soils=[], fertilizer_guidance="",
                    yield_min_q_per_acre=10, yield_max_q_per_acre=20, market_commodity=None, **extra)


CATALOG = {s: _info(s) for s in ("rice", "jute", "wheat")} | {
    "coffee": _info("coffee", min_elevation_m=500)
}
OVERCONFIDENT = [Prediction("jute", 0.6), Prediction("coffee", 0.39), Prediction("rice", 0.01)]


def test_region_and_rules_temper_an_overconfident_model():
    tamil_nadu_kharif = {"rice": 0.43, "sugarcane": 0.08}
    ranked = _rank(OVERCONFIDENT, CATALOG, FarmConditions(elevation_m=61), Language.ENGLISH, tamil_nadu_kharif)
    assert ranked[0].crop == "rice"
    coffee = next(o for o in ranked if o.crop == "coffee")
    assert "needs_hills" in coffee.reasons
    assert abs(sum(o.score for o in ranked) - 1) < 1e-3


def test_crops_outside_the_model_come_from_regional_data():
    punjab_rabi = {"wheat": 0.97, "mustard": 0.01}
    ranked = _rank(OVERCONFIDENT, CATALOG, FarmConditions(), Language.ENGLISH, punjab_rabi)
    assert ranked[0].crop == "wheat" and ranked[0].model_probability is None
    assert ranked[0].regional_share == 0.97


def test_without_regional_data_the_model_and_rules_decide():
    ranked = _rank(OVERCONFIDENT, CATALOG, FarmConditions(season=Season.KHARIF, soil_type=SoilType.CLAY),
                   Language.ENGLISH, {})
    assert ranked[0].crop == "jute"


async def test_api_recommends_wheat_for_punjab_rabi(client, admin):
    build_crop_model("crop_v9", regional_prior={"Punjab": {"rabi": {"wheat": 0.96, "mustard": 0.02}}})
    registered = await client.post(f"{API}/admin/models", headers=admin,
                                   json={"name": "crop", "version": "crop_v9", "activate": True})
    assert registered.status_code == 201, registered.text
    headers, _ = await login_farmer(client)
    await client.put(f"{API}/farmer/profile", headers=headers, json={
        "name": "Gurpreet", "location": {"state": "Punjab", "district": "Ludhiana", "latitude": 30.9, "longitude": 75.85},
    })
    farm = (await client.post(f"{API}/farms", headers=headers, json={
        "name": "Home", "area_acres": 5, "soil_type": "loamy", "irrigation": "borewell"})).json()
    await client.post(f"{API}/farms/{farm['id']}/soil", headers=headers, json={
        "nitrogen": 110, "phosphorus": 50, "potassium": 40, "ph": 7.4, "tested_on": date.today().isoformat()})
    response = await client.post(f"{API}/crop/recommend", headers={**headers, "X-Farm-Id": farm["id"]},
                                 json={"season": "rabi"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["recommended"]["crop"] == "wheat"
    assert body["inputs_used"]["regional_data"] == "yes"
    assert body["inputs_used"]["rainfall"] >= 200  # borewell water counted
