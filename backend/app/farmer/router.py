from fastapi import APIRouter, status

from app.auth.dependencies import CurrentFarmer, DbSession
from app.farmer import service
from app.farmer.schemas import FarmerProfile, FarmerProfileUpdate, PushTokenUpdate

router = APIRouter(prefix="/farmer", tags=["farmer"])


@router.get("/profile")
async def get_profile(farmer: CurrentFarmer) -> FarmerProfile:
    return service.to_profile(farmer)


@router.put("/profile")
async def update_profile(
    body: FarmerProfileUpdate, farmer: CurrentFarmer, session: DbSession
) -> FarmerProfile:
    farmer = await service.update_profile(session, farmer, body)
    return service.to_profile(farmer)


@router.put("/push-token", status_code=status.HTTP_204_NO_CONTENT)
async def update_push_token(
    body: PushTokenUpdate, farmer: CurrentFarmer, session: DbSession
) -> None:
    farmer.push_token = body.push_token
    await session.commit()
