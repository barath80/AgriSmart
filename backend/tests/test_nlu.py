"""AgriBrain intent detection across all launch languages, including code-switching."""

import json
from pathlib import Path

import pytest

from app.assistant.intents import Intent
from app.assistant.nlu import normalize, understand
from app.core.language import Language
from app.crop.schemas import CropInfo

SEEDS = Path(__file__).resolve().parents[1] / "seeds" / "crops.json"
CATALOG = {c["slug"]: CropInfo.model_validate(c) for c in json.loads(SEEDS.read_text(encoding="utf-8"))}

CASES = [
    # English — the spec's example questions
    ("en", "What crop should I grow?", Intent.CROP_RECOMMENDATION, None),
    ("en", "What is today's weather?", Intent.WEATHER, None),
    ("en", "What is today's market price of onion?", Intent.MARKET_PRICE, "onion"),
    ("en", "Which government schemes are available?", Intent.SCHEMES, None),
    ("en", "What disease is affecting my plant?", Intent.DISEASE_DIAGNOSIS, None),
    ("en", "How much profit can I expect?", Intent.PROFIT, None),
    ("en", "When should I apply fertilizer?", Intent.CALENDAR, None),
    ("en", "There are worms eating my cotton", Intent.PEST_DIAGNOSIS, "cotton"),
    # Tamil
    ("ta", "நாளை மழை வருமா?", Intent.WEATHER, None),
    ("ta", "தக்காளி விலை என்ன?", Intent.MARKET_PRICE, "tomato"),
    ("ta", "எந்த பயிர் பயிரிடலாம்?", Intent.CROP_RECOMMENDATION, None),
    ("ta", "என் நெல் இலையில் புள்ளி உள்ளது", Intent.DISEASE_DIAGNOSIS, "rice"),
    # Hindi, including Latin-script and English code-switching
    ("hi", "आज मौसम कैसा है?", Intent.WEATHER, None),
    ("hi", "प्याज का भाव क्या है?", Intent.MARKET_PRICE, "onion"),
    ("hi", "कौन सी फसल लगाऊं?", Intent.CROP_RECOMMENDATION, None),
    ("hi", "सरकारी योजना के बारे में बताओ", Intent.SCHEMES, None),
    ("hi", "गेहूं में यूरिया कब डालूं?", Intent.CALENDAR, "wheat"),
    # Speech recognition writes ँ where the catalogue has ं
    ("hi", "गेहूँ का भाव क्या है?", Intent.MARKET_PRICE, "wheat"),
    ("hi", "mandi rate batao tomato ka", Intent.MARKET_PRICE, "tomato"),
    # Telugu
    ("te", "రేపు వర్షం పడుతుందా?", Intent.WEATHER, None),
    ("te", "పత్తి ధర ఎంత?", Intent.MARKET_PRICE, "cotton"),
    ("te", "ఏ పంట వేయాలి?", Intent.CROP_RECOMMENDATION, None),
    # Kannada
    ("kn", "ನಾಳೆ ಮಳೆ ಬರುತ್ತದೆಯೇ?", Intent.WEATHER, None),
    ("kn", "ಈರುಳ್ಳಿ ಬೆಲೆ ಎಷ್ಟು?", Intent.MARKET_PRICE, "onion"),
    ("kn", "ಕಡಲೆಕಾಯಿ ಇಳುವರಿ ಎಷ್ಟು ಬರುತ್ತದೆ?", Intent.YIELD_ESTIMATE, "groundnut"),
    # Marathi
    ("mr", "उद्या पाऊस पडेल का?", Intent.WEATHER, None),
    ("mr", "कांदा भाव काय आहे?", Intent.MARKET_PRICE, "onion"),
    ("mr", "कांद्याचा बाजारभाव सांगा", Intent.MARKET_PRICE, "onion"),
    ("mr", "बटाट्याचा भाव किती आहे?", Intent.MARKET_PRICE, "potato"),
    ("mr", "कोणते पीक घ्यावे?", Intent.CROP_RECOMMENDATION, None),
    ("mr", "पीएम किसान योजना", Intent.SCHEMES, None),
    # Bengali
    ("bn", "আগামীকাল বৃষ্টি হবে?", Intent.WEATHER, None),
    ("bn", "পেঁয়াজের দাম কত?", Intent.MARKET_PRICE, "onion"),
    ("bn", "ধানের পাতায় দাগ", Intent.DISEASE_DIAGNOSIS, "rice"),
    # Gujarati
    ("gu", "કપાસનો ભાવ શું છે?", Intent.MARKET_PRICE, "cotton"),
    ("gu", "કયો પાક વાવું?", Intent.CROP_RECOMMENDATION, None),
    # Malayalam
    ("ml", "നാളെ മഴ പെയ്യുമോ?", Intent.WEATHER, None),
    ("ml", "തക്കാളി വില എത്ര?", Intent.MARKET_PRICE, "tomato"),
    # Punjabi
    ("pa", "ਕਣਕ ਨੂੰ ਖਾਦ ਕਦੋਂ ਪਾਈਏ?", Intent.CALENDAR, "wheat"),
    ("pa", "ਸਰਕਾਰੀ ਸਕੀਮਾਂ ਦੱਸੋ", Intent.SCHEMES, None),
    # Odia
    ("or", "କାଲି ବର୍ଷା ହେବ କି?", Intent.WEATHER, None),
    ("or", "ଧାନ ଦର କେତେ?", Intent.MARKET_PRICE, "rice"),
    # Alerts, read aloud
    ("hi", "कोई सूचना है?", Intent.NOTIFICATIONS, None),
    ("ta", "புதிய அறிவிப்புகள் உள்ளதா?", Intent.NOTIFICATIONS, None),
]


@pytest.mark.parametrize(("lang", "text", "intent", "crop"), CASES)
def test_intent_and_crop(lang, text, intent, crop):
    result = understand(text, Language(lang), CATALOG)
    assert result.intent is intent, (text, result)
    if crop is not None:
        assert result.crop == crop


@pytest.mark.parametrize(("lang", "text"), [("ta", "நாளை மழை வருமா?"), ("te", "రేపు వర్షం"),
                                            ("kn", "ನಾಳೆ ಮಳೆ"), ("mr", "उद्या पाऊस"), ("en", "rain tomorrow")])
def test_tomorrow_is_detected(lang, text):
    assert understand(text, Language(lang), CATALOG).day_offset == 1


def test_short_words_do_not_match_inside_longer_words():
    # "आम" (mango) must not be found inside "आमदनी" (income).
    result = understand("मेरी आमदनी कितनी होगी", Language.HINDI, CATALOG)
    assert result.crop is None
    assert result.intent is Intent.PROFIT


def test_longest_crop_name_wins():
    # Kannada ಕಡಲೆ (chickpea) is a prefix of ಕಡಲೆಕಾಯಿ (groundnut).
    assert understand("ಕಡಲೆಕಾಯಿ ಬೆಲೆ", Language.KANNADA, CATALOG).crop == "groundnut"


def test_greeting_with_question_routes_to_question():
    assert understand("Hello, what is the weather?", Language.ENGLISH, CATALOG).intent is Intent.WEATHER


def test_unknown_text_is_general():
    assert understand("tell me a story", Language.ENGLISH, CATALOG).intent is Intent.GENERAL


def test_normalize_keeps_indic_vowel_signs():
    assert normalize("மழை!!") == "மழை"
    assert normalize("बारिश?") == "बारिश"



def test_typed_language_follows_the_script():
    from app.core.language import Language, language_of_text

    assert language_of_text("टमाटर का भाव क्या है?", Language.ENGLISH) is Language.HINDI
    assert language_of_text("टोमॅटोचा भाव काय आहे?", Language.MARATHI) is Language.MARATHI
    assert language_of_text("தக்காளி விலை என்ன", Language.HINDI) is Language.TAMIL
    assert language_of_text("tamatar ka bhav kya hai", Language.HINDI) is Language.HINDI
    assert language_of_text("123 ?", Language.TELUGU) is Language.TELUGU
