import uuid

from fastapi import APIRouter, status

from app.auth.dependencies import CurrentFarmer, DbSession
from app.farm import service
from app.farm.schemas import (
    CropCycleIn,
    CropCycleOut,
    CropCycleStatusUpdate,
    FarmIn,
    FarmOut,
    SoilRecordIn,
    SoilRecordOut,
)

router = APIRouter(prefix="/farms", tags=["farm"])


@router.get("")
async def list_farms(farmer: CurrentFarmer, session: DbSession) -> list[FarmOut]:
    return [FarmOut.model_validate(f) for f in await service.list_farms(session, farmer)]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_farm(body: FarmIn, farmer: CurrentFarmer, session: DbSession) -> FarmOut:
    return FarmOut.model_validate(await service.create_farm(session, farmer, body))


@router.put("/{farm_id}")
async def update_farm(
    farm_id: uuid.UUID, body: FarmIn, farmer: CurrentFarmer, session: DbSession
) -> FarmOut:
    farm = await service.get_owned_farm(session, farmer, farm_id)
    return FarmOut.model_validate(await service.update_farm(session, farm, body))


@router.get("/{farm_id}/soil")
async def list_soil(
    farm_id: uuid.UUID, farmer: CurrentFarmer, session: DbSession
) -> list[SoilRecordOut]:
    farm = await service.get_owned_farm(session, farmer, farm_id)
    return [SoilRecordOut.model_validate(r) for r in await service.list_soil_records(session, farm)]


@router.post("/{farm_id}/soil", status_code=status.HTTP_201_CREATED)
async def add_soil(
    farm_id: uuid.UUID, body: SoilRecordIn, farmer: CurrentFarmer, session: DbSession
) -> SoilRecordOut:
    farm = await service.get_owned_farm(session, farmer, farm_id)
    return SoilRecordOut.model_validate(await service.add_soil_record(session, farm, body))


@router.get("/cycles")
async def list_cycles(farmer: CurrentFarmer, session: DbSession) -> list[CropCycleOut]:
    return [service.to_cycle_out(c) for c in await service.list_cycles(session, farmer)]


@router.post("/{farm_id}/cycles", status_code=status.HTTP_201_CREATED)
async def start_cycle(
    farm_id: uuid.UUID, body: CropCycleIn, farmer: CurrentFarmer, session: DbSession
) -> CropCycleOut:
    farm = await service.get_owned_farm(session, farmer, farm_id)
    cycle = await service.start_crop_cycle(session, farmer, farm, body)
    return service.to_cycle_out(cycle)


@router.patch("/cycles/{cycle_id}")
async def update_cycle(
    cycle_id: uuid.UUID, body: CropCycleStatusUpdate, farmer: CurrentFarmer, session: DbSession
) -> CropCycleOut:
    return service.to_cycle_out(await service.update_cycle_status(session, farmer, cycle_id, body))
