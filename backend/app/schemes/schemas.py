import uuid
from datetime import date
from typing import Any

from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.schemes.eligibility import SUPPORTED_RULES, Eligibility


class SchemeRuleIn(BaseModel):
    rule_type: str
    value: Any

    @field_validator("rule_type")
    @classmethod
    def _known_rule(cls, value: str) -> str:
        if value not in SUPPORTED_RULES:
            raise ValueError(f"rule_type must be one of {sorted(SUPPORTED_RULES)}")
        return value


class SchemeIn(BaseModel):
    """An admin-entered or provider-normalised scheme; every field comes from an official source."""

    code: str = Field(pattern=r"^[a-z0-9_]{3,64}$")
    name: str = Field(min_length=3, max_length=200)
    names: dict[str, str] = {}
    state: str | None = Field(None, max_length=64)
    district: str | None = Field(None, max_length=64)
    summary: str = Field(min_length=10, max_length=4000)
    benefits: str = Field(min_length=3, max_length=4000)
    eligibility_text: str = Field(min_length=3, max_length=4000)
    application_process: str = Field(min_length=3, max_length=4000)
    official_url: HttpUrl
    source: str = Field("admin", max_length=64)
    last_verified_on: date
    is_active: bool = True
    rules: list[SchemeRuleIn] = []


class SchemeOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    state: str | None
    district: str | None
    summary: str
    benefits: str
    eligibility_text: str
    application_process: str
    official_url: str
    source: str
    last_verified_on: date
    is_active: bool
    translated: bool = True


class SchemeRuleOut(BaseModel):
    rule_type: str
    value: Any


class AdminSchemeOut(SchemeOut):
    rules: list[SchemeRuleOut]


class EligibilityOut(BaseModel):
    scheme: SchemeOut
    status: Eligibility
    missing_facts: list[str]
