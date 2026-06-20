"""Discovery call request endpoint."""

from html import escape

from fastapi import APIRouter, Request

from ..config import get_settings
from ..email_service import EmailMessage, send_email
from ..models import insert_lead
from ..schemas import DiscoveryCallRequest, SimpleSuccess
from ..security import check_honeypot, enforce_rate_limit, get_client_ip, hash_ip

router = APIRouter()


@router.post("/discovery-call", response_model=SimpleSuccess)
def submit_discovery_call(
    payload: DiscoveryCallRequest, request: Request
) -> SimpleSuccess:
    check_honeypot(payload.website)
    enforce_rate_limit(request, "discovery")

    lead_id = insert_lead(
        source=payload.source or "discovery-call",
        name=payload.name,
        email=str(payload.email),
        phone=payload.phone,
        company=payload.company,
        subject="Discovery call request",
        message=payload.message,
        stage_tag="discovery-call",
        consent_marketing=payload.consent_marketing,
        ip_hash=hash_ip(get_client_ip(request)),
        user_agent=request.headers.get("user-agent", "")[:300] or None,
        metadata={"page": payload.page, "best_time": payload.best_time},
    )

    _notify_internal(payload, lead_id)
    _confirm_to_user(payload, lead_id)

    return SimpleSuccess(
        message="Thank you. Debra will be in touch to arrange your free discovery call."
    )


def _notify_internal(payload: DiscoveryCallRequest, lead_id: int) -> None:
    settings = get_settings()
    if not settings.internal_notification_email:
        return
    rows = "".join(
        f"<p><strong>{escape(label)}:</strong> {escape(value)}</p>"
        for label, value in [
            ("Name", payload.name),
            ("Email", str(payload.email)),
            ("Phone", payload.phone or "-"),
            ("Company", payload.company or "-"),
            ("Best time to contact", payload.best_time or "-"),
        ]
    )
    html = (
        f"<h2>New discovery call request (lead #{lead_id})</h2>{rows}"
        f"<p><strong>Message:</strong></p><p>{escape(payload.message or '-')}</p>"
    )
    text = (
        f"New discovery call request (lead #{lead_id})\n"
        f"Name: {payload.name}\nEmail: {payload.email}\n"
        f"Phone: {payload.phone or '-'}\nCompany: {payload.company or '-'}\n"
        f"Best time: {payload.best_time or '-'}\n\n"
        f"Message:\n{payload.message or '-'}\n"
    )
    send_email(
        EmailMessage(
            to_email=settings.internal_notification_email,
            subject=f"New discovery call request from {payload.name}",
            html=html,
            text=text,
            reply_to=str(payload.email),
            related_type="lead",
            related_id=lead_id,
        )
    )


def _confirm_to_user(payload: DiscoveryCallRequest, lead_id: int) -> None:
    html = (
        f"<p>Hi {escape(payload.name)},</p>"
        "<p>Thank you for requesting a discovery call with Debra Wylde. Your "
        "request has been received and Debra will reach out to confirm a time "
        "that works for you.</p>"
        "<p>Warm regards,<br>The Debra Wylde team</p>"
    )
    text = (
        f"Hi {payload.name},\n\n"
        "Thank you for requesting a discovery call with Debra Wylde. Your "
        "request has been received and Debra will reach out to confirm a time "
        "that works for you.\n\n"
        "Warm regards,\nThe Debra Wylde team\n"
    )
    send_email(
        EmailMessage(
            to_email=str(payload.email),
            subject="Your discovery call request - Debra Wylde",
            html=html,
            text=text,
            related_type="lead",
            related_id=lead_id,
        )
    )
