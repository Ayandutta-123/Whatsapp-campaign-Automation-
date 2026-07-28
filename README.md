# HyperThink WhatsApp Campaign App

Full-stack WhatsApp campaign automation for on-prem deployment: React UI, Express API, and PostgreSQL.

## Quick Start (development)

```bash
cp .env.example .env
# Edit .env: DATABASE_URL host → localhost for local Postgres
docker compose up postgres -d
npm run install:all
npm run dev
```

- **UI:** http://localhost:5173 (API calls use relative `/api` — proxied to the backend)
- **Production:** `npm run build && npm start` → single port (`PORT`, default 3001)

## Production (on-prem Docker)

See **[DEPLOY.md](./DEPLOY.md)**:

1. Build and push the app image (or copy the project to the server)
2. `docker compose up -d`
3. Open the app URL and configure WhatsApp in **Settings**

## Environment Variables

Root `.env` (see `.env.example`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_SSL` | `false` for on-prem Postgres |
| `APP_PUBLIC_URL` | Public URL for Meta webhooks and template images |
| `JWT_SECRET` | Auth token signing |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Initial admin login |

**Docker Compose:** use host `postgres` in `DATABASE_URL`.  
**Local dev Postgres:** use host `localhost`.

## API paths

The frontend uses **relative URLs** (`/api/...`). No hardcoded hostnames — works on localhost (dev proxy) and on-prem (same origin).

## Webhook

In Meta Developer Console, set webhook URL to:

`https://your-public-domain/webhook`

Use the same base URL as **Public App URL** in Settings.
