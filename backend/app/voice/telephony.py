"""Button-phone voice gateway.

    phone call → Twilio → WebSocket media stream (8 kHz μ-law)
              → voice-activity detection → ASR → AgriBrain → TTS → μ-law → caller

The same AgriBrain, database and models serve the phone and the app. The phone channel
declares `can_send_images=False`, so AgriBrain never asks a caller for a photo.

Bounded by design: a semaphore caps concurrent calls, each call has a hard time limit,
and audio from the caller is ignored while an answer is playing (no unbounded buffering).
"""

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from html import escape

import numpy as np
from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from sqlalchemy import select

from app.assistant.brain import agribrain
from app.auth.schemas import normalize_indian_mobile
from app.auth.service import get_or_create_farmer_user
from app.core.config import get_settings
from app.core.database import SessionFactory
from app.core.errors import Forbidden, ServiceUnavailable
from app.core.language import Language
from app.core.observability import metrics
from app.farmer.context import load_farmer_context
from app.farmer.models import Channel, Farmer
from app.farmer.service import voice_style
from app.language.templates import render
from app.voice import service
from app.voice.audio import (
    SPEECH_SAMPLE_RATE,
    TELEPHONY_SAMPLE_RATE,
    mulaw_decode,
    mulaw_encode,
    resample,
    rms,
)
from app.voice.models import VoiceSession
from app.voice.providers import DEFAULT_STYLE, VoiceStyle, get_voice_provider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice/telephony", tags=["telephony"])

# Keypad → language. Eleven languages fit 1-9 plus * and #; 0 replays this menu.
MENU_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#"]
LANGUAGE_MENU = dict(zip(MENU_KEYS, Language, strict=True))
SILENCE_RMS = 450  # PCM16 energy below which a frame counts as silence
END_OF_UTTERANCE_SECONDS = 0.8
MAX_UTTERANCE_SECONDS = 15
FRAME_BYTES_PER_MESSAGE = 8000  # 1 s of μ-law audio per outbound message

_call_slots: asyncio.Semaphore | None = None


def _slots() -> asyncio.Semaphore:
    global _call_slots
    if _call_slots is None:
        _call_slots = asyncio.Semaphore(get_settings().max_concurrent_calls)
    return _call_slots


def _auth_token() -> str:
    token = get_settings().twilio_auth_token
    if token is None:
        raise ServiceUnavailable("Telephony is not configured", code="telephony_disabled")
    return token.get_secret_value()


def verify_twilio_signature(url: str, params: dict[str, str], signature: str) -> bool:
    """https://www.twilio.com/docs/usage/security#validating-requests"""
    payload = url + "".join(f"{key}{params[key]}" for key in sorted(params))
    digest = hmac.new(_auth_token().encode(), payload.encode(), hashlib.sha1).digest()
    return hmac.compare_digest(base64.b64encode(digest).decode(), signature)


def _stream_token(call_sid: str, caller: str) -> str:
    """Binds the WebSocket to the signed webhook that created it."""
    message = f"{call_sid}:{caller}".encode()
    return hmac.new(_auth_token().encode(), message, hashlib.sha256).hexdigest()


@router.post("/twilio/incoming")
async def twilio_incoming(request: Request) -> Response:
    settings = get_settings()
    form = {k: str(v) for k, v in (await request.form()).items()}
    url = f"{settings.public_base_url.rstrip('/')}{request.url.path}"
    if request.url.query:
        url += f"?{request.url.query}"
    if not verify_twilio_signature(url, form, request.headers.get("X-Twilio-Signature", "")):
        raise Forbidden("Invalid Twilio signature")

    provider = get_voice_provider()
    if not (provider.capabilities.asr and provider.capabilities.tts):
        twiml = (
            "<Response><Say>AgriSmart voice service is not available right now.</Say>"
            "<Hangup/></Response>"
        )
        return Response(twiml, media_type="application/xml")

    call_sid, caller = form.get("CallSid", ""), form.get("From", "")
    stream_url = (
        settings.public_base_url.replace("https://", "wss://")
        .replace("http://", "ws://")
        .rstrip("/")
    )
    stream_url += f"{settings.api_prefix}/voice/telephony/twilio/stream"
    params = {"callSid": call_sid, "caller": caller, "token": _stream_token(call_sid, caller)}
    parameters = "".join(f'<Parameter name="{k}" value="{escape(v)}"/>' for k, v in params.items())
    stream = f'<Stream url="{escape(stream_url)}">{parameters}</Stream>'
    twiml = f"<Response><Connect>{stream}</Connect></Response>"
    return Response(twiml, media_type="application/xml")


@dataclass
class _CallState:
    stream_sid: str = ""
    language: Language = Language.ENGLISH
    voice: VoiceStyle = DEFAULT_STYLE
    farmer_id: uuid.UUID | None = None
    voice_session_id: uuid.UUID | None = None
    chat_session_id: uuid.UUID | None = None
    speaking: bool = False
    awaiting_language: bool = False
    buffer: list[np.ndarray] = field(default_factory=list)
    voiced_seconds: float = 0.0
    silence_seconds: float = 0.0
    turns: int = 0


class TwilioCall:
    def __init__(self, websocket: WebSocket) -> None:
        self.ws = websocket
        self.state = _CallState()
        self.started = time.monotonic()
        self._turn_task: asyncio.Task | None = None

    async def run(self) -> None:
        deadline = get_settings().max_call_seconds
        end_reason = "caller_hung_up"
        try:
            while True:
                remaining = deadline - (time.monotonic() - self.started)
                if remaining <= 0:
                    await self._say(render("voice.time_limit", self.state.language))
                    end_reason = "time_limit"
                    break
                message = json.loads(
                    await asyncio.wait_for(self.ws.receive_text(), timeout=remaining)
                )
                if not await self._on_event(message):
                    break
        except (WebSocketDisconnect, TimeoutError):
            end_reason = (
                "time_limit" if time.monotonic() - self.started >= deadline else "caller_hung_up"
            )
        finally:
            if self._turn_task:
                self._turn_task.cancel()
            await self._finish(end_reason)

    async def _on_event(self, message: dict) -> bool:
        event = message.get("event")
        if event == "start":
            return await self._on_start(message["start"])
        if event == "media" and not self.state.speaking and not self.state.awaiting_language:
            self._on_audio(base64.b64decode(message["media"]["payload"]))
        elif event == "dtmf":
            await self._on_digit(message["dtmf"].get("digit", ""))
        elif event == "mark":
            self.state.speaking = False  # playback finished: listen again
        elif event == "stop":
            return False
        return True

    async def _on_start(self, start: dict) -> bool:
        params = start.get("customParameters", {})
        call_sid, caller = params.get("callSid", ""), params.get("caller", "")
        if not hmac.compare_digest(params.get("token", ""), _stream_token(call_sid, caller)):
            logger.warning("telephony_invalid_stream_token")
            return False
        self.state.stream_sid = start["streamSid"]
        try:
            phone = normalize_indian_mobile(caller)
        except ValueError:
            await self._say(render("voice.unsupported_number", Language.ENGLISH))
            return False

        async with SessionFactory() as session:
            known = await session.scalar(select(Farmer).where(Farmer.phone == phone))
            if known is None:
                user, _ = await get_or_create_farmer_user(
                    session, phone, Language.ENGLISH, Channel.PHONE
                )
                await session.commit()
                farmer = await session.scalar(select(Farmer).where(Farmer.user_id == user.id))
                self.state.awaiting_language = True
            else:
                farmer = known
            self.state.farmer_id = farmer.id
            self.state.language = farmer.preferred_language
            self.state.voice = voice_style(farmer)
            voice_session = await service.start_session(
                session, farmer, Channel.PHONE, farmer.preferred_language, external_call_id=call_sid
            )
            self.state.voice_session_id = voice_session.id

        if self.state.awaiting_language:
            await self._play_language_menu()
        else:
            await self._say(render("voice.welcome", self.state.language))
        return True

    def _on_audio(self, mulaw: bytes) -> None:
        frame = mulaw_decode(mulaw)
        seconds = frame.size / TELEPHONY_SAMPLE_RATE
        if rms(frame) >= SILENCE_RMS:
            self.state.voiced_seconds += seconds
            self.state.silence_seconds = 0.0
        elif self.state.voiced_seconds:
            self.state.silence_seconds += seconds
        if self.state.voiced_seconds:
            self.state.buffer.append(frame)

        utterance_seconds = len(self.state.buffer) * seconds
        if self.state.voiced_seconds and (
            self.state.silence_seconds >= END_OF_UTTERANCE_SECONDS
            or utterance_seconds >= MAX_UTTERANCE_SECONDS
        ):
            audio = np.concatenate(self.state.buffer)
            self.state.buffer.clear()
            self.state.voiced_seconds = self.state.silence_seconds = 0.0
            self.state.speaking = True  # stop listening until the answer has played
            self._turn_task = asyncio.create_task(self._answer(audio))

    async def _on_digit(self, digit: str) -> None:
        if digit in LANGUAGE_MENU:
            self.state.language = LANGUAGE_MENU[digit]
            self.state.awaiting_language = False
            async with SessionFactory() as session:
                farmer = await session.get(Farmer, self.state.farmer_id)
                if farmer:
                    farmer.preferred_language = self.state.language
                    await session.commit()
            await self._say(render("voice.welcome", self.state.language))
        elif digit == "0":
            self.state.awaiting_language = True
            await self._play_language_menu()

    async def _answer(self, audio_8k: np.ndarray) -> None:
        language = self.state.language
        try:
            audio = resample(audio_8k, TELEPHONY_SAMPLE_RATE, SPEECH_SAMPLE_RATE)
            text = await get_voice_provider().transcribe(audio, SPEECH_SAMPLE_RATE, language)
            if not text:
                await self._say(render("voice.didnt_hear", language))
                return
            async with SessionFactory() as session:
                farmer = await session.get(Farmer, self.state.farmer_id)
                ctx = await load_farmer_context(
                    session, farmer, channel=Channel.PHONE, language=language
                )
                reply = await agribrain.handle(session, ctx, text, self.state.chat_session_id)
            self.state.chat_session_id = reply.session_id
            self.state.turns += 1
            await self._say(reply.text)
        except ServiceUnavailable:
            await self._say(render("unavailable.generic", language))
        except Exception:
            logger.exception("telephony_turn_failed")
            await self._say(render("error.generic", language))

    async def _play_language_menu(self) -> None:
        for key, language in LANGUAGE_MENU.items():
            spoken = {"*": "voice.key_star", "#": "voice.key_hash"}.get(key)
            label = render(spoken, language) if spoken else key
            await self._say(
                render("voice.language_option", language, digit=label), language, mark=False
            )
        await self._mark()

    async def _say(self, text: str, language: Language | None = None, *, mark: bool = True) -> None:
        self.state.speaking = True
        try:
            speech = await get_voice_provider().synthesize(
                text, language or self.state.language, self.state.voice
            )
        except ServiceUnavailable:
            self.state.speaking = False
            return
        samples = resample(speech.samples, speech.sample_rate, TELEPHONY_SAMPLE_RATE)
        payload = mulaw_encode(samples)
        for offset in range(0, len(payload), FRAME_BYTES_PER_MESSAGE):
            chunk = base64.b64encode(payload[offset : offset + FRAME_BYTES_PER_MESSAGE]).decode()
            await self.ws.send_text(
                json.dumps(
                    {
                        "event": "media",
                        "streamSid": self.state.stream_sid,
                        "media": {"payload": chunk},
                    }
                )
            )
        if mark:
            await self._mark()

    async def _mark(self) -> None:
        await self.ws.send_text(
            json.dumps(
                {
                    "event": "mark",
                    "streamSid": self.state.stream_sid,
                    "mark": {"name": f"turn-{self.state.turns}"},
                }
            )
        )

    async def _finish(self, reason: str) -> None:
        if self.state.voice_session_id is None:
            return
        async with SessionFactory() as session:
            voice_session = await session.get(VoiceSession, self.state.voice_session_id)
            if voice_session:
                voice_session.turns = self.state.turns
                voice_session.chat_session_id = self.state.chat_session_id
                await service.end_session(session, voice_session, reason)


@router.websocket("/twilio/stream")
async def twilio_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    slots = _slots()
    if slots.locked():
        metrics.inc("voice_calls_rejected", "capacity")
        await websocket.close(code=1013)  # "try again later" — backpressure, not overload
        return
    async with slots:
        await TwilioCall(websocket).run()
