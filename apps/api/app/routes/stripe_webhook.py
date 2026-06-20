"""Stripe webhook receiver.

Verifies the Stripe signature, processes checkout completion idempotently, and
returns 2xx quickly. Fulfilment is driven only by verified webhook events, never
by the success-page redirect.
"""

import logging

from fastapi import APIRouter, HTTPException, Request

from .. import stripe_service
from ..models import mark_payment_paid

logger = logging.getLogger("debra-api.stripe_webhook")
router = APIRouter()


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request) -> dict:
    payload = await request.body()
    signature = request.headers.get("stripe-signature")

    try:
        event = stripe_service.construct_event(payload, signature)
    except stripe_service.StripeNotConfigured:
        raise HTTPException(status_code=503, detail="webhook_not_configured")
    except stripe_service.StripeError:
        # Invalid or missing signature.
        raise HTTPException(status_code=400, detail="invalid_signature")

    event_type = event.get("type")
    if event_type == "checkout.session.completed":
        session = event.get("data", {}).get("object", {})
        session_id = session.get("id")
        payment_intent = session.get("payment_intent")
        if session_id:
            changed = mark_payment_paid(
                session_id=session_id, payment_intent_id=payment_intent
            )
            logger.info(
                "checkout.session.completed session=%s changed=%s",
                session_id,
                changed,
            )

    return {"received": True}
