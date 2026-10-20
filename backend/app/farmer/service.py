from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.farmer.geocoding import geocode
from app.farmer.models import Farmer, Location
from app.farmer.schemas import (
    FarmerProfile,
    FarmerProfileUpdate,
    LocationIn,
    NotificationPreferences,
    VoicePreferences,
)
from app.voice.providers.base import VoiceStyle


def _normalize_place(value: str) -> str:
    return " ".join(value.split()).title()


async def get_or_create_location(session: AsyncSession, data: LocationIn) -> Location:
    state, district = _normalize_place(data.state), _normalize_place(data.district)
    village = _normalize_place(data.village) if data.village else ""
    location = await session.scalar(
        select(Location).where(
            Location.state == state, Location.district == district, Location.village == village
        )
    )
    if location is None:
        location = Location(state=state, district=district, village=village)
        session.add(location)
    # Keep the most recent coordinates; they drive weather lookups.
    if data.latitude is not None and data.longitude is not None:
        location.latitude, location.longitude = data.latitude, data.longitude
    elif location.latitude is None:
        coordinates = await geocode(state, district, village)
        if coordinates:
            location.latitude, location.longitude = coordinates
    await session.flush()
    return location


def to_profile(farmer: Farmer) -> FarmerProfile:
    return FarmerProfile(
        id=farmer.id,
        name=farmer.name,
        phone=farmer.phone,
        preferred_language=farmer.preferred_language,
        primary_channel=farmer.primary_channel,
        birth_year=farmer.birth_year,
        location=farmer.location,
        notification_preferences=NotificationPreferences(**(farmer.notification_preferences or {})),
        voice_preferences=VoicePreferences(**(farmer.voice_preferences or {})),
        profile_complete=bool(farmer.name and farmer.location_id),
    )


async def update_profile(
    session: AsyncSession, farmer: Farmer, update: FarmerProfileUpdate
) -> Farmer:
    if update.name is not None:
        farmer.name = update.name.strip()
    if update.preferred_language is not None:
        farmer.preferred_language = update.preferred_language
    if update.birth_year is not None:
        farmer.birth_year = update.birth_year
    if update.notification_preferences is not None:
        farmer.notification_preferences = update.notification_preferences.model_dump()
    if update.voice_preferences is not None:
        farmer.voice_preferences = update.voice_preferences.model_dump(mode="json")
    if update.location is not None:
        location = await get_or_create_location(session, update.location)
        farmer.location_id = location.id
        farmer.location = location
    await session.commit()
    await session.refresh(farmer)
    return farmer


def voice_style(farmer: Farmer) -> VoiceStyle:
    """The farmer's chosen voice; invalid or missing stored values fall back to defaults."""
    prefs = VoicePreferences(**(farmer.voice_preferences or {}))
    return VoiceStyle(gender=prefs.gender, pace=prefs.pace, voice=prefs.voice)
