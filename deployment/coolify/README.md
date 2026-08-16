# Coolify Deployment - DebraWylde.world

One Coolify application. One container. FastAPI serves `/api/*` and the static
frontend from `apps/web`.

Preview host: `https://debra.preview.serenity-webcrafts.com.au`

Later production host: `https://debrawylde.world`

```text
Coolify / Traefik
        |
        v
public HTTPS origin
        |
        v
ONE container (root Dockerfile)
        |
        +-- FastAPI / Uvicorn
              |
              +-- /api/*
              |
              +-- static apps/web frontend
```

Local development is unchanged: `npm run dev` still runs the Node static server
on port 3000 and the API on port 8000 via `concurrently`. Do not use
`concurrently` in production.

---

## Coolify application

Create **one** Dockerfile application (not two resources, not Docker Compose).

| Field | Value |
|---|---|
| Application type | Dockerfile |
| Repository | `Ebad-S/DebraWylde.world` |
| Branch | `main` |
| Base Directory | `/` |
| Dockerfile | `/Dockerfile` |
| Port | `8000` |
| Health Check Path | `/api/health` |
| Domain (staging) | `https://debra.preview.serenity-webcrafts.com.au` |

Coolify/Traefik only needs to route the host to this container on port 8000.
No `/api` path-split and no second static-site resource.

Run a **single instance / single worker**. The rate limiter is in-process and
SQLite is single-writer.

---

## Persistent storage

Mount a Coolify persistent volume at:

```text
/app/data
```

Set:

```text
DATABASE_URL=sqlite:////app/data/debra_api.sqlite3
```

That file is `debra_api.sqlite3` inside the volume. Without this mount, SQLite
lives on the container filesystem and is **lost on every redeploy**.

Do not commit database files.

---

## Staging environment variables

Set these in the Coolify UI. Never commit real values. Placeholders only below.

### Core

```text
APP_ENV=staging
SITE_BASE_URL=https://debra.preview.serenity-webcrafts.com.au
ALLOWED_ORIGINS=https://debra.preview.serenity-webcrafts.com.au
PORT=8000
```

`APP_ENV=staging` is required. Staging is not development: health reports
`"environment": "staging"`, errors stay generic, and localhost CORS is off.

### Database

```text
DATABASE_URL=sqlite:////app/data/debra_api.sqlite3
```

### Resend

```text
EMAIL_PROVIDER=resend
EMAIL_TEST_REDIRECT=false
EMAIL_TEST_REDIRECT_TO=
INTERNAL_NOTIFICATION_EMAIL=hello@debrawylde.world
RESEND_API_KEY=<secret>
RESEND_FROM_EMAIL=<verified staging sender, e.g. Debra Wylde <hello@debrawylde.world>>
RESEND_AUDIENCE_ID=<optional>
RESEND_CONTACT_INTERNAL_TEMPLATE=a1c62180-ab37-4cd9-82e0-e3b8f2d1e935
RESEND_CONTACT_CLIENT_TEMPLATE=f4a78c5b-f30a-4068-b1fb-62359ef8c933
```

Use the currently verified Resend sender/domain available for preview testing.
Leave `EMAIL_PROVIDER=console` only if you want log-only mail on preview.

### Calendly

```text
CALENDLY_URL=https://calendly.com/debrawylde/30min
CALENDLY_API_TOKEN=<secret, optional>
```

The live embed is on `discovery-call.html`. The token is only used to include
invitee name/notes on the internal booking email.

### Stripe (TEST / sandbox on preview)

```text
STRIPE_SECRET_KEY=<sk_test_...>
STRIPE_WEBHOOK_SECRET=<whsec_... for the staging endpoint>
STRIPE_CURRENCY=aud
STRIPE_MIN_AMOUNT_CENTS=5000
STRIPE_MAX_AMOUNT_CENTS=500000
STRIPE_SUCCESS_URL=https://debra.preview.serenity-webcrafts.com.au/payment-success.html?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://debra.preview.serenity-webcrafts.com.au/payment-cancelled.html
```

Do not put live Stripe keys on preview.

Staging webhook URL to configure in the Stripe Dashboard (test mode):

```text
https://debra.preview.serenity-webcrafts.com.au/api/stripe/webhook
```

Event: `checkout.session.completed` only (Your account).

### Security

```text
IP_HASH_SALT=<random-string>
RATE_LIMIT_MAX=8
RATE_LIMIT_WINDOW_SECONDS=300
MAX_PAYLOAD_BYTES=65536
```

---

## Production cutover

When moving from `debra.preview.serenity-webcrafts.com.au` to `debrawylde.world`,
change at least:

```text
APP_ENV=production
SITE_BASE_URL=https://debrawylde.world
ALLOWED_ORIGINS=https://debrawylde.world
STRIPE_SECRET_KEY=<sk_live_...>
STRIPE_WEBHOOK_SECRET=<whsec_... for the live endpoint>
STRIPE_SUCCESS_URL=https://debrawylde.world/payment-success.html?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://debrawylde.world/payment-cancelled.html
RESEND_FROM_EMAIL=<verified production sender on debrawylde.world>
```

Production Stripe webhook URL (live mode, separate endpoint and secret):

```text
https://debrawylde.world/api/stripe/webhook
```

Also:

- Point DNS for `debrawylde.world` (and `www` if used) at Coolify
- Issue TLS for the live domain
- Verify the Resend sending domain for `debrawylde.world`
- Keep `CALENDLY_URL` unless the production event link changes
- Replace `og:url` / `og:image` / canonical tags from the preview host to
  `https://debrawylde.world/...` (frontend SEO, not an API setting)
- Generate a new `IP_HASH_SALT` if the staging value was ever shared

There is no Stripe publishable/client key in this application. Checkout sessions
are created on the server.

---

## Health check

```bash
curl https://debra.preview.serenity-webcrafts.com.au/api/health
```

Expected staging body:

```json
{"ok": true, "service": "debra-api", "environment": "staging"}
```

Expected production body:

```json
{"ok": true, "service": "debra-api", "environment": "production"}
```

The public health endpoint does **not** report email, Stripe, or Calendly
configuration. Those details are written to container logs on startup only.

---

## Post-deploy smoke test

1. `GET /` returns the homepage
2. `GET /about.html` (and other pages) return 200
3. `GET /src/css/styles.css` and `/public/images/Logo.png` return 200
4. `GET /api/health` returns the JSON above
5. `GET /api/does-not-exist` returns JSON 404, not HTML
6. Submit the contact form
7. Complete a Stripe test checkout and confirm the webhook shows `2xx`
