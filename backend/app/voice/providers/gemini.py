"""Google Gemini: speech recognition, male and female voices, and translation in all 11
languages, with the same GEMINI_API_KEY as the assistant.

It is a full voice provider on its own and the usual fallback when Sarvam is out of credits.
Each Gemini model has its own rate limit (on the free tier only a few speech requests per
minute), so every task lists several models: a model that answers "429 quota exceeded" is
rested until its retry time and the next one is used.
"""

import base64
import json
import logging
import re

import numpy as np

from app.core import gemini
from app.core.config import get_settings
from app.core.errors import ServiceUnavailable
from app.core.language import Language
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

_TTS_MAX_CHARS = 1500
_TRANSLATE_BATCH = 20

# Gemini's prebuilt voices speak every supported language; these are calm and clear.
VOICES = [
    VoiceOption("Kore", "Kore", VoiceGender.FEMALE, "Firm and clear"),
    VoiceOption("Sulafat", "Sulafat", VoiceGender.FEMALE, "Warm"),
    VoiceOption("Aoede", "Aoede", VoiceGender.FEMALE, "Light and friendly"),
    VoiceOption("Charon", "Charon", VoiceGender.MALE, "Informative and calm"),
    VoiceOption("Algieba", "Algieba", VoiceGender.MALE, "Smooth"),
    VoiceOption("Orus", "Orus", VoiceGender.MALE, "Firm and steady"),
]
_DEFAULT_VOICE = {VoiceGender.FEMALE: "Kore", VoiceGender.MALE: "Charon"}
_VOICE_IDS = {v.id for v in VOICES}

_LANGUAGE_NAMES = {
    Language.ENGLISH: "English",
    Language.TAMIL: "Tamil",
    Language.HINDI: "Hindi",
    Language.TELUGU: "Telugu",
    Language.KANNADA: "Kannada",
    Language.MARATHI: "Marathi",
    Language.BENGALI: "Bengali",
    Language.GUJARATI: "Gujarati",
    Language.MALAYALAM: "Malayalam",
    Language.PUNJABI: "Punjabi",
    Language.ODIA: "Odia",
}


def _pace_instruction(pace: float) -> str:
    if pace <= 0.9:
        return "Read the following slowly and clearly, like a patient teacher:\n"
    if pace >= 1.1:
        return "Read the following at a brisk, natural pace:\n"
    return ""


def _chunks(text: str, limit: int) -> list[str]:
    if len(text) <= limit:
        return [text]
    parts, current = [], ""
    for sentence in re.split(r"(?<=[.!?।])\s+", text):
        if current and len(current) + len(sentence) + 1 > limit:
            parts.append(current)
            current = ""
        current = f"{current} {sentence}".strip()
        while len(current) > limit:
            parts.append(current[:limit])
            current = current[limit:]
    if current:
        parts.append(current)
    return parts


def _audio_part(result: dict) -> dict | None:
    """The audio in a speech answer; None when the model returned none (some models cannot
    speak every language and answer with an empty "OTHER" result instead)."""
    try:
        parts = result["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError, TypeError):
        return None
    return next((p["inlineData"] for p in parts if "inlineData" in p), None)


def _pcm_from_part(inline: dict) -> tuple[np.ndarray, int]:
    """Gemini returns either a WAV file or raw 16-bit PCM ("audio/L16;rate=24000")."""
    data = base64.b64decode(inline["data"])
    mime = inline.get("mimeType", "").lower()
    if "wav" in mime or data[:4] == b"RIFF":
        return read_wav(data)
    rate = int(match.group(1)) if (match := re.search(r"rate=(\d+)", mime)) else 24000
    return np.frombuffer(data, dtype="<i2"), rate


class GeminiVoiceProvider:
    name = "gemini"
    capabilities = VoiceCapabilities(asr=True, tts=True, translation=True)

    def __init__(self) -> None:
        settings = get_settings()
        if settings.gemini_api_key is None:
            raise RuntimeError("GEMINI_API_KEY must be set to use Gemini for voice")
        self._tts_models = settings.gemini_tts_models
        self._text_models = [settings.gemini_model, *settings.gemini_fallback_models]
        self._asr_models = settings.gemini_asr_models

    async def _generate(
        self, task: str, models: list[str], payload: dict, timeout: float, accept=None
    ) -> dict:
        try:
            return await gemini.generate(task, models, payload, timeout=timeout, accept=accept)
        except ServiceUnavailable as exc:
            raise ServiceUnavailable(
                "Speech service is unreachable", code="voice_unavailable"
            ) from exc

    async def transcribe(self, samples: np.ndarray, sample_rate: int, language: Language) -> str:
        audio = base64.b64encode(write_wav(samples, sample_rate)).decode()
        expected = _LANGUAGE_NAMES[language]
        payload = {
            "systemInstruction": {"parts": [{"text": (
                "You transcribe a farmer's spoken question for an Indian farming app. Write "
                "exactly what was said, in the language actually spoken and in that language's "
                f"own script (the app is set to {expected}, but the farmer may speak another "
                "Indian language or English; never translate). Write numbers as digits. "
                "Output only the transcript. If there is no clear speech, output nothing."
            )}]},
            "contents": [{"parts": [{"inlineData": {"mimeType": "audio/wav", "data": audio}}]}],
            "generationConfig": {"temperature": 0, "thinkingConfig": {"thinkingBudget": 0}},
        }
        result = await self._generate("asr", self._asr_models, payload, timeout=12)
        return gemini.text_of(result).strip('"')

    async def synthesize(
        self, text: str, language: Language, style: VoiceStyle = DEFAULT_STYLE
    ) -> SynthesizedSpeech:
        voice = style.voice if style.voice in _VOICE_IDS else _DEFAULT_VOICE[style.gender]
        instruction = _pace_instruction(style.pace)

        async def one(part: str) -> tuple[np.ndarray, int]:
            payload = {
                "contents": [{"parts": [{"text": instruction + part}]}],
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
                },
            }
            result = await self._generate(
                "tts", self._tts_models, payload, timeout=60,
                accept=lambda r: _audio_part(r) is not None,
            )
            return _pcm_from_part(_audio_part(result))

        pieces = [await one(p) for p in _chunks(text, _TTS_MAX_CHARS)]  # in order, gently
        rate = pieces[0][1]
        return SynthesizedSpeech(samples=np.concatenate([p for p, _ in pieces]), sample_rate=rate)

    async def translate(self, texts: list[str], source: Language, target: Language) -> list[str]:
        out: list[str] = []
        for start in range(0, len(texts), _TRANSLATE_BATCH):
            out.extend(await self._translate_batch(texts[start : start + _TRANSLATE_BATCH],
                                                   source, target))
        return out

    async def _translate_batch(
        self, texts: list[str], source: Language, target: Language
    ) -> list[str]:
        payload = {
            "systemInstruction": {"parts": [{"text": (
                f"Translate each text from {_LANGUAGE_NAMES[source]} to "
                f"{_LANGUAGE_NAMES[target]} for small farmers: simple everyday words, "
                f"written fully in {_LANGUAGE_NAMES[target]} script with no Latin letters: "
                "write English terms, names of portals, menus, offices, documents and "
                "abbreviations the way they sound, in the target script (Aadhaar, KYC, Common "
                "Service Centre, solar pump). Place and market names too. Only web addresses "
                "stay as they are. Keep numbers, units, ₹ amounts and anything in "
                "{curly braces} exactly as they are. Return JSON: {\"translations\": [...]} "
                "with one entry per input, in the same order."
            )}]},
            "contents": [{"parts": [{"text": json.dumps({"texts": texts}, ensure_ascii=False)}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }
        result = await self._generate("translation", self._text_models, payload, timeout=60)
        try:
            translations = json.loads(gemini.text_of(result))["translations"]
        except (ValueError, KeyError, TypeError) as exc:
            raise ServiceUnavailable(
                "Translation returned an unexpected answer", code="voice_unavailable"
            ) from exc
        if len(translations) != len(texts) or not all(isinstance(t, str) for t in translations):
            raise ServiceUnavailable(
                "Translation returned an unexpected answer", code="voice_unavailable"
            )
        return translations

    def voices(self, language: Language) -> list[VoiceOption]:
        return VOICES

