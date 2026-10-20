"""Live scheme sync from myScheme: parsing, upsert, retirement and announcements."""

import json

import httpx
import pytest
from sqlalchemy import select

from app.core.database import SessionFactory
from app.schemes.models import GovernmentScheme, SchemeRule
from app.schemes.providers import MySchemeProvider

API = "/api/v1"

CATALOGUE = {
    "pm-kisan": {
        "schemeName": "Pradhan Mantri Kisan Samman Nidhi",
        "briefDescription": "Income support of ₹6,000 a year to landholding farmer families.",
        "beneficiaryState": ["All"],
    },
    "nmsa-rainfed": {
        "schemeName": "Rainfed Area Development",
        "briefDescription": "Integrated farming support for rainfed areas under NMSA.",
        "beneficiaryState": ["All"],
    },
    "tn-free-power": {
        "schemeName": "Free Electricity For Farmers",
        "briefDescription": "Free power supply for agricultural pump sets in Tamil Nadu.",
        "beneficiaryState": ["Tamil Nadu"],
    },
}


def myscheme(catalogue: dict, broken_details: frozenset[str] = frozenset()):
    seen_keys: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_keys.append(request.headers.get("x-api-key", ""))
        if request.url.path == "/search/v4/schemes":
            start, size = int(request.url.params["from"]), int(request.url.params["size"])
            assert json.loads(request.url.params["q"])[0]["identifier"] == "schemeCategory"
            slugs = list(catalogue)[start : start + size]
            items = [{"id": s, "fields": {"slug": s, **catalogue[s]}} for s in slugs]
            return httpx.Response(
                200, json={"data": {"hits": {"items": items, "page": {"total": len(catalogue)}}}}
            )
        slug = request.url.params["slug"]
        if slug in broken_details:
            return httpx.Response(500)
        return httpx.Response(200, json={"data": {"en": {
            "schemeContent": {"benefits_md": "**₹2,000** in each of [three instalments](https://x)."},
            "eligibilityCriteria": {"eligibilityDescription_md": "- Must own cultivable land"},
            "applicationProcess": [{"mode": "Online", "process_md": "Apply on the PM-KISAN portal."}],
        }}})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return client, seen_keys


@pytest.fixture
def live(monkeypatch):
    catalogue = dict(CATALOGUE)
    state = {"broken": frozenset()}

    def provider() -> MySchemeProvider:
        client, _ = myscheme(catalogue, state["broken"])
        monkeypatch.setattr("app.schemes.providers.get_http_client", lambda: client)
        return MySchemeProvider("https://api.myscheme.test", "key", ["Agriculture,Rural & Environment"])

    monkeypatch.setattr("app.schemes.sync.configured_provider", provider)
    MySchemeProvider._PAGE_SIZE = 1  # exercise pagination
    yield catalogue, state, provider
    MySchemeProvider._PAGE_SIZE = 100


async def test_provider_normalises_official_records(monkeypatch):
    client, keys = myscheme(CATALOGUE, broken_details=frozenset({"tn-free-power"}))
    monkeypatch.setattr("app.schemes.providers.get_http_client", lambda: client)
    schemes = {
        s.code: s
        for s in await MySchemeProvider("https://api.myscheme.test", "secret", ["Agri"]).fetch()
    }
    assert set(keys) == {"secret"}
    kisan = schemes["ms_pm_kisan"]
    assert kisan.state is None and kisan.source == "myscheme"
    assert kisan.benefits == "₹2,000 in each of three instalments."  # markdown flattened
    assert kisan.eligibility_text == "• Must own cultivable land"
    assert str(kisan.official_url) == "https://www.myscheme.gov.in/schemes/pm-kisan"
    # A failed detail call keeps the scheme with the official summary and a pointer.
    power = schemes["ms_tn_free_power"]
    assert power.state == "Tamil Nadu" and power.benefits.startswith("See the official")


async def test_sync_keeps_admin_rules_retires_missing_and_announces_new(
    client, live, onboarded_farmer
):
    from app.worker import _sync_schemes

    catalogue, _, _ = live
    await _sync_schemes()  # first import: backfill, no announcements
    async with SessionFactory() as session:
        power = await session.scalar(
            select(GovernmentScheme).where(GovernmentScheme.code == "ms_tn_free_power")
        )
        power.rules = [SchemeRule(rule_type="states_any", value={"value": ["Tamil Nadu"]})]
        await session.commit()
    inbox = (await client.get(f"{API}/notifications", headers=onboarded_farmer)).json()
    assert not any(i["title"] == "New government scheme" for i in inbox["items"])

    del catalogue["nmsa-rainfed"]
    catalogue["tn-drip-subsidy"] = {
        "schemeName": "Micro Irrigation Subsidy",
        "briefDescription": "Subsidy for drip and sprinkler systems for Tamil Nadu farmers.",
        "beneficiaryState": ["Tamil Nadu"],
    }
    await _sync_schemes()

    async with SessionFactory() as session:
        rows = {
            s.code: s
            for s in await session.scalars(
                select(GovernmentScheme).where(GovernmentScheme.source == "myscheme")
            )
        }
    assert "ms_pm_kisan" not in rows  # the curated PM-KISAN record wins over the copy
    assert rows["ms_nmsa_rainfed"].is_active is False  # retired, never deleted
    assert [r.rule_type for r in rows["ms_tn_free_power"].rules] == ["states_any"]
    assert rows["ms_tn_drip_subsidy"].is_active

    inbox = (await client.get(f"{API}/notifications", headers=onboarded_farmer)).json()
    news = [i for i in inbox["items"] if i["title"] == "New government scheme"]
    assert len(news) == 1 and "Micro Irrigation Subsidy" in news[0]["body"]

    schemes = (await client.get(f"{API}/schemes", headers=onboarded_farmer)).json()
    names = json.dumps(schemes)
    assert "Micro Irrigation Subsidy" in names and "Rainfed Area Development" not in names
    assert names.count("Pradhan Mantri Kisan Samman Nidhi") == 1


async def test_admin_sync_now(client, admin, live, monkeypatch):
    response = await client.post(f"{API}/admin/schemes/sync", headers=admin)
    assert response.status_code == 200, response.text
    assert response.json()["source"] == "myscheme" and response.json()["synced"] >= 2

    monkeypatch.setattr("app.schemes.sync.configured_provider", lambda: None)
    disabled = await client.post(f"{API}/admin/schemes/sync", headers=admin)
    assert disabled.status_code == 503
    assert disabled.json()["error"]["code"] == "schemes_sync_disabled"


async def test_reseeding_updates_verified_schemes():
    from app.schemes.providers import VerifiedFileProvider
    from app.schemes.service import sync_from_provider

    async with SessionFactory() as session:
        assert await sync_from_provider(session, VerifiedFileProvider()) == 8
