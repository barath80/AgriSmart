"""Weather providers. AgriSmart never trains a weather model — it asks an API."""

from datetime import date
from typing import Protocol

from app.core.database import utcnow
from app.core.errors import ServiceUnavailable
from app.core.http import get_http_client
from app.weather.schemas import CurrentWeather, DailyForecast, WeatherReport


class WeatherProvider(Protocol):
    name: str

    async def fetch(self, latitude: float, longitude: float) -> WeatherReport: ...


def _condition(wmo_code: int) -> str:
    """Collapse WMO weather codes into a few farmer-meaningful conditions."""
    if wmo_code == 0:
        return "clear"
    if wmo_code in (1, 2, 3):
        return "cloudy"
    if wmo_code in (45, 48):
        return "fog"
    if 51 <= wmo_code <= 57:
        return "drizzle"
    if 61 <= wmo_code <= 67 or 80 <= wmo_code <= 82:
        return "rain"
    if 71 <= wmo_code <= 77 or wmo_code in (85, 86):
        return "snow"
    if wmo_code >= 95:
        return "thunderstorm"
    return "cloudy"


class OpenMeteoProvider:
    """https://open-meteo.com — free for non-commercial use, no API key.

    One request returns current conditions, a 7-day forecast and the last 92 days of
    rainfall (used as the seasonal rainfall input of the crop model).
    """

    name = "open_meteo"
    _URL = "https://api.open-meteo.com/v1/forecast"

    async def fetch(self, latitude: float, longitude: float) -> WeatherReport:
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": "temperature_2m,relative_humidity_2m,precipitation,"
            "wind_speed_10m,weather_code",
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,"
            "precipitation_probability_max,wind_speed_10m_max,weather_code,"
            "temperature_2m_mean,relative_humidity_2m_mean",
            "timezone": "Asia/Kolkata",
            "forecast_days": 7,
            "past_days": 92,
        }
        try:
            response = await get_http_client().get(self._URL, params=params)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            raise ServiceUnavailable(
                "Weather service is unreachable", code="weather_unavailable"
            ) from exc

        current = data["current"]
        daily = data["daily"]
        today = date.fromisoformat(current["time"][:10])
        forecast: list[DailyForecast] = []
        past_rain = 0.0
        past_temps: list[float] = []
        past_humidity: list[float] = []
        for i, day in enumerate(daily["time"]):
            day_date = date.fromisoformat(day)
            rain = daily["precipitation_sum"][i] or 0.0
            if day_date < today:
                past_rain += rain
                if (t := daily.get("temperature_2m_mean", [None] * (i + 1))[i]) is not None:
                    past_temps.append(t)
                if (h := daily.get("relative_humidity_2m_mean", [None] * (i + 1))[i]) is not None:
                    past_humidity.append(h)
                continue
            forecast.append(
                DailyForecast(
                    date=day_date,
                    temp_max_c=daily["temperature_2m_max"][i],
                    temp_min_c=daily["temperature_2m_min"][i],
                    rain_mm=rain,
                    rain_probability_pct=daily["precipitation_probability_max"][i] or 0,
                    wind_max_kmh=daily["wind_speed_10m_max"][i],
                    condition=_condition(daily["weather_code"][i]),
                )
            )
        return WeatherReport(
            latitude=latitude,
            longitude=longitude,
            current=CurrentWeather(
                temperature_c=current["temperature_2m"],
                humidity_pct=current["relative_humidity_2m"],
                precipitation_mm=current["precipitation"],
                wind_kmh=current["wind_speed_10m"],
                condition=_condition(current["weather_code"]),
            ),
            daily=forecast,
            rainfall_last_90_days_mm=round(past_rain, 1),
            temperature_mean_90_days_c=_mean(past_temps),
            humidity_mean_90_days_pct=_mean(past_humidity),
            elevation_m=data.get("elevation"),
            source=self.name,
            fetched_at=utcnow(),
        )


def _mean(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 1) if values else None


def get_weather_provider() -> WeatherProvider:
    return OpenMeteoProvider()
