# API Endpoints Contract: License Lifecycle

**Stage**: STAGE 11 – License Lifecycle Operations  
**Phase**: 02 – Platform MMC  
**Interface**: REST API (Hono routes)  
**Location**: `apps/api/src/routes/`  

---

## Overview

All license lifecycle endpoints require:
1. Authenticated MMC user (session required)
2. Admin role (for state transitions)
3. Correlation ID (automatic, set by middleware)
4. Standard response envelope

---

## Authentication & Authorization

### Route Protection

All routes protected by:
```
Middleware stack:
1. Authentication check (session required)
2. Authorization check (admin role for transitions)
3. Request validation (schema validation)
4. Execution → Handler
```

### Response Envelope

All responses follow standard:

**Success** (2xx):
```typescript
{
  success: true,
  data: {
    // Response-specific data
  }
}
```

**Error** (4xx, 5xx):
```typescript
{
  success: false,
  data: null,
  error: {
    code: "ERROR_CODE",
    message: "Human-readable message"
  }
}
```

---

## Endpoints

### 1. POST /licenses/{licenseId}/soft-lock

**Purpose**: Transition license from ACTIVE to SOFT_LOCKED

**Route**: `POST /api/licenses/{licenseId}/soft-lock`

**Authentication**: Required (admin role)

**Request Body**:
```typescript
{
  reason: string  // (required) Business reason for soft lock
}
```

**Validation**:
- `licenseId`: Valid UUID
- `reason`: Non-empty string, max 512 chars
- License exists and status = ACTIVE
- User has admin role

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    license: {
      id: "uuid",
      workspace_slug: "acme-corp",
      status: "SOFT_LOCKED",
      soft_lock_until: "2026-05-24T10:30:00Z",
      archived_at: null,
      deleted_at: null
    },
    previous_state: "ACTIVE",
    new_state: "SOFT_LOCKED",
    soft_lock_expires_in_days: 90
  }
}
```

**Error Responses**:
- 400 BadRequest: Invalid input or license not ACTIVE
- 403 Forbidden: User not admin
- 404 NotFound: License not found
- 423 Locked: License is SOFT_LOCKED; cannot transition while locked (wait or manually renew first)
- 500 InternalServerError: Database error

---

### 2. POST /licenses/{licenseId}/renew

**Purpose**: Renew soft-locked license back to ACTIVE

**Route**: `POST /api/licenses/{licenseId}/renew`

**Authentication**: Required (admin role)

**Request Body**:
```typescript
{
  reason: string  // (required) Business reason for renewal
}
```

**Validation**:
- `licenseId`: Valid UUID
- `reason`: Non-empty string, max 512 chars
- License exists and status = SOFT_LOCKED
- User has admin role

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    license: {
      id: "uuid",
      workspace_slug: "acme-corp",
      status: "ACTIVE",
      soft_lock_until: null,
      archived_at: null,
      deleted_at: null
    },
    previous_state: "SOFT_LOCKED",
    new_state: "ACTIVE"
  }
}
```

**Error Responses**:
- 400 BadRequest: License not SOFT_LOCKED
- 403 Forbidden: User not admin
- 404 NotFound: License not found
- 423 Locked: License is SOFT_LOCKED but renewal blocked by other operation in progress
- 500 InternalServerError: Database error

---

### 3. POST /licenses/{licenseId}/archive

**Purpose**: Transition soft-locked license to ARCHIVED (with snapshot)

**Route**: `POST /api/licenses/{licenseId}/archive`

**Authentication**: Required (admin role)

**Request Body**:
```typescript
{
  reason?: string  // (optional) Reason for archival
}
```

**Request Flow**:
1. Validate license exists and status = SOFT_LOCKED
2. Enqueue `snapshot_create` worker job
3. Return job_id immediately (async operation)
4. Upon worker snapshot completion:
   - Service transitions license to ARCHIVED
   - Client receives status update via MMC UI polling or WebSocket

**Response** (202 Accepted - Async Operation):
```typescript
{
  success: true,
  data: {
    license: {
      id: "uuid",
      workspace_slug: "acme-corp",
      status: "SOFT_LOCKED"  // Still SOFT_LOCKED until snapshot completes
    },
    job_id: "uuid",
    job_name: "snapshot_create",
    message: "Snapshot and archival in progress",
    eta_seconds: 180
  }
}
```

**Response** (200 OK - Complete):
If snapshot already captured:
```typescript
{
  success: true,
  data: {
    license: {
      id: "uuid",
      workspace_slug: "acme-corp",
      status: "ARCHIVED",
      archived_at: "2026-02-24T10:30:00Z",
      soft_lock_until: null
    },
    snapshot: {
      id: "uuid",
      location: "s3://snapshots/{license_id}/timestamp.tar.gz",
      size_bytes: 1234567890
    },
    previous_state: "SOFT_LOCKED",
    new_state: "ARCHIVED"
  }
}
```

**Error Responses**:
- 400 BadRequest: License not SOFT_LOCKED or snapshot failed
- 403 Forbidden: User not admin
- 404 NotFound: License not found
- 423 Locked: License is SOFT_LOCKED but archived already or locked by another operation
- 503 ServiceUnavailable: Storage service unavailable
- 500 InternalServerError: Database error

---

### 4. POST /licenses/{licenseId}/restore

**Purpose**: Restore archived license from snapshot to ACTIVE

**Route**: `POST /api/licenses/{licenseId}/restore`

**Authentication**: Required (admin role)

**Request Body**:
```typescript
{
  reason?: string  // (optional) Reason for restoration
}
```

**Request Flow**:
1. Validate license exists and status = ARCHIVED
2. Validate snapshot exists and status = CREATED
3. Enqueue `restore_from_archive` worker job
4. Return job_id immediately (async operation)
5. Upon worker restore completion:
   - License transitions to ACTIVE
   - Client receives completion notification

**Response** (202 Accepted - Async Operation):
```typescript
{
  success: true,
  data: {
    license: {
      id: "uuid",
      workspace_slug: "acme-corp",
      status: "ARCHIVED"  // Still ARCHIVED during restore
    },
    job_id: "uuid",
    job_name: "restore_from_archive",
    message: "Restore in progress",
    eta_seconds: 300,
    snapshot: {
      size_bytes: 1234567890
    }
  }
}
```

**Response** (200 OK - Complete):
```typescript
{
  success: true,
  data: {
    license: {
      id: "uuid",
      workspace_slug: "acme-corp",
      status: "ACTIVE",
      archived_at: null
    },
    previous_state: "ARCHIVED",
    new_state: "ACTIVE",
    restored_at: "2026-02-24T10:30:00Z",
    restore_duration_ms: 240000
  }
}
```

**Error Responses**:
- 400 BadRequest: License not ARCHIVED or snapshot failed
- 403 Forbidden: User not admin
- 404 NotFound: License not found
- 423 Locked: License is ARCHIVED but locked by another restore/deletion operation
- 426 UpgradeRequired: Schema version incompatible
- 503 ServiceUnavailable: Restore service unavailable
- 504 GatewayTimeout: Restore exceeded SLA
- 500 InternalServerError: Database error

---

### 5. POST /licenses/{licenseId}/delete/initiate

**Purpose**: Begin deletion process (initiate confirmation)

**Route**: `POST /api/licenses/{licenseId}/delete/initiate`

**Authentication**: Required (admin role + 2FA verification)

**Request Body**:
```typescript
{}  // No body required
```

**Prerequisites**:
- License exists and status = ARCHIVED
- User re-authenticated with 2FA
- User has admin role

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    confirmation: {
      id: "uuid",
      license_id: "uuid",
      confirmation_phrase: "CONFIRM_DELETE_ABC12XYZ",  // Random 24-char string
      valid_until: "2026-02-24T10:35:00Z",  // 5 minutes from now
      message: "You are about to permanently delete workspace 'acme-corp'. Type the confirmation phrase above to proceed."
    }
  }
}
```

**Error Responses**:
- 401 Unauthorized: 2FA not verified or session missing 2FA flag
- 403 Forbidden: User not admin
- 400 BadRequest: License not ARCHIVED
- 404 NotFound: License not found
- 423 Locked: License is ARCHIVED but locked by another deletion operation
- 429 TooManyRequests: Deletion already initiated; wait 5 minutes before retry

---

### 6. POST /licenses/{licenseId}/delete/confirm

**Purpose**: Confirm and execute permanent deletion

**Route**: `POST /api/licenses/{licenseId}/delete/confirm`

**Authentication**: Required (admin role, fresh 2FA session)

**Request Body**:
```typescript
{
  confirmation_phrase: string,  // (required) Must match confirmation_phrase from initiate
  confirmation_id: string       // (required) From initiate response
}
```

**Validation**:
- `confirmation_phrase`: Exact match (case-sensitive) to random phrase from initiate
- `confirmation_id`: References valid confirmation record
- Confirmation not expired (< 5 minutes old)
- License status still = ARCHIVED
- User authenticated with fresh 2FA (not older than 5 minutes)

**Request Flow**:
1. Verify confirmation phrase matches hash
2. Verify confirmation not expired
3. Enqueue `delete_license` worker job
4. Return job_id immediately (async operation)
5. Upon worker deletion completion:
   - License transitions to DELETED
   - Tenant database dropped
   - Snapshot deleted from S3
   - Tenant registry entry removed

**Response** (202 Accepted - Async Operation):
```typescript
{
  success: true,
  data: {
    license: {
      id: "uuid",
      workspace_slug: "acme-corp",
      status: "ARCHIVED"  // Still ARCHIVED during deletion
    },
    job_id: "uuid",
    job_name: "delete_license",
    message: "Deletion in progress. Workspace will be permanently deleted.",
    eta_seconds: 30
  }
}
```

**Error Responses**:
- 400 BadRequest: Confirmation phrase mismatch or expired
- 401 Unauthorized: 2FA session expired or missing
- 403 Forbidden: User not admin or confirmation failed
- 404 NotFound: License or confirmation record not found
- 409 Conflict: Deletion already in progress; poll job status
- 423 Locked: License is ARCHIVED but locked by another operation
- 500 InternalServerError: Deletion failed

---

### 7. GET /licenses/{licenseId}

**Purpose**: Retrieve license details (read-only, no auth required for public endpoints)

**Route**: `GET /api/licenses/{licenseId}`

**Authentication**: Optional (public read, but MMC-specific details require auth)

**Query Parameters**:
- `include_audit_trail`: boolean (optional, default false) - Include last 10 audit entries
- `include_snapshot`: boolean (optional, default false) - Include snapshot metadata

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    license: {
      id: "uuid",
      product_id: "uuid",
      workspace_id: "uuid",
      workspace_slug: "acme-corp",
      status: "ARCHIVED",
      soft_lock_until: null,
      archived_at: "2026-02-24T10:30:00Z",
      deleted_at: null,
      expected_schema_version: "2.1.0",
      expected_product_version: "2.0.0",
      student_limit: 1000,
      staff_limit: 50,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2026-02-24T10:30:00Z"
    },
    // Optional fields (if includes requested):
    audit_trail: [
      {
        id: "uuid",
        previous_status: "SOFT_LOCKED",
        new_status: "ARCHIVED",
        reason: "90-day soft lock expiry",
        timestamp: "2026-02-24T10:30:00Z",
        actor_id: null,  // System-triggered
        actor_type: "SYSTEM"
      }
    ],
    snapshot: {
      id: "uuid",
      snapshot_location: "s3://snapshots/{license_id}/2026-02-24T10-30-00Z.tar.gz",
      size_bytes: 1234567890,
      version_tag: "2.1.0",
      created_at: "2026-02-24T10:30:00Z"
    }
  }
}
```

**Error Responses**:
- 404 NotFound: License not found

---

### 8. GET /licenses/{licenseId}/audit-trail

**Purpose**: Retrieve full audit trail for license

**Route**: `GET /api/licenses/{licenseId}/audit-trail`

**Authentication**: Required (admin role)

**Query Parameters**:
- `limit`: number (optional, default 50, max 500)
- `offset`: number (optional, default 0)
- `start_date`: ISO-8601 (optional) - Filter by date range
- `end_date`: ISO-8601 (optional)

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    audit_logs: [
      {
        id: "uuid",
        license_id: "uuid",
        previous_status: "ACTIVE",
        new_status: "SOFT_LOCKED",
        reason: "Payment failed for invoice INV-2026-001",
        actor_id: "uuid",
        actor_type: "ADMIN",
        timestamp: "2026-02-24T10:00:00Z",
        transition_metadata: {
          invoice_id: "INV-2026-001",
          payment_gateway: "stripe"
        }
      }
    ],
    pagination: {
      total_count: 45,
      limit: 50,
      offset: 0,
      has_more: false
    }
  }
}
```

**Error Responses**:
- 404 NotFound: License not found
- 400 BadRequest: Invalid query parameters

---

### 9. GET /licenses/{licenseId}/job-status/{jobId}

**Purpose**: Poll status of async job (snapshot_create, restore_from_archive, delete_license)

**Route**: `GET /api/licenses/{licenseId}/job-status/{jobId}`

**Authentication**: Optional (public, but may be restricted in MMC)

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    job: {
      id: "uuid",
      job_name: "snapshot_create",
      status: "IN_PROGRESS",  // QUEUED, IN_PROGRESS, COMPLETED, FAILED
      progress_percent: 75,
      eta_seconds: 120,
      retry_count: 0,
      created_at: "2026-02-24T10:30:00Z",
      started_at: "2026-02-24T10:31:00Z",
      completed_at: null,
      error: null
    },
    license_status: "SOFT_LOCKED"  // Current license status
  }
}
```

**Response** (200 OK - Completed):
```typescript
{
  success: true,
  data: {
    job: {
      id: "uuid",
      job_name: "snapshot_create",
      status: "COMPLETED",
      progress_percent: 100,
      created_at: "2026-02-24T10:30:00Z",
      completed_at: "2026-02-24T10:45:00Z",
      result: {
        snapshot_id: "uuid",
        snapshot_location: "s3://...",
        size_bytes: 1234567890,
        duration_ms: 600000
      }
    },
    license_status: "ARCHIVED"  // License now archived
  }
}
```

**Error Responses**:
- 404 NotFound: Job not found or expired
- 410 Gone: Job completed and result purged from cache

---

## HTTP Status Code Reference

| Status | Meaning | When Used |
|--------|---------|-----------|
| 200 OK | Synchronous operation completed | Soft lock, renew, state queries |
| 202 Accepted | Async operation initiated | Archive, restore, delete initiation |
| 400 Bad Request | Validation error or invalid state transition | Wrong license status |
| 401 Unauthorized | Missing or invalid authentication | No session |
| 403 Forbidden | Insufficient permissions or confirmation failed | Non-admin user |
| 404 Not Found | Resource not found | Invalid license ID |
| 410 Gone | Resource deleted | DELETED license access |
| 423 Locked | License SOFT_LOCKED (middleware) | Regular API access during soft lock |
| 426 Upgrade Required | Schema version incompatible | Restore with old schema |
| 500 Internal Server Error | Unexpected server error | Database/worker failures |
| 503 Service Unavailable | Dependent service down | Storage unavailable |
| 504 Gateway Timeout | Operation exceeded timeout | Restore or snapshot SLA exceeded |

---

## Header Requirements

### Request Headers

- `Content-Type: application/json` (for POST/PUT requests)
- `Authorization: Bearer {session_token}` (if auth required)
- `X-Correlation-ID: {uuid}` (optional; auto-generated if missing)

### Response Headers

- `Content-Type: application/json`
- `X-Correlation-ID: {uuid}` (echoes from request or generates)
- `Retry-After: {seconds}` (for soft-locked licenses, includes seconds until expiry)

---

## Header Requirements

### Request Headers

- `Content-Type: application/json` (for POST/PUT requests)
- `Authorization: Bearer {session_token}` (if auth required)
- `X-Correlation-ID: {uuid}` (optional; auto-generated if missing)
- `Accept: application/json` (recommended for all requests)
- `Idempotency-Key: {uuid}` (required for all POST endpoints; prevents duplicate operations)
- `X-2FA-Verified: {timestamp}` (for delete operations; timestamp of 2FA verification, must be < 5 min old)

### Response Headers

- `Content-Type: application/json`
- `X-Correlation-ID: {uuid}` (echoes from request or generates)
- `Retry-After: {seconds}` (for soft-locked licenses, includes seconds until expiry)
- `X-RateLimit-Limit: {count}` (requests allowed in window)
- `X-RateLimit-Remaining: {count}` (requests remaining in window)
- `X-RateLimit-Reset: {unix_timestamp}` (when rate limit window resets)

### 2FA Verification Header

For delete endpoints requiring 2FA:

**Mechanism**: `X-2FA-Verified` header with server-issued timestamp

1. Client authenticates with 2FA (separate auth flow)
2. Server returns 2FA timestamp in auth response (e.g., `2026-02-24T10:30:00Z`)
3. Client includes `X-2FA-Verified: 2026-02-24T10:30:00Z` in DELETE requests
4. Server validates: current_time - header_time < 5 minutes
5. If expired: return 401 Unauthorized with message "2FA session expired; re-authenticate"

**Alternative (recommended for MMC)**: Use secure cookie flag `__session-2fa-verified` (HTTP-only, secure) set by auth endpoint, automatically sent by browser.

---

## Rate Limiting

### Standard Limits (Applied to All Users)

- Login attempts: 5 per minute per IP
- State transitions (soft-lock, renew): 1 per license per minute
- Deletion initiation: 1 per license per 5 minutes
- Job status queries: 10 per minute per user
- Audit trail queries: 5 per minute per user

### Admin Bypass Tier (For Operations/Incident Response)

- Admin accounts bypass state transition limits (allow unlimited soft-lock/renew)
- Admin accounts bypass deletion rate limit (allow immediate retry if failed)
- Admin accounts bypass job polling limits
- Implementation: Check `user.role == 'admin'` in rate limiting middleware; skip counter for admin users

**Response Headers for Admins**:
```
X-RateLimit-Limit: unlimited
X-RateLimit-Remaining: unlimited
X-Admin-Bypass: true
```

---

## Error Codes Reference

Standard error codes returned in `error.code` field for all 4xx/5xx responses:

| Code | HTTP | Meaning | Remediation |
|------|------|---------|------------|
| `LICENSE_NOT_FOUND` | 404 | License doesn't exist | Verify license ID; may have been deleted |
| `LICENSE_WRONG_STATE` | 400 | License in unexpected state (e.g., renew on ACTIVE) | Check current license status; transition not allowed from current state |
| `LICENSE_ALREADY_ARCHIVED` | 400 | License already archived; archive operation rejected | Try restore operation if desired |
| `LICENSE_ALREADY_ACTIVE` | 400 | License already active; renew operation rejected | No action needed; license is operational |
| `LICENSE_NOT_SOFT_LOCKED` | 400 | Operation requires SOFT_LOCKED status | First initiate soft lock |
| `LICENSE_NOT_ARCHIVED` | 400 | Operation requires ARCHIVED status | First archive the license |
| `SNAPSHOT_NOT_FOUND` | 404 | Snapshot doesn't exist for archived license | Snapshot may have been deleted; restore not possible |
| `SNAPSHOT_FAILED` | 400 | Previous snapshot creation failed | Re-initiate archival; new snapshot will be attempted |
| `SCHEMA_INCOMPATIBLE` | 426 | Snapshot schema version incompatible with current product | Update workspace product version before restore OR contact support for migration assistance |
| `CONFIRMATION_PHRASE_MISMATCH` | 400 | Phrase doesn't match or is case-sensitive incorrect | Re-read confirmation phrase and enter exactly (spaces/case matter) |
| `CONFIRMATION_EXPIRED` | 400 | Confirmation phrase valid only 5 minutes; window closed | Re-initiate deletion (POST /delete/initiate) to get new phrase |
| `2FA_NOT_VERIFIED` | 401 | 2FA verification header missing or timestamp > 5 min old | Re-authenticate with 2FA; include fresh X-2FA-Verified header |
| `2FA_SESSION_EXPIRED` | 401 | 2FA session no longer valid | Re-authenticate (full login with 2FA) |
| `IDEMPOTENCY_KEY_MISSING` | 400 | POST request missing Idempotency-Key header | Add `Idempotency-Key: {uuid}` header to request |
| `IDEMPOTENCY_KEY_DUPLICATE` | 409 | Same Idempotency-Key submitted twice concurrently | Request already in progress; poll job status or wait for completion |
| `STORAGE_UNAVAILABLE` | 503 | S3 or snapshot service temporarily down | Retry after 30 seconds; if persistent, contact ops team |
| `RESTORE_SLA_EXCEEDED` | 504 | Restore took longer than size-based SLA | Large restore; operation succeeded but took longer than expected ETA |
| `UNAUTHORIZED` | 401 | User not authenticated or session invalid | Log in and re-authenticate |
| `FORBIDDEN` | 403 | User authenticated but lacks required permission (admin role) | User account doesn't have admin privileges; request from admin account |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests in rate limit window | Wait; standard user limits: 1 transition/min, 5 queries/min |
| `CONFLICT` | 409 | Operation conflicts with another in-flight operation | Concurrent delete/restore detected; operation blocked; retry in 5 seconds |
| `INTERNAL_ERROR` | 500 | Unexpected server error | Contact support; include X-Correlation-ID from response header |

**Example Error Response**:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SCHEMA_INCOMPATIBLE",
    "message": "Cannot restore: snapshot schema version 1.9.0 incompatible with current product version 2.0.0. Requires schema migration. Contact support.",
    "details": {
      "snapshot_schema_version": "1.9.0",
      "current_product_version": "2.0.0",
      "remediation_url": "https://support.zidney.com/migrations/schema-1.9-to-2.0"
    }
  }
}
```

---

## Webhooks (Optional Future Extension)

Future endpoints for webhook subscriptions:
- `POST /webhooks/subscribe` - Subscribe to license state change events
- `POST /webhooks/test` - Send test webhook
- Response formats: license_transitioned, snapshot_created, restoration_completed, deletion_confirmed

