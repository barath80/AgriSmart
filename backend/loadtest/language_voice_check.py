"""Checks the whole language and voice workflow against a running API, language by language.

For every supported language a new farmer is registered with a password, then:
  1. text -> text   three questions in the language (weather, onion price, government schemes);
                    the detected intent, the reply language and the reply script are checked.
  2. text -> speech the reply is turned into audio (needs a voice provider).
  3. speech -> text -> speech   the question is spoken with TTS, uploaded as a voice command, and
                    the transcript is compared with what was said; the spoken reply is checked.

    python -m loadtest.language_voice_check --url http://127.0.0.1:8000 [--languages te hi]

Real voice providers are called, so this uses a little of their credit. The questions are short and
simple on purpose: it measures whether the workflow works in each language, not how well the
assistant copes with every way a farmer might phrase a question.
"""

import argparse
import base64
import difflib
import io
import time
import unicodedata

import httpx

QUESTIONS = {
    "en": [
        "What is the weather today?",
        "What is the price of onion?",
        "Tell me about government schemes",
    ],
    "hi": ["आज का मौसम कैसा है?", "प्याज़ का भाव क्या है?", "सरकारी योजनाएँ बताइए"],
    "te": ["ఈ రోజు వాతావరణం ఎలా ఉంది?", "ఉల్లిపాయ ధర ఎంత?", "ప్రభుత్వ పథకాల గురించి చెప్పండి"],
    "ta": ["இன்றைய வானிலை எப்படி இருக்கிறது?", "வெங்காயத்தின் விலை என்ன?", "அரசு திட்டங்கள் பற்றி சொல்லுங்கள்"],
    "kn": ["ಇಂದಿನ ಹವಾಮಾನ ಹೇಗಿದೆ?", "ಈರುಳ್ಳಿ ಬೆಲೆ ಎಷ್ಟು?", "ಸರ್ಕಾರಿ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ಹೇಳಿ"],
    "ml": ["ഇന്നത്തെ കാലാവസ്ഥ എങ്ങനെയാണ്?", "ഉള്ളിയുടെ വില എത്രയാണ്?", "സർക്കാർ പദ്ധതികളെക്കുറിച്ച് പറയൂ"],
    "mr": ["आजचे हवामान कसे आहे?", "कांद्याचा भाव काय आहे?", "सरकारी योजनांबद्दल सांगा"],
    "bn": ["আজকের আবহাওয়া কেমন?", "পেঁয়াজের দাম কত?", "সরকারি প্রকল্প সম্পর্কে বলুন"],
    "gu": ["આજનું હવામાન કેવું છે?", "ડુંગળીનો ભાવ શું છે?", "સરકારી યોજનાઓ વિશે કહો"],
    "pa": ["ਅੱਜ ਦਾ ਮੌਸਮ ਕਿਵੇਂ ਹੈ?", "ਪਿਆਜ਼ ਦਾ ਭਾਅ ਕੀ ਹੈ?", "ਸਰਕਾਰੀ ਸਕੀਮਾਂ ਬਾਰੇ ਦੱਸੋ"],
    "or": ["ଆଜି ପାଣିପାଗ କେମିତି ଅଛି?", "ପିଆଜର ଦାମ କେତେ?", "ସରକାରୀ ଯୋଜନା ବିଷୟରେ କୁହନ୍ତୁ"],
}
EXPECTED_INTENTS = ["weather", "market_price", "schemes"]
SCRIPT = {  # Unicode block of each language's script (English: Latin)
    "hi": (0x0900, 0x097F),
    "mr": (0x0900, 0x097F),
    "bn": (0x0980, 0x09FF),
    "pa": (0x0A00, 0x0A7F),
    "gu": (0x0A80, 0x0AFF),
    "or": (0x0B00, 0x0B7F),
    "ta": (0x0B80, 0x0BFF),
    "te": (0x0C00, 0x0C7F),
    "kn": (0x0C80, 0x0CFF),
    "ml": (0x0D00, 0x0D7F),
    "en": (0x0041, 0x007A),
}


def script_share(text: str, language: str) -> float:
    low, high = SCRIPT[language]
    letters = [c for c in text if unicodedata.category(c).startswith(("L", "M"))]
    return sum(low <= ord(c) <= high for c in letters) / len(letters) if letters else 0.0


def similarity(a: str, b: str) -> float:
    def strip(s: str) -> str:
        return "".join(c for c in s.lower() if c.isalnum())

    return difflib.SequenceMatcher(None, strip(a), strip(b)).ratio()


def check_language(client: httpx.Client, language: str, stamp: int) -> dict:
    result: dict = {"language": language, "text": [], "tts": None, "voice": []}
    phone = f"7{list(QUESTIONS).index(language):02d}{stamp % 10**7:07d}"
    tokens = client.post(
        "/auth/register",
        json={
            "phone": phone,
            "password": "Language-check-1",
            "name": f"check-{language}",
            "language": language,
        },
    )
    tokens.raise_for_status()
    headers = {"Authorization": "Bearer " + tokens.json()["access_token"]}

    # 1. text -> text
    last_reply = ""
    for question, expected in zip(QUESTIONS[language], EXPECTED_INTENTS, strict=True):
        started = time.perf_counter()
        r = client.post(
            "/assistant/query", headers=headers, json={"text": question, "language": language}
        )
        row = {
            "question": question,
            "status": r.status_code,
            "seconds": round(time.perf_counter() - started, 2),
        }
        if r.status_code == 200:
            body = r.json()
            last_reply = body["text"]
            row.update(
                intent=body["intent"],
                intent_ok=body["intent"] == expected,
                handled_by=body["handled_by"],
                reply_language_ok=body["language"] == language,
                script_share=round(script_share(body["text"], language), 2),
                reply=body["text"][:90],
            )
        result["text"].append(row)

    # 2. text -> speech
    started = time.perf_counter()
    r = client.post(
        "/voice/tts",
        headers=headers,
        json={"text": last_reply[:300] or QUESTIONS[language][0], "language": language},
    )
    if r.status_code == 200:
        audio = base64.b64decode(r.json()["audio_base64"])
        result["tts"] = {
            "ok": len(audio) > 2000,
            "bytes": len(audio),
            "mime": r.json()["audio_mime"],
            "seconds": round(time.perf_counter() - started, 2),
        }
    else:
        result["tts"] = {"ok": False, "status": r.status_code, "error": r.text[:120]}

    # 3. speech -> text -> speech, for the weather and price questions
    session = client.post(
        "/voice/session", headers=headers, json={"language": language, "speak_greeting": False}
    )
    session_id = session.json()["session_id"]
    for question, expected in list(zip(QUESTIONS[language], EXPECTED_INTENTS, strict=True))[:2]:
        said = client.post(
            "/voice/tts", headers=headers, json={"text": question, "language": language}
        )
        if said.status_code != 200:
            result["voice"].append(
                {"question": question, "ok": False, "error": f"tts {said.status_code}"}
            )
            continue
        wav = base64.b64decode(said.json()["audio_base64"])
        started = time.perf_counter()
        r = client.post(
            f"/voice/session/{session_id}/utterance",
            headers=headers,
            files={"audio": ("question.wav", io.BytesIO(wav), said.json()["audio_mime"])},
        )
        row = {
            "question": question,
            "status": r.status_code,
            "seconds": round(time.perf_counter() - started, 2),
        }
        if r.status_code == 200:
            body = r.json()
            row.update(
                heard=body.get("transcript"),
                heard_similarity=round(similarity(question, body.get("transcript") or ""), 2),
                intent=body["intent"],
                intent_ok=body["intent"] == expected,
                spoken_reply=bool(body.get("audio_base64")),
            )
        else:
            row["error"] = r.text[:120]
        result["voice"].append(row)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--languages", nargs="*", default=list(QUESTIONS))
    args = parser.parse_args()
    client = httpx.Client(base_url=args.url.rstrip("/") + "/api/v1", timeout=120)
    stamp = int(time.time())
    totals = {
        "text": [0, 0],
        "tts": [0, 0],
        "stt": [0, 0],
        "voice_intent": [0, 0],
        "script": [0, 0],
    }
    for language in args.languages:
        r = check_language(client, language, stamp)
        for t in r["text"]:
            totals["text"][1] += 1
            totals["text"][0] += bool(t.get("intent_ok"))
            totals["script"][1] += 1
            totals["script"][0] += t.get("script_share", 0) >= 0.7
        totals["tts"][1] += 1
        totals["tts"][0] += bool(r["tts"] and r["tts"].get("ok"))
        for v in r["voice"]:
            totals["stt"][1] += 1
            totals["stt"][0] += v.get("heard_similarity", 0) >= 0.7
            totals["voice_intent"][1] += 1
            totals["voice_intent"][0] += bool(v.get("intent_ok"))
        print(f"\n=== {language}")
        for t in r["text"]:
            print(
                f"  text  {t['status']} {t.get('intent', '-'):<13} ok={t.get('intent_ok')} "
                f"script={t.get('script_share')} "
                f"by={t.get('handled_by')} {t['seconds']}s | {t['question']}"
            )
        print(f"  tts   {r['tts']}")
        for v in r["voice"]:
            print(
                f"  voice {v.get('status')} heard_similarity={v.get('heard_similarity')} "
                f"intent={v.get('intent')} "
                f"ok={v.get('intent_ok')} spoken_reply={v.get('spoken_reply')} {v.get('seconds')}s "
                f"| heard: {v.get('heard')}"
            )
    print("\nSUMMARY (passed/total)")
    for name, (ok, n) in totals.items():
        print(f"  {name:<13} {ok}/{n}" + (f"  ({100 * ok / n:.0f}%)" if n else ""))


if __name__ == "__main__":
    main()
