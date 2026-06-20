"""Stripe payment endpoints: create checkout session and read status.

If Stripe is not configured the create endpoint returns a safe 503 so the
frontend can show its polished "payment integration pending" message.
"""

import logging

from fastapi import APIRouter, HTTPException, Request

from .. import stripe_service
from ..config import get_settings
from ..models import (
    attach_checkout_session,
    get_payment_by_session,
    insert_payment_record,
)
from ..schemas import CheckoutSuccess, PaymentRequest, PaymentStatusResponse
from ..security import check_honeypot, enforce_rate_limit

logger = logging.getLogger("debra-api.payments")
router = APIRouter()


@router.post("/payments/create-checkout-session", response_model=CheckoutSuccess)
def create_checkout_session(payload: PaymentRequest, request: Request) -> CheckoutSuccess:
    check_honeypot(payload.website)
    enforce_rate_limit(request, "payments")
    settings = get_settings()

    if not stripe_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail={
                "error": "payment_not_configured",
                "message": (
                    "Online payment is not yet available. Please contact Debra to "
                    "confirm your invoice and payment details."
                ),
            },
        )

    amount_cents = int(round(payload.amount_aud * 100))
    if amount_cents < settings.stripe_min_amount_cents:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "amount_too_low",
                "message": (
                    "Amount is below the minimum of "
                    f"AUD {settings.stripe_min_amount_cents / 100:.2f}."
                ),
            },
        )
    if amount_cents > settings.stripe_max_amount_cents:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "amount_too_high",
                "message": (
                    "Amount is above the maximum of "
                    f"AUD {settings.stripe_max_amount_cents / 100:.2f}. Please "
                    "contact Debra to arrange this payment."
                ),
            },
        )

    payment_id = insert_payment_record(
        name=payload.name,
        email=str(payload.email),
        reference=payload.reference,
        amount_cents=amount_cents,
        currency=settings.stripe_currency,
        status="pending",
        metadata={"note": payload.note, "page": payload.page},
    )

    try:
        result = stripe_service.create_checkout_session(
            amount_cents=amount_cents,
            reference=payload.reference,
            customer_email=str(payload.email),
            payment_id=payment_id,
            product_name=f"Payment to Debra Wylde - {payload.reference}",
        )
    except stripe_service.StripeNotConfigured:
        raise HTTPException(
            status_code=503,
            detail={"error": "payment_not_configured", "message": "Payment is not available."},
        )
    except stripe_service.StripeError:
        raise HTTPException(
            status_code=502,
            detail={
                "error": "payment_provider_error",
                "message": "We could not start the payment. Please try again or contact Debra.",
            },
        )

    attach_checkout_session(payment_id, result.session_id)
    return CheckoutSuccess(checkout_url=result.url, payment_id=payment_id)


@router.get("/payments/status/{session_id}", response_model=PaymentStatusResponse)
def payment_status(session_id: str) -> PaymentStatusResponse:
    record = get_payment_by_session(session_id)
    if not record:
        # Do not reveal whether a session exists; return a neutral pending state.
        return PaymentStatusResponse(status="unknown")
    amount_cents = record.get("amount_cents") or 0
    return PaymentStatusResponse(
        status=record.get("status", "pending"),
        reference=record.get("reference"),
        amount_aud=round(amount_cents / 100, 2),
        currency=record.get("currency"),
    )
