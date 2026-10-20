import time
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.concurrency import run_cpu_bound
from app.core.errors import InvalidInput, NotFound, ServiceUnavailable
from app.core.language import Language, localized
from app.core.observability import Timer, metrics
from app.crop.models import Crop, CropRecommendation
from app.crop.rules import FarmConditions, adjust
from app.crop.schemas import (
    CropInfo,
    CropOption,
    CropRecommendationRequest,
    CropRecommendationResponse,
)
from app.farm.models import Season
from app.farmer.context import FarmerContext
from app.ml.registry import ModelName, registry
from app.weather.service import get_report

_CATALOG_TTL_SECONDS = 300
# Water an irrigated farm can count on, expressed as the rainfall the model understands.
IRRIGATED_WATER_MM = 200.0
# Below 1 flattens the synthetic dataset's near-certain probabilities before combining.
LIKELIHOOD_TEMPER = 0.5
# Regional prior for a tracked crop with no recorded area in the farmer's state/season.
ABSENT_SHARE = 0.002
# Crops the government area statistics do not track at all (fruit, vegetables, coffee):
# the curated growing-states list stands in for the missing statistics.
UNTRACKED_SHARE_IN_STATE = 0.05
AREA_STATISTICS_CROPS = frozenset(
    {
        "rice",
        "wheat",
        "maize",
        "bajra",
        "jowar",
        "ragi",
        "chickpea",
        "pigeon_pea",
        "green_gram",
        "black_gram",
        "lentil",
        "moth_bean",
        "groundnut",
        "soybean",
        "mustard",
        "sugarcane",
        "onion",
        "potato",
        "banana",
        "cotton",
        "jute",
        "coconut",
    }
)
_catalog: dict[str, CropInfo] = {}
_catalog_loaded_at = 0.0


async def crop_catalog(session: AsyncSession) -> dict[str, CropInfo]:
    """Crop metadata changes rarely and is read constantly — cache it per process."""
    global _catalog, _catalog_loaded_at
    if not _catalog or time.monotonic() - _catalog_loaded_at > _CATALOG_TTL_SECONDS:
        crops = await session.scalars(select(Crop).order_by(Crop.slug))
        _catalog = {c.slug: CropInfo.model_validate(c) for c in crops}
        _catalog_loaded_at = time.monotonic()
    return _catalog


def invalidate_catalog() -> None:
    global _catalog_loaded_at
    _catalog_loaded_at = 0.0


async def get_crop(session: AsyncSession, slug: str) -> Crop:
    crop = await session.scalar(select(Crop).where(Crop.slug == slug))
    if crop is None:
        raise NotFound(f"Unknown crop '{slug}'", code="crop_not_found")
    return crop


def season_for(day: date) -> Season:
    """Indian cropping seasons: Kharif (Jun–Oct), Rabi (Nov–Mar), Zaid (Apr–May)."""
    if 6 <= day.month <= 10:
        return Season.KHARIF
    if day.month >= 11 or day.month <= 3:
        return Season.RABI
    return Season.ZAID


async def recommend(
    session: AsyncSession, ctx: FarmerContext, request: CropRecommendationRequest
) -> CropRecommendationResponse:
    farm = ctx.primary_farm
    if request.farm_id is not None:
        farm = next((f for f in ctx.farms if f.id == request.farm_id), None)
        if farm is None:
            raise NotFound("Farm not found", code="farm_not_found")

    soil = ctx.latest_soil
    features = {
        "nitrogen": request.nitrogen if request.nitrogen is not None else soil and soil.nitrogen,
        "phosphorus": request.phosphorus
        if request.phosphorus is not None
        else soil and soil.phosphorus,
        "potassium": request.potassium
        if request.potassium is not None
        else soil and soil.potassium,
        "ph": request.ph if request.ph is not None else soil and soil.ph,
        "temperature": request.temperature,
        "humidity": request.humidity,
        "rainfall": request.rainfall,
    }
    if any(features[k] is None for k in ("nitrogen", "phosphorus", "potassium", "ph")):
        raise InvalidInput("A soil test (N, P, K, pH) is needed", code="soil_data_required")

    climate_needed = any(features[k] is None for k in ("temperature", "humidity", "rainfall"))
    report = None
    if ctx.coordinates is not None:
        try:
            report = await get_report(session, *ctx.coordinates)
        except ServiceUnavailable:
            if climate_needed:
                raise
            # Climate given by the caller; only elevation is lost, which is optional.
    if climate_needed:
        if report is None:
            raise InvalidInput("Location is needed for local climate", code="location_required")
        # Season averages match what the model learned; the live reading is only a fallback.
        if features["temperature"] is None:
            features["temperature"] = (
                report.temperature_mean_90_days_c or report.current.temperature_c
            )
        if features["humidity"] is None:
            features["humidity"] = report.humidity_mean_90_days_pct or report.current.humidity_pct
        if features["rainfall"] is None:
            features["rainfall"] = report.rainfall_last_90_days_mm

    irrigation = request.irrigation or (farm.irrigation if farm else None)
    observed_rainfall = features["rainfall"]
    if irrigation is not None and irrigation.is_irrigated:
        # The training data only knows rain. On an irrigated farm water is not limited to
        # rainfall, so the model is asked about a well-watered season (shown in inputs_used).
        features["rainfall"] = max(features["rainfall"], IRRIGATED_WATER_MM)

    season = request.season or season_for(date.today())
    state = ctx.location.state if ctx.location else None
    version, model = await registry.classifier(ModelName.CROP)
    prior = _regional_prior(model.metadata, state, season)
    conditions = FarmConditions(
        season=season,
        irrigation=irrigation,
        soil_type=request.soil_type or (farm.soil_type if farm else None),
        rainfall_mm=observed_rainfall,
        previous_crop=request.previous_crop,
        # Regional planting data already answers "is it grown here"; the coarse
        # growing-states rule is only the fallback for regions without data.
        state=None if prior else state,
        elevation_m=report.elevation_m if report else None,
    )

    with Timer() as timer:
        predictions = await run_cpu_bound(model.predict, features, top_k=len(model.labels))
    metrics.observe_ms("model_inference", "crop", timer.ms)

    warnings = _out_of_range_warnings(model.metadata.get("feature_ranges", {}), features)
    catalog = await crop_catalog(session)
    options = _rank(predictions, catalog, conditions, ctx.language, prior, state)
    if not options:
        raise NotFound("No suitable crop found", code="no_recommendation")

    inputs_used: dict[str, float | str | None] = {
        **{k: round(float(v), 2) for k, v in features.items()},
        "rainfall_observed": round(float(observed_rainfall), 2),
        "season": season.value,
        "state": state,
        "regional_data": "yes" if prior else "no",
        "elevation_m": conditions.elevation_m,
        "irrigation": irrigation.value if irrigation else None,
        "soil_type": conditions.soil_type.value if conditions.soil_type else None,
    }
    session.add(
        CropRecommendation(
            farmer_id=ctx.farmer.id,
            model_version=version,
            inputs=inputs_used,
            recommended_crop=options[0].crop,
            confidence=options[0].score,
            alternatives=[o.model_dump(mode="json") for o in options[1:]],
            latency_ms=timer.ms,
        )
    )
    await session.commit()
    return CropRecommendationResponse(
        model_version=version,
        recommended=options[0],
        alternatives=options[1:4],
        inputs_used=inputs_used,
        warnings=warnings,
    )


def _in_states(state: str | None, states: list[str]) -> bool:
    key = "".join((state or "").casefold().split())
    return any("".join(s.casefold().split()) == key for s in states)


def _regional_prior(metadata: dict, state: str | None, season: Season) -> dict[str, float]:
    """Share of cropped area per crop in the farmer's state and season (government
    statistics shipped with the model), or {} when there is no data for that region."""
    by_state = (metadata.get("regional_prior") or {}).get(state or "", {})
    key = Season.KHARIF.value if season is Season.WHOLE_YEAR else season.value
    return by_state.get(key, {})


def _rank(
    predictions,
    catalog: dict[str, CropInfo],
    conditions: FarmConditions,
    language: Language,
    prior: dict[str, float],
    state: str | None = None,
) -> list[CropOption]:
    """score = soil/climate fit x regional prior x agronomic rules, over the whole catalog.

    The model was trained on balanced classes, so its probability acts as the likelihood
    of these soil and climate readings for each crop; multiplying by how much of the
    region's area the crop occupies gives the posterior. The synthetic training data makes
    the model over-confident, so probabilities are tempered first. Crops the model does
    not cover (e.g. wheat) get a neutral likelihood and are ranked by region and rules.
    """
    tempered = {p.label: (p.probability + 1e-4) ** LIKELIHOOD_TEMPER for p in predictions}
    mean = sum(tempered.values()) / len(tempered) if tempered else 1.0
    probability = {p.label: p.probability for p in predictions}
    options = []
    for info in catalog.values():
        likelihood = tempered[info.slug] / mean if info.slug in tempered else 1.0
        if prior:
            if info.slug in AREA_STATISTICS_CROPS:
                regional = prior.get(info.slug, ABSENT_SHARE)
            else:
                # Untracked crops (fruit, coffee, vegetables) are not "never grown here":
                # use the curated main-states list instead of the missing statistics.
                grown_here = not info.growing_states or _in_states(state, info.growing_states)
                regional = UNTRACKED_SHARE_IN_STATE if grown_here else ABSENT_SHARE
        else:
            regional = 1.0
        adjustment = adjust(info, conditions)
        options.append(
            CropOption(
                crop=info.slug,
                name=localized(info.names, language),
                model_probability=round(probability[info.slug], 4)
                if info.slug in probability
                else None,
                regional_share=round(prior[info.slug], 4) if info.slug in prior else None,
                score=likelihood * regional * adjustment.factor,
                reasons=adjustment.reasons,
                duration_days=(info.duration_days_min, info.duration_days_max),
                water_requirement=info.water_requirement,
                expected_yield_q_per_acre=(info.yield_min_q_per_acre, info.yield_max_q_per_acre),
            )
        )
    total = sum(o.score for o in options) or 1.0
    for option in options:
        option.score = round(option.score / total, 4)
    return sorted(options, key=lambda o: o.score, reverse=True)


def _out_of_range_warnings(ranges: dict[str, list[float]], features: dict) -> list[str]:
    """Flag inputs outside what the model saw in training — predictions there are guesses."""
    return [
        f"{name}_outside_training_range"
        for name, (low, high) in ranges.items()
        if name in features and not (low <= features[name] <= high)
    ]
