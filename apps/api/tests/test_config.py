from app.config import Settings, _normalize_app_env


def test_normalize_aliases():
    assert _normalize_app_env("prod") == "production"
    assert _normalize_app_env("stage") == "staging"
    assert _normalize_app_env("dev") == "development"
    assert _normalize_app_env("local") == "development"
    assert _normalize_app_env("") == "development"


def test_environment_flags(monkeypatch):
    monkeypatch.setenv("APP_ENV", "staging")
    settings = Settings()
    assert settings.is_staging is True
    assert settings.is_development is False
    assert settings.is_production is False
    assert settings.is_deployed is True
    assert settings.expose_error_details is False
    assert settings.environment_label == "staging"


def test_production_flags(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    settings = Settings()
    assert settings.is_production is True
    assert settings.is_deployed is True
    assert settings.expose_error_details is False
    assert settings.environment_label == "production"


def test_development_flags(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    settings = Settings()
    assert settings.is_development is True
    assert settings.is_deployed is False
    assert settings.expose_error_details is True
    assert settings.environment_label == "development"


def test_deployed_default_sqlite_path(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("APP_ENV", "staging")
    settings = Settings()
    assert settings.sqlite_path == "/app/data/debra_api.sqlite3"


def test_local_default_sqlite_path(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("APP_ENV", "development")
    settings = Settings()
    assert settings.sqlite_path == "./data/debra_api.sqlite3"
