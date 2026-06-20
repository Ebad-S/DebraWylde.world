"""FastAPI application entry point.

Wires CORS (env allowlist), the /api router tree, database initialisation on
startup, and safe exception handlers (honeypot, rate limit, payload size, and a
generic handler that never leaks stack traces to clients in production).
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .db import init_db
from .routes import (
    assessment,
    contact,
    discovery,
    health,
    newsletter,
    payments,
    stripe_webhook,
)
from .security import RateLimited, SpamDetected

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("debra-api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    settings = get_settings()
    logger.info(
        "debra-api starting env=%s email_provider=%s stripe_configured=%s",
        settings.environment_label,
        settings.email_provider,
        settings.stripe_configured,
    )
    yield


app = FastAPI(title="Debra Wylde API", version="1.0.0", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def limit_payload_size(request: Request, call_next):
    max_bytes = get_settings().max_payload_bytes
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > max_bytes:
                return JSONResponse(
                    status_code=413,
                    content={"ok": False, "error": "payload_too_large"},
                )
        except ValueError:
            pass
    return await call_next(request)


@app.exception_handler(SpamDetected)
async def handle_spam(request: Request, exc: SpamDetected) -> JSONResponse:
    # Respond as if successful so automated submitters gain no signal.
    return JSONResponse(
        status_code=200,
        content={"ok": True, "message": "Thank you. Your submission has been received."},
    )


@app.exception_handler(RateLimited)
async def handle_rate_limited(request: Request, exc: RateLimited) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "ok": False,
            "error": "rate_limited",
            "message": "Too many requests. Please wait a moment and try again.",
        },
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "ok": False,
            "error": "validation_error",
            "message": "Please check the form fields and try again.",
        },
    )


@app.exception_handler(Exception)
async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s", request.url.path)
    if get_settings().is_production:
        message = "Something went wrong. Please try again later."
    else:
        message = f"{type(exc).__name__}: {exc}"
    return JSONResponse(
        status_code=500,
        content={"ok": False, "error": "internal_error", "message": message},
    )


api_prefix = "/api"
app.include_router(health.router, prefix=api_prefix, tags=["health"])
app.include_router(contact.router, prefix=api_prefix, tags=["contact"])
app.include_router(discovery.router, prefix=api_prefix, tags=["discovery"])
app.include_router(newsletter.router, prefix=api_prefix, tags=["newsletter"])
app.include_router(assessment.router, prefix=api_prefix, tags=["assessment"])
app.include_router(payments.router, prefix=api_prefix, tags=["payments"])
app.include_router(stripe_webhook.router, prefix=api_prefix, tags=["stripe"])
