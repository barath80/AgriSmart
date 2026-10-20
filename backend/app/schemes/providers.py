"""Sources of government scheme data, normalised into `SchemeIn`.

RAG is deliberately not used: schemes are structured records with explicit rules. Add a
provider here for each official API or dataset that becomes available (e.g. a state
agriculture department feed); `sync_from_provider` upserts its output.
"""

import asyncio
import json
import logging
import re
from datetime import date
from pathlib import Path
from typing import Any, Protocol

from pydantic import ValidationError

from app.core.errors import ServiceUnavailable
from app.core.http import get_http_client
from app.core.observability import metrics
from app.schemes.schemas import SchemeIn

logger = logging.getLogger(__name__)

SEED_DIR = Path(__file__).resolve().parents[2] / "seeds"


class GovernmentSchemeProvider(Protocol):
    name: str

    async def fetch(self) -> list[SchemeIn]: ...


class VerifiedFileProvider:
    """Administrator-verified schemes kept in version control (`seeds/schemes.json`)."""

    name = "verified_file"

    def __init__(self, path: Path = SEED_DIR / "schemes.json") -> None:
        self._path = path

    async def fetch(self) -> list[SchemeIn]:
        records = json.loads(self._path.read_text(encoding="utf-8"))
        return [SchemeIn.model_validate(record) for record in records]


class MySchemeProvider:
    """Live schemes from myScheme (NeGD, MeitY) — the national scheme catalogue.

    The API needs a key, which partners obtain through API Setu (https://apisetu.gov.in).
    Records carry no machine-checkable rules, so the eligibility engine shows them as
    "check eligibility" with the official text; an administrator can add rules later.
    Endpoint paths and field names live in the class constants so a contract change is a
    one-line fix.
    """

    name = "myscheme"
    _SEARCH = "/search/v4/schemes"
    _DETAILS = "/schemes/v6/public/schemes"
    _PAGE_SIZE = 100
    _MAX_SCHEMES = 2000
    _DETAIL_CONCURRENCY = 5
    _MAX_TEXT = 4000

    def __init__(self, base_url: str, api_key: str, categories: list[str]) -> None:
        self._base = base_url.rstrip("/")
        self._headers = {"x-api-key": api_key, "accept": "application/json"}
        self._categories = categories

    async def fetch(self) -> list[SchemeIn]:
        listed = await self._search()
        semaphore = asyncio.Semaphore(self._DETAIL_CONCURRENCY)

        async def build(fields: dict[str, Any]) -> SchemeIn | None:
            async with semaphore:
                details = await self._details(fields["slug"])
            return self._normalise(fields, details)

        results = await asyncio.gather(*(build(f) for f in listed))
        schemes = [s for s in results if s is not None]
        logger.info("myscheme_fetched", extra={"listed": len(listed), "kept": len(schemes)})
        return schemes

    async def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        try:
            response = await get_http_client().get(
                self._base + path, params=params, headers=self._headers, timeout=30
            )
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            metrics.inc("provider_failures", "myscheme")
            raise ServiceUnavailable(
                "Scheme service is unreachable", code="schemes_unavailable"
            ) from exc

    async def _search(self) -> list[dict[str, Any]]:
        query = json.dumps([{"identifier": "schemeCategory", "value": c} for c in self._categories])
        found: list[dict[str, Any]] = []
        while len(found) < self._MAX_SCHEMES:
            payload = await self._get(
                self._SEARCH,
                {
                    "lang": "en",
                    "q": query,
                    "keyword": "",
                    "sort": "",
                    "from": len(found),
                    "size": self._PAGE_SIZE,
                },
            )
            hits = (payload.get("data") or {}).get("hits") or {}
            items = [i.get("fields") or {} for i in hits.get("items") or []]
            found.extend(f for f in items if f.get("slug") and f.get("schemeName"))
            total = ((hits.get("page") or {}).get("total")) or 0
            if not items or len(found) >= total:
                break
        return found

    async def _details(self, slug: str) -> dict[str, Any]:
        """Full scheme text; a failure here keeps the search summary rather than dropping it."""
        try:
            payload = await self._get(self._DETAILS, {"slug": slug, "lang": "en"})
        except ServiceUnavailable:
            return {}
        data = payload.get("data") or {}
        return data.get("en") or data

    def _normalise(self, fields: dict[str, Any], details: dict[str, Any]) -> SchemeIn | None:
        slug = fields["slug"]
        content = details.get("schemeContent") or {}
        summary = _text(fields.get("briefDescription")) or _text(content.get("briefDescription"))
        benefits = _text(content.get("benefits_md")) or _text(content.get("benefits"))
        eligibility = _text(
            (details.get("eligibilityCriteria") or {}).get("eligibilityDescription_md")
        )
        process = "\n".join(
            _text(step.get("process_md") or step.get("process"))
            for step in details.get("applicationProcess") or []
            if isinstance(step, dict)
        )
        pointer = "See the official myScheme page for full details."
        states = [s for s in fields.get("beneficiaryState") or [] if s and s != "All"]
        try:
            return SchemeIn(
                code=_code(slug),
                name=_text(fields["schemeName"])[:200],
                state=states[0] if len(states) == 1 else None,
                summary=(summary or pointer)[: self._MAX_TEXT],
                benefits=(benefits or pointer)[: self._MAX_TEXT],
                eligibility_text=(eligibility or pointer)[: self._MAX_TEXT],
                application_process=(process or pointer)[: self._MAX_TEXT],
                official_url=f"https://www.myscheme.gov.in/schemes/{slug}",
                source=self.name,
                last_verified_on=date.today(),
            )
        except ValidationError:
            logger.warning("myscheme_record_skipped", extra={"slug": slug})
            return None


def _code(slug: str) -> str:
    return ("ms_" + re.sub(r"[^a-z0-9]+", "_", slug.lower()).strip("_"))[:64]


def _text(value: Any) -> str:
    """Flatten myScheme's markdown / rich-text into plain sentences for display and speech."""
    if value is None:
        return ""
    if isinstance(value, list):
        return "\n".join(t for t in (_text(v) for v in value) if t)
    if isinstance(value, dict):
        return _text(value.get("text") or value.get("children"))
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", str(value))  # [label](url) -> label
    text = re.sub(r"[*_`#>]+", "", text)
    text = re.sub(r"^\s*[-+]\s+", "• ", text, flags=re.M)
    return re.sub(r"[ \t]+", " ", text).strip()


def configured_provider() -> GovernmentSchemeProvider | None:
    """The live provider from settings, or None when only verified records are used."""
    from app.core.config import get_settings

    settings = get_settings()
    if settings.scheme_provider == "myscheme" and settings.myscheme_api_key:
        return MySchemeProvider(
            settings.myscheme_api_url,
            settings.myscheme_api_key.get_secret_value(),
            settings.myscheme_categories,
        )
    return None
