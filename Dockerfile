# syntax=docker/dockerfile:1

# ── Stage 1: install client dependencies ─────────────────────────────────────
FROM node:20-alpine AS client-deps
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm ci

# ── Stage 2: build React UI ──────────────────────────────────────────────────
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY --from=client-deps /app/client/node_modules ./node_modules
COPY client/ ./
RUN npm run build

# ── Stage 3: install production API dependencies only ───────────────────────
FROM node:20-alpine AS server-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 4: minimal production runtime ───────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001

RUN addgroup -g 1001 -S appgroup \
 && adduser -S appuser -u 1001 -G appgroup

COPY --from=server-deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY --from=client-build /app/client/dist ./client/dist

RUN mkdir -p uploads/headers backups \
 && chown -R appuser:appgroup /app

USER appuser
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3001)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server/index.js"]
