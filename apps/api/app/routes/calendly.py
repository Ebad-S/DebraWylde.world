"""Notify hello@ when a Calendly embed booking completes.

The embed only posts API URIs. This endpoint loads the scheduled event, invitee,
and event type from Calendly (when ``CALENDLY_API_TOKEN`` is set) and emails
every useful field to the internal inbox.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html import escape
from typing import Any, Optional
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Request

from ..config import get_settings
from ..email_html import branded_email, email_button, email_detail_row
from ..email_service import EmailMessage, send_email
from ..models import insert_lead
from ..schemas import CalendlyBookingRequest, SimpleSuccess
from ..security import check_honeypot, enforce_rate_limit, get_client_ip, hash_ip

router = APIRouter()
logger = logging.getLogger("debra-api.calendly")

_CALENDLY_API_HOST = "api.calendly.com"
_SCHEDULED_EVENTS_PREFIX = "/scheduled_events/"
_CALENDLY_MEETINGS = "https://calendly.com/app/meetings/user/me"


@dataclass
class BookingDetails:
    meeting_url: str
    join_url: Optional[str] = None
    cancel_url: Optional[str] = None
    reschedule_url: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    rows: list[tuple[str, str]] = field(default_factory=list)


@router.post("/calendly/booking", response_model=SimpleSuccess)
def notify_calendly_booking(
    payload: CalendlyBookingRequest, request: Request
) -> SimpleSuccess:
    check_honeypot(payload.website)
    enforce_rate_limit(request, "calendly-booking")

    event_uri = _safe_calendly_api_uri(payload.event_uri)
    invitee_uri = _safe_calendly_api_uri(payload.invitee_uri)
    details = _build_booking_details(event_uri, invitee_uri)

    lead_id = insert_lead(
        source=payload.source or "calendly-booking",
        name=details.name,
        email=details.email,
        subject="Calendly discovery call booking",
        message=details.notes
        or "A visitor booked a discovery call through the website calendar.",
        stage_tag="calendly-booking",
        ip_hash=hash_ip(get_client_ip(request)),
        user_agent=request.headers.get("user-agent", "")[:300] or None,
        metadata={
            "page": payload.page,
            "event_uri": event_uri,
            "invitee_uri": invitee_uri,
            "meeting_url": details.meeting_url,
            "join_url": details.join_url,
        },
    )

    _notify_internal(lead_id, details)
    logger.info(
        "calendly booking notify lead_id=%s has_invitee=%s has_notes=%s",
        lead_id,
        bool(details.name or details.email),
        bool(details.notes),
    )
    return SimpleSuccess(message="Booking notification received.")


def _safe_calendly_api_uri(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    parsed = urlparse(value)
    if parsed.scheme != "https" or parsed.netloc != _CALENDLY_API_HOST:
        return None
    if not parsed.path.startswith(_SCHEDULED_EVENTS_PREFIX):
        return None
    return value


def _event_id_from_uri(event_uri: Optional[str]) -> Optional[str]:
    if not event_uri:
        return None
    parts = urlparse(event_uri).path.rstrip("/").split("/")
    if len(parts) < 3 or parts[1] != "scheduled_events":
        return None
    return parts[2] or None


def _meeting_url_from_event_id(event_id: str) -> str:
    return f"{_CALENDLY_MEETINGS}?selected={event_id}&pane=meeting_details"


def _build_booking_details(
    event_uri: Optional[str], invitee_uri: Optional[str]
) -> BookingDetails:
    event_id = _event_id_from_uri(event_uri)
    meeting_url = (
        _meeting_url_from_event_id(event_id) if event_id else _CALENDLY_MEETINGS
    )
    details = BookingDetails(meeting_url=meeting_url)
    token = get_settings().calendly_api_token
    if not token:
        logger.warning("calendly lookup skipped: CALENDLY_API_TOKEN is empty")
        return details

    event = _calendly_get(event_uri, token) if event_uri else None
    invitee = _calendly_get(invitee_uri, token) if invitee_uri else None
    if event and not invitee:
        invitee = _first_invitee(event_uri, token)
    event_type = None
    if event and isinstance(event.get("event_type"), str):
        event_type = _calendly_get(event["event_type"], token)

    if not event and not invitee:
        logger.warning("calendly lookup returned no event or invitee")
        return details

    _fill_from_api(details, event or {}, invitee or {}, event_type or {})
    return details


def _first_invitee(event_uri: str, token: str) -> Optional[dict[str, Any]]:
    data = _calendly_get_collection(f"{event_uri.rstrip('/')}/invitees", token)
    return data[0] if data else None


def _calendly_get(uri: str, token: str) -> Optional[dict[str, Any]]:
    payload = _calendly_request(uri, token)
    if not payload:
        return None
    resource = payload.get("resource")
    return resource if isinstance(resource, dict) else None


def _calendly_get_collection(uri: str, token: str) -> list[dict[str, Any]]:
    payload = _calendly_request(uri, token)
    if not payload:
        return []
    items = payload.get("collection") or []
    return [item for item in items if isinstance(item, dict)]


def _calendly_request(uri: str, token: str) -> Optional[dict[str, Any]]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    try:
        with httpx.Client(timeout=10) as client:
            response = client.get(uri, headers=headers)
        if response.status_code >= 400:
            logger.warning(
                "calendly lookup failed status=%s path=%s",
                response.status_code,
                urlparse(uri).path,
            )
            return None
        data = response.json()
        return data if isinstance(data, dict) else None
    except Exception as exc:  # noqa: BLE001 - lookup must not block the email
        logger.warning("calendly lookup error: %s", type(exc).__name__)
        return None


def _fill_from_api(
    details: BookingDetails,
    event: dict[str, Any],
    invitee: dict[str, Any],
    event_type: dict[str, Any],
) -> None:
    tz_name = _clean_text(invitee.get("timezone")) or "Australia/Sydney"
    location = event.get("location") if isinstance(event.get("location"), dict) else {}
    memberships = event.get("event_memberships") or []
    host = memberships[0] if memberships and isinstance(memberships[0], dict) else {}
    questions = invitee.get("questions_and_answers") or []

    details.name = _clean_text(invitee.get("name"))
    details.email = _clean_text(invitee.get("email"))
    # Only surface a join URL when Calendly actually created the conference.
    # Failed Teams/Zoom setup is Debra's Calendly config, not a site bug.
    location_status = _clean_text(location.get("status"))
    join_url = _clean_text(location.get("join_url"))
    details.join_url = join_url if location_status == "pushed" and join_url else None
    details.cancel_url = _clean_text(invitee.get("cancel_url"))
    details.reschedule_url = _clean_text(invitee.get("reschedule_url"))

    note_parts: list[str] = []
    for item in questions:
        if not isinstance(item, dict):
            continue
        answer = _clean_text(item.get("answer"))
        if answer:
            note_parts.append(answer)
    details.notes = "\n".join(note_parts) if note_parts else _clean_text(
        event.get("meeting_notes_plain")
    )

    duration = event_type.get("duration")
    duration_label = f"{duration}-minute meeting" if duration else None

    _add(details, "Event", _clean_text(event.get("name")) or duration_label)
    _add(details, "When", _format_range(event.get("start_time"), event.get("end_time"), tz_name))
    _add(details, "Timezone", tz_name)
    _add(details, "Status", _pretty_label(event.get("status") or invitee.get("status")))
    _add(details, "Location", _pretty_label(location.get("type")))
    _add(details, "Join link", details.join_url)
    _add(details, "Invitee", details.name)
    _add(details, "Email", details.email)
    _add(details, "Phone", _clean_text(invitee.get("text_reminder_number")))
    for item in questions:
        if not isinstance(item, dict):
            continue
        question = _clean_text(item.get("question")) or "Question"
        answer = _clean_text(item.get("answer"))
        if answer:
            _add(details, question, answer)
    _add(details, "Host", _clean_text(host.get("user_name")))
    _add(details, "Host email", _clean_text(host.get("user_email")))
    if invitee.get("rescheduled") is True:
        _add(details, "Rescheduled", "Yes")
    _add(details, "Booked at", _format_stamp(invitee.get("created_at") or event.get("created_at"), tz_name))


def _add(details: BookingDetails, label: str, value: Optional[str]) -> None:
    if value:
        details.rows.append((label, value))


def _pretty_label(value: Any) -> Optional[str]:
    text = _clean_text(value)
    if not text:
        return None
    return text.replace("_", " ").replace("-", " ").title()


def _format_range(start_time: Any, end_time: Any, timezone_name: str) -> Optional[str]:
    start = _parse_dt(start_time, timezone_name)
    end = _parse_dt(end_time, timezone_name)
    if not start:
        return None
    start_label = _display_dt(start, timezone_name, with_date=True)
    if not end:
        return start_label
    end_label = _display_dt(end, timezone_name, with_date=False)
    return f"{start_label} to {end_label}"


def _format_stamp(value: Any, timezone_name: str) -> Optional[str]:
    moment = _parse_dt(value, timezone_name)
    if not moment:
        return _clean_text(value) if isinstance(value, str) else None
    return _display_dt(moment, timezone_name, with_date=True)


def _parse_dt(value: Any, timezone_name: str) -> Optional[datetime]:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    try:
        return moment.astimezone(ZoneInfo(timezone_name))
    except Exception:  # noqa: BLE001 - Windows needs tzdata for IANA names
        logger.warning("timezone %s unavailable; using UTC", timezone_name)
        return moment.astimezone(timezone.utc)


def _display_dt(moment: datetime, timezone_name: str, *, with_date: bool) -> str:
    hour = moment.strftime("%I").lstrip("0") or "0"
    time_part = f"{hour}:{moment.strftime('%M %p')}"
    if with_date:
        return f"{moment.day} {moment.strftime('%b %Y')}, {time_part} {timezone_name}"
    return f"{time_part} {timezone_name}"


def _clean_text(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned or None


def _html_value(label: str, value: str) -> str:
    if value.startswith("http://") or value.startswith("https://"):
        return (
            f'<a href="{escape(value, quote=True)}" style="color:#E9CF7A;">'
            f"{escape(value)}</a>"
        )
    if label.lower() == "email" or "@" in value and " " not in value:
        return (
            f'<a href="mailto:{escape(value, quote=True)}" style="color:#E9CF7A;">'
            f"{escape(value)}</a>"
        )
    return "<br />".join(escape(line) if line else "&nbsp;" for line in value.splitlines())


def _notify_internal(lead_id: int, details: BookingDetails) -> None:
    settings = get_settings()
    if not settings.internal_notification_email:
        return

    rows_html = "".join(
        email_detail_row(label, _html_value(label, value))
        for label, value in details.rows
    )
    if not rows_html:
        rows_html = email_detail_row(
            "Meeting",
            _html_value("Meeting", details.meeting_url),
        )

    buttons = email_button(href=details.meeting_url, label="Open in Calendly")
    extra_links = [
        f'<a href="{escape(_CALENDLY_MEETINGS, quote=True)}" style="color:#E9CF7A;">All meetings</a>'
    ]
    if details.join_url:
        extra_links.insert(
            0,
            f'<a href="{escape(details.join_url, quote=True)}" style="color:#E9CF7A;">Join call</a>',
        )
    if details.reschedule_url:
        extra_links.append(
            f'<a href="{escape(details.reschedule_url, quote=True)}" style="color:#E9CF7A;">Reschedule</a>'
        )
    if details.cancel_url:
        extra_links.append(
            f'<a href="{escape(details.cancel_url, quote=True)}" style="color:#E9CF7A;">Cancel</a>'
        )

    inner = f"""
<h1 style="margin:0 0 18px 0;padding:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;font-weight:400;color:#E9CF7A;">New Calendly booking</h1>
<p style="margin:0 0 22px 0;padding:0;font-size:16px;line-height:1.7;color:#F8F1E8;">A visitor just booked a discovery call on the website.</p>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;background-color:#120526;border:1px solid #5a4570;border-radius:18px;">
  <tr>
    <td style="padding:22px 24px;">
      <p style="margin:0 0 14px 0;padding:0;font-size:12px;line-height:1.4;letter-spacing:0.18em;text-transform:uppercase;color:#C6A85A;">Booking</p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">{rows_html}</table>
    </td>
  </tr>
</table>
<p style="margin:28px 0 18px 0;padding:0;">{buttons}</p>
<p style="margin:0;padding:0;font-size:14px;line-height:1.6;color:#B9AFC7;">{" &middot; ".join(extra_links)}</p>
"""
    html = branded_email(
        preheader="A discovery call was just booked on the website.",
        inner_html=inner,
        footer_html=(
            '<p style="margin:0;padding:0;font-size:11px;line-height:1.6;color:#8F839F;">'
            "This notification was generated from the Debra Wylde Discovery Call page."
            "</p>"
        ),
    )
    text_lines = [f"New Calendly booking (lead #{lead_id})"]
    for label, value in details.rows:
        text_lines.append(f"{label}: {value}")
    text_lines.append(f"Calendly: {details.meeting_url}")
    if details.join_url:
        text_lines.append(f"Join: {details.join_url}")

    send_email(
        EmailMessage(
            to_email=settings.internal_notification_email,
            subject="New Calendly booking: Discovery Call",
            html=html,
            text="\n".join(text_lines) + "\n",
            related_type="lead",
            related_id=lead_id,
        )
    )
