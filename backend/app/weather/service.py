from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import utcnow
from app.core.errors import InvalidInput
from app.weather.models import WeatherCache
from app.weather.providers import get_weather_provider
from app.weather.rules import build_alerts
from app.weather.schemas import WeatherReport


def _cache_key(provider: str, latitude: float, longitude: float) -> str:
    # Two decimals ≈ 1 km: neighbours share one cached forecast.
    return f"{provider}:{latitude:.2f}:{longitude:.2f}"


async def get_report(
    session: AsyncSession,
    latitude: float,
    longitude: float,
    *,
    fertilizer_dates: list[date] | None = None,
) -> WeatherReport:
    provider = get_weather_provider()
    key = _cache_key(provider.name, latitude, longitude)
    now = utcnow()

    cached = await session.scalar(select(WeatherCache).where(WeatherCache.cache_key == key))
    if cached is not None and cached.expires_at > now:
        report = WeatherReport.model_validate(cached.payload)
    else:
        report = await provider.fetch(round(latitude, 2), round(longitude, 2))
        expires_at = now + timedelta(minutes=get_settings().weather_cache_ttl_minutes)
        payload = report.model_dump(mode="json", exclude={"alerts"})
        if cached is None:
            session.add(
                WeatherCache(cache_key=key, payload=payload, fetched_at=now, expires_at=expires_at)
            )
        else:
            cached.payload, cached.fetched_at, cached.expires_at = payload, now, expires_at
        try:
            await session.commit()
        except IntegrityError:  # another instance cached the same key concurrently
            await session.rollback()

    # Alerts depend on the farmer's own plans, so they are computed per request, not cached.
    report.alerts = build_alerts(report, fertilizer_dates)
    return report


def require_coordinates(latitude: float | None, longitude: float | None) -> tuple[float, float]:
    if latitude is None or longitude is None:
        raise InvalidInput("Location is needed for weather", code="location_required")
    return latitude, longitude
