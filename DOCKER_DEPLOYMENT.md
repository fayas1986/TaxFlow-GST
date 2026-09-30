# TaxFlow Production Docker Deployment Strategy

This document outlines the containerization, Docker Compose configuration, and database migration workflow for TaxFlow.

## 1. Container Strategy Overview

TaxFlow utilizes a **Multi-Target Docker Architecture** sharing a single core repository for both API service and background workers:

```
                  ┌────────────────────────┐
                  │   Docker Multi-Stage   │
                  │       Build Engine     │
                  └───────────┬────────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
   ┌──────────────────────┐      ┌──────────────────────┐
   │  Target: api-server  │      │ Target: worker-node  │
   │  (NestJS HTTP API)   │      │ (BullMQ Async Jobs)  │
   └──────────────────────┘      └──────────────────────┘
```

- **React Frontend**: Deployed on Vercel (NOT containerized in Docker).
- **PostgreSQL / Neon**: External cloud database in production; local PostgreSQL container in development.
- **Redis**: Local container for development; Redis Cloud / ElastiCache in production.

---

## 2. Multi-Target Dockerfile (`backend/Dockerfile`)

```dockerfile
# ==========================================
# Base Stage: Install Dependencies
# ==========================================
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-dependencies --clear-cache openssl libc6-compat
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

# ==========================================
# Build Stage: Compile NestJS App
# ==========================================
FROM base AS builder
WORKDIR /app
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

# ==========================================
# Target Stage: NestJS HTTP API
# ==========================================
FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-dependencies --clear-cache openssl libc6-compat
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]

# ==========================================
# Target Stage: BullMQ Background Worker
# ==========================================
FROM node:22-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-dependencies --clear-cache openssl libc6-compat
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

USER node
CMD ["node", "dist/worker.main.js"]
```

---

## 3. Local Development `docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: taxflow-postgres
    environment:
      POSTGRES_USER: taxflow
      POSTGRES_PASSWORD: taxflow_dev_secret
      POSTGRES_DB: taxflow_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U taxflow -d taxflow_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: taxflow-redis
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: api
    container_name: taxflow-api
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: "postgresql://taxflow:taxflow_dev_secret@postgres:5432/taxflow_db?schema=public"
      REDIS_HOST: "redis"
      REDIS_PORT: "6379"
      JWT_SECRET: "super_secret_jwt_key_development_only"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: worker
    container_name: taxflow-worker
    environment:
      DATABASE_URL: "postgresql://taxflow:taxflow_dev_secret@postgres:5432/taxflow_db?schema=public"
      REDIS_HOST: "redis"
      REDIS_PORT: "6379"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  pgdata:
  redisdata:
```

---

## 4. Database Migration Workflow (Controlled Deployment Step)

CRITICAL REQUIREMENT: **Do NOT run `prisma migrate` automatically on container boot up.**

### Production Controlled Migration Steps:

1. **Pre-Deployment Migration Job**:
   Before deploying new API / worker containers, execute a controlled one-off migration task in CI/CD pipeline:
   ```bash
   npx prisma migrate deploy
   ```
2. **Schema Verification**:
   Verify database connectivity and schema sync status:
   ```bash
   npx prisma status
   ```
3. **Rolling Container Update**:
   Deploy updated `api` and `worker` container image versions to production clusters.
