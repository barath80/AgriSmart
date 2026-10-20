from fastapi import APIRouter, Query

from app.auth.dependencies import CurrentFarmer, DbSession
from app.calendar.service import upcoming_fertilizer_dates
from app.weather import service
from app.weather.schemas import WeatherReport

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("")
async def get_weather(
    farmer: CurrentFarmer,
    session: DbSession,
    lat: float | None = Query(None, ge=6, le=38),
    lon: float | None = Query(None, ge=68, le=98),
) -> WeatherReport:
    """Forecast for the given point, or for the farmer's saved location."""
    if lat is None or lon is None:
        location = farmer.location
        lat, lon = (location.latitude, location.longitude) if location else (None, None)
    latitude, longitude = service.require_coordinates(lat, lon)
    fertilizer_dates = await upcoming_fertilizer_dates(session, farmer.id)
    return await service.get_report(session, latitude, longitude, fertilizer_dates=fertilizer_dates)
