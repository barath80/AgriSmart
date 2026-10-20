"""The `VoiceProvider` interface. AgriSmart never hard-codes a speech vendor.

Each provider declares what it can do; callers check `capabilities` and degrade honestly
(e.g. the app falls back to on-device speech when server TTS is unavailable).
"""

from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol

import numpy as np

from app.core.language import Language


@dataclass(frozen=True, slots=True)
class VoiceCapabilities:
    asr: bool
    tts: bool
    translation: bool


class VoiceGender(StrEnum):
    FEMALE = "female"
    MALE = "male"


@dataclass(frozen=True, slots=True)
class VoiceStyle:
    """How a farmer likes to be spoken to. `voice` picks a specific named voice when the
    provider offers several; otherwise the provider's default voice for `gender` is used."""

    gender: VoiceGender = VoiceGender.FEMALE
    pace: float = 1.0  # 0.75 = slower, easier to follow; 1.25 = faster
    voice: str | None = None


DEFAULT_STYLE = VoiceStyle()


@dataclass(frozen=True, slots=True)
class VoiceOption:
    id: str
    label: str
    gender: VoiceGender
    description: str


@dataclass(frozen=True, slots=True)
class SynthesizedSpeech:
    samples: np.ndarray  # mono PCM16
    sample_rate: int


class VoiceProvider(Protocol):
    name: str
    capabilities: VoiceCapabilities

    async def transcribe(self, samples: np.ndarray, sample_rate: int, language: Language) -> str:
        """Speech → text in the same language."""
        ...

    async def synthesize(
        self, text: str, language: Language, style: VoiceStyle = DEFAULT_STYLE
    ) -> SynthesizedSpeech:
        """Text → speech in the farmer's chosen voice."""
        ...

    async def translate(self, texts: list[str], source: Language, target: Language) -> list[str]:
        """Batch text translation, order preserved."""
        ...

    def voices(self, language: Language) -> list[VoiceOption]:
        """Named voices a farmer can choose from (empty when only gender is selectable)."""
        ...
