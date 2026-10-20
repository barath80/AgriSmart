"""Login flows.

Farmers and admins sign in with a password that is stored only as an Argon2 hash. This needs no
paid service. A one-time code (SMS or e-mail) is an optional extra, used for "forgot password" and
for accounts created before passwords existed. Repeated wrong passwords lock the account briefly.
"""

import logging
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import AuthSession, OtpCode, User
from app.auth.schemas import TokenPair
from app.core.config import get_settings
from app.core.database import utcnow
from app.core.errors import (
    Conflict,
    InvalidInput,
    ServiceUnavailable,
    TooManyRequests,
    Unauthorized,
)
from app.core.language import Language
from app.core.security import (
    Role,
    constant_time_equals,
    create_access_token,
    hash_password,
    hash_token,
    new_otp,
    new_refresh_token,
    verify_password,
)
from app.farmer.models import Channel, Farmer
from app.notification.channels import DeliveryError, get_email_sender, get_sms_sender

# Verified once against a fixed hash so unknown e-mails take as long as wrong passwords.
_DUMMY_PASSWORD_HASH = hash_password("timing-equaliser-not-a-real-password")


logger = logging.getLogger(__name__)


@dataclass(slots=True)
class IssuedOtp:
    code: str
    expires_in: int


def login_methods() -> dict[str, bool]:
    """Which ways a farmer can receive a login code on this deployment."""
    settings = get_settings()
    demo = settings.demo_login or not settings.is_production
    return {
        "phone": settings.sms_provider == "twilio" or demo,
        "email": settings.email_provider == "smtp" or demo,
        "password": True,
    }


async def request_otp(session: AsyncSession, identifier: str, via: str = "sms") -> IssuedOtp:
    settings = get_settings()
    if not login_methods()["phone" if via == "sms" else "email"]:
        raise ServiceUnavailable("This way of signing in is not available", code="sms_unavailable")
    now = utcnow()
    recent = await session.scalar(
        select(func.count())
        .select_from(OtpCode)
        .where(OtpCode.phone == identifier, OtpCode.created_at > now - timedelta(hours=1))
    )
    if (recent or 0) >= settings.otp_max_requests_per_hour:
        raise TooManyRequests("Too many codes requested. Try again later.", code="otp_rate_limited")

    code = new_otp()
    session.add(
        OtpCode(
            phone=identifier,
            code_hash=hash_token(code),
            expires_at=now + timedelta(seconds=settings.otp_ttl_seconds),
        )
    )
    await session.commit()
    try:
        if via == "email":
            await get_email_sender().send(
                identifier,
                "Your AgriSmart login code",
                f"Your AgriSmart code is {code}. It is valid for 5 minutes. Do not share it.",
            )
        else:
            await get_sms_sender().send(
                identifier, f"AgriSmart code: {code}. Valid for 5 minutes. Do not share."
            )
    except DeliveryError as exc:
        logger.warning("otp_delivery_failed", extra={"reason": str(exc), "via": via})
        raise ServiceUnavailable(
            "The login code could not be sent", code="sms_unavailable"
        ) from exc
    return IssuedOtp(code=code, expires_in=settings.otp_ttl_seconds)


async def _consume_otp(session: AsyncSession, phone: str, code: str) -> None:
    settings = get_settings()
    otp = await session.scalar(
        select(OtpCode)
        .where(OtpCode.phone == phone, OtpCode.consumed_at.is_(None), OtpCode.expires_at > utcnow())
        .order_by(OtpCode.created_at.desc())
        .limit(1)
        .with_for_update()
    )
    if otp is None or otp.attempts >= settings.otp_max_attempts:
        raise Unauthorized("Code expired. Request a new one.", code="otp_expired")
    otp.attempts += 1
    if not constant_time_equals(otp.code_hash, hash_token(code)):
        await session.commit()  # persist the failed attempt
        raise Unauthorized("Incorrect code", code="otp_invalid")
    otp.consumed_at = utcnow()


async def login_farmer(
    session: AsyncSession,
    identifier: str,
    code: str,
    language: Language,
    user_agent: str | None,
    via: str = "sms",
) -> TokenPair:
    await _consume_otp(session, identifier, code)
    if via == "email":
        user, is_new = await get_or_create_farmer_user_by_email(session, identifier, language)
    else:
        user, is_new = await get_or_create_farmer_user(session, identifier, language, Channel.APP)
    return await _issue_tokens(session, user, user_agent, is_new_user=is_new)


async def get_or_create_farmer_user_by_email(
    session: AsyncSession, email: str, language: Language
) -> tuple[User, bool]:
    """A farmer who signs in by e-mail has no phone number until they add one (empty string)."""
    user = await session.scalar(select(User).where(User.email == email))
    if user is not None:
        if not user.is_active or user.role is not Role.FARMER:
            raise Unauthorized("Account disabled", code="account_disabled")
        return user, False
    user = User(role=Role.FARMER, email=email)
    session.add(user)
    await session.flush()
    session.add(
        Farmer(user_id=user.id, phone="", preferred_language=language, primary_channel=Channel.APP)
    )
    await session.flush()
    return user, True


async def get_or_create_farmer_user(
    session: AsyncSession, phone: str, language: Language, channel: Channel
) -> tuple[User, bool]:
    """Shared by app login and the phone gateway (caller-ID association)."""
    user = await session.scalar(select(User).where(User.phone == phone))
    if user is not None:
        if not user.is_active or user.role is not Role.FARMER:
            raise Unauthorized("Account disabled", code="account_disabled")
        return user, False
    user = User(role=Role.FARMER, phone=phone)
    session.add(user)
    await session.flush()
    session.add(
        Farmer(user_id=user.id, phone=phone, preferred_language=language, primary_channel=channel)
    )
    await session.flush()
    return user, True


async def login_admin(
    session: AsyncSession, email: str, password: str, user_agent: str | None
) -> TokenPair:
    user = await session.scalar(select(User).where(User.email == email.lower()))
    if user is None or user.role is not Role.ADMIN or not user.password_hash:
        verify_password(_DUMMY_PASSWORD_HASH, password)
        raise Unauthorized("Invalid email or password", code="invalid_credentials")
    _reject_if_locked(user)
    if not verify_password(user.password_hash, password) or not user.is_active:
        await _record_failed_login(session, user)
        raise Unauthorized("Invalid email or password", code="invalid_credentials")
    return await _issue_tokens(session, user, user_agent)


MAX_FAILED_LOGINS = 5
LOCK_MINUTES = 15


def _reject_if_locked(user: User) -> None:
    if user.locked_until and user.locked_until > utcnow():
        raise TooManyRequests(
            "Too many wrong passwords. Try again in a few minutes, or reset your password.",
            code="account_locked",
        )


async def _record_failed_login(session: AsyncSession, user: User) -> None:
    user.failed_logins += 1
    if user.failed_logins >= MAX_FAILED_LOGINS:
        user.locked_until = utcnow() + timedelta(minutes=LOCK_MINUTES)
        user.failed_logins = 0
    await session.commit()  # the failure must survive the 401 that follows


async def _find_farmer_user(session: AsyncSession, identifier: str, via: str) -> User | None:
    column = User.email if via == "email" else User.phone
    user = await session.scalar(select(User).where(column == identifier))
    return user if user is not None and user.role is Role.FARMER else None


async def register_with_password(
    session: AsyncSession,
    identifier: str,
    via: str,
    password: str,
    name: str,
    language: Language,
    user_agent: str | None,
) -> TokenPair:
    """Create a farmer account protected by a password the farmer chooses."""
    column = User.email if via == "email" else User.phone
    if await session.scalar(select(User.id).where(column == identifier)):
        raise Conflict(
            "This number or e-mail is already registered. Sign in instead.", code="account_exists"
        )
    if via == "email":
        user, _ = await get_or_create_farmer_user_by_email(session, identifier, language)
    else:
        user, _ = await get_or_create_farmer_user(session, identifier, language, Channel.APP)
    user.password_hash = hash_password(password)
    farmer = await session.scalar(select(Farmer).where(Farmer.user_id == user.id))
    if farmer is not None and name.strip():
        farmer.name = name.strip()
    return await _issue_tokens(session, user, user_agent, is_new_user=True)


async def login_with_password(
    session: AsyncSession, identifier: str, via: str, password: str, user_agent: str | None
) -> TokenPair:
    user = await _find_farmer_user(session, identifier, via)
    if user is None or not user.password_hash:
        verify_password(_DUMMY_PASSWORD_HASH, password)  # same time as a real check
        raise Unauthorized("Wrong number, e-mail or password", code="invalid_credentials")
    _reject_if_locked(user)
    if not verify_password(user.password_hash, password):
        await _record_failed_login(session, user)
        raise Unauthorized("Wrong number, e-mail or password", code="invalid_credentials")
    if not user.is_active:
        raise Unauthorized("Account disabled", code="account_disabled")
    return await _issue_tokens(session, user, user_agent)


async def reset_password(
    session: AsyncSession,
    identifier: str,
    via: str,
    code: str,
    new_password: str,
    user_agent: str | None,
) -> TokenPair:
    """Forgot password: a valid one-time code proves ownership; every old session is revoked."""
    user = await _find_farmer_user(session, identifier, via)
    await _consume_otp(session, identifier, code)
    if user is None:
        raise Unauthorized("No account found. Register first.", code="invalid_credentials")
    user.password_hash = hash_password(new_password)
    user.failed_logins, user.locked_until = 0, None
    await session.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
    return await _issue_tokens(session, user, user_agent)


async def change_password(
    session: AsyncSession, user_id, current_password: str | None, new_password: str
) -> None:
    """Set a first password (accounts made with a code) or replace the current one."""
    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise Unauthorized("Account disabled", code="account_disabled")
    if user.password_hash and (
        not current_password or not verify_password(user.password_hash, current_password)
    ):
        raise InvalidInput("The current password is wrong", code="wrong_password")
    user.password_hash = hash_password(new_password)
    await session.commit()


async def refresh(session: AsyncSession, refresh_token: str, user_agent: str | None) -> TokenPair:
    """Rotate: the presented token is revoked and a new pair is issued."""
    auth_session = await session.scalar(
        select(AuthSession)
        .where(AuthSession.refresh_token_hash == hash_token(refresh_token))
        .with_for_update()
    )
    if auth_session is None or auth_session.revoked_at or auth_session.expires_at <= utcnow():
        raise Unauthorized("Session expired", code="session_expired")
    auth_session.revoked_at = utcnow()
    user = await session.get(User, auth_session.user_id)
    if user is None or not user.is_active:
        raise Unauthorized("Account disabled", code="account_disabled")
    return await _issue_tokens(session, user, user_agent)


async def logout(session: AsyncSession, refresh_token: str) -> None:
    await session.execute(
        update(AuthSession)
        .where(AuthSession.refresh_token_hash == hash_token(refresh_token))
        .values(revoked_at=utcnow())
    )
    await session.commit()


async def _issue_tokens(
    session: AsyncSession, user: User, user_agent: str | None, *, is_new_user: bool = False
) -> TokenPair:
    settings = get_settings()
    user.failed_logins, user.locked_until, user.last_login_at = 0, None, utcnow()
    refresh_token = new_refresh_token()
    session.add(
        AuthSession(
            user_id=user.id,
            refresh_token_hash=hash_token(refresh_token),
            expires_at=utcnow() + timedelta(days=settings.refresh_token_ttl_days),
            user_agent=(user_agent or "")[:255],
        )
    )
    user.last_login_at = utcnow()
    await session.commit()
    access_token, expires_in = create_access_token(user.id, user.role)
    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        role=user.role.value,
        is_new_user=is_new_user,
    )


async def ensure_bootstrap_admin(session: AsyncSession) -> None:
    """Create the first admin from environment variables, once."""
    settings = get_settings()
    if not (settings.bootstrap_admin_email and settings.bootstrap_admin_password):
        return
    email = settings.bootstrap_admin_email.lower()
    if await session.scalar(select(User.id).where(User.email == email)):
        return
    session.add(
        User(
            role=Role.ADMIN,
            email=email,
            password_hash=hash_password(settings.bootstrap_admin_password.get_secret_value()),
        )
    )
    await session.commit()
