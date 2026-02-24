# Worker Jobs Contract: License Lifecycle

**Stage**: STAGE 11 – License Lifecycle Operations  
**Phase**: 02 – Platform MMC  
**Interface**: Background Job Processor  
**Location**: `apps/worker/src/jobs/`

---

## Overview

Worker jobs execute long-running asynchronous operations for license lifecycle management. All jobs follow idempotent patterns with retry logic and immutable audit trails.

---

## Job Type 1: snapshot_create

**Purpose**: Capture database snapshot when transitioning SOFT_LOCKED → ARCHIVED

**Queue Name**: `queue:snapshot_create`

**Job Envelope**:

```typescript
{
  job_id: "uuid",
  request_id: "uuid",
  job_name: "snapshot_create",
  workspace_id: "uuid",
  payload: {
    license_id: "uuid",
    workspace_slug: "string",
    tenant_db_connection_string: "string",
    expected_snapshot_timestamp: "iso-8601-string"
  },
  payload_hash: "sha256-hex",
  retry_count: 0,
  max_retries: 3,
  created_at: "iso-8601-string"
}
```

**Payload Fields**:

- `license_id`: ID of license being archived
- `workspace_slug`: Slug for snapshot path construction
- `tenant_db_connection_string`: Connection to tenant database (temporary)
- `expected_snapshot_timestamp`: Server-generated UTC time for path determinism

**Execution Steps**:

1. **Connection**: Establish read-only connection to tenant database
2. **Snapshot Creation**:
   - Use `pg_dump` or equivalent to create database snapshot
   - Stream to S3 at deterministic path: `s3://snapshots/{license_id}/{timestamp}.tar.gz`
   - Calculate size_bytes after upload
3. **Metadata Recording** (in master_db transaction):
   ```sql
   INSERT INTO snapshots (
     id, license_id, snapshot_location, snapshot_timestamp,
     version_tag, size_bytes, status, created_at
   ) VALUES (
     gen_random_uuid(), :license_id, :location, :timestamp,
     :schema_version, :size_bytes, 'CREATED', now()
   )
   ```
4. **Success Response**:
   ```typescript
   {
     success: true,
     snapshot_id: "uuid",
     snapshot_location: "s3://...",
     size_bytes: 12345678,
     duration_ms: 450000
   }
   ```

**Retry Logic**:

- Max retries: 3
- Backoff: Exponential (1s → 2s → 4s)
- On failure: Mark snapshot status = FAILED with failure_reason
- Alert: CRITICAL alert to ops team on permanent failure
- Recovery: Admin can manually trigger snapshot via MMC

**Error Handling**:

- **Timeout**: If snapshot > 10 minutes and > 500GB, timeout and alert admin
- **Quota Exceeded**: If storage quota exceeded, mark failure and alert
- **Connection Lost**: Retry with backoff
- **Permissions**: Fail immediately if tenant DB connection denied
- **Permanent Failure**: After 3 retries, mark snapshot FAILED and alert admin

**Idempotency**:

- If snapshot_create enqueued twice for same license_id within same second
- Second execution checks if snapshot already exists with same timestamp
- If exists and status=CREATED: Return existing snapshot_id (no duplicate)
- If exists and status=FAILED: Re-attempt snapshot
- If exists with older timestamp: Error (shouldn't happen, indicates race condition)

---

## Job Type 2: restore_from_archive

**Purpose**: Restore tenant database from snapshot when transitioning ARCHIVED → ACTIVE

**Queue Name**: `queue:restore_from_archive`

**Job Envelope**:

```typescript
{
  job_id: "uuid",
  request_id: "uuid",
  job_name: "restore_from_archive",
  workspace_id: "uuid",
  payload: {
    license_id: "uuid",
    workspace_slug: "string",
    snapshot_id: "uuid",
    snapshot_location: "s3://...",
    target_schema_version: "string",
    current_schema_version: "string"
  },
  payload_hash: "sha256-hex",
  retry_count: 0,
  max_retries: 3,
  created_at: "iso-8601-string"
}
```

**Payload Fields**:

- `license_id`: License being restored
- `workspace_slug`: For multi-tenancy isolation
- `snapshot_id`: Snapshot metadata ID (for status tracking)
- `snapshot_location`: S3 URI to restore from
- `target_schema_version`: Schema version at snapshot creation
- `current_schema_version`: Current product schema version

**Pre-Flight Checks**:

1. Verify snapshot exists and status = CREATED
2. Verify schema compatibility: target_schema_version ≤ current_schema_version
3. Verify tenant database can be dropped/recreated
4. If any check fails: Return error without proceeding

**Execution Steps**:

1. **Download Snapshot**: Retrieve snapshot from S3 to temp storage
2. **Validation**: Verify checksum (if available in snapshot metadata)
3. **Database Restoration**:
   - Drop existing tenant database (or truncate if exists)
   - Restore schema and data from snapshot
   - Validate row counts match snapshot expectations
4. **Schema Migration** (if needed):
   - If target_schema_version < current_schema_version
   - Run forward migrations from target to current
   - Increment schema_version in tenant DB
5. **Master DB Update** (transaction):

   ```sql
   UPDATE licenses
   SET status='ACTIVE', archived_at=NULL, current_snapshot_id=NULL, updated_at=now()
   WHERE id=:license_id AND status='ARCHIVED';

   INSERT INTO license_audit_logs (
     license_id, previous_status, new_status, actor_type,
     reason, timestamp, correlation_id, created_at
   ) VALUES (
     :license_id, 'ARCHIVED', 'ACTIVE', 'SYSTEM',
     'Restore from snapshot', now(), :correlation_id, now()
   );
   ```

6. **Success Response**:
   ```typescript
   {
     success: true,
     license_id: "uuid",
     status: "ACTIVE",
     restored_at: "iso-8601",
     row_count: 12345,
     duration_ms: 180000
   }
   ```

**Retry Logic**:

- Max retries: 3
- Backoff: Exponential (1s → 2s → 4s)
- On failure: License remains ARCHIVED, snapshot preserved for retry
- Alert: Admin notification with error details
- Recovery: Admin can retry manually via MMC

**Error Handling**:

- **Snapshot Not Found**: Fail immediately (S3 access error)
- **Checksum Mismatch**: Fail immediately (corruption detected)
- **Migration Failure**: Rollback restore, database reverted to pre-restore state
- **Schema Incompatibility**: Fail before any restoration (version check)
- **Disk Space**: Fail if insufficient space for restoration
- **Timeout**: If restore > 30 minutes, timeout and revert
- **Concurrent Access**: Serialize at database level (SELECT ... FOR UPDATE)

**Idempotency**:

- If restore_from_archive enqueued twice for same license_id
- First execution succeeds atomically
- Second execution:
  - Checks license.status = ACTIVE (already restored)
  - Returns success response (no data corruption)
  - Does not re-download or re-apply snapshot (atomic at DB level)
- If restore fails and retried:
  - License remains ARCHIVED between retries
  - Second attempt starts from snapshot again (no partial state)

**Performance SLA**:

- Small workspace (<1GB): Target ≤ 5 minutes
- Medium workspace (1–5GB): Target ≤ 15 minutes
- Large workspace (>5GB): Target ≤ 30 minutes
- Timeout: 2x SLA + 5 minutes (hard timeout)

---

## Job Type 3: delete_license

**Purpose**: Permanently delete a license, its tenant database, and snapshot

**Queue Name**: `queue:delete_license`

**Job Envelope**:

```typescript
{
  job_id: "uuid",
  request_id: "uuid",
  job_name: "delete_license",
  workspace_id: "uuid",
  payload: {
    license_id: "uuid",
    workspace_slug: "string",
    snapshot_id: "uuid",
    snapshot_location: "s3://...",
    actor_id: "uuid",
    grace_period_until: "iso-8601-string or null"
  },
  payload_hash: "sha256-hex",
  retry_count: 0,
  max_retries: 2,
  created_at: "iso-8601-string"
}
```

**Payload Fields**:

- `license_id`: License to delete
- `workspace_slug`: For isolation verification
- `snapshot_id`: Snapshot to delete
- `snapshot_location`: S3 URI of snapshot
- `actor_id`: Admin user who authorized deletion
- `grace_period_until`: When workspace becomes non-recoverable (null = immediate)

**Pre-Flight Checks**:

1. Verify license exists and status = ARCHIVED
2. Verify no active users/attempts in tenant database
3. If grace period enabled: Verify current_time >= grace_period_until
4. If any check fails: Defer deletion (enqueue for retry)

**Execution Steps** (Transaction):

1. **Drop Tenant Database**:
   - Connect to tenant database
   - Disconnect all active sessions (or wait for automatic timeout)
   - Drop database
   - Verify dropped successfully

2. **Delete Snapshot from S3**:
   - Request DELETE on snapshot_location object in S3
   - Verify deletion

3. **Remove Tenant Registry Entry**:

   ```sql
   DELETE FROM tenants_registry WHERE license_id = :license_id;
   ```

4. **Update License Status** (master DB):

   ```sql
   UPDATE licenses
   SET status='DELETED', deleted_at=now(), current_snapshot_id=NULL, updated_at=now()
   WHERE id=:license_id AND status='ARCHIVED';
   ```

5. **Create Audit Log Entry**:

   ```sql
   INSERT INTO license_audit_logs (
     license_id, previous_status, new_status, actor_type,
     actor_id, reason, timestamp, correlation_id, created_at
   ) VALUES (
     :license_id, 'ARCHIVED', 'DELETED', 'ADMIN',
     :actor_id, 'Permanent deletion confirmed', now(), :correlation_id, now()
   );
   ```

6. **Success Response**:
   ```typescript
   {
     success: true,
     license_id: "uuid",
     status: "DELETED",
     deleted_at: "iso-8601",
     duration_ms: 15000
   }
   ```

**Retry Logic**:

- Max retries: 2 (deletion is terminal, fewer retries to avoid extended recovery windows)
- Backoff: Exponential (2s → 4s)
- On failure: Workspace remains ARCHIVED, snapshot preserved
- Alert: CRITICAL alert to ops team (manual intervention required)
- Recovery: Manual deletion follow-up or rollback decision

**Error Handling**:

- **Active Sessions**: Wait up to 2 minutes for sessions to timeout, then force disconnect
- **Permission Denied**: Fail immediately (DB access error)
- **File Not Found**: If S3 object doesn't exist, continue deletion (assume already deleted)
- **Database Drop Failed**: Fail transaction, workspace remains ARCHIVED
- **Registry Remove Failed**: Fail transaction, retry
- **Grace Period Not Elapsed**: Defer deletion (enqueue for later retry)
- **Concurrent Deletion**: If second deletion job arrives, first wins; second fails with "Already deleted"

**Immutability After Deletion**:

- Workspace slug cannot be reused (permanently retired)
- Deleted license cannot be restored (no recovery option)
- Tenant registry entry remains deleted (no reactivation)
- Audit log entry is permanent and auditable

**Performance SLA**:

- Target ≤ 10 minutes (dependent on S3 availability)
- Timeout: 15 minutes

---

## Job Type 4: soft_lock_expiry_transition (Optional Background Job)

**Purpose**: Optional background job to expedite auto-transition of expired soft locks (middleware also performs this on-demand)

**Queue Name**: `queue:soft_lock_expiry_transition`

**Trigger**: Scheduled job in background (not request-driven)

**Job Envelope**:

```typescript
{
  job_id: "uuid",
  request_id: "scheduler",
  job_name: "soft_lock_expiry_transition",
  payload: {
    scan_interval_minutes: 60,
    batch_size: 100
  }
}
```

**Execution**:

1. Query licenses table: `SELECT id FROM licenses WHERE status='SOFT_LOCKED' AND soft_lock_until < now()` (LIMIT batch_size)
2. For each expired license:
   - Trigger snapshot_create job
   - Upon snapshot completion, trigger transition via License Service
3. Audit log each transition

**Note**: Middleware also performs this check on-demand, so this job is optional optimization (doesn't break if disabled)

---

## Common Job Patterns

### Error Alerting

All job failures trigger structured alerts:

```json
{
  "alert_type": "JOB_FAILURE",
  "job_name": "snapshot_create",
  "job_id": "uuid",
  "license_id": "uuid",
  "workspace_slug": "acme-corp",
  "error_code": "SNAPSHOT_TIMEOUT",
  "error_message": "Snapshot exceeded 10-minute SLA",
  "retry_count": 3,
  "max_retries": 3,
  "timestamp": "iso-8601",
  "correlation_id": "uuid",
  "recommended_action": "Investigate S3 connectivity; consider increasing SLA for large workspaces"
}
```

### Payload Hash Validation

Worker verifies job payload hasn't been modified:

```typescript
const currentHash = computeJobPayloadHash(job.payload)
if (currentHash !== job.payload_hash) {
  // Payload was mutated in transit; fail job
  throw new Error('Payload mutation detected')
}
```

### Structured Event Logging

All job lifecycle events logged:

```json
{
  "timestamp": "2026-02-24T10:30:00Z",
  "level": "info",
  "service": "worker",
  "event": "job_dequeued",
  "job_id": "uuid",
  "job_name": "snapshot_create",
  "license_id": "uuid",
  "workspace_slug": "acme-corp",
  "retry_count": 0,
  "correlation_id": "uuid"
}
```

### Cleanup & Completion

Upon job completion:

- Remove job from queue (FIFO dequeue success)
- Log success event with duration_ms
- Update audit trail (if applicable)
- Alert admin if SLA exceeded (non-blocking alert)

---

## Queue Monitoring & Metrics

**Metrics to Track**:

- Queue depth per job type (monitor for backlog)
- Job execution time (p50, p95, p99)
- Job failure rate per type
- Retry attempts per job type
- Total jobs completed (weekly/monthly)

**Alerting Thresholds**:

- Queue depth > 1000: Performance warning
- Job failure rate > 5%: Alert ops
- Snapshot job > 15 min for < 5GB: SLA warning
- Restore job > 40 min for < 5GB: SLA warning
- Delete job > 15 minutes: SLA warning
