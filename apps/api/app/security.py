"""Lightweight security helpers: honeypot, rate limiting, and IP hashing.

The rate limiter is a simple in-process sliding window keyed by client IP and
path. It is intentionally dependency-free and sufficient for a low-traffic
single-instance deployment. For multi-instance scaling this should be replaced
with a shared store (documented in the README).
"""

import hashlib
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Optional, Tuple

from fastapi import Request

from .config import get_settings


class SpamDetected(Exception):
    """Raised when a honeypot field is filled in."""


class RateLimited(Exception):
    """Raised when a client exceeds the allowed request rate."""


_hits: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)


def get_client_ip(request: Request) -> str:
    """Best-effort client IP, honouring a single proxy hop via X-Forwarded-For."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def hash_ip(ip: str) -> str:
    settings = get_settings()
    digest = hashlib.sha256((settings.ip_hash_salt + "|" + ip).encode("utf-8"))
    return digest.hexdigest()[:32]


def check_honeypot(value: Optional[str]) -> None:
    if value and value.strip():
        raise SpamDetected()


def enforce_rate_limit(request: Request, bucket: str) -> None:
    settings = get_settings()
    max_hits = settings.rate_limit_max
    window = settings.rate_limit_window_seconds
    if max_hits <= 0:
        return

    ip = get_client_ip(request)
    key = (ip, bucket)
    now = time.time()
    hits = _hits[key]

    while hits and now - hits[0] > window:
        hits.popleft()

    if len(hits) >= max_hits:
        raise RateLimited()

    hits.append(now)


def reset_rate_limits() -> None:
    """Test helper to clear the in-memory rate-limit state."""
    _hits.clear()
