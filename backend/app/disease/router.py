from typing import Annotated

from fastapi import APIRouter, Depends, File, Header, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentFarmer, DbSession
from app.core.config import get_settings
from app.core.rate_limit import rate_limit
from app.core.uploads import read_limited
from app.disease import service
from app.disease.schemas import DiagnosisKind, DiagnosisResponse
from app.farmer.models import Farmer

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
IdempotencyKey = Annotated[str | None, Header(alias="Idempotency-Key", max_length=64)]

router = APIRouter(prefix="/disease", tags=["disease"])


async def diagnose_upload(
    kind: DiagnosisKind,
    image: UploadFile,
    farmer: Farmer,
    session: AsyncSession,
    idempotency_key: str | None,
) -> DiagnosisResponse:
    data = await read_limited(image, get_settings().upload_max_bytes, IMAGE_TYPES)
    return await service.diagnose(
        session,
        kind=kind,
        image=data,
        farmer_id=farmer.id,
        language=farmer.preferred_language,
        request_id=idempotency_key,
    )


@router.post("/predict", dependencies=[Depends(rate_limit("diagnosis", 10))])
async def predict_disease(
    farmer: CurrentFarmer,
    session: DbSession,
    image: Annotated[UploadFile, File(description="Photo of the affected leaf")],
    idempotency_key: IdempotencyKey = None,
) -> DiagnosisResponse:
    return await diagnose_upload(DiagnosisKind.DISEASE, image, farmer, session, idempotency_key)
