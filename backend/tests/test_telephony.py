"""Button-phone gateway: Twilio webhook security and a full simulated call."""

import asyncio
import base64
import hashlib
import hmac
import json

import numpy as np
import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import SessionFactory
from app.voice import telephony
from app.voice.audio import TELEPHONY_SAMPLE_RATE, mulaw_decode, mulaw_encode
from app.voice.models import VoiceSession
from app.voice.providers.base import SynthesizedSpeech, VoiceCapabilities
from tests.conftest import login_farmer

API = "/api/v1"
TOKEN = "unit-test-twilio-token"
CALL_SID = "CA" + "2" * 32


@pytest.fixture
def twilio(monkeypatch):
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", TOKEN)
    monkeypatch.setenv("PUBLIC_BASE_URL", "http://testserver")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


class FakeVoice:
    """Hears a fixed question and answers with a tone, like a perfect ASR/TTS pair."""

    name = "fake"
    capabilities = VoiceCapabilities(asr=True, tts=True, translation=False)

    def __init__(self, heard: str) -> None:
        self.heard, self.spoken = heard, []

    async def transcribe(self, samples, sample_rate, language):
        return self.heard

    async def synthesize(self, text, language, style=None):
        self.spoken.append(text)
        tone = 9000 * np.sin(2 * np.pi * 300 * np.arange(8000) / 8000)
        return SynthesizedSpeech(samples=tone.astype(np.int16), sample_rate=8000)

    def voices(self, language):
        return []


class FakeSocket:
    """Plays Twilio's side of the WebSocket: feeds events in, records what the server sends."""

    def __init__(self, events: list[dict]) -> None:
        self.inbox: asyncio.Queue[str] = asyncio.Queue()
        for event in events:
            self.inbox.put_nowait(json.dumps(event))
        self.sent: list[dict] = []

    async def receive_text(self) -> str:
        return await self.inbox.get()

    async def send_text(self, text: str) -> None:
        message = json.loads(text)
        self.sent.append(message)
        if message["event"] == "mark":  # Twilio echoes a mark once playback has finished
            self.inbox.put_nowait(json.dumps({"event": "mark", "mark": message["mark"]}))

    def feed(self, event: dict) -> None:
        self.inbox.put_nowait(json.dumps(event))

    async def wait_for_marks(self, count: int) -> None:
        for _ in range(300):
            if sum(m["event"] == "mark" for m in self.sent) >= count:
                return
            await asyncio.sleep(0.05)
        raise AssertionError(f"timed out; sent={[m['event'] for m in self.sent]}")


def _signature(url: str, form: dict[str, str]) -> str:
    payload = url + "".join(f"{k}{form[k]}" for k in sorted(form))
    return base64.b64encode(hmac.new(TOKEN.encode(), payload.encode(), hashlib.sha1).digest()).decode()


def _media(payload: bytes) -> dict:
    return {"event": "media", "media": {"payload": base64.b64encode(payload).decode()}}


def _start(phone: str, token: str | None = None) -> dict:
    return {"event": "start", "start": {"streamSid": "MZ1", "customParameters": {
        "callSid": CALL_SID, "caller": phone, "token": token or telephony._stream_token(CALL_SID, phone)}}}


async def test_webhook_rejects_forged_requests_and_signs_the_stream(client, twilio, monkeypatch):
    monkeypatch.setattr("app.voice.telephony.get_voice_provider", lambda: FakeVoice("x"))
    url = "http://testserver/api/v1/voice/telephony/twilio/incoming"
    form = {"CallSid": CALL_SID, "From": "+919876500111"}
    forged = await client.post(
        f"{API}/voice/telephony/twilio/incoming", data=form, headers={"X-Twilio-Signature": "forged"}
    )
    assert forged.status_code == 403

    ok = await client.post(
        f"{API}/voice/telephony/twilio/incoming", data=form, headers={"X-Twilio-Signature": _signature(url, form)}
    )
    assert ok.status_code == 200 and "application/xml" in ok.headers["content-type"]
    assert 'url="ws://testserver/api/v1/voice/telephony/twilio/stream"' in ok.text
    assert f'name="token" value="{telephony._stream_token(CALL_SID, form["From"])}"' in ok.text


async def test_a_caller_cannot_open_the_stream_without_the_signed_token(twilio, monkeypatch):
    fake = FakeVoice("x")
    monkeypatch.setattr("app.voice.telephony.get_voice_provider", lambda: fake)
    socket = FakeSocket([_start("+919876500111", token="guessed")])
    await telephony.TwilioCall(socket).run()
    assert socket.sent == [] and fake.spoken == []  # hung up without a word


async def test_full_call_known_farmer_asks_about_rain_and_hears_the_answer(client, twilio, monkeypatch):
    headers, phone = await login_farmer(client, "ta")
    await client.put(f"{API}/farmer/profile", headers=headers, json={
        "name": "Ravi",
        "location": {"state": "Tamil Nadu", "district": "Thanjavur", "latitude": 10.78, "longitude": 79.13},
    })
    fake = FakeVoice("நாளை மழை பெய்யுமா?")
    monkeypatch.setattr("app.voice.telephony.get_voice_provider", lambda: fake)

    loud = mulaw_encode((9000 * np.sin(2 * np.pi * 300 * np.arange(8000) / 8000)).astype(np.int16))
    socket = FakeSocket([_start(phone)])
    call = asyncio.create_task(telephony.TwilioCall(socket).run())

    await socket.wait_for_marks(1)  # the greeting has played
    for offset in range(0, len(loud), 160):  # 20 ms frames, like Twilio
        socket.feed(_media(loud[offset : offset + 160]))
    for _ in range(60):  # 1.2 s of silence ends the caller's turn
        socket.feed(_media(bytes([0xFF]) * 160))
    await socket.wait_for_marks(2)  # the answer has played
    socket.feed({"event": "stop"})
    await asyncio.wait_for(call, timeout=10)

    assert fake.spoken[0].startswith("வணக்கம்")  # greeting in the farmer's own language
    assert "மழை" in fake.spoken[1]  # the rain forecast, spoken in Tamil
    frames = [m for m in socket.sent if m["event"] == "media"]
    assert frames and all(m["streamSid"] == "MZ1" for m in frames)
    audio = mulaw_decode(base64.b64decode(frames[-1]["media"]["payload"]))
    assert audio.size and np.abs(audio).max() > 1000 and TELEPHONY_SAMPLE_RATE == 8000

    async with SessionFactory() as session:
        row = await session.scalar(select(VoiceSession).where(VoiceSession.external_call_id == CALL_SID))
        assert row.channel.value == "phone" and row.turns == 1 and row.ended_at is not None
