"""AgriSmart API — a stateless modular monolith.

Any number of identical instances can run behind a load balancer: no request state lives
in process memory (sessions are JWT + PostgreSQL, caches are PostgreSQL tables, and model
activation is read from the database).
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.admin.router import router as admin_router
from app.assistant.router import router as assistant_router
from app.auth.router import router as auth_router
from app.auth.service import ensure_bootstrap_admin
from app.calendar.router import router as calendar_router
from app.core.config import get_settings
from app.core.database import SessionFactory, engine
from app.core.errors import register_error_handlers
from app.core.http import close_http_client
from app.core.observability import RequestContextMiddleware, configure_logging, metrics
from app.crop.router import router as crop_router
from app.disease.router import router as disease_router
from app.farm.router import router as farm_router
from app.farmer.router import router as farmer_router
from app.market.router import router as market_router
from app.notification.router import router as notification_router
from app.pest.router import router as pest_router
from app.profit.router import router as profit_router
from app.schemes.router import router as schemes_router
from app.support.admin import router as support_admin_router
from app.support.router import router as support_router
from app.voice.outbound import router as clips_router
from app.voice.router import router as voice_router
from app.voice.telephony import router as telephony_router
from app.weather.router import router as weather_router
from app.yield_prediction.router import router as yield_router

settings = get_settings()
configure_logging(settings.log_level)


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with SessionFactory() as session:
        await ensure_bootstrap_admin(session)
    yield
    await close_http_client()
    await engine.dispose()


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                message.setdefault("headers", []).extend(
                    [
                        (b"x-content-type-options", b"nosniff"),
                        (b"x-frame-options", b"DENY"),
                        (b"referrer-policy", b"no-referrer"),
                        (b"strict-transport-security", b"max-age=31536000; includeSubDomains"),
                    ]
                )
            await send(message)

        await self.app(scope, receive, send_wrapper)


app = FastAPI(
    title="AgriSmart API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID"],
)
app.add_middleware(RequestContextMiddleware)
register_error_handlers(app)

api = APIRouter(prefix=settings.api_prefix)
for module_router in (
    auth_router,
    farmer_router,
    farm_router,
    crop_router,
    disease_router,
    pest_router,
    yield_router,
    weather_router,
    market_router,
    schemes_router,
    profit_router,
    calendar_router,
    voice_router,
    telephony_router,
    clips_router,
    notification_router,
    assistant_router,
    support_router,
    support_admin_router,
    admin_router,
):
    api.include_router(module_router)
app.include_router(api)


@app.get("/health", tags=["ops"])
async def health() -> dict[str, str]:
    """Liveness: the process is up. Never touches dependencies."""
    return {"status": "ok"}


@app.get("/ready", tags=["ops"])
async def ready() -> JSONResponse:
    """Readiness: can serve traffic (database reachable). Used by the load balancer."""
    try:
        async with SessionFactory() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse({"status": "unavailable", "database": "down"}, status_code=503)
    return JSONResponse({"status": "ready", "database": "up"})


@app.get("/metrics", include_in_schema=False)
async def prometheus_metrics() -> PlainTextResponse:
    return PlainTextResponse(metrics.render_prometheus())


class SinglePageApp(StaticFiles):
    """Static files with the single-page-app fallback: unknown paths get index.html, so deep
    links such as /support work after a refresh."""

    async def get_response(self, path: str, scope: Scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


# Mounted last, so every API route above wins over the web app's catch-all.
if settings.web_dir and Path(settings.web_dir, "index.html").is_file():
    app.mount("/", SinglePageApp(directory=settings.web_dir, html=True), name="web")
