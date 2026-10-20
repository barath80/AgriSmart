"""Spoken/written response templates per language (`locales/<lang>.json`).

Templates are static, reviewed text with `{placeholders}` — the deterministic half of every
answer. Missing keys fall back to English so a partially translated language still works.
"""

import json
from functools import lru_cache
from pathlib import Path

from app.core.language import DEFAULT_LANGUAGE, Language

_LOCALES_DIR = Path(__file__).parent / "locales"


@lru_cache
def _templates(language: Language) -> dict[str, str]:
    path = _LOCALES_DIR / f"{language.value}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


class _SafeParams(dict):
    def __missing__(self, key: str) -> str:
        return ""


def render(key: str, language: Language, **params: object) -> str:
    template = _templates(language).get(key) or _templates(DEFAULT_LANGUAGE).get(key)
    if template is None:
        raise KeyError(f"missing template {key!r}")
    return template.format_map(_SafeParams(params)).strip()


def has_template(key: str) -> bool:
    return key in _templates(DEFAULT_LANGUAGE)


def join_list(items: list[str], language: Language) -> str:
    # Looked up directly: render() trims whitespace, which would drop the space in ", ".
    separator = (
        _templates(language).get("list_separator") or _templates(DEFAULT_LANGUAGE)["list_separator"]
    )
    return separator.join(items)


def format_number(value: float) -> str:
    """Indian digit grouping (1,23,456) — how farmers read prices and areas."""
    rounded = round(value)
    sign, digits = ("-" if rounded < 0 else ""), str(abs(rounded))
    if len(digits) <= 3:
        return sign + digits
    head, tail = digits[:-3], digits[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return sign + ",".join(groups + [tail])
