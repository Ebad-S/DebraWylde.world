# Debra Wylde - single-container production image.
# Serves FastAPI /api/* and the static frontend from apps/web.
FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
    
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    WEB_ROOT=/app/web \
    DATABASE_URL=sqlite:////app/data/debra_api.sqlite3

WORKDIR /app

COPY apps/api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/api/app ./app
COPY apps/web ./web

# Persistent SQLite data. Mount a Coolify volume at /app/data.
RUN mkdir -p /app/data

EXPOSE 8000

# Coolify (and similar platforms) inject PORT. JSON-form CMD cannot interpolate
# it, so a small shell wrapper is required.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
