"""Data access helpers for the SQLite tables.

These are thin functions over the raw sqlite3 connection. They keep the route
handlers readable and centralise the SQL in one place.
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from .db import db_cursor


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _dumps(value: Optional[Dict[str, Any]]) -> Optional[str]:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


def insert_lead(
    *,
    source: Optional[str],
    name: Optional[str],
    email: Optional[str],
    phone: Optional[str] = None,
    company: Optional[str] = None,
    subject: Optional[str] = None,
    message: Optional[str] = None,
    stage_tag: Optional[str] = None,
    status: str = "new",
    consent_marketing: bool = False,
    ip_hash: Optional[str] = None,
    user_agent: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> int:
    now = _now()
    with db_cursor() as conn:
        cur = conn.execute(
            """
            INSERT INTO leads (
                created_at, updated_at, source, name, email, phone, company,
                subject, message, stage_tag, status, consent_marketing,
                ip_hash, user_agent, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                now, now, source, name, email, phone, company, subject, message,
                stage_tag, status, 1 if consent_marketing else 0, ip_hash,
                user_agent, _dumps(metadata),
            ),
        )
        return int(cur.lastrowid)


def insert_assessment(
    *,
    lead_id: Optional[int],
    name: str,
    email: str,
    answers: Any,
    scores: Any,
    stage_tag: Optional[str],
    result_summary: Optional[str],
    metadata: Optional[Dict[str, Any]] = None,
) -> int:
    with db_cursor() as conn:
        cur = conn.execute(
            """
            INSERT INTO assessment_submissions (
                created_at, lead_id, name, email, answers_json, scores_json,
                stage_tag, result_summary, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                _now(), lead_id, name, email,
                json.dumps(answers, ensure_ascii=False),
                json.dumps(scores, ensure_ascii=False),
                stage_tag, result_summary, _dumps(metadata),
            ),
        )
        return int(cur.lastrowid)


def upsert_subscriber(
    *,
    email: str,
    name: Optional[str],
    source: Optional[str],
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Insert a subscriber or refresh an existing one. Returns row info."""
    now = _now()
    with db_cursor() as conn:
        existing = conn.execute(
            "SELECT id FROM newsletter_subscribers WHERE email = ?", (email,)
        ).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE newsletter_subscribers
                SET updated_at = ?, name = COALESCE(?, name),
                    status = 'subscribed', source = COALESCE(?, source)
                WHERE email = ?
                """,
                (now, name, source, email),
            )
            return {"id": int(existing["id"]), "created": False}
        cur = conn.execute(
            """
            INSERT INTO newsletter_subscribers (
                created_at, updated_at, email, name, status, source, metadata_json
            ) VALUES (?, ?, ?, ?, 'subscribed', ?, ?)
            """,
            (now, now, email, name, source, _dumps(metadata)),
        )
        return {"id": int(cur.lastrowid), "created": True}


def insert_payment_record(
    *,
    name: str,
    email: str,
    reference: str,
    amount_cents: int,
    currency: str,
    status: str = "pending",
    metadata: Optional[Dict[str, Any]] = None,
) -> int:
    now = _now()
    with db_cursor() as conn:
        cur = conn.execute(
            """
            INSERT INTO payment_records (
                created_at, updated_at, name, email, reference, amount_cents,
                currency, status, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (now, now, name, email, reference, amount_cents, currency, status,
             _dumps(metadata)),
        )
        return int(cur.lastrowid)


def attach_checkout_session(payment_id: int, session_id: str) -> None:
    with db_cursor() as conn:
        conn.execute(
            """
            UPDATE payment_records
            SET stripe_checkout_session_id = ?, updated_at = ?
            WHERE id = ?
            """,
            (session_id, _now(), payment_id),
        )


def mark_payment_paid(
    *, session_id: str, payment_intent_id: Optional[str]
) -> bool:
    """Idempotently mark a payment as paid. Returns True if a row changed."""
    with db_cursor() as conn:
        row = conn.execute(
            "SELECT id, status FROM payment_records WHERE stripe_checkout_session_id = ?",
            (session_id,),
        ).fetchone()
        if row is None:
            return False
        if row["status"] == "paid":
            return False
        conn.execute(
            """
            UPDATE payment_records
            SET status = 'paid', stripe_payment_intent_id = ?, updated_at = ?
            WHERE stripe_checkout_session_id = ?
            """,
            (payment_intent_id, _now(), session_id),
        )
        return True


def get_payment_by_session(session_id: str) -> Optional[Dict[str, Any]]:
    with db_cursor() as conn:
        row = conn.execute(
            "SELECT * FROM payment_records WHERE stripe_checkout_session_id = ?",
            (session_id,),
        ).fetchone()
        return dict(row) if row else None


def insert_email_log(
    *,
    provider: str,
    to_email: str,
    original_to_email: Optional[str],
    subject: str,
    status: str,
    provider_message_id: Optional[str] = None,
    related_type: Optional[str] = None,
    related_id: Optional[int] = None,
    error: Optional[str] = None,
) -> int:
    with db_cursor() as conn:
        cur = conn.execute(
            """
            INSERT INTO email_logs (
                created_at, provider, to_email, original_to_email, subject,
                status, provider_message_id, related_type, related_id, error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (_now(), provider, to_email, original_to_email, subject, status,
             provider_message_id, related_type, related_id, error),
        )
        return int(cur.lastrowid)
