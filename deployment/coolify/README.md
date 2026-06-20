# Coolify Deployment - DebraWylde.world

Phase 1 runs as two Coolify resources behind one preview host:

- Resource 1: static frontend (`apps/web`)
- Resource 2: FastAPI backend (`apps/api`)

The preview host serves the static site at `/` and reverse-proxies `/api/*` to
the backend.

Preview host: `debra.preview.serenity-webcrafts.com.au`

## Resource 1: Static frontend

- Type: Static site (or a minimal static file server / Nginx).
- Repository base directory: `apps/web`
- Build: none required (plain HTML/CSS/JS, no build step).
- Publish directory: `apps/web` (serve the folder as-is).
- Domain: the preview host, path `/`.
- Notes:
  - The site uses clean-URL friendly links and a small redirect-detection
    script, so a static server with default index handling works.
  - The frontend calls the API at same-origin `/api` in production. No build-time
    API URL is required. (A `window.DEBRA_API_BASE_URL` override exists only for
    edge cases.)

## Resource 2: FastAPI backend

- Type: Dockerfile.
- Repository base directory: `apps/api`
- Dockerfile: `apps/api/Dockerfile`
- Exposed port: `8000`
- Start command (already in the image):
  `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Persistent storage:
  - Mount a volume at `/app/data` so the SQLite database survives redeploys.
  - `DATABASE_URL=sqlite:///./data/debra_api.sqlite3` resolves to `/app/data`
    when the container runs from `/app`.
- Run a single instance / single worker. The rate limiter is in-process and
  SQLite is single-writer; one worker keeps both predictable on a small VPS.

### Environment variables (set in the Coolify UI, never commit real values)

See `apps/api/.env.example` for the full list with comments. The important ones:

```env
APP_ENV=production
SITE_BASE_URL=https://debra.preview.serenity-webcrafts.com.au
DATABASE_URL=sqlite:///./data/debra_api.sqlite3
ALLOWED_ORIGINS=https://debra.preview.serenity-webcrafts.com.au

EMAIL_PROVIDER=console            # switch to "resend" once a sender is verified
EMAIL_TEST_REDIRECT=true          # keep true until a verified domain exists
EMAIL_TEST_REDIRECT_TO=serenity_tester@proton.me
INTERNAL_NOTIFICATION_EMAIL=serenity_tester@proton.me

RESEND_API_KEY=                   # set when Resend is ready
RESEND_FROM_EMAIL=                # e.g. Debra Wylde <hello@debrawylde.world> after DNS
RESEND_AUDIENCE_ID=               # optional

CALENDLY_URL=                     # leave empty to show the polished fallback

STRIPE_SECRET_KEY=                # leave empty to keep Pay Online inactive (safe 503)
STRIPE_WEBHOOK_SECRET=
STRIPE_CURRENCY=aud
STRIPE_MIN_AMOUNT_CENTS=5000
STRIPE_MAX_AMOUNT_CENTS=500000
STRIPE_SUCCESS_URL=https://debra.preview.serenity-webcrafts.com.au/payment-success.html?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://debra.preview.serenity-webcrafts.com.au/payment-cancelled.html

IP_HASH_SALT=<random-string>
```

## Reverse proxy / path routing (Traefik)

Coolify uses Traefik. The goal is one host where `/api/*` goes to the backend
and everything else goes to the static frontend. Two equivalent options:

### Option A (recommended): path-prefix label on the backend

Attach the same host to both resources and give the backend a higher-priority
path-prefix rule. In the backend resource, add Traefik labels (Coolify lets you
add custom labels per resource):

```yaml
traefik.http.routers.debra-api.rule: Host(`debra.preview.serenity-webcrafts.com.au`) && PathPrefix(`/api`)
traefik.http.routers.debra-api.priority: 100
traefik.http.routers.debra-api.entrypoints: https
traefik.http.routers.debra-api.tls.certresolver: letsencrypt
traefik.http.services.debra-api.loadbalancer.server.port: 8000
```

The static frontend keeps the default `Host(...)` router at normal priority, so
the more specific `/api` rule wins. The backend already serves its routes under
`/api/...`, so no path rewrite/strip is needed.

### Option B: separate API subdomain

If host + path routing is awkward to configure from the repo alone, expose the
backend on its own subdomain, for example `api.debra.preview.serenity-webcrafts.com.au`,
and set the frontend override and CORS accordingly:

- Frontend: define `window.DEBRA_API_BASE_URL = "https://api.debra.preview.serenity-webcrafts.com.au/api"`
  before `src/js/api.js` loads (a small inline snippet per page, or a shared
  config include).
- Backend: add the subdomain to `ALLOWED_ORIGINS` is not needed (the API host is
  not the browser origin); instead ensure the frontend host is in
  `ALLOWED_ORIGINS`.

Manual step required either way: the exact Traefik label placement is configured
in the Coolify UI per resource. If the UI cannot express the host + path rule,
use Option B (subdomain) which Coolify supports natively via the resource domain
field.

## Post-deploy smoke test

```bash
curl https://debra.preview.serenity-webcrafts.com.au/api/health
```

Expect `{"ok": true, "service": "debra-api", ...}`. Then submit the contact form
on the live site and confirm a row appears (and an email is logged/redirected per
the configured mode).
