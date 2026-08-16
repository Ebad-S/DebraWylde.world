"""Public health endpoint.

Returns only safe operational information. Configuration diagnostics stay in
startup logs and are never exposed on this route.
"""

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
    )
