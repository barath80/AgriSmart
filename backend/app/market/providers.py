"""Mandi price providers behind one interface."""

import logging
import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol

from app.core.config import get_settings
from app.core.errors import ServiceUnavailable
from app.core.http import get_http_client
from app.core.observability import metrics

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class PriceObservation:
    state: str
    district: str
    market: str
    commodity: str
    variety: str
    grade: str
    arrival_date: date
    min_price: float
    max_price: float
    modal_price: float


def _clean_name(text: str) -> str:
    """ "Pune(Pimpri )" -> "Pune (Pimpri)"."""
    text = re.sub(r"\s*\(\s*", " (", text)
    text = re.sub(r"\s*\)", ")", text)
    return " ".join(text.split())


class MarketPriceProvider(Protocol):
    name: str

    async def fetch(self, *, commodity: str, state: str | None) -> list[PriceObservation]: ...


# Government feeds spell some states differently from the standard names the app uses.
# Keys are lower-case with only letters; values are every spelling to try, standard first.
_STATE_SPELLINGS: dict[str, tuple[str, ...]] = {
    "chhattisgarh": ("Chhattisgarh", "Chattisgarh"),
    "uttarakhand": ("Uttarakhand", "Uttrakhand"),
    "delhi": ("Delhi", "NCT of Delhi"),
    "newdelhi": ("Delhi", "NCT of Delhi"),
    "puducherry": ("Puducherry", "Pondicherry"),
    "kerala": ("Kerala", "Keralam"),
    "keralam": ("Keralam", "Kerala"),
    "andamanandnicobarislands": ("Andaman and Nicobar", "Andaman and Nicobar Islands"),
    "andamanandnicobar": ("Andaman and Nicobar", "Andaman and Nicobar Islands"),
    "odisha": ("Odisha", "Orissa"),
}


def state_spellings(state: str) -> tuple[str, ...]:
    """The spellings a feed might use for a state, the given one first."""
    key = "".join(ch for ch in state.lower() if ch.isalpha())
    return (state, *(s for s in _STATE_SPELLINGS.get(key, ()) if s != state))


class DataGovInProvider:
    """Agmarknet "Current Daily Price of Various Commodities from Various Markets (Mandi)".

    https://www.data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi
    Free API key from data.gov.in. The resource holds only the latest day — no history —
    which is why every response is persisted by the market service.
    """

    name = "data_gov_in"
    _RESOURCE = "resource/9ef84268-d588-465a-a308-a864a43d0070"
    # Filter parameter names as documented for this resource on the OGD API console.
    # If data.gov.in changes them, this mapping is the only place to update.
    _FILTERS = {"state": "filters[state.keyword]", "commodity": "filters[commodity]"}
    _PAGE_SIZE = 500

    def __init__(self, api_key: str, base_url: str = "https://api.data.gov.in") -> None:
        self._api_key = api_key
        # api.data.gov.in refuses connections from some networks; a relay can stand in.
        self._url = f"{base_url.rstrip('/')}/{self._RESOURCE}"

    async def fetch(self, *, commodity: str, state: str | None) -> list[PriceObservation]:
        for spelling in state_spellings(state) if state else (None,):
            observations = await self._fetch(commodity, spelling)
            if observations:
                return observations
        return []

    async def _fetch(self, commodity: str, state: str | None) -> list[PriceObservation]:
        params = {
            "api-key": self._api_key,
            "format": "json",
            "limit": self._PAGE_SIZE,
            self._FILTERS["commodity"]: commodity,
        }
        if state:
            params[self._FILTERS["state"]] = state
        try:
            response = await get_http_client().get(self._url, params=params, timeout=20)
            response.raise_for_status()
            records = response.json().get("records", [])
        except Exception as exc:
            metrics.inc("provider_failures", "data_gov_in")
            raise ServiceUnavailable(
                "Market price service is unreachable", code="market_unavailable"
            ) from exc
        return [obs for record in records if (obs := self._parse(record)) is not None]

    @staticmethod
    def _parse(record: dict) -> PriceObservation | None:
        try:
            return PriceObservation(
                state=record["state"].strip(),
                district=record["district"].strip(),
                market=_clean_name(record["market"]),
                commodity=record["commodity"].strip(),
                variety=(record.get("variety") or "").strip(),
                grade=(record.get("grade") or "").strip(),
                arrival_date=datetime.strptime(record["arrival_date"], "%d/%m/%Y").date(),
                min_price=float(record["min_price"]),
                max_price=float(record["max_price"]),
                modal_price=float(record["modal_price"]),
            )
        except (KeyError, ValueError, TypeError, AttributeError):
            logger.warning("market_record_skipped", extra={"record": str(record)[:200]})
            return None


class ImportedPricesProvider:
    """No live API: prices come only from imported CSV files (Agmarknet / data.gov.in
    downloads, see `app.market.importer`). Zero cost and no API key."""

    name = "import"

    async def fetch(self, *, commodity: str, state: str | None) -> list[PriceObservation]:
        return []


class NoMarketProvider:
    name = "none"

    async def fetch(self, *, commodity: str, state: str | None) -> list[PriceObservation]:
        raise ServiceUnavailable("Market prices are not configured", code="market_unavailable")


class FallbackProvider:
    """Try the primary provider; when it is unreachable, try the backup."""

    def __init__(self, primary: MarketPriceProvider, backup: MarketPriceProvider) -> None:
        self._primary = primary
        self._backup = backup
        self.name = primary.name

    async def fetch(self, *, commodity: str, state: str | None) -> list[PriceObservation]:
        try:
            observations = await self._primary.fetch(commodity=commodity, state=state)
        except ServiceUnavailable:
            logger.warning(
                "market_provider_fallback",
                extra={"primary": self._primary.name, "backup": self._backup.name},
            )
            observations = await self._backup.fetch(commodity=commodity, state=state)
            self.name = self._backup.name
            return observations
        if observations:
            self.name = self._primary.name
            return observations
        # Empty can mean the primary is silently throttling; the backup may know better.
        try:
            backup = await self._backup.fetch(commodity=commodity, state=state)
        except ServiceUnavailable:
            return observations
        if backup:
            self.name = self._backup.name
        return backup or observations


_agmarknet: MarketPriceProvider | None = None


def get_market_provider() -> MarketPriceProvider:
    settings = get_settings()
    primary = _primary_provider()
    if settings.market_provider == "agmarknet" and settings.data_gov_in_api_key:
        backup = DataGovInProvider(
            settings.data_gov_in_api_key.get_secret_value(), settings.data_gov_in_base_url
        )
        return FallbackProvider(primary, backup)
    return primary


def _primary_provider() -> MarketPriceProvider:
    settings = get_settings()
    if settings.market_provider == "data_gov_in" and settings.data_gov_in_api_key:
        return DataGovInProvider(
            settings.data_gov_in_api_key.get_secret_value(), settings.data_gov_in_base_url
        )
    if settings.market_provider == "agmarknet":
        from app.market.agmarknet import AgmarknetProvider  # circular: it uses PriceObservation

        global _agmarknet
        if _agmarknet is None:  # one instance, so its report cache is shared
            _agmarknet = AgmarknetProvider()
        return _agmarknet
    if settings.market_provider == "import":
        return ImportedPricesProvider()
    return NoMarketProvider()
