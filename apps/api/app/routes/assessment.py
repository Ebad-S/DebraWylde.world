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


def _notify_internal(
    payload: AssessmentRequest, stage: str, scores: Dict[str, float], lead_id: int
) -> None:
    settings = get_settings()
    if not settings.internal_notification_email:
        return
    score_rows = "".join(
        f"<li>{escape(group)}: {value}</li>" for group, value in scores.items()
    )
    html = (
        f"<h2>New assessment submission (lead #{lead_id})</h2>"
        f"<p><strong>Name:</strong> {escape(payload.name)}</p>"
        f"<p><strong>Email:</strong> {escape(str(payload.email))}</p>"
        f"<p><strong>Result stage:</strong> {escape(stage)}</p>"
        f"<p><strong>Scores:</strong></p><ul>{score_rows}</ul>"
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
    name: str, stage: str, content: Optional[dict]
) -> tuple[str, str]:
    """Build html and plain-text bodies for the user result summary email."""
    subheadline = content["subheadline"] if content else ""
    body = content["body"] if content else ""
    requires = content["requires"] if content else ""

    text = (
        f"Hi {name},\n\n"
        f"{ASSESSMENT_INTRO}\n\n"
        f"{stage}\n"
        f"{subheadline}\n\n"
        f"{body}\n\n"
        "What this stage requires\n"
        f"{requires}\n\n"
        "Warm regards,\n"
        "The Debra Wylde team\n"
    )
    html = (
        f"<p>Hi {escape(name)},</p>"
        f"<p>{escape(ASSESSMENT_INTRO)}</p>"
        f"<h2>{escape(stage)}</h2>"
        f"<p><em>{escape(subheadline)}</em></p>"
        f"<p>{escape(body)}</p>"
        f"<p><strong>What this stage requires</strong></p>"
        f"<p>{escape(requires)}</p>"
        "<p>Warm regards,<br>The Debra Wylde team</p>"
    )
    return html, text


def _email_result(
    payload: AssessmentRequest,
    stage: str,
    content: Optional[dict],
    lead_id: int,
) -> None:
    html, text = _build_assessment_user_email(payload.name, stage, content)
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
