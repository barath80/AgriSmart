"""Authentication and role checks. Every protected route goes through one of these."""

from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.errors import Forbidden, NotFound, Unauthorized
from app.core.security import Principal, Role, decode_access_token
from app.farmer.models import Farmer

_bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[AsyncSession, Depends(get_session)]


async def get_principal(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Principal:
    if credentials is None:
        raise Unauthorized("Authentication required")
    principal = decode_access_token(credentials.credentials)
    request.state.principal = principal  # used by the rate limiter key
    return principal


def require_role(role: Role):
    async def dependency(principal: Annotated[Principal, Depends(get_principal)]) -> Principal:
        if principal.role is not role:
            raise Forbidden("You do not have access to this resource")
        return principal

    return dependency


require_admin = require_role(Role.ADMIN)
require_farmer = require_role(Role.FARMER)

AdminPrincipal = Annotated[Principal, Depends(require_admin)]


async def get_current_farmer(
    session: DbSession, principal: Annotated[Principal, Depends(require_farmer)]
) -> Farmer:
    farmer = await session.scalar(select(Farmer).where(Farmer.user_id == principal.user_id))
    if farmer is None:
        raise NotFound("Farmer profile not found", code="farmer_not_found")
    return farmer


CurrentFarmer = Annotated[Farmer, Depends(get_current_farmer)]
