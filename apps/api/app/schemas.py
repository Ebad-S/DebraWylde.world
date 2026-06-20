"""Pydantic request and response schemas.

All public form schemas include an optional honeypot field (``website``) plus
optional ``source`` / ``page`` metadata. Text fields are length-limited to keep
payloads small and to blunt abuse.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


def _clean(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


class BasePublicForm(BaseModel):
    # Honeypot. Real users never see or fill this. Bots often do.
    website: Optional[str] = Field(default=None, max_length=200)
    source: Optional[str] = Field(default=None, max_length=120)
    page: Optional[str] = Field(default=None, max_length=300)


class ContactRequest(BasePublicForm):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=40)
    subject: Optional[str] = Field(default=None, max_length=200)
    message: str = Field(min_length=1, max_length=5000)
    consent_marketing: bool = False

    @field_validator("name", "subject", "phone", "message", mode="before")
    @classmethod
    def _strip_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        return value


class DiscoveryCallRequest(BasePublicForm):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=40)
    company: Optional[str] = Field(default=None, max_length=160)
    best_time: Optional[str] = Field(default=None, max_length=200)
    message: Optional[str] = Field(default=None, max_length=5000)
    consent_marketing: bool = False

    @field_validator("name", "company", "best_time", "phone", "message", mode="before")
    @classmethod
    def _strip_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        return value


class NewsletterRequest(BasePublicForm):
    email: EmailStr
    name: Optional[str] = Field(default=None, max_length=120)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        return value


class AssessmentAnswer(BaseModel):
    question_id: int
    question_group: str = Field(max_length=120)
    value: int = Field(ge=0, le=5)


class AssessmentRequest(BasePublicForm):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    answers: List[AssessmentAnswer] = Field(default_factory=list, max_length=100)
    scores: Optional[Dict[str, float]] = None
    result_stage: Optional[str] = Field(default=None, max_length=120)
    consent_marketing: bool = False

    @field_validator("name", mode="before")
    @classmethod
    def _strip_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        return value


class PaymentRequest(BasePublicForm):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    reference: str = Field(min_length=1, max_length=120)
    amount_aud: float = Field(gt=0)
    note: Optional[str] = Field(default=None, max_length=500)

    @field_validator("name", "reference", "note", mode="before")
    @classmethod
    def _strip_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        return value


class SimpleSuccess(BaseModel):
    ok: bool = True
    message: str


class AssessmentSuccess(SimpleSuccess):
    result_stage: Optional[str] = None
    result_summary: Optional[str] = None


class CheckoutSuccess(BaseModel):
    ok: bool = True
    checkout_url: str
    payment_id: int


class HealthResponse(BaseModel):
    ok: bool = True
    service: str = "debra-api"
    environment: str
    email_provider: str
    stripe_configured: bool
    calendly_configured: bool


class PaymentStatusResponse(BaseModel):
    ok: bool = True
    status: str
    reference: Optional[str] = None
    amount_aud: Optional[float] = None
    currency: Optional[str] = None
