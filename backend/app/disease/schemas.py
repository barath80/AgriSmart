from enum import StrEnum

from pydantic import BaseModel


class DiagnosisKind(StrEnum):
    DISEASE = "disease"
    PEST = "pest"


class Candidate(BaseModel):
    label: str
    name: str
    confidence: float


class KnowledgeSection(BaseModel):
    """`key` is a stable heading id (cause, symptoms, treatment, ...) localised by clients."""

    key: str
    items: list[str]


class DiagnosisResponse(BaseModel):
    request_id: str
    kind: DiagnosisKind
    model_version: str
    accepted: bool  # False: confidence too low — ask for a clearer photo instead of guessing
    label: str
    name: str
    confidence: float
    is_healthy: bool
    candidates: list[Candidate]
    sections: list[KnowledgeSection]
    summary: str  # short, speakable, in the farmer's language
    expert_verified: bool
    translated: bool
