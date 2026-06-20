"""Health and configuration-status endpoint."""

from fastapi import APIRouter

from ..config import get_settings
from ..schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        ok=True,
        service="debra-api",
        environment=settings.environment_label,
        email_provider=settings.email_provider,
        stripe_configured=settings.stripe_configured,
        calendly_configured=settings.calendly_configured,
    )
