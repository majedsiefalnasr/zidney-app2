# Error Code Reference

**Version**: 1.0.0  
**Last Updated**: 2026-02-24

---

## API Error Codes (License Creation Endpoint)

### Validation Errors (4xx)

#### INVALID_WORKSPACE_SLUG

| Property         | Value                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| **HTTP Status**  | 400 Bad Request                                                                                    |
| **Code**         | INVALID_WORKSPACE_SLUG                                                                             |
| **User Message** | "Workspace slug must contain only lowercase letters, numbers, and hyphens (3-255 characters)"      |
| **Cause**        | Workspace slug doesn't match regex `^[a-z0-9][a-z0-9-]*[a-z0-9]$\|^[a-z0-9]$`                      |
| **Resolution**   | User: Choose a valid slug (e.g., `acme-university`, `test-2026`). Developer: Validate client-side. |
| **Example**      | Invalid: `ACME-University`, `acme@edu`, `acme_university`, `acme-`                                 |

#### INVALID_ADMIN_EMAIL

| Property         | Value                                                                |
| ---------------- | -------------------------------------------------------------------- |
| **HTTP Status**  | 400 Bad Request                                                      |
| **Code**         | INVALID_ADMIN_EMAIL                                                  |
| **User Message** | "Admin email must be a valid email address (e.g., user@example.com)" |
| **Cause**        | Email doesn't match RFC 5321 format                                  |
| **Resolution**   | User: Provide valid email. Developer: Pre-validate email format.     |
| **Example**      | Invalid: `admin@`, `admin.com`, `admin@.com`                         |

#### INVALID_LIMIT

| Property         | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| **HTTP Status**  | 400 Bad Request                                                    |
| **Code**         | INVALID_LIMIT                                                      |
| **User Message** | "Student limit and staff limit must be positive integers (min 1)"  |
| **Cause**        | `student_limit` or `staff_limit` is negative, zero, or non-integer |
| **Resolution**   | User: Enter positive integers. Developer: Add range validation UI. |
| **Example**      | Invalid: `-100`, `0`, `1.5`, `"abc"`                               |

#### MISSING_REQUIRED_FIELD

| Property         | Value                                                                    |
| ---------------- | ------------------------------------------------------------------------ |
| **HTTP Status**  | 400 Bad Request                                                          |
| **Code**         | MISSING_REQUIRED_FIELD                                                   |
| **User Message** | "Request is missing required field: {field_name}"                        |
| **Cause**        | Request body missing `workspace_slug`, `admin_email`, `product_id`, etc. |
| **Resolution**   | Developer: Ensure all required fields present before sending request.    |
| **Example**      | Missing: `product_id`, `workspace_slug`                                  |

---

### Authentication Errors (401)

#### INVALID_AUTHENTICATION

| Property         | Value                                                                   |
| ---------------- | ----------------------------------------------------------------------- |
| **HTTP Status**  | 401 Unauthorized                                                        |
| **Code**         | INVALID_AUTHENTICATION                                                  |
| **User Message** | "MMC service token is invalid or expired"                               |
| **Cause**        | Authorization header missing or token invalid/expired                   |
| **Resolution**   | Developer: Refresh MMC service token. DevOps: Verify token signing key. |

#### INSUFFICIENT_PERMISSIONS

| Property         | Value                                                                              |
| ---------------- | ---------------------------------------------------------------------------------- |
| **HTTP Status**  | 401 Unauthorized                                                                   |
| **Code**         | INSUFFICIENT_PERMISSIONS                                                           |
| **User Message** | "This service account does not have permission to create licenses"                 |
| **Cause**        | Service token valid but lacks `licenses:create` permission                         |
| **Resolution**   | Developer: Use correct service account. DevOps: Assign permission to service role. |

---

### Conflict Errors (409)

#### WORKSPACE_SLUG_EXISTS

| Property         | Value                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| **HTTP Status**  | 409 Conflict                                                                                                     |
| **Code**         | WORKSPACE_SLUG_EXISTS                                                                                            |
| **User Message** | "Workspace slug 'acme-2026' is already registered"                                                               |
| **Cause**        | Workspace slug already exists in `tenants_registry`                                                              |
| **Resolution**   | User: Choose different slug (e.g., `acme-2027`, `acme-campus`). Admin: Verify slug wasn't claimed by competitor. |

#### LICENSE_ALREADY_EXISTS

| Property         | Value                                                                         |
| ---------------- | ----------------------------------------------------------------------------- |
| **HTTP Status**  | 409 Conflict                                                                  |
| **Code**         | LICENSE_ALREADY_EXISTS                                                        |
| **User Message** | "A license for this workspace already exists"                                 |
| **Cause**        | Duplicate license creation attempt (within dedup window)                      |
| **Resolution**   | Automatic: API returns cached response (same license_id). No action required. |

---

### Not Found Errors (404)

#### PRODUCT_NOT_FOUND

| Property         | Value                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------- |
| **HTTP Status**  | 404 Not Found                                                                         |
| **Code**         | PRODUCT_NOT_FOUND                                                                     |
| **User Message** | "Product '{product_id}' does not exist"                                               |
| **Cause**        | `product_id` provided doesn't exist in products table                                 |
| **Resolution**   | Developer: Verify product_id. UI: Fetch valid products from `/mmc/products` endpoint. |

---

### Server Errors (500s)

#### INTERNAL_ERROR

| Property         | Value                                                                    |
| ---------------- | ------------------------------------------------------------------------ |
| **HTTP Status**  | 500 Internal Server Error                                                |
| **Code**         | INTERNAL_ERROR                                                           |
| **User Message** | "An internal error occurred while creating license. Please try again."   |
| **Cause**        | Unexpected error (DB connection, crash, etc.)                            |
| **Resolution**   | User: Retry after 30 seconds. Developer: Check logs with correlation_id. |

#### DATABASE_ERROR

| Property         | Value                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------- |
| **HTTP Status**  | 500 Internal Server Error                                                                     |
| **Code**         | DATABASE_ERROR                                                                                |
| **User Message** | "Unable to connect to database. Please try again."                                            |
| **Cause**        | Master DB connection failed                                                                   |
| **Resolution**   | DevOps: Check database availability. Developer: Verify connection string. Retry with backoff. |

#### SERVICE_UNAVAILABLE

| Property         | Value                                                                         |
| ---------------- | ----------------------------------------------------------------------------- |
| **HTTP Status**  | 503 Service Unavailable                                                       |
| **Code**         | SERVICE_UNAVAILABLE                                                           |
| **User Message** | "Service is temporarily unavailable. Please try again in a moment."           |
| **Cause**        | API temporarily down, overloaded, or dependency unavailable                   |
| **Resolution**   | User: Retry after 30-60 seconds. DevOps: Scale API or investigate dependency. |

---

## Worker Error Codes (Provisioning)

### Validation Errors (Safe to Retry But Likely Backoff-Able)

#### INVALID_LICENSE_STATUS

| Property        | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| **Code**        | INVALID_LICENSE_STATUS                                                   |
| **HTTP Status** | (Worker only, not mapped to HTTP)                                        |
| **Log Level**   | WARN                                                                     |
| **Cause**       | License status already `ACTIVE` or `PROVISION_FAILED` (idempotent check) |
| **Resolution**  | Worker exits with success (already provisioned). No retry needed.        |
| **Recovery**    | Idempotent: Treat as success                                             |

#### INVALID_WORKSPACE_SLUG

| Property        | Value                                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| **Code**        | INVALID_WORKSPACE_SLUG                                                           |
| **HTTP Status** | N/A                                                                              |
| **Log Level**   | ERROR                                                                            |
| **Cause**       | Job payload contains invalid workspace slug (should not happen if API validates) |
| **Resolution**  | Fix job payload or resend from API. Max retries usually 1.                       |
| **Recovery**    | Mark `PROVISION_FAILED`, notify operator. No automatic retry.                    |

---

### Database Errors (Retriable)

#### DATABASE_CREATION_FAILED

| Property        | Value                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| **Code**        | DATABASE_CREATION_FAILED                                                                              |
| **HTTP Status** | N/A                                                                                                   |
| **Log Level**   | ERROR                                                                                                 |
| **Cause**       | `CREATE DATABASE workspace_<slug>` failed (likely race condition or insufficient permissions)         |
| **Resolution**  | Automatic retry with exponential backoff. If persists: Check PostgreSQL permissions.                  |
| **Recovery**    | Retry up to 3 times. If all fail: Mark `PROVISION_FAILED`, operator investigates storage/permissions. |

#### MIGRATION_FAILED

| Property        | Value                                                                                |
| --------------- | ------------------------------------------------------------------------------------ |
| **Code**        | MIGRATION_FAILED                                                                     |
| **HTTP Status** | N/A                                                                                  |
| **Log Level**   | ERROR                                                                                |
| **Cause**       | Migration SQL failed (syntax error, constraint violation, missing column, etc.)      |
| **Resolution**  | No automatic retry (code fix required). Operator reviews migration and fixes.        |
| **Recovery**    | Mark `PROVISION_FAILED`. Operator: Fix migration SQL, redeploy Worker, manual retry. |

#### SEED_DATA_FAILED

| Property        | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| **Code**        | SEED_DATA_FAILED                                                           |
| **HTTP Status** | N/A                                                                        |
| **Log Level**   | ERROR                                                                      |
| **Cause**       | INSERT seed data failed (duplicate role, constraint violation, etc.)       |
| **Resolution**  | No automatic retry. Operator reviews seed script logic.                    |
| **Recovery**    | Mark `PROVISION_FAILED`. Operator: Fix seed logic, redeploy, manual retry. |

#### ADMIN_ACCOUNT_FAILED

| Property        | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| **Code**        | ADMIN_ACCOUNT_FAILED                                                       |
| **HTTP Status** | N/A                                                                        |
| **Log Level**   | ERROR                                                                      |
| **Cause**       | User insert failed (email constraint, invalid password, etc.)              |
| **Resolution**  | Likely validation issue at API layer. Operator verifies admin_email valid. |
| **Recovery**    | Mark `PROVISION_FAILED`. Operator: Provide valid email, manual retry.      |

#### REGISTRY_INSERT_FAILED

| Property        | Value                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **Code**        | REGISTRY_INSERT_FAILED                                                                         |
| **HTTP Status** | N/A                                                                                            |
| **Log Level**   | ERROR                                                                                          |
| **Cause**       | Unique constraint violation on `workspace_slug` in tenants_registry                            |
| **Resolution**  | Likely race condition (two jobs for same slug). Automatic retry.                               |
| **Recovery**    | Retry up to 3 times. Distributed lock should prevent this; if persists: operator investigates. |

---

### Concurrency/Lock Errors (Retriable)

#### LOCK_TIMEOUT

| Property        | Value                                                                                  |
| --------------- | -------------------------------------------------------------------------------------- |
| **Code**        | LOCK_TIMEOUT                                                                           |
| **HTTP Status** | N/A                                                                                    |
| **Log Level**   | WARN                                                                                   |
| **Cause**       | Distributed lock acquisition failed (another worker provisioning same license)         |
| **Resolution**  | Automatic retry (backoff until lock released). Max 3 retries with exponential backoff. |
| **Recovery**    | Retry immediately, then exponential backoff (1s, 2s, 4s).                              |

#### LOCK_TTL_EXCEEDED

| Property        | Value                                                                                |
| --------------- | ------------------------------------------------------------------------------------ |
| **Code**        | LOCK_TTL_EXCEEDED                                                                    |
| **HTTP Status** | N/A                                                                                  |
| **Log Level**   | ERROR                                                                                |
| **Cause**       | Worker held lock > 30s (hung process), lock auto-released                            |
| **Resolution**  | Next worker picks up job (idempotent check). If database partial: cleanup and retry. |
| **Recovery**    | Idempotent retry handles partial state cleanup.                                      |

---

### Network/Partition Errors (Retriable)

#### NETWORK_PARTITION

| Property        | Value                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Code**        | NETWORK_PARTITION                                                                                                                                          |
| **HTTP Status** | N/A                                                                                                                                                        |
| **Log Level**   | ERROR                                                                                                                                                      |
| **Cause**       | Connection to master_db lost (dropped, timeout)                                                                                                            |
| **Resolution**  | Worker attempts reconnect with exponential backoff up to 60s (per Q1 clarification).                                                                       |
| **Recovery**    | Reconnect loop: Try every 500ms-1s for 60s. If reconnect succeeds: Resume operation. If still disconnected: Rollback, mark `PROVISION_FAILED`, re-enqueue. |

#### TIMEOUT

| Property        | Value                                                                       |
| --------------- | --------------------------------------------------------------------------- | ----- |
| **Code**        | TIMEOUT                                                                     |
| **HTTP Status** | N/A **Log Level**                                                           | ERROR |
| **Cause**       | Operation exceeded timeout (e.g., database query > 60s)                     |
| **Resolution**  | Automatic retry. If consistent timeouts: Scale resources or optimize query. |
| **Recovery**    | Retry with backoff.                                                         |

---

### Dead-Letter Queue Escalation

When job reaches `retry_count = max_retries` (usually 3), it's enqueued to DLQ:

```json
{
  "job_id": "...",
  "license_id": "...",
  "error_code": "DATABASE_CREATION_FAILED",
  "error_message": "CREATE DATABASE failed: permission denied",
  "retry_count": 3,
  "failed_at": "2026-02-24T10:15:30.000Z",
  "operator_action_required": true,
  "suggested_actions": [
    "Check PostgreSQL permissions for application user",
    "Verify storage available on database server",
    "Review Worker logs with correlation_id for details"
  ]
}
```

**Operator Resolution Steps**:

1. Fetch DLQ entry (job_id, error_code, error_message)
2. Review operator_action_required field for guided troubleshooting
3. Fix underlying issue (permissions, storage, migration SQL, etc.)
4. Manual retry via admin API: `POST /admin/licenses/{license_id}/retry-provision`

---

## Error Response Format

All error responses follow unified contract:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "status": 400,
    "correlation_id": "req-uuid",
    "details": {
      "field": "value",
      "context": "additional info"
    }
  }
}
```

---

## Error Handling Decision Tree

```
┌─ Is error retriable?
│  ├─ YES (NETWORK_PARTITION, LOCK_TIMEOUT, TIMEOUT)
│  │  ├─ Retry count < max_retries?
│  │  │  ├─ YES → Backoff and re-enqueue
│  │  │  └─ NO → Enqueue to DLQ
│  │  │
│  │  └─ Mark license.status = PROVISION_FAILED (for operator awareness)
│  │
│  └─ NO (MIGRATION_FAILED, SEED_DATA_FAILED, INVALID_WORKSPACE_SLUG)
│     ├─ Mark license.status = PROVISION_FAILED (immediate)
│     ├─ Log error_message for operator
│     ├─ Enqueue to DLQ
│     └─ Await operator action
│
└─ In all cases:
   ├─ Cleanup partial resources (DROP orphan DB)
   ├─ Release distributed lock (finally block)
   └─ Emit structured log with correlation_id
```

---

## Monitoring & Alerting

### Metrics to Track

| Metric                                      | Type      | Alert Threshold                             |
| ------------------------------------------- | --------- | ------------------------------------------- |
| `provisioning.error_rate`                   | Gauge     | > 5% (error count / total)                  |
| `provisioning.dlq_entries`                  | Counter   | > 10 unprocessed entries                    |
| `provisioning.retry_count`                  | Histogram | P95 > 1 (most complete, but track outliers) |
| `provisioning.lock_wait_time_ms`            | Histogram | P99 > 5000ms                                |
| `provisioning.network_partition_recoveries` | Counter   | Any spike (indicates infrastructure issue)  |

### Alert Examples

```yaml
- alert: HighProvisioningErrorRate
  expr: rate(provisioning_error_count[5m]) / rate(provisioning_total[5m]) > 0.05
  for: 5m
  annotations:
    summary: '5%+ provisioning jobs failing. Check logs for error codes.'

- alert: DLQBacklog
  expr: redis_dlq_size > 10
  for: 10m
  annotations:
    summary: '{{$value}} jobs in DLQ. Operator intervention needed.'
```

---

## Testing Error Codes

### Unit Tests

```typescript
test('DATABASE_CREATION_FAILED should trigger retry', async () => {
  // Mock CREATE DATABASE to fail
  jest.spyOn(db, 'query').mockRejectedValueOnce(new Error('permission denied'))

  await provisionWorkspace(job)

  // Verify job re-enqueued with retry_count incremented
  expect(redis.lpush).toHaveBeenCalledWith(
    'provisioning:queue',
    expect.objectContaining({ retry_count: 1 })
  )
})

test('MIGRATION_FAILED should NOT retry', async () => {
  // Mock migration execution to fail
  jest.spyOn(db, 'query').mockRejectedValueOnce(new Error('syntax error'))

  await provisionWorkspace(job)

  // Verify job enqueued to DLQ, not retry queue
  expect(redis.lpush).toHaveBeenCalledWith(
    'provisioning:dlq',
    expect.any(String)
  )
})
```

---

## Versioning

This error code reference is versioned along with API and Worker contracts.

**Future Changes**:

- New error codes will be added (backward compatible)
- Existing codes won't be removed (may be deprecated)
- HTTP status mappings may change (to better align with RFC 7231)
