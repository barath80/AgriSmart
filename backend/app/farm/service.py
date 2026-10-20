import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.calendar.service import generate_events_for_cycle
from app.core.errors import NotFound
from app.crop.service import get_crop
from app.farm.models import CropCycle, Farm, SoilRecord
from app.farm.schemas import CropCycleIn, CropCycleOut, CropCycleStatusUpdate, FarmIn, SoilRecordIn
from app.farmer.models import Farmer


async def list_farms(session: AsyncSession, farmer: Farmer) -> list[Farm]:
    return list(await session.scalars(select(Farm).where(Farm.farmer_id == farmer.id)))


async def get_owned_farm(session: AsyncSession, farmer: Farmer, farm_id: uuid.UUID) -> Farm:
    """Ownership is checked on every access — a farmer can never touch another's farm."""
    farm = await session.scalar(select(Farm).where(Farm.id == farm_id, Farm.farmer_id == farmer.id))
    if farm is None:
        raise NotFound("Farm not found", code="farm_not_found")
    return farm


async def create_farm(session: AsyncSession, farmer: Farmer, data: FarmIn) -> Farm:
    farm = Farm(farmer_id=farmer.id, location_id=farmer.location_id, **data.model_dump())
    session.add(farm)
    await session.commit()
    return farm


async def update_farm(session: AsyncSession, farm: Farm, data: FarmIn) -> Farm:
    for key, value in data.model_dump().items():
        setattr(farm, key, value)
    await session.commit()
    return farm


async def add_soil_record(session: AsyncSession, farm: Farm, data: SoilRecordIn) -> SoilRecord:
    record = SoilRecord(farm_id=farm.id, source="manual", **data.model_dump())
    session.add(record)
    await session.commit()
    return record


async def list_soil_records(session: AsyncSession, farm: Farm) -> list[SoilRecord]:
    return list(
        await session.scalars(
            select(SoilRecord)
            .where(SoilRecord.farm_id == farm.id)
            .order_by(SoilRecord.tested_on.desc())
        )
    )


async def start_crop_cycle(
    session: AsyncSession, farmer: Farmer, farm: Farm, data: CropCycleIn
) -> CropCycle:
    crop = await get_crop(session, data.crop_slug)
    cycle = CropCycle(
        farm_id=farm.id,
        crop_id=crop.id,
        season=data.season,
        sowing_date=data.sowing_date,
        area_acres=data.area_acres,
    )
    cycle.crop = crop
    session.add(cycle)
    await session.flush()
    generate_events_for_cycle(
        session, farmer.id, cycle, crop, irrigated=farm.irrigation.is_irrigated
    )
    await session.commit()
    return cycle


async def list_cycles(session: AsyncSession, farmer: Farmer) -> list[CropCycle]:
    return list(
        await session.scalars(
            select(CropCycle)
            .join(Farm, Farm.id == CropCycle.farm_id)
            .where(Farm.farmer_id == farmer.id)
            .order_by(CropCycle.sowing_date.desc())
        )
    )


async def update_cycle_status(
    session: AsyncSession, farmer: Farmer, cycle_id: uuid.UUID, data: CropCycleStatusUpdate
) -> CropCycle:
    cycle = await session.scalar(
        select(CropCycle)
        .join(Farm, Farm.id == CropCycle.farm_id)
        .where(CropCycle.id == cycle_id, Farm.farmer_id == farmer.id)
    )
    if cycle is None:
        raise NotFound("Crop cycle not found", code="cycle_not_found")
    cycle.status = data.status
    if data.actual_yield_quintals is not None:
        cycle.actual_yield_quintals = data.actual_yield_quintals
    await session.commit()
    return cycle


def to_cycle_out(cycle: CropCycle) -> CropCycleOut:
    return CropCycleOut(
        id=cycle.id,
        farm_id=cycle.farm_id,
        crop_slug=cycle.crop.slug,
        season=cycle.season,
        sowing_date=cycle.sowing_date,
        area_acres=cycle.area_acres,
        status=cycle.status,
    )
