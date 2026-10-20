from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile

from app.auth.dependencies import CurrentFarmer, DbSession
from app.core.rate_limit import rate_limit
from app.disease.router import IdempotencyKey, diagnose_upload
from app.disease.schemas import DiagnosisKind, DiagnosisResponse

router = APIRouter(prefix="/pest", tags=["pest"])


@router.post("/predict", dependencies=[Depends(rate_limit("diagnosis", 10))])
async def predict_pest(
    farmer: CurrentFarmer,
    session: DbSession,
    image: Annotated[UploadFile, File(description="Photo of the insect or pest")],
    idempotency_key: IdempotencyKey = None,
) -> DiagnosisResponse:
    return await diagnose_upload(DiagnosisKind.PEST, image, farmer, session, idempotency_key)
