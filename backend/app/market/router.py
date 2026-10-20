from fastapi import APIRouter, Query

from app.auth.dependencies import CurrentFarmer, DbSession
from app.market import service
from app.market.schemas import CurrentPrices, PriceHistory

router = APIRouter(prefix="/market", tags=["market"])

Commodity = Query(
    min_length=2, max_length=80, description="Agmarknet commodity name, e.g. 'Tomato'"
)


@router.get("/prices")
async def current_prices(
    farmer: CurrentFarmer,
    session: DbSession,
    commodity: str = Commodity,
    state: str | None = Query(None, max_length=64),
) -> CurrentPrices:
    location = farmer.location
    state = state or (location.state if location else None)
    return await service.current_prices(
        session, commodity, state, location.district if location else None
    )


@router.get("/history")
async def history(
    farmer: CurrentFarmer,
    session: DbSession,
    commodity: str = Commodity,
    state: str | None = Query(None, max_length=64),
    days: int = Query(90, ge=7, le=730),
) -> PriceHistory:
    state = state or (farmer.location.state if farmer.location else None)
    return await service.price_history(session, commodity, state, days)
