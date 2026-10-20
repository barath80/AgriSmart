"""Admin side of the help desk, plus a per-farmer activity log for support and analysis."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.audit import record_audit
from app.assistant.models import ChatMessage, ChatSession
from app.auth.dependencies import AdminPrincipal, DbSession, require_admin
from app.auth.models import User
from app.core.database import utcnow
from app.core.errors import NotFound
from app.disease.models import DiagnosisPrediction
from app.farm.models import Farm
from app.farmer.models import Farmer, Location
from app.support.models import SupportMessage
from app.support.router import MessageIn, MessageOut, message_out
from app.voice.models import VoiceSession

router = APIRouter(prefix="/admin", tags=["admin-support"], dependencies=[Depends(require_admin)])


class ThreadRow(BaseModel):
    farmer_id: uuid.UUID
    name: str
    phone: str
    language: str
    last_message: str
    last_sender: str
    last_at: datetime
    messages: int
    awaiting_reply: bool  # the farmer wrote last


class ThreadPage(BaseModel):
    items: list[ThreadRow]
    awaiting: int


class FarmerBrief(BaseModel):
    id: uuid.UUID
    name: str
    phone: str
    language: str
    state: str | None
    district: str | None


class ThreadDetail(BaseModel):
    farmer: FarmerBrief
    messages: list[MessageOut]


@router.get("/support/threads")
async def list_threads(
    session: DbSession,
    only_awaiting: bool = False,
    limit: int = Query(100, ge=1, le=200),
) -> ThreadPage:
    latest = (
        select(
            SupportMessage.farmer_id,
            func.max(SupportMessage.created_at).label("last_at"),
            func.count(SupportMessage.id).label("n"),
        )
        .group_by(SupportMessage.farmer_id)
        .subquery()
    )
    rows = (
        await session.execute(
            select(Farmer, SupportMessage, latest.c.n, User.email)
            .join(User, User.id == Farmer.user_id)
            .join(latest, latest.c.farmer_id == Farmer.id)
            .join(
                SupportMessage,
                (SupportMessage.farmer_id == latest.c.farmer_id)
                & (SupportMessage.created_at == latest.c.last_at),
            )
            .order_by(latest.c.last_at.desc())
            .limit(limit)
        )
    ).all()
    items = [
        ThreadRow(
            farmer_id=f.id,
            name=f.name,
            phone=f.phone or email or "",
            language=f.preferred_language.value,
            last_message=m.body[:200],
            last_sender=m.sender,
            last_at=m.created_at,
            messages=n,
            awaiting_reply=m.sender == "farmer",
        )
        for f, m, n, email in rows
    ]
    awaiting = sum(1 for i in items if i.awaiting_reply)
    if only_awaiting:
        items = [i for i in items if i.awaiting_reply]
    return ThreadPage(items=items, awaiting=awaiting)


async def _farmer_brief(session: AsyncSession, farmer_id: uuid.UUID) -> FarmerBrief:
    row = (
        await session.execute(
            select(Farmer, Location.state, Location.district, User.email)
            .join(User, User.id == Farmer.user_id)
            .outerjoin(Location, Location.id == Farmer.location_id)
            .where(Farmer.id == farmer_id)
        )
    ).first()
    if row is None:
        raise NotFound("Farmer not found")
    farmer, state, district, email = row
    return FarmerBrief(
        id=farmer.id,
        name=farmer.name,
        phone=farmer.phone or email or "",
        language=farmer.preferred_language.value,
        state=state,
        district=district,
    )


@router.get("/support/threads/{farmer_id}")
async def get_thread(farmer_id: uuid.UUID, session: DbSession) -> ThreadDetail:
    brief = await _farmer_brief(session, farmer_id)
    messages = list(
        await session.scalars(
            select(SupportMessage)
            .where(SupportMessage.farmer_id == farmer_id)
            .order_by(SupportMessage.created_at)
            .limit(500)
        )
    )
    await session.execute(
        update(SupportMessage)
        .where(
            SupportMessage.farmer_id == farmer_id,
            SupportMessage.sender == "farmer",
            SupportMessage.read_at.is_(None),
        )
        .values(read_at=utcnow())
    )
    await session.commit()
    return ThreadDetail(farmer=brief, messages=[message_out(m) for m in messages])


@router.post("/support/threads/{farmer_id}/reply", status_code=status.HTTP_201_CREATED)
async def reply(
    farmer_id: uuid.UUID,
    body: MessageIn,
    admin: AdminPrincipal,
    session: DbSession,
    request: Request,
) -> MessageOut:
    await _farmer_brief(session, farmer_id)
    message = SupportMessage(
        farmer_id=farmer_id, sender="admin", body=body.body.strip(), admin_user_id=admin.user_id
    )
    session.add(message)
    record_audit(
        session,
        actor_user_id=admin.user_id,
        action="support.reply",
        entity="farmer",
        entity_id=farmer_id,
        request=request,
    )
    await session.commit()
    await session.refresh(message)
    return message_out(message)


# --- Per-farmer activity ---------------------------------------------------------------


class QueryLog(BaseModel):
    at: datetime
    question: str
    answer: str | None
    intent: str | None
    handled_by: str | None
    channel: str


class DiagnosisLog(BaseModel):
    at: datetime
    kind: str
    label: str
    confidence: float
    accepted: bool


class CallLog(BaseModel):
    at: datetime
    channel: str
    seconds: float | None
    turns: int


class IntentCount(BaseModel):
    intent: str
    count: int


class Activity(BaseModel):
    farmer: FarmerBrief
    joined_at: datetime
    last_login_at: datetime | None
    is_active: bool
    farms: int
    questions: int
    diagnoses: int
    voice_sessions: int
    top_intents: list[IntentCount]
    queries: list[QueryLog]
    diagnosis_log: list[DiagnosisLog]
    calls: list[CallLog]


async def _count(session: AsyncSession, table, *conditions) -> int:
    return (await session.scalar(select(func.count()).select_from(table).where(*conditions))) or 0


@router.get("/farmers/{farmer_id}/activity")
async def farmer_activity(
    farmer_id: uuid.UUID, session: DbSession, limit: int = Query(50, ge=1, le=200)
) -> Activity:
    brief = await _farmer_brief(session, farmer_id)
    farmer = await session.get(Farmer, farmer_id)
    user = await session.get(User, farmer.user_id)

    rows = (
        await session.execute(
            select(ChatMessage, ChatSession.channel)
            .join(ChatSession, ChatSession.id == ChatMessage.session_id)
            .where(ChatSession.farmer_id == farmer_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(limit * 2)
        )
    ).all()
    # Pair each farmer question with the assistant reply that follows it in the same session.
    chronological = list(reversed(rows))
    queries: list[QueryLog] = []
    for index, (message, channel) in enumerate(chronological):
        if message.role != "farmer":
            continue
        answer = next(
            (
                m
                for m, _ in chronological[index + 1 : index + 3]
                if m.role == "assistant" and m.session_id == message.session_id
            ),
            None,
        )
        queries.append(
            QueryLog(
                at=message.created_at,
                question=message.text,
                answer=answer.text if answer else None,
                intent=answer.intent if answer else message.intent,
                handled_by=answer.handled_by if answer else None,
                channel=channel.value,
            )
        )
    queries.reverse()

    intents = (
        await session.execute(
            select(ChatMessage.intent, func.count())
            .join(ChatSession, ChatSession.id == ChatMessage.session_id)
            .where(
                ChatSession.farmer_id == farmer_id,
                ChatMessage.role == "assistant",
                ChatMessage.intent.is_not(None),
            )
            .group_by(ChatMessage.intent)
            .order_by(func.count().desc())
            .limit(5)
        )
    ).all()
    diagnoses = list(
        await session.scalars(
            select(DiagnosisPrediction)
            .where(DiagnosisPrediction.farmer_id == farmer_id)
            .order_by(DiagnosisPrediction.created_at.desc())
            .limit(limit)
        )
    )
    calls = list(
        await session.scalars(
            select(VoiceSession)
            .where(VoiceSession.farmer_id == farmer_id)
            .order_by(VoiceSession.started_at.desc())
            .limit(limit)
        )
    )
    questions = (
        await session.scalar(
            select(func.count())
            .select_from(ChatMessage)
            .join(ChatSession, ChatSession.id == ChatMessage.session_id)
            .where(ChatSession.farmer_id == farmer_id, ChatMessage.role == "farmer")
        )
    ) or 0

    return Activity(
        farmer=brief,
        joined_at=farmer.created_at,
        last_login_at=user.last_login_at if user else None,
        is_active=user.is_active if user else False,
        farms=await _count(session, Farm, Farm.farmer_id == farmer_id),
        questions=questions,
        diagnoses=await _count(
            session, DiagnosisPrediction, DiagnosisPrediction.farmer_id == farmer_id
        ),
        voice_sessions=await _count(session, VoiceSession, VoiceSession.farmer_id == farmer_id),
        top_intents=[IntentCount(intent=i, count=n) for i, n in intents],
        queries=queries[:limit],
        diagnosis_log=[
            DiagnosisLog(
                at=d.created_at,
                kind=d.kind,
                label=d.predicted_label,
                confidence=round(d.confidence, 3),
                accepted=d.accepted,
            )
            for d in diagnoses
        ],
        calls=[
            CallLog(
                at=c.started_at, channel=c.channel.value, seconds=c.duration_seconds, turns=c.turns
            )
            for c in calls
        ],
    )
