"""Domain errors and their HTTP representation.

Errors carry a stable machine-readable `code`. Clients translate the code using their own
locale files, so a Tamil-speaking farmer sees a Tamil message without the server having to
know about UI wording.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette import status

from app.core.observability import request_id_var

logger = logging.getLogger(__name__)


class AppError(Exception):
    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "bad_request"

    def __init__(self, message: str | None = None, *, code: str | None = None, **details: Any):
        self.message = message or self.code.replace("_", " ")
        if code:
            self.code = code
        self.details = details
        super().__init__(self.message)


class NotFound(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class Unauthorized(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthorized"


class Forbidden(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"


class Conflict(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class TooManyRequests(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "rate_limited"


class InvalidInput(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "invalid_input"


class ServiceUnavailable(AppError):
    """A dependency (model, provider, external API) cannot serve the request right now."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "service_unavailable"


def _body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
            "request_id": request_id_var.get(),
        }
    }


def is_capacity_error(exc: BaseException) -> bool:
    """True for "cannot get a database connection right now" failures: pool timeout, the
    server refusing new clients, or a connection dropped while being opened."""
    # Imported here: this module is shared with the ML runtime, which has no SQLAlchemy.
    from sqlalchemy.exc import DBAPIError
    from sqlalchemy.exc import TimeoutError as PoolTimeout

    if isinstance(exc, PoolTimeout):
        return True
    if isinstance(exc, DBAPIError):
        text = str(exc.orig or exc).lower()
        return exc.connection_invalidated or any(
            marker in text
            for marker in (
                "too many clients",
                "connection was closed",
                "connection refused",
                "cannot connect now",
                "the database system is starting up",
            )
        )
    return False


def register_error_handlers(app: FastAPI) -> None:
    from sqlalchemy.exc import DBAPIError
    from sqlalchemy.exc import TimeoutError as PoolTimeout

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(_body(exc.code, exc.message, exc.details), exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = [
            {"field": ".".join(str(p) for p in err["loc"][1:]), "issue": err["msg"]}
            for err in exc.errors()
        ]
        return JSONResponse(
            _body("invalid_input", "Request validation failed", {"fields": fields}),
            status.HTTP_422_UNPROCESSABLE_CONTENT,
        )

    @app.exception_handler(DBAPIError)
    @app.exception_handler(PoolTimeout)
    async def _database_error(request: Request, exc: Exception) -> JSONResponse:
        if is_capacity_error(exc):
            # The database is saturated or restarting: a short, honest "try again" beats a
            # 500, and Retry-After lets clients and the load balancer back off.
            logger.warning("database_unavailable", extra={"error": type(exc).__name__})
            return JSONResponse(
                _body("service_busy", "AgriSmart is busy, please try again in a moment"),
                status.HTTP_503_SERVICE_UNAVAILABLE,
                headers={"Retry-After": "2"},
            )
        return await _unhandled(request, exc)

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_error", exc_info=exc)
        return JSONResponse(
            _body("internal_error", "Something went wrong"),
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
