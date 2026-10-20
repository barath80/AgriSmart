import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Query, status
from pydantic import BaseModel

from app.auth.dependencies import CurrentFarmer, DbSession
from app.calendar import service
from app.core.errors import InvalidInput, NotFound, ServiceUnavailable
from app.weather.schemas import WeatherAlert
from app.weather.service import get_report

router = APIRouter(prefix="/calendar", tags=["calendar"])


class CalendarEventOut(BaseModel):
    id: uuid.UUID
    crop_slug: str
    event_type: str
    detail_key: str
    scheduled_on: date
    window_days: int
    done: bool


class CalendarView(BaseModel):
    events: list[CalendarEventOut]
    weather_alerts: list[WeatherAlert]


class EventDoneUpdate(BaseModel):
    done: bool


@router.get("")
async def get_calendar(
    farmer: CurrentFarmer,
    session: DbSession,
    start: date | None = Query(None, alias="from"),
    end: date | None = Query(None, alias="to"),
) -> CalendarView:
    start = start or date.today()
    end = end or start + timedelta(days=30)
    if end < start or (end - start).days > 366:
        raise InvalidInput("Choose a range of at most one year", code="invalid_date_range")

    rows = await service.list_events(session, farmer.id, start, end)
    events = [
        CalendarEventOut(
            id=e.id,
            crop_slug=slug,
            event_type=e.event_type,
            detail_key=e.detail_key,
            scheduled_on=e.scheduled_on,
            window_days=e.window_days,
            done=e.done,
        )
        for e, slug in rows
    ]

    alerts: list[WeatherAlert] = []
    location = farmer.location
    if location and location.latitude is not None and location.longitude is not None:
        fertilizer_dates = await service.upcoming_fertilizer_dates(session, farmer.id)
        try:
            report = await get_report(
                session, location.latitude, location.longitude, fertilizer_dates=fertilizer_dates
            )
            alerts = report.alerts
        except ServiceUnavailable:
            pass  # the calendar stays useful even if the weather API is down
    return CalendarView(events=events, weather_alerts=alerts)


@router.patch("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def set_event_done(
    event_id: uuid.UUID, body: EventDoneUpdate, farmer: CurrentFarmer, session: DbSession
) -> None:
    if not await service.mark_done(session, farmer.id, event_id, body.done):
        raise NotFound("Event not found", code="event_not_found")
