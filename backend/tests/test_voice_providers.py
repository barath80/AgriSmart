import base64

import httpx
import numpy as np
import pytest

import app.core.gemini as core_gemini
import app.voice.providers.gemini as gemini
from app.core.errors import ServiceUnavailable
from app.core.language import Language, language_of_text
from app.voice import service
from app.voice.audio import write_wav
from app.voice.providers.base import SynthesizedSpeech, VoiceCapabilities, VoiceGender, VoiceStyle
from app.voice.providers.fallback import FallbackVoiceProvider


class Broken:
    name = "sarvam"
    capabilities = VoiceCapabilities(asr=True, tts=True, translation=True)
    calls = 0

    async def _fail(self, *args, **kwargs):
        Broken.calls += 1
        raise ServiceUnavailable("no credits", code="voice_unavailable")

    transcribe = synthesize = translate = _fail

    def voices(self, language):
        return []


class Working:
    name = "gemini"
    capabilities = VoiceCapabilities(asr=True, tts=True, translation=True)

    async def transcribe(self, samples, sample_rate, language):
        return "வணக்கம்"

    async def synthesize(self, text, language, style=None):
        return SynthesizedSpeech(samples=np.zeros(10, dtype=np.int16), sample_rate=24000)

    async def translate(self, texts, source, target):
        return [f"[{target.value}] {t}" for t in texts]

    def voices(self, language):
        return []


async def test_fallback_provider_covers_every_task_when_the_main_one_fails():
    voice = FallbackVoiceProvider(Broken(), Working())
    assert voice.name == "sarvam+gemini"
    assert await voice.transcribe(np.zeros(10, dtype=np.int16), 16000, Language.TAMIL) == "வணக்கம்"
    assert (await voice.synthesize("hi", Language.TAMIL)).sample_rate == 24000
    assert await voice.translate(["Rain"], Language.ENGLISH, Language.TAMIL) == ["[ta] Rain"]


async def test_fallback_provider_reports_failure_when_both_fail():
    voice = FallbackVoiceProvider(Broken(), Broken())
    with pytest.raises(ServiceUnavailable):
        await voice.synthesize("hi", Language.HINDI)


def test_spoken_english_is_answered_in_english_but_typed_latin_keeps_the_app_language():
    assert language_of_text("what is the weather today", Language.TAMIL, latin_is_english=True) is Language.ENGLISH
    assert language_of_text("what is the weather today", Language.TAMIL) is Language.TAMIL
    assert language_of_text("இன்று வானிலை", Language.ENGLISH, latin_is_english=True) is Language.TAMIL


def test_gemini_audio_parts_are_read_as_wav_or_raw_pcm():
    tone = (1000 * np.sin(np.linspace(0, 20, 2400))).astype(np.int16)
    as_wav = {"mimeType": "audio/wav", "data": base64.b64encode(write_wav(tone, 24000)).decode()}
    samples, rate = gemini._pcm_from_part(as_wav)
    assert rate == 24000 and np.array_equal(samples, tone)
    raw = {"mimeType": "audio/L16;codec=pcm;rate=24000", "data": base64.b64encode(tone.tobytes()).decode()}
    samples, rate = gemini._pcm_from_part(raw)
    assert rate == 24000 and np.array_equal(samples, tone)


async def test_gemini_rests_a_rate_limited_model_and_uses_the_next(monkeypatch):
    monkeypatch.setattr(core_gemini, "_resting", {})
    tone = np.zeros(2400, dtype=np.int16)
    audio = {"inlineData": {"mimeType": "audio/L16;rate=24000", "data": base64.b64encode(tone.tobytes()).decode()}}
    asked: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        model = request.url.path.rsplit("/", 1)[-1].split(":")[0]
        asked.append(model)
        if model == "tts-a":
            return httpx.Response(429, json={"error": {"details": [{"retryDelay": "40s"}]}})
        voice = request.read().decode()
        assert '"voiceName": "Charon"' in voice or '"voiceName":"Charon"' in voice  # male voice
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [audio]}}]})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(core_gemini, "get_http_client", lambda: client)
    provider = gemini.GeminiVoiceProvider()
    provider._tts_models = ["tts-a", "tts-b"]
    speech = await provider.synthesize("ನಮಸ್ಕಾರ", Language.KANNADA, VoiceStyle(gender=VoiceGender.MALE))
    assert speech.sample_rate == 24000 and asked == ["tts-a", "tts-b"]
    await provider.synthesize("ನಮಸ್ಕಾರ ರೈತರೇ", Language.KANNADA, VoiceStyle(gender=VoiceGender.MALE))
    assert asked == ["tts-a", "tts-b", "tts-b"]  # the rate-limited model is rested
    await client.aclose()


async def test_spoken_clips_are_cached(monkeypatch):
    counted = Working()
    calls = 0

    async def synthesize(text, language, style=None):
        nonlocal calls
        calls += 1
        return SynthesizedSpeech(samples=np.zeros(10, dtype=np.int16), sample_rate=24000)

    counted.synthesize = synthesize
    monkeypatch.setattr(service, "get_voice_provider", lambda: counted)
    monkeypatch.setattr(service, "_SPEECH_CACHE", type(service._SPEECH_CACHE)())
    first = await service.speak("வணக்கம்", Language.TAMIL)
    second = await service.speak("வணக்கம்", Language.TAMIL)
    other_voice = await service.speak("வணக்கம்", Language.TAMIL, VoiceStyle(gender=VoiceGender.MALE))
    assert first == second and other_voice is not None and calls == 2


async def test_gemini_moves_on_when_a_model_cannot_speak_the_language(monkeypatch):
    monkeypatch.setattr(core_gemini, "_resting", {})
    tone = np.zeros(2400, dtype=np.int16)
    audio = {"inlineData": {"mimeType": "audio/L16;rate=24000", "data": base64.b64encode(tone.tobytes()).decode()}}
    asked: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        model = request.url.path.rsplit("/", 1)[-1].split(":")[0]
        asked.append(model)
        if model == "no-odia":
            return httpx.Response(200, json={"candidates": [{"finishReason": "OTHER"}]})
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [audio]}}]})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(core_gemini, "get_http_client", lambda: client)
    provider = gemini.GeminiVoiceProvider()
    provider._tts_models = ["no-odia", "speaks-odia"]
    speech = await provider.synthesize("ଆଜି ପାଣିପାଗ", Language.ODIA)
    assert speech.sample_rate == 24000 and asked == ["no-odia", "speaks-odia"]
    await client.aclose()
