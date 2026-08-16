import asyncio
from unittest.mock import MagicMock

from app.config import get_settings
from app.main import handle_unexpected


def _request() -> MagicMock:
    request = MagicMock()
    request.url.path = "/api/contact"
    return request


def test_development_exposes_exception_detail(isolated_env):
    response = asyncio.run(handle_unexpected(_request(), RuntimeError("secret-leak")))
    body = response.body.decode()
    assert response.status_code == 500
    assert "secret-leak" in body
    assert "RuntimeError" in body


def test_staging_hides_exception_detail(isolated_env, monkeypatch):
    monkeypatch.setenv("APP_ENV", "staging")
    get_settings.cache_clear()
    response = asyncio.run(handle_unexpected(_request(), RuntimeError("secret-leak")))
    body = response.body.decode()
    assert response.status_code == 500
    assert "secret-leak" not in body
    assert "Something went wrong" in body


def test_production_hides_exception_detail(isolated_env, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    get_settings.cache_clear()
    response = asyncio.run(handle_unexpected(_request(), RuntimeError("secret-leak")))
    body = response.body.decode()
    assert response.status_code == 500
    assert "secret-leak" not in body
    assert "Something went wrong" in body
