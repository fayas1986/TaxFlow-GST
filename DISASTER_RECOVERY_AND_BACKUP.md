# TaxFlow Disaster Recovery & Backup Plan

## 1. Objectives
- **RPO (Recovery Point Objective)**: < 15 minutes for transactional data.
- **RTO (Recovery Time Objective)**: < 1 hour for full service restoration.

---

## 2. Backup Strategy
1. **PostgreSQL Database**: Automated continuous WAL archiving + daily automated snapshot backups via Neon/RDS.
2. **Object Storage**: AWS S3 versioned buckets for stored tax documents and invoice PDFs with cross-region replication.
3. **Audit Log Integrity**: Immutable audit trail entries stored in PostgreSQL and mirrored to append-only cloud storage logs.

---

## 3. Restore & Recovery Procedure
1. Provision database instance from latest clean snapshot.
2. Re-apply WAL logs to target RPO timestamp.
3. Execute `npx prisma migrate deploy` to verify schema integrity.
4. Verify RLS tenant context policies (`SET LOCAL app.current_tenant_id`).
5. Re-queue uncommitted background jobs from dead-letter queue.
