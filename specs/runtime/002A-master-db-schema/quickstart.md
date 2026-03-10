# Quick Start: Master Database Schema

**Feature**: 002A-master-db-schema  
**Stage**: STAGE_02A_MASTER_DATABASE_SCHEMA  
**Created**: 2026-02-16

---

## Overview

This quick start guide explains how the master database schema is structured and used in Zidney's
architecture. The master database is the **control plane** — it manages products, licenses, and
tenant metadata, but never stores runtime data.

---

## Key Concepts

### 1. Master Database vs. Tenant Databases

**Master Database**:

- Single PostgreSQL instance shared across all Zidney deployments
- Stores: Products, Licenses, Tenant Registry, MMC Users, Version Control
- Size: Small and stable (rarely changes)
- Access: Limited to provisioning and license enforcement

**Tenant Databases**:

- One database per workspace (database-per-tenant model)
- Stores: Students, Exams, Attempts, Certificates, Runtime Data
- Size: Grows with usage
- Access: Only after license validation

### 2. License Lifecycle

Every workspace has one license that controls access:

```
Purchase → ACTIVE (workspace can operate) →
  ├─→ SOFT_LOCKED (temporary lock, e.g., payment overdue) →
  ├─→ ARCHIVED (permanent disable) →
  └─→ Back to ACTIVE (after resolving block)
```

The `licenses` table is the **single source of truth** for this state.

### 3. Tenant Resolution

When a user requests `https://acme.zidney.app/exam`, the platform:

1. **Extract workspace slug**: `acme` from domain/path
2. **Query licenses table**: Find license with `workspace_slug = 'acme'`
3. **Check status**: If `status` ≠ ACTIVE → Block (423 or 426)
4. **Query tenants_registry**: Get database connection for workspace
5. **Connect to tenant database**: Execute request against workspace database

---

## Table Relationships

### products Table

Defines product SKUs that can be offered to customers.

```sql
INSERT INTO products (id, name, slug, version, enabled_modules, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'Zidney Professional',
  'zidney-pro',
  '1.0.0',
  '{"exams": true, "certificates": true, "analytics": true}',
  NOW(),
  NOW()
);
```

### licenses Table

Represents a purchased product instance bound to a workspace.

```sql
INSERT INTO licenses (
  id, product_id, workspace_slug, student_limit, staff_limit,
  status, starts_at, expires_at, product_version, schema_version,
  soft_lock_until, archived_at, deleted_at, created_at, updated_at
) VALUES (
  '660e8400-e29b-41d4-a716-446655440001'::uuid,
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'acme',
  500,          -- max 500 students
  50,           -- max 50 staff
  'ACTIVE',
  '2026-02-16'::timestamp,
  '2027-02-16'::timestamp,
  '1.0.0',
  '1.0.0',
  NULL,
  NULL,
  NULL,
  NOW(),
  NOW()
);
```

**Key Points**:

- `workspace_slug` is UNIQUE — only one license per workspace
- `status` controls access (ACTIVE, SOFT_LOCKED, ARCHIVED)
- `student_limit` and `staff_limit` are enforced at runtime (not in DB)
- `product_version` and `schema_version` are frozen at purchase (for compatibility)

### tenants_registry Table

Stores connection details for the workspace's tenant database.

```sql
INSERT INTO tenants_registry (
  id, license_id, workspace_slug, db_name, db_host, db_port, db_user,
  db_password_encrypted, schema_version, product_version, created_at, updated_at
) VALUES (
  '770e8400-e29b-41d4-a716-446655440002'::uuid,
  '660e8400-e29b-41d4-a716-446655440001'::uuid,
  'acme',
  'acme_db',
  'tenant-1.db.zidney.internal',
  5432,
  'acme_user',
  '$encrypted$AES256$...',  -- Encrypted password
  '1.0.0',
  '1.0.0',
  NOW(),
  NOW()
);
```

**Key Points**:

- `workspace_slug` UNIQUE — one database per workspace
- `license_id` links to license (for authority checks)
- `db_password_encrypted` is encrypted (never plain text)
- **Does NOT store lifecycle state** — reads status from `licenses` table

### mmc_users Table

Internal users for the MMC (Master Management Console).

```sql
INSERT INTO mmc_users (email, password_hash, role, is_active, created_at)
VALUES (
  'admin@zidney.com',
  '$2b$12$abcdef...',  -- bcrypt hash
  'admin',
  true,
  NOW()
);
```

**Roles**:

- `admin`: Can create/update/delete products and licenses
- `operator`: Can manage licenses and view analytics
- `read_only`: Can view reports only

### platform_schema_version Table

Controls version compatibility across the platform.

```sql
INSERT INTO platform_schema_version (id, current_version, minimum_supported_version, updated_at)
VALUES (1, '1.0.0', '1.0.0', NOW());
```

**Usage**:

- When runtime starts: It checks its version against `minimum_supported_version`
- If incompatible → Block with 426 Upgrade Required
- If compatible → Allow, but enforce schema_version compatibility per-tenant

---

## Common Queries

### Find a workspace's license

```sql
SELECT * FROM licenses WHERE workspace_slug = 'acme';
```

### Check if workspace is active

```sql
SELECT status FROM licenses WHERE workspace_slug = 'acme' AND deleted_at IS NULL;
```

### Get workspace's database connection

```sql
SELECT db_name, db_host, db_port, db_user, db_password_encrypted
FROM tenants_registry
WHERE workspace_slug = 'acme';
```

### Soft-lock a workspace (payment overdue)

```sql
UPDATE licenses
SET status = 'SOFT_LOCKED',
    soft_lock_until = NOW() + INTERVAL '30 days'
WHERE workspace_slug = 'acme';
```

### Unlock a workspace

```sql
UPDATE licenses
SET status = 'ACTIVE',
    soft_lock_until = NULL
WHERE workspace_slug = 'acme';
```

### Verify schema compatibility

```sql
SELECT current_version, minimum_supported_version
FROM platform_schema_version WHERE id = 1;

-- Runtime compares its version:
-- If runtime_version < minimum_supported_version → Incompatible (426)
-- If runtime_version >= minimum_supported_version AND backward compatible → OK
```

---

## Architectural Rules

### 1. `licenses` is Single Source of Truth

❌ WRONG: Reading status from `tenants_registry`

```sql
SELECT status FROM tenants_registry WHERE workspace_slug = 'acme';  -- WRONG!
```

✅ CORRECT: Reading status from `licenses`

```sql
SELECT status FROM licenses WHERE workspace_slug = 'acme';  -- CORRECT
```

### 2. No Tenant Data in Master DB

❌ NOT STORED in master DB:

- students
- exams
- attempts
- certificates
- submissions
- grades

✅ These are stored in tenant databases after license validation.

### 3. Lifecycle State Only in licenses

❌ WRONG: `tenants_registry` duplicating status

```sql
CREATE TABLE tenants_registry (
  ...
  status ENUM,  -- WRONG! Causes inconsistency
);
```

✅ CORRECT: Only in `licenses`

```sql
-- tenants_registry has NO status field
```

### 4. Server-Authoritative Time

❌ WRONG: Accepting client time

```python
expires_at = request.json['expires_at']  # Client says when license expires
UPDATE licenses SET expires_at = expires_at WHERE id = id;  # WRONG!
```

✓ CORRECT: Server provides time

```python
expires_at = datetime.now() + timedelta(days=365)  # Server decides
UPDATE licenses SET expires_at = expires_at WHERE id = id;  # CORRECT
```

---

## Error Handling

### Version Mismatch (426 Upgrade Required)

```
Runtime version: 0.8.0
Platform minimum_supported_version: 1.0.0

Response: 426 Upgrade Required
```

### License Soft-Locked (423 Locked)

```
License status: SOFT_LOCKED
soft_lock_until: 2026-03-15 (not yet expired)

Response: 423 Locked
```

### License Expired (403 Forbidden)

```
License status: ARCHIVED

Response: 403 Forbidden
```

### Workspace Not Found (404 Not Found)

```
workspace_slug 'invalid' does not exist in licenses table

Response: 404 Not Found
```

---

## Deployment Checklist

- [ ] Master database created with PostgreSQL
- [ ] All 5 tables created with correct schemas
- [ ] Foreign key constraints validated
- [ ] Unique constraints validated
- [ ] Indexes created for performance
- [ ] Initial product inserted
- [ ] Initial license created
- [ ] Initial tenant registry populated
- [ ] Initial MMC user created
- [ ] platform_schema_version initialized to 1.0.0
- [ ] Application migration system integrated
- [ ] License middleware implemented
- [ ] Tenant resolver implemented
- [ ] Logging configured (structured JSON)
- [ ] Error codes mapped
- [ ] Tested with sample queries

---

## Next Steps

1. **After Master Schema**: Implement license enforcement middleware (stage 2B)
2. **After License Middleware**: Implement tenant database schemas (stage 3)
3. **After Tenant Schemas**: Implement provisioning logic (stage 4)
4. **After Provisioning**: Implement runtime (stage 5)

This schema is the foundation — all subsequent features build on it.
