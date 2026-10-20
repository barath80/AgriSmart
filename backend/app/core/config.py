"""Application settings, loaded once from environment variables (and `.env` in development).

Every secret lives here and only here. Nothing in this module is ever sent to clients.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Runtime -------------------------------------------------------------------------
    environment: Literal["development", "test", "production"] = "development"
    api_prefix: str = "/api/v1"
    # Comma-separated in the environment: CORS_ORIGINS=https://admin.example.in,https://app.example.in
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )
    log_level: str = "INFO"

    # --- Database ------------------------------------------------------------------------
    database_url: str = "postgresql+asyncpg://agrismart:agrismart@localhost:5432/agrismart"
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout_seconds: float = Field(10, gt=0)  # fail fast instead of piling up
    db_echo: bool = False

    # --- Auth ----------------------------------------------------------------------------
    jwt_secret: SecretStr = SecretStr("change-me-in-production-please-32b")
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 30
    refresh_token_ttl_days: int = 30
    otp_ttl_seconds: int = 300
    otp_max_requests_per_hour: int = 5
    otp_max_attempts: int = 5
    bootstrap_admin_email: str | None = None
    bootstrap_admin_password: SecretStr | None = None

    # --- Abuse protection ----------------------------------------------------------------
    rate_limit_per_minute: int = 60
    assistant_rate_limit_per_minute: int = 20
    upload_max_bytes: int = 6 * 1024 * 1024
    audio_max_bytes: int = 4 * 1024 * 1024

    # --- Machine learning ----------------------------------------------------------------
    model_dir: Path = BACKEND_ROOT.parent / "ml" / "artifacts"
    ml_max_concurrency: int = 4
    ml_registry_refresh_seconds: int = 60
    image_min_confidence: float = 0.55

    # --- Weather (Open-Meteo needs no key) -----------------------------------------------
    weather_provider: Literal["open_meteo"] = "open_meteo"
    weather_cache_ttl_minutes: int = 30

    # --- Market --------------------------------------------------------------------------
    # "import": serve prices imported from free CSV downloads (no key needed).
    # "agmarknet": live from the official Agmarknet 2.0 daily reports (no key needed).
    # "data_gov_in": fetch live from the OGD API (needs DATA_GOV_IN_API_KEY).
    market_provider: Literal["import", "data_gov_in", "agmarknet", "none"] = "import"
    data_gov_in_api_key: SecretStr | None = None
    # Override only when api.data.gov.in is blocked on your network (see deploy/data-gov-relay).
    data_gov_in_base_url: str = "https://api.data.gov.in"
    market_cache_ttl_minutes: int = 180

    # --- Government schemes -------------------------------------------------------------
    # "verified_file": only the reviewed records in seeds/schemes.json.
    # "myscheme": also sync live from the official myScheme API (key issued via API Setu).
    scheme_provider: Literal["verified_file", "myscheme"] = "verified_file"
    myscheme_api_url: str = "https://api.myscheme.gov.in"
    myscheme_api_key: SecretStr | None = None
    myscheme_categories: list[str] = ["Agriculture,Rural & Environment"]
    scheme_sync_hours: int = Field(24, ge=1)

    # --- Voice / language ----------------------------------------------------------------
    voice_provider: Literal["sarvam", "bhashini", "gemini", "local", "none"] = "none"
    # Used whenever the main provider fails (for example Sarvam out of credits), so voice,
    # male/female speech and translation keep working. "gemini" reuses GEMINI_API_KEY.
    voice_fallback_provider: Literal["gemini", "none"] = "none"
    sarvam_api_key: SecretStr | None = None
    bhashini_user_id: str | None = None
    bhashini_api_key: SecretStr | None = None
    bhashini_pipeline_id: str = "64392f96daac500b55c543cd"
    local_asr_model: str = "small"

    # --- LLM (optional — only for open conversation, never for facts) --------------------
    llm_provider: Literal["none", "ollama", "gemini"] = "none"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    gemini_api_key: SecretStr | None = None
    # An alias, so a retired model version never breaks the assistant.
    gemini_model: str = "gemini-flash-latest"
    # Tried in order when a model is rate-limited (each model has its own free-tier quota).
    gemini_fallback_models: list[str] = ["gemini-flash-lite-latest"]
    # Speech recognition tries the fast lite model first: the full flash model can stall on
    # audio for 30 s or more, which would use up the whole interactive deadline.
    gemini_asr_models: list[str] = ["gemini-flash-lite-latest", "gemini-flash-latest"]
    gemini_tts_models: list[str] = [
        "gemini-3.8-flash-tts",
        "gemini-3.8-flash-lite-tts",
        "gemini-3.1-flash-tts-preview",
        "gemini-2.5-flash-preview-tts",
    ]

    # --- Telephony -----------------------------------------------------------------------
    public_base_url: str = "http://localhost:8000"
    twilio_auth_token: SecretStr | None = None
    twilio_account_sid: str | None = None
    twilio_phone_number: str | None = None  # E.164 caller ID for outbound alert calls
    max_concurrent_calls: int = 20
    max_call_seconds: int = 600

    # --- Notifications -------------------------------------------------------------------
    # "console" only logs messages. That is fine in production too: farmers sign in with a
    # password, which needs no SMS. Choose "twilio" only to send alerts by SMS and to offer
    # "forgot password" by code.
    sms_provider: Literal["console", "twilio"] = "console"
    # Login codes by e-mail: free through any SMTP service (Gmail app password, Brevo, ...).
    email_provider: Literal["console", "smtp"] = "console"
    smtp_host: str = ""
    smtp_port: int = 587  # 587 = STARTTLS, 465 = implicit TLS
    smtp_user: str = ""
    smtp_password: SecretStr = SecretStr("")
    smtp_from: str = ""
    # Free demo deployments have no SMS provider. With this on, the login code is returned in
    # the API response and shown in the app, so ANYONE can sign in as ANY phone number.
    # Never enable it with real farmers' data.
    demo_login: bool = False
    # Folder holding the exported farmer web app (`expo export --platform web`). When it exists
    # the API serves it at "/", so one free host carries both the API and the web app.
    web_dir: str = ""
    twilio_messaging_service_sid: str | None = None  # optional; else TWILIO_PHONE_NUMBER sends
    expo_push_url: str = "https://exp.host/--/api/v2/push/send"
    notification_batch_size: int = 100

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            if value.lstrip().startswith("["):
                return json.loads(value)
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.is_production and settings.jwt_secret.get_secret_value().startswith("change-me"):
        raise RuntimeError("JWT_SECRET must be set to a strong random value in production")
    if settings.is_production and not settings.demo_login:
        _check_production_login(settings)
    return settings


def _check_production_login(settings: Settings) -> None:
    """Password sign-in always works. A code provider, when chosen, must be fully configured."""
    if settings.email_provider == "smtp" and not (
        settings.smtp_host and settings.smtp_user and settings.smtp_from
    ):
        raise RuntimeError(
            "EMAIL_PROVIDER=smtp needs SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM"
        )
    if settings.sms_provider == "twilio":
        _check_twilio(settings)


def _check_twilio(settings: Settings) -> None:
    missing = [
        name
        for name, value in (
            ("TWILIO_ACCOUNT_SID", settings.twilio_account_sid),
            ("TWILIO_AUTH_TOKEN", settings.twilio_auth_token),
        )
        if not value
    ]
    if not (settings.twilio_phone_number or settings.twilio_messaging_service_sid):
        missing.append("TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID")
    if missing:
        raise RuntimeError(f"SMS_PROVIDER=twilio needs: {', '.join(missing)}")
