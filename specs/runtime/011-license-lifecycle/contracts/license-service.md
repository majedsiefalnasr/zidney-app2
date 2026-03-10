# License Service API Contract

**Stage**: STAGE 11 – License Lifecycle Operations  
**Phase**: 02 – Platform MMC  
**Interface**: Domain Service (Internal)  
**Location**: `packages/domain-core/src/license/service.ts`

---

## Overview

The License Service is the authoritative entry point for all license state transitions. It enforces
the four-state model, validates transitions, and produces immutable audit logs. No direct SQL
updates to licenses.status are allowed; all changes route through these methods.

---

## Core Methods

### 1. transitionToSoftLock()

**Purpose**: Transition a license from ACTIVE to SOFT_LOCKED

**Signature**:

```typescript
async transitionToSoftLock(
  masterDb: Pool,
  licenseId: string,
  reason: string,
  actorId: string | null // null for system-triggered
): Promise<TransitionResult>
```

**Input Parameters**:

- `masterDb`: PostgreSQL connection pool
- `licenseId`: UUID of license to soft lock
- `reason`: String describing reason (e.g., "Payment failed for invoice INV-2026-001")
- `actorId`: UUID of MMC user (if manual) or null (if system)

**Validation**:

- License exists and status = ACTIVE
- Reject if status ≠ ACTIVE with StateTransitionError: "Cannot soft lock a license that is not
  ACTIVE"

**Side Effects**:

- Set `soft_lock_until = now() + 7776000 seconds (90 days)` in UTC
- Set `updated_at = now()`
- Create audit log entry with previous_status=ACTIVE, new_status=SOFT_LOCKED
- Return HTTP 200 on success

**Return**:

```typescript
{
  success: true,
  license: License,
  previous_state: "ACTIVE",
  new_state: "SOFT_LOCKED"
}
```

**Error Cases**:

- `StateTransitionError` (400): License not in ACTIVE state
- `LicenseNotFoundError` (404): License ID not found
- `DatabaseError` (500): Transaction failed

---

### 2. transitionToActive()

**Purpose**: Renew a soft-locked license back to ACTIVE state

**Signature**:

```typescript
async transitionToActive(
  masterDb: Pool,
  licenseId: string,
  reason: string,
  actorId: string
): Promise<TransitionResult>
```

**Input Parameters**:

- `masterDb`: PostgreSQL connection pool
- `licenseId`: UUID of license to renew
- `reason`: String (e.g., "Payment received and processed")
- `actorId`: UUID of MMC user performing action

**Validation**:

- License exists and status = SOFT_LOCKED
- Reject if status ≠ SOFT_LOCKED with StateTransitionError

**Side Effects**:

- Set `soft_lock_until = NULL` (clear grace period)
- Set `updated_at = now()`
- Create audit log entry with previous_status=SOFT_LOCKED, new_status=ACTIVE
- No reprovisioning or data mutation occurs
- Tenant database remains intact and writable

**Return**:

```typescript
{
  success: true,
  license: License,
  previous_state: "SOFT_LOCKED",
  new_state: "ACTIVE"
}
```

**Error Cases**:

- `StateTransitionError` (400): License not in SOFT_LOCKED state
- `LicenseNotFoundError` (404): License ID not found

---

### 3. transitionToArchived()

**Purpose**: Transition a license from SOFT_LOCKED to ARCHIVED state

**Signature**:

```typescript
async transitionToArchived(
  masterDb: Pool,
  licenseId: string,
  snapshotId: string,
  reason: string,
  actorId: string | null
): Promise<TransitionResult>
```

**Input Parameters**:

- `masterDb`: PostgreSQL connection pool
- `licenseId`: UUID of license to archive
- `snapshotId`: UUID of snapshot created by worker
- `reason`: String (e.g., "Soft lock expired" or "Manual archive requested")
- `actorId`: UUID of MMC user (null for auto-expiry)

**Validation**:

- License exists and status = SOFT_LOCKED
- Snapshot exists and status = CREATED
- Current time > soft_lock_until (for auto-expiry)
- Reject if status ≠ SOFT_LOCKED with StateTransitionError

**Side Effects**:

- Set `archived_at = now()`
- Set `soft_lock_until = NULL`
- Set `current_snapshot_id = snapshotId`
- Set `updated_at = now()`
- Create audit log entry with previous_status=SOFT_LOCKED, new_status=ARCHIVED
- Enqueue background job to notify stakeholders

**Return**:

```typescript
{
  success: true,
  license: License,
  previous_state: "SOFT_LOCKED",
  new_state: "ARCHIVED",
  archive_timestamp: Date,
  snapshot_id: string
}
```

**Error Cases**:

- `StateTransitionError` (400): License not in SOFT_LOCKED state or snapshot not ready
- `SnapshotNotFoundError` (404): Snapshot ID not found
- `SnapshotFailedError` (400): Snapshot has status=FAILED (not restorable)
- `LicenseNotFoundError` (404): License ID not found

---

### 4. restoreFromArchive()

**Purpose**: Restore a license from ARCHIVED to ACTIVE state

**Signature**:

```typescript
async restoreFromArchive(
  masterDb: Pool,
  licenseId: string,
  actorId: string
): Promise<TransitionResult>
```

**Input Parameters**:

- `masterDb`: PostgreSQL connection pool
- `licenseId`: UUID of license to restore
- `actorId`: UUID of MMC user initiating restore

**Validation**:

- License exists and status = ARCHIVED
- Snapshot exists, has status = CREATED, and size_bytes <= 500GB
- Version compatibility: snapshot.version_tag matches current product schema_version (or is eligible
  for auto-migration)
- Reject if status ≠ ARCHIVED with StateTransitionError
- Reject if snapshot.status ≠ CREATED with SnapshotFailedError

**Side Effects**:

- Enqueue `restore_from_archive` worker job (idempotent, 3 retries)
- Worker restores tenant database from snapshot atomically
- Worker validates restore integrity (checksum validation if available)
- Upon worker success:
  - Set `archived_at = NULL`
  - Set `current_snapshot_id = NULL` (snapshot no longer needed for access)
  - Set `status = ACTIVE`
  - Set `updated_at = now()`
  - Create audit log entry with previous_status=ARCHIVED, new_status=ACTIVE
- Upon worker failure:
  - Keep status = ARCHIVED
  - Create audit log entry with event_type = RESTORE_FAILED
  - Alert admin with error details

**Idempotency**:

- If restore attempt submitted twice with same license_id before first completes
- Second attempt dequeued and processed atomically
- Both complete successfully with identical end state (no data corruption)

**Return**:

```typescript
{
  success: true,
  license: License,
  previous_state: "ARCHIVED",
  new_state: "ACTIVE",
  restore_timestamp: Date,
  restore_job_id: string
}
```

**Error Cases**:

- `StateTransitionError` (400): License not in ARCHIVED state
- `SnapshotFailedError` (400): Snapshot has status=FAILED
- `SchemaCompatibilityError` (426): Snapshot version incompatible
- `RestoreTimeoutError` (504): Restore exceeded SLA timeout
- `LicenseNotFoundError` (404): License ID not found

---

### 5. transitionToDeleted()

**Purpose**: Permanently delete a license and its associated tenant database

**Signature**:

```typescript
async transitionToDeleted(
  masterDb: Pool,
  licenseId: string,
  confirmationPhraseHash: string,
  actorId: string
): Promise<TransitionResult>
```

**Input Parameters**:

- `masterDb`: PostgreSQL connection pool
- `licenseId`: UUID of license to delete
- `confirmationPhraseHash`: SHA256 hash of confirmation phrase (must match stored hash)
- `actorId`: UUID of MMC user (admin only)

**Validation**:

- License exists and status = ARCHIVED
- Confirmation record exists for this license
- Confirmation phrase hash matches stored hash
- 2FA verified in middleware before calling this method
- Reject if status ≠ ARCHIVED with StateTransitionError
- Reject if confirmation hash mismatch with InvalidConfirmationError
- Reject if confirmation expired (>5 minutes old) with ConfirmationExpiredError

**Side Effects**:

- Enqueue `delete_license` worker job with license_id
- Worker executes in transaction (all-or-nothing):
  1. Drop tenant database
  2. Delete snapshot from S3
  3. Remove tenant registry entry
  4. Update licenses: set status=DELETED, deleted_at=now()
- Upon worker success:
  - Set `deleted_at = now()`
  - Set `status = DELETED`
  - Set `current_snapshot_id = NULL`
  - Create audit log entry with previous_status=ARCHIVED, new_status=DELETED
  - Create deletion confirmation log
- Upon worker failure:
  - Workspace remains ARCHIVED
  - Alert admin with error for manual cleanup
  - Log error to audit trail

**Return**:

```typescript
{
  success: true,
  license: License,
  previous_state: "ARCHIVED",
  new_state: "DELETED",
  deleted_at: Date
}
```

**Error Cases**:

- `StateTransitionError` (400): License not in ARCHIVED state
- `InvalidConfirmationError` (403): Confirmation phrase mismatch
- `ConfirmationExpiredError` (410): Confirmation expired
- `UnrecoverableError` (500): Deletion process failed (manual intervention required)
- `LicenseNotFoundError` (404): License ID not found
- `ForbiddenError` (403): User not authorized (non-admin)

---

## Helper Methods

### 6. getLicenseById()

**Purpose**: Retrieve license by ID (read-only)

**Signature**:

```typescript
async getLicenseById(
  masterDb: Pool,
  licenseId: string
): Promise<License | null>
```

**Returns**: License object or null if not found

---

### 7. getLicenseByWorkspaceSlug()

**Purpose**: Retrieve license by workspace slug (read-only)

**Signature**:

```typescript
async getLicenseByWorkspaceSlug(
  masterDb: Pool,
  workspaceSlug: string
): Promise<License | null>
```

**Returns**: License object or null if not found

---

### 8. getAuditTrail()

**Purpose**: Retrieve full audit history for a license

**Signature**:

```typescript
async getAuditTrail(
  masterDb: Pool,
  licenseId: string,
  limit: number = 100
): Promise<AuditLogEntry[]>
```

**Returns**: Array of audit log entries, ordered by timestamp DESC (newest first)

---

### 9. getSnapshot()

**Purpose**: Retrieve snapshot metadata for archived license

**Signature**:

```typescript
async getSnapshot(
  masterDb: Pool,
  snapshotId: string
): Promise<ArchiveSnapshot | null>
```

**Returns**: Snapshot object or null if not found

---

## Error Types

All errors follow Zidney standard envelope:

```typescript
interface ErrorResponse {
  success: false;
  data: null;
  error: {
    code: string; // Machine-readable code
    message: string; // Human-readable message
  };
}
```

### Error Code Reference

| Error Code                 | HTTP Status | Description                           |
| -------------------------- | ----------- | ------------------------------------- |
| STATE_TRANSITION_ERROR     | 400         | Invalid state transition              |
| LICENSE_NOT_FOUND          | 404         | License ID doesn't exist              |
| SNAPSHOT_NOT_FOUND         | 404         | Snapshot ID doesn't exist             |
| SNAPSHOT_FAILED            | 400         | Snapshot has status=FAILED            |
| SCHEMA_COMPATIBILITY_ERROR | 426         | Snapshot version incompatible         |
| RESTORE_TIMEOUT_ERROR      | 504         | Restore exceeded SLA                  |
| INVALID_CONFIRMATION       | 403         | Confirmation phrase mismatch          |
| CONFIRMATION_EXPIRED       | 410         | Confirmation expired                  |
| UNRECOVERABLE_ERROR        | 500         | Permanent error (manual intervention) |
| FORBIDDEN_ERROR            | 403         | User not authorized                   |
| DATABASE_ERROR             | 500         | Transaction failed                    |

---

## Transaction Semantics

All transition methods use PostgreSQL transactions with:

- **Isolation Level**: SERIALIZABLE (prevents race conditions)
- **Locking**: SELECT ... FOR UPDATE on licenses row
- **Atomicity**: All-or-nothing: state change + audit log + metadata updates
- **Durability**: Committed to disk before method returns
- **Rollback**: Any error rolls back entire transaction

---

## Logging & Structured Events

Each transition logs structured JSON events:

```json
{
  "timestamp": "2026-02-24T10:30:00Z",
  "level": "info",
  "service": "license-service",
  "event": "license_transition",
  "license_id": "uuid",
  "workspace_slug": "acme-corp",
  "old_status": "ACTIVE",
  "new_status": "SOFT_LOCKED",
  "reason": "Payment failed for invoice INV-2026-001",
  "actor_id": "uuid",
  "actor_type": "ADMIN",
  "correlation_id": "uuid",
  "duration_ms": 145
}
```

---

## Idempotency Guarantees

- **Soft Lock**: Re-soft-locking same license succeeds identically (idempotent)
- **Renewal**: Re-renewing same license succeeds identically
- **Archive**: Re-archiving same license succeeds identically (uses same snapshot)
- **Restore**: Re-restoring same snapshot produces identical state (atomic restore)
- **Delete**: Delete already deleted license returns error (not idempotent; prevents
  misunderstanding)

---

## Version Compatibility

All methods validate version compatibility before operations:

- Soft lock: No version check (same version)
- Renew: No version check (same version)
- Archive: Snapshot version_tag stored = current snapshot.version_tag
- Restore: Snapshot version_tag must be ≤ current licenses.schema_version (or auto-migrable)
- Delete: No version check (data being destroyed)
