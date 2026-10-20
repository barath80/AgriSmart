from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel


class CurrentWeather(BaseModel):
    temperature_c: float
    humidity_pct: float
    precipitation_mm: float
    wind_kmh: float
    condition: str  # clear | cloudy | fog | drizzle | rain | snow | thunderstorm


class DailyForecast(BaseModel):
    date: date
    temp_max_c: float
    temp_min_c: float
    rain_mm: float
    rain_probability_pct: float
    wind_max_kmh: float
    condition: str


class AlertSeverity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    SEVERE = "severe"


class WeatherAlert(BaseModel):
    """`code` is a stable key that clients and voice templates localise."""

    code: str
    severity: AlertSeverity
    on: date
    params: dict[str, int | float | str] = {}


class WeatherReport(BaseModel):
    latitude: float
    longitude: float
    current: CurrentWeather
    daily: list[DailyForecast]
    rainfall_last_90_days_mm: float
    # Season averages over the same 90 days: the crop model was trained on growing-season
    # climate, not on a single afternoon reading. None in reports cached before this field.
    temperature_mean_90_days_c: float | None = None
    humidity_mean_90_days_pct: float | None = None
    elevation_m: float | None = None
    alerts: list[WeatherAlert] = []
    source: str
    fetched_at: datetime
