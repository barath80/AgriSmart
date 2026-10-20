import logging
import re
import uuid
from dataclasses import dataclass

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict, NotFound
from app.core.language import Language
from app.farmer.context import FarmerContext
from app.language.service import translate_texts
from app.schemes.eligibility import Eligibility, FarmerFacts, evaluate
from app.schemes.models import GovernmentScheme, SchemeRule
from app.schemes.providers import GovernmentSchemeProvider
from app.schemes.schemas import AdminSchemeOut, EligibilityOut, SchemeIn, SchemeOut, SchemeRuleOut

logger = logging.getLogger(__name__)

_TRANSLATED_FIELDS = ("summary", "benefits", "eligibility_text", "application_process")


async def list_applicable(
    session: AsyncSession, state: str | None, district: str | None
) -> list[GovernmentScheme]:
    """Active central schemes plus those of the farmer's state/district."""
    query = select(GovernmentScheme).where(GovernmentScheme.is_active.is_(True))
    if state:
        query = query.where(or_(GovernmentScheme.state.is_(None), GovernmentScheme.state == state))
        query = query.where(
            or_(GovernmentScheme.district.is_(None), GovernmentScheme.district == district)
        )
    else:
        query = query.where(GovernmentScheme.state.is_(None))
    return list(
        await session.scalars(
            query.order_by(GovernmentScheme.state.is_not(None), GovernmentScheme.name)
        )
    )


async def to_out(
    session: AsyncSession, schemes: list[GovernmentScheme], language: Language
) -> list[SchemeOut]:
    # A reviewed name in the farmer's language wins; otherwise the name is translated too.
    texts = [
        text
        for s in schemes
        for text in (s.name, *(getattr(s, f) for f in _TRANSLATED_FIELDS))
    ]
    translated, complete = await translate_texts(session, texts, language)
    per_scheme = 1 + len(_TRANSLATED_FIELDS)
    out = []
    for index, s in enumerate(schemes):
        name, *fields = translated[index * per_scheme : (index + 1) * per_scheme]
        out.append(
            SchemeOut(
                id=s.id,
                code=s.code,
                name=(s.names or {}).get(language.value) or name,
                state=s.state,
                district=s.district,
                **dict(zip(_TRANSLATED_FIELDS, fields, strict=True)),
                official_url=s.official_url,
                source=s.source,
                last_verified_on=s.last_verified_on,
                is_active=s.is_active,
                translated=complete,
            )
        )
    return out


def facts_for(ctx: FarmerContext) -> FarmerFacts:
    crops = {c.crop.slug for c in ctx.active_cycles}
    return FarmerFacts(
        state=ctx.location.state if ctx.location else None,
        district=ctx.location.district if ctx.location else None,
        land_acres=ctx.total_land_acres,
        age=ctx.age,
        crops=frozenset(crops),
        irrigated=any(f.irrigation.is_irrigated for f in ctx.farms) if ctx.farms else None,
    )


async def eligible_schemes(session: AsyncSession, ctx: FarmerContext) -> list[EligibilityOut]:
    facts = facts_for(ctx)
    schemes = await list_applicable(session, facts.state, facts.district)
    evaluations = [
        evaluate([(r.rule_type, r.value.get("value")) for r in s.rules], facts) for s in schemes
    ]
    keep = [
        (s, e)
        for s, e in zip(schemes, evaluations, strict=True)
        if e.status is not Eligibility.NOT_ELIGIBLE
    ]
    outs = await to_out(session, [s for s, _ in keep], ctx.language)
    result = [
        EligibilityOut(scheme=out, status=e.status, missing_facts=e.missing_facts)
        for out, (_, e) in zip(outs, keep, strict=True)
    ]
    result.sort(key=lambda r: r.status is not Eligibility.ELIGIBLE)
    return result


# --- Administration ----------------------------------------------------------------------


def _apply(scheme: GovernmentScheme, data: SchemeIn, *, keep_rules: bool = False) -> None:
    for key, value in data.model_dump(exclude={"rules"}).items():
        setattr(scheme, key, str(value) if key == "official_url" else value)
    if not (keep_rules and not data.rules):
        scheme.rules = [
            SchemeRule(rule_type=r.rule_type, value={"value": r.value}) for r in data.rules
        ]


async def create_scheme(session: AsyncSession, data: SchemeIn) -> GovernmentScheme:
    if await session.scalar(select(GovernmentScheme.id).where(GovernmentScheme.code == data.code)):
        raise Conflict(f"Scheme '{data.code}' already exists", code="scheme_exists")
    scheme = GovernmentScheme()
    _apply(scheme, data)
    session.add(scheme)
    await session.flush()
    return scheme


async def update_scheme(
    session: AsyncSession, scheme_id: uuid.UUID, data: SchemeIn
) -> GovernmentScheme:
    scheme = await session.get(GovernmentScheme, scheme_id)
    if scheme is None:
        raise NotFound("Scheme not found", code="scheme_not_found")
    _apply(scheme, data)
    await session.flush()
    return scheme


async def sync_from_provider(session: AsyncSession, provider: GovernmentSchemeProvider) -> int:
    """Upsert every scheme a provider returns, matched on `code`."""
    result = await sync_schemes(session, provider)
    return result.synced


@dataclass(frozen=True, slots=True)
class SyncResult:
    synced: int
    created: list[GovernmentScheme]
    deactivated: int


async def sync_schemes(
    session: AsyncSession, provider: GovernmentSchemeProvider, *, retire_missing: bool = False
) -> SyncResult:
    """Upsert a provider's schemes. Rules an administrator added to a provider record are
    kept when the provider sends none. With `retire_missing`, records from this source that
    the provider no longer lists are deactivated (never deleted)."""
    incoming = await _without_duplicates(session, provider.name, await provider.fetch())
    existing = {
        s.code: s
        for s in await session.scalars(
            select(GovernmentScheme).where(GovernmentScheme.code.in_([d.code for d in incoming]))
        )
    }
    created: list[GovernmentScheme] = []
    for data in incoming:
        scheme = existing.get(data.code)
        if scheme is None:
            scheme = GovernmentScheme()
            _apply(scheme, data)
            session.add(scheme)
            created.append(scheme)
        else:
            _apply(scheme, data, keep_rules=True)
    deactivated = 0
    if retire_missing and incoming:
        stale = await session.scalars(
            select(GovernmentScheme).where(
                GovernmentScheme.source == provider.name,
                GovernmentScheme.is_active.is_(True),
                GovernmentScheme.code.not_in([d.code for d in incoming]),
            )
        )
        for scheme in stale:
            scheme.is_active = False
            deactivated += 1
    await session.commit()
    return SyncResult(synced=len(incoming), created=created, deactivated=deactivated)


def _name_key(name: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", name.lower()))


def _same_scheme(a: str, b: str) -> bool:
    shorter, longer = sorted((a, b), key=len)
    # Containment only for full names; short acronyms must match exactly to count.
    return a == b or (len(shorter) >= 15 and f" {shorter} " in f" {longer} ")


async def _without_duplicates(
    session: AsyncSession, source: str, incoming: list[SchemeIn]
) -> list[SchemeIn]:
    """Drop provider records that repeat a scheme already curated from another source —
    e.g. myScheme's "Pradhan Mantri Kisan Samman Nidhi" vs the verified "PM-KISAN (...)".
    The curated record wins because it carries machine-checkable eligibility rules."""
    # A record with the same code is the same scheme being updated, never a duplicate.
    others = await session.scalars(
        select(GovernmentScheme.name).where(
            GovernmentScheme.source != source,
            GovernmentScheme.is_active.is_(True),
            GovernmentScheme.code.not_in([d.code for d in incoming]),
        )
    )
    known = [k for k in map(_name_key, others) if k]
    kept = []
    for data in incoming:
        key = _name_key(data.name)
        if any(_same_scheme(key, k) for k in known):
            logger.info("scheme_duplicate_skipped", extra={"code": data.code})
            continue
        kept.append(data)
    return kept


def to_admin_out(scheme: GovernmentScheme) -> AdminSchemeOut:
    return AdminSchemeOut(
        id=scheme.id,
        code=scheme.code,
        name=scheme.name,
        state=scheme.state,
        district=scheme.district,
        summary=scheme.summary,
        benefits=scheme.benefits,
        eligibility_text=scheme.eligibility_text,
        application_process=scheme.application_process,
        official_url=scheme.official_url,
        source=scheme.source,
        last_verified_on=scheme.last_verified_on,
        is_active=scheme.is_active,
        rules=[
            SchemeRuleOut(rule_type=r.rule_type, value=r.value.get("value")) for r in scheme.rules
        ],
    )
