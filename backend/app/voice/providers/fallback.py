"""Try the main voice provider, then a fallback, task by task.

Sarvam has the most natural Indian voices but stops working when its credits run out;
Gemini then keeps speech recognition, male/female speech and translation available. A
voice the farmer picked from one provider's list is mapped by gender on the other.
"""

import logging

import numpy as np

from app.core.errors import ServiceUnavailable
from app.core.language import Language
from app.core.observability import metrics
from app.voice.providers.base import (
    DEFAULT_STYLE,
    SynthesizedSpeech,
    VoiceCapabilities,
    VoiceOption,
    VoiceProvider,
    VoiceStyle,
)

logger = logging.getLogger(__name__)


class FallbackVoiceProvider:
    def __init__(self, primary: VoiceProvider, fallback: VoiceProvider) -> None:
        self.primary = primary
        self.fallback = fallback
        self.name = f"{primary.name}+{fallback.name}"
        a, b = primary.capabilities, fallback.capabilities
        self.capabilities = VoiceCapabilities(
            asr=a.asr or b.asr, tts=a.tts or b.tts, translation=a.translation or b.translation
        )

    def _order(self, capability: str) -> list[VoiceProvider]:
        return [
            p for p in (self.primary, self.fallback) if getattr(p.capabilities, capability)
        ]

    async def _first(self, capability: str, call):
        last: ServiceUnavailable | None = None
        for provider in self._order(capability):
            try:
                return await call(provider)
            except ServiceUnavailable as exc:
                last = exc
                if provider is self.primary:
                    metrics.inc("voice_fallback_used", capability)
                    logger.info("voice_fallback", extra={"task": capability,
                                                         "from": provider.name})
        raise last or ServiceUnavailable("Speech service is unreachable", code="voice_unavailable")

    async def transcribe(self, samples: np.ndarray, sample_rate: int, language: Language) -> str:
        return await self._first(
            "asr", lambda p: p.transcribe(samples, sample_rate, language)
        )

    async def synthesize(
        self, text: str, language: Language, style: VoiceStyle = DEFAULT_STYLE
    ) -> SynthesizedSpeech:
        return await self._first("tts", lambda p: p.synthesize(text, language, style))

    async def translate(self, texts: list[str], source: Language, target: Language) -> list[str]:
        return await self._first("translation", lambda p: p.translate(texts, source, target))

    def voices(self, language: Language) -> list[VoiceOption]:
        return self.primary.voices(language) or self.fallback.voices(language)
