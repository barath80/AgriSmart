from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.concurrency import run_cpu_bound
from app.core.errors import InvalidInput
from app.core.language import localized
from app.core.observability import Timer, metrics
from app.crop.service import crop_catalog, season_for
from app.farmer.context import FarmerContext
from app.ml.registry import ModelName, registry
from app.yield_prediction.models import YieldPrediction
from app.yield_prediction.schemas import YieldRequest, YieldResponse

ACRES_PER_HECTARE = 2.47105
# The model predicts tonnes/hectare; farmers think in quintals/acre.
T_PER_HA_TO_Q_PER_ACRE = 10 / ACRES_PER_HECTARE


def _per_ha(value_per_acre: float) -> float:
    return value_per_acre * ACRES_PER_HECTARE


async def predict(
    session: AsyncSession, ctx: FarmerContext, request: YieldRequest
) -> YieldResponse:
    catalog = await crop_catalog(session)
    crop = catalog.get(request.crop)
    if crop is None:
        raise InvalidInput(f"Unknown crop '{request.crop}'", code="crop_not_found")

    version, model = await registry.regressor(ModelName.YIELD)
    metadata = model.metadata
    supported = metadata["features"]["categorical"]["crop"]
    if request.crop not in supported:
        raise InvalidInput(
            "Yield estimates are not available for this crop yet",
            code="yield_crop_unsupported",
            supported=supported,
        )

    state = request.state or (ctx.location.state if ctx.location else None)
    if state is None:
        raise InvalidInput("State is needed for a yield estimate", code="location_required")
    season = request.season or season_for(date.today())
    defaults = metadata.get("defaults", {})
    assumptions: dict[str, float | str] = {}

    def pick(name: str, given: float | None, default_key: str) -> float:
        if given is not None:
            return given
        table = defaults.get(name, {})
        value = table.get(default_key, table.get("__all__"))
        if value is None:
            raise InvalidInput(f"'{name}' is required", code="yield_input_required", field=name)
        assumptions[name] = round(value, 2)
        return value

    features = {
        "crop": request.crop,
        "season": season.value,
        "state": state,
        "crop_year": date.today().year,
        "annual_rainfall": pick("annual_rainfall", request.annual_rainfall_mm, state),
        "fertilizer_per_ha": pick(
            "fertilizer_per_ha",
            _per_ha(request.fertilizer_kg_per_acre)
            if request.fertilizer_kg_per_acre is not None
            else None,
            request.crop,
        ),
        "pesticide_per_ha": pick(
            "pesticide_per_ha",
            _per_ha(request.pesticide_kg_per_acre)
            if request.pesticide_kg_per_acre is not None
            else None,
            request.crop,
        ),
    }

    with Timer() as timer:
        quantiles = await run_cpu_bound(model.predict, features)
    metrics.observe_ms("model_inference", "yield", timer.ms)

    low, mid, high = (quantiles[q] * T_PER_HA_TO_Q_PER_ACRE for q in sorted(quantiles))
    warnings = []
    if state not in metadata["features"]["categorical"].get("state", []):
        warnings.append("state_not_in_training_data")
    if not (crop.yield_min_q_per_acre * 0.5 <= mid <= crop.yield_max_q_per_acre * 1.5):
        warnings.append("estimate_outside_typical_range")

    session.add(
        YieldPrediction(
            farmer_id=ctx.farmer.id,
            crop_slug=request.crop,
            model_version=version,
            inputs={**features, "area_acres": request.area_acres},
            expected_q_per_acre=mid,
            low_q_per_acre=low,
            high_q_per_acre=high,
            latency_ms=timer.ms,
        )
    )
    await session.commit()

    return YieldResponse(
        model_version=version,
        crop=request.crop,
        crop_name=localized(crop.names, ctx.language),
        expected_q_per_acre=round(mid, 2),
        low_q_per_acre=round(low, 2),
        high_q_per_acre=round(high, 2),
        expected_total_quintals=round(mid * request.area_acres, 1),
        low_total_quintals=round(low * request.area_acres, 1),
        high_total_quintals=round(high * request.area_acres, 1),
        assumptions=assumptions,
        warnings=warnings,
    )
