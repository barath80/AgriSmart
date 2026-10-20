from fastapi import APIRouter

from app.auth.dependencies import CurrentFarmer, DbSession
from app.farmer.context import load_farmer_context
from app.farmer.models import Channel
from app.schemes import service
from app.schemes.schemas import EligibilityOut, SchemeOut

router = APIRouter(prefix="/schemes", tags=["schemes"])


@router.get("")
async def list_schemes(farmer: CurrentFarmer, session: DbSession) -> list[SchemeOut]:
    location = farmer.location
    schemes = await service.list_applicable(
        session, location.state if location else None, location.district if location else None
    )
    return await service.to_out(session, schemes, farmer.preferred_language)


@router.get("/eligible")
async def eligible(farmer: CurrentFarmer, session: DbSession) -> list[EligibilityOut]:
    ctx = await load_farmer_context(session, farmer, channel=Channel.APP)
    return await service.eligible_schemes(session, ctx)
