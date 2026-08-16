"""Start the FastAPI app using apps/api/.venv when available."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_DIR = ROOT / "apps" / "api"


def resolve_python() -> Path:
    candidates = [
        API_DIR / ".venv" / "Scripts" / "python.exe",
        API_DIR / ".venv" / "bin" / "python",
    ]
    for path in candidates:
        if path.exists():
            return path
    return Path(sys.executable)


def main() -> int:
    if not API_DIR.exists():
        print(f"API directory not found: {API_DIR}", file=sys.stderr)
        return 1

    python = resolve_python()
    if python == Path(sys.executable) and not (API_DIR / ".venv").exists():
        print(
            "Warning: apps/api/.venv not found. Using the current Python interpreter.\n"
            "Create the venv with:\n"
            "  cd apps/api && python -m venv .venv && "
            ".venv/Scripts/pip install -r requirements.txt",
            file=sys.stderr,
        )

    env = os.environ.copy()
    cmd = [
        str(python),
        "-m",
        "uvicorn",
        "app.main:app",
        "--reload",
        "--port",
        "8000",
    ]
    return subprocess.call(cmd, cwd=str(API_DIR), env=env)


if __name__ == "__main__":
    raise SystemExit(main())
