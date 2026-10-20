"""Voice features: Sarvam adapter (HTTP mocked), voice preferences, TTS endpoints,
alert inbox read aloud, and outbound voice-call alerts for button-phone farmers."""

import base64
import json
from datetime import date

import httpx
import numpy as np
import pytest

from app.core.language import Language
from app.voice.audio import read_wav, write_wav
from app.voice.providers.base import SynthesizedSpeech, VoiceCapabilities, VoiceGender, VoiceOption, VoiceStyle
from tests.conftest import login_farmer, sms

API = "/api/v1"


def tone(seconds: float = 0.5, rate: int = 22050) -> np.ndarray:
    t = np.linspace(0, seconds, int(rate * seconds), endpoint=False)
    return (3000 * np.sin(2 * np.pi * 220 * t)).astype(np.int16)


class FakeVoice:
    """A complete voice provider without network access."""

    name = "fake"
    capabilities = VoiceCapabilities(asr=True, tts=True, translation=True)
    spoken: list[tuple[str, Language, VoiceStyle]] = []

    async def transcribe(self, samples, sample_rate, language):
        return "नमस्ते"

    async def synthesize(self, text, language, style=VoiceStyle()):
        FakeVoice.spoken.append((text, language, style))
        return SynthesizedSpeech(samples=tone(), sample_rate=22050)

    async def translate(self, texts, source, target):
        return [f"[{target.value}] {t}" for t in texts]

    def voices(self, language):
        return [VoiceOption("roopa", "Roopa", VoiceGender.FEMALE, "Gentle")]


@pytest.fixture
def fake_voice(monkeypatch):
    FakeVoice.spoken = []
    provider = FakeVoice()
    for target in ("app.voice.service", "app.voice.router", "app.voice.outbound", "app.language.service"):
        monkeypatch.setattr(f"{target}.get_voice_provider", lambda: provider)
    return provider


# --- Sarvam adapter --------------------------------------------------------------------------

@pytest.fixture
def sarvam(monkeypatch):
    calls: list[tuple[str, dict]] = []
    wav = base64.b64encode(write_wav(tone(0.2), 22050)).decode()

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["api-subscription-key"] == "test-key"
        path = request.url.path
        if path == "/text-to-speech":
            body = json.loads(request.content)
            calls.append((path, body))
            return httpx.Response(200, json={"audios": [wav]})
        if path == "/translate":
            body = json.loads(request.content)
            calls.append((path, body))
            return httpx.Response(200, json={"translated_text": f"TA:{body['input']}"})
        if path == "/speech-to-text":
            calls.append((path, {"multipart": True}))
            return httpx.Response(200, json={"transcript": " நாளை மழை வருமா ", "language_code": "ta-IN"})
        return httpx.Response(404)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr("app.voice.providers.sarvam.get_http_client", lambda: client)
    monkeypatch.setenv("SARVAM_API_KEY", "test-key")
    from app.core.config import get_settings

    get_settings.cache_clear()
    from app.voice.providers.sarvam import SarvamProvider

    yield SarvamProvider(), calls
    get_settings.cache_clear()


async def test_sarvam_speaks_in_the_chosen_voice_and_pace(sarvam):
    provider, calls = sarvam
    speech = await provider.synthesize("வணக்கம்", Language.TAMIL, VoiceStyle(gender=VoiceGender.MALE, pace=0.8))
    assert speech.sample_rate == 22050 and speech.samples.size > 0
    _, body = calls[-1]
    assert body["language_code"] == "ta-IN" and body["speaker"] == "anand" and body["pace"] == 0.8
    await provider.synthesize("வணக்கம்", Language.TAMIL, VoiceStyle(voice="kavitha"))
    assert calls[-1][1]["speaker"] == "kavitha"
    await provider.synthesize("hi", Language.HINDI, VoiceStyle(voice="not-a-voice"))
    assert calls[-1][1]["speaker"] == "roopa"  # unknown voice → gender default, never an API error


async def test_sarvam_splits_long_text_and_stitches_audio(sarvam):
    provider, calls = sarvam
    long_text = "இது ஒரு நீண்ட வாக்கியம். " * 200  # > 2,400 characters
    speech = await provider.synthesize(long_text, Language.TAMIL)
    tts_calls = [c for c in calls if c[0] == "/text-to-speech"]
    assert len(tts_calls) >= 2 and all(len(c[1]["text"]) <= 2400 for c in tts_calls)
    assert speech.samples.size == read_wav(write_wav(tone(0.2), 22050))[0].size * len(tts_calls)


async def test_sarvam_transcribe_and_translate(sarvam):
    provider, calls = sarvam
    assert await provider.transcribe(tone(1.0, 16000), 16000, Language.TAMIL) == "நாளை மழை வருமா"
    assert await provider.translate(["Spray copper", "Remove leaves"], Language.ENGLISH, Language.TAMIL) == [
        "TA:Spray copper", "TA:Remove leaves"]
    assert {c[1]["target_language_code"] for c in calls if c[0] == "/translate"} == {"ta-IN"}


# --- Voice preferences & TTS endpoints -------------------------------------------------------

async def test_voice_preferences_are_saved_and_used(client, fake_voice):
    headers, _ = await login_farmer(client, language="hi")
    profile = (await client.get(f"{API}/farmer/profile", headers=headers)).json()
    assert profile["voice_preferences"] == {"gender": "female", "pace": 1.0, "voice": None}

    update = {"voice_preferences": {"gender": "male", "pace": 0.85, "voice": None}}
    assert (await client.put(f"{API}/farmer/profile", headers=headers, json=update)).status_code == 200
    spoken = await client.post(f"{API}/voice/tts", headers=headers, json={"text": "नमस्ते किसान भाई"})
    assert spoken.status_code == 200 and spoken.json()["audio_mime"] == "audio/wav"
    text, language, style = FakeVoice.spoken[-1]
    assert language is Language.HINDI and style.gender is VoiceGender.MALE and style.pace == 0.85

    too_fast = {"voice_preferences": {"gender": "male", "pace": 3}}
    assert (await client.put(f"{API}/farmer/profile", headers=headers, json=too_fast)).status_code == 422


async def test_voice_catalog_and_tts_without_provider(client, farmer):
    voices = (await client.get(f"{API}/voice/voices", headers=farmer)).json()
    assert voices["provider"] == "none" and voices["speech_synthesis"] is False
    response = await client.post(f"{API}/voice/tts", headers=farmer, json={"text": "hello"})
    assert response.status_code == 503 and response.json()["error"]["code"] == "tts_unavailable"


async def test_voice_conversation_turn_end_to_end(client, fake_voice, onboarded_farmer, monkeypatch):
    monkeypatch.setattr("app.voice.service.get_voice_provider", lambda: fake_voice)
    quiet = (await client.post(f"{API}/voice/session", headers=onboarded_farmer, json={"language": "hi"})).json()
    assert quiet["greeting_audio_base64"] is None  # speech is only synthesized when asked for
    session = (await client.post(f"{API}/voice/session", headers=onboarded_farmer,
                                 json={"language": "hi", "speak_greeting": True})).json()
    assert session["greeting_audio_base64"] and session["capabilities"]["speech_recognition"]
    recording = write_wav(tone(1.0, 16000), 16000)
    turn = await client.post(f"{API}/voice/session/{session['session_id']}/utterance", headers=onboarded_farmer,
                             files={"audio": ("q.wav", recording, "audio/wav")})
    assert turn.status_code == 200, turn.text
    body = turn.json()
    assert body["transcript"] == "नमस्ते" and body["intent"] == "greeting" and body["audio_base64"]


# --- Alerts: inbox, read aloud by the assistant, voice calls ----------------------------------

def _alert(key: str) -> dict:
    return {
        "idempotency_key": key, "category": "weather",
        "title": {"en": "Heavy rain", "hi": "भारी बारिश"},
        "body": {"en": "Delay spraying", "hi": "छिड़काव टालें"},
        "target": {"states": ["Gujarat"]},
    }


async def _gujarat_farmer(client, language="hi"):
    headers, phone = await login_farmer(client, language=language)
    await client.put(f"{API}/farmer/profile", headers=headers,
                     json={"name": "Ramesh", "location": {"state": "Gujarat", "district": "Anand"}})
    return headers, phone


async def test_inbox_lists_alerts_in_language_and_marks_read(client, admin):
    headers, _ = await _gujarat_farmer(client)
    await client.post(f"{API}/admin/notifications", headers=admin, json=_alert(f"inbox-{date.today()}"))
    inbox = (await client.get(f"{API}/notifications", headers=headers)).json()
    assert inbox["unread"] >= 1
    assert inbox["items"][0]["title"] == "भारी बारिश" and inbox["items"][0]["read"] is False
    assert (await client.post(f"{API}/notifications/read", headers=headers, json={})).status_code == 204
    assert (await client.get(f"{API}/notifications", headers=headers)).json()["unread"] == 0


async def test_assistant_reads_unread_alerts_aloud(client, admin):
    headers, _ = await _gujarat_farmer(client)
    await client.post(f"{API}/admin/notifications", headers=admin, json=_alert("assistant-read-1"))
    reply = (await client.post(f"{API}/assistant/query", headers=headers, json={"text": "कोई सूचना है?"})).json()
    assert reply["intent"] == "notifications"
    assert "भारी बारिश" in reply["text"] and "छिड़काव टालें" in reply["text"]
    again = (await client.post(f"{API}/assistant/query", headers=headers, json={"text": "कोई सूचना है?"})).json()
    assert again["text"] == "आपके लिए कोई नई सूचना नहीं है।"


async def test_button_phone_farmer_gets_a_voice_call(client, admin, fake_voice, monkeypatch):
    from app.core.config import get_settings
    from app.core.database import SessionFactory
    from app.farmer.models import Channel, Farmer
    from app.notification.service import dispatch_pending
    from sqlalchemy import select, update

    headers, phone = await _gujarat_farmer(client)
    async with SessionFactory() as session:  # this farmer only ever calls in from a basic phone
        await session.execute(update(Farmer).where(Farmer.phone == f"+91{phone}").values(primary_channel=Channel.PHONE))
        await session.commit()

    calls: list[dict] = []

    def twilio(request: httpx.Request) -> httpx.Response:
        calls.append(dict(httpx.QueryParams(request.content.decode())))
        return httpx.Response(201, json={"sid": "CA123"})

    monkeypatch.setattr("app.voice.outbound.get_http_client",
                        lambda: httpx.AsyncClient(transport=httpx.MockTransport(twilio)))
    settings = get_settings()
    monkeypatch.setattr(settings, "twilio_account_sid", "AC1")
    monkeypatch.setattr(settings, "twilio_auth_token", type(settings.jwt_secret)("token"))
    monkeypatch.setattr(settings, "twilio_phone_number", "+911234567890")

    await client.post(f"{API}/admin/notifications", headers=admin, json=_alert("voice-call-1"))
    async with SessionFactory() as session:
        await dispatch_pending(session, 500)

    call = next(c for c in calls if c["To"] == f"+91{phone}")
    assert call["From"] == "+911234567890" and "<Play>" in call["Twiml"]
    assert any(text.startswith("भारी बारिश") for text, *_ in FakeVoice.spoken)

    # Twilio can fetch the clip through the signed URL — and only through it.
    clip_url = httpx.URL(call["Twiml"].split("<Play>")[1].split("</Play>")[0].replace("&amp;", "&"))
    ok = await client.get(clip_url.path, params=dict(clip_url.params))
    assert ok.status_code == 200 and ok.headers["content-type"] == "audio/wav"
    forged = dict(clip_url.params) | {"sig": "0" * 64}
    assert (await client.get(clip_url.path, params=forged)).status_code == 404


async def test_voice_alert_falls_back_to_sms_when_calls_fail(client, admin, fake_voice, monkeypatch):
    from app.core.config import get_settings
    from app.core.database import SessionFactory
    from app.farmer.models import Channel, Farmer
    from app.notification.service import dispatch_pending
    from sqlalchemy import update

    headers, phone = await _gujarat_farmer(client)
    async with SessionFactory() as session:
        await session.execute(update(Farmer).where(Farmer.phone == f"+91{phone}").values(primary_channel=Channel.PHONE))
        await session.commit()
    settings = get_settings()
    monkeypatch.setattr(settings, "twilio_account_sid", "AC1")
    monkeypatch.setattr(settings, "twilio_auth_token", type(settings.jwt_secret)("token"))
    monkeypatch.setattr(settings, "twilio_phone_number", "+911234567890")
    monkeypatch.setattr("app.voice.outbound.get_http_client",
                        lambda: httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(500))))

    await client.post(f"{API}/admin/notifications", headers=admin, json=_alert("voice-fallback-1"))
    before = len(sms.sent)
    async with SessionFactory() as session:
        await dispatch_pending(session, 500)
    assert any(to == f"+91{phone}" and "भारी बारिश" in text for to, text in sms.sent[before:])


async def test_sarvam_backs_off_on_rate_limit_then_succeeds(monkeypatch):
    from app.core.config import get_settings
    from app.voice.providers import sarvam as module

    attempts = {"n": 0}
    delays: list[float] = []

    def handler(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        if attempts["n"] < 3:
            return httpx.Response(429, headers={"retry-after": "2"}, json={"error": "rate"})
        return httpx.Response(200, json={"translated_text": "ok"})

    async def no_sleep(seconds: float) -> None:
        delays.append(seconds)

    monkeypatch.setattr(module, "get_http_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    monkeypatch.setattr(module.asyncio, "sleep", no_sleep)
    monkeypatch.setenv("SARVAM_API_KEY", "test-key")
    get_settings.cache_clear()
    result = await module.SarvamProvider().translate(["hello"], Language.ENGLISH, Language.TAMIL)
    get_settings.cache_clear()
    assert result == ["ok"] and attempts["n"] == 3
    assert delays == [2.0, 2.0]  # the server's Retry-After is honoured


async def test_sarvam_gives_up_quickly_for_a_waiting_farmer_but_waits_for_background_jobs(monkeypatch):
    from app.core.config import get_settings
    from app.core.errors import ServiceUnavailable
    from app.voice.providers import sarvam as module

    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(429, json={"error": "rate"})

    async def no_sleep(seconds: float) -> None:
        return None

    monkeypatch.setattr(module, "get_http_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    monkeypatch.setattr(module.asyncio, "sleep", no_sleep)
    monkeypatch.setenv("SARVAM_API_KEY", "test-key")
    get_settings.cache_clear()
    provider = module.SarvamProvider()
    with pytest.raises(ServiceUnavailable):
        await provider.translate(["x"], Language.ENGLISH, Language.TAMIL)
    interactive_calls = calls["n"]
    module.patient_mode.set(True)
    try:
        with pytest.raises(ServiceUnavailable):
            await provider.translate(["x"], Language.ENGLISH, Language.TAMIL)
    finally:
        module.patient_mode.set(False)
        get_settings.cache_clear()
    assert interactive_calls == 3 and calls["n"] - interactive_calls == 8


async def test_compressed_phone_and_browser_recordings_are_decoded(tmp_path):
    """m4a (phones), webm/opus (browsers), ogg and mp3 all become 16 kHz mono PCM."""
    import subprocess

    from app.voice.audio import decode_to_pcm, find_ffmpeg

    ffmpeg = find_ffmpeg()
    if ffmpeg is None:
        pytest.skip("no ffmpeg available")
    source = tmp_path / "tone.wav"
    source.write_bytes(write_wav(tone(1.0), 22050))
    for extension, codec in (("m4a", "aac"), ("webm", "libopus"), ("ogg", "libvorbis"), ("mp3", "libmp3lame")):
        target = tmp_path / f"tone.{extension}"
        subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(source), "-c:a", codec, str(target)], check=True)
        pcm = await decode_to_pcm(target.read_bytes())
        assert 0.8 < len(pcm) / 16000 < 1.3, extension


async def test_out_of_credits_fails_fast_then_recovers(monkeypatch):
    """HTTP 402 means "top up your account": stop calling for a while instead of adding a
    doomed round trip to every farmer's request, then try again."""
    from app.core.config import get_settings
    from app.core.errors import ServiceUnavailable
    from app.voice.providers import sarvam as module

    calls = {"n": 0}
    out_of_credits = {"value": True}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if out_of_credits["value"]:
            return httpx.Response(402, json={"error": {"code": "insufficient_quota_error"}})
        return httpx.Response(200, json={"translated_text": "ok"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(module, "get_http_client", lambda: client)
    monkeypatch.setenv("SARVAM_API_KEY", "test-key")
    get_settings.cache_clear()
    module._quota_blocked_until = 0.0
    provider = module.SarvamProvider()
    try:
        for _ in range(3):
            with pytest.raises(ServiceUnavailable):
                await provider.translate(["x"], Language.ENGLISH, Language.TAMIL)
        assert calls["n"] == 1  # one real attempt, then the breaker answered the rest
        out_of_credits["value"] = False
        module._quota_blocked_until = 0.0  # the retry window passed
        assert await provider.translate(["x"], Language.ENGLISH, Language.TAMIL) == ["ok"]
    finally:
        module._quota_blocked_until = 0.0
        get_settings.cache_clear()
