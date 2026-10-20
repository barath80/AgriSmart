"""Automatic market-price and disease-outbreak alerts: targeted, deduplicated, localized."""

import uuid
from datetime import date, timedelta

from sqlalchemy import select

from app.core.database import SessionFactory
from app.disease.models import DiagnosisPrediction
from app.farmer.models import Farmer
from app.market.models import Market, MarketPrice
from app.notification.service import queue_disease_outbreak_alerts, queue_market_alerts
from tests.conftest import login_farmer

API = "/api/v1"


async def _grower(client, crop: str, *, state: str, district: str, language: str = "en") -> dict:
    headers, phone = await login_farmer(client, language)
    await client.put(f"{API}/farmer/profile", headers=headers, json={
        "name": "Grower", "location": {"state": state, "district": district, "latitude": 20.0, "longitude": 78.0},
    })
    farm = (await client.post(f"{API}/farms", headers=headers, json={
        "name": "Field", "area_acres": 2, "soil_type": "loamy", "irrigation": "canal",
    })).json()
    cycle = await client.post(f"{API}/farms/{farm['id']}/cycles", headers=headers, json={
        "crop_slug": crop, "season": "kharif", "sowing_date": date.today().isoformat(), "area_acres": 2,
    })
    assert cycle.status_code == 201, cycle.text
    headers["phone"] = phone
    return headers


async def _farmer_id(phone: str) -> uuid.UUID:
    async with SessionFactory() as session:
        return await session.scalar(select(Farmer.id).where(Farmer.phone.like(f"%{phone}")))


async def _titles(client, headers) -> list[dict]:
    auth = {"Authorization": headers["Authorization"]}
    return (await client.get(f"{API}/notifications", headers=auth)).json()["items"]


async def test_market_move_alerts_only_growers_in_that_state(client):
    grower = await _grower(client, "maize", state="Bihar", district="Purnia", language="hi")
    elsewhere = await _grower(client, "maize", state="Punjab", district="Ludhiana")
    today = date.today()
    async with SessionFactory() as session:
        market = Market(name="Gulabbagh", state="Bihar", district="Purnia")
        session.add(market)
        await session.flush()
        for day, price in [(today - timedelta(days=7), 2000.0), (today, 2300.0)]:
            session.add(MarketPrice(market_id=market.id, commodity="Maize", arrival_date=day,
                                    min_price=price - 100, max_price=price + 100, modal_price=price,
                                    source="csv_import"))
        await session.commit()

        assert await queue_market_alerts(session) >= 1
        assert await queue_market_alerts(session) == 0  # idempotent per crop, state and day

    alerts = [i for i in await _titles(client, grower) if i["category"] == "market"]
    assert len(alerts) == 1
    assert "15%" in alerts[0]["body"] and "2300" in alerts[0]["body"] and "मक्का" in alerts[0]["body"]
    assert not [i for i in await _titles(client, elsewhere) if i["category"] == "market"]


async def test_disease_outbreak_alerts_district_growers(client):
    reporters = [await _grower(client, "tomato", state="Karnataka", district="Kolar") for _ in range(3)]
    neighbour = await _grower(client, "tomato", state="Karnataka", district="Kolar", language="kn")
    other_crop = await _grower(client, "rice", state="Karnataka", district="Kolar")
    async with SessionFactory() as session:
        for headers in reporters:
            session.add(DiagnosisPrediction(
                request_id=uuid.uuid4().hex, farmer_id=await _farmer_id(headers["phone"]), kind="disease",
                model_version="disease_v1", predicted_label="tomato.late_blight", confidence=0.95,
                top_k=[], accepted=True, image_sha256="0" * 64, latency_ms=30.0,
            ))
        await session.commit()
        assert await queue_disease_outbreak_alerts(session) >= 1
        assert await queue_disease_outbreak_alerts(session) == 0  # once per district per week

    alerts = [i for i in await _titles(client, neighbour) if i["category"] == "disease"]
    assert len(alerts) == 1 and "Kolar" in alerts[0]["body"] and "3" in alerts[0]["body"]
    assert not [i for i in await _titles(client, other_crop) if i["category"] == "disease"]


async def test_two_farmers_are_not_an_outbreak(client):
    reporters = [await _grower(client, "potato", state="Punjab", district="Jalandhar") for _ in range(2)]
    async with SessionFactory() as session:
        for headers in reporters:
            session.add(DiagnosisPrediction(
                request_id=uuid.uuid4().hex, farmer_id=await _farmer_id(headers["phone"]), kind="disease",
                model_version="disease_v1", predicted_label="potato.late_blight", confidence=0.9,
                top_k=[], accepted=True, image_sha256="1" * 64, latency_ms=30.0,
            ))
        await session.commit()
        before = await queue_disease_outbreak_alerts(session)
    assert before == 0
