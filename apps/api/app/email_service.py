"""Email delivery with safe development behaviour.

Modes (driven by EMAIL_PROVIDER):
  - console: payloads are logged, nothing is sent over the network.
  - resend:  emails are sent through the Resend HTTP API.

Independently, EMAIL_TEST_REDIRECT=true forces every message to the test address
(EMAIL_TEST_REDIRECT_TO) while keeping the intended recipient visible in the body.
This protects real inboxes before a verified sending domain exists.

Every attempt is recorded in the email_logs table. Secrets are never logged.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx

from .config import get_settings
from .models import insert_email_log

logger = logging.getLogger("debra-api.email")

RESEND_ENDPOINT = "https://api.resend.com/emails"


@dataclass
class EmailMessage:
    to_email: str
    subject: str
    html: str
    text: str = ""
    related_type: Optional[str] = None
    related_id: Optional[int] = None
    reply_to: Optional[str] = None
    tags: dict = field(default_factory=dict)


@dataclass
class EmailResult:
    status: str
    provider: str
    to_email: str
    original_to_email: Optional[str]
    provider_message_id: Optional[str] = None
    error: Optional[str] = None


def _resolve_recipient(intended_to: str) -> tuple[str, Optional[str]]:
    """Return (actual_to, original_to). original_to is set only when redirected."""
    settings = get_settings()
    if settings.email_test_redirect and settings.email_test_redirect_to:
        return settings.email_test_redirect_to, intended_to
    return intended_to, None


def _wrap_body_with_redirect_notice(
    html: str, text: str, original_to: Optional[str]
) -> tuple[str, str]:
    if not original_to:
        return html, text
    banner_html = (
        '<div style="background:#f4efe8;border:1px solid #d8c9b4;'
        'padding:12px 16px;margin-bottom:16px;font-family:Arial,sans-serif;'
        'font-size:13px;color:#5b4a36;">'
        "<strong>Development redirect.</strong> This email was intended for "
        f"<strong>{original_to}</strong> but was redirected to the test mailbox "
        "while a verified sending domain is pending."
        "</div>"
    )
    banner_text = (
        "[Development redirect] Intended recipient: "
        f"{original_to}. Redirected to the test mailbox.\n\n"
    )
    return banner_html + html, banner_text + text


def send_email(message: EmailMessage) -> EmailResult:
    settings = get_settings()
    actual_to, original_to = _resolve_recipient(message.to_email)
    html, text = _wrap_body_with_redirect_notice(
        message.html, message.text, original_to
    )

    if settings.email_provider == "resend" and settings.resend_configured:
        result = _send_via_resend(actual_to, original_to, message, html, text)
    else:
        result = _send_via_console(actual_to, original_to, message, text)

    _log_result(message, result)
    return result


def _send_via_console(
    actual_to: str,
    original_to: Optional[str],
    message: EmailMessage,
    text: str,
) -> EmailResult:
    settings = get_settings()
    logger.info(
        "[email:console] to=%s original_to=%s subject=%s\n%s",
        actual_to,
        original_to or "-",
        message.subject,
        text or "(html only)",
    )
    return EmailResult(
        status="logged",
        provider="console",
        to_email=actual_to,
        original_to_email=original_to,
        provider_message_id=None,
    )


def _send_via_resend(
    actual_to: str,
    original_to: Optional[str],
    message: EmailMessage,
    html: str,
    text: str,
) -> EmailResult:
    settings = get_settings()
    payload = {
        "from": settings.resend_from_email,
        "to": [actual_to],
        "subject": message.subject,
        "html": html,
    }
    if text:
        payload["text"] = text
    if message.reply_to:
        payload["reply_to"] = message.reply_to

    headers = {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "Content-Type": "application/json",
    }
    try:
        with httpx.Client(timeout=12) as client:
            response = client.post(RESEND_ENDPOINT, json=payload, headers=headers)
        if response.status_code >= 400:
            # Avoid leaking the API key. Only log status + provider error body.
            logger.warning(
                "[email:resend] send failed status=%s body=%s",
                response.status_code,
                response.text[:500],
            )
            return EmailResult(
                status="failed",
                provider="resend",
                to_email=actual_to,
                original_to_email=original_to,
                error=f"resend_http_{response.status_code}",
            )
        data = response.json()
        return EmailResult(
            status="sent",
            provider="resend",
            to_email=actual_to,
            original_to_email=original_to,
            provider_message_id=data.get("id"),
        )
    except Exception as exc:  # noqa: BLE001 - network failures must not crash a request
        logger.warning("[email:resend] transport error: %s", type(exc).__name__)
        return EmailResult(
            status="failed",
            provider="resend",
            to_email=actual_to,
            original_to_email=original_to,
            error=f"transport_{type(exc).__name__}",
        )


def _log_result(message: EmailMessage, result: EmailResult) -> None:
    try:
        insert_email_log(
            provider=result.provider,
            to_email=result.to_email,
            original_to_email=result.original_to_email,
            subject=message.subject,
            status=result.status,
            provider_message_id=result.provider_message_id,
            related_type=message.related_type,
            related_id=message.related_id,
            error=result.error,
        )
    except Exception:  # noqa: BLE001 - logging must never break the request flow
        logger.exception("Failed to write email log entry")
