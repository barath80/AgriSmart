"""Targeted notifications.

Creating a notification fans out to `notification_deliveries` rows in one transaction.
The worker (`app.worker`) drains pending deliveries; `UNIQUE(notification_id, farmer_id)`
and the notification's idempotency key guarantee nobody is messaged twice, even if the
admin double-clicks or a worker crashes mid-batch.
"""

import logging
import uuid
from datetime import date, timedelta

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.calendar.models import CalendarEvent
from app.core.database import utcnow
from app.core.errors import ServiceUnavailable
from app.core.language import Language, localized
from app.crop.models import Crop
from app.farm.models import CropCycle, CycleStatus, Farm
from app.farmer.models import Channel, Farmer, Location
from app.farmer.service import voice_style
from app.language.templates import render
from app.notification.channels import DeliveryError, get_push_sender, get_sms_sender
from app.notification.models import (
    DeliveryStatus,
    Notification,
    NotificationCategory,
    NotificationDelivery,
)
from app.notification.schemas import NotificationIn, NotificationTarget
from app.voice.outbound import place_alert_call, voice_calls_enabled

logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 3


def _recipients_query(
    category: NotificationCategory,
    target: NotificationTarget,
    farmer_ids: list[uuid.UUID] | None = None,
):
    query = select(Farmer.id, Farmer.push_token, Farmer.primary_channel).outerjoin(
        Location, Location.id == Farmer.location_id
    )
    if target.states:
        query = query.where(Location.state.in_(target.states))
    if target.districts:
        query = query.where(Location.district.in_(target.districts))
    if target.languages:
        query = query.where(Farmer.preferred_language.in_(target.languages))
    if target.crops:
        growing = (
            select(Farm.farmer_id)
            .join(CropCycle, CropCycle.farm_id == Farm.id)
            .join(Crop, Crop.id == CropCycle.crop_id)
            .where(CropCycle.status == CycleStatus.ACTIVE, Crop.slug.in_(target.crops))
        )
        query = query.where(Farmer.id.in_(growing))
    if farmer_ids is not None:
        query = query.where(Farmer.id.in_(farmer_ids))
    return query


def _wants(preferences: dict, category: NotificationCategory) -> bool:
    if category is NotificationCategory.EMERGENCY:
        return True  # emergency alerts cannot be muted
    preference_key = {"scheme": "schemes"}.get(category.value, category.value)
    return bool((preferences or {}).get(preference_key, True))


async def create_notification(
    session: AsyncSession,
    data: NotificationIn,
    created_by: uuid.UUID | None,
    *,
    farmer_ids: list[uuid.UUID] | None = None,
) -> tuple[Notification, bool]:
    """Returns (notification, created). Re-submitting the same idempotency key is a no-op."""
    existing = await session.scalar(
        select(Notification).where(Notification.idempotency_key == data.idempotency_key)
    )
    if existing is not None:
        return existing, False

    notification = Notification(
        idempotency_key=data.idempotency_key,
        category=data.category,
        title={k.value: v for k, v in data.title.items()},
        body={k.value: v for k, v in data.body.items()},
        target=data.target.model_dump(mode="json"),
        created_by=created_by,
    )
    session.add(notification)
    await session.flush()

    rows = await session.execute(
        _recipients_query(data.category, data.target, farmer_ids).add_columns(
            Farmer.notification_preferences
        )
    )
    deliveries = [
        NotificationDelivery(
            notification_id=notification.id,
            farmer_id=farmer_id,
            channel=channel_for(push_token, primary_channel),
            status=DeliveryStatus.PENDING
            if _wants(prefs, data.category)
            else DeliveryStatus.SKIPPED,
        )
        for farmer_id, push_token, primary_channel, prefs in rows.all()
    ]
    session.add_all(deliveries)
    notification.recipients = sum(d.status is DeliveryStatus.PENDING for d in deliveries)
    await session.commit()
    return notification, True


async def dispatch_pending(session: AsyncSession, batch_size: int) -> int:
    """Send one batch. Safe to run on several workers at once (SKIP LOCKED)."""
    query = (
        select(NotificationDelivery, Notification, Farmer)
        .join(Notification, Notification.id == NotificationDelivery.notification_id)
        .join(Farmer, Farmer.id == NotificationDelivery.farmer_id)
        .where(NotificationDelivery.status == DeliveryStatus.PENDING)
        .order_by(NotificationDelivery.created_at)
        .limit(batch_size)
    )
    if session.bind.dialect.name == "postgresql":
        query = query.with_for_update(of=NotificationDelivery, skip_locked=True)
    rows = (await session.execute(query)).all()

    push, sms = get_push_sender(), get_sms_sender()
    for delivery, notification, farmer in rows:
        language = farmer.preferred_language
        title = localized(notification.title, language)
        body = localized(notification.body, language)
        delivery.attempts += 1
        if delivery.channel != "push" and not farmer.phone:
            delivery.status = DeliveryStatus.SKIPPED  # e-mail sign-in: no number to call or text
            delivery.error = "no phone number"
            continue
        try:
            if delivery.channel == "push" and farmer.push_token:
                await push.send(
                    farmer.push_token, title, body, {"category": notification.category.value}
                )
            elif delivery.channel == "voice":
                try:
                    await place_alert_call(
                        session, farmer.phone, f"{title}. {body}", language, voice_style(farmer)
                    )
                except ServiceUnavailable:
                    delivery.channel = "sms"  # no call possible right now: never lose the alert
                    await sms.send(farmer.phone, f"{title}: {body}"[:480])
            else:
                await sms.send(farmer.phone, f"{title}: {body}"[:480])
        except DeliveryError as exc:
            delivery.error = str(exc)[:300]
            if delivery.attempts >= MAX_ATTEMPTS:
                delivery.status = DeliveryStatus.FAILED
        else:
            delivery.status = DeliveryStatus.SENT
            delivery.sent_at = utcnow()
    await session.commit()
    return len(rows)


async def delivery_counts(
    session: AsyncSession, notification_ids: list[uuid.UUID]
) -> dict[uuid.UUID, dict[str, int]]:
    rows = await session.execute(
        select(NotificationDelivery.notification_id, NotificationDelivery.status, func.count())
        .where(NotificationDelivery.notification_id.in_(notification_ids))
        .group_by(NotificationDelivery.notification_id, NotificationDelivery.status)
    )
    counts: dict[uuid.UUID, dict[str, int]] = {}
    for notification_id, status, count in rows.all():
        counts.setdefault(notification_id, {})[status.value] = count
    return counts


# --- Automatic notifications -------------------------------------------------------------


def _all_languages(key: str, **params: object) -> dict[Language, str]:
    return {language: render(key, language, **params) for language in Language}


async def queue_calendar_reminders(session: AsyncSession, for_day: date | None = None) -> int:
    """One reminder per farmer for tasks due tomorrow."""
    day = for_day or date.today() + timedelta(days=1)
    rows = await session.execute(
        select(CalendarEvent.farmer_id, func.count())
        .where(CalendarEvent.scheduled_on == day, CalendarEvent.done.is_(False))
        .group_by(CalendarEvent.farmer_id)
    )
    created = 0
    for farmer_id, count in rows.all():
        data = NotificationIn(
            idempotency_key=f"calendar:{farmer_id}:{day.isoformat()}",
            category=NotificationCategory.CALENDAR,
            title=_all_languages("notify.calendar.title"),
            body=_all_languages("notify.calendar.body", count=count),
            target=NotificationTarget(),
        )
        _, was_created = await create_notification(session, data, None, farmer_ids=[farmer_id])
        created += was_created
    return created


async def queue_weather_alerts(session: AsyncSession) -> int:
    """Warn farmers about severe weather at their location in the next three days."""
    from app.weather.service import get_report  # local import: weather is optional here

    locations = await session.execute(
        select(Location)
        .join(Farmer, Farmer.location_id == Location.id)
        .where(and_(Location.latitude.is_not(None), Location.longitude.is_not(None)))
        .distinct()
    )
    created = 0
    for location in locations.scalars():
        try:
            report = await get_report(session, location.latitude, location.longitude)
        except Exception:
            logger.warning("weather_alert_fetch_failed", extra={"location": str(location.id)})
            continue
        for alert in report.alerts:
            if alert.severity.value == "info":
                continue
            farmer_ids = list(
                await session.scalars(select(Farmer.id).where(Farmer.location_id == location.id))
            )
            data = NotificationIn(
                idempotency_key=f"weather:{location.id}:{alert.on.isoformat()}:{alert.code}",
                category=NotificationCategory.WEATHER,
                title=_all_languages("notify.weather.title"),
                body=_all_languages(f"alert.{alert.code}", **alert.params),
                target=NotificationTarget(),
            )
            _, was_created = await create_notification(session, data, None, farmer_ids=farmer_ids)
            created += was_created
    return created


MARKET_MOVE_THRESHOLD = 0.10  # tell growers when the mandi price moves this much in a week
OUTBREAK_WINDOW_DAYS = 7
OUTBREAK_MIN_FARMERS = 3  # confirmed photos from this many farmers in one district


async def queue_market_alerts(session: AsyncSession) -> int:
    """Warn growers when their crop's mandi price in their state moved sharply in a week.

    Compares the average modal price on the latest arrival date with the latest date at
    least six days earlier. Only crops that farmers are actually growing are checked."""
    from app.market.models import Market, MarketPrice  # local import: market is optional

    grown = await session.execute(
        select(Crop.slug, Crop.market_commodity, Crop.names, Location.state)
        .join(CropCycle, CropCycle.crop_id == Crop.id)
        .join(Farm, Farm.id == CropCycle.farm_id)
        .join(Farmer, Farmer.id == Farm.farmer_id)
        .join(Location, Location.id == Farmer.location_id)
        .where(CropCycle.status == CycleStatus.ACTIVE, Crop.market_commodity.is_not(None))
        .distinct()
    )
    created = 0
    for slug, commodity, names, state in grown.all():
        scope = (
            select(MarketPrice.arrival_date, func.avg(MarketPrice.modal_price))
            .join(Market, Market.id == MarketPrice.market_id)
            .where(MarketPrice.commodity == commodity, Market.state == state)
            .group_by(MarketPrice.arrival_date)
            .order_by(MarketPrice.arrival_date.desc())
        )
        latest = (await session.execute(scope.limit(1))).first()
        if latest is None:
            continue
        latest_day, latest_price = latest
        earlier = (
            await session.execute(
                scope.where(
                    MarketPrice.arrival_date <= latest_day - timedelta(days=6),
                    MarketPrice.arrival_date >= latest_day - timedelta(days=21),
                ).limit(1)
            )
        ).first()
        if earlier is None or not earlier[1]:
            continue
        change = (float(latest_price) - float(earlier[1])) / float(earlier[1])
        if abs(change) < MARKET_MOVE_THRESHOLD:
            continue
        key = "notify.market.up" if change > 0 else "notify.market.down"
        data = NotificationIn(
            idempotency_key=f"market:{slug}:{state}:{latest_day.isoformat()}",
            category=NotificationCategory.MARKET,
            title=_all_languages("notify.market.title"),
            body={
                lang: render(
                    key,
                    lang,
                    crop=localized(names, lang),
                    percent=round(abs(change) * 100),
                    price=round(float(latest_price)),
                    state=state,
                )
                for lang in Language
            },
            target=NotificationTarget(states=[state], crops=[slug]),
        )
        _, was_created = await create_notification(session, data, None)
        created += was_created
    return created


async def queue_disease_outbreak_alerts(session: AsyncSession) -> int:
    """Warn a district's growers when several farmers there photographed the same disease.

    Uses only confident, accepted diagnoses from distinct farmers, so one farmer
    re-uploading photos never triggers an alert."""
    from app.disease.models import DiagnosisPrediction, Disease  # local import

    since = utcnow() - timedelta(days=OUTBREAK_WINDOW_DAYS)
    farmers = func.count(func.distinct(DiagnosisPrediction.farmer_id))
    rows = await session.execute(
        select(
            Disease.slug,
            Disease.crop_slug,
            Disease.names,
            Location.state,
            Location.district,
            farmers,
        )
        .join(Disease, Disease.slug == DiagnosisPrediction.predicted_label)
        .join(Farmer, Farmer.id == DiagnosisPrediction.farmer_id)
        .join(Location, Location.id == Farmer.location_id)
        .where(
            DiagnosisPrediction.kind == "disease",
            DiagnosisPrediction.accepted.is_(True),
            DiagnosisPrediction.created_at >= since,
            Disease.is_healthy.is_(False),
        )
        .group_by(Disease.slug, Disease.crop_slug, Disease.names, Location.state, Location.district)
        .having(farmers >= OUTBREAK_MIN_FARMERS)
    )
    week = date.today().isocalendar()
    created = 0
    for slug, crop_slug, names, state, district, count in rows.all():
        data = NotificationIn(
            idempotency_key=f"outbreak:{slug}:{state}:{district}:{week.year}-W{week.week}",
            category=NotificationCategory.DISEASE,
            title=_all_languages("notify.disease.title"),
            body={
                lang: render(
                    "notify.disease.body",
                    lang,
                    disease=localized(names, lang),
                    district=district,
                    count=count,
                )
                for lang in Language
            },
            target=NotificationTarget(states=[state], districts=[district], crops=[crop_slug]),
        )
        _, was_created = await create_notification(session, data, None)
        created += was_created
    return created


MAX_SCHEME_ANNOUNCEMENTS = 5


async def queue_scheme_announcements(session: AsyncSession, schemes: list) -> int:
    """Tell farmers in scope about schemes that just appeared in an official source.

    `schemes` are GovernmentScheme rows; a state scheme reaches only that state's farmers.
    Capped per run so a large catalogue change never floods anyone.
    """
    created = 0
    for scheme in schemes[:MAX_SCHEME_ANNOUNCEMENTS]:
        data = NotificationIn(
            idempotency_key=f"scheme:{scheme.code}",
            category=NotificationCategory.SCHEME,
            title=_all_languages("notify.scheme.title"),
            body={
                lang: render("notify.scheme.body", lang, name=_scheme_name(scheme, lang))
                for lang in Language
            },
            target=NotificationTarget(states=[scheme.state] if scheme.state else []),
        )
        _, was_created = await create_notification(session, data, None)
        created += was_created
    return created


def _scheme_name(scheme, language: Language) -> str:
    return (scheme.names or {}).get(language.value) or scheme.name


def channel_for(push_token: str | None, primary_channel: Channel) -> str:
    """Smartphone → push; basic phone → a voice call when calls are configured; else SMS."""
    if push_token:
        return "push"
    if primary_channel is Channel.PHONE and voice_calls_enabled():
        return "voice"
    return "sms"


# --- Farmer inbox --------------------------------------------------------------------------


async def inbox(
    session: AsyncSession, farmer: Farmer, limit: int = 50
) -> list[tuple[NotificationDelivery, Notification]]:
    rows = await session.execute(
        select(NotificationDelivery, Notification)
        .join(Notification, Notification.id == NotificationDelivery.notification_id)
        .where(
            NotificationDelivery.farmer_id == farmer.id,
            NotificationDelivery.status.in_(
                [DeliveryStatus.SENT, DeliveryStatus.PENDING, DeliveryStatus.FAILED]
            ),
        )
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    return [(delivery, notification) for delivery, notification in rows.all()]


async def unread_count(session: AsyncSession, farmer: Farmer) -> int:
    return int(
        await session.scalar(
            select(func.count())
            .select_from(NotificationDelivery)
            .where(
                NotificationDelivery.farmer_id == farmer.id,
                NotificationDelivery.read_at.is_(None),
                NotificationDelivery.status != DeliveryStatus.SKIPPED,
            )
        )
        or 0
    )


async def mark_read(
    session: AsyncSession, farmer: Farmer, delivery_ids: list[uuid.UUID] | None
) -> None:
    """Mark the given deliveries (or all of the farmer's) as read."""
    query = update(NotificationDelivery).where(
        NotificationDelivery.farmer_id == farmer.id, NotificationDelivery.read_at.is_(None)
    )
    if delivery_ids is not None:
        query = query.where(NotificationDelivery.id.in_(delivery_ids))
    await session.execute(query.values(read_at=utcnow()))
    await session.commit()
