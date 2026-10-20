"""Structured logging, request IDs and lightweight in-process metrics.

Metrics are per-instance and exposed in Prometheus text format at `/metrics`, so a
scraper can aggregate them across every API instance behind the load balancer.
"""

import json
import logging
import sys
import time
import uuid
from collections import defaultdict
from contextvars import ContextVar
from dataclasses import dataclass, field
from threading import Lock

from starlette.types import ASGIApp, Message, Receive, Scope, Send

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)

_RESERVED_LOG_ATTRS = set(logging.LogRecord("", 0, "", 0, "", None, None).__dict__) | {"message"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": request_id_var.get(),
        }
        payload |= {k: v for k, v in record.__dict__.items() if k not in _RESERVED_LOG_ATTRS}
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    logging.getLogger("uvicorn.access").disabled = True  # replaced by our access log


# --- Metrics -----------------------------------------------------------------------------

_LATENCY_BUCKETS_MS = (25, 50, 100, 250, 500, 1000, 2500, 5000, 10000)


@dataclass
class _Histogram:
    buckets: list[int] = field(default_factory=lambda: [0] * len(_LATENCY_BUCKETS_MS))
    count: int = 0
    total_ms: float = 0.0

    def observe(self, value_ms: float) -> None:
        self.count += 1
        self.total_ms += value_ms
        for i, bound in enumerate(_LATENCY_BUCKETS_MS):
            if value_ms <= bound:
                self.buckets[i] += 1


class Metrics:
    """Thread-safe counters and latency histograms keyed by (name, label)."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._counters: dict[tuple[str, str], int] = defaultdict(int)
        self._histograms: dict[tuple[str, str], _Histogram] = defaultdict(_Histogram)
        self.started_at = time.time()

    def inc(self, name: str, label: str = "", amount: int = 1) -> None:
        with self._lock:
            self._counters[(name, label)] += amount

    def observe_ms(self, name: str, label: str, value_ms: float) -> None:
        with self._lock:
            self._histograms[(name, label)].observe(value_ms)

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "uptime_seconds": round(time.time() - self.started_at),
                "counters": {f"{n}{{{lbl}}}": v for (n, lbl), v in self._counters.items()},
                "latency": {
                    f"{n}{{{lbl}}}": {
                        "count": h.count,
                        "avg_ms": round(h.total_ms / h.count, 1) if h.count else 0,
                    }
                    for (n, lbl), h in self._histograms.items()
                },
            }

    def render_prometheus(self) -> str:
        lines: list[str] = []
        with self._lock:
            for (name, label), value in sorted(self._counters.items()):
                lines.append(f'agrismart_{name}_total{{key="{label}"}} {value}')
            for (name, label), hist in sorted(self._histograms.items()):
                metric = f"agrismart_{name}_ms"
                for bound, count in zip(_LATENCY_BUCKETS_MS, hist.buckets, strict=True):
                    lines.append(f'{metric}_bucket{{key="{label}",le="{bound}"}} {count}')
                lines.append(f'{metric}_bucket{{key="{label}",le="+Inf"}} {hist.count}')
                lines.append(f'{metric}_sum{{key="{label}"}} {hist.total_ms:.1f}')
                lines.append(f'{metric}_count{{key="{label}"}} {hist.count}')
        return "\n".join(lines) + "\n"


metrics = Metrics()


class Timer:
    """`with Timer() as t: ...` then read `t.ms`."""

    def __enter__(self) -> "Timer":
        self._start = time.perf_counter()
        self.ms = 0.0
        return self

    def __exit__(self, *_: object) -> None:
        self.ms = (time.perf_counter() - self._start) * 1000


# --- Request middleware ------------------------------------------------------------------

access_logger = logging.getLogger("agrismart.access")


class RequestContextMiddleware:
    """Assigns a request ID, measures latency and writes one structured access-log line.

    Pure ASGI (not BaseHTTPMiddleware) so it adds no overhead to streaming or WebSockets.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope["headers"])
        incoming = headers.get(b"x-request-id", b"").decode()[:64]
        request_id = incoming or uuid.uuid4().hex
        token = request_id_var.set(request_id)
        status_code = 500
        start = time.perf_counter()

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                message.setdefault("headers", []).append((b"x-request-id", request_id.encode()))
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000
            route = scope.get("route")
            path_template = getattr(route, "path", scope["path"])
            key = f"{scope['method']} {path_template}"
            metrics.inc("http_requests", key)
            metrics.observe_ms("http_latency", key, elapsed_ms)
            if status_code >= 500:
                metrics.inc("http_failures", key)
            access_logger.info(
                "request",
                extra={
                    "method": scope["method"],
                    "path": scope["path"],
                    "status": status_code,
                    "duration_ms": round(elapsed_ms, 1),
                },
            )
            request_id_var.reset(token)
