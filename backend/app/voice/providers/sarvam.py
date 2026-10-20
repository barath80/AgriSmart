"""Sarvam AI — natural Indian voices (Bulbul v3), speech recognition (Saaras) and translation.

Docs: https://docs.sarvam.ai — one API key (`api-subscription-key`) covers all three.
Bulbul v3 voices handle code-mixed speech ("tomato ka rate"), which is how many farmers talk.
"""

import asyncio
import base64
import logging
import random
import time
from contextvars import ContextVar

import httpx
import numpy as np

from app.core.config import get_settings
from app.core.errors import ServiceUnavailable
from app.core.http import get_http_client
from app.core.language import Language
from app.core.observability import Timer, metrics
from app.voice.audio import read_wav, write_wav
from app.voice.providers.base import (
    DEFAULT_STYLE,
    SynthesizedSpeech,
    VoiceCapabilities,
    VoiceGender,
    VoiceOption,
    VoiceStyle,
)

logger = logging.getLogger(__name__)

_BASE = "https://api.sarvam.ai"
_RETRYABLE = {429, 500, 502, 503, 504}
_INTERACTIVE_ATTEMPTS = 3  # about 3 s of waiting at most
_PATIENT_ATTEMPTS = 8  # background jobs: up to about a minute of backoff
_MAX_CONCURRENT_CALLS = 4  # per process; the key's rate limit is shared by every instance

# After "no credits" (HTTP 402) every call would fail the same way and add a wasted round
# trip to each farmer's request, so calls are skipped for a while and the app falls back to
# text plus the phone's own voice. The window is short so a top-up is noticed quickly.
_QUOTA_RETRY_SECONDS = 300
_quota_blocked_until = 0.0

# Set by background jobs that would rather wait than fail.
patient_mode: ContextVar[bool] = ContextVar("sarvam_patient_mode", default=False)
_semaphores: dict[int, asyncio.Semaphore] = {}


def _slots() -> asyncio.Semaphore:
    """One semaphore per event loop (a semaphore must not be shared across loops)."""
    loop_id = id(asyncio.get_running_loop())
    if loop_id not in _semaphores:
        _semaphores[loop_id] = asyncio.Semaphore(_MAX_CONCURRENT_CALLS)
    return _semaphores[loop_id]


def _backoff(attempt: int, retry_after: str | None) -> float:
    """Seconds to wait: the server's Retry-After if sent, else exponential with jitter."""
    if retry_after:
        try:
            return min(float(retry_after), 30.0)
        except ValueError:
            pass
    return min(2.0**attempt, 20.0) * random.uniform(0.7, 1.3)


_TTS_SAMPLE_RATE = 22050
_TTS_MAX_CHARS = 2400  # bulbul:v3 accepts 2,500 per text
_TRANSLATE_MAX_CHARS = 950  # mayura:v1 accepts 1,000

# A curated set of calm, clear voices suited to advice (all speak every supported language).
VOICES = [
    VoiceOption("roopa", "Roopa", VoiceGender.FEMALE, "Gentle and soothing"),
    VoiceOption("kavitha", "Kavitha", VoiceGender.FEMALE, "Graceful and clear"),
    VoiceOption("priya", "Priya", VoiceGender.FEMALE, "Cheerful and engaging"),
    VoiceOption("anand", "Anand", VoiceGender.MALE, "Warm and reassuring"),
    VoiceOption("gokul", "Gokul", VoiceGender.MALE, "Trustworthy and steady"),
    VoiceOption("mani", "Mani", VoiceGender.MALE, "Calm and composed"),
]
_DEFAULT_VOICE = {VoiceGender.FEMALE: "roopa", VoiceGender.MALE: "anand"}
_VOICE_IDS = {v.id for v in VOICES}


def _code(language: Language) -> str:
    # Sarvam writes Odia as "od-IN" (ISO 639-1 is "or").
    return "od-IN" if language is Language.ODIA else f"{language.value}-IN"


def _chunks(text: str, limit: int) -> list[str]:
    """Split on sentence ends so long answers stay natural when stitched together."""
    if len(text) <= limit:
        return [text]
    parts, current = [], ""
    for sentence in text.replace("। ", "।\n").replace(". ", ".\n").splitlines():
        if current and len(current) + len(sentence) + 1 > limit:
            parts.append(current)
            current = ""
        current = f"{current} {sentence}".strip()
        while len(current) > limit:  # a single very long sentence
            parts.append(current[:limit])
            current = current[limit:]
    if current:
        parts.append(current)
    return parts


class SarvamProvider:
    name = "sarvam"
    capabilities = VoiceCapabilities(asr=True, tts=True, translation=True)

    def __init__(self) -> None:
        key = get_settings().sarvam_api_key
        if key is None:
            raise RuntimeError("SARVAM_API_KEY must be set for VOICE_PROVIDER=sarvam")
        self._headers = {"api-subscription-key": key.get_secret_value()}

    async def _post(self, task: str, path: str, **kwargs) -> dict:
        """POST with a shared concurrency cap and retry on 429 / transient 5xx.

        Sarvam rate-limits per key. A farmer waiting on a voice reply tolerates about a
        second of backoff; background jobs (translation warm-up) set `patient_mode` and wait
        as long as needed instead of failing.
        """
        global _quota_blocked_until
        if time.monotonic() < _quota_blocked_until:
            metrics.inc("provider_failures", "sarvam_no_credits")
            raise ServiceUnavailable("Speech service is unreachable", code="voice_unavailable")
        attempts = _PATIENT_ATTEMPTS if patient_mode.get() else _INTERACTIVE_ATTEMPTS
        last: Exception | None = None
        for attempt in range(attempts):
            try:
                async with _slots():
                    with Timer() as timer:
                        response = await get_http_client().post(
                            f"{_BASE}{path}", headers=self._headers, timeout=30, **kwargs
                        )
                if response.status_code == 402:
                    _quota_blocked_until = time.monotonic() + _QUOTA_RETRY_SECONDS
                    logger.error(
                        "sarvam_no_credits",
                        extra={"task": task, "retry_in_seconds": _QUOTA_RETRY_SECONDS},
                    )
                    metrics.inc("provider_failures", "sarvam_no_credits")
                    break
                if response.status_code in _RETRYABLE and attempt < attempts - 1:
                    metrics.inc("provider_retries", f"sarvam_{response.status_code}")
                    await asyncio.sleep(_backoff(attempt, response.headers.get("retry-after")))
                    continue
                response.raise_for_status()
                metrics.observe_ms("voice_provider", f"sarvam_{task}", timer.ms)
                return response.json()
            except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                last = exc
                transient = isinstance(exc, httpx.TransportError)
                if transient and attempt < attempts - 1:
                    await asyncio.sleep(_backoff(attempt, None))
                    continue
                break
        metrics.inc("provider_failures", "sarvam")
        logger.warning("sarvam_request_failed", extra={"task": task, "error": str(last)[:200]})
        raise ServiceUnavailable(
            "Speech service is unreachable", code="voice_unavailable"
        ) from last

    async def transcribe(self, samples: np.ndarray, sample_rate: int, language: Language) -> str:
        files = {"file": ("speech.wav", write_wav(samples, sample_rate), "audio/wav")}
        data = {"model": "saaras:v3", "language_code": _code(language), "mode": "transcribe"}
        result = await self._post("asr", "/speech-to-text", files=files, data=data)
        return (result.get("transcript") or "").strip()

    async def synthesize(
        self, text: str, language: Language, style: VoiceStyle = DEFAULT_STYLE
    ) -> SynthesizedSpeech:
        speaker = style.voice if style.voice in _VOICE_IDS else _DEFAULT_VOICE[style.gender]
        pace = min(max(style.pace, 0.5), 2.0)

        async def one(part: str) -> np.ndarray:
            result = await self._post(
                "tts",
                "/text-to-speech",
                json={
                    "text": part,
                    "language_code": _code(language),
                    "speaker": speaker,
                    "model": "bulbul:v3",
                    "pace": pace,
                    "speech_sample_rate": _TTS_SAMPLE_RATE,
                    "output_audio_codec": "wav",
                },
            )
            samples, _ = read_wav(base64.b64decode(result["audios"][0]))
            return samples

        pieces = await asyncio.gather(*(one(p) for p in _chunks(text, _TTS_MAX_CHARS)))
        return SynthesizedSpeech(samples=np.concatenate(pieces), sample_rate=_TTS_SAMPLE_RATE)

    async def translate(self, texts: list[str], source: Language, target: Language) -> list[str]:
        async def one(text: str) -> str:
            if len(text) > _TRANSLATE_MAX_CHARS:
                parts = await asyncio.gather(*(one(p) for p in _chunks(text, _TRANSLATE_MAX_CHARS)))
                return " ".join(parts)
            result = await self._post(
                "translation",
                "/translate",
                json={
                    "input": text,
                    "source_language_code": _code(source),
                    "target_language_code": _code(target),
                    "model": "mayura:v1",
                    "mode": "modern-colloquial",
                },
            )
            return result["translated_text"]

        semaphore = asyncio.Semaphore(3)  # per request; `_slots()` caps the whole process

        async def bounded(text: str) -> str:
            async with semaphore:
                return await one(text)

        return list(await asyncio.gather(*(bounded(t) for t in texts)))

    def voices(self, language: Language) -> list[VoiceOption]:
        return VOICES
