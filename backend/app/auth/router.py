from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request, status

from app.admin.audit import record_audit
from app.auth import service
from app.auth.dependencies import DbSession, get_principal
from app.auth.schemas import (
    AdminLogin,
    FarmerLogin,
    LoginMethods,
    OtpRequest,
    OtpRequested,
    PasswordChange,
    PasswordLogin,
    PasswordRegister,
    PasswordReset,
    RefreshRequest,
    TokenPair,
)
from app.core.config import get_settings
from app.core.rate_limit import rate_limit
from app.core.security import Principal

router = APIRouter(prefix="/auth", tags=["auth"])

UserAgent = Annotated[str | None, Header()]


@router.get("/methods")
async def methods() -> LoginMethods:
    """Which sign-in methods this server offers, so the app only shows ones that work."""
    return LoginMethods(**service.login_methods())


@router.post("/otp", dependencies=[Depends(rate_limit("otp", 10))])
async def request_otp(body: OtpRequest, session: DbSession) -> OtpRequested:
    issued = await service.request_otp(session, body.identifier, body.via)
    settings = get_settings()
    dev_otp = issued.code if settings.environment == "development" or settings.demo_login else None
    return OtpRequested(expires_in=issued.expires_in, dev_otp=dev_otp)


@router.post("/login", dependencies=[Depends(rate_limit("login", 10))])
async def login(body: FarmerLogin, session: DbSession, user_agent: UserAgent = None) -> TokenPair:
    return await service.login_farmer(
        session, body.identifier, body.otp, body.language, user_agent, body.via
    )


@router.post("/admin/login", dependencies=[Depends(rate_limit("admin_login", 5))])
async def admin_login(
    body: AdminLogin, session: DbSession, request: Request, user_agent: UserAgent = None
) -> TokenPair:
    tokens = await service.login_admin(session, body.email, body.password, user_agent)
    record_audit(
        session,
        actor_user_id=None,
        action="admin.login",
        entity="user",
        details={"email": body.email},
        request=request,
    )
    await session.commit()
    return tokens


@router.post("/refresh", dependencies=[Depends(rate_limit("refresh", 30))])
async def refresh(
    body: RefreshRequest, session: DbSession, user_agent: UserAgent = None
) -> TokenPair:
    return await service.refresh(session, body.refresh_token, user_agent)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: RefreshRequest, session: DbSession) -> None:
    await service.logout(session, body.refresh_token)


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("register", 10))],
)
async def register(
    body: PasswordRegister, session: DbSession, user_agent: UserAgent = None
) -> TokenPair:
    """Create a farmer account with a password. No SMS or e-mail service is needed."""
    return await service.register_with_password(
        session, body.identifier, body.via, body.password, body.name, body.language, user_agent
    )


@router.post("/password-login", dependencies=[Depends(rate_limit("password_login", 10))])
async def password_login(
    body: PasswordLogin, session: DbSession, user_agent: UserAgent = None
) -> TokenPair:
    return await service.login_with_password(
        session, body.identifier, body.via, body.password, user_agent
    )


@router.post("/password-reset", dependencies=[Depends(rate_limit("password_reset", 5))])
async def password_reset(
    body: PasswordReset, session: DbSession, user_agent: UserAgent = None
) -> TokenPair:
    """Forgot password. Needs a one-time code from `/auth/otp` (SMS or e-mail must be set up)."""
    return await service.reset_password(
        session, body.identifier, body.via, body.otp, body.new_password, user_agent
    )


@router.put("/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: PasswordChange,
    session: DbSession,
    principal: Annotated[Principal, Depends(get_principal)],
) -> None:
    await service.change_password(
        session, principal.user_id, body.current_password, body.new_password
    )
