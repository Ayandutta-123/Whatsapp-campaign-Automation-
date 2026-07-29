# Deploy On-Prem (Docker)

Production deployment: **Docker image on your server** + **local PostgreSQL** in Docker. No cloud database required.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              YOUR ON-PREM SERVER                    │
│                                                     │
│  ┌─────────────────┐      ┌─────────────────────┐  │
│  │  App container  │─────►│  Postgres container │  │
│  │  :3001          │      │  (internal only)    │  │
│  │  • API + React  │      └─────────────────────┘  │
│  │  • /webhook     │                               │
│  └────────┬────────┘                               │
│           │                                         │
│     Team browsers / Meta webhook                    │
└─────────────────────────────────────────────────────┘
```

Tables are created automatically on first app start (`server/index.js`) — no SQL files to run.

---

## Files in this project

| File | Purpose |
|------|---------|
| `Dockerfile` | How to build the app image |
| `docker-compose.yml` | Runs app + Postgres (one file for dev and prod) |
| `.env` | Secrets and config (create from `.env.example`) |

---

## Step 1 — Configure `.env`

On the server, copy and edit:

```bash
cp .env.example .env
```

```env
PORT=3001
NODE_ENV=production

POSTGRES_PASSWORD=your_strong_db_password
DATABASE_URL=postgresql://whatsapp_user:your_strong_db_password@postgres:5432/whatsapp_db
DATABASE_SSL=false

JWT_SECRET=your_long_random_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourSecurePassword

APP_PUBLIC_URL=https://whatsapp.yourcompany.com
```

Use the **same password** for `POSTGRES_PASSWORD` and in `DATABASE_URL`.

`APP_PUBLIC_URL` must be the URL your team uses to open the app (needed for header images and Meta webhooks).

### If the UI is served from a different domain than the API

The default deploy serves the UI and the API from the same container and port, so
the browser calls `/api` on its own origin and no CORS setup is needed.

Only when a reverse proxy or separate host serves the UI on another domain, set both:

```env
# API allows this browser origin (comma-separated list, or * for any)
CORS_ORIGINS=https://whatsapp-campaign-automation.app.knowerai.com

# UI is built to call this API URL instead of its own origin
VITE_API_BASE_URL=https://api.yourcompany.com
```

`VITE_API_BASE_URL` is baked in when the client is built, so **rebuild the image**
after changing it (`docker compose build app`). `CORS_ORIGINS` is read at server
start, so a restart is enough.

Optional on-prem paths (defaults work with Docker volumes):

```bash
# META_GRAPH_VERSION=v21.0
# UPLOADS_DIR=/var/lib/whatsapp-automation/uploads
# BACKUPS_DIR=/var/lib/whatsapp-automation/backups
# META_APP_SECRET=...   # also used to auto-detect Meta App ID for image uploads
```

---

## Step 2 — Build and push image (your build machine)

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) or Docker on Linux.

```bash
cd /path/to/Whatsapp-automation

docker login

docker compose build app
docker compose push app
```

---

## Step 3 — Deploy on the server

### Install Docker

Ubuntu/Debian:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in
```

### Copy files to the server

You only need these on the server:

- `docker-compose.yml`
- `.env`

```bash
scp docker-compose.yml .env user@YOUR-SERVER-IP:/opt/whatsapp/
```

### Start

```bash
cd /opt/whatsapp

docker login
docker compose pull
docker compose up -d
```

Check logs:

```bash
docker compose logs -f app
```

You should see: `Database initialized` then `Server running on port 3001`.

Open: **https://whatsappcampaignautomation.app.hyperthink.com**

---

## Step 4 — After first deploy

1. Log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env`
2. **Settings** → WhatsApp token, Phone Number ID, WABA ID, App ID
3. **Settings** → Public App URL (same as `APP_PUBLIC_URL`)
4. **Settings** → Test Connection
5. Meta Developer Console → webhook: `https://whatsappcampaignautomation.app.hyperthink.com/webhook`

---

## Persistent data (Docker volumes)

| Volume | Stores |
|--------|--------|
| `postgres_data` | All database records |
| `uploads_data` | Template header images (`/app/uploads/headers/`) |
| `backups_data` | JSON backups from Settings |

Data survives container restarts and image updates.

---

## Update to a new version

**Build machine:**

```bash
docker compose build app
docker compose push app
```

**Server:**

```bash
docker compose pull
docker compose up -d
```

---

## Troubleshooting

### `blocked by CORS policy` / requests going to `localhost:3001`

The UI was built with a hardcoded API URL. Check the failing request in the browser
Network tab:

| Request URL | Cause | Fix |
|---|---|---|
| `http://localhost:3001/api/...` | Stale client build baked in a dev URL | Rebuild with `VITE_API_BASE_URL` empty: `docker compose build app --no-cache` |
| Your API domain, but blocked | Origin not allowed by the API | Add the UI origin to `CORS_ORIGINS` in `.env`, then `docker compose up -d` |

The UI and API are meant to share one origin — leaving `VITE_API_BASE_URL` empty is
the correct setting for the standard deploy.

---

## Useful commands

```bash
# Status
docker compose ps

# Logs
docker compose logs -f

# Stop
docker compose down

# Stop and delete database (destructive)
docker compose down -v
```

---

## Local development (optional)

Run Postgres in Docker, app with npm:

```bash
cp .env.example .env
# For dev, use localhost in DATABASE_URL:
# DATABASE_URL=postgresql://whatsapp_user:PASSWORD@localhost:5432/whatsapp_db

docker compose up postgres -d
npm run install:all
npm run dev                   # UI :5173 + API :3001
```

---

## Database tables (auto-created)

| Table | Purpose |
|-------|---------|
| `contacts` | Contact list |
| `templates` | WhatsApp templates |
| `campaigns` | Campaigns and stats |
| `message_logs` | Per-message delivery status |
| `settings` | App config, WhatsApp credentials |
| `sender_numbers` | Multi-country phone numbers |

Defined in `server/index.js` → `initDB()`.

---

## API endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/auth/login` | Login |
| `/api/contacts` | Contacts CRUD + Excel import/export |
| `/api/templates` | Templates + Meta submit |
| `/api/campaigns` | Campaigns + send |
| `/api/settings` | WhatsApp config, backups, password |
| `/api/senders` | Multi-country phone numbers |
| `/api/dashboard` | Stats, charts, message logs |
| `/webhook` | Meta delivery status |
