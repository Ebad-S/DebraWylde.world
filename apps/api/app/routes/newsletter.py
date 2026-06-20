"""Newsletter subscription endpoint.

Stores subscribers in SQLite. If RESEND_AUDIENCE_ID and a Resend API key are
configured, the subscriber is also added to the Resend Audience. A confirmation
email is sent only when email sending is configured.
"""

import logging
from html import escape

import httpx

from fastapi import APIRouter, Request

from ..config import get_settings
from ..email_service import EmailMessage, send_email
from ..models import upsert_subscriber
from ..schemas import NewsletterRequest, SimpleSuccess
from ..security import check_honeypot, enforce_rate_limit

logger = logging.getLogger("debra-api.newsletter")
router = APIRouter()


@router.post("/newsletter/subscribe", response_model=SimpleSuccess)
def subscribe(payload: NewsletterRequest, request: Request) -> SimpleSuccess:
    check_honeypot(payload.website)
    enforce_rate_limit(request, "newsletter")

    upsert_subscriber(
        email=str(payload.email),
        name=payload.name,
        source=payload.source or "newsletter",
        metadata={"page": payload.page},
    )

    _maybe_add_to_resend_audience(payload)
    _maybe_confirm(payload)

    return SimpleSuccess(message="You are subscribed. Thank you for joining the list.")


def _maybe_add_to_resend_audience(payload: NewsletterRequest) -> None:
    settings = get_settings()
    if not (settings.resend_api_key and settings.resend_audience_id):
        return
    url = f"https://api.resend.com/audiences/{settings.resend_audience_id}/contacts"
    body = {"email": str(payload.email), "unsubscribed": False}
    if payload.name:
        body["first_name"] = payload.name
    headers = {"Authorization": f"Bearer {settings.resend_api_key}"}
    try:
        with httpx.Client(timeout=12) as client:
            response = client.post(url, json=body, headers=headers)
        if response.status_code >= 400:
            logger.warning(
                "Resend audience add failed status=%s", response.status_code
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Resend audience transport error: %s", type(exc).__name__)


def _maybe_confirm(payload: NewsletterRequest) -> None:
    settings = get_settings()
    # Only send a confirmation when a real provider is configured, or in console
    # mode (where it is just logged). Always safe because of the redirect guard.
    name = payload.name or "there"
    html = (
        f"<p>Hi {escape(name)},</p>"
        "<p>Thank you for subscribing to insights from Debra Wylde on leadership, "
        "transformation, and aligned growth. You can unsubscribe at any time.</p>"
        "<p>Warm regards,<br>The Debra Wylde team</p>"
    )
    text = (
        f"Hi {name},\n\n"
        "Thank you for subscribing to insights from Debra Wylde on leadership, "
        "transformation, and aligned growth. You can unsubscribe at any time.\n\n"
        "Warm regards,\nThe Debra Wylde team\n"
    )
    send_email(
        EmailMessage(
            to_email=str(payload.email),
            subject="You are subscribed - Debra Wylde",
            html=html,
            text=text,
            related_type="newsletter",
        )
    )
