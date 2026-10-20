from enum import StrEnum


class Intent(StrEnum):
    WEATHER = "weather"
    MARKET_PRICE = "market_price"
    CROP_RECOMMENDATION = "crop_recommendation"
    DISEASE_DIAGNOSIS = "disease_diagnosis"
    PEST_DIAGNOSIS = "pest_diagnosis"
    SCHEMES = "schemes"
    YIELD_ESTIMATE = "yield_estimate"
    PROFIT = "profit"
    CALENDAR = "calendar"
    NOTIFICATIONS = "notifications"
    GREETING = "greeting"
    HELP = "help"
    GENERAL = "general"  # open conversation → LLM, if one is configured


# When two intents score equally, the more specific one wins.
PRIORITY = [
    Intent.PEST_DIAGNOSIS,
    Intent.DISEASE_DIAGNOSIS,
    Intent.CROP_RECOMMENDATION,
    Intent.YIELD_ESTIMATE,
    Intent.PROFIT,
    Intent.MARKET_PRICE,
    Intent.SCHEMES,
    Intent.CALENDAR,
    Intent.WEATHER,
    Intent.NOTIFICATIONS,
    Intent.HELP,
    Intent.GREETING,
]
