# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:22-alpine AS builder

# Build tools required to compile better-sqlite3 from source
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./

# Install deps and force-rebuild the native SQLite binding for this platform
RUN npm ci && \
    cd node_modules/better-sqlite3 && \
    npx node-gyp rebuild && \
    cd /app

COPY . .

RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:22-alpine AS runner

RUN apk add --no-cache libstdc++

WORKDIR /app

ENV NODE_ENV=production

# Copy the standalone Next.js output and the native binding
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# Persist the SQLite database outside the container
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["node", "server.js"]
