# Docker — Build & Deploy

Optimized **multi-stage** image: builds React UI, ships only production Node deps + `server/` + `client/dist`. Final image runs as non-root user.

---

## Image size optimizations

- Multi-stage build (client deps → client build → server deps → runtime)
- `npm ci --omit=dev` (no nodemon/concurrently in production image)
- `.dockerignore` excludes `node_modules`, `.env`, uploads, docs
- Alpine-based `node:20-alpine`
- Built-in `/health` endpoint for container health checks

---

## 1. Build on your Mac (or CI)

```bash
cd "/Users/hyperthink/Desktop/Whatsapp automation"

# Replace with your Docker Hub username
export DOCKER_IMAGE=yourdockerhubuser/hyperthink-whatsapp:latest

docker build -t "$DOCKER_IMAGE" .
```

Or:

```bash
DOCKER_IMAGE=yourdockerhubuser/hyperthink-whatsapp:v1.0.0 npm run docker:build
```

**Test locally before push:**

```bash
cp .env.example .env
# Edit .env: POSTGRES_PASSWORD, JWT_SECRET, ADMIN_PASSWORD, APP_PUBLIC_URL

docker compose up -d
# Open http://localhost:3001
```

---

## 2. Push to Docker Hub

```bash
docker login

docker push yourdockerhubuser/hyperthink-whatsapp:latest
```

Or:

```bash
DOCKER_IMAGE=yourdockerhubuser/hyperthink-whatsapp:latest npm run docker:push
```

---

## 3. Deploy on-prem server

Copy to the server:

- `docker-compose.yml`
- `.env` (from `.env.example`, filled in)

On the server `.env`:

```env
DOCKER_IMAGE=yourdockerhubuser/hyperthink-whatsapp:latest
PORT=3001
NODE_ENV=production
POSTGRES_PASSWORD=your_strong_password
DATABASE_URL=postgresql://whatsapp_user:your_strong_password@postgres:5432/whatsapp_db
DATABASE_SSL=false
JWT_SECRET=long_random_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourSecurePassword
APP_PUBLIC_URL=https://whatsapp.yourcompany.com
```

**Pull and run (no source code needed on server):**

```bash
docker login
docker compose pull
docker compose up -d
```

**Check status:**

```bash
docker compose ps
docker compose logs -f app
curl http://localhost:3001/health
```

---

## 4. Useful commands

| Command | Purpose |
|---------|---------|
| `docker compose up -d` | Start app + Postgres |
| `docker compose down` | Stop all services |
| `docker compose logs -f app` | Follow app logs |
| `docker compose pull` | Pull latest image on server |
| `docker compose up -d --force-recreate` | Restart with new image |
| `docker compose build app --no-cache` | Clean rebuild |

---

## 5. Volumes (data persists across restarts)

| Volume | Contents |
|--------|----------|
| `postgres_data` | Database |
| `uploads_data` | Template header images |
| `backups_data` | Settings backups |

---

## 6. Update after code changes

**On build machine:**

```bash
docker build -t yourdockerhubuser/hyperthink-whatsapp:latest .
docker push yourdockerhubuser/hyperthink-whatsapp:latest
```

**On server:**

```bash
docker compose pull
docker compose up -d --force-recreate app
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| App won't start | `docker compose logs app` — often DB not ready or wrong `DATABASE_URL` |
| `connection refused` to Postgres | Wait for postgres healthcheck; use host `postgres` in URL |
| Blank UI | Ensure image was built with `client/dist` (use provided Dockerfile) |
| Health check failing | `curl http://localhost:3001/health` should return `{"ok":true}` |

See also **[DEPLOY.md](./DEPLOY.md)** for full on-prem setup and Meta webhook configuration.
