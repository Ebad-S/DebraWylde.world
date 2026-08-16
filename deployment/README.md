# Deployment

Configuration for deploying DebraWylde.world as **one Coolify application**.

## Hosting

- **Provider:** Vultr VPS
- **Platform:** Coolify
- **Preview:** https://debra.preview.serenity-webcrafts.com.au
- **Production:** https://debrawylde.world

## Topology

One container built from the repository-root `Dockerfile`:

- FastAPI / Uvicorn listens on `0.0.0.0:${PORT:-8000}`
- `/api/*` is the backend
- every other path is the static site from `apps/web`
- SQLite persists at `/app/data` (Coolify volume)

Local `npm run dev` (Node on 3000 + API on 8000 via `concurrently`) is
development-only and is not used in Coolify.

Full Coolify field names, volume path, environment-variable checklist, Stripe
webhook URLs, and production cutover steps:

[`coolify/README.md`](./coolify/README.md)
