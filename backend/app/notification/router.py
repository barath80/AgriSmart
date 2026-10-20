import uuid
from datetime import datetime

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.auth.dependencies import CurrentFarmer, DbSession
from app.core.language import localized
from app.notification import service

router = APIRouter(prefix="/notifications", tags=["notifications"])


class InboxItem(BaseModel):
    id: uuid.UUID
    category: str
    title: str
    body: str
    created_at: datetime
    read: bool


class Inbox(BaseModel):
    unread: int
    items: list[InboxItem]


class MarkRead(BaseModel):
    ids: list[uuid.UUID] | None = Field(
        None, max_length=200, description="Omit to mark everything read"
    )


@router.get("")
async def get_inbox(farmer: CurrentFarmer, session: DbSession) -> Inbox:
    """The farmer's alerts in their language — also readable aloud from the app."""
    language = farmer.preferred_language
    rows = await service.inbox(session, farmer)
    return Inbox(
        unread=await service.unread_count(session, farmer),
        items=[
            InboxItem(
                id=delivery.id,
                category=notification.category.value,
                title=localized(notification.title, language),
                body=localized(notification.body, language),
                created_at=notification.created_at,
                read=delivery.read_at is not None,
            )
            for delivery, notification in rows
        ],
    )


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(body: MarkRead, farmer: CurrentFarmer, session: DbSession) -> None:
    await service.mark_read(session, farmer, body.ids)
