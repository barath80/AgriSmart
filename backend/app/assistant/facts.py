"""The farmer's own records, written out for the language model.

With these the assistant can answer questions about the farmer's farm ("when is my next
fertilizer?", "what was my soil pH?", "what did the plant doctor find?") from AgriSmart's
data instead of guessing. Facts stay in English; the model answers in the farmer's language.
"""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.calendar.service import list_events
from app.core.language import Language, localized
from app.crop.service import crop_catalog
from app.disease.models import DiagnosisPrediction
from app.farmer.context import FarmerContext
from app.notification.service import inbox

_UPCOMING_DAYS = 21
_MAX_TASKS = 6
_MAX_ALERTS = 3
_MAX_DIAGNOSES = 3


def _crop_name(catalog: dict, slug: str) -> str:
    info = catalog.get(slug)
    return localized(info.names, Language.ENGLISH) if info else slug.replace("_", " ")


async def farmer_facts(session: AsyncSession, ctx: FarmerContext) -> str:
    farmer, today = ctx.farmer, date.today()
    catalog = await crop_catalog(session)
    lines = [f"Today is {today:%A, %d %B %Y}."]

    name = farmer.name or "not given"
    place = (
        ", ".join(p for p in (ctx.location.village, ctx.location.district, ctx.location.state) if p)
        if ctx.location
        else "not set (the farmer can set it in Profile)"
    )
    lines.append(f"Farmer: {name}. Village/district/state: {place}.")
    if ctx.age:
        lines.append(f"Age: about {ctx.age}.")

    if ctx.farms:
        farms = "; ".join(
            f"{f.name}: {f.area_acres:g} acres, {f.soil_type or 'soil type not given'} soil, "
            f"{f.irrigation or 'irrigation not given'}"
            for f in ctx.farms
        )
        lines.append(f"Farms ({ctx.total_land_acres:g} acres in all): {farms}.")
    else:
        lines.append("No farm added yet (the farmer can add one in My farm).")

    if soil := ctx.latest_soil:
        parts = [f"N {soil.nitrogen:g}", f"P {soil.phosphorus:g}", f"K {soil.potassium:g}",
                 f"pH {soil.ph:g}"]
        if soil.organic_carbon is not None:
            parts.append(f"organic carbon {soil.organic_carbon:g}%")
        lines.append(f"Latest soil test ({soil.tested_on:%d %b %Y}): {', '.join(parts)}.")
    elif ctx.farms:
        lines.append("No soil test added yet.")

    if ctx.active_cycles:
        crops = "; ".join(
            f"{_crop_name(catalog, c.crop.slug)} ({c.season.value} season), sown "
            f"{c.sowing_date:%d %b %Y} ({(today - c.sowing_date).days} days ago), "
            f"{c.area_acres:g} acres"
            for c in ctx.active_cycles
        )
        lines.append(f"Crops now growing: {crops}.")
    else:
        lines.append("No crop added with a sowing date yet.")

    events = await list_events(session, farmer.id, today, today + timedelta(days=_UPCOMING_DAYS))
    pending = [(e, slug) for e, slug in events if not e.done][:_MAX_TASKS]
    if pending:
        tasks = "; ".join(
            f"{e.scheduled_on:%d %b}: {str(e.event_type).replace('_', ' ')} "
            f"({e.detail_key.replace('_', ' ')}) for {_crop_name(catalog, slug)}"
            for e, slug in pending
        )
        lines.append(f"Upcoming farm tasks: {tasks}.")
    elif ctx.active_cycles:
        lines.append(f"No farm task due in the next {_UPCOMING_DAYS} days.")

    alerts = [
        (d, n) for d, n in await inbox(session, farmer, limit=10) if d.read_at is None
    ][:_MAX_ALERTS]
    if alerts:
        text = "; ".join(
            f"{localized(n.title, Language.ENGLISH)}: {localized(n.body, Language.ENGLISH)}"
            for _, n in alerts
        )
        lines.append(f"Unread alerts: {text}.")

    diagnoses = list(
        await session.scalars(
            select(DiagnosisPrediction)
            .where(DiagnosisPrediction.farmer_id == farmer.id)
            .order_by(DiagnosisPrediction.created_at.desc())
            .limit(_MAX_DIAGNOSES)
        )
    )
    if diagnoses:
        text = "; ".join(
            f"{d.created_at:%d %b}: {d.kind} photo, "
            + (
                f"{d.predicted_label.replace('.', ' ').replace('_', ' ')} "
                f"({round(d.confidence * 100)}% sure)"
                if d.accepted
                else "not clear enough to identify"
            )
            for d in diagnoses
        )
        lines.append(f"Recent photo checks: {text}.")

    prefs = farmer.voice_preferences or {}
    lines.append(
        f"App settings: language {ctx.language.native_name}, "
        f"{prefs.get('gender', 'female')} voice."
    )
    return "\n".join(lines)
