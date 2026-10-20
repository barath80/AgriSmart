import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from pydantic import BaseModel, Field

from app.assistant.brain import agribrain
from app.assistant.schemas import AssistantReply
from app.auth.dependencies import CurrentFarmer, DbSession
from app.core.config import get_settings
from app.core.errors import ServiceUnavailable
from app.core.language import Language, language_of_text
from app.core.rate_limit import rate_limit
from app.core.uploads import read_limited
from app.farmer.context import load_farmer_context
from app.farmer.models import Channel
from app.farmer.schemas import VoicePreferences
from app.farmer.service import voice_style
from app.language.templates import render
from app.voice import service
from app.voice.providers import VoiceStyle, get_voice_provider

router = APIRouter(prefix="/voice", tags=["voice"])

AUDIO_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/m4a",
    "audio/x-m4a",
    "audio/mp4",
    "audio/aac",
    "audio/mpeg",
    "audio/ogg",
    "audio/webm",
    "audio/3gpp",
}


class VoiceSessionIn(BaseModel):
    language: Language | None = None
    speak_greeting: bool = False  # synthesizing costs a speech request; ask only if played


class VoiceCapabilitiesOut(BaseModel):
    provider: str
    speech_recognition: bool
    speech_synthesis: bool


class VoiceSessionOut(BaseModel):
    session_id: uuid.UUID
    language: Language
    greeting: str
    greeting_audio_base64: str | None
    audio_mime: str | None
    capabilities: VoiceCapabilitiesOut


def _capabilities() -> VoiceCapabilitiesOut:
    provider = get_voice_provider()
    return VoiceCapabilitiesOut(
        provider=provider.name,
        speech_recognition=provider.capabilities.asr,
        speech_synthesis=provider.capabilities.tts,
    )


@router.get("/capabilities")
async def capabilities(_: CurrentFarmer) -> VoiceCapabilitiesOut:
    return _capabilities()


class VoiceOptionOut(BaseModel):
    id: str
    label: str
    gender: str
    description: str


class VoicesOut(BaseModel):
    provider: str
    speech_synthesis: bool
    voices: list[VoiceOptionOut]  # empty: only female/male can be chosen


@router.get("/voices")
async def voices(farmer: CurrentFarmer) -> VoicesOut:
    provider = get_voice_provider()
    return VoicesOut(
        provider=provider.name,
        speech_synthesis=provider.capabilities.tts,
        voices=[
            VoiceOptionOut(id=v.id, label=v.label, gender=v.gender.value, description=v.description)
            for v in provider.voices(farmer.preferred_language)
        ],
    )


class SpeakIn(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
    language: Language | None = None
    # A voice preview passes the voice being tried, which may not be saved yet.
    voice_preferences: VoicePreferences | None = None


class SpeakOut(BaseModel):
    audio_base64: str
    audio_mime: str


@router.post("/tts", dependencies=[Depends(rate_limit("tts", 30))])
async def text_to_speech(body: SpeakIn, farmer: CurrentFarmer) -> SpeakOut:
    """Speak any text (an alert, a past answer, a voice preview) in the farmer's own voice."""
    style = voice_style(farmer)
    if body.voice_preferences is not None:
        prefs = body.voice_preferences
        style = VoiceStyle(gender=prefs.gender, pace=prefs.pace, voice=prefs.voice)
    audio = await service.speak(body.text, body.language or farmer.preferred_language, style)
    if audio is None:
        raise ServiceUnavailable(
            "Server speech synthesis is not configured", code="tts_unavailable"
        )
    return SpeakOut(audio_base64=audio[0], audio_mime=audio[1])


@router.post("/session", status_code=status.HTTP_201_CREATED)
async def start_session(
    body: VoiceSessionIn, farmer: CurrentFarmer, session: DbSession
) -> VoiceSessionOut:
    language = body.language or farmer.preferred_language
    voice_session = await service.start_session(session, farmer, Channel.APP, language)
    greeting = render("voice.welcome", language)
    audio = (
        await service.speak(greeting, language, voice_style(farmer))
        if body.speak_greeting
        else None
    )
    return VoiceSessionOut(
        session_id=voice_session.id,
        language=language,
        greeting=greeting,
        greeting_audio_base64=audio[0] if audio else None,
        audio_mime=audio[1] if audio else None,
        capabilities=_capabilities(),
    )


@router.post(
    "/session/{session_id}/utterance",
    dependencies=[
        Depends(rate_limit("assistant", lambda: get_settings().assistant_rate_limit_per_minute))
    ],
)
async def utterance(
    session_id: uuid.UUID,
    farmer: CurrentFarmer,
    session: DbSession,
    audio: Annotated[UploadFile, File(description="Recorded question (m4a, wav, ogg...)")],
    chat_session_id: Annotated[uuid.UUID | None, Form()] = None,
) -> AssistantReply:
    """One voice turn: speech → text → AgriBrain → text → speech."""
    voice_session = await service.get_owned_session(session, farmer, session_id)
    data = await read_limited(audio, get_settings().audio_max_bytes, AUDIO_TYPES)
    transcript = await service.transcribe_recording(data, voice_session.language)
    # Answer in the language the farmer actually spoke, not only the app's language.
    language = language_of_text(transcript, voice_session.language, latin_is_english=True)

    ctx = await load_farmer_context(session, farmer, channel=Channel.APP, language=language)
    if not transcript:
        reply = AssistantReply(
            session_id=chat_session_id or voice_session.chat_session_id,
            intent="none",
            handled_by="template",
            language=language,
            text=render("voice.didnt_hear", language),
        )
    else:
        reply = await agribrain.handle(
            session, ctx, transcript, chat_session_id or voice_session.chat_session_id
        )
        voice_session.chat_session_id = reply.session_id
    voice_session.turns += 1
    await session.commit()

    audio_out = await service.speak(reply.text, language, voice_style(farmer))
    if audio_out:
        reply.audio_base64, reply.audio_mime = audio_out
    reply.transcript = transcript
    return reply


@router.post("/session/{session_id}/end", status_code=status.HTTP_204_NO_CONTENT)
async def end_session(session_id: uuid.UUID, farmer: CurrentFarmer, session: DbSession) -> None:
    voice_session = await service.get_owned_session(session, farmer, session_id)
    await service.end_session(session, voice_session, "client_ended")
