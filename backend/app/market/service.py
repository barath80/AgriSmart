from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import utcnow
from app.core.errors import ServiceUnavailable
from app.market.models import Market, MarketPrice
from app.market.providers import PriceObservation, get_market_provider
from app.market.schemas import CurrentPrices, HistoryPoint, MarketPriceOut, PriceHistory


def _insert(session: AsyncSession, model):
    dialect = session.bind.dialect.name
    return (pg_insert if dialect == "postgresql" else sqlite_insert)(model)


async def _store(session: AsyncSession, observations: list[PriceObservation], source: str) -> None:
    """Persist observations idempotently (unique constraints + ON CONFLICT DO NOTHING)."""
    if not observations:
        return
    places = {(o.state, o.district, o.market) for o in observations}
    await session.execute(
        _insert(session, Market)
        .values([{"state": s, "district": d, "name": m} for s, d, m in places])
        .on_conflict_do_nothing()
    )
    markets = await session.execute(
        select(Market.id, Market.state, Market.district, Market.name).where(
            Market.state.in_({p[0] for p in places}), Market.name.in_({p[2] for p in places})
        )
    )
    market_ids = {(r.state, r.district, r.name): r.id for r in markets}
    now = utcnow()
    await session.execute(
        _insert(session, MarketPrice)
        .values(
            [
                {
                    "market_id": market_ids[(o.state, o.district, o.market)],
                    "commodity": o.commodity,
                    "variety": o.variety,
                    "grade": o.grade,
                    "arrival_date": o.arrival_date,
                    "min_price": o.min_price,
                    "max_price": o.max_price,
                    "modal_price": o.modal_price,
                    "source": source,
                    "fetched_at": now,
                }
                for o in observations
            ]
        )
        .on_conflict_do_nothing()
    )
    await session.commit()


async def _latest_stored(
    session: AsyncSession, commodity: str, state: str | None, district: str | None
) -> list[MarketPrice]:
    latest_date = select(func.max(MarketPrice.arrival_date)).where(
        MarketPrice.commodity == commodity
    )
    query = select(MarketPrice).join(Market).where(MarketPrice.commodity == commodity)
    if state:
        latest_date = latest_date.join(Market).where(Market.state == state)
        query = query.where(Market.state == state)
    query = query.where(MarketPrice.arrival_date == latest_date.scalar_subquery())
    rows = list(await session.scalars(query))
    # Farmer's own district first, then the best price.
    rows.sort(key=lambda p: (p.market.district != district, -p.modal_price))
    return rows


async def current_prices(
    session: AsyncSession, commodity: str, state: str | None, district: str | None = None
) -> CurrentPrices:
    provider = get_market_provider()
    ttl = timedelta(minutes=get_settings().market_cache_ttl_minutes)
    last_fetch_query = select(func.max(MarketPrice.fetched_at)).where(
        MarketPrice.commodity == commodity
    )
    if state:
        last_fetch_query = last_fetch_query.join(Market).where(Market.state == state)
    last_fetched = await session.scalar(last_fetch_query)

    stale = False
    # Imported prices have nothing to fetch; an empty result means "no recent price known".
    if provider.name != "import" and (last_fetched is None or utcnow() - last_fetched > ttl):
        try:
            observations = await provider.fetch(commodity=commodity, state=state)
            await _store(session, observations, provider.name)
            last_fetched = utcnow() if observations else last_fetched
        except ServiceUnavailable:
            if last_fetched is None:
                raise
            stale = True  # serve what we have, clearly marked

    rows = await _latest_stored(session, commodity, state, district)
    return CurrentPrices(
        commodity=commodity,
        state=state,
        prices=[
            MarketPriceOut(
                market=p.market.name,
                district=p.market.district,
                state=p.market.state,
                commodity=p.commodity,
                variety=p.variety,
                arrival_date=p.arrival_date,
                min_price=p.min_price,
                max_price=p.max_price,
                modal_price=p.modal_price,
            )
            for p in rows[:50]
        ],
        source=provider.name,
        fetched_at=last_fetched,
        stale=stale,
    )


async def refresh_grown_prices(session: AsyncSession) -> int:
    """Fetch prices ahead of time for every crop and state farmers are growing, so their
    questions are answered from the database and never wait on (or hammer) the upstream.
    Returns how many crop/state pairs were refreshed."""
    from app.crop.models import Crop
    from app.farm.models import CropCycle, CycleStatus, Farm
    from app.farmer.models import Farmer, Location

    pairs = (
        await session.execute(
            select(Crop.market_commodity, Location.state)
            .join(CropCycle, CropCycle.crop_id == Crop.id)
            .join(Farm, Farm.id == CropCycle.farm_id)
            .join(Farmer, Farmer.id == Farm.farmer_id)
            .join(Location, Location.id == Farmer.location_id)
            .where(CropCycle.status == CycleStatus.ACTIVE, Crop.market_commodity.is_not(None))
            .distinct()
        )
    ).all()
    refreshed = 0
    for commodity, state in pairs:
        try:
            await current_prices(session, commodity, state)
            refreshed += 1
        except ServiceUnavailable:
            break  # the upstream is down or rate-limiting; try again next round
    return refreshed


async def price_history(
    session: AsyncSession, commodity: str, state: str | None, days: int
) -> PriceHistory:
    since = date.today() - timedelta(days=days)
    query = (
        select(
            MarketPrice.arrival_date,
            func.avg(MarketPrice.modal_price),
            func.min(MarketPrice.min_price),
            func.max(MarketPrice.max_price),
            func.count(func.distinct(MarketPrice.market_id)),
        )
        .join(Market)
        .where(MarketPrice.commodity == commodity, MarketPrice.arrival_date >= since)
        .group_by(MarketPrice.arrival_date)
        .order_by(MarketPrice.arrival_date)
    )
    if state:
        query = query.where(Market.state == state)
    rows = await session.execute(query)
    return PriceHistory(
        commodity=commodity,
        state=state,
        points=[
            HistoryPoint(
                date=d, avg_modal_price=round(avg, 2), min_price=lo, max_price=hi, markets=n
            )
            for d, avg, lo, hi, n in rows.all()
        ],
    )


async def import_prices(
    session: AsyncSession, observations: list[PriceObservation], source: str
) -> int:
    """Store imported observations; duplicates of rows already stored are ignored."""
    for start in range(0, len(observations), 1000):  # bounded statement size
        await _store(session, observations[start : start + 1000], source)
    return len(observations)
