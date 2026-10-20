"""Unit tests for the deterministic parts of AgriSmart: rules, calculations, parsing."""

import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pytest

from app.auth.schemas import normalize_indian_mobile
from app.calendar.rules import expand_template
from app.crop.rules import FarmConditions, adjust
from app.crop.schemas import CropInfo
from app.farm.models import Irrigation, Season, SoilType
from app.language.templates import format_number, render
from app.core.language import Language
from app.ml.runtime import encode_tabular
from app.profit.calculator import DEFAULT_SCENARIOS, FarmEconomics, apply_scenario
from app.schemes.eligibility import Eligibility, FarmerFacts, evaluate
from app.voice.audio import mulaw_decode, mulaw_encode, read_wav, resample, write_wav
from app.weather.rules import build_alerts, fertilizer_conflicts
from app.weather.schemas import CurrentWeather, DailyForecast, WeatherReport

LOCALES = Path(__file__).resolve().parents[1] / "app" / "language" / "locales"


# --- Profit -------------------------------------------------------------------------------

def test_profit_arithmetic():
    economics = FarmEconomics(area_acres=2, yield_q_per_acre=20, price_per_quintal=2000,
                              costs={"seeds": 4000, "fertilizer": 6000, "labour": 10000})
    assert economics.production_quintals == 40
    assert economics.revenue == 80_000
    assert economics.total_cost == 20_000
    assert economics.profit == 60_000
    assert economics.margin_pct == pytest.approx(75)
    assert economics.break_even_price == pytest.approx(500)
    assert economics.break_even_yield == pytest.approx(5)


def test_profit_scenarios_change_only_their_inputs():
    base = FarmEconomics(1, 10, 1000, {"fertilizer": 1000, "labour": 2000})
    by_key = {s.key: apply_scenario(base, s) for s in DEFAULT_SCENARIOS}
    assert by_key["price_down_10"].revenue == pytest.approx(9000)
    assert by_key["yield_down_25"].production_quintals == pytest.approx(7.5)
    assert by_key["fertilizer_cost_up_20"].total_cost == pytest.approx(3200)
    assert by_key["labour_cost_down_10"].total_cost == pytest.approx(2800)
    assert by_key["worst_case"].profit < base.profit


def test_profit_with_zero_production_has_no_break_even():
    economics = FarmEconomics(1, 0, 1000, {"seeds": 100})
    assert economics.break_even_price is None
    assert economics.margin_pct is None


# --- Scheme eligibility -------------------------------------------------------------------

MAANDHAN = [("min_age", 18), ("max_age", 40), ("max_land_acres", 4.94)]


def test_eligible_when_all_rules_pass():
    result = evaluate(MAANDHAN, FarmerFacts(age=30, land_acres=2))
    assert result.status is Eligibility.ELIGIBLE


def test_not_eligible_when_any_rule_fails():
    assert evaluate(MAANDHAN, FarmerFacts(age=55, land_acres=2)).status is Eligibility.NOT_ELIGIBLE
    assert evaluate(MAANDHAN, FarmerFacts(age=30, land_acres=10)).status is Eligibility.NOT_ELIGIBLE


def test_maybe_lists_missing_facts():
    result = evaluate(MAANDHAN, FarmerFacts(land_acres=2))
    assert result.status is Eligibility.MAYBE
    assert result.missing_facts == ["age"]


def test_state_and_crop_rules():
    rules = [("states_any", ["Tamil Nadu"]), ("crops_any", ["rice", "sugarcane"])]
    ok = FarmerFacts(state="tamil nadu", crops=frozenset({"rice"}))
    assert evaluate(rules, ok).status is Eligibility.ELIGIBLE
    wrong_state = FarmerFacts(state="Kerala", crops=frozenset({"rice"}))
    assert evaluate(rules, wrong_state).status is Eligibility.NOT_ELIGIBLE


def test_unknown_rule_type_never_passes():
    assert evaluate([("owns_tractor", True)], FarmerFacts()).status is Eligibility.MAYBE


# --- Calendar -----------------------------------------------------------------------------

TEMPLATE = [
    {"type": "sowing", "key": "sow_seeds", "day": 0},
    {"type": "fertilizer", "key": "top_dress_nitrogen", "day": 21, "window": 3},
    {"type": "irrigation", "key": "irrigate", "every": 10, "from": 10, "until": 40},
    {"type": "harvest", "key": "harvest", "day": 100},
]


def test_calendar_expands_one_off_and_recurring_events():
    sown = date(2026, 6, 15)
    events = expand_template(TEMPLATE, sown, irrigated=True)
    assert [e.scheduled_on for e in events if e.event_type == "irrigation"] == [
        sown + timedelta(days=d) for d in (10, 20, 30, 40)
    ]
    fertilizer = next(e for e in events if e.event_type == "fertilizer")
    assert fertilizer.scheduled_on == date(2026, 7, 6) and fertilizer.window_days == 3
    assert events == sorted(events, key=lambda e: (e.scheduled_on, e.event_type))


def test_rainfed_farms_get_no_irrigation_tasks():
    events = expand_template(TEMPLATE, date(2026, 6, 15), irrigated=False)
    assert all(e.event_type != "irrigation" for e in events)


def test_calendar_rejects_unknown_event_types():
    with pytest.raises(ValueError):
        expand_template([{"type": "dance", "key": "x", "day": 1}], date.today(), irrigated=True)


# --- Weather rules -------------------------------------------------------------------------

def _day(offset: int, **values) -> DailyForecast:
    defaults = {"temp_max_c": 32, "temp_min_c": 22, "rain_mm": 0, "rain_probability_pct": 5,
                "wind_max_kmh": 5, "condition": "clear"}
    return DailyForecast(date=date(2026, 7, 1) + timedelta(days=offset), **(defaults | values))


def _report(daily: list[DailyForecast]) -> WeatherReport:
    return WeatherReport(latitude=10, longitude=79, daily=daily, rainfall_last_90_days_mm=0,
                         current=CurrentWeather(temperature_c=30, humidity_pct=60, precipitation_mm=0,
                                                wind_kmh=5, condition="clear"),
                         source="test", fetched_at="2026-07-01T00:00:00Z")


def test_imd_rain_thresholds():
    alerts = build_alerts(_report([_day(0, rain_mm=70), _day(1, rain_mm=120), _day(2, rain_mm=30)]))
    codes = {a.code for a in alerts}
    assert {"heavy_rain", "very_heavy_rain"} <= codes


def test_rain_on_fertilizer_day_recommends_delay():
    daily = [_day(0), _day(1, rain_probability_pct=85), _day(2)]
    alerts = fertilizer_conflicts(daily, [date(2026, 7, 1)])  # rain the next day
    assert [a.code for a in alerts] == ["delay_fertilizer"]
    assert fertilizer_conflicts(daily, [date(2026, 7, 3)]) == []


def test_dry_spell_and_spraying_advice():
    calm = [_day(i) for i in range(7)]
    assert "dry_spell" in {a.code for a in build_alerts(_report(calm))}
    windy = [_day(0, wind_max_kmh=30)] + calm[1:]
    assert "avoid_spraying_wind" in {a.code for a in build_alerts(_report(windy))}


# --- Crop re-ranking -----------------------------------------------------------------------

RICE = CropInfo(slug="rice", names={"en": "Rice"}, aliases=[], category="cereal", seasons=["kharif"],
                duration_days_min=110, duration_days_max=150, water_requirement="high",
                suitable_soils=["clay"], fertilizer_guidance="", yield_min_q_per_acre=16,
                yield_max_q_per_acre=28, market_commodity=None)


def test_crop_adjustments_are_explained():
    result = adjust(RICE, FarmConditions(season=Season.RABI, irrigation=Irrigation.RAINFED,
                                         soil_type=SoilType.SANDY, rainfall_mm=40, previous_crop="rice"))
    assert result.reasons == ["off_season", "water_risk", "soil_mismatch", "rotation"]
    assert result.factor == pytest.approx(0.3 * 0.5 * 0.5 * 0.8)


def test_crops_outside_their_main_states_are_down_weighted():
    jute = RICE.model_copy(update={"slug": "jute", "growing_states": ["West Bengal", "Bihar", "Assam"]})
    far = adjust(jute, FarmConditions(state="Tamil Nadu"))
    assert far.reasons == ["uncommon_in_region"] and far.factor == pytest.approx(0.35)
    # Spelling and spacing of the farmer's state do not matter.
    assert adjust(jute, FarmConditions(state="west  bengal")).reasons == []
    # Widely grown crops (no list) are never penalised.
    assert adjust(RICE, FarmConditions(state="Tamil Nadu")).reasons == []


def test_ideal_conditions_do_not_penalise():
    result = adjust(RICE, FarmConditions(season=Season.KHARIF, irrigation=Irrigation.CANAL,
                                         soil_type=SoilType.CLAY))
    assert result.factor == 1 and result.reasons == []


# --- Encoding, audio, text -----------------------------------------------------------------

def test_tabular_encoding_matches_training_contract():
    spec = {"numeric": ["a", "b"], "categorical": {"crop": ["rice", "wheat"], "season": ["kharif"]}}
    row = encode_tabular(spec, {"a": 1, "b": 2.5, "crop": "wheat", "season": "zaid"})
    assert row.tolist() == [[1.0, 2.5, 0.0, 1.0, 0.0]]  # unknown season → all zeros


def test_mulaw_roundtrip_is_close():
    t = np.linspace(0, 1, 8000, endpoint=False)
    signal = (8000 * np.sin(2 * np.pi * 440 * t)).astype(np.int16)
    decoded = mulaw_decode(mulaw_encode(signal))
    assert np.max(np.abs(decoded.astype(int) - signal.astype(int))) < 600  # μ-law step size


def test_wav_and_resample_roundtrip():
    samples = (np.arange(16000) % 200 - 100).astype(np.int16)
    restored, rate = read_wav(write_wav(samples, 16000))
    assert rate == 16000 and np.array_equal(restored, samples)
    assert resample(samples, 16000, 8000).size == 8000


@pytest.mark.parametrize("raw", ["9876543210", "+91 98765 43210", "09876543210", "91-9876543210"])
def test_indian_mobile_normalisation(raw):
    assert normalize_indian_mobile(raw) == "+919876543210"


@pytest.mark.parametrize("raw", ["12345", "5876543210", "+1 415 555 0100"])
def test_invalid_mobile_numbers_rejected(raw):
    with pytest.raises(ValueError):
        normalize_indian_mobile(raw)


def test_indian_number_grouping():
    assert format_number(1234567) == "12,34,567"
    assert format_number(999) == "999"
    assert format_number(-45000) == "-45,000"


@pytest.mark.parametrize("language", list(Language))
def test_every_language_has_every_template(language):
    def keys(code: str) -> set[str]:
        return set(json.loads((LOCALES / f"{code}.json").read_text(encoding="utf-8")))

    assert keys("en") - keys(language.value) == set()
    assert render("voice.welcome", language)


def test_list_separator_keeps_its_space():
    from app.language.templates import join_list

    assert join_list(["Rice", "Banana"], Language.TAMIL) == "Rice, Banana"


def test_localized_never_falls_back_to_a_third_language():
    from app.core.language import localized

    assert localized({"hi": "प्रधानमंत्री"}, Language.TAMIL) == ""
    assert localized({"hi": "धान", "en": "Rice"}, Language.TAMIL) == "Rice"
