# Plan Report — Licenses Management

**Stage:** STAGE_10_LICENSES  
**Phase:** 02_PLATFORM_MMC  
**Planning Status:** IN PROGRESS  
**Report Generated:** 2026-02-22  
**Report Author:** Planning Analysis Agent  
**Constitutional Version:** v1.2.0

---

## 1. Architecture Summary

### Strategic Role

License is the **commercial activation and lifecycle control layer** that binds the Trust Chain:

```
Product (Module Definitions)
    ↓
License (Commercial Contract & Workspace ID)
    ↓
Workspace (Tenant Database Instance)
    ↓
Institution (Students, Exams, Data)
```

**License Model (3-Entity Binding):**

- **1 License** = **1 Workspace** = **1 Tenant Database**
- License stored in `master_db.licenses` (platform-wide, shared)
- Workspace identified by globally unique `workspace_slug`
- Each license provisions exactly one isolated PostgreSQL database
- License status is **single source of truth** for workspace operational state

### Authority Layers

1. **Product Layer:** Defines enabled modules, features, runtime behavior (STAGE_09_PRODUCTS)
2. **License Layer:** Binds product to workspace, enforces commercial limits, manages lifecycle
   (STAGE_10_LICENSES) ← **This Stage**
3. **Tenant Layer:** Runs institution data, exams, students (Frontoffice/Worker)
4. **Middleware Chain:** Enforces license status on every request

### Critical Guarantees

- **Isolation:** Database-per-tenant enforced (ADR-0001); License cannot be shared across workspaces
- **Immutability:** product_id and workspace_slug locked at creation; audit trail preserved
- **Status Authority:** License status (master_db) is definitive; tenants_registry mirrors it (never
  redefines it)
- **Asynchronous Provisioning:** License creation and DB provisioning decoupled; prevents blocking
  MMC operations
- **Version Binding:** schema_version and product_version snapshotted at license creation;
  immutable, enforced at runtime

---

## 2. Database Schema

### License Table Definition

**Table:** `master_db.public.licenses`

**Fields (21 columns):**

| Field Name                     | Type                     | Constraint                                           | Mutable | Purpose                                                        |
| ------------------------------ | ------------------------ | ---------------------------------------------------- | ------- | -------------------------------------------------------------- |
| `id`                           | UUID                     | PRIMARY KEY, NOT NULL                                | ✖️      | Unique license identifier (v4)                                 |
| `product_id`                   | UUID                     | FOREIGN KEY → products.id, NOT NULL                  | ✖️      | Binds product;immutable after creation                         |
| `workspace_slug`               | VARCHAR(64)              | UNIQUE, NOT NULL, LOWERCASE, PATTERN `^[a-z0-9\-]+$` | ✖️      | Global workspace identifier; immutable                         |
| `workspace_name`               | VARCHAR(255)             | NOT NULL                                             | ✅      | Display name (mutable for rebranding)                          |
| `student_limit`                | INTEGER                  | CHECK value >= 0 OR NULL, nullable                   | ✅      | Max registered students; NULL = unlimited                      |
| `staff_limit`                  | INTEGER                  | CHECK value >= 0 OR NULL, nullable                   | ✅      | Max registered staff; NULL = unlimited                         |
| `use_zidney_payment`           | BOOLEAN                  | NOT NULL, DEFAULT false                              | ✅      | Payment integration enabled                                    |
| `commission_per_user`          | NUMERIC(10, 2)           | DEFAULT NULL, nullable                               | ✅      | Revenue share per active user                                  |
| `default_language`             | VARCHAR(5)               | NOT NULL, DEFAULT 'en'                               | ✅      | Locale for tenant (e.g., 'en', 'ar', 'fr')                     |
| `uses_divisions`               | BOOLEAN                  | NOT NULL, DEFAULT false                              | ✅      | Multi-division organizational structure enabled                |
| `status`                       | status_enum              | NOT NULL, DEFAULT 'PENDING_PROVISION'                | ✅      | Lifecycle state (see Status ENUM)                              |
| `soft_lock_until`              | TIMESTAMP WITH TIME ZONE | DEFAULT NULL, nullable                               | ✅      | Grace period expiration; NULL if not locked                    |
| `archived_at`                  | TIMESTAMP WITH TIME ZONE | DEFAULT NULL, nullable                               | ✅      | Archive snapshot timestamp; NULL if active                     |
| `deleted_at`                   | TIMESTAMP WITH TIME ZONE | DEFAULT NULL, nullable                               | ✅      | Deletion timestamp; NULL if exists                             |
| `schema_version`               | INTEGER                  | NOT NULL                                             | ✖️      | Platform schema version at license creation (immutable)        |
| `product_version`              | INTEGER                  | NOT NULL                                             | ✖️      | Product version at license creation (immutable)                |
| `provisioning_error`           | TEXT                     | DEFAULT NULL, nullable                               | ✅      | Last provisioning error message (sanitized)                    |
| `provisioning_retries`         | INTEGER                  | DEFAULT 0, NOT NULL                                  | ✅      | Number of provisioning retry attempts                          |
| `provisioning_last_attempt_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NULL, nullable                               | ✅      | Last provisioning job timestamp                                |
| `created_at`                   | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL                              | ✖️      | License creation time (server-set, UTC)                        |
| `updated_at`                   | TIMESTAMP WITH TIME ZONE | DEFAULT NOW(), NOT NULL, TRIGGER                     | ✅      | Last mutation time (auto-updated on every PATCH/status change) |

**Status ENUM Definition:**

```sql
CREATE TYPE status_enum AS ENUM (
    'PENDING_PROVISION',  -- License created, awaiting DB provisioning
    'ACTIVE',              -- Fully operational, workspace accessible
    'SOFT_LOCKED',         -- Payment/suspension; access blocked; data preserved
    'PROVISION_FAILED',    -- Provisioning job failed; manual retry available
    'ARCHIVED',            -- Snapshot taken; workspace read-only, recoverable
    'DELETED'              -- Terminal state; database dropped, unrecoverable
);
```

### Constraints

**Primary Key Constraint:**

```sql
PRIMARY KEY (id)
```

**Foreign Key Constraint:**

```sql
FOREIGN KEY (product_id) REFERENCES master_db.public.products(id)
  ON DELETE RESTRICT  -- Prevent product deletion if licenses exist
  ON UPDATE CASCADE   -- Cascade product ID updates (rare)
```

**Unique Constraint:**

```sql
UNIQUE (workspace_slug)  -- Global uniqueness enforced
```

**Check Constraints:**

```sql
CHECK (student_limit IS NULL OR student_limit >= 0)
CHECK (staff_limit IS NULL OR staff_limit >= 0)
CHECK (workspace_slug ~ '^[a-z0-9\-]+$')  -- Regex: lowercase alphanumeric + dash
CHECK (LENGTH(workspace_slug) >= 3 AND LENGTH(workspace_slug) <= 64)
```

**NOT NULL Constraints:**

```sql
NOT NULL: id, product_id, workspace_slug, workspace_name, status,
          schema_version, product_version, created_at, updated_at,
          use_zidney_payment, default_language, uses_divisions, provisioning_retries
```

### Indexes

**Performance Indexes:**

```sql
-- Composite index for license queries by status
CREATE INDEX idx_licenses_status ON master_db.public.licenses(status);

-- Composite index for pagination/sorting
CREATE INDEX idx_licenses_created_at ON master_db.public.licenses(created_at DESC);

-- Index for product membership queries
CREATE INDEX idx_licenses_product_id ON master_db.public.licenses(product_id);

-- Index for soft-lock expiration checks (for auto-transition cron job)
CREATE INDEX idx_licenses_soft_lock_until ON master_db.public.licenses(soft_lock_until)
WHERE status = 'SOFT_LOCKED' AND soft_lock_until IS NOT NULL;

-- Composite index for list queries with pagination
CREATE INDEX idx_licenses_status_created ON master_db.public.licenses(status, created_at DESC);

-- Index for archive recovery queries
CREATE INDEX idx_licenses_archived_recovery ON master_db.public.licenses(workspace_slug)
WHERE status IN ('ARCHIVED', 'ACTIVE');
```

### Triggers

**Auto-Update updated_at:**

```sql
CREATE TRIGGER licenses_updated_at_trigger
BEFORE UPDATE ON master_db.public.licenses
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Function definition (shared across tables)
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 3. Migrations

### Migration 1: Create Licenses Table

**File:** `apps/api/src/db/master/migrations/001_create_licenses_table.ts`

**Purpose:** Initialize licenses table with core fields (18 columns)

**Up Migration:**

- Create `status_enum` type
- Create `licenses` table with all fields except provisioning tracking (added in migration 2)
- Create indexes for status, product_id, created_at
- Validate no data exists yet

**Down Migration:**

- Drop table
- Drop enum type

**Checksum Validation:** SHA256 hash stored in schema_version table

**Schema Version Increment:** 1 → 2

---

### Migration 2: Add Provisioning Fields

**File:** `apps/api/src/db/master/migrations/002_add_provisioning_fields.ts`

**Purpose:** Add 3 provisioning tracking fields:

- `provisioning_error` (TEXT, nullable): Failure message for re-display in UI
- `provisioning_retries` (INTEGER, default 0): Retry counter
- `provisioning_last_attempt_at` (TIMESTAMP, nullable): Worker timestamp

**Up Migration:**

- ALTER TABLE licenses ADD COLUMN provisioning_error TEXT DEFAULT NULL
- ALTER TABLE licenses ADD COLUMN provisioning_retries INTEGER DEFAULT 0 NOT NULL
- ALTER TABLE licenses ADD COLUMN provisioning_last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
- Create index `idx_licenses_soft_lock_until`

**Down Migration:**

- DROP COLUMN (reverse order)

**Idempotent:** Check IF NOT EXISTS before adding columns

**Transactional:** Single transaction, atomic

**Schema Version Increment:** 2 → 3

---

### Migration 3: Add Status Enum Values

**File:** `apps/api/src/db/master/migrations/003_add_status_enum_values.ts`

**Purpose:** Extend status_enum to include new states from specification clarification

**Up Migration:**

- ALTER TYPE status_enum ADD VALUE 'PROVISION_FAILED'
- Validate existing licenses not in incorrect state

**Down Migration:**

- No rollback for ENUM (PostgreSQL limitation); requires migration file note

**Note:** ENUM values cannot be removed; database limitation. If PROVISION_FAILED needs removal,
requires:

1. Migrate data to different column
2. Drop type and recreate
3. Update type

**Idempotent:** Check IF NOT EXISTS (PostgreSQL doesn't allow, so careful sequencing)

**Transactional:** Single transaction

**Schema Version Increment:** 3 → 4

---

## 4. API Endpoints

### Endpoint 1: Create License

**Route:** `POST /v1/mmc/licenses`

**Auth:** MMC Admin required (Backoffice authorization layer)

**Request Body Schema:**

```typescript
CreateLicenseRequest {
  product_id: UUID (required, must exist and status = 'ACTIVE')
  workspace_slug: string (required, 3-64 chars, ^[a-z0-9\-]+$, globally unique, lowercase enforced)
  workspace_name: string (required, 1-255 chars)
  student_limit?: number | null (optional, >= 0 or null, default null = unlimited)
  staff_limit?: number | null (optional, >= 0 or null, default null = unlimited)
  use_zidney_payment?: boolean (optional, default false)
  commission_per_user?: number (optional, >= 0, nullable, default null)
  default_language?: string (optional, default 'en', pattern ^[a-z]{2}(-[A-Z]{2})?$)
  uses_divisions?: boolean (optional, default false)
}
```

**Validation Rules:**

1. Product exists: `SELECT id FROM products WHERE id = ? AND status = 'ACTIVE'`
2. Workspace slug unique: `SELECT id FROM licenses WHERE workspace_slug = ?` → empty
3. Slug format: Regex match + lowercase enforcement
4. Limits non-negative: `student_limit >= 0 AND staff_limit >= 0`
5. Language valid: ISO 639-1 code or variants
6. Commission non-negative: `commission_per_user >= 0`

**Middleware Chain:**

1. Correlation ID extraction (request header or generate)
2. MMC authentication (API key or JWT)
3. MMC authorization (admin scope)
4. Request body validation (middleware or service-level)
5. Route handler

**Response Body Schema (201 Created):**

```typescript
CreateLicenseResponse {
  success: true
  data: {
    id: UUID
    product_id: UUID
    workspace_slug: string
    workspace_name: string
    student_limit: number | null
    staff_limit: number | null
    use_zidney_payment: boolean
    commission_per_user: number | null
    default_language: string
    uses_divisions: boolean
    status: 'PENDING_PROVISION'  // Always PENDING_PROVISION on creation
    soft_lock_until: null
    archived_at: null
    deleted_at: null
    schema_version: number  // Snapshots current platform schema version
    product_version: number  // Snapshots product version at this moment
    provisioning_error: null
    provisioning_retries: 0
    provisioning_last_attempt_at: null
    created_at: ISO8601 UTC timestamp
    updated_at: ISO8601 UTC timestamp (equals created_at initially)
  }
  error: null
}
```

**Side Effects:**

1. INSERT into licenses table (transactional)
2. ENQUEUE provisioning job to Redis queue:
   - Job ID: license.id
   - Payload: { license_id, workspace_slug, product_id, product_version, student_limit, staff_limit,
     default_language, uses_divisions }
   - Retry policy: 5 max retries, 2s base exponential backoff (2s, 4s, 8s, 16s, 32s)
   - Timeout: 30 minutes (provisioning must complete or fail within 30m)
   - Dead-letter queue: On 5 failures, job moves to DLQ for manual investigation

**Error Responses:**

| Code | Error Code            | Message                            | Cause                                          |
| ---- | --------------------- | ---------------------------------- | ---------------------------------------------- |
| 400  | `VALIDATION_ERROR`    | Product not found or not active    | product_id invalid or product status != ACTIVE |
| 400  | `VALIDATION_ERROR`    | Workspace slug already exists      | slug not globally unique                       |
| 400  | `VALIDATION_ERROR`    | Workspace slug format invalid      | slug doesn't match pattern                     |
| 400  | `VALIDATION_ERROR`    | Student limit must be >= 0 or null | invalid limit value                            |
| 400  | `VALIDATION_ERROR`    | Invalid language code              | language not ISO 639-1                         |
| 401  | `UNAUTHORIZED`        | Missing or invalid authentication  | Auth header missing or invalid                 |
| 403  | `FORBIDDEN`           | Insufficient permissions           | User not MMC admin                             |
| 500  | `INTERNAL_ERROR`      | Database error                     | DB connection issue                            |
| 503  | `SERVICE_UNAVAILABLE` | Provisioning queue unavailable     | Redis unreachable                              |

**Transaction Model:**

- Insert into licenses (transactional)
- Enqueue to Redis (separate operation, if fails, license created but queue missed → async retry
  mechanism or manual retry UI button)

---

### Endpoint 2: List Licenses

**Route:** `GET /v1/mmc/licenses`

**Auth:** MMC Admin required

**Query Parameters:**

```
status?: 'ACTIVE' | 'SOFT_LOCKED' | 'ARCHIVED' | 'PENDING_PROVISION' | 'PROVISION_FAILED' | 'DELETED'
product_id?: UUID
search?: string (searches workspace_slug and workspace_name, case-insensitive)
page?: number (default 1, min 1)
limit?: number (default 20, max 100, min 1)
sort_by?: 'created_at' | 'workspace_name' | 'status' (default 'created_at')
sort_order?: 'ASC' | 'DESC' (default 'DESC')
```

**Middleware Chain:**

1. Correlation ID extraction
2. MMC authentication
3. MMC authorization
4. Query validation + pagination bounds enforcement
5. Route handler

**Query Logic:**

```sql
SELECT * FROM licenses
WHERE
  (status = ? OR ? IS NULL)  -- Filter by status if provided
  AND (product_id = ? OR ? IS NULL)  -- Filter by product
  AND (workspace_slug ILIKE ? OR workspace_name ILIKE ? OR ? IS NULL)  -- Search
  AND deleted_at IS NULL  -- Optionally exclude deleted
ORDER BY {sort_field} {sort_order}
LIMIT ? OFFSET ?
```

**Response Body Schema (200 OK):**

```typescript
ListLicensesResponse {
  success: true
  data: {
    licenses: [
      {
        id: UUID
        product_id: UUID
        workspace_slug: string
        workspace_name: string
        student_limit: number | null
        staff_limit: number | null
        status: status_enum
        created_at: ISO8601 UTC
        updated_at: ISO8601 UTC
        // Usage metrics (read-only, gracefully skipped if tenant DB unreachable):
        student_count?: number  // SELECT COUNT(*) FROM tenant_db.students (cached 5m or real-time)
        staff_count?: number    // SELECT COUNT(*) FROM tenant_db.staff (cached 5m or real-time)
      }
    ]
    pagination: {
      page: number
      limit: number
      total: number  // Total matching licenses
      pages: number  // Ceiling of total / limit
    }
  }
  error: null
}
```

**Side Effects:** None (read-only)

**Error Responses:**

| Code | Error Code         | Message                           | Cause                   |
| ---- | ------------------ | --------------------------------- | ----------------------- |
| 400  | `VALIDATION_ERROR` | Invalid page or limit             | Page < 1 or limit > 100 |
| 401  | `UNAUTHORIZED`     | Missing or invalid authentication | Auth header missing     |
| 403  | `FORBIDDEN`        | Insufficient permissions          | Not MMC admin           |
| 500  | `INTERNAL_ERROR`   | Database error                    | DB connection issue     |

---

### Endpoint 3: Get License Details

**Route:** `GET /v1/mmc/licenses/:id`

**Auth:** MMC Admin required; or tenant user (can only view own license)

**Path Parameters:**

- `id`: UUID (required)

**Middleware Chain:**

1. Correlation ID extraction
2. Authentication (MMC or Tenant)
3. Authorization (MMC admin OR owner check)
4. Route handler

**Response Body Schema (200 OK):**

```typescript
GetLicenseResponse {
  success: true
  data: {
    id: UUID
    product_id: UUID
    product_name: string  // Joined from products table (denormalized for convenience)
    workspace_slug: string
    workspace_name: string
    student_limit: number | null
    staff_limit: number | null
    use_zidney_payment: boolean
    commission_per_user: number | null
    default_language: string
    uses_divisions: boolean
    status: status_enum
    soft_lock_until: ISO8601 UTC | null
    archived_at: ISO8601 UTC | null
    deleted_at: ISO8601 UTC | null
    schema_version: number
    product_version: number
    provisioning_error: string | null  // If PROVISION_FAILED, contains error message
    provisioning_retries: number
    provisioning_last_attempt_at: ISO8601 UTC | null
    created_at: ISO8601 UTC
    updated_at: ISO8601 UTC
    // Usage metrics:
    student_count?: number
    staff_count?: number
    // Audit info (MMC only):
    upgrade_available?: boolean  // If true, new product version available
    next_action?: 'retry_provisioning' | 'soft_unlock' | 'restore_from_archive' | null  // Contextual action hint
  }
  error: null
}
```

**Side Effects:** None

**Error Responses:**

| Code | Error Code     | Message                | Cause                  |
| ---- | -------------- | ---------------------- | ---------------------- |
| 404  | `NOT_FOUND`    | License not found      | UUID doesn't exist     |
| 401  | `UNAUTHORIZED` | Missing authentication | Auth header missing    |
| 403  | `FORBIDDEN`    | Access denied          | Not owner or MMC admin |

---

### Endpoint 4: Edit License

**Route:** `PATCH /v1/mmc/licenses/:id`

**Auth:** MMC Admin required

**Path Parameters:**

- `id`: UUID (required)

**Request Body Schema (Editable Fields Only):**

```typescript
EditLicenseRequest {
  student_limit?: number | null
  staff_limit?: number | null
  commission_per_user?: number | null
  use_zidney_payment?: boolean
  default_language?: string
  uses_divisions?: boolean
  // Explicitly rejected:
  // product_id: rejected (immutable)
  // workspace_slug: rejected (immutable)
  // schema_version: rejected (immutable)
  // product_version: rejected (immutable)
  // status: rejected (use dedicated status endpoints)
}
```

**Validation Rules:**

1. Only editable fields present
2. Reject if attempting to edit immutable fields → `400 INVALID_FIELD_EDIT`
3. Limits non-negative
4. Language valid
5. Commission non-negative

**Middleware Chain:**

1. Correlation ID
2. Authentication
3. Authorization (MMC admin)
4. Route handler

**Response Body Schema (200 OK):**

```typescript
EditLicenseResponse {
  success: true
  data: {
    // Full license object (same as GET detail response)
  }
  error: null
}
```

**Side Effects:**

1. UPDATE licenses table
2. Set `updated_at` to NOW() (trigger-driven)
3. Log structured event: `license_edited` with correlation_id, license_id, changed_fields

**Error Responses:**

| Code | Error Code           | Message                                 | Cause                       |
| ---- | -------------------- | --------------------------------------- | --------------------------- |
| 400  | `INVALID_FIELD_EDIT` | Cannot edit immutable field: product_id | Attempt to change immutable |
| 400  | `VALIDATION_ERROR`   | Student limit must be >= 0 or null      | Invalid limit value         |
| 404  | `NOT_FOUND`          | License not found                       | UUID doesn't exist          |
| 401  | `UNAUTHORIZED`       | Missing authentication                  | Auth header missing         |
| 403  | `FORBIDDEN`          | Insufficient permissions                | Not MMC admin               |

---

### Endpoint 5: Soft Lock License

**Route:** `POST /v1/mmc/licenses/:id/soft-lock`

**Auth:** MMC Admin required

**Path Parameters:**

- `id`: UUID

**Request Body Schema:**

```typescript
SoftLockRequest {
  reason?: string (optional, for logging/audit)
  grace_period_days?: number (optional, default 90, min 1, max 365)
}
```

**Validation Rules:**

1. License exists
2. Current status must be ACTIVE (reject if already SOFT_LOCKED, ARCHIVED, etc.)
3. grace_period_days is valid number

**Middleware Chain:**

1. Correlation ID
2. Authentication
3. Authorization (MMC admin)
4. Route handler

**Transaction Model:**

```sql
BEGIN;
  UPDATE licenses
  SET status = 'SOFT_LOCKED',
      soft_lock_until = NOW() + (grace_period_days || ' days')::INTERVAL,
      updated_at = NOW()
  WHERE id = ? AND status = 'ACTIVE'
  RETURNING *;

  INSERT INTO audit_log (license_id, action, old_status, new_status, reason, correlation_id)
  VALUES (?, 'SOFT_LOCK', 'ACTIVE', 'SOFT_LOCKED', ?, ?);
COMMIT;
```

**Response Body Schema (200 OK):**

```typescript
SoftLockResponse {
  success: true
  data: {
    // Full updated license object
    status: 'SOFT_LOCKED'
    soft_lock_until: ISO8601 UTC timestamp
  }
  error: null
}
```

**Side Effects:**

1. Status transition: ACTIVE → SOFT_LOCKED
2. Set `soft_lock_until` = now + grace_period_days
3. All subsequent requests from this workspace: middleware checks status = SOFT_LOCKED, returns 403
   (access denied)
4. Structured log event: `license_soft_locked`, correlation_id, license_id, grace_until, reason

**Error Responses:**

| Code | Error Code                 | Message                                       | Cause                     |
| ---- | -------------------------- | --------------------------------------------- | ------------------------- |
| 400  | `INVALID_STATE_TRANSITION` | Cannot soft-lock license not in ACTIVE status | Current status not ACTIVE |
| 404  | `NOT_FOUND`                | License not found                             | UUID doesn't exist        |
| 401  | `UNAUTHORIZED`             | Missing authentication                        | Auth header missing       |
| 403  | `FORBIDDEN`                | Insufficient permissions                      | Not MMC admin             |

---

### Endpoint 6: Unlock License (Restore from Soft Lock)

**Route:** `POST /v1/mmc/licenses/:id/unlock`

**Auth:** MMC Admin required

**Path Parameters:**

- `id`: UUID

**Request Body Schema:**

```typescript
UnlockRequest {
  reason?: string (optional, for audit)
}
```

**Validation Rules:**

1. License exists
2. Current status must be SOFT_LOCKED

**Transaction Model:**

```sql
BEGIN;
  UPDATE licenses
  SET status = 'ACTIVE',
      soft_lock_until = NULL,
      updated_at = NOW()
  WHERE id = ? AND status = 'SOFT_LOCKED'
  RETURNING *;

  INSERT INTO audit_log (...)
  VALUES (...);
COMMIT;
```

**Response Body Schema (200 OK):**

```typescript
UnlockResponse {
  success: true
  data: {
    // Full updated license object
    status: 'ACTIVE'
    soft_lock_until: null
  }
  error: null
}
```

**Side Effects:**

1. Status transition: SOFT_LOCKED → ACTIVE
2. Clear `soft_lock_until`
3. Workspace access restored immediately
4. Structured log event: `license_unlocked`, correlation_id, reason

**Error Responses:**

| Code | Error Code                 | Message                           | Cause                          |
| ---- | -------------------------- | --------------------------------- | ------------------------------ |
| 400  | `INVALID_STATE_TRANSITION` | License not in SOFT_LOCKED status | Current status not SOFT_LOCKED |
| 404  | `NOT_FOUND`                | License not found                 | UUID doesn't exist             |

---

### Endpoint 7: Archive License

**Route:** `POST /v1/mmc/licenses/:id/archive`

**Auth:** MMC Admin required

**Path Parameters:**

- `id`: UUID

**Request Body Schema:**

```typescript
ArchiveRequest {
  reason?: string (optional)
}
```

**Validation Rules:**

1. License exists
2. Current status must be SOFT_LOCKED (precondition: soft lock required before archive)

**Side Effects (Transactional):**

1. Status transition: SOFT_LOCKED → ARCHIVED
2. Set `archived_at` = NOW()
3. Trigger snapshot job via Provisioning Service:
   - **Job:** Snapshot tenant database
   - **Payload:** { license_id, workspace_slug, snapshot_type: 'archive' }
   - **Outcome:** Compressed backup stored in S3/durable storage, location recorded
4. Mark tenant database as read-only (PRAGMA query_only = ON; or ALTER DATABASE SET
   default_transaction_read_only = ON;)
5. Structured log event: `license_archived`, correlation_id, snapshot_initiated

**Transaction Model:**

```sql
BEGIN;
  UPDATE licenses
  SET status = 'ARCHIVED',
      archived_at = NOW(),
      updated_at = NOW()
  WHERE id = ? AND status = 'SOFT_LOCKED'
  RETURNING *;

  INSERT INTO audit_log (...)
  VALUES (...);
COMMIT;
```

**Response Body Schema (200 OK):**

```typescript
ArchiveResponse {
  success: true
  data: {
    // Full updated license object
    status: 'ARCHIVED'
    archived_at: ISO8601 UTC timestamp
  }
  error: null
}
```

**Error Responses:**

| Code | Error Code                 | Message                                | Cause                            |
| ---- | -------------------------- | -------------------------------------- | -------------------------------- |
| 400  | `INVALID_STATE_TRANSITION` | License must be SOFT_LOCKED to archive | Current status not SOFT_LOCKED   |
| 404  | `NOT_FOUND`                | License not found                      | UUID doesn't exist               |
| 503  | `SERVICE_UNAVAILABLE`      | Snapshot service unavailable           | Provisioning Service unreachable |

---

### Endpoint 8: Restore from Archive

**Route:** `POST /v1/mmc/licenses/:id/restore`

**Auth:** MMC Admin required

**Path Parameters:**

- `id`: UUID

**Request Body Schema:**

```typescript
RestoreRequest {
  reason?: string (optional)
}
```

**Validation Rules:**

1. License exists
2. Current status must be ARCHIVED

**Side Effects:**

1. Status transition: ARCHIVED → ACTIVE
2. Clear `archived_at`
3. Trigger restore job via Provisioning Service:
   - **Job:** Restore tenant database from snapshot
   - **Payload:** { license_id, workspace_slug }
   - **Outcome:** Database restored to operational state
4. Mark tenant database as read-write (reverse read-only mode)
5. Structured log event: `license_restored`, correlation_id

**Transaction Model:**

```sql
BEGIN;
  UPDATE licenses
  SET status = 'ACTIVE',
      archived_at = NULL,
      updated_at = NOW()
  WHERE id = ? AND status = 'ARCHIVED'
  RETURNING *;

  INSERT INTO audit_log (...)
  VALUES (...);
COMMIT;
```

**Response Body Schema (200 OK):**

```typescript
RestoreResponse {
  success: true
  data: {
    // Full updated license object
    status: 'ACTIVE'
    archived_at: null
  }
  error: null
}
```

**Error Responses:**

| Code | Error Code                 | Message                             | Cause                            |
| ---- | -------------------------- | ----------------------------------- | -------------------------------- |
| 400  | `INVALID_STATE_TRANSITION` | License must be ARCHIVED to restore | Current status not ARCHIVED      |
| 404  | `NOT_FOUND`                | License not found                   | UUID doesn't exist               |
| 503  | `SERVICE_UNAVAILABLE`      | Restore service unavailable         | Provisioning Service unreachable |

---

### Endpoint 9: Delete License

**Route:** `DELETE /v1/mmc/licenses/:id`

**Auth:** MMC Admin required

**Path Parameters:**

- `id`: UUID

**Validation Rules:**

1. License exists
2. Current status must be ARCHIVED (hard precondition; prevents accidental deletion)

**Side Effects:**

1. Status transition: ARCHIVED → DELETED
2. Set `deleted_at` = NOW()
3. Trigger permanent deletion job via Provisioning Service:
   - **Job:** Drop tenant database
   - **Payload:** { license_id, workspace_slug }
   - **Outcome:** Database dropped from PostgreSQL cluster, snapshot removed
4. Structured log event: `license_deleted`, correlation_id

**Transaction Model:**

```sql
BEGIN;
  UPDATE licenses
  SET status = 'DELETED',
      deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = ? AND status = 'ARCHIVED'
  RETURNING *;

  INSERT INTO audit_log (...)
  VALUES (...);
COMMIT;
```

**Response Body Schema (200 OK):**

```typescript
DeleteResponse {
  success: true
  data: {
    message: "License deleted successfully"
    id: UUID
    status: 'DELETED'
    deleted_at: ISO8601 UTC timestamp
  }
  error: null
}
```

**Error Responses:**

| Code | Error Code                 | Message                            | Cause                            |
| ---- | -------------------------- | ---------------------------------- | -------------------------------- |
| 400  | `INVALID_STATE_TRANSITION` | License must be ARCHIVED to delete | Current status not ARCHIVED      |
| 404  | `NOT_FOUND`                | License not found                  | UUID doesn't exist               |
| 503  | `SERVICE_UNAVAILABLE`      | Deletion service unavailable       | Provisioning Service unreachable |

---

### Endpoint 10: Retry Provisioning _(NEW — From Clarification)_

**Route:** `POST /v1/mmc/licenses/:id/retry-provisioning`

**Auth:** MMC Admin required

**Path Parameters:**

- `id`: UUID

**Request Body Schema:**

```typescript
RetryProvisioningRequest {
  reason?: string (optional, for audit)
}
```

**Validation Rules:**

1. License exists
2. Current status must be PROVISION_FAILED
3. provisioning_retries < 5 (don't exceed retry limit)
4. Enough time has passed since last retry attempt (backoff: 2s base exponential)

**Middleware Chain:**

1. Correlation ID
2. Authentication
3. Authorization (MMC admin)
4. Route handler

**Side Effects:**

1. Increment `provisioning_retries` counter
2. Update `provisioning_last_attempt_at` = NOW()
3. Clear `provisioning_error` (reset error message)
4. Update `status` = PENDING_PROVISION (transition back to provisioning state)
5. ENQUEUE provisioning job with same payload as original
6. Structured log event: `provisioning_retry_requested`, correlation_id, retry_count

**Transaction Model:**

```sql
BEGIN;
  UPDATE licenses
  SET provisioning_retries = provisioning_retries + 1,
      provisioning_last_attempt_at = NOW(),
      provisioning_error = NULL,
      status = 'PENDING_PROVISION',
      updated_at = NOW()
  WHERE id = ? AND status = 'PROVISION_FAILED'
  RETURNING *;

  INSERT INTO audit_log (...)
  VALUES (...);
COMMIT;
```

**Response Body Schema (200 OK):**

```typescript
RetryProvisioningResponse {
  success: true
  data: {
    // Full updated license object
    status: 'PENDING_PROVISION'
    provisioning_retries: number
    provisioning_error: null
    provisioning_last_attempt_at: ISO8601 UTC
  }
  error: null
}
```

**Side Effects (Post-Transaction):**

1. ENQUEUE provisioning job to Redis (same format as original creation)
2. If queue unavailable, response still 200 but include warning: `"queue_enqueue_pending"`

**Error Responses:**

| Code | Error Code                 | Message                                | Cause                                 |
| ---- | -------------------------- | -------------------------------------- | ------------------------------------- |
| 400  | `INVALID_STATE_TRANSITION` | License not in PROVISION_FAILED status | Current status not PROVISION_FAILED   |
| 400  | `RETRY_LIMIT_EXCEEDED`     | Maximum 5 provisioning retries reached | provisioning_retries >= 5             |
| 400  | `RATE_LIMITED`             | Please wait before retrying            | Too soon since last attempt (backoff) |
| 404  | `NOT_FOUND`                | License not found                      | UUID doesn't exist                    |
| 401  | `UNAUTHORIZED`             | Missing authentication                 | Auth header missing                   |
| 403  | `FORBIDDEN`                | Insufficient permissions               | Not MMC admin                         |
| 503  | `SERVICE_UNAVAILABLE`      | Provisioning queue unavailable         | Redis unavailable                     |

---

## 5. Middleware — License Enforcement

### License Middleware

**Position in Chain:** After tenant resolver, before route handler

**Middleware Logic:**

```typescript
interface LicenseMiddlewareContext {
  workspace_slug: string; // From tenant resolver
  correlation_id: string; // From correlation ID middleware
  user_id?: string; // From auth middleware
}

async function licenseLicenseMiddleware(context: LicenseMiddlewareContext) {
  // 1. Query master_db for license by workspace_slug
  const license = await masterDB.query(
    "SELECT * FROM licenses WHERE workspace_slug = ? AND deleted_at IS NULL",
    [context.workspace_slug],
  );

  if (!license) {
    LOGGER.warn("license_not_found", {
      workspace_slug: context.workspace_slug,
      correlation_id: context.correlation_id,
    });
    throw new APIError(404, "LICENSE_NOT_FOUND", "Workspace not found");
  }

  // 2. Check status
  const ALLOWED_STATUSES = ["ACTIVE"];
  if (!ALLOWED_STATUSES.includes(license.status)) {
    LOGGER.warn("license_access_denied", {
      workspace_slug: context.workspace_slug,
      license_status: license.status,
      user_id: context.user_id,
      correlation_id: context.correlation_id,
    });

    // Map status to HTTP code
    const statusCodeMap = {
      PENDING_PROVISION: 503, // Service Unavailable (workspace not ready)
      SOFT_LOCKED: 403, // Forbidden (commercial issue)
      ARCHIVED: 403, // Forbidden (workspace archived)
      PROVISION_FAILED: 503, // Service Unavailable (provisioning error)
      DELETED: 404, // Not Found (no longer exists)
    };

    const code = statusCodeMap[license.status] || 403;
    throw new APIError(code, `LICENSE_${license.status}`, `License is ${license.status}`);
  }

  // 3. Check soft-lock expiration (lazy evaluation)
  if (license.status === "SOFT_LOCKED" && license.soft_lock_until) {
    if (NOW() > license.soft_lock_until) {
      // Auto-transition to ARCHIVED (first-come-first-serve atomicity)
      const updated = await ATOMICALLY_UPDATE(
        "UPDATE licenses SET status = 'ARCHIVED', archived_at = NOW() WHERE id = ? AND status = 'SOFT_LOCKED'",
        license.id,
      );

      if (updated.rows > 0) {
        LOGGER.info("license_soft_lock_expired", {
          license_id: license.id,
          workspace_slug: context.workspace_slug,
          correlation_id: context.correlation_id,
        });
        throw new APIError(403, "LICENSE_ARCHIVED", "License grace period expired");
      }
    }
  }

  // 4. Attach license to context for downstream handlers
  context.license = license;

  LOGGER.info("license_middleware_pass", {
    license_id: license.id,
    workspace_slug: context.workspace_slug,
    correlation_id: context.correlation_id,
  });
}
```

### Middleware Registration

**File:** `apps/api/src/middleware/license.middleware.ts`

**Export:** Named export `licenseLicenseMiddleware`

**Usage in Router:**

```typescript
// Apply to all tenant-bound routes
app.use("/v1/tenant/*", licenseLicenseMiddleware);
```

---

## 6. Worker Integration — Provisioning

### Provisioning Job Structure

**Queue:** Redis (red-stack or bullmq)

**Job Name:** `provisioning:license`

**Job Payload:**

```typescript
interface ProvisioningJobPayload {
  license_id: UUID;
  workspace_slug: string;
  product_id: UUID;
  product_version: number; // Snapshotted version
  schema_version: number; // Snapshotted platform schema version
  student_limit: number | null;
  staff_limit: number | null;
  default_language: string;
  uses_divisions: boolean;
}
```

### Retry Policy

**Max Retries:** 5

**Backoff Strategy:** Exponential with jitter

```
Attempt 1: Immediate
Attempt 2: 2s delay
Attempt 3: 4s delay (2s * 2)
Attempt 4: 8s delay (4s * 2)
Attempt 5: 16s delay (8s * 2)
Attempt 6: 32s delay (16s * 2)
Max Attempts: 6 (initial + 5 retries)
```

**Jitter:** Add 0-20% random jitter to avoid thundering herd

```typescript
const delay = baseDelay * (1 + Math.random() * 0.2);
```

**Timeout:** 30 minutes per job (fail if exceeds 1800s)

**Dead-Letter Queue:** On 6th failure, move to DLQ topic `provisioning:dlq`

### Provisioning Job Handler

**File:** `apps/worker/src/jobs/provisioning.handler.ts`

**Handler Signature:**

```typescript
async function handleProvisioningJob(job: ProvisioningJobPayload): Promise<void> {
  const { license_id, workspace_slug, product_id, product_version, schema_version, ... } = job;

  LOGGER.info('provisioning_started', {
    license_id,
    workspace_slug,
    attempt: job.attemptsMade + 1,
    correlation_id: job.correlation_id  // Must be propagated from job context
  });

  try {
    // 1. Idempotency check: Validate no existing database
    const existingDB = await postgresAdminClient.query(
      "SELECT datname FROM pg_database WHERE datname = ?",
      [`tenant_${workspace_slug}`]
    );

    if (existingDB.rows.length > 0) {
      LOGGER.warn('provisioning_database_already_exists', {
        license_id,
        workspace_slug,
        correlation_id: job.correlation_id
      });
      // Mark license as ACTIVE (already provisioned, idempotent success)
      await updateLicenseStatus(license_id, 'ACTIVE', null);
      return;
    }

    // 2. Validate license still exists and in PENDING_PROVISION
    const license = await masterDB.query(
      "SELECT * FROM licenses WHERE id = ? AND status = 'PENDING_PROVISION'",
      [license_id]
    );
    if (license.rows.length === 0) {
      throw new ProvisioningError('License no longer in PENDING_PROVISION state');
    }

    // 3. Create tenant database
    await postgresAdminClient.query(
      `CREATE DATABASE "tenant_${workspace_slug}" ENCODING 'UTF8' LOCALE_PROVIDER 'libc' LOCALE 'en_US.UTF-8'`
    );

    LOGGER.info('provisioning_database_created', { license_id, workspace_slug, correlation_id: job.correlation_id });

    // 4. Get tenant DB connection
    const tenantDB = await getTenantDBConnection(workspace_slug);

    // 5. Run baseline schema migrations
    // (Migration framework loads all migration files from apps/api/src/db/tenant/migrations/)
    const migrationResults = await runMigrations(tenantDB, schema_version);

    LOGGER.info('provisioning_migrations_complete', {
      license_id,
      workspace_slug,
      migration_count: migrationResults.executed,
      correlation_id: job.correlation_id
    });

    // 6. Seed baseline data
    await seedBaseline(tenantDB, {
      workspace_slug,
      product_id,
      product_version,
      default_language,
      uses_divisions
    });

    // 7. Create admin account (placeholder credentials, user will set on first login)
    const adminAccount = await createAdminAccount(tenantDB, {
      email: `admin@${workspace_slug}.internal`,
      temporary_password: generateSecureTemporaryPassword()
    });

    LOGGER.info('provisioning_admin_created', { license_id, workspace_slug, admin_id: adminAccount.id, correlation_id: job.correlation_id });

    // 8. Insert into tenants_registry (master_db.tenants_registry)
    await masterDB.query(
      `INSERT INTO tenants_registry (license_id, workspace_slug, database_name, status, created_at)
       VALUES (?, ?, ?, 'ACTIVE', NOW())`,
      [license_id, workspace_slug, `tenant_${workspace_slug}`]
    );

    // 9. Update license status to ACTIVE
    await updateLicenseStatus(license_id, 'ACTIVE', null);

    LOGGER.info('provisioning_completed', {
      license_id,
      workspace_slug,
      correlation_id: job.correlation_id
    });

  } catch (error) {
    LOGGER.error('provisioning_failed', {
      license_id,
      workspace_slug,
      error_message: error.message,
      error_stack: error.stack,
      attempt: job.attemptsMade + 1,
      max_retries: job.attempts,
      correlation_id: job.correlation_id
    });

    // Cleanup partial database if created
    try {
      await postgresAdminClient.query(
        `DROP DATABASE IF EXISTS "tenant_${workspace_slug}" WITH (FORCE)`
      );
    } catch (cleanupError) {
      LOGGER.error('provisioning_cleanup_failed', {
        license_id,
        workspace_slug,
        cleanup_error: cleanupError.message,
        correlation_id: job.correlation_id
      });
    }

    // Update license with error
    const errorMessage = sanitizeErrorMessage(error.message);  // Don't expose internal details
    await masterDB.query(
      `UPDATE licenses
       SET status = 'PROVISION_FAILED',
           provisioning_error = ?,
           provisioning_retries = ?,
           provisioning_last_attempt_at = NOW()
       WHERE id = ?`,
      [errorMessage, job.attemptsMade + 1, license_id]
    );

    // Rethrow to trigger retry or DLQ
    throw error;
  }
}

async function updateLicenseStatus(
  license_id: UUID,
  status: string,
  error_message: string | null
): Promise<void> {
  await masterDB.query(
    `UPDATE licenses
     SET status = ?,
         provisioning_error = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [status, error_message, license_id]
  );
}
```

### Idempotency

**Mechanism:** Database check before creating database

**Guarantee:** If called twice with same license_id:

- First call: Creates database, sets status ACTIVE
- Second call: Detects existing database, verifies license already ACTIVE, returns success (no-op)

**Race Condition Protection:** Atomic status check in license table ensures only one provisioning
path succeeds

---

## 7. Version Integrity

### Version Binding at License Creation

**Fields:**

- `license.schema_version`: Platform current schema version (snapshotted at creation)
- `license.product_version`: Product current version (snapshotted at creation)

**Snapshot Logic (API Create Handler):**

```typescript
const platform_schema_version = await getPlatformSchemaVersion(); // From config or version table
const product = await productService.getById(request.product_id); // product.product_version
const product_version = product.product_version;

const license = await licenseService.create({
  ...request,
  schema_version: platform_schema_version,
  product_version: product_version,
});
```

**Immutability:** Once created, these fields are NOT NULL and never updated

### Version Compatibility Enforcement

**Runtime Middleware (Proposed Stage 11):**

```typescript
async function versionCompatibilityMiddleware(context) {
  const license = context.license; // From license middleware
  const tenantDB = context.tenantDB; // Tenant connection

  // 1. Get current schema version from tenant
  const tenantSchemaVersion = await tenantDB.query(
    "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1",
  );

  // 2. Check compatibility
  if (license.schema_version !== tenantSchemaVersion[0]?.version) {
    LOGGER.warn("version_mismatch_detected", {
      license_schema_version: license.schema_version,
      tenant_schema_version: tenantSchemaVersion[0]?.version,
      workspace_slug: context.workspace_slug,
      correlation_id: context.correlation_id,
    });

    throw new APIError(
      426, // Upgrade Required
      "SCHEMA_VERSION_MISMATCH",
      "Tenant database requires upgrade. Please contact support.",
    );
  }

  // 3. Check product version compatibility if applicable
  // (Deferred to Stage 11)
}
```

### Upgrade Model (Stage 11)

When product updates:

1. New product_version created
2. License notified of upgrade_available = true (computed field or separate table)
3. Institution initiates upgrade via MMC UI
4. Worker executes migrations **per tenant** before incrementing license.product_version
5. No shared upgrade path; each tenant upgrades independently

### DBInitializer Matching

**Requirement:** Tenant database schema_version must exactly match license.product_version and
license.schema_version

**Validation (provisioning handler):**

```typescript
// After migrations complete
const expectedSchemaVersion = payload.schema_version;
const actualSchemaVersion = await getTenantSchemaVersion(tenantDB);

if (expectedSchemaVersion !== actualSchemaVersion) {
  throw new ProvisioningError(
    `Schema version mismatch: expected ${expectedSchemaVersion}, got ${actualSchemaVersion}`,
  );
}
```

---

## 8. Error Handling — RFC 7807 Standard

### Error Response Format

All API errors must conform to RFC 7807 Problem Details:

```typescript
interface ErrorResponse {
  success: false;
  data: null;
  error: {
    type: string; // Error category (e.g., 'VALIDATION_ERROR')
    title: string; // Short human-readable title
    status: number; // HTTP status code
    detail: string; // Detailed message (may contain sanitized details)
    instance?: string; // Optional: correlation_id or request ID
    code?: string; // Optional: machine-readable error code
  };
}
```

**Example (400 Validation Error):**

```json
{
  "success": false,
  "data": null,
  "error": {
    "type": "VALIDATION_ERROR",
    "title": "Validation Failed",
    "status": 400,
    "detail": "Workspace slug format invalid. Must be lowercase alphanumeric with dashes.",
    "instance": "corr-123-456-789",
    "code": "INVALID_SLUG_FORMAT"
  }
}
```

### Error Code Catalog

| HTTP | Error Type               | Code                           | Message                                  | Context                   |
| ---- | ------------------------ | ------------------------------ | ---------------------------------------- | ------------------------- |
| 400  | VALIDATION_ERROR         | INVALID_SLUG_FORMAT            | Workspace slug format invalid            | Create endpoint           |
| 400  | VALIDATION_ERROR         | SLUG_NOT_UNIQUE                | Workspace slug already exists            | Create endpoint           |
| 400  | VALIDATION_ERROR         | INVALID_PRODUCT_ID             | Product not found or not active          | Create endpoint           |
| 400  | VALIDATION_ERROR         | INVALID_LIMIT                  | Student/staff limit must be >= 0 or null | Create/Edit endpoints     |
| 400  | INVALID_STATE_TRANSITION | STATE_NOT_ALLOWED              | Cannot transition to target status       | Status endpoints          |
| 401  | UNAUTHORIZED             | AUTH_MISSING                   | Authentication header missing            | All endpoints             |
| 401  | UNAUTHORIZED             | AUTH_INVALID                   | Invalid or expired authentication        | All endpoints             |
| 403  | FORBIDDEN                | PERMISSION_DENIED              | Insufficient permissions                 | All endpoints             |
| 403  | FORBIDDEN                | LICENSE_SOFT_LOCKED            | License is soft-locked; access denied    | License middleware        |
| 403  | FORBIDDEN                | LICENSE_ARCHIVED               | License is archived; access denied       | License middleware        |
| 404  | NOT_FOUND                | LICENSE_NOT_FOUND              | License not found                        | All detail/edit endpoints |
| 404  | NOT_FOUND                | WORKSPACE_NOT_FOUND            | Workspace not found                      | License middleware        |
| 426  | UPGRADE_REQUIRED         | SCHEMA_VERSION_MISMATCH        | Database requires upgrade                | Version middleware        |
| 503  | SERVICE_UNAVAILABLE      | PROVISIONING_QUEUE_UNAVAILABLE | Provisioning queue unavailable           | Create endpoint           |
| 503  | SERVICE_UNAVAILABLE      | PROVISIONING_FAILED            | Provisioning job failed                  | Worker context            |
| 503  | SERVICE_UNAVAILABLE      | LICENSE_PENDING_PROVISION      | License provisioning in progress         | License middleware        |

### Logging Standards

**Sanitization Rules:**

- Full error details → Internal structured logs (full stack trace, query details)
- Public error details → API response (sanitized message, no implementation details)
- Never log passwords, tokens, API keys

**Example Sanitization:**

```typescript
// Internal log (full context)
LOGGER.error("provisioning_failed", {
  error: error.message,
  stack: error.stack,
  query: failedQuery, // Actual SQL might be logged in non-prod
  database: connection_details,
});

// Public response (sanitized)
throw new APIError(500, "INTERNAL_ERROR", "An unexpected error occurred. Please contact support.");
```

---

## 9. Logging — Structured JSON Standard

### Log Format

All logs must be structured JSON (Pino target):

```json
{
  "timestamp": "2026-02-22T14:30:45.123Z",
  "level": "INFO",
  "service": "api",
  "message": "license_created",
  "correlation_id": "req-123-456-789",
  "workspace_slug": "acme-corp",
  "license_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user-123",
  "event_type": "license_lifecycle",
  "details": {
    "status": "PENDING_PROVISION",
    "provisioning_job_id": "job-456"
  }
}
```

### Required Fields (All Logs)

- `timestamp`: ISO8601 UTC
- `level`: INFO, WARN, ERROR
- `service`: Service name (api, worker, mmc, etc.)
- `correlation_id`: Request correlation ID (required for traceability)
- `message`: Event description

### Workspace-Bound Logs

- `workspace_slug`: Workspace slug (required if tenant-bound)
- `license_id`: License ID (required for license operations)
- `user_id`: User ID (if available)

### Critical Events (License Lifecycle)

**Event: license_created**

```json
{
  "message": "license_created",
  "event_type": "license_lifecycle",
  "license_id": "...",
  "workspace_slug": "...",
  "product_id": "...",
  "status": "PENDING_PROVISION",
  "provisioning_job_id": "..."
}
```

**Event: provisioning_started**

```json
{
  "message": "provisioning_started",
  "event_type": "provisioning_job",
  "license_id": "...",
  "workspace_slug": "...",
  "attempt": 1,
  "max_retries": 5
}
```

**Event: provisioning_failed**

```json
{
  "message": "provisioning_failed",
  "level": "ERROR",
  "event_type": "provisioning_job",
  "license_id": "...",
  "workspace_slug": "...",
  "error_message": "...",
  "attempt": 1,
  "retry_scheduled": true,
  "next_retry_in_seconds": 4
}
```

**Event: license_soft_locked**

```json
{
  "message": "license_soft_locked",
  "event_type": "license_lifecycle",
  "license_id": "...",
  "workspace_slug": "...",
  "grace_period_days": 90,
  "grace_until": "2026-05-23T14:30:45Z",
  "reason": "..."
}
```

**Event: license_archived**

```json
{
  "message": "license_archived",
  "event_type": "license_lifecycle",
  "license_id": "...",
  "workspace_slug": "...",
  "snapshot_initiated": true,
  "reason": "..."
}
```

### No Console.log

All logging must use structured logger abstraction (Pino or wrapper). Direct console.log()
forbidden.

---

## 10. UI Design — MMC (Backoffice)

### 1. License List View

**Route:** `/mmc/licenses`

**Layout:**

- Header: "Licenses" + Create button (blue "New License" CTA)
- Search bar: Search by workspace_slug or workspace_name (real-time filtering)
- Filter pills:
  - Status: ACTIVE | SOFT_LOCKED | ARCHIVED | PENDING_PROVISION | PROVISION_FAILED | (All)
  - Product: Dropdown (All Products | Product A | Product B | ...)
- Table columns:
  - Workspace Slug (primary identity)
  - Workspace Name (display name)
  - Product Name (link to product detail)
  - Status (colored badge)
  - Student Count / Limit (e.g., "45/100" or "45/∞")
  - Staff Count / Limit
  - Created (relative date, e.g., "2 days ago")
  - Actions (dropdown menu)

**Status Colors:**

- ACTIVE: Green
- SOFT_LOCKED: Orange
- ARCHIVED: Gray
- PENDING_PROVISION: Blue (spinner)
- PROVISION_FAILED: Red
- DELETED: Dark gray

**Row Actions (Dropdown Menu):**

- View Details → Navigates to detail view
- Edit Limits → Opens edit modal
- Soft Lock → Opens confirmation modal
- (if SOFT_LOCKED) Unlock → Confirmation
- (if ARCHIVED) Restore → Confirmation
- (if PROVISION_FAILED) Retry Provisioning → Confirmation
- Delete → Confirmation (only if ARCHIVED)

**Pagination:**

- Page selector, limit selector (20/50/100 per page)
- Total count displayed

**Empty State:**

- Icon + "No licenses created yet"
- CTA to create first license

### 2. License Detail View

**Route:** `/mmc/licenses/:id`

**Sections:**

**A. Header**

- License ID (copyable)
- Status badge (colored)
- Created date
- Last updated date

**B. License Information (Read-Only)**

- Workspace Slug
- Workspace Name
- Product Name (link)
- Schema Version
- Product Version
- upgrade_available: Yes/No (link to upgrade workflow if yes)

**C. Resource Limits (Editable)**

- Student Limit (current: X/limit or X/∞)
- Staff Limit (current: Y/limit or Y/∞)
- Edit button → Opens edit modal

**D. Commercial Settings (Editable)**

- Use Zidney Payment: Yes/No (checkbox)
- Commission Per User: $X.XX (text input)
- Edit button

**E. Institutional Settings (Editable)**

- Default Language: en / ar / fr / ... (dropdown)
- Uses Divisions: Yes/No (checkbox)
- Edit button

**F. Provisioning Status** (if PROVISION_FAILED or PENDING_PROVISION)

- Status: PENDING_PROVISION | PROVISION_FAILED
- Error Message: (if PROVISION_FAILED, display sanitized error)
- Retry Count: X / 5
- Last Attempt: ISO8601 timestamp
- Retry Provisioning button (blue, disabled if no retries left)

**G. Soft Lock Information** (if SOFT_LOCKED)

- Grace Period Until: ISO8601 timestamp
- Days Remaining: X days
- Unlock button (blue)

**H. Archive Information** (if ARCHIVED)

- Archived At: ISO8601 timestamp
- Reason: (if available)
- Restore button (blue)

**I. Actions (Bottom)**

- Edit Details (button)
- Soft Lock (button, disabled if not ACTIVE)
- Unlock (button, disabled if not SOFT_LOCKED)
- Archive (button, disabled if not SOFT_LOCKED)
- Restore (button, disabled if not ARCHIVED)
- Delete (button, disabled if not ARCHIVED, red color for destructive)

### 3. Create License Form

**Route:** `/mmc/licenses/new`

**Form Fields:**

1. **Product Selection** (required, dropdown)
   - Placeholder: "Select product"
   - Only shows ACTIVE products
   - Displays product name + version

2. **Workspace Slug** (required, text input)
   - Placeholder: "e.g., acme-corp"
   - Real-time validation: format check, uniqueness check (async)
   - Character rules: Lowercase, alphanumeric, dashes only
   - Length: 3-64 characters
   - Error messages displayed below input

3. **Workspace Name** (required, text input)
   - Placeholder: "e.g., ACME Corporation"
   - Max 255 characters

4. **Resource Limits** (optional, expandable section)
   - Student Limit: Number input (optional, leave blank for unlimited)
   - Staff Limit: Number input (optional, leave blank for unlimited)
   - Min value: 0

5. **Commercial Settings** (optional, expandable section)
   - Use Zidney Payment: Checkbox (default false)
   - Commission Per User: Number input (optional, decimal, only if payment enabled)

6. **Institutional Settings** (optional, expandable section)
   - Default Language: Dropdown (en, ar, fr, etc.)
   - Uses Divisions: Checkbox

**Form Buttons:**

- Create License (blue, main CTA)
- Cancel (secondary)

**Validation:**

- Real-time slug format validation
- Slug uniqueness check (debounced API call, shows loading indicator)
- Required fields must be filled before creating
- Async validation errors displayed below fields

**Success State:**

- On create success, redirect to license detail view
- Show toast: "License created successfully. Provisioning in progress..."

**Error Handling:**

- Form-level error display
- Field-level error highlighting
- Retry button if creation failed

### 4. Edit License Modal

**Trigger:** From detail view or list row action

**Form Fields (Editable Only):**

1. Student Limit
2. Staff Limit
3. Commission Per User
4. Use Zidney Payment
5. Default Language
6. Uses Divisions

**Immutable Fields** (displayed but not editable, grayed out):

- Workspace Slug
- Product
- Schema Version
- Product Version

**Buttons:**

- Save Changes (blue)
- Cancel (secondary)

**Success State:**

- Close modal, refresh detail view
- Show toast: "License updated successfully"

### 5. Soft Lock Modal

**Trigger:** From detail view "Soft Lock" button

**Content:**

- Title: "Soft Lock License"
- Description: "Soft locking will block access to this workspace for 90 days while preserving data.
  Users will see an access denied message."
- Grace Period Input: Number input (default 90, min 1, max 365 days)
- Reason Input: Textarea (optional, for audit log)
- Confirm button (red, destructive)
- Cancel button

**Confirmation:**

- On confirm, soft-lock license
- Show toast: "License soft-locked. Workspace access has been blocked."

### 6. Archive Modal

**Trigger:** From detail view "Archive" button (only if SOFT_LOCKED)

**Content:**

- Title: "Archive License"
- Description: "Archiving will create a snapshot of the workspace and make it read-only. This can be
  restored later."
- Reason Input: Textarea (optional)
- Confirm button (red, destructive)
- Cancel button

**Warning:** "This action will trigger a snapshot job. The workspace will be unavailable briefly
during snapshot."

### 7. Status Colors & Icons

- **ACTIVE:** ✅ Green (#22C55E)
- **SOFT_LOCKED:** ⚠️ Orange (#F59E0B)
- **ARCHIVED:** 📦 Gray (#9CA3AF)
- **PENDING_PROVISION:** ⏳ Blue (#3B82F6) with spinner
- **PROVISION_FAILED:** ❌ Red (#EF4444)
- **DELETED:** 🗑️ Dark Gray (#6B7280)

---

## 11. Implementation Layers

### Layer 1: API Routes (apps/api/src/routes/licenses.ts)

**Responsibilities:**

- Request parsing and validation
- Route registration
- Response serialization
- Error handling (catch and format RFC 7807)

**Structure:**

```typescript
// File: apps/api/src/routes/licenses.ts

import { Hono } from "hono";
import { licenseController } from "../controllers/licenses.controller";
import { licenseMiddleware } from "../middleware/license.middleware";

export const licensesRouter = new Hono();

// MMC API Routes (no tenant middleware, uses MMC auth)
licensesRouter.post("/v1/mmc/licenses", licenseController.create);
licensesRouter.get("/v1/mmc/licenses", licenseController.list);
licensesRouter.get("/v1/mmc/licenses/:id", licenseController.getDetail);
licensesRouter.patch("/v1/mmc/licenses/:id", licenseController.edit);
licensesRouter.post("/v1/mmc/licenses/:id/soft-lock", licenseController.softLock);
licensesRouter.post("/v1/mmc/licenses/:id/unlock", licenseController.unlock);
licensesRouter.post("/v1/mmc/licenses/:id/archive", licenseController.archive);
licensesRouter.post("/v1/mmc/licenses/:id/restore", licenseController.restore);
licensesRouter.delete("/v1/mmc/licenses/:id", licenseController.delete);
licensesRouter.post("/v1/mmc/licenses/:id/retry-provisioning", licenseController.retryProvisioning);
```

### Layer 2: Controllers (apps/api/src/controllers/licenses.controller.ts)

**Responsibilities:**

- Express HTTP semantics
- Call domain services
- Format responses
- Catch and map service errors to RFC 7807

**Example:**

```typescript
export const licenseController = {
  async create(context: Context) {
    try {
      const req = await context.req.json();
      const result = await licenseService.create(req);
      return context.json({ success: true, data: result, error: null }, 201);
    } catch (error) {
      return handleError(context, error);
    }
  },
};
```

### Layer 3: Domain Services (packages/domain-core/src/licenses/license.service.ts)

**Responsibilities:**

- Business logic (validation, state transitions, side effects)
- Repository calls
- Event emission (for audit log or messaging)
- No HTTP logic

**Example:**

```typescript
export class LicenseService {
  async create(request: CreateLicenseRequest): Promise<License> {
    // Validation
    validateSlug(request.workspace_slug);
    const product = await this.productRepository.getById(request.product_id);
    if (!product || product.status !== "ACTIVE") {
      throw new ValidationError("Product not active");
    }

    // Fetch platform versions
    const schemaVersion = await this.getPlatformSchemaVersion();
    const productVersion = product.product_version;

    // Create license
    const license = await this.licenseRepository.create({
      ...request,
      schema_version: schemaVersion,
      product_version: productVersion,
      status: "PENDING_PROVISION",
    });

    // Enqueue provisioning job
    await this.queue.enqueueProvisioningJob(license.id);

    // Emit event
    this.eventEmitter.emit("license:created", license);

    return license;
  }
}
```

### Layer 4: Data Repositories (packages/domain-core/src/licenses/license.repository.ts)

**Responsibilities:**

- SQL queries (parameterized, injection-safe)
- No business logic
- Return domain models

**Example:**

```typescript
export class LicenseRepository {
  async create(data: LicenseCreateData): Promise<License> {
    const result = await this.masterDB.query(
      `INSERT INTO licenses (id, product_id, workspace_slug, ..., status)
       VALUES (?, ?, ?, ..., ?)`,
      [data.id, data.product_id, data.workspace_slug, ..., 'PENDING_PROVISION']
    );
    return this.mapRowToLicense(result.rows[0]);
  }

  async getById(id: UUID): Promise<License | null> {
    const result = await this.masterDB.query(
      `SELECT * FROM licenses WHERE id = ?`,
      [id]
    );
    return result.rows.length > 0 ? this.mapRowToLicense(result.rows[0]) : null;
  }
}
```

### Layer 5: Worker Jobs (apps/worker/src/jobs/provisioning.handler.ts)

**Responsibilities:**

- Long-running async operations
- Idempotency checks
- Cleanup and rollback on failure
- Structured logging

**Example:** (See Worker Integration section above)

### Layer 6: Middleware (apps/api/src/middleware/license.middleware.ts)

**Responsibilities:**

- License status enforcement
- Tenant routing based on license
- Version compatibility checks (deferred)

**Example:** (See Middleware section above)

### Layer 7: UI Components (apps/mmc/src/views/licenses/)

**Structure:**

```
apps/mmc/src/views/licenses/
├── LicenseList.vue            # List view + table
├── LicenseDetail.vue          # Detail view + edit modals
├── LicenseCreate.vue          # Creation form
├── LicenseEdit.vue            # Edit modal
├── SoftLockModal.vue          # Soft lock confirmation
├── ArchiveModal.vue           # Archive confirmation
├── components/
│   ├── LicenseStatusBadge.vue # Status indicator component
│   ├── LicenseTable.vue       # Reusable table
│   ├── LicenseForm.vue        # Reusable form
```

**Tech Stack:**

- Vue 3 + TypeScript
- shadcn-vue components
- Tailwind v4
- API client (TanStack Query or vue-query)

---

## 12. Data Flow Diagrams

### Flow 1: License Creation & Provisioning

```
┌─────────────────────────────────────────────────────────────────┐
│ MMC Admin                                                       │
│ (User clicks "New License")                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Backoffice API                                                  │
│ POST /v1/mmc/licenses                                           │
│ - Validate product exists                                       │
│ - Validate slug format & uniqueness                             │
│ - Snapshot schema_version, product_version                      │
│ - INSERT license (status: PENDING_PROVISION)                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Redis Queue                                                     │
│ ENQUEUE provisioning:license job                                │
│ Payload: { license_id, workspace_slug, ... }                   │
│ Retry: 5x, Exponential backoff, 30m timeout                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Worker (async)                                                  │
│ handleProvisioningJob()                                         │
│ - Idempotency check (is database already created?)              │
│ - CREATE DATABASE tenant_acme_corp                              │
│ - Apply baseline migrations (schema_version checked)            │
│ - Seed baseline data (roles, permissions, settings)             │
│ - Create admin account                                          │
│ - INSERT tenants_registry                                       │
│ - UPDATE license (status: ACTIVE)                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Master DB                                                       │
│ licenses.status = 'ACTIVE'                                      │
│ tenants_registry.workspace_slug = 'acme-corp'                   │
│                                                                 │
│ Tenant DB (tenant_acme_corp)                                    │
│ - schema_version = ${snapshot_version}                          │
│ - Fully operational                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Flow 2: Student Login (License Middleware)

```
┌─────────────────────────────────────────────────────────────────┐
│ Student                                                         │
│ Logs in via Frontoffice                                         │
│ URL: acme-corp.zidney.com/login                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tenant Resolver Middleware                                      │
│ Extract workspace_slug from host header                         │
│ (acme-corp.zidney.com → workspace_slug = 'acme-corp')          │
│ Result: context.workspace_slug = 'acme-corp'                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ License Middleware                                              │
│ SELECT * FROM master_db.licenses WHERE workspace_slug = ?       │
│ Check status: ACTIVE, SOFT_LOCKED, etc.                         │
│ If status = ACTIVE: ✅ PASS, continue                           │
│ If status = SOFT_LOCKED: 403 Forbidden (grace period check)     │
│ If status = PENDING_PROVISION: 503 Service Unavailable          │
│ If status = ARCHIVED: 403 Forbidden                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Authentication                                                  │
│ Student enters email + password                                 │
│ Query tenant DB for student record                              │
│ Hash password, compare                                          │
│ ✅ Success → JWT issued                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Frontoffice                                                     │
│ Student can view dashboard, exams, attempts                     │
│ All API calls include workspace_slug (via host) + JWT           │
│ License middleware validates on every request                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Testing Strategy

### Unit Tests

**File Structure:**

```
apps/api/tests/unit/licenses/
├── license.service.test.ts
├── license.repository.test.ts
├── license.validator.test.ts
```

**Example Tests:**

```typescript
describe('LicenseService', () => {
  describe('create', () => {
    it('should create license with PENDING_PROVISION status', async () => {
      const request = {
        product_id: 'prod-123',
        workspace_slug: 'acme-corp',
        workspace_name: 'ACME Corp'
      };

      const result = await licenseService.create(request);

      expect(result.status).toBe('PENDING_PROVISION');
      expect(result.schema_version).toBeDefined();
      expect(result.product_version).toBeDefined();
    });

    it('should reject duplicate workspace slug', async () => {
      await licenseService.create({ workspace_slug: 'acme-corp', ... });

      expect(() => licenseService.create({ workspace_slug: 'acme-corp', ... }))
        .toThrow('slug already exists');
    });

    it('should validate workspace slug format', async () => {
      expect(() => licenseService.create({ workspace_slug: 'INVALID_SLUG', ... }))
        .toThrow('slug format invalid');
    });
  });

  describe('softLock', () => {
    it('should transition ACTIVE to SOFT_LOCKED', async () => {
      const license = await createActiveLicense();

      const updated = await licenseService.softLock(license.id);

      expect(updated.status).toBe('SOFT_LOCKED');
      expect(updated.soft_lock_until).toBeAfter(now());
    });

    it('should reject soft-lock if not ACTIVE', async () => {
      const license = await createArchivedLicense();

      expect(() => licenseService.softLock(license.id))
        .toThrow('Cannot soft-lock non-ACTIVE license');
    });
  });
});
```

### Integration Tests

**File Structure:**

```
apps/api/tests/integration/licenses/
├── license-creation.test.ts
├── license-lifecycle.test.ts
├── license-middleware.test.ts
```

**Example:**

```typescript
describe("License Lifecycle Integration", () => {
  it("should complete full license creation → provisioning → ACTIVE flow", async () => {
    // 1. Create license via API
    const createResp = await POST("/v1/mmc/licenses", {
      product_id: PRODUCT_ID,
      workspace_slug: "test-corp",
      workspace_name: "Test Corp",
    });

    expect(createResp.status).toBe(201);
    const license = createResp.body.data;
    expect(license.status).toBe("PENDING_PROVISION");

    // 2. Provisioning job enqueued in Redis
    const queuedJobs = await getQueuedJobs();
    expect(queuedJobs).toContainObject({ license_id: license.id });

    // 3. Execute provisioning worker
    await processProvisioningJobs();

    // 4. License status transitions to ACTIVE
    const updated = await GET(`/v1/mmc/licenses/${license.id}`);
    expect(updated.body.data.status).toBe("ACTIVE");

    // 5. Tenant database created and accessible
    const tenantDB = await getTenantDB("test-corp");
    expect(tenantDB).toBeDefined();

    // 6. tenants_registry updated
    const registry = await masterDB.query(
      `SELECT * FROM tenants_registry WHERE workspace_slug = ?`,
      ["test-corp"],
    );
    expect(registry.rows).toHaveLength(1);
  });
});
```

### API Contract Tests

**Purpose:** Validate API responses conform to expected schema

```typescript
describe("License API Contracts", () => {
  it("GET /v1/mmc/licenses/:id returns correct schema", async () => {
    const resp = await GET(`/v1/mmc/licenses/${license.id}`);

    expect(resp.body).toMatchSchema({
      success: true,
      data: {
        id: "uuid",
        product_id: "uuid",
        workspace_slug: "string",
        workspace_name: "string",
        status: "enum:ACTIVE|SOFT_LOCKED|ARCHIVED|...",
        student_limit: "number|null",
        staff_limit: "number|null",
        created_at: "iso8601",
        updated_at: "iso8601",
      },
      error: null,
    });
  });
});
```

### E2E Tests (MMC UI)

**File Structure:**

```
tests/e2e/mmc/
├── license-management.test.ts
```

**Example:**

```typescript
describe("MMC License Management", () => {
  it("should create license via UI form", async () => {
    // Navigate to create page
    await page.goto("http://mmc.local/licenses/new");

    // Fill form
    await page.fill('input[name="workspace_slug"]', "test-acme");
    await page.fill('input[name="workspace_name"]', "Test ACME");
    await page.selectOption('select[name="product_id"]', "prod-123");

    // Submit
    await page.click('button:has-text("Create License")');

    // Verify redirect to detail
    await page.waitForURL("**/licenses/*");

    // Verify status badge shows PENDING_PROVISION
    await expect(page.locator('[data-testid="status-badge"]')).toContainText("PENDING_PROVISION");
  });
});
```

### Worker Job Tests

```typescript
describe('Provisioning Job Handler', () => {
  it('should create tenant database and mark license ACTIVE', async () => {
    const job = {
      license_id: 'lic-123',
      workspace_slug: 'test-ws',
      product_id: 'prod-1',
      product_version: 1,
      schema_version: 1
    };

    await handleProvisioningJob(job);

    // Verify DB created
    const dbs = await postgresAdmin.query(`SELECT datname FROM pg_database`);
    expect(dbs.rows.map(r => r.datname)).toContain('tenant_test_ws');

    // Verify license status
    const license = await masterDB.query(`SELECT * FROM licenses WHERE id = ?`, ['lic-123']);
    expect(license.rows[0].status).toBe('ACTIVE');
  });

  it('should be idempotent (safe to retry)', async () => {
    const job = { license_id: 'lic-123', workspace_slug: 'test-ws', ... };

    // First call
    await handleProvisioningJob(job);
    expect(license.status).toBe('ACTIVE');

    // Second call (should not error)
    await handleProvisioningJob(job);
    expect(license.status).toBe('ACTIVE');  // Still ACTIVE, no duplicate errors
  });
});
```

---

## 14. Performance Optimization

### Database Indexes

**Already defined in Schema section.** Key indexes:

1. `idx_licenses_status` — Fast status filtering
2. `idx_licenses_created_at` — Fast pagination
3. `idx_licenses_product_id` — Fast product queries
4. `idx_licenses_soft_lock_until` — Fast expiration checks
5. `idx_licenses_status_created` — Composite for list queries

### Query Optimization

**Avoid N+1 Queries:**

```typescript
// ❌ Bad: N queries
const licenses = await licenseRepository.list();
for (const license of licenses) {
  const product = await productRepository.getById(license.product_id); // N queries
}

// ✅ Good: 1 query with JOIN
const licenses = await licenseRepository.listWithProductDetails();
// SELECT licenses.*, products.name FROM licenses JOIN products...
```

### Caching Strategy

**Cache Layers (Top to Bottom):**

1. **Redis (Application Cache)** — License data, TTL 5 minutes
2. **Database Query Cache** — Connection pool query plan cache
3. **Database Table Indexes** — Query execution optimization

**Cache Invalidation:**

- On license update (PATCH), invalidate Redis key immediately
- On status transition, invalidate immediately
- On soft-lock expiration, lazy invalidation (next access)

**Cache Key Pattern:**

```
license:{license_id}
license:workspace_slug:{workspace_slug}
```

### Concurrency Control

**Soft-Lock Expiration Race Condition:**

```
Scenario: Multiple requests see soft_lock_until expired simultaneously
↓
Solution: Use transactional UPDATE with WHERE condition
  UPDATE licenses
  SET status = 'ARCHIVED'
  WHERE id = ? AND status = 'SOFT_LOCKED' AND soft_lock_until < NOW()

First request: Succeeds, returns rows=1
Other requests: Fail (returns rows=0), see final ARCHIVED status in subsequent query
```

**Provisioning Job Idempotency:**

```
Scenario: Provisioning job executed twice for same license
↓
Solution: Check if database already exists
  SELECT datname FROM pg_database WHERE datname = 'tenant_' || workspace_slug
  If exists: Idempotent success (no-op)
  If not: Proceed with creation
```

---

## 15. Compliance & Alignment

### ADR Alignment

**ADR-0001: Database-per-Tenant**

- ✅ License 1:1 relationship with workspace_slug
- ✅ Each license provisions exactly one tenant database
- ✅ No shared student/attempt tables across licenses
- ✅ workspace_slug globally unique, immutable

**ADR-0005: Upgrade Opt-In**

- ✅ product_version snapshotted at creation (locked to specific version)
- ✅ Upgrade available flag computed at runtime
- ✅ Workspace must explicitly initiate upgrade (Stage 11)
- ✅ Migration executed per tenant in worker

**ADR-0006: Runtime Authoritative Time**

- ✅ created_at, updated_at, soft_lock_until use server-set NOW() (UTC)
- ✅ Storage uses TIMESTAMP WITH TIME ZONE (UTC default)
- ✅ No client-supplied timestamps accepted

**ADR-0007: Product Version Compatibility**

- ✅ License stores product_version (immutable)
- ✅ Middleware validates compatibility (deferred Stage 11)
- ✅ Incompatible versions trigger 426/503

**ADR-0008: Semantic Versioning**

- ✅ schema_version and product_version follow SemVer
- ✅ Version snapshotted at creation, immutable thereafter
- ✅ Forward-only migrations (no downgrades)

**ADR-0009: Rate Limiting**

- ✅ License creation endpoint rate-limited (e.g., 10/minute per IP)
- ✅ Status transition endpoints rate-limited

### Multi-Tenancy Guarantee

**Trust Chain Validation:**

```
Isolation (License ← Database-per-Tenant)
    ↓
License (Authorization layer)
    ↓
Authentication (User identity)
    ↓
Attempt (Interaction records, immutable snapshots)
    ↓
Runtime (Tenant-isolated execution)
    ↓
Frontoffice (UI, student-visible)
```

**Each step validates previous:**

- License middleware ensures only ACTIVE licenses can proceed
- Auth ensures user belongs to workspace
- Attempt engine ensures no cross-tenant reads
- No route can bypass license validation

### Access Control Layers

**MMC Admin Access:**

- Can view, create, edit, manage all licenses
- Requires MMC authentication + admin role

**Tenant User Access:**

- Can view own license (detail endpoint)
- Cannot edit or change status
- License middleware enforces workspace isolation

**Public Access:**

- No public endpoints (all authenticated)

---

## 16. Constitutional Mandates — Final Validation

### ✅ Mandate 1: Database-Per-Tenant Preserved

**Requirement:** One License → One Workspace → One Tenant DB

**Implementation:**

- License.workspace_slug UNIQUE (global uniqueness)
- Provisioning creates exactly one database per license
- No shared database for multiple licenses
- tenants_registry maps workspace_slug ↔ database_name (1:1)

**Validation:** ✅ ENFORCED

---

### ✅ Mandate 2: License as Single Source of Truth

**Requirement:** License status is authoritative; tenants_registry mirrors (never redefines)

**Implementation:**

- License.status stored in master_db (source of truth)
- tenants_registry.status mirrors licenses.status (read-only consistency)
- All status transitions routed through License Service only
- No direct SQL updates to tenants_registry allowed

**Validation:** ✅ ENFORCED

---

### ✅ Mandate 3: License Middleware as Access Gate

**Requirement:** Every request to tenant workspace must validate license status

**Implementation:**

- License middleware mandatory in request chain (positioned after tenant resolver)
- All tenant-bound routes require successful license middleware pass
- Status checks: PENDING_PROVISION → 503, SOFT_LOCKED → 403, ARCHIVED → 403, DELETED → 404
- No route can bypass license check

**Validation:** ✅ ENFORCED

---

### ✅ Mandate 4: All Timestamps UTC (Server-Authoritative)

**Requirement:** No client-supplied timestamps; all times in UTC

**Implementation:**

- created_at: DEFAULT NOW() (PostgreSQL NOW() is UTC)
- updated_at: Trigger-based update to NOW()
- soft_lock_until: NOW() + INTERVAL (server-calculated)
- archived_at: NOW() (server-set, not client)
- All stored as TIMESTAMP WITH TIME ZONE
- API responses return ISO8601 UTC format

**Validation:** ✅ ENFORCED

---

### ✅ Mandate 5: Version Immutability Enforced

**Requirement:** schema_version and product_version locked after creation

**Implementation:**

- schema_version snapshotted from platform at creation
- product_version snapshotted from product at creation
- Both fields NOT NULL, never updated (exception: forward-only version migration in Stage 11)
- Attempt by PATCH to edit these fields rejected with 400
- Compatibility checks at runtime (middleware, deferred Stage 11)

**Validation:** ✅ ENFORCED

---

### ✅ Mandate 6: No Cross-Tenant Joins Possible

**Requirement:** License design prevents cross-tenant data access

**Implementation:**

- Each tenant isolated in own database (no shared student/attempt tables)
- License.workspace_slug uniquely identifies workspace
- Tenant resolver uses license to route to correct database connection
- Middleware validates license before tenant DB access
- No SQL query can span multiple tenant databases

**Validation:** ✅ ENFORCED

---

### ✅ Mandate 7: Asynchronous Provisioning (No API Blocking)

**Requirement:** License creation does not block on database provisioning

**Implementation:**

- License created with PENDING_PROVISION status (immediate)
- Provisioning job enqueued to Redis (fire-and-forget)
- Worker executes provisioning asynchronously
- Middleware blocks PENDING_PROVISION requests (503 Service Unavailable)
- MMC can monitor provisioning status + retry failed jobs

**Validation:** ✅ ENFORCED

---

### ✅ Mandate 8: Commercial Unit Immutability

**Requirement:** product_id and workspace_slug cannot be changed mid-contract

**Implementation:**

- product_id FOREIGN KEY NOT NULL (binding product)
- workspace_slug UNIQUE NOT NULL (identity)
- Both fields: NOT included in PATCH endpoint (rejected if attempted)
- Rationale: Prevents audit trail corruption, ensures version consistency

**Validation:** ✅ ENFORCED

---

## Summary

This plan report provides a **complete, implementation-ready technical foundation** for
STAGE_10_LICENSES. All 16 sections establish:

1. **Architecture** — License as commercial activation layer binding Product → License → Workspace
2. **Database** — 21-field schema with version integrity, status lifecycle, provisioning tracking
3. **Migrations** — 3 phased migrations with schema version increments
4. **API** — 10 endpoints with detailed request/response schemas, error codes, side effects
5. **Middleware** — License enforcement with status validation and soft-lock expiration handling
6. **Worker** — Asynchronous provisioning with idempotency, retry policy, cleanup
7. **Versioning** — Immutable schema_version and product_version snapshots at creation
8. **Error Handling** — RFC 7807 standard with sanitized/full logging distinction
9. **Logging** — Structured JSON with correlation_id propagation, critical events tracked
10. **UI** — MMC interface with list, detail, create, edit, and status modals
11. **Implementation** — 7-layer architecture (routes, controllers, services, repositories, jobs,
    middleware, UI)
12. **Data Flows** — License creation → provisioning and student login → middleware check
13. **Testing** — Unit, integration, API contract, E2E, and worker job test strategies
14. **Performance** — Index strategy, query optimization, caching (5m TTL), concurrency control
15. **Compliance** — Alignment with ADR-0001, -0005, -0006, -0007, -0008
16. **Constitutional Mandates** — Validation of 8 core guarantees (isolation, versioning,
    immutability, multi-tenancy)

**Status: READY FOR TASKS PHASE**

All architectural decisions are locked. No major design changes without ADR approval. Next phase:
Generate TASKS_REPORT.md with implementation task breakdowns, dependencies, and effort estimates.
