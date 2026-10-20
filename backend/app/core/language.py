"""Supported languages — the single place to add a new one.

Adding a language means: a member here, a backend template file in
`app/assistant/locales/`, a lexicon in `app/assistant/lexicons/`, and the app's
`locales/<code>.json`. No business logic changes.
"""

from enum import StrEnum


class Language(StrEnum):
    ENGLISH = "en"
    TAMIL = "ta"
    HINDI = "hi"
    TELUGU = "te"
    KANNADA = "kn"
    MARATHI = "mr"
    BENGALI = "bn"
    GUJARATI = "gu"
    MALAYALAM = "ml"
    PUNJABI = "pa"
    ODIA = "or"

    @property
    def native_name(self) -> str:
        return _NATIVE_NAMES[self]


_NATIVE_NAMES = {
    Language.ENGLISH: "English",
    Language.TAMIL: "தமிழ்",
    Language.HINDI: "हिन्दी",
    Language.TELUGU: "తెలుగు",
    Language.KANNADA: "ಕನ್ನಡ",
    Language.MARATHI: "मराठी",
    Language.BENGALI: "বাংলা",
    Language.GUJARATI: "ગુજરાતી",
    Language.MALAYALAM: "മലയാളം",
    Language.PUNJABI: "ਪੰਜਾਬੀ",
    Language.ODIA: "ଓଡ଼ିଆ",
}

DEFAULT_LANGUAGE = Language.ENGLISH


def localized(value: dict[str, str] | None, language: Language) -> str:
    """Pick a language from a `{"en": ..., "ta": ...}` map, falling back to English."""
    if not value:
        return ""
    # Never fall back to a third language: a Tamil farmer should get English, not Hindi.
    return value.get(language.value) or value.get(DEFAULT_LANGUAGE.value) or ""


# Unicode blocks of the scripts our languages are written in. Devanagari is shared by Hindi
# and Marathi; Gurmukhi is Punjabi; the others map one to one.
_SCRIPTS = (
    (0x0900, 0x097F, (Language.HINDI, Language.MARATHI)),
    (0x0980, 0x09FF, (Language.BENGALI,)),
    (0x0A00, 0x0A7F, (Language.PUNJABI,)),
    (0x0A80, 0x0AFF, (Language.GUJARATI,)),
    (0x0B00, 0x0B7F, (Language.ODIA,)),
    (0x0B80, 0x0BFF, (Language.TAMIL,)),
    (0x0C00, 0x0C7F, (Language.TELUGU,)),
    (0x0C80, 0x0CFF, (Language.KANNADA,)),
    (0x0D00, 0x0D7F, (Language.MALAYALAM,)),
)


def language_of_text(text: str, preferred: Language, *, latin_is_english: bool = False) -> Language:
    """The language a message is written in, judged by its script.

    A farmer whose profile says English may still type in Hindi; answering "I did not
    understand" would be wrong. Typed Latin-script text keeps the preferred language, because
    romanised Hindi or Tamil is common and cannot be told apart from English by script.
    Speech transcripts are written in each language's own script, so there Latin text means
    the farmer spoke English (`latin_is_english`).
    """
    if latin_is_english:
        letters = [ch for ch in text if ch.isalpha()]
        latin = sum(ch.isascii() for ch in letters)
        if letters and latin / len(letters) > 0.8:
            return Language.ENGLISH
    counts: dict[tuple[Language, ...], int] = {}
    for ch in text:
        point = ord(ch)
        for low, high, languages in _SCRIPTS:
            if low <= point <= high:
                counts[languages] = counts.get(languages, 0) + 1
                break
    if not counts:
        return preferred
    languages = max(counts, key=counts.__getitem__)
    return preferred if preferred in languages else languages[0]
