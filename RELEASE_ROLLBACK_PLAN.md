# TaxFlow Release Rollback Plan

## 1. Overview
TaxFlow maintains blue/green deployment compatibility and strict migration versioning to ensure zero-downtime rollbacks.

---

## 2. Rollback Execution Steps
1. **API / Worker Rollback**: Revert deployment image tags to previous stable release image.
2. **Schema Rollback**: Database migrations are strictly backward-compatible. If necessary, execute down migrations via `prisma migrate resolve`.
3. **Queue Drain Safety**: Background workers process remaining jobs or gracefully return pending jobs to BullMQ queues on SIGTERM.
4. **Verification**: Run `GET /health/ready` to confirm DB latency and worker readiness post-rollback.
