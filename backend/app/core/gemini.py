"""One way to call Google Gemini, shared by the assistant and the voice provider.

Gemini models differ in small ways that break a fixed request: each has its own rate limit
(a few requests a minute on the free tier), Google is sometimes briefly overloaded, and one
model accepts `thinkingBudget: 0` while another rejects it as invalid. `generate` tries the
given models in order and smooths over all three.
"""

import asyncio
import copy
import logging
import time
from collections.abc import Callable
from contextvars import ContextVar

from app.core.config import get_settings
from app.core.errors import ServiceUnavailable
from app.core.http import get_http_client
from app.core.observability import Timer, metrics

logger = logging.getLogger(__name__)

_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

# model -> monotonic time until which it is rate-limited
_resting: dict[str, float] = {}

# Set by background jobs (translation warm-up) that would rather wait out rate limits than
# fail; a farmer waiting for an answer never waits for a rate limit to reset.
patient_mode: ContextVar[bool] = ContextVar("gemini_patient_mode", default=False)
_PATIENT_ROUNDS = 6
# A farmer's request gives up on Gemini after this long, across every model and retry, so a
# slow or overloaded Google never leaves the app waiting for minutes.
_INTERACTIVE_DEADLINE_SECONDS = 25.0
_MAX_WAIT_SECONDS = 65.0


def _retry_seconds(error: dict) -> float:
    for detail in error.get("details", []):
        delay = str(detail.get("retryDelay", ""))
        if delay.endswith("s"):
            try:
                # Per-minute limits ask for seconds; a used-up daily limit asks for hours.
                return min(float(delay[:-1]), 86400.0)
            except ValueError:
                pass
    return 60.0


def _without_thinking(payload: dict) -> dict | None:
    config = payload.get("generationConfig", {})
    if "thinkingConfig" not in config:
        return None
    trimmed = copy.deepcopy(payload)
    del trimmed["generationConfig"]["thinkingConfig"]
    return trimmed


def api_key() -> str:
    key = get_settings().gemini_api_key
    if key is None:
        raise ServiceUnavailable("Gemini is not configured", code="llm_unavailable")
    return key.get_secret_value()


async def generate(
    task: str,
    models: list[str],
    payload: dict,
    *,
    timeout: float,
    accept: Callable[[dict], bool] | None = None,
) -> dict:
    """The first successful `generateContent` response among `models`. With `accept`, a
    response it rejects (say, no audio because that model cannot speak the language) counts
    as that model failing, and the next model is tried."""
    patient = patient_mode.get()
    rounds = _PATIENT_ROUNDS if patient else 1
    for round_ in range(rounds):
        try:
            attempt = _generate_once(task, models, payload, timeout=timeout, accept=accept)
            if patient:
                return await attempt
            return await asyncio.wait_for(attempt, _INTERACTIVE_DEADLINE_SECONDS)
        except TimeoutError as exc:
            metrics.inc("provider_failures", f"gemini_{task}_deadline")
            raise ServiceUnavailable("Gemini is too slow", code="llm_unavailable") from exc
        except ServiceUnavailable:
            if round_ == rounds - 1:
                raise
            now = time.monotonic()
            wait = min((_resting.get(m, now) for m in models), default=now) - now
            await asyncio.sleep(min(max(wait, 5.0), _MAX_WAIT_SECONDS))
    raise ServiceUnavailable("Gemini is unavailable", code="llm_unavailable")  # unreachable


async def _generate_once(
    task: str,
    models: list[str],
    payload: dict,
    *,
    timeout: float,
    accept: Callable[[dict], bool] | None,
) -> dict:
    headers = {"x-goog-api-key": api_key()}
    now = time.monotonic()
    usable = [m for m in models if _resting.get(m, 0.0) <= now] or models[:1]
    for model in usable:
        body = payload
        for attempt in range(3):
            try:
                with Timer() as timer:
                    response = await get_http_client().post(
                        f"{_BASE}/{model}:generateContent",
                        json=body,
                        headers=headers,
                        timeout=timeout,
                    )
            except Exception as exc:
                logger.warning("gemini_unreachable", extra={"task": task, "error": str(exc)[:200]})
                break
            status = response.status_code
            if status == 200:
                metrics.observe_ms("gemini", task, timer.ms)
                result = response.json()
                if accept is None or accept(result):
                    return result
                logger.warning("gemini_unusable_answer", extra={"task": task, "model": model})
                break
            if status == 429:
                error = response.json().get("error", {}) if response.content else {}
                _resting[model] = time.monotonic() + _retry_seconds(error)
                metrics.inc("provider_retries", f"gemini_{task}_429")
                break
            if status >= 500 and attempt == 0:
                metrics.inc("provider_retries", f"gemini_{task}_{status}")
                await asyncio.sleep(1.0)  # brief overload: one more try on the same model
                continue
            if status == 400 and (trimmed := _without_thinking(body)) is not None:
                body = trimmed  # this model does not accept the thinking setting
                continue
            logger.warning(
                "gemini_rejected",
                extra={"task": task, "model": model, "status": status, "body": response.text[:300]},
            )
            break
    metrics.inc("provider_failures", f"gemini_{task}")
    raise ServiceUnavailable("Gemini is unavailable", code="llm_unavailable")


def text_of(result: dict) -> str:
    """The answer text; newer models split it across parts, and thought parts are not answers."""
    try:
        parts = result["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError):
        return ""
    return "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()
