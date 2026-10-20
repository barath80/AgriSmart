from fastapi import APIRouter, Depends

from app.auth.dependencies import CurrentFarmer, DbSession
from app.core.rate_limit import rate_limit
from app.crop import service
from app.crop.schemas import CropInfo, CropRecommendationRequest, CropRecommendationResponse
from app.farmer.context import load_farmer_context
from app.farmer.models import Channel

router = APIRouter(prefix="/crop", tags=["crop"])


@router.get("/catalog")
async def catalog(_: CurrentFarmer, session: DbSession) -> list[CropInfo]:
    return list((await service.crop_catalog(session)).values())


@router.post("/recommend", dependencies=[Depends(rate_limit("crop_recommend", 20))])
async def recommend(
    body: CropRecommendationRequest, farmer: CurrentFarmer, session: DbSession
) -> CropRecommendationResponse:
    ctx = await load_farmer_context(session, farmer, channel=Channel.APP)
    return await service.recommend(session, ctx, body)
