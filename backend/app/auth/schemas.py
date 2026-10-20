import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr, Field, model_validator

from app.core.language import Language

_INDIAN_MOBILE = re.compile(r"^[6-9]\d{9}$")


def normalize_indian_mobile(raw: str) -> str:
    """Accept '98765 43210', '+91-9876543210', '09876543210' and return '+919876543210'."""
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if not _INDIAN_MOBILE.match(digits):
        raise ValueError("Enter a valid 10-digit Indian mobile number")
    return f"+91{digits}"


PhoneNumber = Annotated[str, AfterValidator(normalize_indian_mobile)]


class _Identity(BaseModel):
    """A farmer signs in with a phone number (SMS code) or an e-mail address (e-mailed code)."""

    phone: PhoneNumber | None = None
    email: EmailStr | None = None

    @model_validator(mode="after")
    def _exactly_one(self):
        if (self.phone is None) == (self.email is None):
            raise ValueError("Give either a phone number or an e-mail address")
        return self

    @property
    def identifier(self) -> str:
        return self.phone or str(self.email).lower()

    @property
    def via(self) -> str:
        return "sms" if self.phone else "email"


class OtpRequest(_Identity):
    pass


class LoginMethods(BaseModel):
    phone: bool
    email: bool
    password: bool = True


class OtpRequested(BaseModel):
    expires_in: int
    dev_otp: str | None = Field(None, description="Only populated in development")


class FarmerLogin(_Identity):
    otp: str = Field(pattern=r"^\d{6}$")
    language: Language = Language.ENGLISH


Password = Annotated[str, Field(min_length=8, max_length=128)]


class PasswordRegister(_Identity):
    password: Password
    name: str = Field("", max_length=120)
    language: Language = Language.ENGLISH


class PasswordLogin(_Identity):
    password: str = Field(min_length=1, max_length=128)


class PasswordReset(_Identity):
    """Forgot password: prove access with a one-time code, then choose a new password."""

    otp: str = Field(pattern=r"^\d{6}$")
    new_password: Password


class PasswordChange(BaseModel):
    current_password: str | None = Field(None, max_length=128)
    new_password: Password


class AdminLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=200)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    role: str
    is_new_user: bool = False
