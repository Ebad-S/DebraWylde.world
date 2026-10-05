from pathlib import Path

from app.static_frontend import _safe_file, resolve_web_root

INDEXABLE_PAGES = (
    "/",
    "/about.html",
    "/align-and-thrive.html",
    "/assessment.html",
    "/blog.html",
    "/blog-post.html",
    "/contact.html",
    "/discovery-call.html",
    "/faq.html",
    "/financial-forecast.html",
    "/pay-online.html",
    "/program.html",
)
NOINDEX_PAGES = (
    "/404.html",
    "/payment-success.html",
    "/payment-cancelled.html",
)


def test_homepage_served(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert "Debra Wylde" in response.text
    assert response.headers.get("cache-control") == "no-store"


def test_public_pages_use_production_metadata(client):
    for path in INDEXABLE_PAGES:
        response = client.get(path)
        assert response.status_code == 200, path
        page = response.text.lower()
        assert "debra.preview.serenity-webcrafts.com.au" not in page, path
        assert "noindex" not in page, path
        assert 'rel="canonical"' in page, path
        assert "https://debrawylde.world" in page, path

    for path in NOINDEX_PAGES:
        response = client.get(path)
        assert response.status_code == 200, path
        assert 'name="robots" content="noindex, follow"' in response.text, path
        assert "debra.preview.serenity-webcrafts.com.au" not in response.text.lower(), path

    robots = client.get("/robots.txt")
    assert robots.status_code == 200
    assert "noindex" not in robots.text.lower()
    assert "Sitemap: https://debrawylde.world/sitemap.xml" in robots.text

    sitemap = client.get("/sitemap.xml")
    assert sitemap.status_code == 200
    locations = [
        line.split("<loc>", 1)[1].split("</loc>", 1)[0]
        for line in sitemap.text.splitlines()
        if "<loc>" in line
    ]
    assert len(locations) == len(INDEXABLE_PAGES)
    assert all(location.startswith("https://debrawylde.world") for location in locations)
    assert "debra.preview.serenity-webcrafts.com.au" not in sitemap.text
    for path in NOINDEX_PAGES:
        assert path not in sitemap.text


def test_stripe_callback_examples_use_production_domain():
    repo_root = Path(__file__).resolve().parents[3]
    preview_host = "debra.preview.serenity-webcrafts.com.au"
    config_files = [repo_root / "apps" / "api" / ".env.example"]
    config_files.extend((repo_root / "deployment").rglob("*.md"))
    checked = 0
    for path in config_files:
        for line in path.read_text(encoding="utf-8").splitlines():
            if "STRIPE_SUCCESS_URL" not in line and "STRIPE_CANCEL_URL" not in line:
                continue
            checked += 1
            assert preview_host not in line, f"{path.name}: {line}"
            assert "https://debrawylde.world/payment-" in line, f"{path.name}: {line}"
    assert checked >= 4


def test_contact_page_includes_required_phone(client):
    response = client.get("/contact.html")
    assert response.status_code == 200
    assert 'id="ct-phone"' in response.text
    assert "Phone Number" in response.text
    assert response.headers.get("cache-control") == "no-store"


def test_html_pages_served(client):
    for path in (
        "/about.html",
        "/align-and-thrive.html",
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


def test_align_and_thrive_page_and_qr_asset(client):
    response = client.get("/align-and-thrive.html")
    assert response.status_code == 200
    assert 'id="at-hero-title"' in response.text
    assert "You know you&rsquo;re here to do something big." in response.text
    assert 'href="assessment.html"' in response.text
    assert "contact.html?enquiry=align-and-thrive#contact-form" in response.text
    assert "/public/images/A-n-T_Page_Hero_image.png" in response.text
    assert "/public/images/A-n-T_Page_Sitting_portrait.jpg" in response.text
    assert "/public/images/QR_Code_Scan_to_Pay.PNG" in response.text
    assert 'class="at-registration__qr-link"' in response.text
    assert "buy.stripe.com" in response.text
    assert "Tuesday, 20 October 2026" in response.text
    assert "2026-10-20" in response.text
    assert "Wednesday, 14 October 2026" not in response.text
    assert "2026-10-14" not in response.text
    assert "_Initial_notes_" not in response.text
    assert ".pdf" not in response.text.lower()

    for image_path in (
        "/public/images/QR_Code_Scan_to_Pay.PNG",
        "/public/images/A-n-T_Page_Hero_image.png",
        "/public/images/A-n-T_Page_Sitting_portrait.jpg",
    ):
        image = client.get(image_path)
        assert image.status_code == 200, image_path
        assert image.headers.get("content-type", "").startswith("image/")


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
