"""Imports every ORM model so `Base.metadata` is complete (Alembic, tests, seeding)."""

from app.admin.models import AuditLog
from app.assistant.models import ChatMessage, ChatSession
from app.auth.models import AuthSession, OtpCode, User
from app.calendar.models import CalendarEvent
from app.core.database import Base
from app.crop.models import Crop, CropRecommendation
from app.disease.models import DiagnosisPrediction, Disease
from app.farm.models import CropCycle, Farm, SoilRecord
from app.farmer.models import Farmer, Location
from app.language.models import TranslationCache
from app.market.models import Market, MarketPrice
from app.ml.models import MLModel
from app.notification.models import Notification, NotificationDelivery
from app.pest.models import Pest
from app.schemes.models import GovernmentScheme, SchemeRule
from app.support.models import SupportMessage
from app.voice.models import VoiceClip, VoiceSession
from app.weather.models import WeatherCache
from app.yield_prediction.models import YieldPrediction

__all__ = [
    "AuditLog",
    "AuthSession",
    "Base",
    "CalendarEvent",
    "ChatMessage",
    "ChatSession",
    "Crop",
    "CropCycle",
    "CropRecommendation",
    "DiagnosisPrediction",
    "Disease",
    "Farm",
    "Farmer",
    "GovernmentScheme",
    "Location",
    "MLModel",
    "SupportMessage",
    "Market",
    "MarketPrice",
    "Notification",
    "NotificationDelivery",
    "OtpCode",
    "Pest",
    "SchemeRule",
    "SoilRecord",
    "TranslationCache",
    "User",
    "VoiceClip",
    "VoiceSession",
    "WeatherCache",
    "YieldPrediction",
]
