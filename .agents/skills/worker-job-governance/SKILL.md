---
name: worker-job-governance
description: Worker job contract patterns, DLQ handling, retry strategies, and idempotency enforcement for Zidney background processing
metadata:
  category: worker
  scope: backend
  capabilities:
    - job contract enforcement
    - idempotency key patterns
    - DLQ governance
    - retry strategy rules
    - schema version checks
---

# Worker Job Governance Skill

The Zidney Worker handles background processing for exam finalization, notifications, migrations, and other async operations. This skill defines governance for all worker job patterns.

---

## Job Contract Structure

Every job MUST include:

```typescript
interface JobPayload<T = unknown> {
  type: string;                // Job type identifier
  workspace_id: string;        // Tenant isolation scope
  workspace_slug: string;      // For logging context
  payload: T;                  // Typed job-specific data
  idempotency_key: string;     // Unique key for deduplication
  schema_version: string;      // Schema version for compatibility
  correlation_id: string;      // Tracing correlation
  created_at: string;          // ISO timestamp
  attempt_count?: number;      // Retry tracking
}
```

Missing any of these fields is a blocking violation.

---

## Idempotency Rules

- Every job MUST have an `idempotency_key`
- Processing the same `idempotency_key` twice must produce the same result
- The Worker must check for already-processed keys before executing
- Key format: `{job_type}:{entity_id}:{action}` (e.g., `finalize_attempt:abc-123:grade`)

```typescript
async function processJob(job: JobPayload) {
  const alreadyProcessed = await checkIdempotencyKey(job.idempotency_key);
  if (alreadyProcessed) {
    logger.info({ idempotency_key: job.idempotency_key }, 'Job already processed, skipping');
    return { success: true, skipped: true };
  }
  
  // ... process job
  await markIdempotencyKey(job.idempotency_key);
}
```

---

## Retry Strategy

| Setting | Value |
|---------|-------|
| Max retries | 3 |
| Backoff | Exponential with jitter |
| Initial delay | 1 second |
| Max delay | 30 seconds |
| After max retries | Send to DLQ |

```typescript
function calculateBackoff(attempt: number): number {
  const base = Math.min(1000 * Math.pow(2, attempt), 30000);
  const jitter = Math.random() * base * 0.1;
  return base + jitter;
}
```

---

## Dead-Letter Queue (DLQ) Governance

When a job exceeds max retries:

1. Move to DLQ with original payload + error details
2. Log at `error` level with full context
3. DLQ entries must include:
   - Original job payload
   - Final error message and stack
   - Number of attempts made
   - Timestamps of each attempt
4. DLQ must be monitored — unprocessed DLQ entries require manual review

---

## Schema Version Compatibility

The Worker must verify `schema_version` before processing:

```typescript
if (!isCompatible(job.schema_version, CURRENT_SCHEMA_VERSION)) {
  logger.warn({ 
    job_schema: job.schema_version,
    worker_schema: CURRENT_SCHEMA_VERSION 
  }, 'Schema version mismatch, sending to DLQ');
  await sendToDLQ(job, 'SCHEMA_VERSION_MISMATCH');
  return;
}
```

---

## Tenant Isolation in Jobs

- Every job must carry `workspace_id`
- Worker must resolve tenant database from `workspace_id` before any DB operation
- No cross-tenant operations in a single job execution
- Worker must not process jobs with missing `workspace_id`

---

## Job Type Registry

All job types must be registered:

```typescript
const JOB_TYPES = {
  FINALIZE_ATTEMPT: 'finalize_attempt',
  SEND_NOTIFICATION: 'send_notification',
  PROCESS_MIGRATION: 'process_migration',
  GENERATE_REPORT: 'generate_report',
  CLEANUP_EXPIRED: 'cleanup_expired',
} as const;
```

Unregistered job types must be rejected and logged.

---

## Forbidden Patterns

- **No synchronous heavy processing** — all long operations must be non-blocking
- **No direct API calls** from Worker — use the database directly
- **No UI communication** — Worker never sends data directly to frontend
- **No global database connections** — always use tenant-scoped connections
- **No fire-and-forget** — every job must be tracked to completion or DLQ

---

## Verdict Protocol

```
VERDICT: PASS   — job follows contract, has idempotency key and tenant scope
VERDICT: BLOCKED — missing idempotency key, workspace_id, or schema_version
```
