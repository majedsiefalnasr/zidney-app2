# Job Contract: Provisioning Worker

**Queue**: `provisioning:queue` (Redis FIFO)  
**Consumer**: Provisioning Worker (Node.js process)  
**Version**: 1.0.0  
**Retry Policy**: 3 attempts with exponential backoff

---

## Job Payload Schema

### Complete Job Payload

```json
{
  "job_type": "PROVISION_WORKSPACE",
  "job_id": "550e8400-e29b-41d4-a716-446655440002",
  "license_id": "550e8400-e29b-41d4-a716-446655440001",
  "workspace_slug": "acme-university-2026",
  "organization_name": "ACME University",
  "admin_email": "admin@acme.edu",
  "product_id": "550e8400-e29b-41d4-a716-446655440100",
  "product_version": "1.0.0",
  "schema_version": "1.2.0",
  "student_limit": 5000,
  "staff_limit": 100,
  "uses_divisions": true,
  "default_language": "en",
  "correlation_id": "req-550e8400-e29b-41d4-a716-446655440000",
  "enqueued_at": "2026-02-24T10:00:00.000Z",
  "retry_count": 0,
  "max_retries": 3
}
```

---

## Field Specifications

| Field               | Type               | Required | Purpose                      | Example                                |
| ------------------- | ------------------ | -------- | ---------------------------- | -------------------------------------- |
| `job_type`          | string             | YES      | Job classification           | `PROVISION_WORKSPACE`                  |
| `job_id`            | UUID               | YES      | Unique job identifier        | `550e8400-e29b-41d4-a716-446655440002` |
| `license_id`        | UUID               | YES      | Primary key for idempotency  | `550e8400-e29b-41d4-a716-446655440001` |
| `workspace_slug`    | string             | YES      | Tenant identifier            | `acme-university-2026`                 |
| `organization_name` | string             | YES      | Display name                 | `ACME University`                      |
| `admin_email`       | string             | YES      | Admin account email          | `admin@acme.edu`                       |
| `product_id`        | UUID               | YES      | Product reference            | `550e8400-e29b-41d4-a716-446655440100` |
| `product_version`   | string             | YES      | Frozen product version       | `1.0.0`                                |
| `schema_version`    | string             | YES      | Frozen schema version        | `1.2.0`                                |
| `student_limit`     | integer            | YES      | Workspace student capacity   | `5000`                                 |
| `staff_limit`       | integer            | YES      | Workspace staff capacity     | `100`                                  |
| `uses_divisions`    | boolean            | YES      | Enable divisions table       | `true`                                 |
| `default_language`  | string             | NO       | Tenant language preference   | `en`                                   |
| `correlation_id`    | string             | YES      | Request tracing ID           | `req-uuid`                             |
| `enqueued_at`       | ISO 8601 timestamp | YES      | Server-side enqueue time     | `2026-02-24T10:00:00.000Z`             |
| `retry_count`       | integer            | NO       | Current retry attempt number | `0`                                    |
| `max_retries`       | integer            | NO       | Maximum retry attempts       | `3`                                    |

---

## Idempotency Key

**Primary Idempotency Key**: `license_id`

**Secondary Checks**:

1. Query `tenants_registry WHERE license_id = ?`
   - If found → Provisioning already complete ✓
2. Query `licenses WHERE id = ? AND status = 'ACTIVE'`
   - If found → License already active ✓
3. Check if database `workspace_<slug>` exists
   - If exists but no registry entry → Orphan DB, clean up and retry

---

## Processing Flow

```
┌─────────────────────────────────────────┐
│ Worker receives job                     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 1. CHECK IDEMPOTENCY                    │
│    - Query tenants_registry(license_id) │
│    - If entry exists → RETURN SUCCESS   │
│    - Check license.status = ACTIVE      │
│    - If true → RETURN SUCCESS           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 2. ACQUIRE DISTRIBUTED LOCK             │
│    - Redis SETNX provision:license:<id> │
│    - TTL: 30 seconds                    │
│    - If lock fails → ENQUEUE RETRY      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 3. VALIDATE LICENSE STATE               │
│    - Fetch license from master_db       │
│    - Verify status = PENDING_PROVISION  │
│    - Verify schema_version <= platform  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 4. CREATE TENANT DATABASE               │
│    - CREATE DATABASE workspace_<slug>   │
│    - SET locale UTF-8                   │
│    - If exists, DROP first              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 5. CONNECT & BEGIN TRANSACTION          │
│    - Connect to tenant DB               │
│    - BEGIN TRANSACTION                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 6. APPLY MIGRATIONS                     │
│    - For each migration ≤ schema_ver    │
│    - Execute SQL + record in schema_ver │
│    - If fails → ROLLBACK, MARK FAILED   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 7. SEED BASELINE DATA                   │
│    - Seed default roles                 │
│    - Seed default permissions           │
│    - Seed workspace settings            │
│    - Seed divisions (if uses_divisions) │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 8. CREATE ADMIN ACCOUNT                 │
│    - Hash password with bcrypt(12)      │
│    - Insert into users table            │
│    - Link to ADMIN role                 │
│    - Set verified_at = NULL             │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 9. INSERT REGISTRY ENTRY                │
│    - INSERT into master_db.tenants_reg  │
│    - Fields: license_id, slug, db_name, │
│      schema_version, created_at         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 10. COMMIT TRANSACTION                  │
│     - All or nothing atomicity          │
│     - If error → ROLLBACK ALL           │
└──────────────┬──────────────────────────┘
               │
          ┌────┴────┐
          ▼         ▼
      SUCCESS     FAILURE
        │           │
        │           ▼
        │       ┌──────────────────────┐
        │       │ DROP DATABASE        │
        │       │ MARK PROVISION_FAILED│
        │       │ RELEASE LOCK         │
        │       │ ENQUEUE RETRY (if<3) │
        │       │ ENQUEUE TO DLQ (if=3)│
        │       └──────────────────────┘
        │
        ▼
┌──────────────────────────────┐
│ 11. UPDATE LICENSE (master)  │
│     SET status = ACTIVE      │
│     SET provisioned_at = now │
└──────────────────────────────┘
        │
        ▼
┌──────────────────────────────┐
│ 12. RELEASE LOCK             │
│     Redis DEL provision:...  │
└──────────────────────────────┘
        │
        ▼
┌──────────────────────────────┐
│ 13. LOG SUCCESS              │
│     Correlation tracking     │
└──────────────────────────────┘
```

---

## Retry Policy

**Trigger**: Job processing fails (error thrown)

**Backoff Schedule**:

- Attempt 1 (initial): Processed immediately
- Attempt 2 (retry #1): Wait 1000ms (1s)
- Attempt 3 (retry #2): Wait 2000ms (2s)
- Attempt 4 (retry #3): Wait 4000ms (4s)

**Formula**: `backoff_ms = 1000 * 2^(retry_count - 1)`

**Max Retries**: 3 (total 4 attempts)

**Action On Max Retries**: Enqueue to Dead-Letter Queue (DLQ) for operator review

---

## Structured Logging

Every job emits structured logs (JSON format) with:

```json
{
  "timestamp": "2026-02-24T10:05:30.123Z",
  "level": "info|warn|error",
  "service": "provisioning-worker",
  "correlation_id": "req-550e8400...",
  "job_id": "550e8400-e29b-41d4-a716-446655440002",
  "license_id": "550e8400-e29b-41d4-a716-446655440001",
  "workspace_slug": "acme-university-2026",
  "db_name": "workspace_acme_university_2026",
  "event": "provisioning_started|step_completed|step_failed|provisioning_success|provisioning_failed",
  "step": "license_validation|database_creation|migration_applied|seed_roles|seed_permissions|seed_settings|admin_created|registry_inserted|license_activated|lock_released",
  "duration_ms": 5032,
  "retry_count": 0,
  "status": "PENDING_PROVISION|ACTIVE|PROVISION_FAILED",
  "error_code": null,
  "error_message": null
}
```

### Log Events

- **provisioning_started**: Job processing begins
- **license_validation**: License state checked, OK
- **database_creation**: Tenant database created
- **migration_applied**: Single migration file applied (log per migration)
- **seed\_\***: Seed data operations (roles, permissions, settings, divisions, admin)
- **registry_inserted**: Tenants registry entry created
- **license_activated**: License status transitioned to ACTIVE
- **provisioning_success**: All steps completed, job successful
- **provisioning_failed**: Error encountered, job failed
- **lock_released**: Distributed lock released (finally block)

---

## Error Codes

| Code                       | HTTP Status | Retriable | Action                                                  |
| -------------------------- | ----------- | --------- | ------------------------------------------------------- |
| `INVALID_LICENSE_STATUS`   | 400         | NO        | License not in PENDING_PROVISION state                  |
| `DATABASE_CREATION_FAILED` | 500         | YES       | CREATE DATABASE failed (permissions, storage)           |
| `MIGRATION_FAILED`         | 500         | NO        | Migration SQL error (code fix required)                 |
| `SEED_DATA_FAILED`         | 500         | NO        | Constraint violation in seed (review seed logic)        |
| `ADMIN_ACCOUNT_FAILED`     | 500         | NO        | User insert failed (email constraint?)                  |
| `REGISTRY_INSERT_FAILED`   | 500         | YES       | Unique constraint violation in tenants_registry         |
| `LOCK_TIMEOUT`             | 500         | YES       | Distributed lock acquisition failed                     |
| `NETWORK_PARTITION`        | 500         | YES       | Master DB unreachable (reconnect up to 60s, then retry) |
| `LOCK_TTL_EXCEEDED`        | 500         | YES       | Worker hung > 30s (lock auto-released, retry)           |

---

## Dead-Letter Queue Contract

**Queue Name**: `provisioning:dlq`

**DLQ Entry Format**:

```json
{
  "id": "dlq-entry-uuid",
  "job": {
    /* entire job payload */
  },
  "error": {
    "code": "MIGRATION_FAILED",
    "message": "Column 'xyz' already exists",
    "details": "migration file: 001_init_schema.sql"
  },
  "retry_count": 3,
  "failed_at": "2026-02-24T10:15:30.000Z",
  "operator_action_required": true,
  "actions": ["Review migration SQL file", "Fix schema error", "Manual retry via API"]
}
```

**Handling**:

1. Log to operator dashboard
2. Alert ops team (Slack, email, etc.)
3. Provide clear remediation steps
4. Operator can retry via admin API or delete from DLQ

---

## Examples

### Example 1: Successful Provisioning

```json
{
  "job_type": "PROVISION_WORKSPACE",
  "job_id": "job-001",
  "license_id": "lic-001",
  "workspace_slug": "test-institution",
  "organization_name": "Test Institution",
  "admin_email": "admin@test.edu",
  "product_id": "prod-001",
  "product_version": "1.0.0",
  "schema_version": "1.2.0",
  "student_limit": 1000,
  "staff_limit": 50,
  "uses_divisions": false,
  "default_language": "en",
  "correlation_id": "corr-001",
  "enqueued_at": "2026-02-24T10:00:00.000Z",
  "retry_count": 0,
  "max_retries": 3
}

// Logs:
// → provisioning_started (license_id: lic-001)
// → license_validation (OK)
// → database_creation (workspace_test_institution created)
// → migration_applied (001_init_schema.sql)
// → seed_roles (4 roles inserted)
// → seed_permissions (7 permissions inserted)
// → seed_settings (4 settings inserted)
// → admin_created (admin@test.edu, role=ADMIN)
// → registry_inserted (workspace_slug: test-institution)
// → license_activated (status → ACTIVE, provisioned_at set)
// → provisioning_success (duration_ms: 8234)
```

### Example 2: Retry After Failure

```json
{
  "job_type": "PROVISION_WORKSPACE",
  "job_id": "job-002",
  "license_id": "lic-002",
  "workspace_slug": "acme-2026",
  "organization_name": "ACME Corp",
  "admin_email": "admin@acme.com",
  "product_id": "prod-002",
  "product_version": "1.0.0",
  "schema_version": "1.2.0",
  "student_limit": 5000,
  "staff_limit": 100,
  "uses_divisions": true,
  "default_language": "en",
  "correlation_id": "corr-002",
  "enqueued_at": "2026-02-24T10:00:00.000Z",
  "retry_count": 1, // ← Retry attempt #2
  "max_retries": 3
}

// Logs:
// → provisioning_started (license_id: lic-002, retry_count: 1)
// → license_validation (OK)
// → database_creation (workspace_acme_2026 - DROP then CREATE)
// → migration_applied (001_init_schema.sql)
// → ... (seed steps)
// → provisioning_success (recovered after retry)
```

### Example 3: Max Retries Exceeded (DLQ)

```json
{
  "job_type": "PROVISION_WORKSPACE",
  "job_id": "job-003",
  "license_id": "lic-003",
  "retry_count": 3,
  "max_retries": 3

  // After 4 total attempts (initial + 3 retries), all failed
  // → Enqueue to DLQ
}

// DLQ Entry:
{
  "job": { /* job_003 payload */ },
  "error": {
    "code": "MIGRATION_FAILED",
    "message": "syntax error (column 'email' already exists)"
  },
  "retry_count": 3,
  "failed_at": "2026-02-24T10:05:30.000Z",
  "operator_action_required": true
}
```

---

## Implementation Notes

### Concurrency Safety

- Distributed lock (Redis SETNX) prevents duplicate provisioning
- Lock TTL: 30 seconds (if worker dies, lock auto-released)
- Idempotency check before lock: quick exit if already provisioned

### Transaction Safety

- All tenant DB operations in single ACID transaction
- If any step fails: automatic ROLLBACK + database cleanup
- Post-commit operations (license status update) are separate from transaction

### Observability

- Correlation ID propagated through entire flow: API → Queue → Worker → Logs
- Every log entry tagged with workspace_slug, license_id
- Duration tracking for performance analysis
- Error code tracking for SLA monitoring
