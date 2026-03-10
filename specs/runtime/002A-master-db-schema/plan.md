# Implementation Plan: Master Database Schema

**Stage**: STAGE_02A_MASTER_DATABASE_SCHEMA  
**Phase**: 01 – Platform Foundation  
**Related Spec**: [spec.md](spec.md)  
**Related ADR**: ADR-0001 (Database-per-Tenant)  
**Created**: 2026-02-16  
**Status**: Draft

---

## Stage Alignment

**Phase**: 01 – Platform Foundation  
**Stage**: STAGE_02A_MASTER_DATABASE_SCHEMA  
**Related Spec File**: [spec.md](spec.md)  
**Related ADR**: ADR-0001-database-per-tenant.md

This plan implements the authoritative schema for `master_db` as the control plane of Zidney. Plan
strictly adheres to stage scope and does not modify architecture.

---

## Architectural Scope Confirmation

- ✓ No cross-tenant data access: Master DB only
- ✓ No middleware bypass: Schema enforces architecture
- ✓ No direct DB instantiation: Migration system controls schema creation
- ✓ No grading logic outside Worker: N/A
- ✓ No weakening of snapshot integrity: N/A
- ✓ No weakening of version enforcement: Schema enables version enforcement
- ✓ No layer boundary violation: Schema-only feature

No exceptions required.

---

## Implementation Layers

### API Layer

No API endpoints introduced in this stage. This is schema-only.

Rationale: Schema is foundational; API operations on this schema will be implemented in subsequent
features (license provisioning, MMC authentication, etc.).

### Worker Layer

No Worker tasks introduced in this stage.

Rationale: Schema creation is a one-time deployment operation, not a recurring background job.

### Frontend Layer

No frontend implementation required.

### Migration System

All schema creation flows through the migration system:

- Migration file: `apps/api/src/db/master/migrations/001_initial_schema.ts`
- Migration runner: Executed at application startup
- Rollback behavior: Database snapshot restore only (per ADR-0008)

---

## Database Impact

### Master DB

**Tables Created**:

1. **products**
   - UUID primary key
   - Unique constraint on `slug`
   - JSONB type for `enabled_modules`
   - Server-authoritative timestamps

2. **licenses**
   - UUID primary key
   - Foreign key to `products` (id)
   - Unique constraint on `workspace_slug`
   - Status enum: ACTIVE, SOFT_LOCKED, ARCHIVED
   - Nullable columns: student_limit, staff_limit, soft_lock_until, archived_at, deleted_at
   - Server-authoritative timestamps

3. **tenants_registry**
   - UUID primary key
   - Foreign key to `licenses` (id)
   - Unique constraint on `workspace_slug`
   - Encrypted password storage field
   - Server-authoritative timestamps
   - **Architectural rule**: Does NOT duplicate license status; reads status only from `licenses`

4. **mmc_users**
   - Integer primary key (or UUID)
   - Unique constraint on `email`
   - Hashed password storage
   - Role column for RBAC
   - is_active boolean for soft deletion
   - created_at timestamp

5. **platform_schema_version**
   - Single row table (id = 1)
   - current_version: semantic version string
   - minimum_supported_version: semantic version string
   - updated_at: server-authoritative timestamp

**Migration Required**: Yes

**Version Bump Required**: Yes (schema_version incremented to 1.0.0)

**Backward Compatibility**: N/A (initial schema)

### Tenant DB

No changes to tenant DB schema in this stage.

---

## Transaction Design

### DDL Transaction Boundaries

**Primary Migration Transaction**:

```sql
BEGIN TRANSACTION;
  -- Create payment/product domain tables
  CREATE TABLE products (...)
  CREATE TABLE licenses (...)

  -- Create infrastructure metadata table
  CREATE TABLE tenants_registry (...)

  -- Create MMC internal user table
  CREATE TABLE mmc_users (...)

  -- Create version control table
  CREATE TABLE platform_schema_version (...)

  -- Insert initial platform schema version
  INSERT INTO platform_schema_version (id, current_version, minimum_supported_version, updated_at)
  VALUES (1, '1.0.0', '1.0.0', NOW());

  -- Update migration marker in master_db
  INSERT INTO _schema_migrations (version, description, applied_at)
  VALUES ('001', 'Initial master database schema', NOW());
COMMIT;
```

**Isolation Level**: READ COMMITTED (PostgreSQL default)

**Atomicity Guarantee**: All-or-nothing: Either entire schema is created or no changes persist

**Rollback Behavior**: Automatic rollback on any error; database snapshot restore only for manual
rollback (per ADR-0008)

---

## Idempotency Plan

**Idempotency**: Not applicable for DDL operations.

Rationale: Schema creation is not a repeatable operation. DDL is naturally protected by database
constraints:

- Duplicate `CREATE TABLE` fails with "table already exists"
- Migration system prevents re-execution via `_schema_migrations` tracking table

**Protection Mechanism**:

- Migration file includes version number check:
  ```sql
  IF NOT EXISTS (SELECT FROM _schema_migrations WHERE version = '001') THEN
    -- Run migration
  END IF;
  ```

---

## Version Enforcement Strategy

### Schema Versioning

**Where Validated**:

1. Migration system reads `platform_schema_version` table at runtime startup
2. Tenant resolver middleware validates `schema_version` from `tenants_registry` table
3. API middleware compares tenant `schema_version` against
   `platform_schema_version.minimum_supported_version`

**Validation Logic**:

```pseudocode
On API request:
  1. License middleware checks licenses.product_version
  2. Tenant resolver checks tenants_registry.schema_version against platform_schema_version.current_version
  3. If mismatch → 426 Upgrade Required
  4. If below minimum → 423 Locked (SOFT_LOCKED)
```

**On Version Mismatch**:

- `schema_version` mismatch → HTTP 426 (Upgrade Required)
- `product_version` mismatch → HTTP 426 (Upgrade Required)
- License status SOFT_LOCKED → HTTP 423 (Locked)

**Backward Compatibility**:

- Schema is versioned forward-only
- New tenants inherit `schema_version` from `platform_schema_version.current_version` at
  provisioning
- Existing tenants validated against `minimum_supported_version`

---

## Authoritative Time Handling

### Server-Authoritative Timestamps

All timestamp columns use server time only:

**Field Definitions**:

- `created_at`: `TIMESTAMP DEFAULT NOW()` (auto-set at creation)
- `updated_at`: `TIMESTAMP DEFAULT NOW()` (manual update required)
- `starts_at`: `TIMESTAMP NOT NULL` (license validity start, server clock)
- `expires_at`: `TIMESTAMP NOT NULL` (license validity end, server clock)
- `soft_lock_until`: `TIMESTAMP NULL` (temporary lock deadline, server clock)
- `archived_at`: `TIMESTAMP NULL` (soft deletion marker, server clock)
- `deleted_at`: `TIMESTAMP NULL` (hard deletion marker, server clock)

**Validation Rules**:

- `expires_at` > `starts_at` (enforced at trigger/application level)
- `soft_lock_until` compared against `NOW()` for lock status determination
- No client-supplied timestamps accepted for any of these fields

**Timezone**: All timestamps stored in UTC, client handles timezone conversion

---

## Observability & Logging

### Structured Logging

All database operations logged in structured format:

**Log Format** (JSON):

```json
{
  "timestamp": "2026-02-16T12:34:56Z",
  "level": "INFO|WARN|ERROR",
  "service": "master-db-schema-migration",
  "correlation_id": "uuid",
  "migration_version": "001",
  "migration_name": "initial_schema",
  "status": "started|completed|failed",
  "duration_ms": 1234,
  "tables_created": ["products", "licenses", "tenants_registry", "mmc_users", "platform_schema_version"],
  "error": null | {"code": "...", "message": "..."}
}
```

**Required Fields** (always included):

- timestamp
- level
- service
- correlation_id
- migration_version

**Optional Fields** (when applicable):

- tables_affected
- rows_inserted
- error.code
- error.message
- duration_ms

**Forbidden**:

- Plain console.log()
- Unstructured error messages
- Sensitive data (passwords, tokens)
- Stack traces to client

---

## Constraint Design

### Primary Keys

All tables use UUID primary keys except:

- `mmc_users`: Can use INTEGER SERIAL (internal system table)
- `platform_schema_version`: INTEGER with fixed id = 1

### Foreign Keys

```sql
-- licenses → products
ALTER TABLE licenses ADD CONSTRAINT fk_licenses_product_id
  FOREIGN KEY (product_id) REFERENCES products(id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- tenants_registry → licenses
ALTER TABLE tenants_registry ADD CONSTRAINT fk_tenants_registry_license_id
  FOREIGN KEY (license_id) REFERENCES licenses(id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
```

**Rationale for RESTRICT**: Product deletion or license deletion should fail if referenced,
preventing accidental orphaning of infrastructure metadata.

### Unique Constraints

```sql
-- Prevent duplicate products by slug
UNIQUE (slug) ON products

-- Prevent duplicate workspace registrations
UNIQUE (workspace_slug) ON licenses
UNIQUE (workspace_slug) ON tenants_registry

-- Prevent duplicate MMC users by email
UNIQUE (email) ON mmc_users
```

**Enforcement**: Database-level constraints (not application-level)

### Indexes

```sql
-- Fast license lookup by workspace_slug
CREATE INDEX idx_licenses_workspace_slug ON licenses(workspace_slug);

-- Fast tenant registry lookup by workspace_slug
CREATE INDEX idx_tenants_registry_workspace_slug ON tenants_registry(workspace_slug);

-- Fast license lookup by status (for SOFT_LOCK, ARCHIVED filtering)
CREATE INDEX idx_licenses_status ON licenses(status);

-- Fast product lookup by slug
CREATE INDEX idx_products_slug ON products(slug);

-- Fast MMC user lookup by email
CREATE INDEX idx_mmc_users_email ON mmc_users(email);
```

---

## Failure Modes & Recovery

### Migration Failure Scenarios

**Scenario 1: Table Already Exists**

- Cause: Migration re-executed on already-migrated database
- Detection: `CREATE TABLE` returns duplicate table error
- Recovery: Automatic (migration system skips via `_schema_migrations` check)
- Log: WARN level, non-fatal

**Scenario 2: Invalid Foreign Key**

- Cause: Product table creation fails before license table
- Detection: Foreign key constraint cannot be created
- Recovery: Automatic rollback of entire transaction
- Log: ERROR level, fatal (requires manual intervention)

**Scenario 3: Constraint Violation**

- Cause: Duplicate unique key insertion for initial data
- Detection: `UNIQUE` constraint violation
- Recovery: Automatic transaction rollback
- Log: ERROR level, fatal

**Scenario 4: Database Connection Failure**

- Cause: Database unavailable during migration
- Detection: Connection pool failure
- Recovery: Retry logic with exponential backoff (max 5 attempts)
- Log: ERROR level after final retry

**Scenario 5: Disk Space Exhaustion**

- Cause: Database disk full
- Detection: `OUT OF SPACE` database error
- Recovery: Manual intervention required (free disk space, restart migration)
- Log: ERROR level, fatal

### Recovery Paths

| Failure Mode            | Recovery                  | RTO     | Notes                                          |
| ----------------------- | ------------------------- | ------- | ---------------------------------------------- |
| Table exists            | Automatic skip            | 0s      | Migration idempotency via `_schema_migrations` |
| FK constraint error     | Transaction rollback      | <1s     | Automatic rollback, contact support            |
| Unique constraint error | Transaction rollback      | <1s     | Data conflict, manual schema review            |
| DB connection error     | Exponential backoff retry | 30-120s | Up to 5 retries, then manual                   |
| Disk space error        | Manual intervention       | N/A     | Admin must free space, restart                 |

---

## Rate Limiting

**Not applicable for DDL operations.**

Rationale: Schema migration is performed once at deployment, not per-request.

Future API endpoints operating on this schema will implement rate limiting:

- License provisioning: 1 request per minute per IP
- MMC authentication: 5 login attempts per minute per IP

---

## Error Code Mapping

For future operations on this schema:

| HTTP Code                   | Condition                | Message                                                      | Action                |
| --------------------------- | ------------------------ | ------------------------------------------------------------ | --------------------- |
| 400 (Bad Request)           | Missing required field   | "Field {field} is required"                                  | Client resubmit       |
| 401 (Unauthorized)          | Missing JWT              | "Authorization header required"                              | Client authenticate   |
| 403 (Forbidden)             | Insufficient permissions | "User role does not permit this action"                      | Check RBAC            |
| 404 (Not Found)             | License not found        | "License with id {id} not found"                             | Verify license_id     |
| 409 (Conflict)              | Duplicate workspace_slug | "Workspace slug already exists"                              | Choose different slug |
| 426 (Upgrade Required)      | Version mismatch         | "Runtime version {x.y.z} incompatible with platform {x.y.z}" | Upgrade runtime       |
| 500 (Internal Server Error) | Database error           | "Database operation failed"                                  | Contact support       |

---

## Test Strategy

### Unit Tests

**Target**: Schema constraint validation

```typescript
describe('Master Database Schema', () => {
  describe('products table', () => {
    test('UUID primary key enforced', () => { ... })
    test('slug unique constraint enforced', () => { ... })
    test('enabled_modules accepts JSONB', () => { ... })
  })

  describe('licenses table', () => {
    test('workspace_slug unique constraint enforced', () => { ... })
    test('status enum validation', () => { ... })
    test('foreign key to products enforced', () => { ... })
    test('student_limit nullable', () => { ... })
    test('staff_limit nullable', () => { ... })
  })

  describe('tenants_registry table', () => {
    test('workspace_slug unique constraint enforced', () => { ... })
    test('foreign key to licenses enforced', () => { ... })
    test('Does NOT duplicate license status', () => { ... })
  })

  describe('mmc_users table', () => {
    test('email unique constraint enforced', () => { ... })
    test('role column exists for RBAC', () => { ... })
  })

  describe('platform_schema_version table', () => {
    test('Single row constraint (id = 1)', () => { ... })
    test('Semantic version format validation', () => { ... })
  })
})
```

### Integration Tests

**Target**: Migration execution and rollback

```typescript
describe('Master Database Migration: 001_initial_schema', () => {
  test('Migration creates all 5 tables', async () => { ... })
  test('All foreign key constraints enforced', async () => { ... })
  test('All unique constraints enforced', async () => { ... })
  test('All indexes created', async () => { ... })
  test('platform_schema_version initialized with 1.0.0', async () => { ... })
  test('Migration idempotency: re-run does not fail', async () => { ... })
  test('Migration marks completion in _schema_migrations', async () => { ... })
})
```

### Isolation Tests

**Target**: No pollution of tenant databases

```typescript
describe('Master DB Isolation', () => {
  test('Master tables not present in tenant_1 database', async () => { ... })
  test('Tenant tables not present in master database', async () => { ... })
  test('Connection pool isolation maintained', async () => { ... })
})
```

### Transaction Rollback Test

**Target**: Atomicity enforcement

```typescript
describe("Transaction Rollback", () => {
  test("Partial migration failure rolls back all changes", async () => {
    // Simulate FK constraint error mid-transaction
    // Verify all DDL reverted
  });

  test("Database state consistent after rollback", async () => {
    // Verify no orphaned tables or indexes
  });
});
```

### Version Enforcement Test

**Target**: Future middleware behavior (integration point)

```typescript
describe('Version Validation', () => {
  test('platform_schema_version.current_version readable', async () => { ... })
  test('schema_version comparison logic works', async () => { ... })
  test('Minimum version check prevents old clients', async () => { ... })
})
```

### Security Test

**Target**: No sensitive data in logs

```typescript
describe('Schema Security', () => {
  test('Migration logs contain no passwords', () => { ... })
  test('Migration logs contain no connection strings', () => { ... })
  test('db_password_encrypted field is properly encrypted', () => { ... })
})
```

---

## Rollback Strategy

### Forward-Only Migration Model

Zidney uses forward-only migrations with snapshot restore:

**Rollback Path**:

```
Deploy v1.0.0 (schema) → Issues detected → Restore v0.9.9 snapshot → Redeploy fixed v1.0.1
```

**Never Reverse Migration**:

- No `DOWN` migrations created
- No schema alterations in reverse
- Schema version only increments

**Data Preservation**:

- Snapshot captured before deployment
- Rollback by database restore, not SQL ROLLBACK
- All data integrity preserved

**Feature Flag** (if needed):

- This stage does not introduce feature flags (pure schema)
- Future features using this schema may use flags

---

## Architectural Authority Rules

**Enforcement**:

1. **`licenses` is single source of truth for lifecycle state**
   - `tenants_registry.status` field MUST NOT exist
   - Resolver reads status ONLY from `licenses` table
   - Verification: Code review + integration test

2. **`tenants_registry` stores infrastructure metadata only**
   - No business logic in this table
   - Only columns: id, license_id, workspace_slug, db name/host/port/user/password, schema_version,
     product_version, timestamps
   - Verification: Schema constraint review

3. **No business logic in master_db**
   - No stored procedures with logic
   - No calculated fields
   - No cached data
   - Verification: Migration review + audit

4. **All lifecycle transitions update `licenses` first**
   - When license SOFT_LOCKed: Update `licenses.status` and `licenses.soft_lock_until`
   - When license ARCHIVED: Update `licenses.status` and `licenses.archived_at`
   - When license deleted: Update `licenses.deleted_at`
   - Verification: Future feature implementation review

---

## Non-Goals

This implementation does NOT include:

- API endpoints for license operations
- MMC user authentication logic
- License validation middleware enforcement
- Tenant provisioning logic
- Tenant database schema creation
- Version compatibility checks
- Worker tasks
- Frontend UI
- Database encryption key management (assumed handled by operations)
- Connection pooling implementation (assumed by Bun runtime)

---

## Deployment Checklist

- [ ] Migration file created: `apps/api/src/db/master/migrations/001_initial_schema.ts`
- [ ] All 5 tables created with correct schemas
- [ ] All primary keys defined (UUIDs)
- [ ] All foreign key constraints defined
- [ ] All unique constraints defined
- [ ] All indexes created
- [ ] platform_schema_version initialized to 1.0.0
- [ ] \_schema_migrations marking in place
- [ ] Logging configured (structured format)
- [ ] Error handling tested
- [ ] Migration rollback tested (snapshot restore)
- [ ] Isolation verified (no tenant data leakage)
- [ ] TypeScript strict passes
- [ ] Integration tests pass
- [ ] Security review passed
- [ ] No secrets in migration code
- [ ] Documentation updated

---

## Final Compliance Statement

Implementation plan compliant with Zidney Constitution v1.2.0 — No violations detected.
