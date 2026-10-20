"""Image diagnosis for diseases and pests.

    image → validate → resize → classifier (what is it?)
          → knowledge base (why, what to do?) → farmer's language → summary

The classifier never writes advice; advice comes only from reviewed knowledge rows.
"""

import hashlib
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.concurrency import run_cpu_bound
from app.core.config import get_settings
from app.core.errors import Conflict, ServiceUnavailable
from app.core.language import Language, localized
from app.core.observability import Timer, metrics
from app.disease.models import DiagnosisPrediction, Disease
from app.disease.schemas import Candidate, DiagnosisKind, DiagnosisResponse, KnowledgeSection
from app.language.service import translate_texts
from app.language.templates import render
from app.ml.registry import ModelName, registry
from app.pest.models import Pest

_DISEASE_SECTIONS = (
    "cause",
    "symptoms",
    "favorable_conditions",
    "treatment",
    "prevention",
    "fertilizer_guidance",
    "safety_warnings",
)
_PEST_SECTIONS = ("description", "damage", "control_measures", "prevention", "safety_warnings")


@dataclass(slots=True)
class _Knowledge:
    names: dict[str, str]
    is_healthy: bool  # for pests: beneficial / harmless
    verified: bool
    sections: list[KnowledgeSection]


async def _knowledge(
    session: AsyncSession, kind: DiagnosisKind, labels: list[str]
) -> dict[str, _Knowledge]:
    model, keys = (
        (Disease, _DISEASE_SECTIONS) if kind is DiagnosisKind.DISEASE else (Pest, _PEST_SECTIONS)
    )
    rows = await session.scalars(select(model).where(model.slug.in_(labels)))
    result = {}
    for row in rows:
        sections = []
        for key in keys:
            value = getattr(row, key)
            items = [value] if isinstance(value, str) else list(value)
            if items := [i for i in items if i]:
                sections.append(KnowledgeSection(key=key, items=items))
        healthy = row.is_healthy if isinstance(row, Disease) else row.is_beneficial
        result[row.slug] = _Knowledge(row.names, healthy, row.verified_at is not None, sections)
    return result


async def _localize_sections(
    session: AsyncSession, sections: list[KnowledgeSection], language: Language
) -> tuple[list[KnowledgeSection], bool]:
    flat = [item for section in sections for item in section.items]
    translated, complete = await translate_texts(session, flat, language)
    iterator = iter(translated)
    return [
        KnowledgeSection(key=s.key, items=[next(iterator) for _ in s.items]) for s in sections
    ], complete


async def _localized_names(
    session: AsyncSession, entries: list[_Knowledge | None], language: Language
) -> list[str]:
    """Curated names in the farmer's language; machine translation only where none exist."""
    names = [localized(e.names, language) if e else "" for e in entries]
    missing = [i for i, e in enumerate(entries) if e and language.value not in e.names and names[i]]
    if missing:
        translated, _ = await translate_texts(session, [names[i] for i in missing], language)
        for i, text in zip(missing, translated, strict=True):
            names[i] = text
    return names


def _summary(
    kind: DiagnosisKind,
    accepted: bool,
    name: str,
    confidence: float,
    healthy: bool,
    sections: list[KnowledgeSection],
    verified: bool,
    language: Language,
) -> str:
    if not accepted:
        return render("disease.uncertain", language)
    percent = round(confidence * 100)
    if healthy:
        key = "disease.healthy" if kind is DiagnosisKind.DISEASE else "pest.beneficial"
        return render(key, language, name=name, confidence=percent)
    action_key = "treatment" if kind is DiagnosisKind.DISEASE else "control_measures"
    first_action = next((s.items[0] for s in sections if s.key == action_key and s.items), "")
    text = render(
        f"{kind.value}.result", language, name=name, confidence=percent, action=first_action
    )
    if not verified:
        text = f"{text} {render('disease.unverified_note', language)}"
    return text


async def _not_a_subject(image: bytes) -> bool:
    try:
        _, gate = await registry.image_classifier(ModelName.SUBJECT)
    except ServiceUnavailable:
        return False  # the gate is optional; older deployments run without it
    predictions = await run_cpu_bound(gate.predict, image, top_k=2)
    subject = next((p.probability for p in predictions if p.label == "subject"), 1.0)
    return subject < gate.metadata.get("min_confidence", 0.5)


async def diagnose(
    session: AsyncSession,
    *,
    kind: DiagnosisKind,
    image: bytes,
    farmer_id: uuid.UUID | None,
    language: Language,
    request_id: str | None,
) -> DiagnosisResponse:
    request_id = request_id or uuid.uuid4().hex
    existing = await session.scalar(
        select(DiagnosisPrediction).where(DiagnosisPrediction.request_id == request_id)
    )
    if existing is not None:
        # Idempotent retry (e.g. flaky mobile network): replay, don't re-run the model.
        if existing.farmer_id != farmer_id or existing.kind != kind.value:
            raise Conflict("Idempotency key already used", code="idempotency_key_reused")
        return await _build_response(session, existing, language)

    model_name = ModelName.DISEASE if kind is DiagnosisKind.DISEASE else ModelName.PEST
    version, classifier = await registry.image_classifier(model_name)
    with Timer() as timer:
        predictions = await run_cpu_bound(classifier.predict, image, top_k=3)
    metrics.observe_ms("model_inference", kind.value, timer.ms)

    best = predictions[0]
    # Two guards against photos the classifier was never meant to see. The subject gate (when
    # a version is registered) rejects photos that are not a leaf or pest at all; and a
    # disease photo that the pest model recognises more confidently (or the reverse) is the
    # wrong kind of subject: on the test sets this cuts cross-model false accepts from 33% to 2%
    # for ~8% of real leaves asked to be retaken.
    not_a_subject = await _not_a_subject(image)
    other = ModelName.PEST if kind is DiagnosisKind.DISEASE else ModelName.DISEASE
    try:
        _, other_classifier = await registry.image_classifier(other)
        other_best = (await run_cpu_bound(other_classifier.predict, image, top_k=1))[0]
        looks_like_other = other_best.probability > best.probability
    except ServiceUnavailable:
        looks_like_other = False
    looks_like_other = looks_like_other or not_a_subject
    record = DiagnosisPrediction(
        request_id=request_id,
        farmer_id=farmer_id,
        kind=kind.value,
        model_version=version,
        predicted_label=best.label,
        confidence=best.probability,
        top_k=[{"label": p.label, "confidence": round(p.probability, 4)} for p in predictions],
        # The training notebook calibrates a per-model threshold; settings is the fallback.
        accepted=not looks_like_other
        and best.probability
        >= classifier.metadata.get("min_confidence", get_settings().image_min_confidence),
        image_sha256=hashlib.sha256(image).hexdigest(),
        latency_ms=timer.ms,
    )
    session.add(record)
    await session.commit()
    metrics.inc("diagnoses", f"{kind.value}:{'accepted' if record.accepted else 'uncertain'}")
    return await _build_response(session, record, language)


async def _build_response(
    session: AsyncSession, record: DiagnosisPrediction, language: Language
) -> DiagnosisResponse:
    kind = DiagnosisKind(record.kind)
    labels = [c["label"] for c in record.top_k]
    knowledge = await _knowledge(session, kind, labels)
    best = knowledge.get(record.predicted_label)
    if best is None:
        raise ServiceUnavailable(
            f"No knowledge entry for label '{record.predicted_label}'", code="knowledge_missing"
        )

    sections, translated = ([], True)
    if record.accepted:
        sections, translated = await _localize_sections(session, best.sections, language)
    names = await _localized_names(
        session, [knowledge.get(c["label"]) for c in record.top_k], language
    )
    name = names[0]
    candidates = [
        Candidate(label=c["label"], name=n or c["label"], confidence=c["confidence"])
        for c, n in zip(record.top_k, names, strict=True)
    ]
    return DiagnosisResponse(
        request_id=record.request_id,
        kind=kind,
        model_version=record.model_version,
        accepted=record.accepted,
        label=record.predicted_label,
        name=name,
        confidence=round(record.confidence, 4),
        is_healthy=best.is_healthy,
        candidates=candidates,
        sections=sections,
        summary=_summary(
            kind,
            record.accepted,
            name,
            record.confidence,
            best.is_healthy,
            sections,
            best.verified,
            language,
        ),
        expert_verified=best.verified,
        translated=translated,
    )
