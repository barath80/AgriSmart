"""Outbound voice alerts for farmers on basic phones.

A smartphone gets a push notification; a button phone gets a *call* that speaks the alert
in the farmer's language and chosen voice (SMS is the fallback). Flow:

    synthesize (our TTS provider) → store a short-lived clip → Twilio calls the farmer
    → Twilio fetches the clip through a signed, expiring URL and plays it twice.
"""

import hashlib
import hmac
import time
import uuid
from datetime import timedelta
from html import escape

from fastapi import APIRouter, Query
from fastapi.responses import Response
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import DbSession
from app.core.config import get_settings
from app.core.database import utcnow
from app.core.errors import NotFound, ServiceUnavailable
from app.core.http import get_http_client
from app.core.language import Language
from app.voice.audio import TELEPHONY_SAMPLE_RATE, resample, write_wav
from app.voice.models import VoiceClip
from app.voice.providers import VoiceStyle, get_voice_provider

CLIP_TTL = timedelta(hours=2)
router = APIRouter(prefix="/voice/clips", tags=["voice"])


def voice_calls_enabled() -> bool:
    settings = get_settings()
    return bool(
        settings.twilio_account_sid
        and settings.twilio_auth_token
        and settings.twilio_phone_number
        and get_voice_provider().capabilities.tts
    )


def _signature(clip_id: uuid.UUID, expires: int) -> str:
    secret = get_settings().jwt_secret.get_secret_value().encode()
    return hmac.new(secret, f"{clip_id}:{expires}".encode(), hashlib.sha256).hexdigest()


def signed_clip_url(clip_id: uuid.UUID) -> str:
    settings = get_settings()
    expires = int(time.time() + CLIP_TTL.total_seconds())
    base = settings.public_base_url.rstrip("/") + settings.api_prefix
    return f"{base}/voice/clips/{clip_id}.wav?expires={expires}&sig={_signature(clip_id, expires)}"


async def create_clip(
    session: AsyncSession, text: str, language: Language, style: VoiceStyle
) -> VoiceClip:
    speech = await get_voice_provider().synthesize(text, language, style)
    # 8 kHz mono is what the phone network carries; smaller and faster to fetch.
    audio = write_wav(
        resample(speech.samples, speech.sample_rate, TELEPHONY_SAMPLE_RATE), TELEPHONY_SAMPLE_RATE
    )
    clip = VoiceClip(audio=audio, expires_at=utcnow() + CLIP_TTL)
    session.add(clip)
    await session.flush()
    return clip


async def place_alert_call(
    session: AsyncSession, phone: str, text: str, language: Language, style: VoiceStyle
) -> str:
    """Start a call that plays `text` twice. Returns the provider's call id."""
    settings = get_settings()
    if not voice_calls_enabled():
        raise ServiceUnavailable("Voice calls are not configured", code="voice_calls_disabled")
    clip = await create_clip(session, text, language, style)
    await session.commit()  # the clip must be readable before Twilio fetches it
    url = escape(signed_clip_url(clip.id))
    play = f"<Play>{url}</Play>"
    twiml = f'<Response><Pause length="1"/>{play}<Pause length="2"/>{play}</Response>'
    response = await get_http_client().post(
        f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Calls.json",
        data={"To": phone, "From": settings.twilio_phone_number, "Twiml": twiml},
        auth=(settings.twilio_account_sid, settings.twilio_auth_token.get_secret_value()),
        timeout=20,
    )
    if response.status_code >= 400:
        raise ServiceUnavailable(
            f"Call failed: HTTP {response.status_code}", code="voice_call_failed"
        )
    return response.json().get("sid", "")


async def purge_expired_clips(session: AsyncSession) -> None:
    await session.execute(delete(VoiceClip).where(VoiceClip.expires_at < utcnow()))
    await session.commit()


@router.get("/{clip_id}.wav", include_in_schema=False)
async def get_clip(
    clip_id: uuid.UUID,
    session: DbSession,
    expires: int = Query(...),
    sig: str = Query(..., max_length=64),
) -> Response:
    """Public but unguessable: a valid HMAC signature and an unexpired timestamp are required."""
    if expires < time.time() or not hmac.compare_digest(sig, _signature(clip_id, expires)):
        raise NotFound("Clip not found")
    clip = await session.get(VoiceClip, clip_id)
    if clip is None or clip.expires_at < utcnow():
        raise NotFound("Clip not found")
    return Response(
        clip.audio, media_type=clip.mime, headers={"Cache-Control": "private, max-age=600"}
    )
