"""SQLite connection handling and schema initialisation.

Uses the standard library sqlite3 driver. Tables are created with simple
idempotent "CREATE TABLE IF NOT EXISTS" statements on application startup, so
there is no separate migration tool to manage.
"""

import os
import sqlite3
from contextlib import contextmanager
from typing import Iterator

from .config import get_settings

SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        source TEXT,
        name TEXT,
        email TEXT,
        phone TEXT,
        company TEXT,
        subject TEXT,
        message TEXT,
        stage_tag TEXT,
        status TEXT DEFAULT 'new',
        consent_marketing INTEGER DEFAULT 0,
        ip_hash TEXT,
        user_agent TEXT,
        metadata_json TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS assessment_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        lead_id INTEGER,
        name TEXT,
        email TEXT,
        answers_json TEXT,
        scores_json TEXT,
        stage_tag TEXT,
        result_summary TEXT,
        metadata_json TEXT,
        FOREIGN KEY (lead_id) REFERENCES leads (id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        status TEXT DEFAULT 'subscribed',
        source TEXT,
        metadata_json TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS payment_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        name TEXT,
        email TEXT,
        reference TEXT,
        amount_cents INTEGER,
        currency TEXT,
        status TEXT DEFAULT 'pending',
        stripe_checkout_session_id TEXT UNIQUE,
        stripe_payment_intent_id TEXT,
        metadata_json TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS email_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        provider TEXT,
        to_email TEXT,
        original_to_email TEXT,
        subject TEXT,
        status TEXT,
        provider_message_id TEXT,
        related_type TEXT,
        related_id INTEGER,
        error TEXT
    )
    """,
]


def _resolve_db_file() -> str:
    settings = get_settings()
    path = settings.sqlite_path
    directory = os.path.dirname(path)
    if directory and not os.path.exists(directory):
        os.makedirs(directory, exist_ok=True)
    return path


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(_resolve_db_file(), timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


@contextmanager
def db_cursor() -> Iterator[sqlite3.Connection]:
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with db_cursor() as conn:
        for statement in SCHEMA_STATEMENTS:
            conn.execute(statement)
