"""Pre-translate knowledge text so the first farmer in a language never waits for it.

Translations are cached in the database after first use (`translate_texts`), so only the
first request per text and language is slow (several seconds). Warming moves that cost to a
background job. Scope is explicit because translation providers bill per character:
schemes are small and read by everyone; disease and pest advice is hundreds of passages
per language, so it is warmed only when an operator asks (`warm-translations --scope all`).
"""

import logging
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import gemini
from app.core.language import Language
from app.disease.models import Disease
from app.language.service import translate_texts
from app.pest.models import Pest
from app.schemes.models import GovernmentScheme
from app.voice.providers import sarvam

logger = logging.getLogger(__name__)

BATCH = 24  # texts per provider round trip: bounded memory and a commit per batch


async def scheme_texts(session: AsyncSession) -> list[str]:
    schemes = await session.scalars(
        select(GovernmentScheme).where(GovernmentScheme.is_active.is_(True))
    )
    return [
        text
        for s in schemes
        for text in (s.name, s.summary, s.benefits, s.eligibility_text, s.application_process)
        if text
    ]


async def knowledge_texts(session: AsyncSession) -> list[str]:
    texts: list[str] = []
    for row in await session.scalars(select(Disease)):
        for key in (
            "cause",
            "symptoms",
            "favorable_conditions",
            "treatment",
            "prevention",
            "fertilizer_guidance",
            "safety_warnings",
        ):
            value = getattr(row, key)
            texts += [value] if isinstance(value, str) else list(value)
        texts += [n for lang, n in (row.names or {}).items() if lang == "en"]
    for row in await session.scalars(select(Pest)):
        for key in ("description", "damage", "control_measures", "prevention", "safety_warnings"):
            value = getattr(row, key)
            texts += [value] if isinstance(value, str) else list(value)
        texts += [n for lang, n in (row.names or {}).items() if lang == "en"]
    return texts


async def warm_translations(
    session: AsyncSession,
    *,
    scope: str = "schemes",
    languages: Iterable[Language] | None = None,
) -> dict[str, int]:
    """Translate and cache the scoped texts into each language. Returns {language: texts}.
    Already-cached texts cost nothing, so this is safe to run repeatedly."""
    # Background work: wait out rate limits rather than fail and leave gaps in the cache.
    sarvam.patient_mode.set(True)
    gemini.patient_mode.set(True)
    texts = await scheme_texts(session)
    if scope == "all":
        texts += await knowledge_texts(session)
    texts = sorted({t.strip() for t in texts if t and t.strip()})
    done: dict[str, int] = {}
    for language in languages or (lang for lang in Language if lang is not Language.ENGLISH):
        complete_count = 0
        for start in range(0, len(texts), BATCH):
            batch = texts[start : start + BATCH]
            _, complete = await translate_texts(session, batch, language)
            complete_count += len(batch) if complete else 0
        done[language.value] = complete_count
        logger.info(
            "translations_warmed",
            extra={"language": language.value, "texts": len(texts), "complete": complete_count},
        )
    return done
