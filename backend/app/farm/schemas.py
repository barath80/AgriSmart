import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.farm.models import CycleStatus, Irrigation, Season, SoilType


class FarmIn(BaseModel):
    name: str = Field("", max_length=80)
    area_acres: float = Field(gt=0, le=10_000)
    soil_type: SoilType | None = None
    irrigation: Irrigation = Irrigation.RAINFED


class FarmOut(FarmIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


class SoilRecordIn(BaseModel):
    nitrogen: float = Field(ge=0, le=1000, description="kg/ha")
    phosphorus: float = Field(ge=0, le=500, description="kg/ha")
    potassium: float = Field(ge=0, le=1500, description="kg/ha")
    ph: float = Field(ge=3, le=10)
    organic_carbon: float | None = Field(None, ge=0, le=10)
    tested_on: date


class SoilRecordOut(SoilRecordIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    farm_id: uuid.UUID
    source: str


class CropCycleIn(BaseModel):
    crop_slug: str = Field(max_length=48)
    season: Season
    sowing_date: date
    area_acres: float = Field(gt=0, le=10_000)


class CropCycleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    farm_id: uuid.UUID
    crop_slug: str
    season: Season
    sowing_date: date
    area_acres: float
    status: CycleStatus


class CropCycleStatusUpdate(BaseModel):
    status: CycleStatus
    actual_yield_quintals: float | None = Field(None, ge=0)
