import uuid
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.models import AuditLog


def record_audit(
    session: AsyncSession,
    *,
    actor_user_id: uuid.UUID | None,
    action: str,
    entity: str,
    entity_id: Any = None,
    details: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    """Stage an audit row in the caller's transaction, so it commits atomically with the change."""
    session.add(
        AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            details=details or {},
            ip_address=request.client.host if request and request.client else None,
        )
    )
