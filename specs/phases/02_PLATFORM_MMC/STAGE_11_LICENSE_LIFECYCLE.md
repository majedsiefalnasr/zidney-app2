# STAGE 11 – License Lifecycle Operations

Phase: 2 – Platform MMC  
Status: Critical  
Scope: License state transitions, soft lock enforcement, archival process, restoration, and permanent deletion

---

## Objective

Define and enforce deterministic lifecycle behavior for Licenses.

Lifecycle must be:

- Strictly state-driven
- Fully auditable
- Infrastructure-coordinated
- Middleware-enforced
- Non-bypassable

Lifecycle logic must never be duplicated across services.
License status stored in master_db is the single source of truth.

---

## Authoritative States

Allowed states:

- ACTIVE
- SOFT_LOCKED
- ARCHIVED
- DELETED

State must be stored only in `licenses.status`.
`tenants_registry` must reflect license state and must not redefine it.

---

## State Definitions

### ACTIVE

- Workspace fully operational
- Tenant DB accessible
- Authentication allowed
- Attempt engine allowed
- All modules accessible (subject to product config)

### SOFT_LOCKED

- Login blocked (Backoffice + Frontoffice)
- API access blocked
- WebSocket blocked
- Data preserved
- 90-day grace window active
- Recoverable

### ARCHIVED

- Workspace inaccessible
- Snapshot retained
- Tenant DB not writable
- Resolver must return 403
- Recoverable

### DELETED

- Tenant DB dropped
- Snapshot removed
- Irreversible
- License permanently locked

---

## Allowed State Transitions

ACTIVE → SOFT_LOCKED  
SOFT_LOCKED → ACTIVE  
SOFT_LOCKED → ARCHIVED  
ARCHIVED → ACTIVE  
ARCHIVED → DELETED

Forbidden transitions:

ACTIVE → ARCHIVED  
ACTIVE → DELETED  
SOFT_LOCKED → DELETED

Transitions must be validated at service layer.

---

## Transition Enforcement Rules

All transitions must:

- Be executed through License Service
- Be wrapped in transaction
- Record audit log
- Record actor (MMC member id)
- Record timestamp
- Validate current state before change

Direct SQL updates to status are prohibited.

---

## Soft Lock Enforcement Model

When license transitions to SOFT_LOCKED:

- Set soft_lock_until = now + 90 days
- Block all authentication
- Block all tenant API routes
- Allow only lifecycle management endpoints

Enforcement must occur in:

- Tenant Resolver Middleware
- Authentication middleware

Soft lock expiration must NOT rely solely on cron.

Middleware must check:

If status = SOFT_LOCKED AND now > soft_lock_until
→ Auto-transition to ARCHIVED (atomic operation)

This guarantees deterministic expiration.

---

## Renewal During Soft Lock

If renewal occurs before expiration:

- Status → ACTIVE
- soft_lock_until cleared
- No reprovisioning
- No snapshot operation
- Access restored immediately

No data mutation allowed during restore.

---

## Archival Process (Infrastructure Coordinated)

Trigger:

- SOFT_LOCK expiration
- Manual archive (if already soft-locked)

Process (executed via Provisioning Service):

1. Ensure no in-progress attempts
2. Prevent new DB writes
3. Take full DB snapshot
4. Store snapshot metadata in master_db:
   - snapshot_id
   - snapshot_location
   - snapshot_timestamp
5. Mark status = ARCHIVED
6. Set archived_at timestamp

After ARCHIVED:

- Tenant Resolver returns 403
- No DB writes permitted
- Tenant DB may be detached or moved to archive namespace

Snapshot must be version-tagged.

---

## Restore From Archive

Executed only via MMC action.

Process:

1. Validate snapshot exists
2. Restore DB from snapshot
3. Validate schema_version compatibility
4. Set status = ACTIVE
5. Clear archived_at
6. Log restore event

Restore must be idempotent.

Restore must not alter business data.

---

## Permanent Deletion

Allowed only from ARCHIVED state.

Deletion requires:

- Explicit MMC confirmation
- Double confirmation step
- Confirmation phrase validation

Deletion process:

1. Drop tenant database
2. Delete snapshot
3. Remove tenant registry entry
4. Set status = DELETED
5. Set deleted_at timestamp
6. Preserve anonymized aggregated metrics only

Deletion is irreversible.

No automatic deletion allowed.

---

## Resolver-Level Enforcement

Tenant Resolver must enforce lifecycle before DB access.

If status:

ACTIVE → continue  
SOFT_LOCKED → 423  
ARCHIVED → 403  
DELETED → 404

No route handler may access tenant DB before lifecycle validation.

---

## Audit Requirements

Each transition must log:

- license_id
- previous_status
- new_status
- actor_id
- timestamp
- reason

Audit logs must be immutable.

---

## MMC UI Requirements

License detail page must display:

- Current status
- Soft lock countdown
- Archived timestamp
- Deleted timestamp
- Snapshot existence
- Product version
- Schema version
- Student usage count
- Staff usage count

Available actions must depend strictly on current state.

---

## Validation Criteria

Stage complete when:

- Soft lock blocks all tenant access
- Middleware auto-archives after expiration
- Snapshot stored with metadata
- Restore returns workspace to ACTIVE
- Permanent deletion requires confirmation
- DELETED license cannot be restored
- Tenant Resolver blocks non-ACTIVE states correctly
- Audit logs generated for all transitions

---

## Not Allowed

- Skipping SOFT_LOCK before ARCHIVED
- Direct delete from ACTIVE
- Manual DB manipulation
- Silent state transitions
- Editing lifecycle timestamps manually
- Partial restore

---

## Institutional Trust Principle

License lifecycle protects revenue, data integrity, and legal trust.

Data must never be:

- Accessible when unpaid
- Deleted without explicit action
- Archived without recoverability

Lifecycle must be deterministic, centralized, and middleware-enforced.

---

## Stage Status

Status: DRAFT
Risk Level: UNKNOWN
Initiated: 2026-02-24T00:00:00Z

Scope Open:

- Specification pending

Constitutional Compliance:

- Pending constitutional audit

Notes:
Stage initialized. Specification in progress.
