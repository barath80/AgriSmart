import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select

from app.assistant.brain import agribrain
from app.assistant.models import ChatMessage, ChatSession
from app.assistant.schemas import AssistantQuery, AssistantReply
from app.auth.dependencies import CurrentFarmer, DbSession
from app.core.config import get_settings
from app.core.errors import NotFound
from app.core.language import language_of_text
from app.core.rate_limit import rate_limit
from app.farmer.context import load_farmer_context
from app.farmer.models import Channel
from app.farmer.service import voice_style
from app.voice.service import speak

router = APIRouter(prefix="/assistant", tags=["assistant"])


class ChatMessageOut(BaseModel):
    role: str
    text: str
    intent: str | None


@router.post(
    "/query",
    dependencies=[
        Depends(rate_limit("assistant", lambda: get_settings().assistant_rate_limit_per_minute))
    ],
)
async def query(body: AssistantQuery, farmer: CurrentFarmer, session: DbSession) -> AssistantReply:
    # Answer in the language the question is written in; the app's setting is the default.
    language = language_of_text(body.text, body.language or farmer.preferred_language)
    ctx = await load_farmer_context(session, farmer, channel=Channel.APP, language=language)
    reply = await agribrain.handle(session, ctx, body.text, body.session_id)
    if body.speak and (audio := await speak(reply.text, ctx.language, voice_style(farmer))):
        reply.audio_base64, reply.audio_mime = audio
    return reply


@router.get("/sessions/{session_id}/messages")
async def history(
    session_id: uuid.UUID, farmer: CurrentFarmer, session: DbSession
) -> list[ChatMessageOut]:
    owned = await session.scalar(
        select(ChatSession.id).where(
            ChatSession.id == session_id, ChatSession.farmer_id == farmer.id
        )
    )
    if owned is None:
        raise NotFound("Conversation not found", code="chat_not_found")
    messages = await session.scalars(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
        .limit(100)
    )
    return [ChatMessageOut(role=m.role, text=m.text, intent=m.intent) for m in messages]
