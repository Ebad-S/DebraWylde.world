# Debra Wylde API (FastAPI)

Phase 1 backend for the Debra Wylde website: lead capture (contact, discovery
call, newsletter, assessment) plus an env-guarded Stripe payment flow. Built with
FastAPI and SQLite, with env-driven email (console or Resend) and a development
redirect guard so real inboxes are never hit before a verified sending domain
exists.

## Stack

- FastAPI + Uvicorn
- SQLite (standard library `sqlite3`, no ORM)
- Pydantic v2 for validation
- Resend (via HTTP API) for email, optional and env-driven
- Stripe-hosted Checkout, optional and env-driven

## Project layout

```txt
apps/api/
  app/
    main.py            # app wiring, CORS, exception handlers
    config.py          # env-driven settings
    db.py              # sqlite connection + schema init
    models.py          # data-access helpers
    schemas.py         # Pydantic request/response models
    email_service.py   # console/resend send + dev redirect + email_logs
    stripe_service.py  # checkout session + webhook verification
    security.py        # honeypot, rate limiting, IP hashing
    routes/
      health.py contact.py discovery.py newsletter.py
      assessment.py payments.py stripe_webhook.py
  data/.gitkeep        # SQLite file lives here (gitignored)
  requirements.txt
  Dockerfile
  .env.example
```

## Local development

```bash
cd apps/api
python -m venv .venv
# Windows (bash):   source .venv/Scripts/activate
# macOS/Linux:      source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then edit values as needed
uvicorn app.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/api/health`.

Use `EMAIL_PROVIDER=console` during development so no real email is sent; all
payloads are logged and recorded in the `email_logs` table.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/health` | Service + configuration status |
| POST | `/api/contact` | Contact enquiry |
| POST | `/api/discovery-call` | Discovery call request |
| POST | `/api/newsletter/subscribe` | Newsletter signup (upsert) |
| POST | `/api/assessment` | Alignment Assessment submission (free) |
| POST | `/api/payments/create-checkout-session` | Stripe Checkout session (503 if unconfigured) |
| POST | `/api/stripe/webhook` | Stripe webhook receiver (signature verified) |
| GET  | `/api/payments/status/{session_id}` | Non-sensitive payment status |

All public form endpoints support a `website` honeypot field, optional
`source`/`page` metadata, are length-limited, and are rate limited per IP+path.

## Database

- SQLite file at the path in `DATABASE_URL` (default `./data/debra_api.sqlite3`).
- Tables: `leads`, `assessment_submissions`, `newsletter_subscribers`,
  `payment_records`, `email_logs`.
- Schema is created idempotently on startup (`CREATE TABLE IF NOT EXISTS`); there
  is no separate migration tool.

## Email modes

- `console`: payloads logged only (safe default).
- `resend`: sends through the Resend HTTP API using `RESEND_API_KEY` and
  `RESEND_FROM_EMAIL`.
- `EMAIL_TEST_REDIRECT=true`: regardless of provider, every message is sent only
  to `EMAIL_TEST_REDIRECT_TO`, with the intended recipient shown in the body.

## Stripe

- Fully disabled until `STRIPE_SECRET_KEY`, `STRIPE_SUCCESS_URL`, and
  `STRIPE_CANCEL_URL` are set. While disabled, the create-session endpoint
  returns `503 payment_not_configured` and the Pay Online page stays inactive.
- Uses Stripe-hosted Checkout. No card data touches this server or the browser.
- The webhook verifies the Stripe signature and processes
  `checkout.session.completed` idempotently. Set `STRIPE_WEBHOOK_SECRET`.

## Deployment (Coolify)

See `deployment/coolify/README.md` for the full two-resource setup (static
frontend + this API) and the Traefik `/api/*` path-routing notes. In short:

- Base directory: `apps/api`, build from the `Dockerfile`, expose port `8000`.
- Mount a persistent volume at `/app/data` for the SQLite file.
- Set all env vars from `.env.example` in the Coolify UI (never commit real
  secrets).
- Route the preview host `/api/*` to this service and `/` to the static
  frontend.

## Notes / limitations

- The rate limiter is in-process (per worker). For multi-instance scale, replace
  it with a shared store (for example Redis).
- Run a single Uvicorn worker (the default here) so the in-process limiter and
  SQLite writes behave predictably on a small VPS.
