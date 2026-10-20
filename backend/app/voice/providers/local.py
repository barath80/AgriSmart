"""Zero-cost local providers for development and self-hosting."""

import threading

import numpy as np

from app.core.concurrency import run_cpu_bound
from app.core.config import get_settings
from app.core.errors import ServiceUnavailable
from app.core.language import Language
from app.voice.providers.base import (
    DEFAULT_STYLE,
    SynthesizedSpeech,
    VoiceCapabilities,
    VoiceOption,
    VoiceStyle,
)


class LocalModelProvider:
    """Offline speech recognition with Whisper (faster-whisper, CPU int8).

    Whisper covers ten of the eleven languages (Odia is auto-detected). Local Indic TTS
    and translation models are heavy, so this provider declares `tts=False,
    translation=False`: the app speaks with the phone's own voice and knowledge content
    stays in English until a translation provider is configured.
    """

    name = "local"
    capabilities = VoiceCapabilities(asr=True, tts=False, translation=False)

    def __init__(self) -> None:
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise RuntimeError(
                "Install the 'local-voice' extra to use VOICE_PROVIDER=local"
            ) from exc
        self._model_cls = WhisperModel
        self._model = None
        self._load_lock = threading.Lock()

    def _ensure_model(self):
        with self._load_lock:
            if self._model is None:
                self._model = self._model_cls(
                    get_settings().local_asr_model, device="cpu", compute_type="int8"
                )
        return self._model

    def _transcribe_sync(self, samples: np.ndarray, language: Language) -> str:
        audio = samples.astype(np.float32) / 32768.0
        # Whisper has no Odia model: let it auto-detect rather than fail.
        hint = None if language is Language.ODIA else language.value
        segments, _ = self._ensure_model().transcribe(audio, language=hint, beam_size=1)
        return " ".join(segment.text.strip() for segment in segments).strip()

    async def transcribe(self, samples: np.ndarray, sample_rate: int, language: Language) -> str:
        if sample_rate != 16_000:
            raise ValueError("LocalModelProvider expects 16 kHz audio")
        return await run_cpu_bound(self._transcribe_sync, samples, language)

    async def synthesize(
        self, text: str, language: Language, style: VoiceStyle = DEFAULT_STYLE
    ) -> SynthesizedSpeech:
        raise ServiceUnavailable(
            "Server speech synthesis is not configured", code="tts_unavailable"
        )

    async def translate(self, texts: list[str], source: Language, target: Language) -> list[str]:
        raise ServiceUnavailable("Translation is not configured", code="translation_unavailable")

    def voices(self, language: Language) -> list[VoiceOption]:
        return []


class NullVoiceProvider:
    """No server-side speech. Text chat still works; the app uses on-device speech."""

    name = "none"
    capabilities = VoiceCapabilities(asr=False, tts=False, translation=False)

    async def transcribe(self, samples: np.ndarray, sample_rate: int, language: Language) -> str:
        raise ServiceUnavailable("Speech recognition is not configured", code="asr_unavailable")

    async def synthesize(
        self, text: str, language: Language, style: VoiceStyle = DEFAULT_STYLE
    ) -> SynthesizedSpeech:
        raise ServiceUnavailable(
            "Server speech synthesis is not configured", code="tts_unavailable"
        )

    async def translate(self, texts: list[str], source: Language, target: Language) -> list[str]:
        raise ServiceUnavailable("Translation is not configured", code="translation_unavailable")

    def voices(self, language: Language) -> list[VoiceOption]:
        return []
