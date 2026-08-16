"""Serve the static frontend from apps/web without shadowing /api/*.

Used in the single-container production image. Local development still uses
the Node static server on port 3000; this module is harmless if that server
is the one receiving browser traffic.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from urllib.parse import unquote

from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

_HTML_EXTS = {".html"}
_CODE_EXTS = {".js", ".css"}
_ASSET_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".woff", ".woff2"}

logger = logging.getLogger("debra-api.static")

_API_PREFIXES = ("api", "api/")


def resolve_web_root() -> Path | None:
    """Locate the static frontend directory.

    Order:
    1. WEB_ROOT environment variable
    2. Sibling ``web`` next to the API package (container: /app/web)
    3. Repository layout: <repo>/apps/web
    """
    env_root = os.getenv("WEB_ROOT", "").strip()
    candidates: list[Path] = []
    if env_root:
        candidates.append(Path(env_root))

    api_dir = Path(__file__).resolve().parents[1]  # .../apps/api or /app
    candidates.append(api_dir / "web")
    candidates.append(api_dir.parent / "web")  # repo/apps/web
    candidates.append(Path("/app/web"))

    seen: set[Path] = set()
    for raw in candidates:
        try:
            resolved = raw.resolve()
        except OSError:
            continue
        if resolved in seen:
            continue
        seen.add(resolved)
        if resolved.is_dir() and (resolved / "index.html").is_file():
            return resolved
    return None


def _is_api_path(url_path: str) -> bool:
    trimmed = url_path.lstrip("/")
    return trimmed == "api" or trimmed.startswith("api/")


def _safe_file(web_root: Path, url_path: str) -> Path | None:
    raw = unquote((url_path or "/").split("?", 1)[0])
    if "\x00" in raw:
        return None

    root = web_root.resolve()
    relative = raw.lstrip("/").replace("\\", "/")
    if relative in ("", "."):
        candidate = root / "index.html"
    else:
        candidate = root / relative

    try:
        resolved = candidate.resolve(strict=False)
        resolved.relative_to(root)
    except (ValueError, OSError):
        return None

    if resolved.is_dir():
        index = resolved / "index.html"
        return index if index.is_file() else None

    if resolved.is_file():
        return resolved

    # Clean-URL fallback: /about -> about.html
    html_candidate = Path(str(resolved) + ".html")
    try:
        html_resolved = html_candidate.resolve(strict=False)
        html_resolved.relative_to(root)
    except (ValueError, OSError):
        return None
    if html_resolved.is_file():
        return html_resolved
    return None


def _cache_headers(path: Path) -> dict[str, str]:
    ext = path.suffix.lower()
    if ext in _HTML_EXTS:
        # HTML must not be cached by browsers or Coolify/Traefik. A stale
        # contact.html without the phone field posts to an API that requires it.
        return {"Cache-Control": "no-store"}
    if ext in _CODE_EXTS:
        return {"Cache-Control": "no-cache, must-revalidate"}
    if ext in _ASSET_EXTS:
        return {"Cache-Control": "public, max-age=86400"}
    return {"Cache-Control": "no-cache"}


def _file_response(path: Path, status_code: int = 200) -> FileResponse:
    media_type = "text/html" if path.suffix.lower() in _HTML_EXTS else None
    return FileResponse(
        path,
        status_code=status_code,
        media_type=media_type,
        headers=_cache_headers(path),
    )


def _not_found(web_root: Path) -> FileResponse | HTMLResponse:
    custom = web_root / "404.html"
    if custom.is_file():
        return _file_response(custom, status_code=404)
    return HTMLResponse(
        "Not found",
        status_code=404,
        headers={"Cache-Control": "no-store"},
    )


def register_frontend(app: FastAPI) -> Path | None:
    """Attach GET/HEAD static routes. Returns the resolved web root, or None."""
    web_root = resolve_web_root()
    if web_root is None:
        logger.warning("Frontend web root not found; static pages will not be served")
        return None

    logger.info("Serving frontend from %s", web_root)

    async def serve_path(url_path: str):
        if _is_api_path(url_path):
            return JSONResponse(
                status_code=404,
                content={"ok": False, "error": "not_found"},
            )
        found = _safe_file(web_root, url_path)
        if found is None:
            return _not_found(web_root)
        return _file_response(found)

    @app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
    async def serve_home():
        return _file_response(web_root / "index.html")

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def serve_page(full_path: str):
        return await serve_path(full_path)

    return web_root
