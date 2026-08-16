from app.static_frontend import _safe_file, resolve_web_root


def test_homepage_served(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert "Debra Wylde" in response.text
    assert response.headers.get("cache-control") == "no-store"


def test_contact_page_includes_required_phone(client):
    response = client.get("/contact.html")
    assert response.status_code == 200
    assert 'id="ct-phone"' in response.text
    assert "Phone Number" in response.text
    assert response.headers.get("cache-control") == "no-store"


def test_html_pages_served(client):
    for path in (
        "/about.html",
        "/assessment.html",
        "/program.html",
        "/contact.html",
        "/discovery-call.html",
        "/financial-forecast.html",
        "/pay-online.html",
        "/payment-success.html",
        "/payment-cancelled.html",
    ):
        response = client.get(path)
        assert response.status_code == 200, path
        assert "text/html" in response.headers.get("content-type", "")


def test_clean_url_serves_html(client):
    response = client.get("/about")
    assert response.status_code == 200
    assert "Debra" in response.text


def test_css_and_image_assets(client):
    css = client.get("/src/css/styles.css")
    assert css.status_code == 200
    assert "css" in css.headers.get("content-type", "")

    image = client.get("/public/images/Logo.png")
    assert image.status_code == 200
    assert image.headers.get("content-type", "").startswith("image/")


def test_unknown_frontend_route_uses_custom_404(client):
    response = client.get("/this-page-does-not-exist")
    assert response.status_code == 404
    assert "Page Not Found" in response.text
    assert "text/html" in response.headers.get("content-type", "")


def test_unknown_api_route_returns_json_not_html(client):
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    body = response.json()
    assert body["ok"] is False
    assert body["error"] == "not_found"
    assert "Page Not Found" not in response.text


def test_api_health_not_shadowed_by_static(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["service"] == "debra-api"


def test_key_api_routes_remain_registered(client):
    paths = {getattr(route, "path", None) for route in client.app.routes}
    assert "/api/health" in paths
    assert "/api/contact" in paths
    assert "/api/discovery-call" in paths
    assert "/api/calendly/booking" in paths
    assert "/api/newsletter/subscribe" in paths
    assert "/api/assessment" in paths
    assert "/api/payments/create-checkout-session" in paths
    assert "/api/stripe/webhook" in paths


def test_path_traversal_rejected():
    web_root = resolve_web_root()
    assert web_root is not None
    assert _safe_file(web_root, "../.env") is None
    assert _safe_file(web_root, "../../apps/api/.env") is None
