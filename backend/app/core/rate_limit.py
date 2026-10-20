"""Sliding-window rate limiting.

The in-memory backend limits per API instance, which is adequate behind a load balancer
with a handful of instances. Security-critical limits (OTP requests) are enforced against
PostgreSQL in `app.auth.service` instead, so they hold across all instances. A Redis
backend can replace `InMemoryWindow` when scale requires it without touching callers.
"""

import time
from collections import defaultdict, deque
from collections.abc import Callable
from threading import Lock

from fastapi import Request

from app.core.errors import AppError, TooManyRequests
from app.core.security import decode_access_token


class InMemoryWindow:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str, limit: int, window_seconds: float) -> bool:
        """Record a hit; return False when the key has exceeded `limit` in the window."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                return False
            hits.append(now)
            if len(self._hits) > 100_000:  # bound memory under abuse
                self._evict(now, window_seconds)
            return True

    def _evict(self, now: float, window_seconds: float) -> None:
        stale = [k for k, q in self._hits.items() if not q or now - q[-1] > window_seconds]
        for key in stale:
            del self._hits[key]


_window = InMemoryWindow()


def client_key(request: Request) -> str:
    """Authenticated callers are limited per user, anonymous ones per client IP."""
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        try:
            return f"user:{decode_access_token(authorization[7:]).user_id}"
        except AppError:
            pass  # invalid token: fall back to IP; the auth dependency will reject it
    # The client address is trustworthy only because uvicorn runs with --proxy-headers and
    # --forwarded-allow-ips set to the load balancer; never parse X-Forwarded-For here.
    return f"ip:{request.client.host if request.client else 'unknown'}"


def rate_limit(scope: str, limit: int | Callable[[], int], window_seconds: float = 60) -> Callable:
    """Dependency factory: `Depends(rate_limit("assistant", 20))`."""

    async def dependency(request: Request) -> None:
        resolved = limit() if callable(limit) else limit
        if not _window.hit(f"{scope}:{client_key(request)}", resolved, window_seconds):
            raise TooManyRequests("Too many requests, please slow down", retry_after=window_seconds)

    return dependency
