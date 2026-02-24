# TASKS REPORT – Products Management Implementation

**Stage:** STAGE_09_PRODUCTS (Products Management)  
**Phase:** 02_PLATFORM_MMC  
**Date Generated:** 2026-02-22  
**Total Tasks:** 46 atomic tasks  
**Status:** Ready for implementation

---

## Executive Summary

This report breaks down the Products Management stage into **46 atomic, dependency-ordered implementation tasks** across 5 layers:

1. **Database Layer (8 tasks)** – Schema, migrations, indexes
2. **Domain Layer (18 tasks)** – Services, validation, queries
3. **API Layer (9 tasks)** – Routes, middleware, error handling
4. **Observability Layer (3 tasks)** – Logging, metrics, rate limiting
5. **Testing Layer (8 tasks)** – Unit, integration, atomicity tests

**Key Principles Applied:**

- Each task is atomic (scope to ONE layer)
- Dependencies explicitly ordered (DB first, then domain, then API, then tests)
- Transactional status declared for each task
- Idempotency requirements specified
- Middleware dependencies explicit
- No task modifies unrelated files
- Isolation guarantees preserved

---

## Task Dependency Graph

```
DB Layer (TASK_001-008)
  ↓
Domain Layer (TASK_009-026)
  ↓
API Layer (TASK_027-036)
  ↓
Observability (TASK_037-039)
  ↓
Testing (TASK_040-046)
```

---

# SECTION 1: Database Migration Tasks (Layer: DB)

## TASK_001: Create products table schema migration file

**ID:** TASK_001  
**Title:** Implement migrations/001_initial_products_schema.ts  
**Layer:** DB  
**Type:** schema/migration  
**Dependencies:** None (foundation task)  
**Complexity:** medium  
**Transactional:** yes  
**Idempotent:** yes

**Description:**
Create the initial database migration file that defines the `products` table schema with all columns, constraints, and indexes. This is the foundational table for the entire Products Management stage. The migration must be forward-only, idempotent (CREATE TABLE IF NOT EXISTS), and atomic.

**Acceptance Criteria:**

- ✅ Migration file exists at `apps/api/src/db/master/migrations/001_initial_products_schema.ts`
- ✅ Executes all DDL statements in single transaction
- ✅ Uses IF NOT EXISTS for all CREATE statements (idempotency)
- ✅ Migration records schema_version increment
- ✅ All constraints validated: status enum, name.en required, enabled_modules not empty, slug format

**Implementation Notes:**

- File should export `migration` object with `up` and `down` methods
- `down` method throws error (no rollback allowed per constitution)
- Use Drizzle ORM SQL templates
- Timestamp fields use CURRENT_TIMESTAMP (server-authoritative per ADR-0006)

---

## TASK_002: Create product_versions table schema migration

**ID:** TASK_002  
**Title:** Add product_versions table to migration 001  
**Layer:** DB  
**Type:** schema/migration  
**Dependencies:** TASK_001  
**Complexity:** medium  
**Transactional:** yes  
**Idempotent:** yes

**Description:**
Extend migration 001 to include the `product_versions` table DDL. This table is append-only and stores immutable snapshots of product configuration at each version. It must enforce uniqueness on (product_id, version_number) and reference products with ON DELETE RESTRICT.

**Acceptance Criteria:**

- ✅ `product_versions` table created with all columns (id, product_id, version_number, name, enabled_modules, description, change_summary, created_at)
- ✅ Foreign key constraint: `product_id` REFERENCES `products(id)` ON DELETE RESTRICT
- ✅ Unique constraint on (product_id, version_number) enforced at DB level
- ✅ Indexes created on product_id and version_number
- ✅ Table is immutable (no UPDATE/DELETE constraints at schema level)

**Implementation Notes:**

- Add to same transaction block as products table
- created_at immutable: set once at insertion, never modified
- ON DELETE RESTRICT prevents product deletion if versions exist (desired)

---

## TASK_003: Create product_audit_logs table schema migration

**ID:** TASK_003  
**Title:** Add product_audit_logs table to migration 001  
**Layer:** DB  
**Type:** schema/migration  
**Dependencies:** TASK_001  
**Complexity:** medium  
**Transactional:** yes  
**Idempotent:** yes

**Description:**
Extend migration 001 to include the `product_audit_logs` table DDL. This is an append-only audit trail that tracks all product mutations (CREATE, UPDATE, STATUS_CHANGE). It must preserve immutability and include all necessary fields for compliance and debugging.

**Acceptance Criteria:**

- ✅ `product_audit_logs` table created with all columns (id, product_id, action, previous_version, new_version, changed_fields, performed_by, timestamp)
- ✅ Foreign key constraint: `product_id` REFERENCES `products(id)` ON DELETE RESTRICT
- ✅ CHECK constraint: action IN ('CREATE', 'UPDATE', 'STATUS_CHANGE')
- ✅ performed_by UUID field (references user, not enforced at DB level)
- ✅ timestamp immutable: set once at insertion via CURRENT_TIMESTAMP
- ✅ Indexes on product_id, action, timestamp, performed_by for audit queries

**Implementation Notes:**

- changed_fields is JSONB to store field-level diffs
- Append-only: no UPDATE or DELETE operations permitted
- ON DELETE RESTRICT prevents accidental product deletion with audit trail

---

## TASK_004: Create indexes for products table

**ID:** TASK_004  
**Title:** Define query optimization indexes for products table  
**Layer:** DB  
**Type:** schema/migration  
**Dependencies:** TASK_001  
**Complexity:** low  
**Transactional:** yes  
**Idempotent:** yes

**Description:**
Create indexes on products table to optimize common queries: product lookup by slug, filtering by status, and ordering by creation time. All indexes use IF NOT EXISTS pattern for idempotency.

**Acceptance Criteria:**

- ✅ Index on `slug` (UNIQUE) – for duplicate detection and by-slug queries
- ✅ Index on `status` – for filtering ACTIVE/INACTIVE products
- ✅ Index on `created_at` (DESC) – for ordering recent products
- ✅ Index on `updated_at` (DESC) – for tracking recently modified products
- ✅ All indexes use IF NOT EXISTS syntax

**Implementation Notes:**

- slug already UNIQUE at table level, but index improves lookup
- status filter is common (default: ACTIVE only), so separate index helps
- created_at DESC and updated_at DESC for reverse chronological ordering in list queries

---

## TASK_005: Create indexes for product_versions table

**ID:** TASK_005  
**Title:** Create indexes on product_versions for version history queries  
**Layer:** DB  
**Type:** schema/migration  
**Dependencies:** TASK_002  
**Complexity:** low  
**Transactional:** yes  
**Idempotent:** yes

**Description:**
Create indexes on product_versions table to optimize version history lookups and traversals. Common queries: get all versions for a product, get specific version number.

**Acceptance Criteria:**

- ✅ Composite index on (product_id, version_number) – for exact version lookup
- ✅ Index on product_id alone – for listing all versions of a product
- ✅ Both indexes use IF NOT EXISTS syntax
- ✅ Supports queries: "get version 3 of product X" and "list all versions of product X"

**Implementation Notes:**

- Composite index (product_id, version_number) is primary access pattern
- Separate index on product_id helps with full version history queries

---

## TASK_006: Create indexes for product_audit_logs table

**ID:** TASK_006  
**Title:** Create indexes on product_audit_logs for audit trail queries  
**Layer:** DB  
**Type:** schema/migration  
**Dependencies:** TASK_003  
**Complexity:** low  
**Transactional:** yes  
**Idempotent:** yes

**Description:**
Create indexes on product_audit_logs table to support efficient audit trail queries by product, action type, timestamp, and performed_by user. These queries are compliance-critical and may be accessed frequently.

**Acceptance Criteria:**

- ✅ Index on product_id – for querying audit trail of specific product
- ✅ Index on action – for filtering CREATE vs UPDATE vs STATUS_CHANGE events
- ✅ Index on timestamp (DESC) – for chronological ordering
- ✅ Index on performed_by – for finding all changes by user (compliance)
- ✅ All indexes use IF NOT EXISTS syntax

**Implementation Notes:**

- timestamp DESC supports "latest events first" ordering
- performed_by index enables "who changed what" compliance queries
- These are read-heavy queries (audit log is never updated)

---

## TASK_007: Update schema_version after all migrations

**ID:** TASK_007  
**Title:** Increment schema_version in master DB registry  
**Layer:** DB  
**Type:** migration  
**Dependencies:** TASK_001, TASK_002, TASK_003, TASK_004, TASK_005, TASK_006  
**Complexity:** low  
**Transactional:** yes  
**Idempotent:** yes

**Description:**
After all DDL statements execute successfully, update the master DB schema registry to increment schema_version and record the migration ID. This ensures version enforcement middleware can validate schema compatibility.

**Acceptance Criteria:**

- ✅ schema_version incremented by 1 (e.g., from 1 to 2)
- ✅ last_migration_id set to '001_initial_products_schema'
- ✅ last_migration_timestamp set to CURRENT_TIMESTAMP
- ✅ Update only executes if all prior DDL succeeded (within transaction)
- ✅ Version visible to license middleware for compatibility checks

**Implementation Notes:**

- Must be LAST statement in migration (after all tables/indexes)
- Schema version enforcement prevents API access if version mismatch
- Related to ADR-0001 tenant isolation model

---

## TASK_008: Create DB constraint validation function

**ID:** TASK_008  
**Title:** Validate DB schema constraints (idempotent, replayable)  
**Layer:** DB  
**Type:** schema/validation  
**Dependencies:** TASK_001-007  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Create a post-migration validation script that verifies all schema constraints are properly enforced: check constraints on status and modules, unique constraint on slug, foreign key constraints, etc. This runs after migration succeeds to catch schema drift.

**Acceptance Criteria:**

- ✅ Validation script checks: products table exists with all columns
- ✅ Verifies CHECK constraints: status enum, name.en required, modules not empty
- ✅ Verifies UNIQUE constraints: slug unique
- ✅ Verifies foreign key: ON DELETE RESTRICT for product_id references
- ✅ Returns success/failure for CI pipeline
- ✅ Idempotent: can run multiple times without error

**Implementation Notes:**

- Script queries information_schema to verify constraints
- Use SQL to test constraint violations (e.g., try to create duplicate slug)
- Part of deployment validation step

---

# SECTION 2: Domain Layer Tasks (Layer: Domain)

## TASK_009: Define Module enum and utility functions

**ID:** TASK_009  
**Title:** Create Module enum in packages/types  
**Layer:** Domain  
**Type:** enum/types  
**Dependencies:** None (foundational types)  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Define the Module enum (MCQ, TRADITIONAL_EXAMS, EXERCISES, LIBRARY, LIVES, FORUM) and export utility functions for validation and localization. This is a foundational type used across domain, API, and testing layers.

**Acceptance Criteria:**

- ✅ Enum defined at `packages/types/src/enums/Module.ts`
- ✅ All 6 module values exported as enum members
- ✅ Function `isValidModule(value: unknown): value is Module` for runtime validation
- ✅ Function `getModuleLabel(module: Module, language: 'en' | 'ar'): string` for UI localization
- ✅ No dependencies on database layer

**Implementation Notes:**

- Module enum is TypeScript at compile time AND string at runtime
- isValidModule enables safe type guards in domain logic
- getModuleLabel returns human-readable labels in English and Arabic for UI

---

## TASK_010: Create Product type definitions and interfaces

**ID:** TASK_010  
**Title:** Define Product, ProductVersion, AuditLog types  
**Layer:** Domain  
**Type:** types  
**Dependencies:** TASK_009  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Define TypeScript types/interfaces for Product, ProductVersion, AuditLogEntry, and related DTO types. These types are used across API responses, domain layer, and tests.

**Acceptance Criteria:**

- ✅ Product interface defined with all fields (id, name, slug, enabled_modules, status, current_version, created_at, updated_at)
- ✅ ProductVersion interface with version snapshot fields
- ✅ AuditLogEntry interface with action, changed_fields, performed_by metadata
- ✅ DTO types: CreateProductRequest, UpdateProductRequest, etc.
- ✅ All timestamp fields are ISO 8601 strings in serialized form
- ✅ All UUIDs are strings (uuid format)

**Implementation Notes:**

- Types should be in packages/types/src/products/
- Use Zod for runtime validation of API payloads (separate from types)
- Types are immutability-aware (readonly fields where applicable)

---

## TASK_011: Implement validateProductName validation function

**ID:** TASK_011  
**Title:** Create product name validation in packages/validation  
**Layer:** Domain  
**Type:** validation  
**Dependencies:** TASK_010  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement validateProductName function that ensures name object has required English translation and optional Arabic translation. Both must be non-empty strings within length limits.

**Acceptance Criteria:**

- ✅ Function signature: `validateProductName(name: { en: string; ar?: string }): void`
- ✅ Throws error 'INVALID_NAME_LOCALIZATION' if name.en is missing or empty
- ✅ Throws error if name.en exceeds 255 characters
- ✅ Accepts name.ar as optional but validates length if provided
- ✅ Error messages are logged for debugging
- ✅ Function is pure (no side effects except logging)

**Implementation Notes:**

- Located at packages/validation/src/products/validateProductName.ts
- Thrown errors are caught by API error handler and mapped to 400 response
- Length limits match DB schema constraints

---

## TASK_012: Implement validateModulesEnum validation function

**ID:** TASK_012  
**Title:** Create module enum validation in packages/validation  
**Layer:** Domain  
**Type:** validation  
**Dependencies:** TASK_009, TASK_010  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement validateModulesEnum function that ensures enabled_modules array contains at least one valid module from the enum. Rejects unknown modules, empty arrays, and non-arrays.

**Acceptance Criteria:**

- ✅ Function signature: `validateModulesEnum(modules: string[]): void`
- ✅ Throws 'INVALID_MODULE_ENUM' if modules is not array or is empty
- ✅ Throws 'INVALID_MODULE_ENUM' if any module is not in enum (with module name in error)
- ✅ Accepts arrays with 1-10 modules (up to max defined in schema)
- ✅ Uses isValidModule utility from Module enum
- ✅ Error messages list valid modules for user guidance

**Implementation Notes:**

- Located at packages/validation/src/products/validateModulesEnum.ts
- Validator rejects empty arrays (at least one module required by schema)
- Error message includes list of valid modules for UX clarity

---

## TASK_013: Implement validateSlug validation function

**ID:** TASK_013  
**Title:** Create slug format validation in packages/validation  
**Layer:** Domain  
**Type:** validation  
**Dependencies:** TASK_010  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement validateSlug function that ensures slug conforms to format: lowercase alphanumeric with hyphens (no spaces, uppercase, special chars). Regex: `^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$`

**Acceptance Criteria:**

- ✅ Function signature: `validateSlug(slug: string): void`
- ✅ Throws 'INVALID_SLUG' if slug doesn't match regex pattern
- ✅ Throws 'INVALID_SLUG' if slug is empty or not string
- ✅ Throws 'INVALID_SLUG' if slug exceeds 255 characters
- ✅ Accepts single-character slugs (e.g., 'a')
- ✅ Rejects uppercase, spaces, special characters

**Implementation Notes:**

- Located at packages/validation/src/products/validateSlug.ts
- Regex enforced at multiple layers: API validation, domain layer, DB CHECK constraint
- Slug is immutable after creation (enforced in API update handler)

---

## TASK_014: Implement validateSlugUniqueness database query

**ID:** TASK_014  
**Title:** Create slug uniqueness check function in domain  
**Layer:** Domain  
**Type:** validation/query  
**Dependencies:** TASK_001, TASK_010  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement validateSlugUniqueness function that queries the DB to check if a slug already exists. Throws 'DUPLICATE_SLUG' if slug is taken. This runs as part of createProduct to prevent constraint violation.

**Acceptance Criteria:**

- ✅ Function signature: `validateSlugUniqueness(slug: string, db: Database): Promise<void>`
- ✅ Queries products table: SELECT COUNT(\*) WHERE LOWER(slug) = LOWER(?)`
- ✅ Throws 'DUPLICATE_SLUG' if count > 0
- ✅ Case-insensitive comparison (LOWER both sides)
- ✅ Uses master_db connection (no tenant isolation concern)
- ✅ No transaction required (idempotent read)

**Implementation Notes:**

- Located at packages/validation/src/products/validateSlugUniqueness.ts
- Case-insensitive to prevent 'Basic-Exam' and 'basic-exam' both existing
- Also protected by DB UNIQUE constraint as defense-in-depth

---

## TASK_015: Implement getProductById query function

**ID:** TASK_015  
**Title:** Create single product fetch by UUID  
**Layer:** Domain  
**Type:** query  
**Dependencies:** TASK_001, TASK_010  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement getProductById function that retrieves a single product by UUID. Returns Product | null. Used by update, status-change, and delete operations to verify product exists.

**Acceptance Criteria:**

- ✅ Function signature: `getProductById(id: UUID, db: Database): Promise<Product | null>`
- ✅ Queries products table: SELECT \* WHERE id = ?`
- ✅ Returns Product object if found, null if not found
- ✅ No filtering (returns ACTIVE or INACTIVE status)
- ✅ Uses master_db connection
- ✅ No transaction required

**Implementation Notes:**

- Located at packages/domain-core/src/products/queries.ts
- Simple SELECT query, no joins
- Used to fetch current state before update/delete operations
- Result includes current_version for version increment logic

---

## TASK_016: Implement getProductBySlug query function

**ID:** TASK_016  
**Title:** Create product fetch by human-readable slug  
**Layer:** Domain  
**Type:** query  
**Dependencies:** TASK_001, TASK_010  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement getProductBySlug function for UI lookups by human-readable slug. Useful for frontend to map product names to IDs. Returns Product | null.

**Acceptance Criteria:**

- ✅ Function signature: `getProductBySlug(slug: string, db: Database): Promise<Product | null>`
- ✅ Queries products table with slug index: SELECT \* WHERE slug = ?`
- ✅ Case-sensitive query (slugs are canonically lowercase)
- ✅ Returns Product object if found, null if not found
- ✅ Uses master_db connection
- ✅ No transaction required

**Implementation Notes:**

- Located at packages/domain-core/src/products/queries.ts
- Slug lookup preferred by UI (human-readable vs UUID)
- Index on slug column ensures fast lookup

---

## TASK_017: Implement listProducts query function with filters

**ID:** TASK_017  
**Title:** Create paginated product list query with filtering  
**Layer:** Domain  
**Type:** query  
**Dependencies:** TASK_001, TASK_010  
**Complexity:** medium  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement listProducts function to retrieve paginated product list with optional filters for status (ACTIVE/INACTIVE/all), search by name/slug, and sort by creation time. Returns {data: Product[], total: number}.

**Acceptance Criteria:**

- ✅ Function signature: `listProducts(query: QueryParams, db: Database): Promise<{data: Product[]; total: number}>`
- ✅ Default: ACTIVE products only (status='ACTIVE' unless ?status=INACTIVE or ?status=all)
- ✅ Supports search filter: ?search=term searches name.en, name.ar, slug
- ✅ Supports pagination: ?limit=50&offset=0 (max 100)
- ✅ Orders results by created_at DESC (newest first)
- ✅ Returns total count for UI pagination
- ✅ Uses indexes on status, created_at for performance

**Implementation Notes:**

- Located at packages/domain-core/src/products/queries.ts
- Search uses LIKE with wildcards and LOWER() for case-insensitive matching
- Total count separate from main query for efficient pagination
- Default limit 50, max limit 100 (prevent abuse)

---

## TASK_018: Implement getProductVersions query function

**ID:** TASK_018  
**Title:** Create version history retrieval by product ID  
**Layer:** Domain  
**Type:** query  
**Dependencies:** TASK_002, TASK_010  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement getProductVersions function to retrieve all version snapshots for a product, ordered by version_number ascending. Used for displaying version history in UI and for validation.

**Acceptance Criteria:**

- ✅ Function signature: `getProductVersions(productId: UUID, db: Database): Promise<ProductVersion[]>`
- ✅ Queries product_versions table: SELECT \* WHERE product_id = ? ORDER BY version_number ASC`
- ✅ Returns array of ProductVersion objects (empty array if no versions)
- ✅ Uses index on product_id for fast lookup
- ✅ No pagination required (versions per product expected < 100)
- ✅ Uses master_db connection

**Implementation Notes:**

- Located at packages/domain-core/src/products/queries.ts
- Version history is append-only, so no filtering needed
- Useful for audit/compliance to show what changed between versions

---

## TASK_019: Implement getProductAuditLog paginated query

**ID:** TASK_019  
**Title:** Create paginated audit trail retrieval  
**Layer:** Domain  
**Type:** query  
**Dependencies:** TASK_003, TASK_010  
**Complexity:** medium  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement getProductAuditLog function to retrieve audit logs for a product with optional filters by action (CREATE/UPDATE/STATUS_CHANGE) and date range. Supports pagination and ordering by timestamp DESC.

**Acceptance Criteria:**

- ✅ Function signature: `getProductAuditLog(productId: UUID, query: QueryParams, db: Database): Promise<{data: AuditLogEntry[]; total: number}>`
- ✅ Supports filter: ?action=CREATE|UPDATE|STATUS_CHANGE
- ✅ Supports date range: ?from_date=2026-02-20T00:00:00Z&to_date=2026-02-22T23:59:59Z
- ✅ Orders by timestamp DESC (most recent first)
- ✅ Supports pagination: ?limit=50&offset=0 (max 100)
- ✅ Returns total count for UI pagination
- ✅ Uses indexes on product_id, action, timestamp for performance

**Implementation Notes:**

- Located at packages/domain-core/src/products/queries.ts
- Timestamps are ISO 8601 in query params, converted to Date for SQL
- Useful for compliance audits and debugging
- Filter conditions use optional parameters (NULL check in SQL)

---

## TASK_020: Implement countLicensesByProductId helper query

**ID:** TASK_020  
**Title:** Create license reference counter for deletion validation  
**Layer:** Domain  
**Type:** query  
**Dependencies:** TASK_001  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement countLicensesByProductId function that counts active licenses referencing a product. Used in deleteProduct to enforce 'no licenses' constraint. Returns integer count.

**Acceptance Criteria:**

- ✅ Function signature: `countLicensesByProductId(productId: UUID, db: Database): Promise<number>`
- ✅ Queries licenses table: SELECT COUNT(\*) WHERE product_id = ? AND status != 'DELETED'`
- ✅ Returns count of active licenses
- ✅ Uses master_db connection
- ✅ No pagination needed (efficiency focused)

**Implementation Notes:**

- Located at packages/domain-core/src/products/queries.ts
- Licenses table created in Stage 10, but structure assumed here
- ON DELETE RESTRICT at DB level prevents deletion anyway (defense-in-depth)
- Deleted licenses may not be counted (status-based filtering)

---

## TASK_021: Implement createProduct atomic service function

**ID:** TASK_021  
**Title:** Create product with version 1 and audit log (atomic)  
**Layer:** Domain  
**Type:** service/mutation  
**Dependencies:** TASK_011-014, TASK_015-020  
**Complexity:** high  
**Transactional:** yes  
**Idempotent:** no

**Description:**
Implement createProduct service function that creates a product with initial version 1 and audit log entry. All operations (INSERT product, INSERT version, INSERT audit log) must execute in single transaction. If any step fails, entire operation rolls back.

**Acceptance Criteria:**

- ✅ Function signature: `createProduct(input: CreateProductInput, db: Database): Promise<Product>`
- ✅ Validates all inputs: name (TASK_011), enabled_modules (TASK_012), slug (TASK_013-014) BEFORE transaction
- ✅ Within transaction: INSERT product, INSERT product_version v1, INSERT audit_log (CREATE action)
- ✅ Sets server time for created_at, updated_at (ADR-0006 compliance)
- ✅ Generates UUID for product ID
- ✅ Sets current_version = 1 on insert
- ✅ Sets default status = 'ACTIVE'
- ✅ Slug normalized to lowercase
- ✅ All-or-nothing guarantee: any failure rolls back all 3 inserts
- ✅ Returns Product object with all fields populated

**Implementation Notes:**

- Located at packages/domain-core/src/products/productService.ts
- Validations happen BEFORE transaction to fail fast
- Transaction uses REPEATABLE READ isolation level
- Change_summary for v1 = 'Initial version'
- Audit log captures initial values of name, slug, enabled_modules

---

## TASK_022: Implement updateProduct atomic service function

**ID:** TASK_022  
**Title:** Update product with new version and audit log (atomic)  
**Layer:** Domain  
**Type:** service/mutation  
**Dependencies:** TASK_015, TASK_017, TASK_021  
**Complexity:** high  
**Transactional:** yes  
**Idempotent:** no

**Description:**
Implement updateProduct service function that updates product's structural fields (name, description, enabled_modules) and creates new version snapshot. Slug is immutable and cannot be changed. Only creates version record if actual changes detected. All updates within transaction for atomicity.

**Acceptance Criteria:**

- ✅ Function signature: `updateProduct(input: UpdateProductInput, db: Database): Promise<Product>`
- ✅ Fetch existing product first (outside transaction)
- ✅ Reject if slug provided in update (SLUG_NOT_MUTABLE error)
- ✅ Validate provided fields: name (if present), enabled_modules (if present)
- ✅ Detect actual changes: if no fields changed, return existing without version bump
- ✅ Within transaction: UPDATE product, INSERT product_version (new version), INSERT audit_log
- ✅ Increment current_version by 1
- ✅ Generate change_summary and field_diff for audit log
- ✅ Server time for updated_at
- ✅ All-or-nothing guarantee: any failure rolls back all changes
- ✅ Returns updated Product object

**Implementation Notes:**

- Located at packages/domain-core/src/products/productService.ts
- Slug immutability enforced in API layer as defense-in-depth
- No-change detection prevents spam version history
- Field diff captures before/after for each changed field
- Version number increments only on structural change (status change doesn't increment)

---

## TASK_023: Implement changeProductStatus atomic service function

**ID:** TASK_023  
**Title:** Change product status without version increment  
**Layer:** Domain  
**Type:** service/mutation  
**Dependencies:** TASK_015, TASK_021  
**Complexity:** low  
**Transactional:** yes  
**Idempotent:** no

**Description:**
Implement changeProductStatus service function that changes product status (ACTIVE ↔ INACTIVE) without incrementing version. This is a metadata change, not a structural change. Creates audit log with action='STATUS_CHANGE' (no version fields).

**Acceptance Criteria:**

- ✅ Function signature: `changeProductStatus(input: StatusChangeInput, db: Database): Promise<Product>`
- ✅ Fetch existing product first
- ✅ Reject if status already matches (no change, return existing)
- ✅ Validate status is in enum: ACTIVE | INACTIVE
- ✅ Within transaction: UPDATE product status, INSERT audit_log (STATUS_CHANGE action)
- ✅ current_version stays same (no increment)
- ✅ Audit log has action='STATUS_CHANGE', previous_version=null, new_version=null
- ✅ Server time for updated_at
- ✅ All-or-nothing guarantee
- ✅ Returns Product object with updated status

**Implementation Notes:**

- Located at packages/domain-core/src/products/productService.ts
- Status change is metadata-only, doesn't affect functionality
- Idempotent status setting (same status in, no action)
- Useful for marking products as deprecated without losing version history

---

## TASK_024: Implement deleteProduct atomic service function

**ID:** TASK_024  
**Title:** Hard delete product with cascade cleanup  
**Layer:** Domain  
**Type:** service/mutation  
**Dependencies:** TASK_020, TASK_021  
**Complexity:** medium  
**Transactional:** yes  
**Idempotent:** no

**Description:**
Implement deleteProduct service function that hard deletes a product and all related data (versions, audit logs). Must verify no active licenses reference product. All deletes within transaction for atomicity. This is a rare operation (only when product never shipped).

**Acceptance Criteria:**

- ✅ Function signature: `deleteProduct(id: UUID, db: Database): Promise<void>`
- ✅ Fetch product by ID first (fail if not found)
- ✅ Check license count: countLicensesByProductId(id)
- ✅ Reject if licenses exist: throw PRODUCT_HAS_LICENSES error
- ✅ Within transaction: DELETE audit_logs, DELETE versions, DELETE product (order matters for integrity)
- ✅ All-or-nothing guarantee: any failure rolls back all deletes
- ✅ ON DELETE RESTRICT at DB level prevents deletion if licenses exist (defense-in-depth)
- ✅ Returns void on success

**Implementation Notes:**

- Located at packages/domain-core/src/products/productService.ts
- Delete order: audit_logs first (no foreign key), then versions, then product
- DB foreign key constraint provides second layer of protection
- Hard delete acceptable: no data retention requirements yet (soft delete may be added later)

---

## TASK_025: Implement computeFieldDiff helper function

**ID:** TASK_025  
**Title:** Create field-level diff computation for audit logs  
**Layer:** Domain  
**Type:** utility  
**Dependencies:** TASK_010  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement computeFieldDiff helper function that compares old and new product states and returns JSON object mapping changed fields to {old, new} values. Used in updateProduct to populate audit log changed_fields.

**Acceptance Criteria:**

- ✅ Function signature: `computeFieldDiff(old: Product, newInput: UpdateProductInput): Record<string, {old: any, new: any}>`
- ✅ Iterates through updateable fields: name, description, enabled_modules
- ✅ Only includes fields that actually changed
- ✅ Returns empty object if no changes
- ✅ Values in diff match types (strings for name, arrays for modules)
- ✅ Useful for compliance/audit trail

**Implementation Notes:**

- Located at packages/domain-core/src/products/utils.ts
- Pure function: no side effects
- Used in updateProduct and status change functions
- Diffs stored as JSONB in audit_logs for query flexibility

---

## TASK_026: Implement generateChangeSummary helper function

**ID:** TASK_026  
**Title:** Create human-readable change summary for version history  
**Layer:** Domain  
**Type:** utility  
**Dependencies:** TASK_010, TASK_025  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement generateChangeSummary helper function that generates human-readable text describing what changed during a product update. Used in product_versions table change_summary field for quick understanding of version diff.

**Acceptance Criteria:**

- ✅ Function signature: `generateChangeSummary(old: Product, newInput: UpdateProductInput): string`
- ✅ Returns text like "Updated name to 'New Name', added LIBRARY module"
- ✅ Handles multiple changes: "Updated fields: name, enabled_modules (added: LIBRARY, FORUM)"
- ✅ For v1 creation: returns 'Initial version'
- ✅ Maximum 255 characters (fits in DB schema)
- ✅ Human-readable for UI display

**Implementation Notes:**

- Located at packages/domain-core/src/products/utils.ts
- Used in both updateProduct and potential future export/display
- Useful for quick version history browsing without parsing JSON diffs

---

# SECTION 3: API Layer Tasks (Layer: API)

## TASK_027: Implement license middleware validation

**ID:** TASK_027  
**Title:** Create license enforcement middleware for product routes  
**Layer:** API  
**Type:** middleware  
**Dependencies:** TASK_001 (DB must have schema)  
**Complexity:** medium  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement licenseMiddleware function that validates workspace license status before allowing access to product routes. Required for all product endpoints. Checks license status (ACTIVE/SOFT_LOCKED/ARCHIVED) and returns appropriate HTTP status codes.

**Acceptance Criteria:**

- ✅ Middleware function signature: `licenseMiddleware(c: Context, next: () => Promise<void>): Promise<Response>`
- ✅ Extracts workspaceId from JWT context
- ✅ Queries master_db: SELECT \* FROM licenses WHERE workspace_id = ?`
- ✅ Returns 404 if license not found (LICENSE_NOT_FOUND)
- ✅ Returns 423 (Locked) if license status = SOFT_LOCKED
- ✅ Returns 403 (Forbidden) if license status = ARCHIVED
- ✅ Sets license context in c.set('license', license) for route handlers
- ✅ Structured logging for all license validation events
- ✅ No logs for successful validation (noise reduction)
- ✅ Placed in middleware chain AFTER auth middleware

**Implementation Notes:**

- Located at apps/api/src/middleware/licenseMiddleware.ts
- Part of mandatory middleware order per PROJECT_CONTEXT_PRIMER
- License status DELETED = 404 (treated as not found)
- All product routes depend on this middleware

---

## TASK_028: Implement correlation ID middleware

**ID:** TASK_028  
**Title:** Create request correlation ID middleware  
**Layer:** API  
**Type:** middleware  
**Dependencies:** None  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement correlationIdMiddleware that generates or extracts correlation ID (request_id) from incoming request headers. Propagates ID through all logs and audit trails for traceability.

**Acceptance Criteria:**

- ✅ Middleware function signature: `correlationIdMiddleware(c: Context, next: () => Promise<void>): Promise<void>`
- ✅ Checks for x-correlation-id header in request
- ✅ If not present, generates UUID for correlation ID
- ✅ Stores in c.set('correlationId', correlationId)
- ✅ Sets response header: x-correlation-id: {correlationId}
- ✅ All downstream logs include correlationId field
- ✅ Placed FIRST in middleware chain

**Implementation Notes:**

- Located at apps/api/src/middleware/correlationIdMiddleware.ts
- Placed first in middleware stack per PROJECT_CONTEXT_PRIMER
- UUID generation uses crypto.randomUUID()
- Enables request tracing across logs

---

## TASK_029: Create POST /api/v1/mmc/products route

**ID:** TASK_029  
**Title:** Implement product creation endpoint  
**Layer:** API  
**Type:** endpoint/route  
**Dependencies:** TASK_027, TASK_028, TASK_021  
**Complexity:** medium  
**Transactional:** yes  
**Idempotent:** no

**Description:**
Implement POST /api/v1/mmc/products route that creates new product. Requires authentication and license validation. Calls createProduct service function. Returns 201 Created with product details.

**Acceptance Criteria:**

- ✅ Route: POST /api/v1/mmc/products
- ✅ Middleware chain: correlation ID → auth → license → rateLimiting
- ✅ Request body validated against createProductSchema (Zod)
- ✅ Calls createProduct(payload, masterDb) from domain layer
- ✅ Returns 201 with standard ApiResponse<Product>
- ✅ Returns 400 for validation errors (bad module, missing name, etc.)
- ✅ Returns 409 for duplicate slug (DUPLICATE_SLUG)
- ✅ Logs success/failure with correlationId
- ✅ Performance metrics collected (latency histogram)

**Implementation Notes:**

- Located at apps/api/src/routes/mmc/products.ts
- Rate limited: 10 requests/min per user
- performedBy extracted from c.get('userId')
- Request body is CreateProductRequest DTO
- Response wraps product in ApiResponse{success: true, data: Product, error: null}

---

## TASK_030: Create GET /api/v1/mmc/products route

**ID:** TASK_030  
**Title:** Implement product listing endpoint with filters  
**Layer:** API  
**Type:** endpoint/route  
**Dependencies:** TASK_027, TASK_028, TASK_017  
**Complexity:** medium  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement GET /api/v1/mmc/products route that lists products with pagination and filters. Supports query params: status, search, limit, offset. Default returns ACTIVE products only.

**Acceptance Criteria:**

- ✅ Route: GET /api/v1/mmc/products
- ✅ Middleware chain: correlation ID → auth → license → rateLimiting
- ✅ Query parameters: ?status=ACTIVE|INACTIVE|all&search=term&limit=50&offset=0
- ✅ Calls listProducts(query, masterDb) from domain layer
- ✅ Returns 200 with ProductListResponse {data: Product[], pagination: {limit, offset, total}}
- ✅ Default status = ACTIVE (filters INACTIVE unless explicitly requested)
- ✅ Search is optional, filters by name.en, name.ar, slug if provided
- ✅ Pagination validated: limit <= 100, offset >= 0
- ✅ Returns 400 if limit > 100 or invalid params

**Implementation Notes:**

- Located at apps/api/src/routes/mmc/products.ts
- Rate limited: 100 requests/min per user
- Query parsing via Hono's c.req.query()
- Total count in pagination enables UI pagination control
- ACTIVE-only default simplifies most use cases

---

## TASK_031: Create GET /api/v1/mmc/products/:id route

**ID:** TASK_031  
**Title:** Implement single product fetch endpoint  
**Layer:** API  
**Type:** endpoint/route  
**Dependencies:** TASK_027, TASK_028, TASK_015  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement GET /api/v1/mmc/products/:id route that fetches single product by UUID. Returns 404 if product not found.

**Acceptance Criteria:**

- ✅ Route: GET /api/v1/mmc/products/:id
- ✅ Middleware chain: correlation ID → auth → license → rateLimiting
- ✅ Path parameter: id (UUID format)
- ✅ Calls getProductById(id, masterDb) from domain layer
- ✅ Returns 200 with ProductResponse if found
- ✅ Returns 404 with PRODUCT_NOT_FOUND error if not found
- ✅ Validates UUID format, rejects invalid IDs with 400

**Implementation Notes:**

- Located at apps/api/src/routes/mmc/products.ts
- Rate limited: 100 requests/min per user
- UUID validation using isValidUUID() utility
- Always returns ACTIVE or INACTIVE status (no filtering)

---

## TASK_032: Create PUT /api/v1/mmc/products/:id route

**ID:** TASK_032  
**Title:** Implement product update endpoint  
**Layer:** API  
**Type:** endpoint/route  
**Dependencies:** TASK_027, TASK_028, TASK_022  
**Complexity:** medium  
**Transactional:** yes  
**Idempotent:** no

**Description:**
Implement PUT /api/v1/mmc/products/:id route that updates product (name, description, enabled_modules). Slug is immutable and cannot be included in update payload. Returns updated product with incremented version.

**Acceptance Criteria:**

- ✅ Route: PUT /api/v1/mmc/products/:id
- ✅ Middleware chain: correlation ID → auth → license → rateLimiting
- ✅ Path parameter: id (UUID)
- ✅ Request body: UpdateProductRequest {name?, description?, enabled_modules?}
- ✅ Rejects if slug present in body: returns 400 SLUG_NOT_MUTABLE
- ✅ Calls updateProduct(payload, masterDb) from domain layer
- ✅ Returns 200 with updated ProductResponse
- ✅ Returns 404 if product not found
- ✅ Returns 400 for validation errors
- ✅ Version incremented (unless no changes detected)
- ✅ Logs old and new versions in structured log

**Implementation Notes:**

- Located at apps/api/src/routes/mmc/products.ts
- Rate limited: 20 requests/min per user
- Payload body is optional (allows partial updates)
- performedBy extracted from c.get('userId')
- Slug immutability enforced here before domain processing

---

## TASK_033: Create PATCH /api/v1/mmc/products/:id/status route

**ID:** TASK_033  
**Title:** Implement product status change endpoint  
**Layer:** API  
**Type:** endpoint/route  
**Dependencies:** TASK_027, TASK_028, TASK_023  
**Complexity:** low  
**Transactional:** yes  
**Idempotent:** no

**Description:**
Implement PATCH /api/v1/mmc/products/:id/status route that changes product status (ACTIVE ↔ INACTIVE). Does not increment version. Returns updated product.

**Acceptance Criteria:**

- ✅ Route: PATCH /api/v1/mmc/products/:id/status
- ✅ Middleware chain: correlation ID → auth → license → rateLimiting
- ✅ Path parameter: id (UUID)
- ✅ Request body: {status: 'ACTIVE' | 'INACTIVE'}
- ✅ Calls changeProductStatus(payload, masterDb) from domain layer
- ✅ Returns 200 with ProductResponse
- ✅ current_version stays same (no increment)
- ✅ Returns 404 if product not found
- ✅ Returns 400 if status value invalid
- ✅ Logs status change with old/new values

**Implementation Notes:**

- Located at apps/api/src/routes/mmc/products.ts
- Rate limited: 20 requests/min per user
- Separate endpoint for status to signal it's not a full update
- Status change vs update: status doesn't increment version
- performedBy extracted from c.get('userId')

---

## TASK_034: Create GET /api/v1/mmc/products/:id/audit-log route

**ID:** TASK_034  
**Title:** Implement audit trail retrieval endpoint  
**Layer:** API  
**Type:** endpoint/route  
**Dependencies:** TASK_027, TASK_028, TASK_019  
**Complexity:** medium  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement GET /api/v1/mmc/products/:id/audit-log route that retrieves paginated audit trail for product. Supports filters by action, date range. Requires AUDIT_READ permission.

**Acceptance Criteria:**

- ✅ Route: GET /api/v1/mmc/products/:id/audit-log
- ✅ Middleware chain: correlation ID → auth → license → auditReadPermission → rateLimiting
- ✅ Path parameter: id (UUID)
- ✅ Query parameters: ?action=CREATE|UPDATE|STATUS_CHANGE&limit=50&offset=0&from_date=...&to_date=...
- ✅ Requires AUDIT_READ permission (checked by middleware)
- ✅ Calls getProductAuditLog(id, query, masterDb) from domain layer
- ✅ Returns 200 with AuditLogResponse {data: AuditLogEntry[], pagination}
- ✅ Returns 404 if product not found
- ✅ Dates validated as ISO 8601 format

**Implementation Notes:**

- Located at apps/api/src/routes/mmc/products.ts
- Rate limited: 50 requests/min per user
- Requires additional AUDIT_READ permission middleware
- Audit trail is read-only (no modifications)
- Used for compliance and debugging

---

## TASK_035: Implement rate limiting middleware for product endpoints

**ID:** TASK_035  
**Title:** Create Redis-based rate limiter for products routes  
**Layer:** API  
**Type:** middleware  
**Dependencies:** None (infra independent)  
**Complexity:** medium  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement rateLimitMiddleware using Redis sliding window algorithm. Applies per-user rate limits to product endpoints. Returns 429 if limit exceeded.

**Acceptance Criteria:**

- ✅ Middleware function signature: `rateLimitMiddleware(config: RateLimitConfig, c: Context): Promise<Response | null>`
- ✅ Rate limit config includes: key prefix, limit count, window seconds
- ✅ Redis key format: `{key}:{userId}` (per-user bucket)
- ✅ Uses INCR and EXPIRE commands for sliding window
- ✅ Returns null if under limit (pass through)
- ✅ Returns 429 with RATE_LIMIT_EXCEEDED error if exceeded
- ✅ Sets response headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
- ✅ Different limits per endpoint (creation stricter than list)
- ✅ Structured logging of rate limit events

**Implementation Notes:**

- Located at apps/api/src/middleware/rateLimitMiddleware.ts
- Uses Redis client from shared pool
- Counts reset in response header for client UX
- Endpoints have different limits (POST: 10/min, GET: 100/min, PUT: 20/min, etc.)

---

## TASK_036: Implement error handler function for products

**ID:** TASK_036  
**Title:** Create unified error response handler  
**Layer:** API  
**Type:** error-handling  
**Dependencies:** TASK_029-034  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement handleError function that maps domain/DB errors to standardized API error responses with appropriate HTTP status codes. Used in all product route handlers.

**Acceptance Criteria:**

- ✅ Function signature: `handleError(c: Context, error: Error): Response`
- ✅ Error mapping: INVALID_MODULE_ENUM → 400, DUPLICATE_SLUG → 409, PRODUCT_NOT_FOUND → 404, etc.
- ✅ Returns standard ApiResponse{success: false, data: null, error: {code, message}}
- ✅ All errors logged with correlationId and error details
- ✅ 500 INTERNAL_SERVER_ERROR for unmapped errors
- ✅ Error messages are user-friendly (e.g., "Product name must include English translation")
- ✅ Stack traces logged but not sent to client

**Implementation Notes:**

- Located at apps/api/src/utils/errorHandler.ts
- Centralized error handling prevents response inconsistency
- Error codes match documentation
- Stack traces logged for debugging
- No sensitive data in error messages

---

# SECTION 4: Observability Layer Tasks (Layer: Observability)

## TASK_037: Implement structured logging for product operations

**ID:** TASK_037  
**Title:** Create Pino logging integration for products  
**Layer:** Logging  
**Type:** logging  
**Dependencies:** TASK_021-024, TASK_029-034  
**Complexity:** medium  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement structured logging for all product operations using Pino JSON logger. All logs include required fields: timestamp, level, service, correlationId, workspaceId, userId, action, productId.

**Acceptance Criteria:**

- ✅ Logger instance initialized: `createPinoLogger('api-products')`
- ✅ All operations log entry start: action=product_create_start with correlationId
- ✅ All operations log success: action=product_created with status, duration
- ✅ All operations log failure: action=product_create_failed with error code/message
- ✅ Logs include: timestamp, level, service, correlationId, workspaceId, userId, action, productId
- ✅ Latency tracked: duration_ms field in logs
- ✅ Structured format (JSON) for ELK/Datadog parsing
- ✅ No console.log allowed (only Pino)

**Implementation Notes:**

- Located at apps/api/src/routes/mmc/products.ts (inline logging)
- Uses createPinoLogger from packages/logger
- Log level: info for successes, error for failures, debug for details
- Enables distributed tracing and root cause analysis

---

## TASK_038: Implement Prometheus metrics for product operations

**ID:** TASK_038  
**Title:** Create Prometheus metrics collection for products  
**Layer:** Observability  
**Type:** metrics  
**Dependencies:** TASK_029-034  
**Complexity:** medium  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Implement Prometheus metrics for product operations: latency histograms, error counters, throughput. Enables performance monitoring and alerting.

**Acceptance Criteria:**

- ✅ Metric: product_create_latency_ms (Histogram)
- ✅ Metric: product_update_latency_ms (Histogram)
- ✅ Metric: product_create_total (Counter with labels: status, error_code)
- ✅ Metric: product_errors_total (Counter with labels: error_code, operation, http_status)
- ✅ Metric: product_requests_total (Counter with labels: method, path, status)
- ✅ Latency buckets: [10, 25, 50, 100, 250, 500, 1000, 2500] ms
- ✅ Metrics exposed at /metrics endpoint
- ✅ Labels enable slicing: status (success|error), operation (create|update|list|delete)

**Implementation Notes:**

- Located at apps/api/src/metrics/productMetrics.ts
- Uses Prometheus client library
- Histograms track P50, P95, P99 latencies
- Counters track success/failure and error types
- Metrics endpoint registered in Hono app

---

## TASK_039: Configure rate limiting metrics and alerting

**ID:** TASK_039  
**Title:** Create alerts for rate limit violations  
**Layer:** Observability  
**Type:** alerting  
**Dependencies:** TASK_035  
**Complexity:** low  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Configure Prometheus alert rules for rate limit violations. Triggers alerts if rate limit exceed rate is high (suspicious activity or DDoS). Useful for security monitoring.

**Acceptance Criteria:**

- ✅ Alert rule: RateLimitExceededHigh if rate of 429 responses > 0.5/sec for 5 min
- ✅ Alert rule: ProductErrorRateHigh if error rate > 10% for 5 min
- ✅ Alert rule: ProductLatencyHigh if P95 latency > 500ms for 5 min
- ✅ Alert rules in `docs/02_DEVOPS_DEPLOYMENT/prometheus-rules.yaml`
- ✅ Alerts integrated with notification (Slack, PagerDuty, etc.)
- ✅ Runbooks documented for each alert

**Implementation Notes:**

- Located in docs/monitoring/prometheus-alerts.yaml
- Alert definitions in PromQL
- Runbooks explain causes and remediation
- Thresholds tuned for false positive reduction

---

# SECTION 5: Testing Tasks (Layer: Testing)

## TASK_040: Create product validation unit tests

**ID:** TASK_040  
**Title:** Write tests for all validation functions  
**Layer:** Testing  
**Type:** test/unit  
**Dependencies:** TASK_011-014  
**Complexity:** medium  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Create comprehensive unit tests for validation functions: validateProductName, validateModulesEnum, validateSlug, validateSlugUniqueness. Tests cover happy paths and error cases.

**Acceptance Criteria:**

- ✅ Test file: tests/unit/products/validation.test.ts
- ✅ Tests for validateProductName: valid name, missing en, invalid length, optional ar
- ✅ Tests for validateModulesEnum: valid modules, invalid module, empty array, all 6 modules
- ✅ Tests for validateSlug: valid slug, uppercase rejection, space rejection, single char, empty slug
- ✅ Tests for validateSlugUniqueness: unique slug accepted, duplicate rejected, case-insensitive match
- ✅ All error cases throw Expected error codes
- ✅ Coverage: 100% of validation functions
- ✅ Structured test names: "should accept...", "should reject..."

**Implementation Notes:**

- Uses Vitest framework (aligned with monorepo)
- Pure functions, no mocking needed
- validateSlugUniqueness mocks database connection
- Test data: real product seeds

---

## TASK_041: Create product domain service unit tests

**ID:** TASK_041  
**Title:** Write tests for product service functions  
**Layer:** Testing  
**Type:** test/unit  
**Dependencies:** TASK_021-026  
**Complexity:** high  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Create comprehensive unit tests for domain service functions: createProduct, updateProduct, changeProductStatus, deleteProduct, and helpers. Tests verify business logic, atomicity, version tracking.

**Acceptance Criteria:**

- ✅ Test file: tests/unit/products/service.test.ts
- ✅ Tests for createProduct: valid input, initial version = 1, audit log created, all-or-nothing
- ✅ Tests for updateProduct: version incremented, no-change detection, field diffs, audit log
- ✅ Tests for changeProductStatus: status updated, version not incremented, audit log
- ✅ Tests for deleteProduct: hard delete succeeds, fails if licenses exist
- ✅ Tests for helpers: computeFieldDiff, generateChangeSummary
- ✅ Transaction isolation tested (mocked DB transaction)
- ✅ Coverage: 100% of service functions
- ✅ Tests verify immutability guarantees

**Implementation Notes:**

- Uses Vitest with mocked DB
- Database mocks simulate transaction behavior
- Tests verify query execution order (versions before audit logs)
- Immutability checks: verify version-only increments on structural changes

---

## TASK_042: Create API integration tests

**ID:** TASK_042  
**Title:** Write end-to-end tests for all product endpoints  
**Layer:** Testing  
**Type:** test/integration  
**Dependencies:** TASK_029-034, TASK_036  
**Complexity:** high  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Create comprehensive integration tests for all product API routes. Tests verify HTTP status codes, response formats, middleware behavior, and full request/response cycles.

**Acceptance Criteria:**

- ✅ Test file: tests/integration/products/api.test.ts
- ✅ Tests for POST /products: valid create, duplicate slug 409, invalid module 400
- ✅ Tests for GET /products: ACTIVE default, status filter, search, pagination
- ✅ Tests for GET /products/:id: found 200, not found 404, invalid UUID 400
- ✅ Tests for PUT /products/:id: version increments, slug immutable, validation errors
- ✅ Tests for PATCH /products/:id/status: status changes, version not incremented
- ✅ Tests for GET /products/:id/audit-log: audit trail retrieval, filtering, pagination
- ✅ Tests verify middleware: auth required, license validation, rate limiting
- ✅ Tests verify response format: {success, data, error}
- ✅ Tests verify error codes and HTTP statuses match spec

**Implementation Notes:**

- Uses Vitest + supertest for HTTP testing
- Test database with seeded data
- Auth tokens mocked in headers
- License status mocked (ACTIVE, SOFT_LOCKED, ARCHIVED)
- Tests verify full request flow

---

## TASK_043: Create transaction atomicity tests

**ID:** TASK_043  
**Title:** Write tests verifying all-or-nothing transaction guarantees  
**Layer:** Testing  
**Type:** test/integration  
**Dependencies:** TASK_021-024, TASK_042  
**Complexity:** high  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Create tests that verify transaction atomicity: if any part of a transaction fails, entire operation rolls back. Tests simulate component failures (validation, DB, etc.) and verify no orphaned data.

**Acceptance Criteria:**

- ✅ Test file: tests/integration/products/atomicity.test.ts
- ✅ Test: createProduct rollback if audit log fails (product and version not created)
- ✅ Test: updateProduct rollback if version insert fails (no product update)
- ✅ Test: deleteProduct rollback if audit log delete fails (product still exists)
- ✅ Test: version and audit log counts always match (never out of sync)
- ✅ Test: no orphaned product_versions without product
- ✅ Test: no orphaned audit_logs without product
- ✅ Tests use real DB with transaction simulation
- ✅ Each test verifies pre/post state

**Implementation Notes:**

- Uses real test database (PostgreSQL)
- Simulates failures by throwing errors at specific points
- Verifies row counts before/after
- Important for data integrity validation

---

## TASK_044: Create idempotency tests

**ID:** TASK_044  
**Title:** Write tests for idempotent operations  
**Layer:** Testing  
**Type:** test/unit  
**Dependencies:** TASK_040-041  
**Complexity:** medium  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Create tests verifying that certain operations are idempotent (repeating request produces same result). Important for safety in distributed systems.

**Acceptance Criteria:**

- ✅ Test file: tests/unit/products/idempotency.test.ts
- ✅ Test: validateSlugUniqueness idempotent (same slug, multiple checks)
- ✅ Test: listProducts idempotent (same query, same results)
- ✅ Test: changeProductStatus idempotent (set to ACTIVE twice, no changes)
- ✅ Test: createProduct NOT idempotent (each call creates new product)
- ✅ Test: updateProduct NOT idempotent (each call creates new version)
- ✅ Clear documentation: which operations are idempotent vs not
- ✅ Important for retry logic and safety

**Implementation Notes:**

- List operations (GET) must be idempotent
- Mutation operations (POST, PUT) are not idempotent
- Status no-change scenario returns unchanged product
- Used to justify retry logic in clients

---

## TASK_045: Create tenant isolation tests

**ID:** TASK_045  
**Title:** Write tests verifying products only access master DB  
**Layer:** Testing  
**Type:** test/unit  
**Dependencies:** TASK_021-024  
**Complexity:** medium  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Create tests that verify product operations never access tenant databases. All product CRUD happens in master_db only. Tests spy on DB connections and verify isolation.

**Acceptance Criteria:**

- ✅ Test file: tests/unit/products/isolation.test.ts
- ✅ Test: createProduct only queries master_db (no tenant_db access)
- ✅ Test: listProducts only queries master_db
- ✅ Test: product service doesn't receive tenantId context
- ✅ Test: all DB queries include master_db connection identifier
- ✅ Test: no tenant-scoped queries in product operations
- ✅ Spies/mocks verify isolation guarantees
- ✅ Important for compliance and security

**Implementation Notes:**

- Uses Vitest spies to track DB connections
- Verifies connection string contains 'master'
- Ensures no tenant context leakage
- Aligned with ADR-0001 (database-per-tenant)

---

## TASK_046: Create comprehensive end-to-end scenario tests

**ID:** TASK_046  
**Title:** Write E2E workflow tests for complete product lifecycle  
**Layer:** Testing  
**Type:** test/e2e  
**Dependencies:** TASK_042  
**Complexity:** high  
**Transactional:** no  
**Idempotent:** yes

**Description:**
Create end-to-end scenario tests that exercise full product workflows: create → update → status change → audit log query. Validates entire system integration.

**Acceptance Criteria:**

- ✅ Test file: tests/e2e/products/workflow.test.ts
- ✅ Scenario: Create product, verify version 1, audit log shows CREATE
- ✅ Scenario: Update product name, version increments to 2, audit log shows UPDATE
- ✅ Scenario: Add modules, version increments to 3, audit log shows UPDATE
- ✅ Scenario: Change status to INACTIVE, version stays 3, audit log shows STATUS_CHANGE
- ✅ Scenario: Query audit log, returns all 4 actions in correct order
- ✅ Scenario: Verify audit log diffs show actual changes
- ✅ Scenario: Delete non-referenced product succeeds
- ✅ Scenario: Try to delete product with licenses, returns 409
- ✅ Tests verify all operations complete with correct status codes
- ✅ Tests exercise full middleware chain

**Implementation Notes:**

- Uses Vitest + supertest for HTTP testing
- Real test database with transactions rolled back between tests
- Verifies complete API contract
- Catching integration bugs before production

---

# SUMMARY TABLE

| Task ID  | Title                                         | Layer         | Type             | Dep Count | Duration | Risk   |
| -------- | --------------------------------------------- | ------------- | ---------------- | --------- | -------- | ------ |
| TASK_001 | Create products table schema migration        | DB            | schema           | 0         | 1h       | low    |
| TASK_002 | Create product_versions table schema          | DB            | schema           | 1         | 1h       | low    |
| TASK_003 | Create product_audit_logs table schema        | DB            | schema           | 1         | 1h       | low    |
| TASK_004 | Create indexes for products table             | DB            | schema           | 1         | 30m      | low    |
| TASK_005 | Create indexes for product_versions           | DB            | schema           | 1         | 30m      | low    |
| TASK_006 | Create indexes for product_audit_logs         | DB            | schema           | 1         | 30m      | low    |
| TASK_007 | Update schema_version after migration         | DB            | migration        | 6         | 30m      | low    |
| TASK_008 | Create DB constraint validation function      | DB            | validation       | 7         | 1h       | low    |
| TASK_009 | Define Module enum                            | Domain        | enum             | 0         | 30m      | low    |
| TASK_010 | Create Product type definitions               | Domain        | types            | 1         | 1h       | low    |
| TASK_011 | Implement validateProductName                 | Domain        | validation       | 1         | 30m      | low    |
| TASK_012 | Implement validateModulesEnum                 | Domain        | validation       | 2         | 30m      | low    |
| TASK_013 | Implement validateSlug                        | Domain        | validation       | 1         | 30m      | low    |
| TASK_014 | Implement validateSlugUniqueness              | Domain        | validation       | 2         | 30m      | low    |
| TASK_015 | Implement getProductById                      | Domain        | query            | 2         | 30m      | low    |
| TASK_016 | Implement getProductBySlug                    | Domain        | query            | 2         | 30m      | low    |
| TASK_017 | Implement listProducts                        | Domain        | query            | 2         | 1h       | low    |
| TASK_018 | Implement getProductVersions                  | Domain        | query            | 1         | 30m      | low    |
| TASK_019 | Implement getProductAuditLog                  | Domain        | query            | 2         | 1h       | low    |
| TASK_020 | Implement countLicensesByProductId            | Domain        | query            | 1         | 30m      | low    |
| TASK_021 | Implement createProduct service               | Domain        | service          | 6         | 2h       | medium |
| TASK_022 | Implement updateProduct service               | Domain        | service          | 3         | 2h       | medium |
| TASK_023 | Implement changeProductStatus service         | Domain        | service          | 2         | 1h       | low    |
| TASK_024 | Implement deleteProduct service               | Domain        | service          | 2         | 1h       | low    |
| TASK_025 | Implement computeFieldDiff helper             | Domain        | utility          | 1         | 30m      | low    |
| TASK_026 | Implement generateChangeSummary helper        | Domain        | utility          | 2         | 30m      | low    |
| TASK_027 | Implement license middleware                  | API           | middleware       | 1         | 1h       | medium |
| TASK_028 | Implement correlation ID middleware           | API           | middleware       | 0         | 30m      | low    |
| TASK_029 | Create POST /api/v1/mmc/products              | API           | endpoint         | 3         | 1h       | medium |
| TASK_030 | Create GET /api/v1/mmc/products               | API           | endpoint         | 3         | 1h       | medium |
| TASK_031 | Create GET /api/v1/mmc/products/:id           | API           | endpoint         | 3         | 30m      | low    |
| TASK_032 | Create PUT /api/v1/mmc/products/:id           | API           | endpoint         | 3         | 1h       | medium |
| TASK_033 | Create PATCH /api/v1/mmc/products/:id/status  | API           | endpoint         | 4         | 1h       | low    |
| TASK_034 | Create GET /api/v1/mmc/products/:id/audit-log | API           | endpoint         | 3         | 1.5h     | medium |
| TASK_035 | Implement rate limiting middleware            | API           | middleware       | 0         | 1h       | low    |
| TASK_036 | Implement error handler function              | API           | error-handling   | 2         | 1h       | low    |
| TASK_037 | Implement structured logging                  | Observability | logging          | 8         | 1h       | low    |
| TASK_038 | Implement Prometheus metrics                  | Observability | metrics          | 6         | 1.5h     | low    |
| TASK_039 | Configure rate limiting alerts                | Observability | alerting         | 1         | 1h       | low    |
| TASK_040 | Create validation unit tests                  | Testing       | test/unit        | 4         | 2h       | low    |
| TASK_041 | Create domain service unit tests              | Testing       | test/unit        | 6         | 3h       | low    |
| TASK_042 | Create API integration tests                  | Testing       | test/integration | 8         | 4h       | medium |
| TASK_043 | Create transaction atomicity tests            | Testing       | test/integration | 4         | 3h       | medium |
| TASK_044 | Create idempotency tests                      | Testing       | test/unit        | 3         | 2h       | low    |
| TASK_045 | Create tenant isolation tests                 | Testing       | test/unit        | 4         | 1h       | low    |
| TASK_046 | Create E2E scenario tests                     | Testing       | test/e2e         | 3         | 3h       | medium |

**Total Estimated Duration:** ~48 hours (10 days with 8h/day work)
**Dependency Depth:** 7 levels
**Critical Path:** TASK_001 → TASK_002 → TASK_003 → TASK_004-006 → TASK_007 → TASK_021 → TASK_029 → TASK_042

---

## Execution Recommendations

### Phase 1: Database (Day 1, 1 engineer)

- Execute TASK_001-007 sequentially
- Validate schema with TASK_008
- Expected: 6 hours, foundation for all other work

### Phase 2: Domain (Days 2-3, 2 engineers in parallel)

- Engineer A: TASK_009-020 (types, validation, queries)
- Engineer B: TASK_021-026 (services, helpers)
- Tests: TASK_040-041 (unit tests)
- Expected: 8 hours each, high dependency sync needed

### Phase 3: API (Day 4, 1-2 engineers)

- TASK_027-028 (middleware setup)
- TASK_029-034 (routes, all depend on middleware)
- TASK_035-036 (rate limiting, error handling)
- Tests: TASK_042 (integration tests)
- Expected: 8 hours

### Phase 4: Observability & Testing (Day 5, 1 engineer)

- TASK_037-039 (logging, metrics, alerts)
- TASK_043-046 (atomicity, E2E tests)
- Expected: 8 hours
- Critical: All tests must pass >90% on first run

### Validation Checkpoints

- ✅ After DB: Schema validated, migrations reversible
- ✅ After Domain: All unit tests passing, 100% coverage
- ✅ After API: All integration tests passing, error handling verified
- ✅ After Observability: Metrics visible, alerts configured
- ✅ Final: E2E tests passing, load test baseline established

---

## Risk Mitigation

**High Risk Areas:**

1. **Transaction atomicity (TASK_021-022)**: Verify database-level rollback behavior
   - Mitigation: TASK_043 atomicity tests run first
2. **Middleware chain order (TASK_027-028)**: Incorrect ordering breaks isolation
   - Mitigation: Explicit documentation of middleware order in code
3. **Rate limiting under load (TASK_035)**: Redis failures cause cascading failures
   - Mitigation: Circuit breaker pattern, allow list bypass

**Medium Risk Areas:**

1. **API validation (TASK_029-034)**: Off-by-one errors in pagination, search bugs
   - Mitigation: TASK_042 integration tests validate edge cases
2. **Audit log consistency (TASK_003, TASK_022)**: Diffs missing fields
   - Mitigation: Schema validation at DB level, TASK_041 tests verify

**Low Risk Areas:**

- Type definitions (TASK_010): TypeScript catches errors at compile time
- Queries (TASK_015-020): Simple SELECT, low complexity
- Metrics (TASK_038): Observability only, doesn't affect data

---

## Sign-Off

**This TASKS_REPORT is:**

- ✅ Complete (46 atomic tasks)
- ✅ Dependency-ordered (leaf tasks first)
- ✅ Layer-scoped (no cross-layer dependencies)
- ✅ Transactional status declared
- ✅ Idempotency requirements specified
- ✅ Middleware dependencies explicit
- ✅ Isolation guarantees preserved
- ✅ Ready for implementation

**Next Step:** Begin execution with Phase 1 (Database migrations), using this TASKS_REPORT as atomic work unit definitions.

**Status:** READY FOR IMPLEMENTATION ✅

---

**Report Generated:** 2026-02-22  
**Report Version:** 1.0  
**Architecture Alignment:** ✅ PASSED
