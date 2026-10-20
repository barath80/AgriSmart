"""Live mandi prices from the official Agmarknet 2.0 daily reports (no API key).

This is the public backend of https://agmarknet.gov.in. One report per state and day lists
every market and commodity, so reports are cached briefly: several commodity lookups need
the same one. The newest of the last few days that has data is used, so a holiday or a late
upload never leaves farmers without a price. Reports carry no district, so it is left empty.
"""

import asyncio
import logging
import re
import time
from datetime import date, datetime, timedelta, timezone

from app.core.errors import ServiceUnavailable
from app.core.http import get_http_client
from app.core.observability import metrics
from app.market.providers import PriceObservation, state_spellings

logger = logging.getLogger(__name__)

_IST = timezone(timedelta(hours=5, minutes=30))
_BASE = "https://api.agmarknet.gov.in/v1"
_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://agmarknet.gov.in",
    "Referer": "https://agmarknet.gov.in/",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
}
_LOOKBACK_DAYS = 4
_REPORT_TTL_SECONDS = 1800
_MAX_CACHED_REPORTS = 60
_DEFAULT_COOLDOWN_SECONDS = 300
_MAX_COOLDOWN_SECONDS = 1800

_Row = tuple[str, str, dict]  # commodity name, market, price entry


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def _clean(text: str) -> str:
    """ "Kovilpatti(Uzhavar Sandhai )" -> "Kovilpatti (Uzhavar Sandhai)"."""
    text = re.sub(r"\s*\(\s*", " (", text)
    text = re.sub(r"\s*\)", ")", text)
    return " ".join(text.split())


def _core(text: str) -> str:
    return _norm(text.split("(")[0])


def commodity_matches(wanted: str, reported: str) -> bool:
    """Agmarknet and our crop list spell commodities differently ("Paddy(Dhan)(Common)" vs
    "Paddy(Common)"). Match the full normalised name, else the name before the first
    bracket. Never a substring, so "Mustard" does not pick up "Mustard Oil"."""
    return _norm(wanted) == _norm(reported) or _core(wanted) == _core(reported)


def _unavailable() -> ServiceUnavailable:
    metrics.inc("provider_failures", "agmarknet")
    return ServiceUnavailable("Market price service is unreachable", code="market_unavailable")


class AgmarknetProvider:
    name = "agmarknet"

    def __init__(self) -> None:
        self._states: dict[str, tuple[int, str]] = {}  # normalised name -> (id, official name)
        self._reports: dict[int, tuple[float, date, list[_Row]]] = {}
        self._blocked_until = 0.0  # monotonic time before which Agmarknet is not called again

    async def _get(self, path: str, params: dict) -> dict | None:
        """None when Agmarknet has no data for the query; ServiceUnavailable when unreachable."""
        if time.monotonic() < self._blocked_until:
            raise _unavailable()  # rate-limited: do not make it worse by retrying
        try:
            response = await get_http_client().get(
                f"{_BASE}{path}", params=params, headers=_HEADERS, timeout=45
            )
        except Exception as exc:
            raise _unavailable() from exc
        if response.status_code in (400, 404):
            return None
        if response.status_code == 429 or response.status_code >= 500:
            self._back_off(response)
            raise _unavailable()
        if response.status_code >= 400:
            raise _unavailable()
        try:
            return response.json()
        except ValueError:
            return None

    def _back_off(self, response) -> None:
        try:
            wait = float(response.headers.get("Retry-After", ""))
        except ValueError:
            wait = _DEFAULT_COOLDOWN_SECONDS
        wait = min(max(wait, 30.0), _MAX_COOLDOWN_SECONDS)
        self._blocked_until = time.monotonic() + wait
        logger.warning(
            "agmarknet_backoff", extra={"status": response.status_code, "seconds": int(wait)}
        )

    async def _load_states(self) -> None:
        if self._states:
            return
        found: dict[str, tuple[int, str]] = {}
        page, pages = 1, 1
        while page <= pages:
            data = await self._get("/location/state", {"page": page})
            if not data:
                break
            pages = int(data.get("pagination", {}).get("total_pages", 1))
            for item in data.get("states", []):
                found[_norm(item["state_name"])] = (int(item["id"]), item["state_name"].strip())
            page += 1
        if not found:
            raise _unavailable()
        self._states = found

    @staticmethod
    def _rows(data: dict) -> list[_Row]:
        return [
            (commodity["commodityName"], market["marketCenter"], entry)
            for group in data.get("commodityGroups", [])
            for commodity in group.get("commodities", [])
            for market in commodity.get("markets", [])
            for entry in market.get("data", [])
        ]

    async def _state_report(self, state_id: int) -> tuple[date | None, list[_Row]]:
        cached = self._reports.get(state_id)
        if cached and time.monotonic() - cached[0] < _REPORT_TTL_SECONDS:
            return cached[1], cached[2]
        today = datetime.now(_IST).date()
        for back in range(_LOOKBACK_DAYS + 1):
            day = today - timedelta(days=back)
            data = await self._get(
                "/prices-and-arrivals/commodity-market/daily-report-state",
                {"date": day.isoformat(), "state": state_id, "includeExcel": "false"},
            )
            rows = self._rows(data) if data and data.get("success") else []
            if rows:
                if len(self._reports) >= _MAX_CACHED_REPORTS:
                    self._reports.clear()
                self._reports[state_id] = (time.monotonic(), day, rows)
                return day, rows
        return None, []

    async def fetch(self, *, commodity: str, state: str | None) -> list[PriceObservation]:
        await self._load_states()
        if state:
            known = next(
                (hit for name in state_spellings(state) if (hit := self._states.get(_norm(name)))),
                None,
            )
            targets = [known] if known else []
        else:
            targets = list(self._states.values())
        semaphore = asyncio.Semaphore(4)

        async def one(state_id: int, state_name: str) -> list[PriceObservation]:
            async with semaphore:
                try:
                    day, rows = await self._state_report(state_id)
                except ServiceUnavailable:
                    if state:
                        raise
                    return []  # one state failing must not hide the others
            if day is None:
                return []
            return [
                obs
                for name, market, entry in rows
                if commodity_matches(commodity, name)
                and (obs := self._parse(state_name, name, market, entry, day)) is not None
            ]

        results = await asyncio.gather(*(one(i, n) for i, n in targets))
        return [obs for batch in results for obs in batch]

    @staticmethod
    def _parse(
        state: str, commodity: str, market: str, entry: dict, day: date
    ) -> PriceObservation | None:
        try:
            if "quintal" not in str(entry.get("unitOfPrice", "")).lower():
                return None  # other units (per nut, per kg) are never silently converted
            low = float(entry["minimumPrice"])
            high = float(entry["maximumPrice"])
            modal = float(entry["modalPrice"])
            if not 0 < low <= high or modal <= 0:
                return None
            return PriceObservation(
                state=state,
                district="",
                market=_clean(market),
                commodity=commodity.strip(),
                variety=str(entry.get("variety") or "").strip(),
                grade="",
                arrival_date=day,
                min_price=low,
                max_price=high,
                modal_price=modal,
            )
        except (KeyError, ValueError, TypeError, AttributeError):
            logger.warning("market_record_skipped", extra={"record": str(entry)[:200]})
            return None
