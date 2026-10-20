"""Import mandi prices from downloaded CSV files — no API key required.

Accepted sources (all free):
* Agmarknet price reports (https://agmarknet.gov.in → Price & Arrivals → export, saved as CSV)
* The data.gov.in "Current Daily Price … (Mandi)" CSV download
* Any CSV with the same columns

Headers are matched loosely ("Min Price (Rs./Quintal)", "Min_x0020_Price", "min_price"
all work). Rows that cannot be parsed are counted and reported, never silently guessed.
"""

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime

from app.market.providers import PriceObservation

_ALIASES = {
    "state": ("state", "statename"),
    "district": ("district", "districtname"),
    "market": ("market", "marketname", "apmc", "mandi"),
    "commodity": ("commodity", "commodityname"),
    "variety": ("variety",),
    "grade": ("grade",),
    "arrival_date": ("arrivaldate", "pricedate", "reporteddate", "date"),
    "min_price": ("minprice", "minimumprice"),
    "max_price": ("maxprice", "maximumprice"),
    "modal_price": ("modalprice",),
}
_REQUIRED = (
    "district",
    "market",
    "commodity",
    "arrival_date",
    "min_price",
    "max_price",
    "modal_price",
)
_DATE_FORMATS = ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d %b %Y", "%d-%b-%Y", "%d-%b-%y", "%d/%m/%y")


@dataclass
class ImportResult:
    observations: list[PriceObservation] = field(default_factory=list)
    skipped_rows: list[int] = field(default_factory=list)  # 1-based data row numbers


def _key(header: str) -> str:
    return re.sub(r"[^a-z]", "", header.lower().replace("x0020", ""))


def _map_columns(headers: list[str]) -> dict[str, int]:
    keys = [_key(h) for h in headers]
    columns: dict[str, int] = {}
    for field_name, aliases in _ALIASES.items():
        for index, key in enumerate(keys):
            # "minpricersquintal" starts with "minprice"; exact match wins over prefix.
            if key in aliases or any(key.startswith(a) for a in aliases if len(a) > 5):
                columns.setdefault(field_name, index)
    return columns


def _parse_date(value: str) -> date:
    value = value.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"unrecognised date {value!r}")


def _price(value: str) -> float:
    number = float(value.replace(",", "").strip())
    if number < 0 or number > 10_000_000:
        raise ValueError("price out of range")
    return number


def parse_csv(content: bytes, default_state: str | None = None) -> ImportResult:
    text = content.decode("utf-8-sig", errors="replace")
    rows = list(csv.reader(io.StringIO(text)))
    # Agmarknet exports may start with title lines; the header is the first row naming a commodity.
    header_index = next(
        (i for i, r in enumerate(rows[:20]) if "commodity" in "".join(_key(c) for c in r)), None
    )
    if header_index is None:
        raise ValueError("No header row with a 'Commodity' column found")
    columns = _map_columns(rows[header_index])
    missing = [f for f in _REQUIRED if f not in columns]
    if missing:
        raise ValueError(f"Missing columns: {', '.join(missing)}")
    if "state" not in columns and not default_state:
        raise ValueError("The file has no State column — choose the state when importing")

    result = ImportResult()
    for number, row in enumerate(rows[header_index + 1 :], start=1):
        if not any(cell.strip() for cell in row):
            continue

        def cell(name: str, row: list[str] = row) -> str:
            index = columns.get(name)
            return row[index].strip() if index is not None and index < len(row) else ""

        try:
            state = cell("state") or default_state or ""
            observation = PriceObservation(
                state=" ".join(state.split()).title(),
                district=" ".join(cell("district").split()).title(),
                market=cell("market"),
                commodity=cell("commodity"),
                variety=cell("variety"),
                grade=cell("grade"),
                arrival_date=_parse_date(cell("arrival_date")),
                min_price=_price(cell("min_price")),
                max_price=_price(cell("max_price")),
                modal_price=_price(cell("modal_price")),
            )
            if not (observation.market and observation.commodity and observation.state):
                raise ValueError("blank market/commodity/state")
        except (ValueError, IndexError):
            result.skipped_rows.append(number)
            continue
        result.observations.append(observation)
    return result
