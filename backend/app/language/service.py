"""Translation of English knowledge content (disease guidance, scheme details).

Static UI text is never translated here — clients ship locale files. This is only for
database content authored once in English. Each distinct text is machine-translated once
and cached in PostgreSQL; verified human translations can be written to the same cache.
"""

import asyncio
import hashlib
import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ServiceUnavailable
from app.core.language import Language
from app.language.models import TranslationCache
from app.voice.providers import get_voice_provider

logger = logging.getLogger(__name__)


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


async def translate_texts(
    session: AsyncSession, texts: list[str], target: Language, *, timeout: float | None = None
) -> tuple[list[str], bool]:
    """Translate English `texts` to `target`. Returns (texts, fully_translated).

    Falls back to English — and says so — when no translation provider is available,
    rather than failing the farmer's request. `timeout` (seconds) bounds the provider call for
    interactive requests; a slow provider then counts as unavailable.
    """
    if target is Language.ENGLISH or not texts:
        return texts, True

    hashes = [_hash(t) for t in texts]
    rows = await session.scalars(
        select(TranslationCache).where(
            TranslationCache.target_lang == target.value,
            TranslationCache.source_hash.in_(set(hashes)),
        )
    )
    known = {row.source_hash: row.text for row in rows}
    missing = sorted({t for t, h in zip(texts, hashes, strict=True) if h not in known})

    provider = get_voice_provider()
    if missing and provider.capabilities.translation:
        try:
            translated = await asyncio.wait_for(
                provider.translate(missing, Language.ENGLISH, target), timeout
            )
        except (ServiceUnavailable, TimeoutError):
            logger.warning(
                "translation_failed", extra={"target": target.value, "count": len(missing)}
            )
        else:
            for source, result in zip(missing, translated, strict=True):
                known[_hash(source)] = result
                session.add(
                    TranslationCache(
                        source_hash=_hash(source),
                        target_lang=target.value,
                        text=result[:4000],
                        provider=provider.name,
                    )
                )
            try:
                await session.commit()
            except IntegrityError:
                await session.rollback()  # a concurrent request cached the same text

    output = [known.get(h, t) for t, h in zip(texts, hashes, strict=True)]
    return output, all(h in known for h in hashes)
