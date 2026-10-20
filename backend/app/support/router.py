"""Farmer side of the help desk: write to the AgriSmart team, read their replies."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update

from app.auth.dependencies import CurrentFarmer, DbSession
from app.core.database import utcnow
from app.core.rate_limit import rate_limit
from app.support.models import SupportMessage

router = APIRouter(prefix="/support", tags=["support"])

MAX_HISTORY = 200


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class MessageOut(BaseModel):
    id: uuid.UUID
    sender: str
    body: str
    created_at: datetime
    read: bool


class Thread(BaseModel):
    unread: int
    messages: list[MessageOut]


def message_out(message: SupportMessage) -> MessageOut:
    return MessageOut(
        id=message.id,
        sender=message.sender,
        body=message.body,
        created_at=message.created_at,
        read=message.read_at is not None,
    )


@router.get("")
async def get_thread(farmer: CurrentFarmer, session: DbSession) -> Thread:
    rows = list(
        await session.scalars(
            select(SupportMessage)
            .where(SupportMessage.farmer_id == farmer.id)
            .order_by(SupportMessage.created_at.desc())
            .limit(MAX_HISTORY)
        )
    )
    rows.reverse()
    return Thread(
        unread=sum(1 for m in rows if m.sender == "admin" and m.read_at is None),
        messages=[message_out(m) for m in rows],
    )


@router.get("/unread")
async def unread_count(farmer: CurrentFarmer, session: DbSession) -> dict[str, int]:
    count = await session.scalar(
        select(func.count())
        .select_from(SupportMessage)
        .where(
            SupportMessage.farmer_id == farmer.id,
            SupportMessage.sender == "admin",
            SupportMessage.read_at.is_(None),
        )
    )
    return {"unread": count or 0}


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("support", 10))],
)
async def send_message(body: MessageIn, farmer: CurrentFarmer, session: DbSession) -> MessageOut:
    message = SupportMessage(farmer_id=farmer.id, sender="farmer", body=body.body.strip())
    session.add(message)
    await session.commit()
    await session.refresh(message)
    return message_out(message)


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(farmer: CurrentFarmer, session: DbSession) -> None:
    await session.execute(
        update(SupportMessage)
        .where(
            SupportMessage.farmer_id == farmer.id,
            SupportMessage.sender == "admin",
            SupportMessage.read_at.is_(None),
        )
        .values(read_at=utcnow())
    )
    await session.commit()
