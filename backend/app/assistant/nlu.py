"""Deterministic intent detection and entity extraction.

Fast, free and predictable: most farmer questions ("what is the price of onion?") never
need an LLM. Lexicons are data (`lexicons/<lang>.json`); the English lexicon is always
applied too, because farmers often mix English words into their own language.
"""

import json
import re
import unicodedata
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from app.assistant.intents import PRIORITY, Intent
from app.core.language import Language
from app.crop.schemas import CropInfo

_LEXICON_DIR = Path(__file__).parent / "lexicons"
_SHORT_KEYWORD = 3  # code points


@dataclass(slots=True)
class NluResult:
    intent: Intent
    score: float
    crop: str | None = None
    day_offset: int = 0  # 0 = today, 1 = tomorrow
    matched: list[str] = field(default_factory=list)
    # Other topics in the same message ("explain AgriSmart and today's weather"), best first.
    also: list[Intent] = field(default_factory=list)


_CANONICAL = str.maketrans({"ँ": "ं", "‍": None, "‌": None})


def normalize(text: str) -> str:
    """Casefold and replace punctuation/symbols with spaces.

    Uses Unicode categories rather than the regex word class, because Indic vowel signs
    and viramas are combining marks the word class does not match — stripping them would
    corrupt the words.
    """
    text = unicodedata.normalize("NFC", text).casefold()
    # Speech recognition and keyboards use ँ (chandrabindu) and ं (anusvara) interchangeably
    # in Hindi and Marathi (गेहूँ / गेहूं); ZWJ/ZWNJ are invisible and change nothing for NLU.
    text = text.translate(_CANONICAL)
    text = "".join(" " if unicodedata.category(ch)[0] in "PS" else ch for ch in text)
    return " ".join(text.split())


@lru_cache
def _lexicon(language: Language) -> dict[str, list[str]]:
    path = _LEXICON_DIR / f"{language.value}.json"
    own = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    if language is Language.ENGLISH:
        return own
    english = _lexicon(Language.ENGLISH)
    return {key: own.get(key, []) + english.get(key, []) for key in set(own) | set(english)}


def _contains(text: str, keyword: str, endings: tuple[str, ...] = ()) -> bool:
    keyword = normalize(keyword)
    if not keyword:
        return False
    if keyword.isascii():
        return re.search(rf"\b{re.escape(keyword)}\b", text) is not None
    escaped = re.escape(keyword)
    if len(keyword) <= _SHORT_KEYWORD:
        # Very short words (आम, कल, மா) must match a whole word — "आम" is not "आमदनी" —
        # optionally followed by one of the language's grammatical endings (ধান → ধানের).
        allowed = "|".join(re.escape(e) for e in sorted(endings, key=len, reverse=True))
        return re.search(rf"(?:^|\s){escaped}(?:{allowed})?(?:\s|$)", text) is not None
    # Indic languages attach suffixes (மழையா, बारिशें, ಮಳೆಯಿಂದ): match at a word start.
    return re.search(rf"(?:^|\s){escaped}", text) is not None


def _score(
    text: str, keywords: list[str], endings: tuple[str, ...] = ()
) -> tuple[float, list[str]]:
    hits = [k for k in keywords if _contains(text, k, endings)]
    # Multi-word phrases are stronger evidence than single words.
    return sum(1.0 + 0.5 * k.count(" ") for k in hits), hits


def _inflected_stems(name: str) -> list[str]:
    """Marathi nouns ending in ा change their stem before case endings:
    कांदा → कांद्याचा, बटाटा → बटाट्याचा, हरभरा → हरभऱ्याचा."""
    if len(name) > 3 and name.endswith("ा") and "ऀ" <= name[0] <= "ॿ":
        stem = name[:-1]
        stems = [stem + "्या"]
        if stem.endswith("र"):
            stems.append(stem[:-1] + "ऱ्या")
        return stems
    return []


def find_crop(text: str, catalog: dict[str, CropInfo], endings: tuple[str, ...] = ()) -> str | None:
    """Longest matching crop name/alias in any language, so 'black gram' beats 'gram'."""
    best: tuple[int, str] | None = None
    for slug, info in catalog.items():
        names = [*info.names.values(), *info.aliases, slug.replace("_", " ")]
        for name in [*names, *(v for n in names for v in _inflected_stems(n))]:
            if name and _contains(text, name, endings) and (best is None or len(name) > best[0]):
                best = (len(name), slug)
    return best[1] if best else None


def understand(text: str, language: Language, catalog: dict[str, CropInfo]) -> NluResult:
    normalized = normalize(text)
    lexicon = _lexicon(language)
    endings = tuple(lexicon.get("endings", []))

    scored: list[tuple[float, int, Intent, list[str]]] = []
    for rank, intent in enumerate(PRIORITY):
        score, hits = _score(normalized, lexicon.get(intent.value, []), endings)
        if score > 0:
            scored.append((score, -rank, intent, hits))
    scored.sort(reverse=True)

    day_offset = 1 if _score(normalized, lexicon.get("time_tomorrow", []), endings)[0] else 0
    crop = find_crop(normalized, catalog, endings)

    if not scored:
        return NluResult(Intent.GENERAL, 0.0, crop=crop, day_offset=day_offset)
    # A bare greeting followed by a real question is a question.
    topics = [entry for entry in scored if entry[2] is not Intent.GREETING] or scored
    score, _, intent, hits = topics[0]
    also = [entry[2] for entry in topics[1:]]
    return NluResult(intent, score, crop=crop, day_offset=day_offset, matched=hits, also=also)
