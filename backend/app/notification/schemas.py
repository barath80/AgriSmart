import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.core.language import Language
from app.notification.models import NotificationCategory


class NotificationTarget(BaseModel):
    """Empty lists mean "no restriction" on that dimension."""

    states: list[str] = []
    districts: list[str] = []
    crops: list[str] = []
    languages: list[Language] = []


class NotificationIn(BaseModel):
    idempotency_key: str = Field(min_length=8, max_length=80)
    category: NotificationCategory
    title: dict[Language, str]
    body: dict[Language, str]
    target: NotificationTarget

    @model_validator(mode="after")
    def _english_required(self) -> "NotificationIn":
        if Language.ENGLISH not in self.title or Language.ENGLISH not in self.body:
            raise ValueError("English title and body are required as the fallback")
        if any(len(t) > 120 for t in self.title.values()) or any(
            len(b) > 1000 for b in self.body.values()
        ):
            raise ValueError("Title max 120 and body max 1000 characters")
        return self


class NotificationOut(BaseModel):
    id: uuid.UUID
    category: NotificationCategory
    title: dict[str, str]
    target: dict
    recipients: int
    created_at: datetime
    sent: int = 0
    failed: int = 0
    pending: int = 0
