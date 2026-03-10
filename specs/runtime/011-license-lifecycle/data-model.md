# Data Model: License Lifecycle Operations

**Stage**: STAGE 11 – License Lifecycle Operations  
**Phase**: 02 – Platform MMC  
**Created**: 2026-02-24

---

## Executive Summary

This document defines the complete data model for license lifecycle operations, including schema
extensions, new tables, relationships, validations, and state transitions. All entities are stored
in the master database (PostgreSQL) to ensure transactional consistency across license states.

---

## Core Entities & Schema

### 1. licenses table (Extended)

**Purpose**: Single source of truth for workspace license lifecycle state

**Existing Columns** (from License interface):

- `id` (UUID, Primary Key)
- `product_id` (UUID, Foreign Key → products)
- `workspace_id` (UUID, Foreign Key → workspaces)
- `workspace_slug` (VARCHAR 255, UNIQUE, immutable)
- `status` (ENUM: ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED)
- `expected_schema_version` (VARCHAR 20, immutable, SemVer)
- `expected_product_version` (VARCHAR 20, immutable, SemVer)
- `student_limit` (INT NULL, NULL = unlimited)
- `staff_limit` (INT NULL, NULL = unlimited)
- `created_at` (TIMESTAMP UTC, immutable)
- `updated_at` (TIMESTAMP UTC, updated on every transition)

**New Columns** (License Lifecycle Stage):

- `soft_lock_until` (TIMESTAMP UTC NULL)
  - Non-NULL only when status = SOFT_LOCKED
  - Set to now() + 90 days (7776000 seconds) at ACTIVE → SOFT_LOCKED transition
  - Cleared when status changes away from SOFT_LOCKED
  - Used by middleware to detect auto-expiration

- `archived_at` (TIMESTAMP UTC NULL)
  - Non-NULL only when status = ARCHIVED
  - Set to now() at SOFT_LOCKED → ARCHIVED transition
  - Immutable once set (never modified)
  - Used for audit trail and recovery window tracking

- `deleted_at` (TIMESTAMP UTC NULL)
  - Non-NULL only when status = DELETED
  - Set to now() at ARCHIVED → DELETED transition
  - Immutable once set
  - Marks permanent deletion timestamp for compliance

- `current_snapshot_id` (UUID NULL, Foreign Key → snapshots)
  - References the active snapshot (if any)
  - Updated when transitioning to ARCHIVED
  - Set to NULL if snapshot is deleted
  - Enables quick snapshot lookup without join

**Schema Constraints**:

```sql
ALTER TABLE licenses ADD CONSTRAINT chk_license_status
  CHECK (status IN ('ACTIVE', 'SOFT_LOCKED', 'ARCHIVED', 'DELETED'));

ALTER TABLE licenses ADD CONSTRAINT chk_soft_lock_until_consistency
  CHECK (
    (status = 'SOFT_LOCKED' AND soft_lock_until IS NOT NULL) OR
    (status != 'SOFT_LOCKED' AND soft_lock_until IS NULL)
  );

ALTER TABLE licenses ADD CONSTRAINT chk_archived_at_consistency
  CHECK (
    (status = 'ARCHIVED' AND archived_at IS NOT NULL) OR
    (status != 'ARCHIVED' AND archived_at IS NULL)
  );

ALTER TABLE licenses ADD CONSTRAINT chk_deleted_at_consistency
  CHECK (
    (status = 'DELETED' AND deleted_at IS NOT NULL) OR
    (status != 'DELETED' AND deleted_at IS NULL)
  );

ALTER TABLE licenses ADD CONSTRAINT uk_workspace_slug UNIQUE (workspace_slug);

CREATE INDEX idx_licenses_workspace_id ON licenses(workspace_id);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_soft_lock_until ON licenses(soft_lock_until)
  WHERE status = 'SOFT_LOCKED';
CREATE INDEX idx_licenses_archived_at ON licenses(archived_at)
  WHERE status = 'ARCHIVED';
```

---

### 2. snapshots table (New)

**Purpose**: Immutable record of archived workspace database snapshots

**Columns**:

- `id` (UUID, Primary Key)
- `license_id` (UUID, Foreign Key → licenses, NOT NULL)
- `snapshot_location` (VARCHAR 512, NOT NULL)
  - S3 URI format: `s3://snapshots/{license_id}/{timestamp}.tar.gz`
  - Deterministically calculated (license_id + server timestamp)
  - Immutable once created
- `snapshot_timestamp` (TIMESTAMP UTC, NOT NULL)
  - Exact UTC time snapshot was captured
  - Used for deduplication check (prevent multiple snapshots at same second)
  - Used to reconstruct snapshot path for integrity validation
- `version_tag` (VARCHAR 20, NOT NULL)
  - SemVer of schema_version at snapshot time
  - Used to validate restore compatibility
  - Matches licenses.expected_schema_version at snapshot creation
- `size_bytes` (BIGINT, NOT NULL)
  - Size of snapshot in S3 for quota tracking
  - Used for SLA estimation (small/medium/large categorization)
- `status` (ENUM: CREATED, FAILED, NOT NULL)
  - CREATED: Snapshot successfully captured
  - FAILED: Snapshot capture failed (worker retry exhausted)
  - Only CREATED snapshots are restorable
- `failure_reason` (TEXT NULL)
  - Non-NULL only when status = FAILED
  - Error message from failed capture attempt
  - Used for admin troubleshooting

- `created_at` (TIMESTAMP UTC, NOT NULL, immutable)
  - Timestamp when snapshot record was created

- `deleted_at` (TIMESTAMP UTC NULL)
  - Non-NULL only if snapshot deleted with license
  - Null for snapshots still retained
  - Used to identify archived snapshots for purge operations

**Schema Constraints**:

```sql
ALTER TABLE snapshots ADD CONSTRAINT fk_snapshots_license_id
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE;

ALTER TABLE snapshots ADD CONSTRAINT chk_snapshot_status
  CHECK (status IN ('CREATED', 'FAILED'));

ALTER TABLE snapshots ADD CONSTRAINT chk_failure_reason_consistency
  CHECK (
    (status = 'FAILED' AND failure_reason IS NOT NULL) OR
    (status = 'CREATED' AND failure_reason IS NULL)
  );

ALTER TABLE snapshots ADD CONSTRAINT uk_license_one_active_snapshot
  UNIQUE (license_id) WHERE deleted_at IS NULL;
  -- Only one non-deleted snapshot per license

CREATE INDEX idx_snapshots_license_id ON snapshots(license_id);
CREATE INDEX idx_snapshots_status ON snapshots(status);
CREATE INDEX idx_snapshots_created_at ON snapshots(created_at);
```

---

### 3. license_audit_logs table (New)

**Purpose**: Immutable audit trail of all license state transitions

**Columns**:

- `id` (UUID, Primary Key)
- `license_id` (UUID, Foreign Key → licenses, NOT NULL)
  - References the license being transitioned
- `previous_status` (ENUM, NOT NULL)
  - Status before transition: ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED
  - Used to reconstruct full state history
- `new_status` (ENUM, NOT NULL)
  - Status after transition
  - Same enum as previous_status
- `actor_id` (UUID Foreign Key → mmc_users, NULL)
  - User who initiated the transition (NULL for auto-transitions like expiry)
  - Used for compliance auditing
- `actor_type` (ENUM: ADMIN, SYSTEM)
  - ADMIN: Manual action by MMC user
  - SYSTEM: Automatic action (e.g., soft lock expiry)
  - Distinguishes manual vs. automatic transitions
- `reason` (VARCHAR 512, NOT NULL)
  - Business reason for transition
  - Examples: "Payment failed", "90-day soft lock expiry", "Admin manual archive", "License deleted
    per institution request"
- `transition_metadata` (JSONB, NULL)
  - Optional structured data specific to transition type
  - Examples:

    ```json
    // SOFT_LOCK: Payment failure info
    { "invoice_id": "INV-2026-001", "payment_gateway": "stripe" }

    // ARCHIVE: Snapshot details
    { "snapshot_id": "uuid", "snapshot_location": "s3://...", "size_bytes": 1234567 }

    // RESTORE: Version info
    { "from_version": "1.0.0", "to_version": "2.0.0", "restore_duration_ms": 45000 }

    // DELETE: Confirmation details
    { "deletion_type": "permanent", "grace_period_applied": false, "actor_email": "admin@mmc" }
    ```

- `timestamp` (TIMESTAMP UTC, NOT NULL)
  - Exact time of transition (server-generated)
  - Immutable once written
- `correlation_id` (UUID, NOT NULL)
  - Links to request correlation ID for tracing
  - Used to correlate with structured logs
- `created_at` (TIMESTAMP UTC, NOT NULL, immutable)
  - Record creation timestamp (should equal `timestamp` column)

**Schema Constraints**:

```sql
ALTER TABLE license_audit_logs ADD CONSTRAINT fk_audit_license_id
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE RESTRICT;
  -- Prevent accidental license deletion with active audit records

ALTER TABLE license_audit_logs ADD CONSTRAINT fk_audit_actor_id
  FOREIGN KEY (actor_id) REFERENCES mmc_users(id) ON DELETE SET NULL;
  -- Allow user deletion without breaking audit trail

ALTER TABLE license_audit_logs ADD CONSTRAINT chk_audit_status_valid
  CHECK (previous_status IN ('ACTIVE', 'SOFT_LOCKED', 'ARCHIVED', 'DELETED') AND
         new_status IN ('ACTIVE', 'SOFT_LOCKED', 'ARCHIVED', 'DELETED'));

ALTER TABLE license_audit_logs ADD CONSTRAINT chk_audit_actor_type
  CHECK (actor_type IN ('ADMIN', 'SYSTEM'));

ALTER TABLE license_audit_logs ADD CONSTRAINT chk_audit_natural_transition
  CHECK (previous_status != new_status);
  -- Prevent reflexive transitions

CREATE INDEX idx_audit_license_id ON license_audit_logs(license_id);
Create INDEX idx_audit_timestamp ON license_audit_logs(timestamp);
Create INDEX idx_audit_correlation_id ON license_audit_logs(correlation_id);
```

---

### 4. tenants_registry table (Extended)

**Purpose**: Quick lookup of license status without cross-db joins

**Existing Columns**:

- `id` (UUID, Primary Key)
- `workspace_slug` (VARCHAR 255, UNIQUE)
- `workspace_id` (UUID, Foreign Key → workspaces)

**New Columns** (License Lifecycle Management):

- `license_status` (ENUM: ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED)
  - Mirrors licenses.status for quick lookup
  - Populated from licenses table
  - Synchronized hourly by reconciliation job
  - Used as fallback if licenses table connection fails

- `license_id` (UUID, Foreign Key → licenses)
  - Denormalized license reference for joins
- `sync_status` (ENUM: IN_SYNC, OUT_OF_SYNC)
  - IN_SYNC: Matches licenses table
  - OUT_OF_SYNC: Stale data (reconciliation pending)
- `last_synced_at` (TIMESTAMP UTC, NOT NULL)
  - Last time record was synced with licenses table
  - Used to detect stale records

**Constraints**:

```sql
ALTER TABLE tenants_registry ADD CONSTRAINT fk_registry_license_id
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE;

ALTER TABLE tenants_registry ADD CONSTRAINT chk_registry_status
  CHECK (license_status IN ('ACTIVE', 'SOFT_LOCKED', 'ARCHIVED', 'DELETED'));

ALTER TABLE tenants_registry ADD CONSTRAINT chk_sync_status
  CHECK (sync_status IN ('IN_SYNC', 'OUT_OF_SYNC'));

CREATE INDEX idx_registry_license_status ON tenants_registry(license_status);
CREATE INDEX idx_registry_last_synced_at ON tenants_registry(last_synced_at);
```

---

### 5. license_deletion_confirmations table (New)

**Purpose**: Track double-confirmation deletions for compliance

**Columns**:

- `id` (UUID, Primary Key)
- `license_id` (UUID, Foreign Key → licenses, NOT NULL)
- `confirmation_phrase_hash` (VARCHAR 64, NOT NULL)
  - SHA256 hash of confirmation phrase (never store plaintext)
  - Generated randomly at deletion initiation
- `actor_id` (UUID, Foreign Key → mmc_users, NOT NULL)
  - MMC user who initiated deletion
- `confirmed_at` (TIMESTAMP UTC, NOT NULL)
  - When confirmation was completed
- `grace_period_until` (TIMESTAMP UTC NULL)
  - If grace period enabled: When workspace is recoverable until
  - If NULL: Deletion is permanent immediately
- `deletion_initiated_at` (TIMESTAMP UTC, NOT NULL)
  - When deletion was first requested (before confirmation)
- `created_at` (TIMESTAMP UTC, NOT NULL)

**Constraints**:

```sql
ALTER TABLE license_deletion_confirmations ADD CONSTRAINT
  fk_deletion_license_id FOREIGN KEY (license_id)
  REFERENCES licenses(id) ON DELETE CASCADE;

ALTER TABLE license_deletion_confirmations ADD CONSTRAINT
  fk_deletion_actor_id FOREIGN KEY (actor_id)
  REFERENCES mmc_users(id) ON DELETE RESTRICT;

CREATE INDEX idx_deletion_license_id ON license_deletion_confirmations(license_id);
Create INDEX idx_deletion_actor_id ON license_deletion_confirmations(actor_id);
```

---

## State Machine Validations

### Valid State Transitions

```
ACTIVE
  ├─→ SOFT_LOCKED (payment failure, soft lock triggered)
  └─(cannot go directly to ARCHIVED or DELETED)

SOFT_LOCKED
  ├─→ ACTIVE (renewal/payment received)
  ├─→ ARCHIVED (auto-expiry after 90 days OR manual archive)
  └─(cannot go directly to DELETED)

ARCHIVED
  ├─→ ACTIVE (restore from snapshot)
  ├─→ DELETED (permanent deletion confirmed)
  └─(cannot go back to SOFT_LOCKED)

DELETED
  └─(terminal state, no transitions possible)
```

### Invalid Transitions (Rejected with ValidationError)

- ACTIVE → ARCHIVED (must pass through SOFT_LOCKED)
- ACTIVE → DELETED (must pass through SOFT_LOCKED then ARCHIVED)
- SOFT_LOCKED → DELETED (must go through ARCHIVED first)
- DELETED → \* (terminal, no recovery)

---

## State-Specific Field Behavior

### ACTIVE State

- `soft_lock_until`: MUST BE NULL
- `archived_at`: MUST BE NULL
- `deleted_at`: MUST BE NULL
- `current_snapshot_id`: NULL (no snapshot needed)
- Database: Writable, fully operational

### SOFT_LOCKED State

- `soft_lock_until`: POPULATED (now + 90 days)
- `archived_at`: MUST BE NULL
- `deleted_at`: MUST BE NULL
- `current_snapshot_id`: NULL (snapshot created only on archive)
- Database: Read-only access, no writes allowed (auth blocked)

### ARCHIVED State

- `soft_lock_until`: MUST BE NULL (cleared from SOFT_LOCKED)
- `archived_at`: POPULATED (timestamp of archive)
- `deleted_at`: MUST BE NULL
- `current_snapshot_id`: POPULATED (references snapshot in snapshots table)
- Database: Inaccessible (not connected to)
- Snapshot: Exists and is restorable (if CREATED status)

### DELETED State

- `soft_lock_until`: MUST BE NULL
- `archived_at`: Preserved (historical)
- `deleted_at`: POPULATED (timestamp of deletion)
- `current_snapshot_id`: NULL (snapshot deleted)
- Tenant database: Dropped
- Snapshot: Deleted from S3
- Registry entry: Removed
- Workspace: Returns 404 on any access attempt

---

## Migration Strategy (Forward-Only)

### Migration 1: Extend licenses table

```sql
-- Add new columns to licenses table
ALTER TABLE licenses ADD COLUMN soft_lock_until TIMESTAMP NULL;
ALTER TABLE licenses ADD COLUMN archived_at TIMESTAMP NULL;
ALTER TABLE licenses ADD COLUMN deleted_at TIMESTAMP NULL;
ALTER TABLE licenses ADD COLUMN current_snapshot_id UUID NULL;

-- Add constraints and indexes
ALTER TABLE licenses ADD CONSTRAINT chk_soft_lock_until_consistency
  CHECK ((status = 'SOFT_LOCKED' AND soft_lock_until IS NOT NULL) OR
         (status != 'SOFT_LOCKED' AND soft_lock_until IS NULL));
ALTER TABLE licenses ADD CONSTRAINT chk_archived_at_consistency
  CHECK ((status = 'ARCHIVED' AND archived_at IS NOT NULL) OR
         (status != 'ARCHIVED' AND archived_at IS NULL));
ALTER TABLE licenses ADD CONSTRAINT chk_deleted_at_consistency
  CHECK ((status = 'DELETED' AND deleted_at IS NOT NULL) OR
         (status != 'DELETED' AND deleted_at IS NULL));

CREATE INDEX idx_licenses_soft_lock_until ON licenses(soft_lock_until)
  WHERE status = 'SOFT_LOCKED';
CREATE INDEX idx_licenses_archived_at ON licenses(archived_at)
  WHERE status = 'ARCHIVED';
```

### Migration 2: Create snapshots table

```sql
CREATE TABLE snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  snapshot_location VARCHAR(512) NOT NULL,
  snapshot_timestamp TIMESTAMP NOT NULL,
  version_tag VARCHAR(20) NOT NULL,
  size_bytes BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'FAILED')),
  failure_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP,
  UNIQUE(license_id) WHERE deleted_at IS NULL
);

CREATE INDEX idx_snapshots_license_id ON snapshots(license_id);
CREATE INDEX idx_snapshots_status ON snapshots(status);
CREATE INDEX idx_snapshots_created_at ON snapshots(created_at);
```

### Migration 3: Create license_audit_logs table

```sql
CREATE TABLE license_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE RESTRICT,
  previous_status VARCHAR(20) NOT NULL,
  new_status VARCHAR(20) NOT NULL,
  actor_id UUID REFERENCES mmc_users(id) ON DELETE SET NULL,
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('ADMIN', 'SYSTEM')),
  reason VARCHAR(512) NOT NULL,
  transition_metadata JSONB,
  timestamp TIMESTAMP NOT NULL,
  correlation_id UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_license_id ON license_audit_logs(license_id);
CREATE INDEX idx_audit_timestamp ON license_audit_logs(timestamp);
CREATE INDEX idx_audit_correlation_id ON license_audit_logs(correlation_id);
```

### Migration 4: Extend tenants_registry table

```sql
ALTER TABLE tenants_registry ADD COLUMN license_status VARCHAR(20);
ALTER TABLE tenants_registry ADD COLUMN license_id UUID REFERENCES licenses(id);
ALTER TABLE tenants_registry ADD COLUMN sync_status VARCHAR(20) DEFAULT 'IN_SYNC';
ALTER TABLE tenants_registry ADD COLUMN last_synced_at TIMESTAMP DEFAULT now();

CREATE INDEX idx_registry_license_status ON tenants_registry(license_status);
```

### Migration 5: Create license_deletion_confirmations table

```sql
CREATE TABLE license_deletion_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  confirmation_phrase_hash VARCHAR(64) NOT NULL,
  actor_id UUID NOT NULL REFERENCES mmc_users(id),
  confirmed_at TIMESTAMP NOT NULL,
  grace_period_until TIMESTAMP,
  deletion_initiated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_deletion_license_id ON license_deletion_confirmations(license_id);
```

---

## Data Integrity Rules

### Transactional Consistency

All state transitions must be wrapped in a transaction with:

1. SELECT FOR UPDATE on licenses row
2. Validate current state before transition
3. Update licenses columns atomically
4. Create audit_log entry
5. Commit or rollback entire transaction

### Idempotency

- If restore attempt submitted twice with same snapshot_id, both succeed identically (no data
  corruption)
- If soft lock attempted on already soft-locked license, second attempt idempotently succeeds
- If archive attempted during ongoing snapshot, operation is serialized (no concurrent snapshots)

### Immutability After Transition

Once a state transition row is written to license_audit_logs:

- Cannot be deleted
- Cannot be modified
- Cannot be soft-deleted
- Only purged via explicit admin action with confirmation

---

## Performance Considerations

### Indexes for Common Queries

- `licenses(status)` - Filter by license state for bulk operations
- `licenses(soft_lock_until)` WHERE status = SOFT_LOCKED - Find licenses nearing expiry
- `licenses(archived_at)` WHERE status = ARCHIVED - Find archived workspaces
- `license_audit_logs(license_id, timestamp)` - Full audit history for a license
- `snapshots(license_id)` - One-to-one lookup of snapshot for a license
- `license_deletion_confirmations(license_id)` - Track pending deletions

### Query Optimization

- Tenant Resolver caches license status in tenants_registry (synced hourly)
- Middleware soft-lock check uses indexed `soft_lock_until` column
- Archive completion uses `current_snapshot_id` to avoid join through snapshots table

---

## Conclusion

This data model maintains strict isolation via database-per-tenant while centralizing license
lifecycle state in the master database. All state transitions are transactional, immutable audit
trails are enforced, and performance-critical lookups are indexed properly.

The four-state model (ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED) is enforced at the schema level
through constraints, enabling deterministic middleware enforcement and complete compliance audit
trails.
