from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class MarketPriceOut(BaseModel):
    """An *observed* price. Never a forecast."""

    kind: Literal["observed"] = "observed"
    market: str
    district: str
    state: str
    commodity: str
    variety: str
    arrival_date: date
    min_price: float
    max_price: float
    modal_price: float
    unit: str = "INR/quintal"


class CurrentPrices(BaseModel):
    commodity: str
    state: str | None
    prices: list[MarketPriceOut]
    source: str
    fetched_at: datetime | None
    stale: bool  # True when the provider failed and cached prices were served


class HistoryPoint(BaseModel):
    kind: Literal["historical"] = "historical"
    date: date
    avg_modal_price: float
    min_price: float
    max_price: float
    markets: int


class PriceHistory(BaseModel):
    commodity: str
    state: str | None
    points: list[HistoryPoint]
