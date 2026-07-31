"""Email delivery with safe development behaviour.

Modes (driven by EMAIL_PROVIDER):
  - console: payloads are logged, nothing is sent over the network.
  - resend:  emails are sent through the Resend HTTP API.

Independently, EMAIL_TEST_REDIRECT=true forces every message to the test address
(EMAIL_TEST_REDIRECT_TO) while keeping the intended recipient visible in the body
(or console log when using Resend templates, which cannot include custom HTML).
This protects real inboxes before a verified sending domain exists.

Every attempt is recorded in the email_logs table. Secrets are never logged.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Mapping, Optional
from urllib.parse import quote

import httpx

from .config import get_settings
from .models import insert_email_log

logger = logging.getLogger("debra-api.email")

RESEND_ENDPOINT = "https://api.resend.com/emails"
NOT_PROVIDED = "Not provided"
# Resend template variable string values are capped at 2,000 characters.
_RESEND_VAR_MAX_LEN = 2000


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
    # Resend published template id or alias. When set in resend mode, html/text
    # are omitted from the API payload (Resend forbids mixing them with templates).
    template_id: Optional[str] = None
    template_variables: Optional[dict] = None


@dataclass
class EmailResult:
    status: str
    provider: str
    to_email: str
    original_to_email: Optional[str]
    provider_message_id: Optional[str] = None
    error: Optional[str] = None


def build_contact_template_data(payload: Any, site_base_url: str) -> dict:
    """Build Resend template variables for contact-form emails.

    Optional phone/subject render as ``Not provided``. The mailto reply link in
    the internal template already prefixes ``Re:``, so ``encoded_subject`` is the
    URL-encoded raw subject (or ``Website enquiry`` when subject is missing).
    """
    phone_raw = getattr(payload, "phone", None)
    phone = (str(phone_raw).strip() if phone_raw is not None else "") or NOT_PROVIDED

    subject_raw = getattr(payload, "subject", None)
    subject_clean = str(subject_raw).strip() if subject_raw is not None else ""
    subject_display = subject_clean or NOT_PROVIDED
    encode_source = subject_clean or "Website enquiry"

    source_raw = getattr(payload, "source", None)
    source = (str(source_raw).strip() if source_raw is not None else "") or "contact"

    submitted_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    site_url = (site_base_url or "").strip().rstrip("/")

    return {
        "name": getattr(payload, "name", "") or "",
        "email": str(getattr(payload, "email", "")),
        "phone": phone,
        "subject": subject_display,
        "message": getattr(payload, "message", "") or "",
        "source": source,
        "submitted_at": submitted_at,
        "site_url": site_url,
        "encoded_subject": quote(encode_source, safe=""),
    }


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


def _truncate_template_variables(variables: Mapping[str, Any]) -> dict:
    """Clamp string values to Resend's per-variable length limit."""
    out: dict = {}
    for key, value in variables.items():
        if isinstance(value, str) and len(value) > _RESEND_VAR_MAX_LEN:
            out[key] = value[: _RESEND_VAR_MAX_LEN - 3] + "..."
        else:
            out[key] = value
    return out


def send_email(message: EmailMessage) -> EmailResult:
    settings = get_settings()
    actual_to, original_to = _resolve_recipient(message.to_email)
    html, text = _wrap_body_with_redirect_notice(
        message.html, message.text, original_to
    )

    if settings.email_provider == "resend":
        if settings.resend_configured:
            result = _send_via_resend(actual_to, original_to, message, html, text)
        else:
            result = _fail_resend_not_configured(actual_to, original_to)
    else:
        result = _send_via_console(actual_to, original_to, message, text)

    _log_result(message, result)
    return result


def _fail_resend_not_configured(
    actual_to: str, original_to: Optional[str]
) -> EmailResult:
    logger.warning(
        "[email:resend] EMAIL_PROVIDER=resend but RESEND_API_KEY / "
        "RESEND_FROM_EMAIL are not configured; message not sent"
    )
    return EmailResult(
        status="failed",
        provider="resend",
        to_email=actual_to,
        original_to_email=original_to,
        error="resend_not_configured",
    )


def _send_via_console(
    actual_to: str,
    original_to: Optional[str],
    message: EmailMessage,
    text: str,
) -> EmailResult:
    template_name = message.template_id or "-"
    variables = message.template_variables or {}
    variables_json = json.dumps(variables, ensure_ascii=True, default=str)
    logger.info(
        "[email:console] template=%s to=%s original_to=%s subject=%s\n"
        "variables=%s\n%s",
        template_name,
        actual_to,
        original_to or "-",
        message.subject,
        variables_json,
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
    payload: dict = {
        "from": settings.resend_from_email,
        "to": [actual_to],
        "subject": message.subject,
    }
    if message.reply_to:
        payload["reply_to"] = message.reply_to

    if message.template_id:
        # Template mode: do not send html/text (Resend validation error otherwise).
        # Redirect notice cannot be injected into hosted templates; original_to is
        # still preserved on email_logs and in API recipient resolution.
        template_block: dict = {"id": message.template_id}
        if message.template_variables:
            template_block["variables"] = _truncate_template_variables(
                message.template_variables
            )
        payload["template"] = template_block
        if original_to:
            logger.info(
                "[email:resend] template=%s redirected; intended_for=%s",
                message.template_id,
                original_to,
            )
    else:
        payload["html"] = html
        if text:
            payload["text"] = text

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
