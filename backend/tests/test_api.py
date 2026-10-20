"""End-to-end API behaviour through the real app, database and (tiny) models."""

import uuid
from datetime import date

import pytest

from tests.conftest import (
    MODEL_DIR,
    FakeWeather,
    build_crop_model,
    build_image_model,
    login_farmer,
    solid_jpeg,
)

API = "/api/v1"


# --- Health & auth ------------------------------------------------------------------------

async def test_health_and_ready(client):
    assert (await client.get("/health")).json() == {"status": "ok"}
    ready = await client.get("/ready")
    assert ready.status_code == 200 and ready.json()["database"] == "up"
    assert "x-request-id" in ready.headers


async def test_otp_login_creates_account_and_wrong_code_is_rejected(client):
    phone = "9123456780"
    assert (await client.post(f"{API}/auth/otp", json={"phone": phone})).status_code == 200
    bad = await client.post(f"{API}/auth/login", json={"phone": phone, "otp": "000000"})
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] in {"otp_invalid", "otp_expired"}


async def test_new_user_flag_and_profile(client):
    headers, phone = await login_farmer(client, language="ta")
    profile = (await client.get(f"{API}/farmer/profile", headers=headers)).json()
    assert profile["phone"] == f"+91{phone}"
    assert profile["preferred_language"] == "ta"
    assert profile["profile_complete"] is False


async def test_refresh_rotates_and_old_token_is_revoked(client):
    phone = "9234567801"
    await client.post(f"{API}/auth/otp", json={"phone": phone})
    from tests.conftest import sms

    code = sms.sent[-1][1].split(": ")[1][:6]
    tokens = (await client.post(f"{API}/auth/login", json={"phone": phone, "otp": code})).json()
    rotated = await client.post(f"{API}/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert rotated.status_code == 200
    replay = await client.post(f"{API}/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert replay.status_code == 401


async def test_invalid_phone_is_a_validation_error(client):
    response = await client.post(f"{API}/auth/otp", json={"phone": "12345"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_input"


async def test_otp_requests_are_limited_per_phone(client):
    phone = "9345678012"
    statuses = [(await client.post(f"{API}/auth/otp", json={"phone": phone})).status_code for _ in range(6)]
    assert statuses[:5] == [200] * 5 and statuses[5] == 429


# --- Authorization ------------------------------------------------------------------------

async def test_requests_without_token_are_rejected(client):
    assert (await client.get(f"{API}/farmer/profile")).status_code == 401


async def test_farmer_cannot_use_admin_api(client, farmer):
    assert (await client.get(f"{API}/admin/farmers", headers=farmer)).status_code == 403


async def test_admin_token_cannot_use_farmer_api(client, admin):
    assert (await client.get(f"{API}/farmer/profile", headers=admin)).status_code == 403


async def test_farmer_cannot_read_another_farmers_farm(client, onboarded_farmer, farmer):
    farm_id = onboarded_farmer["X-Farm-Id"]
    response = await client.get(f"{API}/farms/{farm_id}/soil", headers=farmer)
    assert response.status_code == 404


async def test_tampered_token_is_rejected(client, farmer):
    token = farmer["Authorization"][:-2] + "xx"
    assert (await client.get(f"{API}/farmer/profile", headers={"Authorization": token})).status_code == 401


async def test_sql_injection_in_search_is_inert(client, admin):
    response = await client.get(f"{API}/admin/farmers", headers=admin, params={"search": "' OR 1=1; DROP TABLE farmers;--"})
    assert response.status_code == 200 and response.json()["total"] == 0
    assert (await client.get(f"{API}/admin/farmers", headers=admin)).status_code == 200


# --- Farm, calendar, weather --------------------------------------------------------------

async def test_crop_cycle_generates_calendar_and_weather_alerts(client, onboarded_farmer):
    farm_id = onboarded_farmer["X-Farm-Id"]
    cycle = await client.post(f"{API}/farms/{farm_id}/cycles", headers=onboarded_farmer, json={
        "crop_slug": "rice", "season": "kharif", "sowing_date": date.today().isoformat(), "area_acres": 2.5,
    })
    assert cycle.status_code == 201, cycle.text
    calendar = (await client.get(f"{API}/calendar", headers=onboarded_farmer)).json()
    types = {e["event_type"] for e in calendar["events"]}
    assert {"sowing", "fertilizer", "irrigation"} <= types
    # Basal fertilizer is due today and the fake forecast has heavy rain tomorrow.
    assert "delay_fertilizer" in {a["code"] for a in calendar["weather_alerts"]}


async def test_weather_is_cached_between_requests(client, onboarded_farmer):
    FakeWeather.calls = 0
    for _ in range(3):
        response = await client.get(f"{API}/weather", headers=onboarded_farmer, params={"lat": 11.11, "lon": 77.77})
        assert response.status_code == 200
    assert FakeWeather.calls == 1


async def test_weather_without_location_explains_why(client, farmer):
    response = await client.get(f"{API}/weather", headers=farmer)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "location_required"


# --- Models: crop recommendation, versioning, rollback ------------------------------------

async def test_crop_recommendation_needs_a_registered_model(client, onboarded_farmer, admin):
    response = await client.post(f"{API}/crop/recommend", headers=onboarded_farmer, json={})
    if response.status_code == 503:
        assert response.json()["error"]["code"] == "model_unavailable"

    build_crop_model("crop_v1")
    registered = await client.post(f"{API}/admin/models", headers=admin,
                                   json={"name": "crop", "version": "crop_v1", "activate": True})
    assert registered.status_code == 201, registered.text

    result = await client.post(f"{API}/crop/recommend", headers=onboarded_farmer, json={})
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["model_version"] == "crop_v1"
    assert body["recommended"]["crop"] == "rice"  # soil/climate of the onboarded farmer
    assert body["inputs_used"]["rainfall"] == 210.0  # filled from weather, reported back
    assert len(body["alternatives"]) >= 1


async def test_model_versions_are_immutable_and_rollback_works(client, admin):
    duplicate = await client.post(f"{API}/admin/models", headers=admin,
                                  json={"name": "crop", "version": "crop_v1"})
    assert duplicate.status_code == 409

    build_crop_model("crop_v2")
    await client.post(f"{API}/admin/models", headers=admin, json={"name": "crop", "version": "crop_v2", "activate": True})
    models = {(m["name"], m["version"]): m for m in (await client.get(f"{API}/admin/models", headers=admin)).json()}
    assert models[("crop", "crop_v2")]["is_active"] and not models[("crop", "crop_v1")]["is_active"]

    rollback = await client.post(f"{API}/admin/models/crop/crop_v1/activate", headers=admin)
    assert rollback.status_code == 204


async def test_path_traversal_in_model_version_is_rejected(client, admin):
    response = await client.post(f"{API}/admin/models", headers=admin,
                                 json={"name": "crop", "version": "../../etc"})
    assert response.status_code == 422


# --- Disease diagnosis --------------------------------------------------------------------

@pytest.fixture(scope="module")
async def disease_model(client, admin):
    build_image_model("disease", ["tomato.healthy", "tomato.late_blight"], "disease_v1")
    response = await client.post(f"{API}/admin/models", headers=admin,
                                 json={"name": "disease", "version": "disease_v1", "activate": True})
    assert response.status_code == 201, response.text


async def test_disease_prediction_returns_knowledge_not_model_text(client, farmer, disease_model):
    response = await client.post(f"{API}/disease/predict", headers=farmer,
                                 files={"image": ("leaf.jpg", solid_jpeg((200, 30, 30)), "image/jpeg")})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["label"] == "tomato.late_blight" and body["accepted"]
    keys = {s["key"] for s in body["sections"]}
    assert {"cause", "symptoms", "treatment", "prevention", "safety_warnings"} <= keys
    assert body["expert_verified"] is False
    assert "awaiting expert review" in body["summary"]


async def test_disease_prediction_is_idempotent(client, farmer, disease_model):
    key = uuid.uuid4().hex
    files = {"image": ("leaf.jpg", solid_jpeg((20, 200, 20)), "image/jpeg")}
    first = await client.post(f"{API}/disease/predict", headers=farmer | {"Idempotency-Key": key}, files=files)
    second = await client.post(f"{API}/disease/predict", headers=farmer | {"Idempotency-Key": key},
                               files={"image": ("other.jpg", solid_jpeg((200, 30, 30)), "image/jpeg")})
    assert first.json()["label"] == second.json()["label"] == "tomato.healthy"
    assert first.json()["request_id"] == second.json()["request_id"] == key


async def test_blurry_or_featureless_photo_asks_for_a_retake(client, farmer, disease_model):
    flat = solid_jpeg((20, 200, 20), textured=False)
    response = await client.post(
        f"{API}/disease/predict", headers=farmer,
        files={"image": ("leaf.jpg", flat, "image/jpeg")})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "image_unclear"


async def test_non_image_upload_is_rejected(client, farmer, disease_model):
    fake = b"<?php system($_GET['c']); ?>"
    response = await client.post(f"{API}/disease/predict", headers=farmer,
                                 files={"image": ("leaf.jpg", fake, "image/jpeg")})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_image"


async def test_wrong_content_type_and_oversized_upload_are_rejected(client, farmer, disease_model):
    as_pdf = await client.post(f"{API}/disease/predict", headers=farmer,
                               files={"image": ("x.pdf", b"%PDF-1.4", "application/pdf")})
    assert as_pdf.json()["error"]["code"] == "unsupported_media_type"
    huge = await client.post(f"{API}/disease/predict", headers=farmer,
                             files={"image": ("big.jpg", b"\xff" * (7 * 1024 * 1024), "image/jpeg")})
    assert huge.json()["error"]["code"] == "file_too_large"



async def test_upload_without_a_specific_type_uses_the_file_extension(client, farmer, disease_model):
    # Some phone uploaders send application/octet-stream; the extension says what it is.
    photo = await client.post(f"{API}/disease/predict", headers=farmer,
                              files={"image": ("photo.jpg", solid_jpeg((200, 30, 30)), "application/octet-stream")})
    assert photo.status_code == 200, photo.text
    disguised = await client.post(f"{API}/disease/predict", headers=farmer,
                                  files={"image": ("x.pdf", b"%PDF-1.4", "application/octet-stream")})
    assert disguised.json()["error"]["code"] == "unsupported_media_type"

# --- AgriBrain ------------------------------------------------------------------------------

async def ask(client, headers, text, language=None):
    payload = {"text": text} | ({"language": language} if language else {})
    response = await client.post(f"{API}/assistant/query", headers=headers, json=payload)
    assert response.status_code == 200, response.text
    return response.json()


async def test_assistant_weather_in_tamil(client, onboarded_farmer):
    reply = await ask(client, onboarded_farmer, "இன்று வானிலை எப்படி?", "ta")
    assert reply["intent"] == "weather" and reply["handled_by"] == "tool"
    assert "28°C" in reply["text"] and "Thanjavur" in reply["text"]
    assert reply["data"]["card"] == "weather"


class ScriptedLLM:
    """A language model that answers with a fixed reply and records what it was asked."""

    name = "scripted"

    def __init__(self, reply: str | None) -> None:
        self.reply = reply
        self.asked: list[dict] = []

    async def complete(self, system, messages, max_tokens=800, json_mode=False):
        self.asked.append({"system": system, "messages": messages, "json_mode": json_mode})
        if self.reply is None:
            from app.core.errors import ServiceUnavailable

            raise ServiceUnavailable("down", code="llm_unavailable")
        return self.reply


async def test_two_questions_in_one_message_get_one_combined_answer(client, onboarded_farmer, monkeypatch):
    llm = ScriptedLLM("AgriSmart is a free farming assistant. In Thanjavur it is 28°C now.")
    monkeypatch.setattr("app.assistant.brain.get_llm", lambda: llm)
    reply = await ask(client, onboarded_farmer, "explain me the AgriSmart and explain me the today's weather")
    assert reply["intent"] == "weather" and reply["handled_by"] == "llm"
    assert reply["data"]["card"] == "weather"  # the weather card still shows
    system = llm.asked[0]["system"]
    assert "28°C" in system and "live answers" in system  # the model got the real weather


async def test_two_questions_without_a_model_are_answered_one_after_the_other(client, onboarded_farmer):
    reply = await ask(client, onboarded_farmer, "how do I use this app and how is the weather today")
    assert reply["intent"] == "weather"
    assert "28°C" in reply["text"] and "You can ask me" in reply["text"]


async def test_questions_about_my_farm_are_answered_from_my_records(client, onboarded_farmer, monkeypatch):
    llm = ScriptedLLM('{"intent": "general", "answer": "Your soil pH is 6.5."}')
    monkeypatch.setattr("app.assistant.brain.get_llm", lambda: llm)
    reply = await ask(client, onboarded_farmer, "what was the ph of my soil")
    assert reply["handled_by"] == "llm" and "6.5" in reply["text"]
    records = llm.asked[0]["system"]
    assert "pH 6.5" in records and "East field: 2.5 acres" in records and "Thanjavur" in records


async def test_assistant_explains_the_app_with_one_model_call(client, onboarded_farmer, monkeypatch):
    llm = ScriptedLLM('{"intent": "general", "answer": "அக்ரிஸ்மார்ட் ஒரு இலவச விவசாய உதவியாளர்."}')
    monkeypatch.setattr("app.assistant.brain.get_llm", lambda: llm)
    reply = await ask(client, onboarded_farmer, "how do I use this app?", "ta")
    assert reply["handled_by"] == "llm" and reply["text"].startswith("அக்ரிஸ்மார்ட்")
    assert len(llm.asked) == 1 and llm.asked[0]["json_mode"]
    assert "AgriSmart guide" in llm.asked[0]["system"] and "தமிழ்" in llm.asked[0]["system"]


async def test_assistant_model_routes_unmatched_requests_to_live_tools(client, onboarded_farmer, monkeypatch):
    llm = ScriptedLLM('{"intent": "weather", "tomorrow": false}')
    monkeypatch.setattr("app.assistant.brain.get_llm", lambda: llm)
    reply = await ask(client, onboarded_farmer, "should I carry an umbrella to the field")
    assert reply["intent"] == "weather" and reply["handled_by"] == "tool" and "28°C" in reply["text"]


async def test_assistant_help_without_a_model_uses_the_fixed_text(client, onboarded_farmer, monkeypatch):
    monkeypatch.setattr("app.assistant.brain.get_llm", lambda: ScriptedLLM(None))
    reply = await ask(client, onboarded_farmer, "help")
    assert reply["intent"] == "help" and reply["handled_by"] == "template"


async def test_assistant_asks_for_photo_on_app(client, onboarded_farmer):
    reply = await ask(client, onboarded_farmer, "My plant has a problem, leaves have spots")
    assert reply["intent"] == "disease_diagnosis"
    assert reply["action"] == {"type": "capture_image", "target": "disease"}


async def test_assistant_schemes_uses_rules(client, onboarded_farmer):
    reply = await ask(client, onboarded_farmer, "Which government schemes can I get?")
    assert reply["intent"] == "schemes"
    statuses = {s["scheme"]["code"]: s["status"] for s in reply["data"]["schemes"]}
    assert statuses["pm_kisan"] == "eligible"           # has 2.5 acres
    assert statuses["pm_kisan_maandhan"] == "eligible"  # born 1990, ≤ 4.94 acres


async def test_assistant_market_without_provider_degrades_honestly(client, onboarded_farmer):
    reply = await ask(client, onboarded_farmer, "onion price today")
    assert reply["intent"] == "market_price" and reply["handled_by"] == "fallback"


async def test_assistant_without_llm_says_what_it_can_do(client, farmer):
    reply = await ask(client, farmer, "tell me a joke")
    assert reply["intent"] == "general" and reply["handled_by"] == "fallback"


async def test_conversation_history_is_kept(client, farmer):
    first = await ask(client, farmer, "hello")
    history = await client.get(f"{API}/assistant/sessions/{first['session_id']}/messages", headers=farmer)
    assert [m["role"] for m in history.json()] == ["farmer", "assistant"]


async def test_phone_channel_never_asks_for_a_photo(onboarded_farmer, client):
    from app.assistant.brain import agribrain
    from app.core.database import SessionFactory
    from app.farmer.context import load_farmer_context
    from app.farmer.models import Channel, Farmer
    from sqlalchemy import select

    profile = (await client.get(f"{API}/farmer/profile", headers=onboarded_farmer)).json()
    async with SessionFactory() as session:
        farmer = await session.scalar(select(Farmer).where(Farmer.id == uuid.UUID(profile["id"])))
        ctx = await load_farmer_context(session, farmer, channel=Channel.PHONE)
        reply = await agribrain.handle(session, ctx, "my plant has a disease", None)
    assert reply.action is None
    assert "1800-180-1551" in reply.text


# --- Profit & schemes ---------------------------------------------------------------------

async def test_profit_endpoint(client, farmer):
    response = await client.post(f"{API}/profit/calculate", headers=farmer, json={
        "area_acres": 2, "expected_yield_q_per_acre": 20, "expected_price_per_quintal": 2000,
        "costs": {"seeds": 4000, "fertilizer": 6000, "labour": 10000},
    })
    body = response.json()
    assert body["profit"] == 60000 and body["break_even_price_per_quintal"] == 500
    assert len(body["scenarios"]) == 8


async def test_schemes_listing_is_localised_by_name(client):
    headers, _ = await login_farmer(client, language="hi")
    schemes = (await client.get(f"{API}/schemes", headers=headers)).json()
    pm_kisan = next(s for s in schemes if s["code"] == "pm_kisan")
    assert pm_kisan["name"].startswith("प्रधानमंत्री")
    assert pm_kisan["translated"] is False  # no translation provider in tests — said honestly


# --- Admin -------------------------------------------------------------------------------

async def test_admin_analytics_and_system(client, admin):
    analytics = await client.get(f"{API}/admin/analytics", headers=admin)
    assert analytics.status_code == 200, analytics.text
    assert analytics.json()["total_farmers"] > 0
    assert len(analytics.json()["daily"]) == 14
    system = (await client.get(f"{API}/admin/system", headers=admin)).json()
    assert system["models_active"]["crop"] in {"crop_v1", "crop_v2"}


async def test_admin_notification_is_targeted_and_idempotent(client, admin, onboarded_farmer):
    await client.put(f"{API}/farmer/profile", headers=onboarded_farmer, json={"preferred_language": "ta"})
    payload = {
        "idempotency_key": "test-heavy-rain-thanjavur",
        "category": "weather",
        "title": {"en": "Heavy rain", "ta": "கனமழை"},
        "body": {"en": "Heavy rain expected", "ta": "கனமழை எதிர்பார்க்கப்படுகிறது"},
        "target": {"states": ["Tamil Nadu"], "districts": ["Thanjavur"]},
    }
    first = await client.post(f"{API}/admin/notifications", headers=admin, json=payload)
    second = await client.post(f"{API}/admin/notifications", headers=admin, json=payload)
    assert first.status_code == second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["recipients"] >= 1

    from app.core.database import SessionFactory
    from app.notification.service import dispatch_pending
    from tests.conftest import sms

    before = len(sms.sent)
    async with SessionFactory() as session:
        sent = await dispatch_pending(session, 100)
    assert sent >= 1 and len(sms.sent) > before  # no push token → SMS fallback
    assert any("கனமழை" in text for _, text in sms.sent[before:])  # farmer's language


async def test_admin_can_create_and_verify_content(client, admin):
    scheme = {
        "code": "test_state_scheme", "name": "Test State Scheme", "state": "Tamil Nadu",
        "summary": "A test scheme for unit tests.", "benefits": "Rs 1000", "eligibility_text": "Everyone",
        "application_process": "Apply online", "official_url": "https://example.gov.in",
        "last_verified_on": date.today().isoformat(), "rules": [{"rule_type": "max_land_acres", "value": 5}],
    }
    created = await client.post(f"{API}/admin/schemes", headers=admin, json=scheme)
    assert created.status_code == 201, created.text
    bad_rule = scheme | {"code": "bad_rule_scheme", "rules": [{"rule_type": "astrology", "value": 1}]}
    assert (await client.post(f"{API}/admin/schemes", headers=admin, json=bad_rule)).status_code == 422

    verified = await client.post(f"{API}/admin/knowledge/diseases/tomato.late_blight/verify",
                                 headers=admin, json={"verified_by": "Dr. A. Agronomist, KVK"})
    assert verified.json()["verified_by"] == "Dr. A. Agronomist, KVK"


def test_model_dir_is_isolated():
    assert "agrismart-test" in str(MODEL_DIR)


# --- Market --------------------------------------------------------------------------------

class FakeMandi:
    name = "fake_mandi"
    calls = 0

    async def fetch(self, *, commodity, state):
        from app.market.providers import PriceObservation

        FakeMandi.calls += 1
        today = date.today()
        return [
            PriceObservation(state="Tamil Nadu", district=district, market=market, commodity=commodity,
                             variety="Local", grade="FAQ", arrival_date=today,
                             min_price=low, max_price=high, modal_price=modal)
            for district, market, low, high, modal in [
                ("Thanjavur", "Kumbakonam", 1800, 2400, 2100),
                ("Madurai", "Madurai", 1900, 2600, 2300),
            ]
        ]


async def test_market_prices_are_persisted_cached_and_ranked(client, onboarded_farmer, monkeypatch):
    monkeypatch.setattr("app.market.service.get_market_provider", lambda: FakeMandi())
    FakeMandi.calls = 0
    first = await client.get(f"{API}/market/prices", headers=onboarded_farmer, params={"commodity": "Tomato"})
    second = await client.get(f"{API}/market/prices", headers=onboarded_farmer, params={"commodity": "Tomato"})
    assert first.status_code == 200, first.text
    assert FakeMandi.calls == 1  # second request served from PostgreSQL, not the API
    prices = second.json()["prices"]
    assert [p["kind"] for p in prices] == ["observed", "observed"]
    assert prices[0]["district"] == "Thanjavur"  # farmer's own district first

    history = await client.get(f"{API}/market/history", headers=onboarded_farmer, params={"commodity": "Tomato"})
    point = history.json()["points"][-1]
    assert point["kind"] == "historical" and point["markets"] == 2 and point["avg_modal_price"] == 2200

    reply = await ask(client, onboarded_farmer, "tomato price")
    assert reply["intent"] == "market_price" and "Kumbakonam" in reply["text"] and "2,100" in reply["text"]


# --- Market prices without an API key (CSV import) -----------------------------------------

DATA_GOV_CSV = (
    "State,District,Market,Commodity,Variety,Grade,Arrival_Date,Min_x0020_Price,Max_x0020_Price,Modal_x0020_Price\n"
    "Karnataka,Kolar,Kolar,Onion,Bellary,FAQ,{d},1200,1800,1500\n"
    "Karnataka,Kolar,Mulbagal,Onion,Local,FAQ,{d},1100,1700,1450\n"
    "Karnataka,Kolar,Broken,Onion,Local,FAQ,not-a-date,1,2,3\n"
)
AGMARKNET_CSV = (
    "Onion prices report\n\n"
    "Sl no.,District Name,Market Name,Commodity,Variety,Grade,Min Price (Rs./Quintal),"
    "Max Price (Rs./Quintal),Modal Price (Rs./Quintal),Price Date\n"
    "1,Nashik,Lasalgaon,Onion,Red,FAQ,\"1,400\",\"2,100\",\"1,800\",{d}\n"
)


def test_importer_understands_both_file_styles():
    from app.market.importer import parse_csv

    today = date.today().strftime("%d/%m/%Y")
    ogd = parse_csv(DATA_GOV_CSV.format(d=today).encode())
    assert len(ogd.observations) == 2 and ogd.skipped_rows == [3]
    assert ogd.observations[0].state == "Karnataka" and ogd.observations[0].modal_price == 1500

    agmark = parse_csv(AGMARKNET_CSV.format(d=date.today().strftime("%d-%b-%Y")).encode(), default_state="maharashtra")
    only = agmark.observations[0]
    assert (only.state, only.market, only.modal_price) == ("Maharashtra", "Lasalgaon", 1800)

    with pytest.raises(ValueError, match="State"):
        parse_csv(AGMARKNET_CSV.format(d="01-Oct-2026").encode())


async def test_admin_imports_prices_and_farmers_see_them_without_api_key(client, admin, monkeypatch):
    from app.market.providers import ImportedPricesProvider

    monkeypatch.setattr("app.market.service.get_market_provider", lambda: ImportedPricesProvider())
    csv_bytes = DATA_GOV_CSV.format(d=date.today().strftime("%d/%m/%Y")).encode()
    imported = await client.post(f"{API}/admin/markets/import", headers=admin,
                                 files={"file": ("prices.csv", csv_bytes, "text/csv")})
    assert imported.status_code == 201, imported.text
    assert imported.json() == {"imported": 2, "skipped_rows": [3]}
    again = await client.post(f"{API}/admin/markets/import", headers=admin,
                              files={"file": ("prices.csv", csv_bytes, "text/csv")})
    assert again.status_code == 201  # re-importing the same file creates no duplicates

    headers, _ = await login_farmer(client)
    await client.put(f"{API}/farmer/profile", headers=headers, json={
        "name": "Ravi", "location": {"state": "Karnataka", "district": "Kolar"}})
    prices = (await client.get(f"{API}/market/prices", headers=headers, params={"commodity": "Onion"})).json()
    assert [p["market"] for p in prices["prices"]] == ["Kolar", "Mulbagal"]
    assert prices["stale"] is False

    bad = await client.post(f"{API}/admin/markets/import", headers=admin,
                            files={"file": ("x.csv", b"just,some,columns\n1,2,3\n", "text/csv")})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "invalid_price_file"


async def test_subject_gate_marks_photos_that_are_not_a_leaf_as_uncertain(client, farmer, admin, disease_model):
    build_image_model("subject", ["other", "subject"], "subject_v1")  # red → subject, green → other
    response = await client.post(f"{API}/admin/models", headers=admin,
                                 json={"name": "subject", "version": "subject_v1", "activate": True})
    assert response.status_code == 201, response.text
    from app.ml.registry import ModelName, registry
    registry.invalidate(ModelName.SUBJECT)

    leaf = await client.post(f"{API}/disease/predict", headers=farmer,
                             files={"image": ("leaf.jpg", solid_jpeg((200, 30, 30)), "image/jpeg")})
    assert leaf.status_code == 200 and leaf.json()["accepted"]
    other = await client.post(f"{API}/disease/predict", headers=farmer,
                              files={"image": ("wall.jpg", solid_jpeg((30, 200, 30)), "image/jpeg")})
    assert other.status_code == 200, other.text
    assert not other.json()["accepted"]


# --- Help desk: farmer <-> admin ------------------------------------------------------------


async def test_farmer_and_admin_can_talk_and_admin_sees_the_farmers_activity(client, farmer, admin):
    sent = await client.post(f"{API}/support", headers=farmer, json={"body": "My tomato leaves curl"})
    assert sent.status_code == 201, sent.text
    me = (await client.get(f"{API}/farmer/profile", headers=farmer)).json()

    threads = (await client.get(f"{API}/admin/support/threads", headers=admin)).json()
    row = next(t for t in threads["items"] if t["farmer_id"] == me["id"])
    assert row["awaiting_reply"] and "tomato" in row["last_message"] and threads["awaiting"] >= 1

    detail = await client.get(f"{API}/admin/support/threads/{me['id']}", headers=admin)
    assert detail.status_code == 200 and detail.json()["messages"][-1]["sender"] == "farmer"

    replied = await client.post(f"{API}/admin/support/threads/{me['id']}/reply", headers=admin,
                                json={"body": "Please send a photo in the Plant Doctor."})
    assert replied.status_code == 201, replied.text
    row = next(t for t in (await client.get(f"{API}/admin/support/threads", headers=admin)).json()["items"]
               if t["farmer_id"] == me["id"])
    assert not row["awaiting_reply"]

    assert (await client.get(f"{API}/support/unread", headers=farmer)).json() == {"unread": 1}
    thread = (await client.get(f"{API}/support", headers=farmer)).json()
    assert [m["sender"] for m in thread["messages"]][-2:] == ["farmer", "admin"] and thread["unread"] == 1
    assert (await client.post(f"{API}/support/read", headers=farmer)).status_code == 204
    assert (await client.get(f"{API}/support/unread", headers=farmer)).json() == {"unread": 0}

    activity = await client.get(f"{API}/admin/farmers/{me['id']}/activity", headers=admin)
    assert activity.status_code == 200, activity.text
    body = activity.json()
    assert body["farmer"]["id"] == me["id"] and isinstance(body["queries"], list)


async def test_support_is_private_to_each_side(client, farmer, admin):
    assert (await client.get(f"{API}/admin/support/threads", headers=farmer)).status_code == 403
    assert (await client.post(f"{API}/support", headers=admin, json={"body": "hi"})).status_code == 403
    assert (await client.post(f"{API}/support", headers=farmer, json={"body": ""})).status_code == 422


# --- E-mail sign-in --------------------------------------------------------------------------


async def test_farmer_can_sign_in_with_an_emailed_code_and_phone_login_still_works(client, admin, monkeypatch):
    import re

    from app.auth import service as auth_service

    mailbox: list[tuple[str, str]] = []

    class Mailer:
        async def send(self, to, subject, text):
            mailbox.append((to, text))

    monkeypatch.setattr(auth_service, "get_email_sender", lambda: Mailer())

    def last_code(address: str) -> str:
        text = next(t for to, t in reversed(mailbox) if to == address)
        match = re.search(r'[0-9]{6}', text)
        assert match, (text, mailbox)
        return match.group(0)

    methods = (await client.get(f"{API}/auth/methods")).json()
    assert methods == {"phone": True, "email": True, "password": True}  # development: both are offered

    asked = await client.post(f"{API}/auth/otp", json={"email": "Farmer.One@Example.com"})
    assert asked.status_code == 200, asked.text
    code = last_code("farmer.one@example.com")  # addresses are stored lower-case
    bad = await client.post(f"{API}/auth/login", json={"email": "farmer.one@example.com", "otp": "000000"})
    assert bad.status_code == 401
    ok = await client.post(f"{API}/auth/login", json={"email": "FARMER.ONE@example.com", "otp": code, "language": "hi"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["is_new_user"] is True
    headers = {"Authorization": f"Bearer {ok.json()['access_token']}"}
    profile = (await client.get(f"{API}/farmer/profile", headers=headers)).json()
    assert profile["phone"] == "" and profile["preferred_language"] == "hi"

    # The same address signs in to the same account next time.
    await client.post(f"{API}/auth/otp", json={"email": "farmer.one@example.com"})
    again = last_code("farmer.one@example.com")
    second = await client.post(f"{API}/auth/login", json={"email": "farmer.one@example.com", "otp": again})
    assert second.json()["is_new_user"] is False

    # The admin can find and message the e-mail farmer; the address stands in for the number.
    await client.post(f"{API}/support", headers=headers, json={"body": "hello team"})
    threads = (await client.get(f"{API}/admin/support/threads", headers=admin)).json()["items"]
    assert any(t["phone"] == "farmer.one@example.com" for t in threads)


async def test_sign_in_needs_exactly_one_of_phone_or_email(client):
    neither = await client.post(f"{API}/auth/otp", json={})
    both = await client.post(f"{API}/auth/otp", json={"phone": "9876543210", "email": "a@b.co"})
    assert neither.status_code == 422 and both.status_code == 422
    assert (await client.post(f"{API}/auth/otp", json={"email": "not-an-email"})).status_code == 422


async def test_email_only_deployment_switches_phone_login_off(client, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET", "x" * 40)
    monkeypatch.setenv("SMS_PROVIDER", "console")
    monkeypatch.setenv("EMAIL_PROVIDER", "smtp")
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_USER", "u")
    monkeypatch.setenv("SMTP_PASSWORD", "p")
    monkeypatch.setenv("SMTP_FROM", "AgriSmart <noreply@example.com>")
    monkeypatch.setenv("DEMO_LOGIN", "false")
    get_settings.cache_clear()
    try:
        assert get_settings().email_provider == "smtp"
        assert (await client.get(f"{API}/auth/methods")).json() == {"phone": False, "email": True, "password": True}
        refused = await client.post(f"{API}/auth/otp", json={"phone": "9876543210"})
        assert refused.status_code == 503 and refused.json()["error"]["code"] == "sms_unavailable"
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()
