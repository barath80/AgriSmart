import uuid
from datetime import date, datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class FarmerRow(BaseModel):
    id: uuid.UUID
    name: str
    phone: str
    preferred_language: str
    primary_channel: str
    state: str | None
    district: str | None
    farms: int
    total_acres: float
    created_at: datetime
    last_login_at: datetime | None
    is_active: bool


class FarmRow(BaseModel):
    id: uuid.UUID
    farmer_name: str
    name: str
    area_acres: float
    soil_type: str | None
    irrigation: str
    state: str | None
    district: str | None
    active_crops: list[str]


class VoiceSessionRow(BaseModel):
    id: uuid.UUID
    farmer_name: str | None
    channel: str
    language: str
    provider: str
    started_at: datetime
    duration_seconds: float | None
    turns: int
    end_reason: str | None


class CountByKey(BaseModel):
    key: str
    count: int


class DailyPoint(BaseModel):
    date: date
    assistant_requests: int
    diagnoses: int
    recommendations: int


class Analytics(BaseModel):
    total_farmers: int
    new_farmers_7d: int
    active_users_7d: int
    assistant_requests_24h: int
    assistant_requests_7d: int
    voice_sessions_7d: int
    disease_predictions_7d: int
    crop_recommendations_7d: int
    yield_predictions_7d: int
    failed_assistant_answers_7d: int
    avg_assistant_latency_ms: float | None
    diagnosis_acceptance_rate: float | None
    intents: list[CountByKey]
    handled_by: list[CountByKey]
    languages: list[CountByKey]
    channels: list[CountByKey]
    states: list[CountByKey]
    notification_deliveries: list[CountByKey]
    daily: list[DailyPoint]


class ModelRow(BaseModel):
    name: str
    version: str
    registered: bool
    is_active: bool
    framework: str | None = None
    dataset_version: str | None = None
    feature_version: str | None = None
    metrics: dict[str, Any] = {}
    trained_at: datetime | None = None
    loaded_in_this_instance: bool = False


class ModelRegisterIn(BaseModel):
    name: str
    version: str = Field(pattern=r"^[a-z]+_v\d{1,4}$")
    activate: bool = False


class KnowledgeUpdate(BaseModel):
    """Admin edit of disease/pest knowledge. Editing clears the expert verification."""

    names: dict[str, str] | None = None
    fields: dict[str, list[str] | str] = {}


class VerifyIn(BaseModel):
    verified_by: str = Field(min_length=3, max_length=120)


class CropUpdate(BaseModel):
    names: dict[str, str] | None = None
    aliases: list[str] | None = None
    seasons: list[str] | None = None
    duration_days_min: int | None = Field(None, ge=1, le=2000)
    duration_days_max: int | None = Field(None, ge=1, le=2000)
    water_requirement: str | None = Field(None, pattern=r"^(low|medium|high)$")
    suitable_soils: list[str] | None = None
    fertilizer_guidance: str | None = Field(None, max_length=1000)
    yield_min_q_per_acre: float | None = Field(None, ge=0)
    yield_max_q_per_acre: float | None = Field(None, ge=0)
    market_commodity: str | None = Field(None, max_length=80)


class SystemHealth(BaseModel):
    status: str
    environment: str
    database_latency_ms: float
    providers: dict[str, str]
    voice_capabilities: dict[str, bool]
    models_active: dict[str, str | None]
    models_loaded_here: dict[str, str | None]
    pending_notifications: int
    metrics: dict[str, Any]
