"""Alignment Assessment submission endpoint.

Scoring and stage content mirror the on-screen logic in
apps/web/src/js/assessment.js so the emailed summary matches what the user
sees. The server recomputes the stage from the submitted answers where possible,
and otherwise trusts the client-provided scores/stage as a fallback. The
assessment is always free and never gated behind payment.
"""

from html import escape
from typing import Dict, List, Optional

from fastapi import APIRouter, Request

from ..config import get_settings
from ..email_html import branded_email, email_button, email_detail_row
from ..email_service import EmailMessage, send_email
from ..models import insert_assessment, insert_lead
from ..schemas import AssessmentRequest, AssessmentSuccess
from ..security import check_honeypot, enforce_rate_limit, get_client_ip, hash_ip

router = APIRouter()

# Tie-break order: when scores are equal, the stage earlier in this list wins.
# This matches the frontend resolveResultStage logic.
TIE_BREAK_PRIORITY = [
    "Aligned Leadership\u2122",
    "Decisive Expansion",
    "Vision & Architecture",
    "Identity Shift",
    "Strategic Disquiet",
]

STAGE_CONTENT = {
    "Strategic Disquiet": {
        "subheadline": "Something no longer fits",
        "body": (
            "You have built success, but something in your current way of working "
            "no longer reflects who you are becoming. This stage is often subtle "
            "at first. Outwardly, everything may still appear functional. "
            "Internally, however, the misalignment is already present. This is not "
            "failure. It is the beginning of awareness."
        ),
        "requires": (
            "Recognition, honesty, and space to acknowledge what is no longer aligned."
        ),
    },
    "Identity Shift": {
        "subheadline": "Releasing the old role",
        "body": (
            "You are no longer who you were when this chapter began. The familiar "
            "identity, role, or professional shape that once served you is starting "
            "to fall away. This stage can feel uncertain, but it is also necessary. "
            "Before your next direction becomes clear, an old version of self often "
            "has to be released."
        ),
        "requires": (
            "Permission to let go, trust in transition, and support in redefining "
            "who you are becoming."
        ),
    },
    "Vision & Architecture": {
        "subheadline": "Designing what's next",
        "body": (
            "The shift is no longer only internal. You are beginning to sense a new "
            "direction and are ready to give it form. This is the point where "
            "insight must become structure. You do not need more noise. You need a "
            "clear architecture for what comes next."
        ),
        "requires": (
            "Strategy, design, structure, and a clear framework for your next chapter."
        ),
    },
    "Decisive Expansion": {
        "subheadline": "Moving with clarity",
        "body": (
            "You are no longer waiting for certainty to appear. You are ready to "
            "move. This stage is about making clean decisions, choosing what "
            "matters, and stepping into a larger level of leadership with "
            "precision. Momentum comes from clarity, not force."
        ),
        "requires": "Decisive action, strategic refinement, and confident expansion.",
    },
    "Aligned Leadership\u2122": {
        "subheadline": "Leading from alignment",
        "body": (
            "Your work, identity, and direction are becoming fully integrated. This "
            "stage is not about beginning again. It is about leading from coherence, "
            "depth, and strategic alignment. This is where your leadership becomes "
            "more powerful because it is no longer divided."
        ),
        "requires": (
            "Sustained refinement, deeper embodiment, and expansion from an aligned core."
        ),
    },
}

CRM_TAGS = {
    "Strategic Disquiet": "AA - Strategic Disquiet",
    "Identity Shift": "AA - Identity Shift",
    "Vision & Architecture": "AA - Vision & Architecture",
    "Decisive Expansion": "AA - Decisive Expansion",
    "Aligned Leadership\u2122": "AA - Aligned Leadership",
}

ASSESSMENT_INTRO = (
    "Thank you for completing the Alignment Assessment. "
    "Here is a summary of your result."
)


def _compute_scores(answers: List) -> Dict[str, float]:
    scores: Dict[str, float] = {stage: 0 for stage in TIE_BREAK_PRIORITY}
    for answer in answers:
        group = answer.question_group
        if group in scores:
            scores[group] += answer.value
    return scores


def _resolve_stage(scores: Dict[str, float]) -> str:
    best = TIE_BREAK_PRIORITY[0]
    for stage in TIE_BREAK_PRIORITY:
        if scores.get(stage, 0) > scores.get(best, 0):
            best = stage
    return best


@router.post("/assessment", response_model=AssessmentSuccess)
def submit_assessment(payload: AssessmentRequest, request: Request) -> AssessmentSuccess:
    check_honeypot(payload.website)
    enforce_rate_limit(request, "assessment")

    # Prefer server-side recomputation; fall back to client scores when no
    # itemised answers were supplied.
    if payload.answers:
        scores = _compute_scores(payload.answers)
        stage = _resolve_stage(scores)
    else:
        scores = {k: float(v) for k, v in (payload.scores or {}).items()}
        stage = payload.result_stage or (
            _resolve_stage(scores) if scores else TIE_BREAK_PRIORITY[0]
        )

    content = STAGE_CONTENT.get(stage)
    result_summary = content["body"] if content else ""
    stage_tag = CRM_TAGS.get(stage, "AA - Unassigned")

    answers_payload = [a.model_dump() for a in payload.answers]

    lead_id = insert_lead(
        source=payload.source or "assessment",
        name=payload.name,
        email=str(payload.email),
        subject="Alignment Assessment",
        stage_tag=stage_tag,
        consent_marketing=payload.consent_marketing,
        ip_hash=hash_ip(get_client_ip(request)),
        user_agent=request.headers.get("user-agent", "")[:300] or None,
        metadata={"page": payload.page, "result_stage": stage},
    )

    insert_assessment(
        lead_id=lead_id,
        name=payload.name,
        email=str(payload.email),
        answers=answers_payload,
        scores=scores,
        stage_tag=stage,
        result_summary=result_summary,
        metadata={"crm_tag": stage_tag, "page": payload.page},
    )

    _notify_internal(payload, stage, scores, lead_id)
    _email_result(payload, stage, content, lead_id)

    return AssessmentSuccess(
        message="Your result has been saved and a summary is on its way to your inbox.",
        result_stage=stage,
        result_summary=result_summary,
    )


def _site_page_url(base: str, page: str) -> str:
    root = (base or "").rstrip("/")
    path = page if page.startswith("/") else f"/{page}"
    return f"{root}{path}"


def _notify_internal(
    payload: AssessmentRequest, stage: str, scores: Dict[str, float], lead_id: int
) -> None:
    settings = get_settings()
    if not settings.internal_notification_email:
        return

    score_rows = "".join(
        "<tr>"
        f'<td style="padding:8px 0;font-size:14px;line-height:1.5;color:#B9AFC7;">'
        f"{escape(group)}</td>"
        f'<td align="right" style="padding:8px 0;font-size:15px;line-height:1.5;'
        f'font-weight:600;color:#E9CF7A;">{value}</td>'
        "</tr>"
        for group, value in scores.items()
    )
    email_link = (
        f'<a href="mailto:{escape(str(payload.email), quote=True)}" '
        f'style="color:#E9CF7A;text-decoration:none;">{escape(str(payload.email))}</a>'
    )
    detail_rows = "".join(
        [
            email_detail_row("Name", escape(payload.name)),
            email_detail_row("Email", email_link),
            email_detail_row("Result stage", escape(stage)),
            email_detail_row("Lead ID", f"#{lead_id}"),
        ]
    )
    inner = f"""
<p style="margin:0 0 10px 0;padding:0;font-size:11px;line-height:1.4;letter-spacing:0.26em;text-transform:uppercase;color:#D87C72;">Website Notification</p>
<h1 style="margin:0 0 22px 0;padding:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;font-weight:400;color:#E9CF7A;">New assessment submission</h1>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;background-color:#120526;border:1px solid #5a4570;border-radius:18px;">
  <tr>
    <td style="padding:22px 24px;">
      <p style="margin:0 0 14px 0;padding:0;font-size:12px;line-height:1.4;letter-spacing:0.18em;text-transform:uppercase;color:#C6A85A;">Lead details</p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">{detail_rows}</table>
    </td>
  </tr>
</table>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:18px;width:100%;background-color:#391C59;border:1px solid #6b4568;border-radius:18px;">
  <tr>
    <td style="padding:22px 24px;">
      <p style="margin:0 0 12px 0;padding:0;font-size:12px;line-height:1.4;letter-spacing:0.18em;text-transform:uppercase;color:#D87C72;">Scores</p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">{score_rows}</table>
    </td>
  </tr>
</table>
"""
    html = branded_email(
        preheader=f"New assessment submission from {payload.name}: {stage}",
        inner_html=inner,
        footer_html=(
            '<p style="margin:0;padding:0;font-size:11px;line-height:1.6;color:#8F839F;">'
            "This notification was generated from the Debra Wylde Alignment Assessment."
            "</p>"
        ),
    )
    text = (
        f"New assessment submission (lead #{lead_id})\n"
        f"Name: {payload.name}\nEmail: {payload.email}\n"
        f"Result stage: {stage}\n"
        + "".join(f"  {g}: {v}\n" for g, v in scores.items())
    )
    send_email(
        EmailMessage(
            to_email=settings.internal_notification_email,
            subject=f"New assessment result: {stage} ({payload.name})",
            html=html,
            text=text,
            reply_to=str(payload.email),
            related_type="assessment",
            related_id=lead_id,
        )
    )


def _build_assessment_user_email(
    name: str,
    stage: str,
    content: Optional[dict],
    site_base_url: str,
) -> tuple[str, str]:
    """Build html and plain-text bodies for the user result summary email."""
    subheadline = content["subheadline"] if content else ""
    body = content["body"] if content else ""
    requires = content["requires"] if content else ""
    discovery_url = _site_page_url(site_base_url, "discovery-call.html")
    contact_url = _site_page_url(site_base_url, "contact.html")

    text = (
        f"Hi {name},\n\n"
        f"{ASSESSMENT_INTRO}\n\n"
        f"{stage}\n"
        f"{subheadline}\n\n"
        f"{body}\n\n"
        "What this stage requires\n"
        f"{requires}\n\n"
        "Next steps\n"
        f"Request a discovery call: {discovery_url}\n"
        f"Send a message: {contact_url}\n\n"
        "Warm regards,\n"
        "The Debra Wylde team\n"
    )
    inner = f"""
<p style="margin:0 0 18px 0;padding:0;font-size:16px;line-height:1.7;color:#F8F1E8;">Hi {escape(name)},</p>
<p style="margin:0 0 22px 0;padding:0;font-size:16px;line-height:1.7;color:#F8F1E8;">{escape(ASSESSMENT_INTRO)}</p>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;background-color:#120526;border:1px solid #5a4570;border-radius:18px;">
  <tr>
    <td style="padding:24px;">
      <p style="margin:0 0 8px 0;padding:0;font-size:12px;line-height:1.4;letter-spacing:0.18em;text-transform:uppercase;color:#C6A85A;">Your result</p>
      <h1 style="margin:0 0 10px 0;padding:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;font-weight:400;color:#E9CF7A;">{escape(stage)}</h1>
      <p style="margin:0;padding:0;font-size:15px;line-height:1.6;font-style:italic;color:#D87C72;">{escape(subheadline)}</p>
    </td>
  </tr>
</table>
<p style="margin:22px 0 18px 0;padding:0;font-size:16px;line-height:1.7;color:#F8F1E8;">{escape(body)}</p>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;background-color:#391C59;border:1px solid #6b4568;border-radius:18px;">
  <tr>
    <td style="padding:22px 24px;">
      <p style="margin:0 0 10px 0;padding:0;font-size:12px;line-height:1.4;letter-spacing:0.18em;text-transform:uppercase;color:#D87C72;">What this stage requires</p>
      <p style="margin:0;padding:0;font-size:15px;line-height:1.65;color:#EDE2D2;">{escape(requires)}</p>
    </td>
  </tr>
</table>
<p style="margin:28px 0 14px 0;padding:0;font-size:12px;line-height:1.4;letter-spacing:0.18em;text-transform:uppercase;color:#C6A85A;">Next steps</p>
<p style="margin:0 0 18px 0;padding:0;font-size:15px;line-height:1.65;color:#EDE2D2;">If you would like to explore this result in conversation, book a discovery call or send Debra a message.</p>
<table role="presentation" border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td style="padding:0;">
      {email_button(href=discovery_url, label="Discovery Call")}
    </td>
    <td style="padding:0;">
      {email_button(href=contact_url, label="Contact Debra")}
    </td>
  </tr>
</table>
<p style="margin:28px 0 0 0;padding:0;font-size:16px;line-height:1.7;color:#F8F1E8;">Warm regards,<br /><span style="color:#E9CF7A;">The Debra Wylde team</span></p>
"""
    html = branded_email(
        preheader=f"Your Alignment Assessment result: {stage}",
        inner_html=inner,
        footer_html=(
            '<p style="margin:0 0 8px 0;padding:0;font-size:12px;line-height:1.6;color:#B9AFC7;">'
            "Strategic counsel for high-achieving women leaders navigating expansion, "
            "transition, and their next level of impact."
            "</p>"
            '<p style="margin:0;padding:0;font-size:11px;line-height:1.6;color:#8F839F;">'
            "This email was sent because you completed the Alignment Assessment on the "
            "Debra Wylde website."
            "</p>"
        ),
    )
    return html, text


def _email_result(
    payload: AssessmentRequest,
    stage: str,
    content: Optional[dict],
    lead_id: int,
) -> None:
    settings = get_settings()
    html, text = _build_assessment_user_email(
        payload.name, stage, content, settings.site_base_url
    )
    send_email(
        EmailMessage(
            to_email=str(payload.email),
            subject=f"Your Alignment Assessment result: {stage}",
            html=html,
            text=text,
            related_type="assessment",
            related_id=lead_id,
        )
    )
