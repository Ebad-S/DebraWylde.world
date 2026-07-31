"""Contact form endpoint."""

from html import escape

from fastapi import APIRouter, Request

from ..config import get_settings
from ..email_service import EmailMessage, build_contact_template_data, send_email
from ..models import insert_lead
from ..schemas import ContactRequest, SimpleSuccess
from ..security import check_honeypot, enforce_rate_limit, get_client_ip, hash_ip

router = APIRouter()


@router.post("/contact", response_model=SimpleSuccess)
def submit_contact(payload: ContactRequest, request: Request) -> SimpleSuccess:
    check_honeypot(payload.website)
    enforce_rate_limit(request, "contact")

    lead_id = insert_lead(
        source=payload.source or "contact",
        name=payload.name,
        email=str(payload.email),
        phone=payload.phone,
        subject=payload.subject,
        message=payload.message,
        consent_marketing=payload.consent_marketing,
        ip_hash=hash_ip(get_client_ip(request)),
        user_agent=request.headers.get("user-agent", "")[:300] or None,
        metadata={"page": payload.page},
    )

    _notify_internal(payload, lead_id)
    _confirm_to_user(payload, lead_id)

    return SimpleSuccess(
        message="Thank you for your message. Debra will respond personally within 1-2 business days."
    )


def _notify_internal(payload: ContactRequest, lead_id: int) -> None:
    settings = get_settings()
    if not settings.internal_notification_email:
        return

    template_data = build_contact_template_data(payload, settings.site_base_url)
    phone_display = template_data["phone"]
    subject_display = template_data["subject"]

    rows = "".join(
        f"<p><strong>{escape(label)}:</strong> {escape(value)}</p>"
        for label, value in [
            ("Name", payload.name),
            ("Email", str(payload.email)),
            ("Phone", phone_display),
            ("Subject", subject_display),
            ("Source", template_data["source"]),
            ("Submitted", template_data["submitted_at"]),
        ]
    )
    html = (
        f"<h2>New contact enquiry (lead #{lead_id})</h2>{rows}"
        f"<p><strong>Message:</strong></p><p>{escape(payload.message)}</p>"
    )
    text = (
        f"New contact enquiry (lead #{lead_id})\n"
        f"Name: {payload.name}\nEmail: {payload.email}\n"
        f"Phone: {phone_display}\nSubject: {subject_display}\n"
        f"Source: {template_data['source']}\n"
        f"Submitted: {template_data['submitted_at']}\n\n"
        f"Message:\n{payload.message}\n"
    )
    send_email(
        EmailMessage(
            to_email=settings.internal_notification_email,
            subject=f"New website enquiry: {payload.name}",
            html=html,
            text=text,
            reply_to=str(payload.email),
            related_type="lead",
            related_id=lead_id,
            template_id=settings.resend_contact_internal_template or None,
            template_variables=template_data,
        )
    )


def _confirm_to_user(payload: ContactRequest, lead_id: int) -> None:
    settings = get_settings()
    template_data = build_contact_template_data(payload, settings.site_base_url)

    html = (
        f"<p>Hi {escape(payload.name)},</p>"
        "<p>Thank you for reaching out to Debra Wylde. Your message has been "
        "received and Debra will respond personally within 1-2 business days.</p>"
        "<p>Warm regards,<br>The Debra Wylde team</p>"
    )
    text = (
        f"Hi {payload.name},\n\n"
        "Thank you for reaching out to Debra Wylde. Your message has been "
        "received and Debra will respond personally within 1-2 business days.\n\n"
        "Warm regards,\nThe Debra Wylde team\n"
    )
    send_email(
        EmailMessage(
            to_email=str(payload.email),
            subject="We received your message - Debra Wylde",
            html=html,
            text=text,
            related_type="lead",
            related_id=lead_id,
            template_id=settings.resend_contact_client_template or None,
            template_variables=template_data,
        )
    )
