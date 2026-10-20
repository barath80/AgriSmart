"""BHASHINI (Government of India) speech and translation via the ULCA pipeline API.

Two steps, per https://bhashini.gitbook.io/bhashini-apis:
1. *Config call* (ULCA credentials) resolves, per task and language, a `serviceId`
   plus a compute endpoint and inference key. Cached per process.
2. *Compute call* (inference key) runs ASR / TTS / translation.
"""

import asyncio
import base64
import logging
import time
from dataclasses import dataclass

import numpy as np

from app.core.config import get_settings
from app.core.errors import ServiceUnavailable
from app.core.http import get_http_client
from app.core.language import Language
from app.core.observability import Timer, metrics
from app.voice.audio import SPEECH_SAMPLE_RATE, read_wav, write_wav
from app.voice.providers.base import (
    DEFAULT_STYLE,
    SynthesizedSpeech,
    VoiceCapabilities,
    VoiceOption,
    VoiceStyle,
)

logger = logging.getLogger(__name__)

_CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
_CONFIG_TTL_SECONDS = 6 * 3600


@dataclass(slots=True)
class _ComputeTarget:
    service_id: str
    callback_url: str
    auth_header: tuple[str, str]
    resolved_at: float


class BhashiniProvider:
    name = "bhashini"
    capabilities = VoiceCapabilities(asr=True, tts=True, translation=True)

    def __init__(self) -> None:
        settings = get_settings()
        if not (settings.bhashini_user_id and settings.bhashini_api_key):
            raise RuntimeError("BHASHINI_USER_ID and BHASHINI_API_KEY must be set")
        self._user_id = settings.bhashini_user_id
        self._api_key = settings.bhashini_api_key.get_secret_value()
        self._pipeline_id = settings.bhashini_pipeline_id
        self._targets: dict[tuple, _ComputeTarget] = {}
        self._lock = asyncio.Lock()

    async def _target(self, task: str, language_config: dict[str, str]) -> _ComputeTarget:
        key = (task, *sorted(language_config.items()))
        cached = self._targets.get(key)
        if cached and time.monotonic() - cached.resolved_at < _CONFIG_TTL_SECONDS:
            return cached
        async with self._lock:
            payload = {
                "pipelineTasks": [{"taskType": task, "config": {"language": language_config}}],
                "pipelineRequestConfig": {"pipelineId": self._pipeline_id},
            }
            headers = {"userID": self._user_id, "ulcaApiKey": self._api_key}
            data = await self._post(_CONFIG_URL, payload, headers)
            try:
                endpoint = data["pipelineInferenceAPIEndPoint"]
                service_id = data["pipelineResponseConfig"][0]["config"][0]["serviceId"]
                key_spec = endpoint["inferenceApiKey"]
            except (KeyError, IndexError) as exc:
                raise ServiceUnavailable(
                    f"Bhashini has no {task} model for {language_config}", code="voice_unavailable"
                ) from exc
            target = _ComputeTarget(
                service_id=service_id,
                callback_url=endpoint["callbackUrl"],
                auth_header=(key_spec["name"], key_spec["value"]),
                resolved_at=time.monotonic(),
            )
            self._targets[key] = target
            return target

    async def _post(self, url: str, payload: dict, headers: dict[str, str]) -> dict:
        try:
            response = await get_http_client().post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            metrics.inc("provider_failures", "bhashini")
            logger.warning("bhashini_request_failed", extra={"error": str(exc)[:200]})
            raise ServiceUnavailable(
                "Speech service is unreachable", code="voice_unavailable"
            ) from exc

    async def _compute(
        self, task: str, language_config: dict[str, str], extra_config: dict, input_data: dict
    ) -> dict:
        target = await self._target(task, language_config)
        payload = {
            "pipelineTasks": [
                {
                    "taskType": task,
                    "config": {
                        "language": language_config,
                        "serviceId": target.service_id,
                        **extra_config,
                    },
                }
            ],
            "inputData": input_data,
        }
        with Timer() as timer:
            data = await self._post(target.callback_url, payload, dict([target.auth_header]))
        metrics.observe_ms("voice_provider", f"bhashini_{task}", timer.ms)
        return data["pipelineResponse"][0]

    async def transcribe(self, samples: np.ndarray, sample_rate: int, language: Language) -> str:
        audio_b64 = base64.b64encode(write_wav(samples, sample_rate)).decode()
        result = await self._compute(
            "asr",
            {"sourceLanguage": language.value},
            {"audioFormat": "wav", "samplingRate": sample_rate},
            {"audio": [{"audioContent": audio_b64}]},
        )
        return (result.get("output") or [{}])[0].get("source", "").strip()

    async def synthesize(
        self, text: str, language: Language, style: VoiceStyle = DEFAULT_STYLE
    ) -> SynthesizedSpeech:
        result = await self._compute(
            "tts",
            {"sourceLanguage": language.value},
            {"gender": style.gender.value, "samplingRate": SPEECH_SAMPLE_RATE},
            {"input": [{"source": text}]},
        )
        audio = base64.b64decode(result["audio"][0]["audioContent"])
        samples, rate = read_wav(audio)
        return SynthesizedSpeech(samples=samples, sample_rate=rate)

    async def translate(self, texts: list[str], source: Language, target: Language) -> list[str]:
        if not texts:
            return []
        result = await self._compute(
            "translation",
            {"sourceLanguage": source.value, "targetLanguage": target.value},
            {},
            {"input": [{"source": t} for t in texts]},
        )
        outputs = [item.get("target", "") for item in result.get("output", [])]
        if len(outputs) != len(texts):
            raise ServiceUnavailable("Incomplete translation", code="translation_unavailable")
        return outputs

    def voices(self, language: Language) -> list[VoiceOption]:
        return []  # Bhashini offers one female and one male voice per language (chosen by gender)
