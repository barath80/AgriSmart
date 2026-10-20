"""Everything the system knows about a farmer, gathered once per request.

AgriBrain tools and the eligibility engine read this instead of querying ad hoc.
"""

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.language import Language
from app.farm.models import CropCycle, CycleStatus, Farm, SoilRecord
from app.farmer.models import Channel, Farmer, Location


@dataclass(slots=True)
class FarmerContext:
    farmer: Farmer
    language: Language
    channel: Channel
    location: Location | None
    farms: list[Farm] = field(default_factory=list)
    latest_soil: SoilRecord | None = None
    active_cycles: list[CropCycle] = field(default_factory=list)

    @property
    def primary_farm(self) -> Farm | None:
        return self.farms[0] if self.farms else None

    @property
    def total_land_acres(self) -> float | None:
        return sum(f.area_acres for f in self.farms) if self.farms else None

    @property
    def coordinates(self) -> tuple[float, float] | None:
        if (
            self.location
            and self.location.latitude is not None
            and self.location.longitude is not None
        ):
            return self.location.latitude, self.location.longitude
        return None

    @property
    def age(self) -> int | None:
        return date.today().year - self.farmer.birth_year if self.farmer.birth_year else None

    @property
    def can_send_images(self) -> bool:
        """A basic phone cannot capture or upload photos — never pretend otherwise."""
        return self.channel is Channel.APP


async def load_farmer_context(
    session: AsyncSession, farmer: Farmer, *, channel: Channel, language: Language | None = None
) -> FarmerContext:
    farms = list(
        await session.scalars(
            select(Farm).where(Farm.farmer_id == farmer.id).order_by(Farm.area_acres.desc())
        )
    )
    farm_ids = [f.id for f in farms]
    latest_soil = None
    active_cycles: list[CropCycle] = []
    if farm_ids:
        latest_soil = await session.scalar(
            select(SoilRecord)
            .where(SoilRecord.farm_id.in_(farm_ids))
            .order_by(SoilRecord.tested_on.desc())
            .limit(1)
        )
        active_cycles = list(
            await session.scalars(
                select(CropCycle).where(
                    CropCycle.farm_id.in_(farm_ids), CropCycle.status == CycleStatus.ACTIVE
                )
            )
        )
    return FarmerContext(
        farmer=farmer,
        language=language or farmer.preferred_language,
        channel=channel,
        location=farmer.location,
        farms=farms,
        latest_soil=latest_soil,
        active_cycles=active_cycles,
    )
