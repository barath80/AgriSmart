"""Live scheme sync shared by the worker, the CLI and the admin "Sync now" button."""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.notification.service import queue_scheme_announcements
from app.schemes.models import GovernmentScheme
from app.schemes.providers import configured_provider
from app.schemes.service import sync_schemes


@dataclass(frozen=True, slots=True)
class SyncReport:
    source: str
    synced: int
    new: int
    retired: int
    announced: int


async def sync_live_schemes(session: AsyncSession) -> SyncReport | None:
    """Pull the live catalogue and announce schemes that are new since the last sync.
    Returns None when no live provider is configured."""
    provider = configured_provider()
    if provider is None:
        return None
    seen_before = await session.scalar(
        select(GovernmentScheme.id).where(GovernmentScheme.source == provider.name).limit(1)
    )
    result = await sync_schemes(session, provider, retire_missing=True)
    # The first import is a backfill, not news — announcing hundreds would be spam.
    announced = await queue_scheme_announcements(session, result.created) if seen_before else 0
    return SyncReport(
        source=provider.name,
        synced=result.synced,
        new=len(result.created),
        retired=result.deactivated,
        announced=announced,
    )
