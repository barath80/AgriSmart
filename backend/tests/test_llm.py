import json

import httpx
import pytest

import app.assistant.llm as llm
import app.core.gemini as gemini
from app.core.errors import ServiceUnavailable


@pytest.fixture
def google(monkeypatch):
    """A fake Gemini endpoint: `google.reply(model, payload) -> (status, json)`."""
    calls: list[tuple[str, dict]] = []

    class Google:
        reply = None

    async def handler(request: httpx.Request) -> httpx.Response:
        model = request.url.path.rsplit("/", 1)[-1].split(":")[0]
        payload = json.loads(request.read())
        calls.append((model, payload))
        status, body = Google.reply(model, payload)
        return httpx.Response(status, json=body)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(gemini, "get_http_client", lambda: client)
    monkeypatch.setattr(gemini, "_resting", {})
    monkeypatch.setattr(gemini.asyncio, "sleep", lambda _s: _noop())
    Google.calls = calls
    return Google


async def _noop():
    return None


def _answer(*parts):
    return {"candidates": [{"content": {"parts": list(parts)}}]}


async def test_gemini_joins_all_answer_parts_and_skips_thoughts(google):
    google.reply = lambda model, payload: (200, _answer(
        {"text": "plan the reply", "thought": True},
        {"text": "Give fresh water. "},
        {"text": "Call a vet if she still refuses food."},
    ))
    answer = await llm.GeminiLLM("gemini-flash-latest").complete("system", [{"role": "user", "content": "hi"}])
    assert answer == "Give fresh water. Call a vet if she still refuses food."
    assert google.calls[0][1]["generationConfig"]["thinkingConfig"] == {"thinkingBudget": 0}


async def test_gemini_empty_answer_is_unavailable(google):
    google.reply = lambda model, payload: (200, {"candidates": [{"finishReason": "MAX_TOKENS", "content": {}}]})
    with pytest.raises(ServiceUnavailable):
        await llm.GeminiLLM("m").complete("system", [{"role": "user", "content": "hi"}])


async def test_brief_overload_is_retried_on_the_same_model(google):
    google.reply = lambda model, payload: (503, {}) if len(google.calls) == 1 else (200, _answer({"text": "ok"}))
    assert await llm.GeminiLLM("main", ["lite"]).complete("s", [{"role": "user", "content": "hi"}]) == "ok"
    assert [m for m, _ in google.calls] == ["main", "main"]


async def test_model_rejecting_the_thinking_setting_is_asked_without_it(google):
    def reply(model, payload):
        if model == "main":
            return 429, {"error": {"details": [{"retryDelay": "30s"}]}}
        if "thinkingConfig" in payload["generationConfig"]:
            return 400, {"error": {"message": "Request contains an invalid argument."}}
        return 200, _answer({"text": "from lite"})

    google.reply = reply
    assert await llm.GeminiLLM("main", ["lite"]).complete("s", [{"role": "user", "content": "hi"}]) == "from lite"
    assert [m for m, _ in google.calls] == ["main", "lite", "lite"]
    # The rate-limited model is rested: the next question goes straight to the other one.
    await llm.GeminiLLM("main", ["lite"]).complete("s", [{"role": "user", "content": "hi"}])
    assert [m for m, _ in google.calls][3:] == ["lite", "lite"]


async def test_background_jobs_wait_out_rate_limits_instead_of_failing(google):
    google.reply = lambda model, payload: (
        (429, {"error": {"details": [{"retryDelay": "20s"}]}}) if len(google.calls) <= 2
        else (200, _answer({"text": "translated"}))
    )
    token = gemini.patient_mode.set(True)
    try:
        result = await gemini.generate("translation", ["main", "lite"], {"contents": []}, timeout=5)
    finally:
        gemini.patient_mode.reset(token)
    assert gemini.text_of(result) == "translated"
    assert [m for m, _ in google.calls] == ["main", "lite", "main"]


async def test_farmer_requests_do_not_wait_for_rate_limits(google):
    google.reply = lambda model, payload: (429, {"error": {"details": [{"retryDelay": "20s"}]}})
    with pytest.raises(ServiceUnavailable):
        await gemini.generate("llm", ["main", "lite"], {"contents": []}, timeout=5)
    assert len(google.calls) == 2


async def test_interactive_gemini_call_gives_up_after_the_deadline(monkeypatch):
    import asyncio

    import pytest

    from app.core import gemini
    from app.core.errors import ServiceUnavailable

    async def never_answers(*args, **kwargs):
        await asyncio.sleep(3600)

    monkeypatch.setattr(gemini, "_generate_once", never_answers)
    monkeypatch.setattr(gemini, "_INTERACTIVE_DEADLINE_SECONDS", 0.05)
    with pytest.raises(ServiceUnavailable):
        await gemini.generate("asr", ["m"], {}, timeout=1)
