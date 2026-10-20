import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.farm.models import Irrigation, Season, SoilType


class CropInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    names: dict[str, str]
    aliases: list[str]
    category: str
    seasons: list[str]
    duration_days_min: int
    duration_days_max: int
    water_requirement: str
    suitable_soils: list[str]
    fertilizer_guidance: str
    yield_min_q_per_acre: float
    yield_max_q_per_acre: float
    market_commodity: str | None
    growing_states: list[str] = []
    min_elevation_m: int | None = None


class CropRecommendationRequest(BaseModel):
    """Every field is optional: missing values come from the farmer's soil test, farm and
    local weather. The response reports exactly which values were used."""

    farm_id: uuid.UUID | None = None
    nitrogen: float | None = Field(None, ge=0, le=1000)
    phosphorus: float | None = Field(None, ge=0, le=500)
    potassium: float | None = Field(None, ge=0, le=1500)
    ph: float | None = Field(None, ge=3, le=10)
    temperature: float | None = Field(None, ge=-5, le=55)
    humidity: float | None = Field(None, ge=0, le=100)
    rainfall: float | None = Field(None, ge=0, le=5000, description="Seasonal rainfall, mm")
    soil_type: SoilType | None = None
    season: Season | None = None
    irrigation: Irrigation | None = None
    previous_crop: str | None = Field(None, max_length=48)


class CropOption(BaseModel):
    crop: str
    name: str
    model_probability: float | None  # soil/climate model; None for crops it does not cover
    regional_share: float | None = None  # share of the region's cropped area this season
    score: float  # combined suitability, 0–1 across all candidate crops
    # off_season, water_risk, soil_mismatch, rotation, uncommon_in_region, needs_hills
    reasons: list[str]
    duration_days: tuple[int, int] | None = None
    water_requirement: str | None = None
    expected_yield_q_per_acre: tuple[float, float] | None = None


class CropRecommendationResponse(BaseModel):
    model_version: str
    recommended: CropOption
    alternatives: list[CropOption]
    inputs_used: dict[str, float | str | None]
    warnings: list[str]
