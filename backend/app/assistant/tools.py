"""AgriBrain tools: one per intent, each delegating to the domain service that owns the facts.

A tool returns localized text built from templates plus structured `data` for the app to
render as a card. Tools never invent facts; when information is missing they say what is
needed, and offer an action only if the farmer's device can perform it.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.assistant.intents import Intent
from app.assistant.nlu import NluResult
from app.assistant.schemas import AssistantAction
from app.calendar.service import list_events
from app.core.errors import AppError, InvalidInput, ServiceUnavailable
from app.core.language import localized
from app.crop.schemas import CropInfo, CropRecommendationRequest
from app.crop.service import crop_catalog, recommend
from app.farmer.context import FarmerContext
from app.language.service import translate_texts
from app.language.templates import format_number, has_template, join_list, render
from app.market.service import current_prices
from app.schemes.eligibility import Eligibility
from app.schemes.service import eligible_schemes
from app.weather.service import get_report
from app.yield_prediction.schemas import YieldRequest
from app.yield_prediction.service import predict as predict_yield


@dataclass(slots=True)
class ToolResult:
    text: str
    data: dict[str, Any] | None = None
    action: AssistantAction | None = None
    handled_by: str = "tool"


def _t(ctx: FarmerContext, key: str, **params: object) -> str:
    return render(key, ctx.language, **params)


def _crop_name(info: CropInfo, ctx: FarmerContext) -> str:
    return localized(info.names, ctx.language)


def _action_if_app(ctx: FarmerContext, type_: str, target: str) -> AssistantAction | None:
    return AssistantAction(type=type_, target=target) if ctx.can_send_images else None


def _current_crop(ctx: FarmerContext, nlu: NluResult) -> str | None:
    if nlu.crop:
        return nlu.crop
    return ctx.active_cycles[0].crop.slug if ctx.active_cycles else None


# A village name is not worth a farmer waiting for; the English spelling is shown instead.
_NAME_TRANSLATION_SECONDS = 4.0


def _mm(value: float) -> float | int:
    """Whole millimetres, but keep one decimal for drizzle so 0.4 mm is not read as 0."""
    return round(value, 1) if 0 < value < 1 else round(value)


async def _local_name(session: AsyncSession, ctx: FarmerContext, name: str) -> str:
    """A place or market name in the farmer's script ("Salem" -> "சேலம்"), translated once
    and cached; the original name when no translation is available."""
    if not name:
        return name
    (translated,), _ = await translate_texts(
        session, [name], ctx.language, timeout=_NAME_TRANSLATION_SECONDS
    )
    return translated


async def weather(session: AsyncSession, ctx: FarmerContext, nlu: NluResult) -> ToolResult:
    if ctx.coordinates is None:
        return ToolResult(
            _t(ctx, "location_required"),
            action=AssistantAction(type="open_screen", target="profile"),
        )
    report = await get_report(session, *ctx.coordinates)
    place = await _local_name(session, ctx, ctx.location.district if ctx.location else "")
    if nlu.day_offset == 0 or len(report.daily) < 2:
        current = report.current
        text = _t(
            ctx,
            "weather.current",
            place=place,
            temp=round(current.temperature_c),
            humidity=round(current.humidity_pct),
            condition=_t(ctx, f"weather.condition.{current.condition}"),
        )
        if report.daily:
            today = report.daily[0]
            text += " " + _t(
                ctx,
                "weather.rain_chance",
                rain_prob=round(today.rain_probability_pct),
                rain_mm=_mm(today.rain_mm),
            )
    else:
        day = report.daily[nlu.day_offset]
        text = _t(
            ctx,
            "weather.tomorrow",
            min=round(day.temp_min_c),
            max=round(day.temp_max_c),
            rain_prob=round(day.rain_probability_pct),
            rain_mm=_mm(day.rain_mm),
            condition=_t(ctx, f"weather.condition.{day.condition}"),
        )
    alerts = [a for a in report.alerts if a.severity.value != "info"] or report.alerts
    if alerts:
        text += " " + _t(ctx, f"alert.{alerts[0].code}", **alerts[0].params)
    return ToolResult(text, data={"card": "weather", "weather": report.model_dump(mode="json")})


async def market_price(session: AsyncSession, ctx: FarmerContext, nlu: NluResult) -> ToolResult:
    catalog = await crop_catalog(session)
    slug = _current_crop(ctx, nlu)
    if slug is None or slug not in catalog:
        return ToolResult(_t(ctx, "market.ask_crop"))
    info = catalog[slug]
    if not info.market_commodity:
        return ToolResult(_t(ctx, "market.no_data", crop=_crop_name(info, ctx)))
    state = ctx.location.state if ctx.location else None
    district = ctx.location.district if ctx.location else None
    prices = await current_prices(session, info.market_commodity, state, district)
    if not prices.prices:
        return ToolResult(_t(ctx, "market.no_data", crop=_crop_name(info, ctx)))
    best = prices.prices[0]
    text = _t(
        ctx,
        "market.price",
        crop=_crop_name(info, ctx),
        market=await _local_name(session, ctx, best.market),
        modal=format_number(best.modal_price),
        min=format_number(best.min_price),
        max=format_number(best.max_price),
        date=best.arrival_date.strftime("%d-%m-%Y"),
    )
    if prices.stale:
        text += " " + _t(ctx, "market.stale")
    return ToolResult(text, data={"card": "market", "market": prices.model_dump(mode="json")})


async def crop_recommendation(
    session: AsyncSession, ctx: FarmerContext, nlu: NluResult
) -> ToolResult:
    try:
        result = await recommend(session, ctx, CropRecommendationRequest())
    except InvalidInput as exc:
        if exc.code == "soil_data_required":
            return ToolResult(
                _t(ctx, "crop.soil_required"),
                action=AssistantAction(type="open_screen", target="soil")
                if ctx.can_send_images
                else None,
            )
        if exc.code == "location_required":
            return ToolResult(_t(ctx, "location_required"))
        raise
    alternatives = join_list([o.name for o in result.alternatives[:2]], ctx.language)
    text = _t(
        ctx,
        "crop.recommend",
        crop=result.recommended.name,
        alternatives=alternatives,
    )
    return ToolResult(
        text, data={"card": "crop_recommendation", "recommendation": result.model_dump(mode="json")}
    )


async def disease_diagnosis(
    session: AsyncSession, ctx: FarmerContext, nlu: NluResult
) -> ToolResult:
    if not ctx.can_send_images:
        return ToolResult(_t(ctx, "disease.phone_unsupported"))
    return ToolResult(
        _t(ctx, "disease.photo_request"),
        action=AssistantAction(type="capture_image", target="disease"),
    )


async def pest_diagnosis(session: AsyncSession, ctx: FarmerContext, nlu: NluResult) -> ToolResult:
    if not ctx.can_send_images:
        return ToolResult(_t(ctx, "disease.phone_unsupported"))
    return ToolResult(
        _t(ctx, "pest.photo_request"), action=AssistantAction(type="capture_image", target="pest")
    )


async def schemes(session: AsyncSession, ctx: FarmerContext, nlu: NluResult) -> ToolResult:
    results = await eligible_schemes(session, ctx)
    if not results:
        return ToolResult(_t(ctx, "schemes.none"))
    eligible = [r for r in results if r.status is Eligibility.ELIGIBLE]
    shown = (eligible or results)[:3]
    names = join_list([r.scheme.name for r in shown], ctx.language)
    key = "schemes.eligible" if eligible else "schemes.maybe"
    text = _t(ctx, key, count=len(eligible or results), names=names)
    if not eligible and any(r.missing_facts for r in results):
        text += " " + _t(ctx, "schemes.profile_needed")
    return ToolResult(
        text, data={"card": "schemes", "schemes": [r.model_dump(mode="json") for r in results[:10]]}
    )


async def yield_estimate(session: AsyncSession, ctx: FarmerContext, nlu: NluResult) -> ToolResult:
    slug = _current_crop(ctx, nlu)
    if slug is None:
        return ToolResult(_t(ctx, "yield.ask_crop"))
    cycle = next((c for c in ctx.active_cycles if c.crop.slug == slug), None)
    area = cycle.area_acres if cycle else (ctx.total_land_acres or 1.0)
    try:
        result = await predict_yield(session, ctx, YieldRequest(crop=slug, area_acres=area))
    except InvalidInput as exc:
        if exc.code == "yield_crop_unsupported":
            return ToolResult(_t(ctx, "yield.unsupported"))
        if exc.code == "location_required":
            return ToolResult(_t(ctx, "location_required"))
        raise
    text = _t(
        ctx,
        "yield.estimate",
        crop=result.crop_name,
        expected=result.expected_q_per_acre,
        low=result.low_q_per_acre,
        high=result.high_q_per_acre,
        area=area,
        total=format_number(result.expected_total_quintals),
    )
    return ToolResult(text, data={"card": "yield", "yield": result.model_dump(mode="json")})


async def profit(session: AsyncSession, ctx: FarmerContext, nlu: NluResult) -> ToolResult:
    """Profit needs the farmer's own costs; by voice we can still estimate revenue."""
    slug = _current_crop(ctx, nlu)
    action = AssistantAction(type="open_screen", target="profit") if ctx.can_send_images else None
    if slug is None:
        return ToolResult(_t(ctx, "profit.need_details"), action=action)
    catalog = await crop_catalog(session)
    info = catalog.get(slug)
    cycle = next((c for c in ctx.active_cycles if c.crop.slug == slug), None)
    area = cycle.area_acres if cycle else (ctx.total_land_acres or 1.0)
    try:
        yield_result = await predict_yield(session, ctx, YieldRequest(crop=slug, area_acres=area))
        prices = (
            await current_prices(
                session, info.market_commodity, ctx.location.state if ctx.location else None
            )
            if info and info.market_commodity
            else None
        )
    except AppError:
        return ToolResult(_t(ctx, "profit.need_details"), action=action)
    if not prices or not prices.prices:
        return ToolResult(_t(ctx, "profit.need_details"), action=action)
    price = prices.prices[0].modal_price
    revenue = yield_result.expected_total_quintals * price
    text = _t(
        ctx,
        "profit.revenue_estimate",
        crop=yield_result.crop_name,
        area=area,
        quintals=format_number(yield_result.expected_total_quintals),
        price=format_number(price),
        revenue=format_number(revenue),
    )
    return ToolResult(
        text,
        action=action,
        data={
            "card": "profit_estimate",
            "revenue": round(revenue),
            "price_per_quintal": price,
            "expected_quintals": yield_result.expected_total_quintals,
        },
    )


async def calendar(session: AsyncSession, ctx: FarmerContext, nlu: NluResult) -> ToolResult:
    today = date.today()
    events = [
        (e, slug)
        for e, slug in await list_events(session, ctx.farmer.id, today, today + timedelta(days=21))
        if not e.done
    ]
    if not events:
        return ToolResult(
            _t(ctx, "calendar.none"),
            action=AssistantAction(type="open_screen", target="farm")
            if ctx.can_send_images
            else None,
        )
    catalog = await crop_catalog(session)
    lines = []
    for event, slug in events[:3]:
        task_key = f"task.{event.detail_key}"
        task = (
            _t(ctx, task_key)
            if has_template(task_key)
            else _t(ctx, f"task_type.{event.event_type}")
        )
        crop = _crop_name(catalog[slug], ctx) if slug in catalog else slug
        lines.append(
            _t(
                ctx,
                "calendar.item",
                task=task,
                crop=crop,
                date=event.scheduled_on.strftime("%d-%m"),
            )
        )
    return ToolResult(
        _t(ctx, "calendar.next", items=join_list(lines, ctx.language)),
        data={
            "card": "calendar",
            "events": [
                {
                    "id": str(e.id),
                    "crop": s,
                    "type": e.event_type,
                    "detail_key": e.detail_key,
                    "date": e.scheduled_on.isoformat(),
                }
                for e, s in events[:10]
            ],
        },
    )


async def notifications(session: AsyncSession, ctx: FarmerContext, nlu: NluResult) -> ToolResult:
    """Read unread alerts aloud — how basic-phone farmers catch up on what they missed."""
    from app.notification.service import inbox, mark_read

    unread = [(d, n) for d, n in await inbox(session, ctx.farmer, limit=10) if d.read_at is None][
        :3
    ]
    if not unread:
        return ToolResult(_t(ctx, "notifications.none"))
    items = " ".join(
        _t(
            ctx,
            "notifications.item",
            title=localized(n.title, ctx.language),
            body=localized(n.body, ctx.language),
        )
        for _, n in unread
    )
    await mark_read(session, ctx.farmer, [d.id for d, _ in unread])
    return ToolResult(
        _t(ctx, "notifications.list", count=len(unread), items=items),
        data={"card": "notifications", "count": len(unread)},
    )


async def greeting(session: AsyncSession, ctx: FarmerContext, nlu: NluResult) -> ToolResult:
    name = ctx.farmer.name.split()[0] if ctx.farmer.name else ""
    return ToolResult(_t(ctx, "greeting", name=name), handled_by="template")


async def help_(session: AsyncSession, ctx: FarmerContext, nlu: NluResult) -> ToolResult:
    key = "help.app" if ctx.can_send_images else "help.phone"
    return ToolResult(_t(ctx, key), handled_by="template")


TOOLS = {
    Intent.WEATHER: weather,
    Intent.MARKET_PRICE: market_price,
    Intent.CROP_RECOMMENDATION: crop_recommendation,
    Intent.DISEASE_DIAGNOSIS: disease_diagnosis,
    Intent.PEST_DIAGNOSIS: pest_diagnosis,
    Intent.SCHEMES: schemes,
    Intent.YIELD_ESTIMATE: yield_estimate,
    Intent.PROFIT: profit,
    Intent.CALENDAR: calendar,
    Intent.NOTIFICATIONS: notifications,
    Intent.GREETING: greeting,
    Intent.HELP: help_,
}


def unavailable_text(ctx: FarmerContext, error: ServiceUnavailable) -> str:
    key = f"unavailable.{error.code}"
    return _t(ctx, key) if has_template(key) else _t(ctx, "unavailable.generic")
