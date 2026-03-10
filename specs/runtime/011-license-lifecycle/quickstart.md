# Quickstart Guide: License Lifecycle Operations

**Stage**: STAGE 11 – License Lifecycle Operations  
**Phase**: 02 – Platform MMC  
**Audience**: Backend developers implementing Stage 11  
**Duration**: 20 minutes to understand core flows

---

## Prerequisites

- Familiarity with Zidney architecture (trust chain, database-per-tenant)
- Understanding of Hono framework and PostgreSQL
- Read: PROJECT_CONTEXT_PRIMER.md, AGENTS.md
- Review: data-model.md (table schemas)

---

## Quick Reference: Four-State Model

```
┌──────────────►──────────────┐
│                             │
│                             ▼
ACTIVE ─┬──────► SOFT_LOCKED ──────► ARCHIVED ─────► DELETED
        │                              ▲
        └──────────────────────────────┘
           (Renew)
```

| State           | Access                             | Can Transition To           |
| --------------- | ---------------------------------- | --------------------------- |
| **ACTIVE**      | Full read/write                    | SOFT_LOCKED only            |
| **SOFT_LOCKED** | Blocked (423), MMC only            | ACTIVE (renew) or ARCHIVED  |
| **ARCHIVED**    | Blocked (403), restore/delete only | ACTIVE (restore) or DELETED |
| **DELETED**     | 404 Not Found                      | Terminal (no recovery)      |

---

## Scenario 1: Payment Lapse (Soft Lock)

### Business Context

Payment processor detects failed payment. Billing system initiates soft lock to preserve data while
blocking access.

### Flow Diagram

```
Payment Failed (External)
           │
           ▼
    Billing System
           │
           ▼
POST /api/licenses/{id}/soft-lock
           │
           ▼
License Service validates: status = ACTIVE
           │
           ▼
Database Transaction:
  UPDATE licenses SET
    status = 'SOFT_LOCKED',
    soft_lock_until = now() + 90 days,
    updated_at = now()
  WHERE id = {license_id}
           │
           ▼
INSERT INTO license_audit_logs (
  license_id, previous_status='ACTIVE',
  new_status='SOFT_LOCKED', reason='Payment failed'
)
           │
           ▼
Response: 200 OK {license, soft_lock_until}
```

### Developer Implementation

**1. API Route** (`apps/api/src/routes/licenses.ts`):

```typescript
router.post("/licenses/:licenseId/soft-lock", async (ctx) => {
  const { licenseId } = ctx.req.param();
  const { reason } = ctx.req.json();

  const result = await licenseService.transitionToSoftLock(
    masterDb,
    licenseId,
    reason,
    ctx.get("user_id"),
  );

  return ctx.json({ success: true, data: { license: result.license } });
});
```

**2. License Service** (`packages/domain-core/src/license/service.ts`):

```typescript
export async function transitionToSoftLock(
  masterDb: Pool,
  licenseId: string,
  reason: string,
  actorId: string
): Promise<TransitionResult> {
  const client = await masterDb.connect()

  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

    // Validate current state
    const license = await client.query(
      'SELECT * FROM licenses WHERE id = $1 FOR UPDATE',
      [licenseId]
    )

    if (!license.rows.length || license.rows[0].status !== 'ACTIVE') {
      throw new StateTransitionError('License not in ACTIVE state')
    }

    // Transition: ACTIVE → SOFT_LOCKED
    const softLockUntil = new Date()
    softLockUntil.setSeconds(softLockUntil.getSeconds() + 7776000) // +90 days

    await client.query(
      `UPDATE licenses SET
        status = $2, soft_lock_until = $3, updated_at = now()
       WHERE id = $1`,
      [licenseId, 'SOFT_LOCKED', softLockUntil]
    )

    // Audit log
    await client.query(
      `INSERT INTO license_audit_logs
        (license_id, previous_status, new_status, actor_type,
         actor_id, reason, timestamp, correlation_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), $7, now())`,
      [licenseId, 'ACTIVE', 'SOFT_LOCKED', 'ADMIN', actorId, reason, ctx.get('correlation_id')]
    )

    await client.query('COMMIT')

    logger.info('License soft locked', {
      license_id: licenseId,
      soft_lock_until: softLockUntil,
      reason
    })

    return { success: true, license: {...}, previous_state: 'ACTIVE', new_state: 'SOFT_LOCKED' }
  } finally {
    client.release()
  }
}
```

---

## Scenario 2: 90-Day Automatic Expiration

### Business Context

Payment not received within 90-day grace period. System automatically transitions workspace to
ARCHIVED state on next user access attempt.

### Flow Diagram

```
Admin Sets SOFT_LOCK
soft_lock_until = 2026-05-24T10:30:00Z
           │ (90 days pass)
           ▼
2026-05-25: Student Attempts Login
           │
           ▼
Middleware License Check
           │
           ├─ Get license status = SOFT_LOCKED
           ├─ Check: now() > soft_lock_until?  ✓ YES
           │
           ▼
Auto-Transition (Middleware):
  Database Transaction:
    UPDATE licenses SET status='ARCHIVED', archived_at=now()
    INSERT audit_log record with actor_type='SYSTEM'
           │
           ▼
Return HTTP 403 Forbidden
"Workspace archived"
```

### Developer Implementation

**Middleware** (`apps/api/src/middleware/license-enforcement.ts`):

```typescript
async function licenseEnforcementMiddleware(ctx: Context, next: Next) {
  const workspace_slug = ctx.get("workspace_slug");
  const license = await resolver.getLicenseBySlug(workspace_slug);

  // Check for soft lock expiry
  if (license.status === "SOFT_LOCKED" && new Date() > new Date(license.soft_lock_until)) {
    // Auto-transition to ARCHIVED
    const client = await masterDb.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");

      // Double-check status (prevent race)
      const current = await client.query("SELECT status FROM licenses WHERE id = $1 FOR UPDATE", [
        license.id,
      ]);

      if (current.rows[0].status === "SOFT_LOCKED") {
        // Transition occurs here
        await client.query(
          `UPDATE licenses 
           SET status=$1, archived_at=now(), soft_lock_until=NULL, updated_at=now()
           WHERE id=$2`,
          ["ARCHIVED", license.id],
        );

        // Audit entry with SYSTEM actor
        await client.query(
          `INSERT INTO license_audit_logs 
            (...) VALUES (..., 'SYSTEM', 'Soft lock 90-day expiry', ...)`,
        );
      }

      await client.query("COMMIT");
    } finally {
      client.release();
    }

    // Return 403 (now ARCHIVED)
    return ctx.json(
      {
        success: false,
        data: null,
        error: { code: "LICENSE_ARCHIVED", message: "Workspace archived" },
      },
      { status: 403 },
    );
  }

  // Continue with other status checks...
  return await next();
}
```

---

## Scenario 3: Snapshot & Restore

### Business Context

Workspace is soft-locked. Admin archives it to preserve data, then 3 days later decides to restore
it.

### Flow Diagram: Archival

```
Admin clicks "Archive"
           │
           ▼
POST /api/licenses/{id}/archive → Returns 202 Accepted
           │
           ▼
Enqueue Job: snapshot_create
           │
           ▼
Worker Dequeues (async):
  1. pg_dump tenant DB
  2. Upload to S3: s3://snapshots/{license_id}/{timestamp}.tar.gz
  3. Record snapshot metadata in master_db
  4. Mark snapshot status = CREATED
           │
           ▼
Service: Transition SOFT_LOCKED → ARCHIVED
  Database Transaction:
    UPDATE licenses SET status='ARCHIVED', archived_at=now(), current_snapshot_id=...
    INSERT audit_log record
           │
           ▼
MMC UI: License now shows "Archived" status
```

### Flow Diagram: Restoration

```
Admin clicks "Restore"
           │
           ▼
POST /api/licenses/{id}/restore → Returns 202 Accepted
           │
           ▼
Enqueue Job: restore_from_archive
           │
           ▼
Worker Dequeues (async):
  1. Download snapshot from S3
  2. Validate checksum
  3. Drop existing tenant DB
  4. Restore from snapshot
  5. Validate row counts match
  6. Run forward migrations (if schema updated)
           │
           ▼
Service: Transition ARCHIVED → ACTIVE
  Database Transaction:
    UPDATE licenses SET status='ACTIVE', archived_at=NULL
    INSERT audit_log record
           │
           ▼
MMC UI: License now shows "Active" status
Workspace fully operational
```

### Developer Implementation

**Archive Initiation** (`packages/domain-core/src/license/service.ts`):

```typescript
export async function transitionToArchived(
  masterDb: Pool,
  licenseId: string,
  snapshotId: string,
  reason: string,
  actorId: string | null,
): Promise<TransitionResult> {
  // Validate snapshot exists and is CREATED
  const snapshot = await masterDb.query("SELECT * FROM snapshots WHERE id = $1", [snapshotId]);

  if (!snapshot.rows.length || snapshot.rows[0].status !== "CREATED") {
    throw new SnapshotFailedError("Snapshot not ready");
  }

  // Transaction: Update license + audit
  await masterDb.query(
    `UPDATE licenses SET 
      status='ARCHIVED', archived_at=now(), current_snapshot_id=$1, updated_at=now()
     WHERE id=$2`,
    [snapshotId, licenseId],
  );

  // Audit log
  // ...
}
```

**Restore Initiation** (`packages/domain-core/src/license/service.ts`):

```typescript
export async function restoreFromArchive(
  masterDb: Pool,
  licenseId: string,
  actorId: string,
): Promise<TransitionResult> {
  // Get license and snapshot
  const license = await masterDb.query(
    `SELECT l.*, s.id as snapshot_id, s.location, s.version_tag
     FROM licenses l
     JOIN snapshots s ON l.current_snapshot_id = s.id
     WHERE l.id = $1`,
    [licenseId],
  );

  // Validate schema compatibility
  const snapshotVersion = license.rows[0].version_tag;
  const currentVersion = license.rows[0].expected_schema_version;

  if (!isCompatible(snapshotVersion, currentVersion)) {
    throw new SchemaCompatibilityError("Snapshot version too old");
  }

  // Enqueue restore job
  const jobId = await enqueueJob(
    "restore_from_archive",
    {
      license_id: licenseId,
      snapshot_id: license.rows[0].snapshot_id,
      snapshot_location: license.rows[0].location,
    },
    ctx.get("correlation_id"),
    workspace_id,
  );

  return { success: true, job_id: jobId };
}
```

**Worker Processes** (`apps/worker/src/jobs/restore.ts`):

```typescript
export async function executeRestoreFromArchive(job: JobEnvelope) {
  const { license_id, snapshot_location } = job.payload

  try {
    // Download snapshot
    const snapshot = await s3.getObject(snapshot_location).promise()

    // Restore to tenant DB
    const tenantDb = getConnectionForLicense(license_id)
    await exec(`pg_restore --db-name tenant_dev < snapshot.sql`)

    // Validate
    const count = await tenantDb.query('SELECT COUNT(*) FROM students')

    // Update master DB
    await masterDb.query(
      `UPDATE licenses SET status='ACTIVE', archived_at=NULL WHERE id=$1`,
      [license_id]
    )

    logger.info('Restore completed', { license_id, duration_ms: ... })
  } catch (error) {
    logger.error('Restore failed', { license_id, error })
    throw error  // Will retry
  }
}
```

---

## Scenario 4: Permanent Deletion

### Business Context

Workspace is archived. Admin confirms permanent deletion with 2FA and confirmation phrase.
Non-recoverable operation.

### Flow Diagram

```
Admin clicks "Permanently Delete"
           │
           ▼
Opens Confirmation Dialog
Shows: "Type ABC12XYZ to confirm"
           │
           ▼
Admin types exact phrase + 2FA verified
           │
           ▼
POST /api/licenses/{id}/delete/confirm
{confirmation_id, confirmation_phrase}
           │
           ▼
Service validates:
  ✓ Confirmation phrase hash matches
  ✓ Not expired (< 5 min)
  ✓ 2FA verified
           │
           ▼
Enqueue Job: delete_license
           │
           ▼
Worker Dequeues (Transaction):
  1. Drop tenant database
  2. Delete snapshot from S3
  3. Remove registry entry
  4. Update license: status='DELETED', deleted_at=now()
           │
           ▼
Service: Creates final audit log
           │
           ▼
Any request to workspace: HTTP 404
```

### Developer Implementation

**Delete Initiation** (`apps/api/src/routes/licenses.ts`):

```typescript
router.post("/licenses/:licenseId/delete/initiate", async (ctx) => {
  // Generate confirmation phrase
  const phrase = generateRandomPhrase(24); // "CONFIRM_DELETE_ABC12XYZ"
  const hash = sha256(phrase);

  // Store in confirmations table
  await masterDb.query(
    `INSERT INTO license_deletion_confirmations 
      (id, license_id, confirmation_phrase_hash, actor_id, 
       confirmed_at, deletion_initiated_at, created_at)
     VALUES ($1, $2, $3, $4, now(), now(), now())`,
    [uuidv4(), licenseId, hash, userId],
  );

  return ctx.json({
    success: true,
    data: {
      confirmation_phrase: phrase,
      valid_until: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    },
  });
});
```

**Delete Confirmation** (`apps/api/src/routes/licenses.ts`):

```typescript
router.post("/licenses/:licenseId/delete/confirm", async (ctx) => {
  const { confirmation_id, confirmation_phrase } = ctx.req.json();

  // Validate confirmation
  const confirmation = await masterDb.query(
    "SELECT * FROM license_deletion_confirmations WHERE id = $1",
    [confirmation_id],
  );

  const phraseHash = sha256(confirmation_phrase);
  if (phraseHash !== confirmation.rows[0].confirmation_phrase_hash) {
    throw new InvalidConfirmationError("Phrase mismatch");
  }

  // Enqueue deletion
  const jobId = await enqueueJob("delete_license", {
    license_id: licenseId,
    actor_id: userId,
  });

  return ctx.json({ success: true, data: { job_id: jobId } });
});
```

**Worker Deletion** (`apps/worker/src/jobs/delete.ts`):

```typescript
export async function executeDeleteLicense(job: JobEnvelope) {
  const { license_id } = job.payload;

  const client = await masterDb.connect();

  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");

    // Get license and snapshot
    const license = await client.query(`SELECT * FROM licenses WHERE id = $1 FOR UPDATE`, [
      license_id,
    ]);

    if (license.rows[0].status !== "ARCHIVED") {
      throw new Error("License not in ARCHIVED state");
    }

    // 1. Drop tenant DB
    await dropDatabase(license.rows[0].workspace_id);

    // 2. Delete snapshot from S3
    if (license.rows[0].current_snapshot_id) {
      const snapshot = await client.query("SELECT snapshot_location FROM snapshots WHERE id = $1", [
        license.rows[0].current_snapshot_id,
      ]);
      await s3.deleteObject(snapshot.rows[0].snapshot_location).promise();
    }

    // 3. Remove registry entry
    await client.query("DELETE FROM tenants_registry WHERE license_id = $1", [license_id]);

    // 4. Update license
    await client.query(`UPDATE licenses SET status='DELETED', deleted_at=now() WHERE id=$1`, [
      license_id,
    ]);

    // 5. Audit log
    await client.query(`INSERT INTO license_audit_logs (...) VALUES (...)`);

    await client.query("COMMIT");
    logger.info("License deleted", { license_id });
  } finally {
    client.release();
  }
}
```

---

## Key Implementation Patterns

### Pattern 1: State Machine Validation

```typescript
// Always validate current state before transition
const validTransitions = {
  ACTIVE: ["SOFT_LOCKED"],
  SOFT_LOCKED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: ["ACTIVE", "DELETED"],
  DELETED: [],
};

function isValidTransition(from: string, to: string): boolean {
  return validTransitions[from]?.includes(to) ?? false;
}
```

### Pattern 2: Atomic Transactions

```typescript
// SELECT FOR UPDATE prevents race conditions
await db.query("BEGIN ISOLATION LEVEL SERIALIZABLE");

const current = await db.query("SELECT * FROM licenses WHERE id = $1 FOR UPDATE", [licenseId]);

// Verify state before mutation
if (current.rows[0].status !== expectedStatus) throw StateTransitionError;

// Update + audit in same transaction
await db.query("UPDATE licenses SET ...");
await db.query("INSERT INTO license_audit_logs ...");

await db.query("COMMIT");
```

### Pattern 3: Idempotent Restore

```typescript
// Restore is idempotent: can be called twice safely
export async function executeRestore(job: JobEnvelope) {
  const { license_id } = job.payload;

  // Check if already restored (should be ACTIVE)
  const license = await db.query("SELECT status FROM licenses WHERE id = $1", [license_id]);
  if (license.rows[0].status === "ACTIVE") {
    return { success: true }; // Already restored
  }

  // Restore normally...
}
```

---

## Testing Strategy (Quick Reference)

### Unit Tests

```typescript
// Test state machine validation
expect(isValidTransition("ACTIVE", "ARCHIVED")).toBe(false);
expect(isValidTransition("ACTIVE", "SOFT_LOCKED")).toBe(true);

// Test soft lock calculation
const until = calculateSoftLockUntil(now);
expect(until.getTime() - now.getTime()).toBe(90 * 24 * 60 * 60 * 1000);
```

### Integration Tests

```typescript
// Full flow: ACTIVE → SOFT_LOCKED → ARCHIVED → DELETED
const license = createTestLicense({ status: "ACTIVE" });

// Soft lock
await licenseService.transitionToSoftLock(db, license.id, "test");
expect(
  (await db.query("SELECT status FROM licenses WHERE id = $1", [license.id])).rows[0].status,
).toBe("SOFT_LOCKED");

// Archive
const snapshot = createTestSnapshot({ license_id: license.id });
await licenseService.transitionToArchived(db, license.id, snapshot.id, "test", userId);
expect((await db.query("...")).rows[0].status).toBe("ARCHIVED");

// Delete
await workerJobs.executeDeleteLicense({ payload: { license_id: license.id } });
expect((await db.query("...")).rows[0].status).toBe("DELETED");
```

---

## Common Mistakes to Avoid

❌ **Don't**:

- Skip SOFT_LOCKED state (can't go ACTIVE → ARCHIVED directly)
- Update license.status with raw SQL (use License Service)
- Trust client time for expiry checks (use server time only)
- Restore without schema compatibility validation
- Allow deletion without 2FA + confirmation phrase

✓ **Do**:

- Always wrap transitions in SERIALIZABLE transactions
- Use SELECT FOR UPDATE to prevent race conditions
- Create audit log entries with every state change
- Make restore operations idempotent
- Log all lifecycle events with correlation_id

---

## Next Steps

1. **Implement** the License Service methods (transitionToSoftLock, renewLicense, archive, restore,
   delete)
2. **Extend** the licenses table schema (soft_lock_until, archived_at, deleted_at,
   current_snapshot_id)
3. **Create** worker jobs (snapshot_create, restore_from_archive, delete_license)
4. **Add** API routes for all transitions
5. **Update** Tenant Resolver middleware to enforce license status
6. **Build** MMC UI for license management
7. **Test** full state machine lifecycle

---

## Resources

- [License Service Contract](contracts/license-service.md) - Detailed method signatures
- [Worker Jobs Contract](contracts/worker-jobs.md) - Job execution specs
- [API Endpoints Contract](contracts/api-endpoints.md) - Route specifications
- [Data Model](data-model.md) - Schema definitions
- [Tenant Resolver Contract](contracts/tenant-resolver.md) - Middleware integration
