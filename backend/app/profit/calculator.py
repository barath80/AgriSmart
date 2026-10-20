"""Profit/loss arithmetic. Deterministic by design — there is nothing here to "predict"."""

from dataclasses import dataclass

COST_HEADS = ("seeds", "fertilizer", "labour", "irrigation", "machinery", "transport", "other")


@dataclass(frozen=True, slots=True)
class FarmEconomics:
    area_acres: float
    yield_q_per_acre: float
    price_per_quintal: float
    costs: dict[str, float]  # totals for the whole area, ₹, keyed by COST_HEADS

    @property
    def production_quintals(self) -> float:
        return self.area_acres * self.yield_q_per_acre

    @property
    def revenue(self) -> float:
        return self.production_quintals * self.price_per_quintal

    @property
    def total_cost(self) -> float:
        return sum(self.costs.get(head, 0.0) for head in COST_HEADS)

    @property
    def profit(self) -> float:
        return self.revenue - self.total_cost

    @property
    def margin_pct(self) -> float | None:
        return self.profit / self.revenue * 100 if self.revenue else None

    @property
    def break_even_price(self) -> float | None:
        """Minimum selling price per quintal that covers all costs."""
        return self.total_cost / self.production_quintals if self.production_quintals else None

    @property
    def break_even_yield(self) -> float | None:
        """Minimum yield (q/acre) that covers all costs at the expected price."""
        denominator = self.area_acres * self.price_per_quintal
        return self.total_cost / denominator if denominator else None


@dataclass(frozen=True, slots=True)
class Scenario:
    key: str
    price_change: float = 0.0
    yield_change: float = 0.0
    cost_changes: tuple[tuple[str, float], ...] = ()


DEFAULT_SCENARIOS = (
    Scenario("price_down_10", price_change=-0.10),
    Scenario("price_down_20", price_change=-0.20),
    Scenario("yield_down_10", yield_change=-0.10),
    Scenario("yield_down_25", yield_change=-0.25),
    Scenario("fertilizer_cost_up_20", cost_changes=(("fertilizer", 0.20),)),
    Scenario("labour_cost_up_15", cost_changes=(("labour", 0.15),)),
    Scenario("labour_cost_down_10", cost_changes=(("labour", -0.10),)),
    Scenario(
        "worst_case",
        price_change=-0.20,
        yield_change=-0.25,
        cost_changes=(("fertilizer", 0.20), ("labour", 0.15)),
    ),
)


def apply_scenario(base: FarmEconomics, scenario: Scenario) -> FarmEconomics:
    costs = dict(base.costs)
    for head, change in scenario.cost_changes:
        costs[head] = costs.get(head, 0.0) * (1 + change)
    return FarmEconomics(
        area_acres=base.area_acres,
        yield_q_per_acre=base.yield_q_per_acre * (1 + scenario.yield_change),
        price_per_quintal=base.price_per_quintal * (1 + scenario.price_change),
        costs=costs,
    )
