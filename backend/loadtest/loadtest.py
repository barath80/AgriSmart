"""AgriSmart load test — closed-loop virtual farmers against a running API.

    # 1. start the API to test (several workers, generous app-level rate limits):
    #    RATE_LIMIT_PER_MINUTE=100000 ASSISTANT_RATE_LIMIT_PER_MINUTE=100000 LOG_LEVEL=WARNING \
    #      uvicorn app.main:app --port 8001 --workers 4
    # 2. run (same DATABASE_URL as the server):
    python -m loadtest.loadtest --url http://127.0.0.1:8001 --users 100 500 1000 --duration 60
    # behind nginx:  --url http://127.0.0.1:8080 --server-ports 8080 8001 8002 8003

Each virtual user is a real farmer row (location, farm, soil test, crop) created through the
app's own service layer and authenticated with a real JWT, then repeats a weighted mix of
the requests farmers actually make, with a short think time. Measured per level:
throughput, latency percentiles, error rate, per-endpoint p95 and server CPU.
"""

import argparse
import asyncio
import contextlib
import random
import statistics
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date

import httpx
from sqlalchemy import select

from app.auth.service import get_or_create_farmer_user
from app.core.database import SessionFactory, engine
from app.core.language import Language
from app.core.security import Role, create_access_token
from app.farm.models import Farm, Irrigation, SoilRecord, SoilType
from app.farmer.models import Channel, Farmer
from app.farmer.schemas import LocationIn
from app.farmer.service import get_or_create_location
from app.market.providers import PriceObservation
from app.market.service import import_prices

# A handful of villages: farmers in one village share cached weather, as in reality.
VILLAGES = [
    ("Tamil Nadu", "Thanjavur", 10.78, 79.13, Language.TAMIL),
    ("Karnataka", "Kolar", 13.14, 78.13, Language.KANNADA),
    ("Maharashtra", "Nashik", 20.0, 73.79, Language.MARATHI),
    ("Telangana", "Warangal", 17.97, 79.59, Language.TELUGU),
    ("Uttar Pradesh", "Meerut", 28.98, 77.71, Language.HINDI),
]
QUESTIONS = {
    Language.TAMIL: ["நாளை மழை வருமா?", "தக்காளி விலை என்ன?", "அரசு திட்டங்கள் என்ன?"],
    Language.KANNADA: ["ನಾಳೆ ಮಳೆ ಬರುತ್ತದೆಯೇ?", "ಟೊಮೆಟೊ ಬೆಲೆ ಎಷ್ಟು?", "ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು ಯಾವುವು?"],
    Language.MARATHI: ["उद्या पाऊस पडेल का?", "टोमॅटो भाव काय आहे?", "सरकारी योजना कोणत्या?"],
    Language.TELUGU: ["రేపు వర్షం పడుతుందా?", "టమాటా ధర ఎంత?", "ప్రభుత్వ పథకాలు ఏమిటి?"],
    Language.HINDI: ["क्या कल बारिश होगी?", "टमाटर का भाव क्या है?", "सरकारी योजनाएं बताओ"],
}


@dataclass
class VirtualFarmer:
    token: str
    language: Language


@dataclass
class Results:
    latencies: dict[str, list[float]] = field(default_factory=lambda: defaultdict(list))
    errors: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    statuses: dict[int, int] = field(default_factory=lambda: defaultdict(int))


def require_scratch_database() -> None:
    """The test writes thousands of synthetic farmers, chats and mandi prices straight into
    the database. Refuse to run against anything that does not look disposable, so fake data
    can never end up in the database real farmers use."""
    from sqlalchemy.engine import make_url

    from app.core.config import get_settings

    name = (make_url(get_settings().database_url).database or "").lower()
    if not any(marker in name for marker in ("loadtest", "scratch", "_test")):
        raise SystemExit(
            f"Refusing to load-test database '{name}': it would be filled with synthetic data.\n"
            "Create a scratch database (e.g. agrismart_loadtest), run `alembic upgrade head` and "
            "`python -m app.cli seed` against it, and point DATABASE_URL there."
        )


async def create_farmers(count: int) -> list[VirtualFarmer]:
    require_scratch_database()
    farmers = []
    async with SessionFactory() as session:
        for i in range(count):
            state, district, lat, lon, language = VILLAGES[i % len(VILLAGES)]
            user, is_new = await get_or_create_farmer_user(
                session, f"+917{i:09d}", language, Channel.APP
            )
            if is_new:  # re-runs reuse the farmers created last time
                farmer = await session.scalar(select(Farmer).where(Farmer.user_id == user.id))
                location = await get_or_create_location(
                    session, LocationIn(state=state, district=district, latitude=lat, longitude=lon)
                )
                farmer.name, farmer.location_id, farmer.birth_year = (
                    f"Load test {i}",
                    location.id,
                    1985,
                )
                farm = Farm(
                    farmer_id=farmer.id,
                    area_acres=2.5,
                    location_id=location.id,
                    soil_type=SoilType.BLACK,
                    irrigation=Irrigation.BOREWELL,
                )
                session.add(farm)
                await session.flush()
                session.add(
                    SoilRecord(
                        farm_id=farm.id,
                        nitrogen=90,
                        phosphorus=42,
                        potassium=43,
                        ph=6.5,
                        tested_on=date.today(),
                    )
                )
            token, _ = create_access_token(user.id, Role.FARMER)
            farmers.append(VirtualFarmer(token=token, language=language))
            if i % 200 == 199:
                await session.commit()
        await session.commit()
        today = date.today()
        await import_prices(
            session,
            [
                PriceObservation(
                    state=s,
                    district=d,
                    market=f"{d} APMC",
                    commodity="Tomato",
                    variety="Local",
                    grade="FAQ",
                    arrival_date=today,
                    min_price=1200,
                    max_price=1800,
                    modal_price=1500,
                )
                for s, d, *_ in VILLAGES
            ],
            "loadtest",
        )
    return farmers


def pick_request(farmer: VirtualFarmer) -> tuple[str, str, str, dict]:
    """(label, method, path, kwargs) — weights mirror expected farmer usage."""
    roll = random.random()
    if roll < 0.35:
        text = random.choice(QUESTIONS[farmer.language])
        return "assistant", "POST", "/api/v1/assistant/query", {"json": {"text": text}}
    if roll < 0.60:
        return "weather", "GET", "/api/v1/weather", {}
    if roll < 0.75:
        return "market", "GET", "/api/v1/market/prices", {"params": {"commodity": "Tomato"}}
    if roll < 0.85:
        return "schemes", "GET", "/api/v1/schemes/eligible", {}
    if roll < 0.95:
        return "crop_recommend", "POST", "/api/v1/crop/recommend", {"json": {}}
    return "profile", "GET", "/api/v1/farmer/profile", {}


async def virtual_user(
    client: httpx.AsyncClient, farmer: VirtualFarmer, stop_at: float, results: Results, think: float
) -> None:
    headers = {"Authorization": f"Bearer {farmer.token}"}
    await asyncio.sleep(random.random() * think)  # stagger the start
    while time.monotonic() < stop_at:
        label, method, path, kwargs = pick_request(farmer)
        start = time.perf_counter()
        try:
            response = await client.request(method, path, headers=headers, **kwargs)
            results.statuses[response.status_code] += 1
            if response.status_code >= 400:
                results.errors[label] += 1
        except httpx.HTTPError:
            results.statuses[0] += 1
            results.errors[label] += 1
        results.latencies[label].append((time.perf_counter() - start) * 1000)
        await asyncio.sleep(think * random.uniform(0.5, 1.5))


def server_cpu_sampler(ports: list[int]):
    """Total CPU % of the server processes listening on `ports` (and their workers) —
    the load balancer and every API instance behind it."""
    import psutil

    roots = {
        c.pid
        for c in psutil.net_connections("tcp")
        if c.laddr and c.laddr.port in ports and c.status == "LISTEN" and c.pid
    }
    procs = set()
    for pid in roots:
        try:
            process = psutil.Process(pid)
            parent = process.parent()
            family = [process, *process.children(recursive=True)]
            if parent and "uvicorn" in " ".join(parent.cmdline()):
                family += [parent, *parent.children(recursive=True)]
            procs.update(family)
        except psutil.Error:
            continue
    procs = list(procs)
    for p in procs:
        p.cpu_percent(None)

    def sample() -> float:
        total = 0.0
        for p in procs:
            with contextlib.suppress(psutil.Error):
                total += p.cpu_percent(None)
        return total / psutil.cpu_count()  # % of the whole machine

    return sample


def pct(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(round(q / 100 * (len(ordered) - 1))))]


async def run_level(
    url: str,
    farmers: list[VirtualFarmer],
    users: int,
    duration: float,
    think: float,
    ports: list[int],
) -> dict:
    results = Results()
    limits = httpx.Limits(max_connections=users, max_keepalive_connections=users)
    sample_cpu = server_cpu_sampler(ports)
    async with httpx.AsyncClient(base_url=url, limits=limits, timeout=30) as client:
        stop_at = time.monotonic() + duration
        started = time.perf_counter()
        cpu_samples: list[float] = []

        async def watch_cpu() -> None:
            while time.monotonic() < stop_at:
                await asyncio.sleep(2)
                cpu_samples.append(sample_cpu())

        await asyncio.gather(
            watch_cpu(),
            *(
                virtual_user(client, farmers[i % len(farmers)], stop_at, results, think)
                for i in range(users)
            ),
        )
        elapsed = time.perf_counter() - started

    everything = [v for values in results.latencies.values() for v in values]
    total_errors = sum(results.errors.values())
    return {
        "users": users,
        "requests": len(everything),
        "rps": len(everything) / elapsed,
        "p50": pct(everything, 50),
        "p95": pct(everything, 95),
        "p99": pct(everything, 99),
        "error_rate": total_errors / max(len(everything), 1),
        "cpu_avg": statistics.fmean(cpu_samples) if cpu_samples else 0.0,
        "cpu_max": max(cpu_samples, default=0.0),
        "per_endpoint": {
            k: (len(v), pct(v, 50), pct(v, 95), results.errors.get(k, 0))
            for k, v in sorted(results.latencies.items())
        },
        "statuses": dict(results.statuses),
    }


def report(level: dict) -> None:
    print(f"\n=== {level['users']} concurrent farmers ===")
    print(
        f"requests {level['requests']:,}  throughput {level['rps']:.0f} req/s  "
        f"errors {level['error_rate']:.2%}"
    )
    print(
        f"latency  p50 {level['p50']:.0f} ms   p95 {level['p95']:.0f} ms   "
        f"p99 {level['p99']:.0f} ms"
    )
    print(f"server CPU  avg {level['cpu_avg']:.0f}%   peak {level['cpu_max']:.0f}%  (of all cores)")
    print(f"{'endpoint':<16}{'count':>8}{'p50 ms':>9}{'p95 ms':>9}{'errors':>8}")
    for name, (count, p50, p95, errors) in level["per_endpoint"].items():
        print(f"{name:<16}{count:>8}{p50:>9.0f}{p95:>9.0f}{errors:>8}")
    print("status codes:", level["statuses"])


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:8001")
    parser.add_argument("--users", type=int, nargs="+", default=[100, 500, 1000])
    parser.add_argument("--duration", type=float, default=60)
    parser.add_argument(
        "--think", type=float, default=1.0, help="seconds between a user's requests"
    )
    parser.add_argument(
        "--server-ports",
        type=int,
        nargs="*",
        help="ports whose processes count as server CPU (default: the URL's port); "
        "behind a load balancer list the balancer and every API instance",
    )
    args = parser.parse_args()
    ports = args.server_ports or [httpx.URL(args.url).port or 80]

    print(f"Creating {max(args.users)} farmers…", flush=True)
    farmers = await create_farmers(max(args.users))
    await engine.dispose()

    async with httpx.AsyncClient(base_url=args.url) as client:  # warm caches and model loading
        for farmer in farmers[: len(VILLAGES)]:
            for _ in range(2):
                await client.post(
                    "/api/v1/crop/recommend",
                    json={},
                    headers={"Authorization": f"Bearer {farmer.token}"},
                    timeout=60,
                )
                await client.get(
                    "/api/v1/weather",
                    headers={"Authorization": f"Bearer {farmer.token}"},
                    timeout=60,
                )

    for users in args.users:
        report(await run_level(args.url, farmers, users, args.duration, args.think, ports))


if __name__ == "__main__":
    asyncio.run(main())
