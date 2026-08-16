"""Shared fixtures. Isolate settings and SQLite from the local .env / data file."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings


@pytest.fixture
def isolated_env(tmp_path, monkeypatch):
    db_file = tmp_path / "test.sqlite3"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file.as_posix()}")
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:3000")
    get_settings.cache_clear()
    yield tmp_path
    get_settings.cache_clear()


@pytest.fixture
def client(isolated_env):
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


def make_client(monkeypatch, tmp_path, **env: str) -> TestClient:
    db_file = tmp_path / "test.sqlite3"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file.as_posix()}")
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:3000")
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()
    from app.main import app

    return TestClient(app)
