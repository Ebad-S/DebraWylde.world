"""Environment-driven application settings.

All configuration comes from environment variables (loaded from a local .env file
in development). No secrets are hardcoded. See .env.example for the full list.
"""

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Always load apps/api/.env, even if the process was started from the repo root.
_API_DIR = Path(__file__).resolve().parents[1]
load_dotenv(_API_DIR / ".env", override=True)


def _get_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw.strip())
    except ValueError:
        return default


class Settings:
    """Plain settings object read once from the environment."""

    def __init__(self) -> None:
        self.app_env = os.getenv("APP_ENV", "development").strip()
        self.site_base_url = os.getenv(
            "SITE_BASE_URL", "http://localhost:3000"
        ).strip().rstrip("/")
        self.database_url = os.getenv(
            "DATABASE_URL", "sqlite:///./data/debra_api.sqlite3"
        ).strip()

        raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
        self.allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

        # Email
        self.email_provider = os.getenv("EMAIL_PROVIDER", "console").strip().lower()
        self.email_test_redirect = _get_bool("EMAIL_TEST_REDIRECT", False)
        self.email_test_redirect_to = os.getenv("EMAIL_TEST_REDIRECT_TO", "").strip()
        # Contact/internal alerts go here (not the form submitter). Override via env
        # for staging; production should use hello@debrawylde.world.
        self.internal_notification_email = os.getenv(
            "INTERNAL_NOTIFICATION_EMAIL", "hello@debrawylde.world"
        ).strip()

        # Resend
        self.resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
        self.resend_from_email = os.getenv("RESEND_FROM_EMAIL", "").strip()
        self.resend_audience_id = os.getenv("RESEND_AUDIENCE_ID", "").strip()
        # Template id or alias (Resend accepts either for published templates).
        # Resend send API accepts template UUID or alias (not the display name).
        # Dashboard aliases are lowercase for these templates.
        self.resend_contact_internal_template = os.getenv(
            "RESEND_CONTACT_INTERNAL_TEMPLATE", "debra_internal_notification"
        ).strip()
        self.resend_contact_client_template = os.getenv(
            "RESEND_CONTACT_CLIENT_TEMPLATE", "debra_client_confirmation"
        ).strip()

        # Calendly
        self.calendly_url = os.getenv("CALENDLY_URL", "").strip()
        # Optional personal access token. Used only to read invitee notes/name
        # after the embed reports a booking. Leave blank to skip that lookup.
        self.calendly_api_token = "".join(
            os.getenv("CALENDLY_API_TOKEN", "").split()
        )

        # Stripe
        self.stripe_secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
        self.stripe_webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
        self.stripe_currency = os.getenv("STRIPE_CURRENCY", "aud").strip().lower()
        self.stripe_min_amount_cents = _get_int("STRIPE_MIN_AMOUNT_CENTS", 5000)
        self.stripe_max_amount_cents = _get_int("STRIPE_MAX_AMOUNT_CENTS", 500000)
        self.stripe_success_url = os.getenv("STRIPE_SUCCESS_URL", "").strip()
        self.stripe_cancel_url = os.getenv("STRIPE_CANCEL_URL", "").strip()

        # Security
        self.ip_hash_salt = os.getenv("IP_HASH_SALT", "debra-local-dev-salt").strip()
        self.rate_limit_max = _get_int("RATE_LIMIT_MAX", 8)
        self.rate_limit_window_seconds = _get_int("RATE_LIMIT_WINDOW_SECONDS", 300)
        self.max_payload_bytes = _get_int("MAX_PAYLOAD_BYTES", 65536)

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in ("production", "prod")

    @property
    def environment_label(self) -> str:
        return "production" if self.is_production else "development"

    @property
    def stripe_configured(self) -> bool:
        return bool(
            self.stripe_secret_key
            and self.stripe_success_url
            and self.stripe_cancel_url
        )

    @property
    def calendly_configured(self) -> bool:
        return bool(self.calendly_url)

    @property
    def calendly_api_configured(self) -> bool:
        return bool(self.calendly_api_token)

    @property
    def resend_configured(self) -> bool:
        return bool(self.resend_api_key and self.resend_from_email)

    @property
    def sqlite_path(self) -> str:
        prefix = "sqlite:///"
        if self.database_url.startswith(prefix):
            return self.database_url[len(prefix):]
        return self.database_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
