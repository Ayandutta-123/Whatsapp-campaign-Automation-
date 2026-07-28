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
