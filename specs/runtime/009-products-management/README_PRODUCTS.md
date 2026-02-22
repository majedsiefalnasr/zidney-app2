# Products Database Schema & Queries

## Overview

The Products Management feature uses three tables in PostgreSQL:

1. **products** - Current product state
2. **product_versions** - Version history (append-only)
3. **product_audit_logs** - Audit trail (append-only)

All three tables support CASCADE DELETE for referential integrity.

## Table: products

### Purpose

Stores the current state of each product. Updated when product details or status change.

### Schema

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  name JSONB NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  enabled_modules TEXT[] NOT NULL,
  status VARCHAR(50) NOT NULL,
  current_version INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  created_by UUID NOT NULL
);
```

### Column Definitions

| Column          | Type         | Nullable | Constraints | Description                                     |
| --------------- | ------------ | -------- | ----------- | ----------------------------------------------- |
| id              | UUID         | NO       | PRIMARY KEY | Unique product identifier (generated on create) |
| name            | JSONB        | NO       | -           | Localized names: `{"en": "...", "ar": "..."}`   |
| slug            | VARCHAR(255) | NO       | UNIQUE      | URL-friendly identifier (immutable, lowercase)  |
| description     | TEXT         | YES      | -           | Optional product description                    |
| enabled_modules | TEXT[]       | NO       | -           | Array of enabled feature modules                |
| status          | VARCHAR(50)  | NO       | -           | ACTIVE or INACTIVE                              |
| current_version | INTEGER      | NO       | -           | Current version number (starts at 1)            |
| created_at      | TIMESTAMP    | NO       | -           | Product creation timestamp (UTC)                |
| updated_at      | TIMESTAMP    | NO       | -           | Last update timestamp (UTC)                     |
| created_by      | UUID         | NO       | -           | User ID who created the product                 |

### Indexes

```sql
-- Speed up slug lookups (enforces uniqueness)
CREATE UNIQUE INDEX idx_products_slug ON products(slug);

-- Speed up status-based filtering
CREATE INDEX idx_products_status ON products(status);

-- Speed up sorted listing (newest first)
CREATE INDEX idx_products_created_at ON products(created_at DESC);
```

### Example Row

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": {
    "en": "Calculus Assessment",
    "ar": "تقييم الحساب"
  },
  "slug": "calculus-assessment",
  "description": "Comprehensive calculus assessment suite",
  "enabled_modules": [
    "MODULE_ASSESSMENT",
    "MODULE_ATTEMPT",
    "MODULE_REPORTING"
  ],
  "status": "ACTIVE",
  "current_version": 3,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T12:45:00Z",
  "created_by": "user-789"
}
```

### Constraints

- **PRIMARY KEY (id)**: Ensures unique product IDs
- **UNIQUE (slug)**: Ensures slug uniqueness across all products
- **NOT NULL (name, slug, enabled_modules, status, current_version, created_at, updated_at)**: Required fields
- **CHECK (status IN ('ACTIVE', 'INACTIVE'))**: _(application-enforced)_ Valid status values

## Table: product_versions

### Purpose

Immutable history of all product configuration changes. Append-only table - records are never updated or deleted directly.

### Schema

```sql
CREATE TABLE product_versions (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  name JSONB NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  enabled_modules TEXT[] NOT NULL,
  created_at TIMESTAMP NOT NULL,
  created_by UUID NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_product_versions_unique
  ON product_versions(product_id, version_number);
CREATE INDEX idx_product_versions_created_at
  ON product_versions(created_at DESC);
```

### Column Definitions

| Column          | Type         | Nullable | Description                              |
| --------------- | ------------ | -------- | ---------------------------------------- |
| id              | UUID         | NO       | Version record identifier                |
| product_id      | UUID         | NO       | Foreign key to products(id)              |
| version_number  | INTEGER      | NO       | Sequential version number (1, 2, 3, ...) |
| name            | JSONB        | NO       | Name at this version                     |
| slug            | VARCHAR(255) | NO       | Slug at this version (always immutable)  |
| description     | TEXT         | YES      | Description at this version              |
| enabled_modules | TEXT[]       | NO       | Modules at this version                  |
| created_at      | TIMESTAMP    | NO       | When this version was created            |
| created_by      | UUID         | NO       | User who created this version            |

### Constraints

- **PRIMARY KEY (id)**: Unique version record identifier
- **FOREIGN KEY (product_id)**: Links to products table (CASCADE DELETE)
- **UNIQUE (product_id, version_number)**: Ensures no duplicate versions for same product
- **NOT NULL**: All columns except description are required

### Key Characteristics

**Append-Only**: New versions added on each update, never modified or deleted.

**Immutable**: Once created, version records never change.

**Complete Snapshot**: Each version contains complete product state at that point in time.

**Version Numbering**: Starts at 1, increments sequentially. No gaps.

### Example Rows

```sql
-- Version 1 (Creation)
{
  "id": "version-1",
  "product_id": "prod-123",
  "version_number": 1,
  "name": {"en": "Calculus Assessment"},
  "slug": "calculus-assessment",
  "description": null,
  "enabled_modules": ["MODULE_ASSESSMENT"],
  "created_at": "2024-01-15T10:30:00Z",
  "created_by": "user-789"
}

-- Version 2 (Added description and module)
{
  "id": "version-2",
  "product_id": "prod-123",
  "version_number": 2,
  "name": {"en": "Calculus Assessment"},
  "slug": "calculus-assessment",
  "description": "Complete assessment suite",
  "enabled_modules": ["MODULE_ASSESSMENT", "MODULE_ATTEMPT"],
  "created_at": "2024-01-15T11:00:00Z",
  "created_by": "user-789"
}

-- Version 3 (Updated description)
{
  "id": "version-3",
  "product_id": "prod-123",
  "version_number": 3,
  "name": {"en": "Calculus Assessment"},
  "slug": "calculus-assessment",
  "description": "Enhanced assessment suite with reporting",
  "enabled_modules": ["MODULE_ASSESSMENT", "MODULE_ATTEMPT", "MODULE_REPORTING"],
  "created_at": "2024-01-15T12:45:00Z",
  "created_by": "user-789"
}
```

### Status Change Note

Status changes do **NOT** create new versions. They only create audit log entries.

## Table: product_audit_logs

### Purpose

Complete audit trail of all product changes (creates, updates, status changes, deletes). Append-only for compliance.

### Schema

```sql
CREATE TABLE product_audit_logs (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  performed_by UUID NOT NULL,
  previous_version INTEGER,
  new_version INTEGER,
  changed_fields JSONB,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_audit_logs_product_id ON product_audit_logs(product_id);
CREATE INDEX idx_audit_logs_action ON product_audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON product_audit_logs(timestamp DESC);
```

### Column Definitions

| Column           | Type        | Nullable | Description                                           |
| ---------------- | ----------- | -------- | ----------------------------------------------------- |
| id               | UUID        | NO       | Audit log entry identifier                            |
| product_id       | UUID        | NO       | Product being audited                                 |
| action           | VARCHAR(50) | NO       | CREATE, UPDATE, or STATUS_CHANGE                      |
| timestamp        | TIMESTAMP   | NO       | When the action occurred (UTC)                        |
| performed_by     | UUID        | NO       | User who performed the action                         |
| previous_version | INTEGER     | YES      | Version before update (null for CREATE/STATUS_CHANGE) |
| new_version      | INTEGER     | YES      | Version after update (null for STATUS_CHANGE)         |
| changed_fields   | JSONB       | YES      | Fields that changed (UPDATE only)                     |

### Action Values

| Action        | Meaning         | When Created                            | Version Fields                       | changed_fields |
| ------------- | --------------- | --------------------------------------- | ------------------------------------ | -------------- |
| CREATE        | Product created | During creation                         | new_version=1, previous_version=null | null           |
| UPDATE        | Product updated | Configuration change that bumps version | Both populated                       | Populated      |
| STATUS_CHANGE | Status changed  | Status toggled                          | Both null                            | null           |

### Example Rows

```json
{
  "id": "audit-1",
  "product_id": "prod-123",
  "action": "CREATE",
  "timestamp": "2024-01-15T10:30:00Z",
  "performed_by": "user-789",
  "previous_version": null,
  "new_version": 1,
  "changed_fields": null
}

{
  "id": "audit-2",
  "product_id": "prod-123",
  "action": "UPDATE",
  "timestamp": "2024-01-15T11:00:00Z",
  "performed_by": "user-789",
  "previous_version": 1,
  "new_version": 2,
  "changed_fields": {
    "description": {
      "old_value": null,
      "new_value": "Complete assessment suite"
    },
    "enabled_modules": {
      "old_value": ["MODULE_ASSESSMENT"],
      "new_value": ["MODULE_ASSESSMENT", "MODULE_ATTEMPT"]
    }
  }
}

{
  "id": "audit-3",
  "product_id": "prod-123",
  "action": "STATUS_CHANGE",
  "timestamp": "2024-01-15T14:00:00Z",
  "performed_by": "user-789",
  "previous_version": null,
  "new_version": null,
  "changed_fields": null
}
```

## Common Queries

### Find Product by ID

```sql
SELECT * FROM products WHERE id = $1;
```

**Performance**: O(1) - Primary key lookup

### Find Product by Slug

```sql
SELECT * FROM products WHERE slug = $1;
```

**Performance**: O(1) - Unique index on slug

### List Products (Paginated)

```sql
SELECT * FROM products
WHERE status = 'ACTIVE'
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;
```

**Performance**: O(log n + k) using index on status, created_at

- Use LIMIT 10-100 for pagination

### Search Products

```sql
SELECT * FROM products
WHERE status = 'ACTIVE'
  AND (name ->> 'en' ILIKE $1 OR slug ILIKE $1)
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;
```

**Performance**: O(n) - Full text search on name/slug

- Consider full-text search index for large datasets

### Get All Versions of Product

```sql
SELECT * FROM product_versions
WHERE product_id = $1
ORDER BY version_number ASC;
```

**Performance**: O(log n + k) using index on product_id

### Comparison: Version A vs Version B

```sql
SELECT
  pv1.* as version_a,
  pv2.* as version_b
FROM product_versions pv1
JOIN product_versions pv2
  ON pv1.product_id = pv2.product_id
WHERE pv1.product_id = $1
  AND pv1.version_number = $2
  AND pv2.version_number = $3;
```

**Performance**: O(log n) - Two index lookups

### Get Audit Trail (Paginated)

```sql
SELECT * FROM product_audit_logs
WHERE product_id = $1
ORDER BY timestamp DESC
LIMIT $2 OFFSET $3;
```

**Performance**: O(log n + k) using index on (product_id, timestamp DESC)

### Audit Trail Filtered by Action

```sql
SELECT * FROM product_audit_logs
WHERE product_id = $1
  AND action = $2
ORDER BY timestamp DESC
LIMIT $3 OFFSET $4;
```

**Performance**: O(log n + k) - Filters on indexed columns

### Audit Trail by Date Range

```sql
SELECT * FROM product_audit_logs
WHERE product_id = $1
  AND timestamp >= $2
  AND timestamp <= $3
ORDER BY timestamp DESC
LIMIT $4 OFFSET $5;
```

**Performance**: O(log n + k) - Index on timestamp enables range query

### Find Who Updated Product

```sql
SELECT DISTINCT performed_by FROM product_audit_logs
WHERE product_id = $1
ORDER BY performed_by;
```

**Performance**: O(log n + k) - Index on product_id

### Count Changes to Product

```sql
SELECT
  action,
  COUNT(*) as count
FROM product_audit_logs
WHERE product_id = $1
GROUP BY action;
```

**Performance**: O(log n + k) - Group by indexed column

### Products Without Versions (Data Integrity Check)

```sql
SELECT p.id, p.slug
FROM products p
LEFT JOIN product_versions pv ON p.id = pv.product_id
WHERE pv.id IS NULL;
```

**Performance**: O(n) - Full table scan, but should return empty

### Orphaned Audit Logs (Data Integrity Check)

```sql
SELECT pa.id
FROM product_audit_logs pa
LEFT JOIN products p ON pa.product_id = p.id
WHERE p.id IS NULL;
```

**Performance**: O(n) - Should return empty (foreign key enforces)

### Products Created Today

```sql
SELECT * FROM products
WHERE DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;
```

**Performance**: O(n) due to DATE() function

### Most Recent Product Changes

```sql
SELECT * FROM product_audit_logs
ORDER BY timestamp DESC
LIMIT 10;
```

**Performance**: O(log n) - Index on timestamp DESC

## Data Integrity Constraints

### Cascading Delete

When a product is deleted:

```sql
DELETE FROM products WHERE id = $1;
```

PostgreSQL automatically deletes:

- All rows in product_versions with product_id = $1
- All rows in product_audit_logs with product_id = $1

**Verification Query**:

```sql
SELECT COUNT(*) FROM product_versions WHERE product_id = $1;
SELECT COUNT(*) FROM product_audit_logs WHERE product_id = $1;
-- Both should return 0 after delete
```

### Foreign Key Constraints

Cannot delete product with existing licenses (application-enforced):

```sql
-- Check if product has licenses (future Stage 10)
SELECT COUNT(*) FROM licenses WHERE product_id = $1;
```

### Unique Slug Constraint

Attempting duplicate slug fails:

```sql
-- This will fail with unique constraint violation
INSERT INTO products (id, name, slug, ...)
VALUES ($1, '{"en": "..."}', 'existing-slug', ...);
```

### Version Ordering

Cannot skip versions (application-enforced):

```sql
-- This is prevented by application logic
-- version_number must be = MAX(version_number) + 1
INSERT INTO product_versions
  (id, product_id, version_number, ...)
VALUES ($1, $2, 5, ...);  -- Would fail if max version is 2
```

## Performance Optimization

### Indexes Used

```sql
-- List queries
SELECT * FROM products WHERE status = 'ACTIVE' ORDER BY created_at DESC;
-- Uses: idx_products_status + idx_products_created_at

-- Slug lookups
SELECT * FROM products WHERE slug = 'test';
-- Uses: idx_products_slug (unique)

-- Version queries
SELECT * FROM product_versions WHERE product_id = $1 ORDER BY version_number;
-- Uses: idx_product_versions_unique (product_id, version_number)

-- Audit queries
SELECT * FROM product_audit_logs WHERE product_id = $1 ORDER BY timestamp DESC;
-- Uses: idx_audit_logs_product_id + idx_audit_logs_timestamp
```

### Query Plans

```sql
-- Explain list query
EXPLAIN ANALYZE SELECT * FROM products
WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 10;

-- Expected: Index Scan using idx_products_status
```

### Connection Pooling

Use connection pool for concurrent access:

```typescript
// PgBoss uses internal connection pool
const pgboss = new PgBoss(connectionConfig)

// Per-tenant connection pool
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})
```

## Maintenance

### Vacuum

Regular vacuum cleaning:

```sql
-- Manual
VACUUM ANALYZE products;
VACUUM ANALYZE product_versions;
VACUUM ANALYZE product_audit_logs;

-- Automatic (enabled by default)
-- PostgreSQL autovacuum daemon handles this
```

### Index Rebalancing

Monitor index health:

```sql
-- Check index size
SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Backup Strategy

- **Snapshots**: Database-level snapshots before deployments
- **WAL**: Continuous archiving for point-in-time recovery
- **Frequency**: Daily full backups, hourly incrementals

See: `/docs/02_DEVOPS_DEPLOYMENT/09_BACKUP_AND_RECOVERY.md`

## Schema Versioning

Current schema version: **1.0.0**

Tracked in system table:

```sql
CREATE TABLE schema_versions (
  version VARCHAR(50) PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL
);

INSERT INTO schema_versions VALUES ('1.0.0', NOW());
```

Migration changes recorded in: `/apps/api/src/db/master/migrations/`

## Related Documentation

- **API Documentation**: [API_PRODUCTS_MANAGEMENT.md](API_PRODUCTS_MANAGEMENT.md)
- **Implementation Guide**: [IMPLEMENTATION_PRODUCTS.md](IMPLEMENTATION_PRODUCTS.md)
- **Deployment Guide**: [DEPLOYMENT_AND_VALIDATION_PRODUCTS.md](DEPLOYMENT_AND_VALIDATION_PRODUCTS.md)
- **Backup & Recovery**: [/docs/02_DEVOPS_DEPLOYMENT/09_BACKUP_AND_RECOVERY.md](/docs/02_DEVOPS_DEPLOYMENT/09_BACKUP_AND_RECOVERY.md)
