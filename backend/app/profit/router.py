from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.auth.dependencies import CurrentFarmer
from app.profit.calculator import DEFAULT_SCENARIOS, FarmEconomics, apply_scenario

router = APIRouter(prefix="/profit", tags=["profit"])

Money = Field(0, ge=0, le=1e9)


class CostInputs(BaseModel):
    """Total ₹ for the whole area."""

    seeds: float = Money
    fertilizer: float = Money
    labour: float = Money
    irrigation: float = Money
    machinery: float = Money
    transport: float = Money
    other: float = Money


class ProfitRequest(BaseModel):
    crop: str | None = Field(None, max_length=48)
    area_acres: float = Field(gt=0, le=10_000)
    expected_yield_q_per_acre: float = Field(ge=0, le=2000)
    expected_price_per_quintal: float = Field(ge=0, le=1e6)
    costs: CostInputs


class ProfitSummary(BaseModel):
    production_quintals: float
    revenue: float
    total_cost: float
    profit: float
    margin_pct: float | None


class ScenarioResult(ProfitSummary):
    key: str


class ProfitResponse(ProfitSummary):
    cost_breakdown: dict[str, float]
    break_even_price_per_quintal: float | None
    break_even_yield_q_per_acre: float | None
    scenarios: list[ScenarioResult]


def _summary(e: FarmEconomics) -> dict:
    return {
        "production_quintals": round(e.production_quintals, 2),
        "revenue": round(e.revenue, 2),
        "total_cost": round(e.total_cost, 2),
        "profit": round(e.profit, 2),
        "margin_pct": round(e.margin_pct, 1) if e.margin_pct is not None else None,
    }


@router.post("/calculate")
async def calculate(body: ProfitRequest, _: CurrentFarmer) -> ProfitResponse:
    base = FarmEconomics(
        area_acres=body.area_acres,
        yield_q_per_acre=body.expected_yield_q_per_acre,
        price_per_quintal=body.expected_price_per_quintal,
        costs=body.costs.model_dump(),
    )
    return ProfitResponse(
        **_summary(base),
        cost_breakdown=body.costs.model_dump(),
        break_even_price_per_quintal=round(base.break_even_price, 2)
        if base.break_even_price
        else None,
        break_even_yield_q_per_acre=round(base.break_even_yield, 2)
        if base.break_even_yield
        else None,
        scenarios=[
            ScenarioResult(key=s.key, **_summary(apply_scenario(base, s)))
            for s in DEFAULT_SCENARIOS
        ],
    )
