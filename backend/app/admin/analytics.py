"""Aggregate statistics for the admin dashboard, computed from PostgreSQL so they are
consistent across every API instance."""

from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.schemas import Analytics, CountByKey, DailyPoint
from app.assistant.models import ChatMessage
from app.auth.models import User
from app.core.database import utcnow
from app.core.security import Role
from app.crop.models import CropRecommendation
from app.disease.models import DiagnosisPrediction
from app.farmer.models import Farmer, Location
from app.notification.models import NotificationDelivery
from app.voice.models import VoiceSession
from app.yield_prediction.models import YieldPrediction


async def _count(session: AsyncSession, query) -> int:
    return int(await session.scalar(query) or 0)


async def _group(session: AsyncSession, column, *where, limit: int = 20) -> list[CountByKey]:
    query = (
        select(column, func.count())
        .where(*where)
        .group_by(column)
        .order_by(func.count().desc())
        .limit(limit)
    )
    rows = await session.execute(query)
    return [
        CountByKey(key=str(getattr(k, "value", k) or "unknown"), count=c) for k, c in rows.all()
    ]


async def _daily(session: AsyncSession, model, since: date, *where) -> dict[date, int]:
    # PostgreSQL: CAST(ts AS DATE). SQLite (tests) has no DATE type: use date().
    is_postgres = session.bind.dialect.name == "postgresql"
    day = cast(model.created_at, Date) if is_postgres else func.date(model.created_at)
    rows = await session.execute(
        select(day, func.count())
        .where(model.created_at >= datetime.combine(since, time.min, tzinfo=UTC), *where)
        .group_by(day)
    )
    return {(d if isinstance(d, date) else date.fromisoformat(str(d))): c for d, c in rows.all()}


async def compute(session: AsyncSession) -> Analytics:
    now = utcnow()
    day_ago, week_ago = now - timedelta(days=1), now - timedelta(days=7)
    assistant = ChatMessage.role == "assistant"

    diagnosis_total = await _count(session, select(func.count()).select_from(DiagnosisPrediction))
    diagnosis_accepted = await _count(
        session,
        select(func.count())
        .select_from(DiagnosisPrediction)
        .where(DiagnosisPrediction.accepted.is_(True)),
    )
    avg_latency = await session.scalar(
        select(func.avg(ChatMessage.latency_ms)).where(
            assistant, ChatMessage.created_at >= week_ago
        )
    )

    since = (now - timedelta(days=13)).date()
    requests = await _daily(session, ChatMessage, since, assistant)
    diagnoses = await _daily(session, DiagnosisPrediction, since)
    recommendations = await _daily(session, CropRecommendation, since)
    daily = [
        DailyPoint(
            date=d,
            assistant_requests=requests.get(d, 0),
            diagnoses=diagnoses.get(d, 0),
            recommendations=recommendations.get(d, 0),
        )
        for d in (since + timedelta(days=i) for i in range(14))
    ]

    return Analytics(
        total_farmers=await _count(session, select(func.count()).select_from(Farmer)),
        new_farmers_7d=await _count(
            session, select(func.count()).select_from(Farmer).where(Farmer.created_at >= week_ago)
        ),
        active_users_7d=await _count(
            session,
            select(func.count())
            .select_from(User)
            .where(User.role == Role.FARMER, User.last_login_at >= week_ago),
        ),
        assistant_requests_24h=await _count(
            session,
            select(func.count())
            .select_from(ChatMessage)
            .where(assistant, ChatMessage.created_at >= day_ago),
        ),
        assistant_requests_7d=await _count(
            session,
            select(func.count())
            .select_from(ChatMessage)
            .where(assistant, ChatMessage.created_at >= week_ago),
        ),
        voice_sessions_7d=await _count(
            session,
            select(func.count())
            .select_from(VoiceSession)
            .where(VoiceSession.created_at >= week_ago),
        ),
        disease_predictions_7d=await _count(
            session,
            select(func.count())
            .select_from(DiagnosisPrediction)
            .where(DiagnosisPrediction.created_at >= week_ago),
        ),
        crop_recommendations_7d=await _count(
            session,
            select(func.count())
            .select_from(CropRecommendation)
            .where(CropRecommendation.created_at >= week_ago),
        ),
        yield_predictions_7d=await _count(
            session,
            select(func.count())
            .select_from(YieldPrediction)
            .where(YieldPrediction.created_at >= week_ago),
        ),
        failed_assistant_answers_7d=await _count(
            session,
            select(func.count())
            .select_from(ChatMessage)
            .where(
                assistant, ChatMessage.handled_by == "fallback", ChatMessage.created_at >= week_ago
            ),
        ),
        avg_assistant_latency_ms=round(avg_latency, 1) if avg_latency is not None else None,
        diagnosis_acceptance_rate=round(diagnosis_accepted / diagnosis_total, 3)
        if diagnosis_total
        else None,
        intents=await _group(
            session, ChatMessage.intent, assistant, ChatMessage.created_at >= week_ago
        ),
        handled_by=await _group(
            session, ChatMessage.handled_by, assistant, ChatMessage.created_at >= week_ago
        ),
        languages=await _group(session, Farmer.preferred_language),
        channels=await _group(session, Farmer.primary_channel),
        states=await _group(session, Location.state, Location.id == Farmer.location_id),
        notification_deliveries=await _group(session, NotificationDelivery.status),
        daily=daily,
    )
