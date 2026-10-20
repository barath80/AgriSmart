import base64
import uuid
from collections import OrderedDict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import utcnow
from app.core.errors import NotFound, ServiceUnavailable
from app.core.language import Language
from app.core.observability import metrics
from app.farmer.models import Channel, Farmer
from app.voice.audio import SPEECH_SAMPLE_RATE, decode_to_pcm, write_wav
from app.voice.models import VoiceSession
from app.voice.providers import DEFAULT_STYLE, VoiceStyle, get_voice_provider

MIN_SPEECH_SECONDS = 0.3
MAX_UTTERANCE_SECONDS = 30


# Recently spoken clips. Greetings, voice previews and repeated answers are common, and
# speech providers are rate-limited (Gemini's free tier allows a few clips per minute).
_SPEECH_CACHE: OrderedDict[tuple, tuple[str, str]] = OrderedDict()
_SPEECH_CACHE_SIZE = 200


async def speak(
    text: str, language: Language, style: VoiceStyle = DEFAULT_STYLE
) -> tuple[str, str] | None:
    """Server TTS as base64 WAV in the farmer's chosen voice, or None when the provider
    cannot synthesize speech (the app then uses the phone's own voice)."""
    provider = get_voice_provider()
    if not provider.capabilities.tts:
        return None
    key = (text, language, style.gender, style.voice, round(style.pace, 2))
    if (cached := _SPEECH_CACHE.get(key)) is not None:
        _SPEECH_CACHE.move_to_end(key)
        metrics.inc("speech_cache", "hit")
        return cached
    try:
        speech = await provider.synthesize(text, language, style)
    except ServiceUnavailable:
        return None
    audio = base64.b64encode(write_wav(speech.samples, speech.sample_rate)).decode(), "audio/wav"
    _SPEECH_CACHE[key] = audio
    if len(_SPEECH_CACHE) > _SPEECH_CACHE_SIZE:
        _SPEECH_CACHE.popitem(last=False)
    return audio


async def transcribe_recording(audio: bytes, language: Language) -> str:
    provider = get_voice_provider()
    if not provider.capabilities.asr:
        raise ServiceUnavailable("Speech recognition is not configured", code="asr_unavailable")
    samples = await decode_to_pcm(audio, SPEECH_SAMPLE_RATE)
    seconds = samples.size / SPEECH_SAMPLE_RATE
    if seconds < MIN_SPEECH_SECONDS:
        return ""
    samples = samples[: SPEECH_SAMPLE_RATE * MAX_UTTERANCE_SECONDS]
    return await provider.transcribe(samples, SPEECH_SAMPLE_RATE, language)


async def start_session(
    session: AsyncSession,
    farmer: Farmer,
    channel: Channel,
    language: Language,
    external_call_id: str | None = None,
) -> VoiceSession:
    voice_session = VoiceSession(
        farmer_id=farmer.id,
        channel=channel,
        language=language,
        provider=get_voice_provider().name,
        external_call_id=external_call_id,
    )
    session.add(voice_session)
    await session.commit()
    metrics.inc("voice_sessions", channel.value)
    return voice_session


async def get_owned_session(
    session: AsyncSession, farmer: Farmer, session_id: uuid.UUID
) -> VoiceSession:
    voice_session = await session.scalar(
        select(VoiceSession).where(
            VoiceSession.id == session_id, VoiceSession.farmer_id == farmer.id
        )
    )
    if voice_session is None or voice_session.ended_at is not None:
        raise NotFound("Voice session not found", code="voice_session_not_found")
    return voice_session


async def end_session(session: AsyncSession, voice_session: VoiceSession, reason: str) -> None:
    if voice_session.ended_at is not None:
        return
    voice_session.ended_at = utcnow()
    voice_session.duration_seconds = (
        voice_session.ended_at - voice_session.started_at
    ).total_seconds()
    voice_session.end_reason = reason
    await session.commit()
    metrics.observe_ms(
        "voice_session_duration", voice_session.channel.value, voice_session.duration_seconds * 1000
    )
