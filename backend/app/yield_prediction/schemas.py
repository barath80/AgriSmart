from pydantic import BaseModel, Field

from app.farm.models import Season


class YieldRequest(BaseModel):
    crop: str = Field(max_length=48)
    area_acres: float = Field(gt=0, le=10_000)
    season: Season | None = None
    state: str | None = Field(None, max_length=64)
    annual_rainfall_mm: float | None = Field(None, ge=0, le=6000)
    fertilizer_kg_per_acre: float | None = Field(None, ge=0, le=2000)
    pesticide_kg_per_acre: float | None = Field(None, ge=0, le=200)


class YieldResponse(BaseModel):
    model_version: str
    crop: str
    crop_name: str
    expected_q_per_acre: float
    low_q_per_acre: float
    high_q_per_acre: float
    expected_total_quintals: float
    low_total_quintals: float
    high_total_quintals: float
    assumptions: dict[str, float | str]  # inputs filled from training-data medians
    warnings: list[str]
