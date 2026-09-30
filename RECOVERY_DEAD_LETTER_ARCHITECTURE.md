# TaxFlow — Recovery & Dead Letter Queue Architecture

## 1. Overview

In distributed worker environments, workers may crash, experience node preemption, or stall due to unhandled memory leaks. The `JobRecoveryService` provides automated background detection and recovery for stalled job leases and dead-letter queue (DLQ) routing.

## 2. Stalled Worker Detection & Lease Locking

When a worker node picks up a job:
1. It updates `BackgroundJobRecord`: `status = PROCESSING`, `lockedAt = NOW()`, `lockedBy = workerId`.
2. The worker sends periodic heartbeats updating `lockedAt`.

### Stalled Job Sweeper (`detectAndRecoverStalledJobs`):
- Runs as an automated background periodic sweeper.
- Scans `BackgroundJobRecord` for jobs in `PROCESSING` status where `lockedAt` is older than `stalledThresholdSeconds` (default: 60 seconds).

```text
Stalled Job Detected (lockedAt > 60s ago)
               │
               ▼
      Check job.attempts < job.maxAttempts
               │
       ┌───────┴───────┐
       ▼               ▼
    [YES]            [NO]
       │               │
Clear Worker Lock  Set status: DEAD_LETTER
Set status: QUEUED Log to JobExecutionLog
Set stalledAt: NOW Record Audit Event
Increment attempt
```

---

## 3. Dead Letter Queue (DLQ) Routing

A job is routed to `DEAD_LETTER` status under two conditions:
1. **Max Attempts Exceeded**: The job handler failed `maxAttempts` times.
2. **Fatal Execution Error**: Unrecoverable payload schema or permission violation.

### Dead Letter Operations & Monitoring:
- **Audit Integration**: Every DLQ transition records an immutable audit log event (`BACKGROUND_JOB_DEAD_LETTER`).
- **DLQ Re-Drive**: Operations team can inspect DLQ jobs, update payloads if necessary, and trigger manual re-drive to `QUEUED` status.
