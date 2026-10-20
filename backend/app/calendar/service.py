import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.calendar.models import CalendarEvent
from app.calendar.rules import expand_template
from app.crop.models import Crop
from app.farm.models import CropCycle


def generate_events_for_cycle(
    session: AsyncSession,
    farmer_id: uuid.UUID,
    cycle: CropCycle,
    crop: Crop,
    *,
    irrigated: bool = True,
) -> list[CalendarEvent]:
    events = [
        CalendarEvent(
            farmer_id=farmer_id,
            crop_cycle_id=cycle.id,
            event_type=planned.event_type,
            detail_key=planned.detail_key,
            scheduled_on=planned.scheduled_on,
            window_days=planned.window_days,
        )
        for planned in expand_template(
            crop.calendar_template, cycle.sowing_date, irrigated=irrigated
        )
    ]
    session.add_all(events)
    return events


async def list_events(
    session: AsyncSession, farmer_id: uuid.UUID, start: date, end: date
) -> list[tuple[CalendarEvent, str]]:
    """Events in [start, end] with their crop slug."""
    rows = await session.execute(
        select(CalendarEvent, Crop.slug)
        .join(CropCycle, CropCycle.id == CalendarEvent.crop_cycle_id)
        .join(Crop, Crop.id == CropCycle.crop_id)
        .where(
            CalendarEvent.farmer_id == farmer_id,
            CalendarEvent.scheduled_on >= start,
            CalendarEvent.scheduled_on <= end,
        )
        .order_by(CalendarEvent.scheduled_on)
    )
    return [(event, slug) for event, slug in rows.all()]


async def upcoming_fertilizer_dates(
    session: AsyncSession, farmer_id: uuid.UUID, days: int = 7
) -> list[date]:
    today = date.today()
    result = await session.scalars(
        select(CalendarEvent.scheduled_on).where(
            CalendarEvent.farmer_id == farmer_id,
            CalendarEvent.event_type == "fertilizer",
            CalendarEvent.done.is_(False),
            CalendarEvent.scheduled_on >= today,
            CalendarEvent.scheduled_on <= today + timedelta(days=days),
        )
    )
    return sorted(set(result))


async def mark_done(
    session: AsyncSession, farmer_id: uuid.UUID, event_id: uuid.UUID, done: bool
) -> bool:
    event = await session.scalar(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id, CalendarEvent.farmer_id == farmer_id
        )
    )
    if event is None:
        return False
    event.done = done
    await session.commit()
    return True
