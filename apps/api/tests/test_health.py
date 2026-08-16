from app.config import get_settings


def test_health_schema_is_public_only(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "ok": True,
        "service": "debra-api",
        "environment": "development",
    }
    for leaked in (
        "email_provider",
        "stripe_configured",
        "calendly_configured",
        "calendly_api_configured",
        "resend_api_key",
        "stripe_secret_key",
    ):
        assert leaked not in body


def test_health_reports_staging(isolated_env, monkeypatch):
    monkeypatch.setenv("APP_ENV", "staging")
    get_settings.cache_clear()
    from app.main import app
    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        body = client.get("/api/health").json()
    assert body["environment"] == "staging"
    assert body["ok"] is True
    assert "stripe_configured" not in body


def test_health_reports_production(isolated_env, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    get_settings.cache_clear()
    from app.main import app
    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        body = client.get("/api/health").json()
    assert body["environment"] == "production"
    assert set(body.keys()) == {"ok", "service", "environment"}
