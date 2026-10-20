"""Optional LLM for open conversation and intent fallback.

The LLM is never a source of truth: it does not produce prices, weather, eligibility,
yields or treatments. Those come from APIs, the database, rules and ML models. The LLM
only rephrases, explains and handles questions no tool covers.
"""

import asyncio
import json
import logging
from functools import lru_cache
from typing import Protocol

from app.core import gemini
from app.core.config import get_settings
from app.core.errors import ServiceUnavailable
from app.core.http import get_http_client
from app.core.observability import Timer, metrics

logger = logging.getLogger(__name__)


class LLMProvider(Protocol):
    name: str

    async def complete(
        self,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 800,
        json_mode: bool = False,
    ) -> str:
        """`messages`: [{"role": "user"|"assistant", "content": ...}]. `json_mode` asks for a
        single JSON object as the whole reply."""
        ...


class OllamaLLM:
    """Local, free: any model pulled into Ollama (https://ollama.com)."""

    name = "ollama"

    def __init__(self, base_url: str, model: str) -> None:
        self._url = f"{base_url.rstrip('/')}/api/chat"
        self._model = model

    async def complete(
        self,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 800,
        json_mode: bool = False,
    ) -> str:
        payload = {
            "model": self._model,
            "messages": [{"role": "system", "content": system}, *messages],
            "stream": False,
            "options": {"num_predict": max_tokens, "temperature": 0.3},
        }
        if json_mode:
            payload["format"] = "json"
        data = await _post(self.name, self._url, payload, {}, timeout=60)
        return data["message"]["content"].strip()


class GeminiLLM:
    name = "gemini"

    def __init__(self, model: str, fallback_models: list[str] | None = None) -> None:
        # Each model has its own rate limit; a busy or rate-limited one hands over to the next.
        self._models = [model, *(fallback_models or [])]

    async def complete(
        self,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 800,
        json_mode: bool = False,
    ) -> str:
        payload = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [
                {
                    "role": "model" if m["role"] == "assistant" else "user",
                    "parts": [{"text": m["content"]}],
                }
                for m in messages
            ],
            # Thinking models spend the output budget on reasoning first; a 40-token routing
            # call then returns no text at all. These answers are short and need none.
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": 0.3,
                "thinkingConfig": {"thinkingBudget": 0},
                **({"responseMimeType": "application/json"} if json_mode else {}),
            },
        }
        text = gemini.text_of(await gemini.generate("llm", self._models, payload, timeout=30))
        if not text:
            raise ServiceUnavailable("Empty answer from language model", code="llm_unavailable")
        return text


_RETRY_STATUSES = {429, 500, 502, 503, 504}  # brief overloads; worth one more try


async def _post(provider: str, url: str, payload: dict, headers: dict, timeout: float) -> dict:
    try:
        with Timer() as timer:
            for attempt in range(2):
                response = await get_http_client().post(
                    url, json=payload, headers=headers, timeout=timeout
                )
                if response.status_code not in _RETRY_STATUSES or attempt:
                    break
                await asyncio.sleep(1.5)
            response.raise_for_status()
        metrics.observe_ms("llm_latency", provider, timer.ms)
        return response.json()
    except Exception as exc:
        metrics.inc("provider_failures", provider)
        logger.warning("llm_request_failed", extra={"provider": provider, "error": str(exc)[:200]})
        raise ServiceUnavailable("Language model is unavailable", code="llm_unavailable") from exc


@lru_cache
def get_llm() -> LLMProvider | None:
    settings = get_settings()
    if settings.llm_provider == "ollama":
        return OllamaLLM(settings.ollama_url, settings.ollama_model)
    if settings.llm_provider == "gemini" and settings.gemini_api_key:
        return GeminiLLM(settings.gemini_model, settings.gemini_fallback_models)
    return None


def parse_json_object(text: str) -> dict:
    """Extract the first JSON object from a model reply (models sometimes add prose)."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return {}
    try:
        value = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}
