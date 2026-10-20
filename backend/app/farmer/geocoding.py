"""Coordinates for a typed-in place, so farmers without GPS still get local weather.

Uses the free Open-Meteo geocoder (GeoNames data, no key) — the same provider family as
the weather service. Failure is never fatal: the profile saves and weather asks for GPS.
"""

import logging

from app.core.http import get_http_client
from app.core.observability import metrics

logger = logging.getLogger(__name__)

_URL = "https://geocoding-api.open-meteo.com/v1/search"


def _same(a: str | None, b: str) -> bool:
    return bool(a) and a.casefold().replace(" ", "") == b.casefold().replace(" ", "")


async def _search(name: str) -> list[dict]:
    response = await get_http_client().get(
        _URL, params={"name": name, "count": 10, "countryCode": "IN", "format": "json"}, timeout=10
    )
    response.raise_for_status()
    return response.json().get("results") or []


async def geocode(state: str, district: str, village: str = "") -> tuple[float, float] | None:
    """Most specific match inside the farmer's state: the village, else the district."""
    try:
        for name in (village, district):
            if not name:
                continue
            places = [p for p in await _search(name) if _same(p.get("admin1"), state)]
            # Prefer a populated place (PPL*) in the right district over e.g. an airport.
            places.sort(
                key=lambda p: (
                    not str(p.get("feature_code", "")).startswith("PPL"),
                    not _same(p.get("admin2"), district),
                )
            )
            if places:
                return float(places[0]["latitude"]), float(places[0]["longitude"])
    except Exception:
        metrics.inc("provider_failures", "geocoding")
        logger.warning("geocoding_failed", extra={"state": state, "district": district})
    return None
