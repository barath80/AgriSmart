"""Settings parse the way deployments actually pass them."""

import pytest

from app.core.config import Settings


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://admin.agrismart.in", ["https://admin.agrismart.in"]),  # docker-compose style
        ("http://a.in, http://b.in", ["http://a.in", "http://b.in"]),
        ('["http://c.in"]', ["http://c.in"]),
    ],
)
def test_cors_origins_from_environment(monkeypatch, raw, expected):
    monkeypatch.setenv("CORS_ORIGINS", raw)
    assert Settings().cors_origins == expected


async def test_database_saturation_is_a_503_with_retry_after(client, monkeypatch):
    from sqlalchemy.exc import DBAPIError

    from app.farmer import service as farmer_service

    class TooManyClients(Exception):
        def __str__(self) -> str:
            return "sorry, too many clients already"

    def saturated(*_args, **_kwargs):
        raise DBAPIError("SELECT 1", {}, TooManyClients())

    from tests.conftest import login_farmer

    headers, _ = await login_farmer(client)
    monkeypatch.setattr(farmer_service, "to_profile", saturated)
    response = await client.get("/api/v1/farmer/profile", headers=headers)
    assert response.status_code == 503
    assert response.headers["retry-after"] == "2"
    assert response.json()["error"]["code"] == "service_busy"


# --- SMS delivery (login codes) -----------------------------------------------------------


def _twilio(monkeypatch, handler):
    import httpx

    from app.core.config import get_settings

    monkeypatch.setenv("SMS_PROVIDER", "twilio")
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACtest")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "secret-token")
    monkeypatch.setenv("TWILIO_PHONE_NUMBER", "+15005550006")
    get_settings.cache_clear()
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr("app.notification.channels.get_http_client", lambda: client)


async def test_twilio_sms_request_shape(monkeypatch):
    import httpx

    from app.notification.channels import TwilioSmsSender

    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"], seen["auth"] = str(request.url), request.headers["authorization"]
        seen["form"] = dict(item.split("=", 1) for item in request.content.decode().split("&"))
        return httpx.Response(201, json={"sid": "SM1"})

    _twilio(monkeypatch, handler)
    await TwilioSmsSender().send("+919876543210", "AgriSmart code: 123456")
    from app.core.config import get_settings

    get_settings.cache_clear()
    assert seen["url"].endswith("/Accounts/ACtest/Messages.json")
    assert seen["auth"].startswith("Basic ")
    assert seen["form"]["To"] == "%2B919876543210" and seen["form"]["From"] == "%2B15005550006"


async def test_login_code_failure_is_a_clear_503_not_a_500(client, monkeypatch):
    import httpx

    from app.core.config import get_settings
    from app.notification import channels

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"code": 21211, "message": "invalid number"})

    _twilio(monkeypatch, handler)
    monkeypatch.setattr("app.auth.service.get_sms_sender", channels.get_sms_sender)
    response = await client.post("/api/v1/auth/otp", json={"phone": "9876500123"})
    get_settings.cache_clear()
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "sms_unavailable"
    assert "21211" not in response.text and "secret-token" not in response.text


def test_production_needs_complete_twilio_settings_when_twilio_is_chosen(monkeypatch):
    import pytest

    from app.core.config import get_settings

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET", "x" * 48)
    get_settings.cache_clear()
    try:
        assert get_settings().sms_provider == "console"  # password-only deployment starts fine
        get_settings.cache_clear()
        monkeypatch.setenv("SMS_PROVIDER", "twilio")
        get_settings.cache_clear()
        with pytest.raises(RuntimeError, match="TWILIO_ACCOUNT_SID"):
            get_settings()
    finally:
        get_settings.cache_clear()


def test_supabase_transaction_pooler_disables_prepared_statements():
    from app.core.database import connect_args

    pooled = connect_args("postgresql+asyncpg://u:p@aws-0-ap-south-1.pooler.supabase.com:6543/postgres")
    assert pooled["statement_cache_size"] == 0
    assert pooled["prepared_statement_name_func"]() != pooled["prepared_statement_name_func"]()
    assert connect_args("postgresql+asyncpg://u:p@aws-0-ap-south-1.pooler.supabase.com:5432/postgres") == {}
    assert connect_args("sqlite+aiosqlite:///:memory:") == {}


def test_production_starts_without_sms_and_offers_only_password_sign_in(monkeypatch):
    from app.auth.service import login_methods
    from app.core.config import get_settings

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET", "x" * 40)
    monkeypatch.setenv("SMS_PROVIDER", "console")
    monkeypatch.setenv("DEMO_LOGIN", "false")
    get_settings.cache_clear()
    try:
        assert login_methods() == {"phone": False, "email": False, "password": True}
        monkeypatch.setenv("DEMO_LOGIN", "true")
        get_settings.cache_clear()
        assert get_settings().demo_login is True
    finally:
        get_settings.cache_clear()


async def test_web_app_is_served_from_the_api_with_spa_fallback(tmp_path):
    import importlib

    import httpx

    (tmp_path / "index.html").write_text("<html>app</html>")
    (tmp_path / "x.js").write_text("console.log(1)")
    import os

    os.environ["WEB_DIR"] = str(tmp_path)
    from app.core.config import get_settings

    get_settings.cache_clear()
    import app.main as main

    main = importlib.reload(main)
    try:
        transport = httpx.ASGITransport(app=main.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://t") as client:
            assert "app" in (await client.get("/")).text
            assert (await client.get("/x.js")).text.startswith("console")
            assert "app" in (await client.get("/support")).text  # deep link -> index.html
            assert (await client.get("/health")).json() == {"status": "ok"}  # API wins
    finally:
        del os.environ["WEB_DIR"]
        get_settings.cache_clear()
        importlib.reload(main)
