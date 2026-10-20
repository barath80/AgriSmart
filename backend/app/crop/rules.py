"""Agronomic re-ranking of model output.

The ML model is trained on soil nutrients and climate only. Season, irrigation, soil type,
region and crop rotation are applied here as transparent, reviewable rules over crop metadata —
the model is never asked to guess facts it was not trained on.
"""

from dataclasses import dataclass, field

from app.crop.schemas import CropInfo
from app.farm.models import Irrigation, Season, SoilType

OFF_SEASON_FACTOR = 0.3
WATER_RISK_FACTOR = 0.5
SOIL_MISMATCH_FACTOR = 0.5
ROTATION_FACTOR = 0.8
REGION_FACTOR = 0.35
ELEVATION_FACTOR = 0.1
LOW_RAINFALL_MM = 100


@dataclass(slots=True)
class FarmConditions:
    season: Season | None = None
    irrigation: Irrigation | None = None
    soil_type: SoilType | None = None
    rainfall_mm: float | None = None
    previous_crop: str | None = None
    state: str | None = None  # set only when no regional planting data covers the farmer
    elevation_m: float | None = None


@dataclass(slots=True)
class Adjustment:
    factor: float = 1.0
    reasons: list[str] = field(default_factory=list)

    def apply(self, factor: float, reason: str) -> None:
        self.factor *= factor
        self.reasons.append(reason)


def _place(name: str) -> str:
    return "".join(name.casefold().split()).replace("&", "and")


def adjust(crop: CropInfo, conditions: FarmConditions) -> Adjustment:
    result = Adjustment()
    if (
        conditions.season
        and crop.seasons
        and conditions.season.value not in crop.seasons
        and Season.WHOLE_YEAR.value not in crop.seasons
    ):
        result.apply(OFF_SEASON_FACTOR, "off_season")
    if (
        crop.water_requirement == "high"
        and conditions.irrigation is Irrigation.RAINFED
        and (conditions.rainfall_mm is None or conditions.rainfall_mm < LOW_RAINFALL_MM)
    ):
        result.apply(WATER_RISK_FACTOR, "water_risk")
    if (
        conditions.soil_type
        and crop.suitable_soils
        and conditions.soil_type.value not in crop.suitable_soils
    ):
        result.apply(SOIL_MISMATCH_FACTOR, "soil_mismatch")
    if (
        conditions.state
        and crop.growing_states
        and _place(conditions.state) not in {_place(s) for s in crop.growing_states}
    ):
        result.apply(REGION_FACTOR, "uncommon_in_region")
    if (
        crop.min_elevation_m
        and conditions.elevation_m is not None
        and conditions.elevation_m < crop.min_elevation_m
    ):
        result.apply(ELEVATION_FACTOR, "needs_hills")
    if conditions.previous_crop and conditions.previous_crop == crop.slug:
        result.apply(ROTATION_FACTOR, "rotation")
    return result
