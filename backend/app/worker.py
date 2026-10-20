"""Background worker: notification delivery and scheduled alerts.

Run as its own process (`python -m app.worker`), separate from the API, so slow
outbound calls never consume API capacity. Several workers can run at once: deliveries
are claimed with SELECT ... FOR UPDATE SKIP LOCKED and alerts are idempotent.
"""

import asyncio
import contextlib
import logging
import signal
import time
from dataclasses import asdict

from app.core.config import get_settings
from app.core.database import SessionFactory, engine
from app.core.http import close_http_client
from app.core.observability import configure_logging
from app.language.warmup import warm_translations
from app.market.service import refresh_grown_prices
from app.notification.service import (
    dispatch_pending,
    queue_calendar_reminders,
    queue_disease_outbreak_alerts,
    queue_market_alerts,
    queue_weather_alerts,
)
from app.schemes.sync import sync_live_schemes
from app.voice.outbound import purge_expired_clips

logger = logging.getLogger("agrismart.worker")

DISPATCH_IDLE_SECONDS = 5
SCHEDULE_EVERY_SECONDS = 6 * 3600


async def _run_scheduled() -> None:
    async with SessionFactory() as session:
        reminders = await queue_calendar_reminders(session)
        alerts = await queue_weather_alerts(session)
        market = await queue_market_alerts(session)
        outbreaks = await queue_disease_outbreak_alerts(session)
        await purge_expired_clips(session)
    logger.info(
        "scheduled_notifications_queued",
        extra={"calendar": reminders, "weather": alerts, "market": market, "disease": outbreaks},
    )


async def _refresh_prices() -> None:
    async with SessionFactory() as session:
        refreshed = await refresh_grown_prices(session)
    logger.info("prices_refreshed", extra={"pairs": refreshed})


async def _sync_schemes() -> None:
    async with SessionFactory() as session:
        report = await sync_live_schemes(session)
    if report:
        logger.info("schemes_synced", extra=asdict(report))
    if report or get_settings().voice_provider != "none":
        async with SessionFactory() as session:
            await warm_translations(session, scope="schemes")


async def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        with contextlib.suppress(NotImplementedError):  # Windows: rely on KeyboardInterrupt
            loop.add_signal_handler(sig, stop.set)

    last_schedule = 0.0
    last_scheme_sync = 0.0
    last_price_refresh = 0.0
    logger.info("worker_started")
    while not stop.is_set():
        try:
            if time.monotonic() - last_price_refresh > settings.market_cache_ttl_minutes * 60:
                last_price_refresh = time.monotonic()
                await _refresh_prices()
            if time.monotonic() - last_schedule > SCHEDULE_EVERY_SECONDS:
                await _run_scheduled()
                last_schedule = time.monotonic()
            if time.monotonic() - last_scheme_sync > settings.scheme_sync_hours * 3600:
                last_scheme_sync = time.monotonic()  # a failed sync waits for the next window
                await _sync_schemes()
            async with SessionFactory() as session:
                sent = await dispatch_pending(session, settings.notification_batch_size)
        except Exception:
            logger.exception("worker_iteration_failed")
            sent = 0
        if not sent:
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(stop.wait(), timeout=DISPATCH_IDLE_SECONDS)
    await close_http_client()
    await engine.dispose()
    logger.info("worker_stopped")


if __name__ == "__main__":
    asyncio.run(main())
