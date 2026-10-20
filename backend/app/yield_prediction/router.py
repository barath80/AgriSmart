from fastapi import APIRouter, Depends

from app.auth.dependencies import CurrentFarmer, DbSession
from app.core.rate_limit import rate_limit
from app.farmer.context import load_farmer_context
from app.farmer.models import Channel
from app.yield_prediction import service
from app.yield_prediction.schemas import YieldRequest, YieldResponse

router = APIRouter(prefix="/yield", tags=["yield"])


@router.post("/predict", dependencies=[Depends(rate_limit("yield_predict", 20))])
async def predict_yield(
    body: YieldRequest, farmer: CurrentFarmer, session: DbSession
) -> YieldResponse:
    ctx = await load_farmer_context(session, farmer, channel=Channel.APP)
    return await service.predict(session, ctx, body)
