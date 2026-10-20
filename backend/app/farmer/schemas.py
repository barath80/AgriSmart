import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.core.language import Language
from app.farmer.models import Channel
from app.voice.providers.base import VoiceGender


class LocationIn(BaseModel):
    state: str = Field(min_length=2, max_length=64)
    district: str = Field(min_length=2, max_length=64)
    village: str = Field("", max_length=128)
    latitude: float | None = Field(None, ge=6, le=38)  # India's bounding box
    longitude: float | None = Field(None, ge=68, le=98)


class LocationOut(LocationIn):
    model_config = ConfigDict(from_attributes=True)


class NotificationPreferences(BaseModel):
    weather: bool = True
    market: bool = True
    schemes: bool = True
    calendar: bool = True
    disease: bool = True


class VoicePreferences(BaseModel):
    gender: VoiceGender = VoiceGender.FEMALE
    pace: float = Field(1.0, ge=0.75, le=1.25)
    voice: str | None = Field(None, max_length=32)


class FarmerProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    phone: str
    preferred_language: Language
    primary_channel: Channel
    birth_year: int | None
    location: LocationOut | None
    notification_preferences: NotificationPreferences
    voice_preferences: VoicePreferences
    profile_complete: bool


class FarmerProfileUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    preferred_language: Language | None = None
    birth_year: int | None = Field(None, ge=1920, le=2015)
    location: LocationIn | None = None
    notification_preferences: NotificationPreferences | None = None
    voice_preferences: VoicePreferences | None = None


class PushTokenUpdate(BaseModel):
    push_token: str = Field(pattern=r"^ExponentPushToken\[[A-Za-z0-9_-]+\]$")
