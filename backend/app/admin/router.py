"""Admin API. Every route requires the ADMIN role; every mutation is audit-logged."""

import time
import uuid
from dataclasses import asdict
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import Select, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin import analytics
from app.admin.audit import record_audit
from app.admin.schemas import (
    Analytics,
    CropUpdate,
    FarmerRow,
    FarmRow,
    KnowledgeUpdate,
    ModelRegisterIn,
    ModelRow,
    Page,
    SystemHealth,
    VerifyIn,
    VoiceSessionRow,
)
from app.auth.dependencies import AdminPrincipal, DbSession, require_admin
from app.auth.models import User
from app.core.config import get_settings
from app.core.database import utcnow
from app.core.errors import InvalidInput, NotFound, ServiceUnavailable
from app.core.observability import metrics
from app.core.uploads import read_limited
from app.crop.models import Crop
from app.crop.schemas import CropInfo
from app.crop.service import invalidate_catalog
from app.disease.models import Disease
from app.farm.models import CropCycle, CycleStatus, Farm
from app.farmer.models import Farmer, Location
from app.market import service as market_service
from app.market.importer import parse_csv
from app.market.models import Market, MarketPrice
from app.ml.models import MLModel
from app.ml.registry import ModelName, activate_model, discover_artifacts, register_model, registry
from app.notification.models import DeliveryStatus, Notification, NotificationDelivery
from app.notification.schemas import NotificationIn, NotificationOut
from app.notification.service import create_notification, delivery_counts
from app.pest.models import Pest
from app.schemes import service as schemes_service
from app.schemes.models import GovernmentScheme
from app.schemes.schemas import AdminSchemeOut, SchemeIn
from app.schemes.sync import sync_live_schemes
from app.voice.models import VoiceSession
from app.voice.providers import get_voice_provider
from app.weather.models import WeatherCache

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

PageNumber = Annotated[int, Query(ge=1, le=10_000)]
PageSize = Annotated[int, Query(ge=1, le=200)]


async def _paginate(session: AsyncSession, query: Select, page: int, page_size: int):
    total = await session.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    rows = await session.execute(query.limit(page_size).offset((page - 1) * page_size))
    return rows.all(), int(total or 0)


# --- Farmers, farms, voice -----------------------------------------------------------------


@router.get("/farmers")
async def list_farmers(
    session: DbSession,
    page: PageNumber = 1,
    page_size: PageSize = 25,
    search: str | None = Query(None, max_length=80),
    state: str | None = Query(None, max_length=64),
    language: str | None = Query(None, max_length=8),
) -> Page[FarmerRow]:
    farm_stats = (
        select(
            Farm.farmer_id,
            func.count(Farm.id).label("farms"),
            func.sum(Farm.area_acres).label("acres"),
        )
        .group_by(Farm.farmer_id)
        .subquery()
    )
    query = (
        select(
            Farmer,
            Location.state,
            Location.district,
            User.last_login_at,
            User.is_active,
            User.email,
            farm_stats.c.farms,
            farm_stats.c.acres,
        )
        .join(User, User.id == Farmer.user_id)
        .outerjoin(Location, Location.id == Farmer.location_id)
        .outerjoin(farm_stats, farm_stats.c.farmer_id == Farmer.id)
        .order_by(Farmer.created_at.desc())
    )
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(or_(Farmer.name.ilike(pattern), Farmer.phone.ilike(pattern)))
    if state:
        query = query.where(Location.state == state)
    if language:
        query = query.where(Farmer.preferred_language == language)
    rows, total = await _paginate(session, query, page, page_size)
    items = [
        FarmerRow(
            id=f.id,
            name=f.name,
            phone=f.phone or email or "",
            preferred_language=f.preferred_language.value,
            primary_channel=f.primary_channel.value,
            state=st,
            district=dist,
            farms=farms or 0,
            total_acres=round(acres or 0, 2),
            created_at=f.created_at,
            last_login_at=login,
            is_active=active,
        )
        for f, st, dist, login, active, email, farms, acres in rows
    ]
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.patch("/farmers/{farmer_id}/status", status_code=status.HTTP_204_NO_CONTENT)
async def set_farmer_active(
    farmer_id: uuid.UUID, active: bool, admin: AdminPrincipal, session: DbSession, request: Request
) -> None:
    farmer = await session.get(Farmer, farmer_id)
    if farmer is None:
        raise NotFound("Farmer not found")
    user = await session.get(User, farmer.user_id)
    user.is_active = active
    record_audit(
        session,
        actor_user_id=admin.user_id,
        action="farmer.set_active",
        entity="farmer",
        entity_id=farmer_id,
        details={"active": active},
        request=request,
    )
    await session.commit()


@router.get("/farms")
async def list_farms(
    session: DbSession,
    page: PageNumber = 1,
    page_size: PageSize = 25,
    state: str | None = Query(None, max_length=64),
) -> Page[FarmRow]:
    query = (
        select(Farm, Farmer.name, Location.state, Location.district)
        .join(Farmer, Farmer.id == Farm.farmer_id)
        .outerjoin(Location, Location.id == Farm.location_id)
        .order_by(Farm.created_at.desc())
    )
    if state:
        query = query.where(Location.state == state)
    rows, total = await _paginate(session, query, page, page_size)
    farm_ids = [farm.id for farm, *_ in rows]
    crops: dict[uuid.UUID, list[str]] = {}
    if farm_ids:
        cycle_rows = await session.execute(
            select(CropCycle.farm_id, Crop.slug)
            .join(Crop, Crop.id == CropCycle.crop_id)
            .where(CropCycle.farm_id.in_(farm_ids), CropCycle.status == CycleStatus.ACTIVE)
        )
        for farm_id, slug in cycle_rows.all():
            crops.setdefault(farm_id, []).append(slug)
    items = [
        FarmRow(
            id=farm.id,
            farmer_name=name,
            name=farm.name,
            area_acres=farm.area_acres,
            soil_type=farm.soil_type.value if farm.soil_type else None,
            irrigation=farm.irrigation.value,
            state=st,
            district=dist,
            active_crops=crops.get(farm.id, []),
        )
        for farm, name, st, dist in rows
    ]
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get("/voice-sessions")
async def list_voice_sessions(
    session: DbSession,
    page: PageNumber = 1,
    page_size: PageSize = 25,
    channel: str | None = Query(None, pattern="^(app|phone)$"),
) -> Page[VoiceSessionRow]:
    query = (
        select(VoiceSession, Farmer.name)
        .outerjoin(Farmer, Farmer.id == VoiceSession.farmer_id)
        .order_by(VoiceSession.started_at.desc())
    )
    if channel:
        query = query.where(VoiceSession.channel == channel)
    rows, total = await _paginate(session, query, page, page_size)
    items = [
        VoiceSessionRow(
            id=v.id,
            farmer_name=name,
            channel=v.channel.value,
            language=v.language.value,
            provider=v.provider,
            started_at=v.started_at,
            duration_seconds=v.duration_seconds,
            turns=v.turns,
            end_reason=v.end_reason,
        )
        for v, name in rows
    ]
    return Page(items=items, total=total, page=page, page_size=page_size)


# --- Analytics & health ------------------------------------------------------------------


@router.get("/analytics")
async def get_analytics(session: DbSession) -> Analytics:
    return await analytics.compute(session)


@router.get("/system")
async def system_health(session: DbSession) -> SystemHealth:
    settings = get_settings()
    start = time.perf_counter()
    await session.execute(text("SELECT 1"))
    db_ms = (time.perf_counter() - start) * 1000
    active = dict(
        (
            await session.execute(
                select(MLModel.name, MLModel.version).where(MLModel.is_active.is_(True))
            )
        ).all()
    )
    pending = await session.scalar(
        select(func.count())
        .select_from(NotificationDelivery)
        .where(NotificationDelivery.status == DeliveryStatus.PENDING)
    )
    voice = get_voice_provider()
    return SystemHealth(
        status="ok",
        environment=settings.environment,
        database_latency_ms=round(db_ms, 2),
        providers={
            "weather": settings.weather_provider,
            "market": settings.market_provider
            if settings.data_gov_in_api_key
            else "not configured",
            "voice": voice.name,
            "llm": settings.llm_provider,
            "telephony": "twilio" if settings.twilio_auth_token else "not configured",
        },
        voice_capabilities={
            "asr": voice.capabilities.asr,
            "tts": voice.capabilities.tts,
            "translation": voice.capabilities.translation,
        },
        models_active={name.value: active.get(name.value) for name in ModelName},
        models_loaded_here=registry.loaded_versions(),
        pending_notifications=int(pending or 0),
        metrics=metrics.snapshot(),
    )


# --- Models ------------------------------------------------------------------------------


@router.get("/models")
async def list_models(session: DbSession) -> list[ModelRow]:
    registered = {(m.name, m.version): m for m in await session.scalars(select(MLModel))}
    loaded = registry.loaded_versions()
    rows = [
        ModelRow(
            name=m.name,
            version=m.version,
            registered=True,
            is_active=m.is_active,
            framework=m.framework,
            dataset_version=m.dataset_version,
            feature_version=m.feature_version,
            metrics=m.metrics,
            trained_at=m.trained_at,
            loaded_in_this_instance=loaded.get(m.name) == m.version,
        )
        for m in registered.values()
    ]
    rows += [
        ModelRow(name=a["name"], version=a["version"], registered=False, is_active=False)
        for a in discover_artifacts()
        if (a["name"], a["version"]) not in registered
    ]
    return sorted(rows, key=lambda r: (r.name, r.version))


def _model_name(value: str) -> ModelName:
    try:
        return ModelName(value)
    except ValueError as exc:
        raise InvalidInput(f"Unknown model '{value}'", code="unknown_model") from exc


@router.post("/models", status_code=status.HTTP_201_CREATED)
async def register(
    body: ModelRegisterIn, admin: AdminPrincipal, session: DbSession, request: Request
) -> ModelRow:
    name = _model_name(body.name)
    model = await register_model(session, name, body.version)
    if body.activate:
        model = await activate_model(session, name, body.version)
    record_audit(
        session,
        actor_user_id=admin.user_id,
        action="model.register",
        entity="ml_model",
        entity_id=f"{name}/{body.version}",
        details={"activate": body.activate},
        request=request,
    )
    await session.commit()
    return ModelRow(
        name=model.name,
        version=model.version,
        registered=True,
        is_active=model.is_active,
        framework=model.framework,
        dataset_version=model.dataset_version,
        feature_version=model.feature_version,
        metrics=model.metrics,
        trained_at=model.trained_at,
    )


@router.post("/models/{name}/{version}/activate", status_code=status.HTTP_204_NO_CONTENT)
async def activate(
    name: str, version: str, admin: AdminPrincipal, session: DbSession, request: Request
) -> None:
    """Activate a version — also the rollback path."""
    model_name = _model_name(name)
    await activate_model(session, model_name, version)
    record_audit(
        session,
        actor_user_id=admin.user_id,
        action="model.activate",
        entity="ml_model",
        entity_id=f"{name}/{version}",
        request=request,
    )
    await session.commit()


# --- Agricultural content ----------------------------------------------------------------


@router.get("/crops")
async def list_crops(session: DbSession) -> list[CropInfo]:
    return [
        CropInfo.model_validate(c) for c in await session.scalars(select(Crop).order_by(Crop.slug))
    ]


@router.put("/crops/{slug}")
async def update_crop(
    slug: str, body: CropUpdate, admin: AdminPrincipal, session: DbSession, request: Request
) -> CropInfo:
    crop = await session.scalar(select(Crop).where(Crop.slug == slug))
    if crop is None:
        raise NotFound("Crop not found")
    changes = body.model_dump(exclude_none=True)
    for key, value in changes.items():
        setattr(crop, key, value)
    record_audit(
        session,
        actor_user_id=admin.user_id,
        action="crop.update",
        entity="crop",
        entity_id=slug,
        details={"fields": sorted(changes)},
        request=request,
    )
    await session.commit()
    invalidate_catalog()
    return CropInfo.model_validate(crop)


_KNOWLEDGE = {
    "diseases": (
        Disease,
        {
            "cause",
            "symptoms",
            "favorable_conditions",
            "treatment",
            "prevention",
            "fertilizer_guidance",
            "safety_warnings",
            "pathogen_type",
        },
    ),
    "pests": (
        Pest,
        {
            "description",
            "damage",
            "affected_crops",
            "control_measures",
            "prevention",
            "safety_warnings",
        },
    ),
}


def _knowledge_dict(row) -> dict:
    keys = [
        "slug",
        "names",
        "verified_by",
        "verified_at",
        *sorted(_KNOWLEDGE["diseases" if isinstance(row, Disease) else "pests"][1]),
    ]
    data = {k: getattr(row, k) for k in keys}
    data["is_healthy" if isinstance(row, Disease) else "is_beneficial"] = (
        row.is_healthy if isinstance(row, Disease) else row.is_beneficial
    )
    if isinstance(row, Disease):
        data["crop_slug"] = row.crop_slug
    return data


@router.get("/knowledge/{kind}")
async def list_knowledge(kind: str, session: DbSession) -> list[dict]:
    if kind not in _KNOWLEDGE:
        raise NotFound("Unknown knowledge type")
    model, _ = _KNOWLEDGE[kind]
    return [_knowledge_dict(r) for r in await session.scalars(select(model).order_by(model.slug))]


@router.put("/knowledge/{kind}/{slug}")
async def update_knowledge(
    kind: str,
    slug: str,
    body: KnowledgeUpdate,
    admin: AdminPrincipal,
    session: DbSession,
    request: Request,
) -> dict:
    if kind not in _KNOWLEDGE:
        raise NotFound("Unknown knowledge type")
    model, editable = _KNOWLEDGE[kind]
    row = await session.scalar(select(model).where(model.slug == slug))
    if row is None:
        raise NotFound("Entry not found")
    unknown = set(body.fields) - editable
    if unknown:
        raise InvalidInput(f"Fields not editable: {sorted(unknown)}")
    for key, value in body.fields.items():
        setattr(row, key, value)
    if body.names is not None:
        row.names = body.names
    row.verified_by, row.verified_at = None, None  # changed content must be re-reviewed
    record_audit(
        session,
        actor_user_id=admin.user_id,
        action=f"{kind}.update",
        entity=kind,
        entity_id=slug,
        details={"fields": sorted(body.fields)},
        request=request,
    )
    await session.commit()
    return _knowledge_dict(row)


@router.post("/knowledge/{kind}/{slug}/verify")
async def verify_knowledge(
    kind: str,
    slug: str,
    body: VerifyIn,
    admin: AdminPrincipal,
    session: DbSession,
    request: Request,
) -> dict:
    if kind not in _KNOWLEDGE:
        raise NotFound("Unknown knowledge type")
    model, _ = _KNOWLEDGE[kind]
    row = await session.scalar(select(model).where(model.slug == slug))
    if row is None:
        raise NotFound("Entry not found")
    row.verified_by, row.verified_at = body.verified_by, utcnow()
    record_audit(
        session,
        actor_user_id=admin.user_id,
        action=f"{kind}.verify",
        entity=kind,
        entity_id=slug,
        details={"verified_by": body.verified_by},
        request=request,
    )
    await session.commit()
    return _knowledge_dict(row)


# --- Schemes -----------------------------------------------------------------------------


@router.get("/schemes")
async def list_schemes(session: DbSession) -> list[AdminSchemeOut]:
    schemes = await session.scalars(select(GovernmentScheme).order_by(GovernmentScheme.name))
    return [schemes_service.to_admin_out(s) for s in schemes]


@router.post("/schemes", status_code=status.HTTP_201_CREATED)
async def create_scheme(
    body: SchemeIn, admin: AdminPrincipal, session: DbSession, request: Request
) -> AdminSchemeOut:
    scheme = await schemes_service.create_scheme(session, body)
    record_audit(
        session,
        actor_user_id=admin.user_id,
        action="scheme.create",
        entity="scheme",
        entity_id=body.code,
        request=request,
    )
    await session.commit()
    return schemes_service.to_admin_out(scheme)


class SchemeSyncResult(BaseModel):
    source: str
    synced: int
    new: int
    retired: int
    announced: int


@router.post("/schemes/sync")
async def sync_schemes_now(
    admin: AdminPrincipal, session: DbSession, request: Request
) -> SchemeSyncResult:
    """Pull the live myScheme catalogue now instead of waiting for the worker's schedule."""
    report = await sync_live_schemes(session)
    if report is None:
        raise ServiceUnavailable(
            "Live scheme sync is not configured (SCHEME_PROVIDER=myscheme, MYSCHEME_API_KEY)",
            code="schemes_sync_disabled",
        )
    record_audit(
        session,
        actor_user_id=admin.user_id,
        action="schemes.sync",
        entity="government_schemes",
        details=asdict(report),
        request=request,
    )
    await session.commit()
    return SchemeSyncResult(**asdict(report))


@router.put("/schemes/{scheme_id}")
async def update_scheme(
    scheme_id: uuid.UUID,
    body: SchemeIn,
    admin: AdminPrincipal,
    session: DbSession,
    request: Request,
) -> AdminSchemeOut:
    scheme = await schemes_service.update_scheme(session, scheme_id, body)
    record_audit(
        session,
        actor_user_id=admin.user_id,
        action="scheme.update",
        entity="scheme",
        entity_id=body.code,
        request=request,
    )
    await session.commit()
    return schemes_service.to_admin_out(scheme)


# --- Notifications -----------------------------------------------------------------------


@router.get("/notifications")
async def list_notifications(
    session: DbSession, limit: int = Query(50, ge=1, le=200)
) -> list[NotificationOut]:
    notifications = list(
        await session.scalars(
            select(Notification).order_by(Notification.created_at.desc()).limit(limit)
        )
    )
    counts = await delivery_counts(session, [n.id for n in notifications])
    return [
        NotificationOut(
            id=n.id,
            category=n.category,
            title=n.title,
            target=n.target,
            recipients=n.recipients,
            created_at=n.created_at,
            sent=counts.get(n.id, {}).get("sent", 0),
            failed=counts.get(n.id, {}).get("failed", 0),
            pending=counts.get(n.id, {}).get("pending", 0),
        )
        for n in notifications
    ]


@router.post("/notifications", status_code=status.HTTP_201_CREATED)
async def send_notification(
    body: NotificationIn, admin: AdminPrincipal, session: DbSession, request: Request
) -> NotificationOut:
    notification, created = await create_notification(session, body, admin.user_id)
    if created:
        record_audit(
            session,
            actor_user_id=admin.user_id,
            action="notification.create",
            entity="notification",
            entity_id=notification.id,
            details={"recipients": notification.recipients},
            request=request,
        )
        await session.commit()
    return NotificationOut(
        id=notification.id,
        category=notification.category,
        title=notification.title,
        target=notification.target,
        recipients=notification.recipients,
        created_at=notification.created_at,
        pending=notification.recipients if created else 0,
    )


# --- Market & weather data ---------------------------------------------------------------


class PriceImportResult(BaseModel):
    imported: int
    skipped_rows: list[int]


@router.post("/markets/import", status_code=status.HTTP_201_CREATED)
async def import_market_prices(
    admin: AdminPrincipal,
    session: DbSession,
    request: Request,
    file: Annotated[UploadFile, File(description="Agmarknet or data.gov.in price CSV")],
    state: Annotated[str | None, Form(max_length=64)] = None,
) -> PriceImportResult:
    """Load mandi prices from a downloaded CSV — the no-API-key way to keep prices current."""
    content = await read_limited(
        file,
        20 * 1024 * 1024,
        {"text/csv", "application/vnd.ms-excel", "application/octet-stream", "text/plain"},
    )
    try:
        parsed = parse_csv(content, default_state=state)
    except ValueError as exc:
        raise InvalidInput(str(exc), code="invalid_price_file") from exc
    imported = await market_service.import_prices(session, parsed.observations, "csv_import")
    record_audit(
        session,
        actor_user_id=admin.user_id,
        action="market.import",
        entity="market_prices",
        details={"file": file.filename, "rows": imported, "skipped": len(parsed.skipped_rows)},
        request=request,
    )
    await session.commit()
    return PriceImportResult(imported=imported, skipped_rows=parsed.skipped_rows[:100])


@router.get("/markets/prices")
async def recent_prices(
    session: DbSession,
    commodity: str | None = Query(None, max_length=80),
    state: str | None = Query(None, max_length=64),
    limit: int = Query(100, ge=1, le=500),
) -> list[dict]:
    query = (
        select(MarketPrice)
        .join(Market)
        .order_by(MarketPrice.arrival_date.desc(), MarketPrice.fetched_at.desc())
    )
    if commodity:
        query = query.where(MarketPrice.commodity == commodity)
    if state:
        query = query.where(Market.state == state)
    prices = await session.scalars(query.limit(limit))
    return [
        {
            "commodity": p.commodity,
            "variety": p.variety,
            "market": p.market.name,
            "district": p.market.district,
            "state": p.market.state,
            "arrival_date": p.arrival_date,
            "min_price": p.min_price,
            "max_price": p.max_price,
            "modal_price": p.modal_price,
            "source": p.source,
            "fetched_at": p.fetched_at,
        }
        for p in prices
    ]


@router.get("/weather/cache")
async def weather_cache(session: DbSession) -> list[dict]:
    rows = await session.scalars(
        select(WeatherCache).order_by(WeatherCache.fetched_at.desc()).limit(200)
    )
    now = utcnow()
    return [
        {
            "key": r.cache_key,
            "fetched_at": r.fetched_at,
            "expires_at": r.expires_at,
            "fresh": r.expires_at > now,
            "current": r.payload.get("current"),
            "rainfall_last_90_days_mm": r.payload.get("rainfall_last_90_days_mm"),
        }
        for r in rows
    ]
