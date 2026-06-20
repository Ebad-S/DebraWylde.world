# Deployment

Configuration and scripts for deploying DebraWylde.world.

## Hosting

- **Provider:** Vultr VPS
- **Platform:** Coolify
- **Domain:** DebraWylde.world (registered via GoDaddy)

## Directory Structure

```
deployment/
├── coolify/      # Coolify deployment configuration
├── nginx/        # Reverse proxy configuration (optional)
└── scripts/      # Deployment and maintenance scripts
```

## Phase 1 topology (two Coolify resources)

- Resource 1: static frontend, base directory `apps/web`, served at `/`.
- Resource 2: FastAPI backend, base directory `apps/api`, Dockerfile, port `8000`,
  persistent volume at `/app/data` for SQLite.
- The preview host routes `/` to the frontend and `/api/*` to the backend.

Full step-by-step setup, env vars, and Traefik path-routing notes are in
[`coolify/README.md`](./coolify/README.md). Backend specifics are in
[`apps/api/README.md`](../apps/api/README.md).

## Status

Backend (Phase 1) is implemented and ready to deploy. Production go-live still
depends on the blockers listed in the implementation report (DNS/Resend domain,
real sender + notification email, Calendly URL, and Stripe keys/webhook).
