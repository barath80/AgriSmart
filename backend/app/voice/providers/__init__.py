from functools import lru_cache

from app.core.config import get_settings
from app.voice.providers.base import (
    DEFAULT_STYLE,
    SynthesizedSpeech,
    VoiceCapabilities,
    VoiceGender,
    VoiceOption,
    VoiceProvider,
    VoiceStyle,
)


def _create(choice: str) -> VoiceProvider:
    if choice == "sarvam":
        from app.voice.providers.sarvam import SarvamProvider

        return SarvamProvider()
    if choice == "bhashini":
        from app.voice.providers.bhashini import BhashiniProvider

        return BhashiniProvider()
    if choice == "gemini":
        from app.voice.providers.gemini import GeminiVoiceProvider

        return GeminiVoiceProvider()
    if choice == "local":
        from app.voice.providers.local import LocalModelProvider

        return LocalModelProvider()
    from app.voice.providers.local import NullVoiceProvider

    return NullVoiceProvider()


@lru_cache
def get_voice_provider() -> VoiceProvider:
    """The configured provider, created once per process. Add new adapters here."""
    settings = get_settings()
    primary = _create(settings.voice_provider)
    fallback = settings.voice_fallback_provider
    if fallback == "none" or fallback == settings.voice_provider:
        return primary
    from app.voice.providers.fallback import FallbackVoiceProvider

    if primary.name == "none":
        return _create(fallback)
    return FallbackVoiceProvider(primary, _create(fallback))


__all__ = [
    "DEFAULT_STYLE",
    "SynthesizedSpeech",
    "VoiceCapabilities",
    "VoiceGender",
    "VoiceOption",
    "VoiceProvider",
    "VoiceStyle",
    "get_voice_provider",
]
