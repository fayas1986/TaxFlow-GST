# TaxFlow Production Deployment Guide

## 1. Overview
TaxFlow GST SaaS uses a containerized multi-stage architecture split across NestJS API containers, background worker queues (BullMQ/Redis), PostgreSQL/Neon database layers, and Vite static asset delivery.

---

## 2. Container Configuration & Security Hardening
- **Multi-stage Dockerfile**: Built using Node 20 alpine minimal runtime images.
- **Non-Root User Execution**: Services execute under unprivileged user account `USER node` (UID 1000).
- **Capability Dropping**: Container runtime drops `ALL` unnecessary Linux capabilities (`cap_drop: - ALL`).
- **Read-Only Filesystem**: Application directories execute read-only, using mounted `/tmp` volumes for dynamic scratch tasks.
- **No Secrets Baked In**: Zero `.env` files or credentials stored inside images; credentials injected via Kubernetes Secrets / Cloud Run environment variables.

---

## 3. Database Migration Deployment Rules
1. **Production Deployment Execution**: Use `npx prisma migrate deploy`.
2. **Forbidden Actions**: `prisma db push` is strictly prohibited in production environments.
3. **Zero Destructive Schema Changes**: All schema modifications must be backward-compatible before deployment.
4. **Row Level Security (RLS)**: PostgreSQL RLS policies remain active and enforced post-migration (`SET LOCAL app.current_tenant_id`).

---

## 4. Health & Readiness Probes
- **Liveness Probe**: `GET /health/live` (Verifies Node.js event loop & API process liveness).
- **Readiness Probe**: `GET /health/ready` (Verifies database connectivity, Redis connection, and background worker state). Fail-closed status `DOWN` returned if dependencies fail.
