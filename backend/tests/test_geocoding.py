"""Typed-in places get coordinates so weather works without GPS."""

import httpx

from app.farmer.geocoding import geocode
from tests.conftest import login_farmer

API = "/api/v1"

THANJAVUR = [
    {"name": "Thanjavur Air Force Station", "admin1": "Tamil Nadu", "admin2": "Thanjavur",
     "latitude": 10.72, "longitude": 79.10, "feature_code": "AIRP"},
    {"name": "Thanjavur", "admin1": "Tamil Nadu", "admin2": "Thanjavur",
     "latitude": 10.79, "longitude": 79.14, "feature_code": "PPL"},
]


def _geocoder(monkeypatch, results_by_name: dict[str, list[dict]], fail: bool = False):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["countryCode"] == "IN"
        if fail:
            return httpx.Response(503)
        return httpx.Response(200, json={"results": results_by_name.get(request.url.params["name"], [])})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr("app.farmer.geocoding.get_http_client", lambda: client)


async def test_prefers_village_then_town_in_the_right_state(monkeypatch):
    _geocoder(monkeypatch, {"Thanjavur": THANJAVUR, "Unknownpur": []})
    assert await geocode("Tamil Nadu", "Thanjavur", "Unknownpur") == (10.79, 79.14)
    # Same name in another state is never used.
    assert await geocode("Kerala", "Thanjavur") is None


async def test_geocoding_failure_is_not_fatal(monkeypatch):
    _geocoder(monkeypatch, {}, fail=True)
    assert await geocode("Tamil Nadu", "Thanjavur") is None


async def test_profile_without_gps_still_gets_weather(client):
    headers, _ = await login_farmer(client)
    saved = await client.put(f"{API}/farmer/profile", headers=headers, json={
        "name": "Savita", "location": {"state": "Maharashtra", "district": "Pune"},
    })
    assert saved.status_code == 200, saved.text
    assert saved.json()["location"]["latitude"] == 18.52
    assert (await client.get(f"{API}/weather", headers=headers)).status_code == 200
