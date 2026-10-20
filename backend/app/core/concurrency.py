"""Bounded execution of CPU-bound work (model inference, image decoding).

The event loop handles I/O. CPU work runs on worker threads, but never more than
`ml_max_concurrency` at once — excess requests wait instead of oversubscribing the CPU.
NumPy, XGBoost and ONNX Runtime release the GIL, so threads give real parallelism here.
"""

from collections.abc import Callable
from functools import partial
from typing import ParamSpec, TypeVar

import anyio
from anyio import CapacityLimiter

from app.core.config import get_settings

P = ParamSpec("P")
T = TypeVar("T")

_limiter: CapacityLimiter | None = None


def _get_limiter() -> CapacityLimiter:
    global _limiter
    if _limiter is None:
        _limiter = CapacityLimiter(get_settings().ml_max_concurrency)
    return _limiter


async def run_cpu_bound(func: Callable[P, T], *args: P.args, **kwargs: P.kwargs) -> T:
    return await anyio.to_thread.run_sync(partial(func, *args, **kwargs), limiter=_get_limiter())
