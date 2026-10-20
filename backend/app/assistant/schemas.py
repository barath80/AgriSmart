import uuid
from typing import Any

from pydantic import BaseModel, Field

from app.core.language import Language


class AssistantQuery(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    language: Language | None = None  # defaults to the farmer's preferred language
    session_id: uuid.UUID | None = None
    speak: bool = False  # also return synthesized speech, if a TTS provider is configured


class AssistantAction(BaseModel):
    """Something the client should do next, e.g. open the camera.

    Only emitted when the farmer's device can actually do it.
    """

    type: str  # capture_image | open_screen
    target: str  # disease | pest | soil | profit | farm | profile


class AssistantReply(BaseModel):
    session_id: uuid.UUID | None  # None when nothing was heard and no conversation exists yet
    intent: str
    handled_by: str
    language: Language
    text: str
    data: dict[str, Any] | None = None
    action: AssistantAction | None = None
    audio_base64: str | None = None
    audio_mime: str | None = None
    transcript: str | None = None  # what we heard, for voice turns
