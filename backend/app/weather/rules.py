"""Deterministic agricultural weather alerts.

Thresholds follow India Meteorological Department (IMD) rainfall categories and common
agronomic practice. Each rule is a plain function so it can be unit-tested and reviewed
by an agronomist.
"""

from datetime import date, timedelta

from app.weather.schemas import AlertSeverity, DailyForecast, WeatherAlert, WeatherReport

HEAVY_RAIN_MM = 64.5  # IMD "heavy rain"
VERY_HEAVY_RAIN_MM = 115.6  # IMD "very heavy rain"
RAIN_LIKELY_PCT = 60
HEAT_STRESS_C = 40.0
COLD_STRESS_C = 4.0
SPRAY_WIND_LIMIT_KMH = 20.0
DRY_SPELL_DAYS = 7


def rain_alerts(daily: list[DailyForecast]) -> list[WeatherAlert]:
    alerts = []
    for day in daily[:3]:
        if day.rain_mm >= VERY_HEAVY_RAIN_MM:
            alerts.append(
                WeatherAlert(
                    code="very_heavy_rain",
                    severity=AlertSeverity.SEVERE,
                    on=day.date,
                    params={"rain_mm": round(day.rain_mm)},
                )
            )
        elif day.rain_mm >= HEAVY_RAIN_MM:
            alerts.append(
                WeatherAlert(
                    code="heavy_rain",
                    severity=AlertSeverity.WARNING,
                    on=day.date,
                    params={"rain_mm": round(day.rain_mm)},
                )
            )
    return alerts


def temperature_alerts(daily: list[DailyForecast]) -> list[WeatherAlert]:
    alerts = []
    for day in daily[:3]:
        if day.temp_max_c >= HEAT_STRESS_C:
            alerts.append(
                WeatherAlert(
                    code="heat_stress",
                    severity=AlertSeverity.WARNING,
                    on=day.date,
                    params={"temp_c": round(day.temp_max_c)},
                )
            )
        if day.temp_min_c <= COLD_STRESS_C:
            alerts.append(
                WeatherAlert(
                    code="cold_stress",
                    severity=AlertSeverity.WARNING,
                    on=day.date,
                    params={"temp_c": round(day.temp_min_c)},
                )
            )
    return alerts


def spraying_advice(daily: list[DailyForecast]) -> list[WeatherAlert]:
    """Rain washes off sprays; wind causes drift. Advise against spraying in the next 24 h."""
    if not daily:
        return []
    today = daily[0]
    if today.rain_probability_pct >= RAIN_LIKELY_PCT:
        return [
            WeatherAlert(code="avoid_spraying_rain", severity=AlertSeverity.INFO, on=today.date)
        ]
    if today.wind_max_kmh >= SPRAY_WIND_LIMIT_KMH:
        return [
            WeatherAlert(
                code="avoid_spraying_wind",
                severity=AlertSeverity.INFO,
                on=today.date,
                params={"wind_kmh": round(today.wind_max_kmh)},
            )
        ]
    return []


def dry_spell_alert(daily: list[DailyForecast]) -> list[WeatherAlert]:
    upcoming = daily[:DRY_SPELL_DAYS]
    if len(upcoming) == DRY_SPELL_DAYS and all(d.rain_mm < 1 for d in upcoming):
        return [
            WeatherAlert(
                code="dry_spell",
                severity=AlertSeverity.INFO,
                on=upcoming[0].date,
                params={"days": DRY_SPELL_DAYS},
            )
        ]
    return []


def fertilizer_conflicts(
    daily: list[DailyForecast], fertilizer_dates: list[date]
) -> list[WeatherAlert]:
    """Heavy or likely rain within a day of planned fertilizer → review/delay application."""
    by_date = {d.date: d for d in daily}
    alerts = []
    for planned in fertilizer_dates:
        window = [by_date.get(planned + timedelta(days=offset)) for offset in (0, 1)]
        if any(d and (d.rain_mm >= 20 or d.rain_probability_pct >= 70) for d in window):
            alerts.append(
                WeatherAlert(code="delay_fertilizer", severity=AlertSeverity.WARNING, on=planned)
            )
    return alerts


def build_alerts(
    report: WeatherReport, fertilizer_dates: list[date] | None = None
) -> list[WeatherAlert]:
    daily = report.daily
    return [
        *rain_alerts(daily),
        *temperature_alerts(daily),
        *fertilizer_conflicts(daily, fertilizer_dates or []),
        *spraying_advice(daily),
        *dry_spell_alert(daily),
    ]
