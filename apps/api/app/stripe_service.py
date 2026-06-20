"""Stripe integration, guarded entirely by environment configuration.

Uses Stripe-hosted Checkout (no card data ever touches this server or the
browser). When Stripe env vars are absent the service reports itself as not
configured and the route returns a safe 503.
"""

import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional

import stripe

from .config import get_settings

logger = logging.getLogger("debra-api.stripe")


class StripeNotConfigured(Exception):
    pass


class StripeError(Exception):
    pass


@dataclass
class CheckoutResult:
    session_id: str
    url: str


def is_configured() -> bool:
    return get_settings().stripe_configured


def _client() -> Any:
    settings = get_settings()
    if not settings.stripe_configured:
        raise StripeNotConfigured()
    stripe.api_key = settings.stripe_secret_key
    return stripe


def create_checkout_session(
    *,
    amount_cents: int,
    reference: str,
    customer_email: str,
    payment_id: int,
    product_name: str,
) -> CheckoutResult:
    settings = get_settings()
    client = _client()
    try:
        session = client.checkout.Session.create(
            mode="payment",
            customer_email=customer_email,
            line_items=[
                {
                    "price_data": {
                        "currency": settings.stripe_currency,
                        "product_data": {"name": product_name},
                        "unit_amount": amount_cents,
                    },
                    "quantity": 1,
                }
            ],
            metadata={
                "payment_id": str(payment_id),
                "client_email": customer_email,
                "reference": reference,
                "source": "pay-online",
            },
            success_url=settings.stripe_success_url,
            cancel_url=settings.stripe_cancel_url,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Stripe checkout creation failed: %s", type(exc).__name__)
        raise StripeError(str(exc)) from exc

    if not session.get("url") or not session.get("id"):
        raise StripeError("Stripe did not return a checkout URL")
    return CheckoutResult(session_id=session["id"], url=session["url"])


def construct_event(payload: bytes, signature_header: Optional[str]) -> Dict[str, Any]:
    settings = get_settings()
    if not settings.stripe_webhook_secret:
        raise StripeNotConfigured()
    if not signature_header:
        raise StripeError("missing_signature")
    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=signature_header,
            secret=settings.stripe_webhook_secret,
        )
    except Exception as exc:  # noqa: BLE001 - includes signature verification errors
        raise StripeError("invalid_signature") from exc
    return event
