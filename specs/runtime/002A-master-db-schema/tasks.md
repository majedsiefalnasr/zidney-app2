# Implementation Tasks: Master Database Schema

**Feature**: 002A-master-db-schema  
**Stage**: STAGE_02A_MASTER_DATABASE_SCHEMA  
**Phase**: 01 – Platform Foundation  
**Created**: 2026-02-16

---

## Implementation Strategy

This is a **schema-only foundational feature** with no API endpoints or user stories.

**Execution Order**:

1. **Phase 1**: Setup migration infrastructure
2. **Phase 2**: Implement core schema migration
3. **Phase 3**: Create TypeScript type definitions
4. **Phase 4**: Add validation and utilities
5. **Phase 5**: Write comprehensive tests
6. **Phase 6**: Polish and deployment readiness

**No Parallelization** between phases (sequential dependencies).  
**Parallelization within Phase 5** (tests are independent).

---

## Phase 1: Migration Infrastructure Setup

### Setup Goal

Establish the migration system infrastructure for master database schema deployment.

### Independent Test Criteria

- Migration directory structure exists
- Migration runner can discover migration files
- \_schema_migrations tracking table can be created
- Migration system handles errors gracefully

---

- [x] T001 Create migration directory structure in apps/api/src/db/master/migrations/
- [x] T002 Create migration runner utility class in apps/api/src/db/master/runner.ts
- [x] T003 Create \_schema_migrations tracking table definition in
      apps/api/src/db/master/schema-migrations.ts
- [x] T004 Implement migration discovery logic (scan migrations/ directory) in
      apps/api/src/db/master/loader.ts
- [x] T005 Implement migration version validation (semantic versioning check) in
      apps/api/src/db/master/validator.ts

---

## Phase 2: Core Schema Migration

### Migration Goal

Create the primary migration file that establishes all master database tables with constraints and
indexes.

### Independent Test Criteria

- Migration file executes without errors
- All 5 tables created with correct schemas
- All constraints enforced (PK, FK, UNIQUE, CHECK)
- All indexes created
- platform_schema_version initialized to 1.0.0
- Migration is idempotent (re-run does not fail)

---

- [x] T006 Create migration file 001_initial_schema.ts with products table DDL in
      apps/api/src/db/master/migrations/001_initial_schema.ts
  - Transaction: YES (wrapped in BEGIN/COMMIT)
  - Idempotency: YES (CREATE IF NOT EXISTS + migration tracking)
  - Middleware: N/A (DDL, not endpoint)

- [x] T007 Add licenses table DDL to migration 001_initial_schema.ts in
      apps/api/src/db/master/migrations/001_initial_schema.ts
  - Transaction: YES (same transaction as T006)
  - Idempotency: YES
  - Foreign key to products with ON DELETE RESTRICT

- [x] T008 Add tenants_registry table DDL to migration 001_initial_schema.ts in
      apps/api/src/db/master/migrations/001_initial_schema.ts
  - Transaction: YES (same transaction as T006)
  - Idempotency: YES
  - Foreign key to licenses with ON DELETE RESTRICT
  - Architectural rule: NO status field (reads from licenses)

- [x] T009 Add mmc_users table DDL to migration 001_initial_schema.ts in
      apps/api/src/db/master/migrations/001_initial_schema.ts
  - Transaction: YES (same transaction as T006)
  - Idempotency: YES
  - Role enum validation check

- [x] T010 Add platform_schema_version table DDL to migration 001_initial_schema.ts in
      apps/api/src/db/master/migrations/001_initial_schema.ts
  - Transaction: YES (same transaction as T006)
  - Idempotency: YES
  - Single-row constraint (id = 1)

- [x] T011 Add index creation to migration 001_initial_schema.ts in
      apps/api/src/db/master/migrations/001_initial_schema.ts
  - Create 5 indexes: products(slug), licenses(workspace_slug), licenses(status),
    tenants_registry(workspace_slug), mmc_users(email)
  - Transaction: YES (indexes in same transaction)
  - Idempotency: YES (CREATE INDEX IF NOT EXISTS)

- [x] T012 Add platform_schema_version initialization to migration 001_initial_schema.ts in
      apps/api/src/db/master/migrations/001_initial_schema.ts
  - INSERT initial version: 1.0.0
  - Transaction: YES (same transaction)
  - Idempotency: YES (ON CONFLICT DO NOTHING or IF NOT EXISTS)

- [x] T013 Implement transaction error handling and rollback logic in migration executor in
      apps/api/src/db/master/runner.ts
  - Catch SQL errors and log structured JSON
  - Automatic rollback on any error
  - Prevent partial schema creation

---

## Phase 3: TypeScript Type Definitions

### Type Goal

Define TypeScript interfaces for all master database entities with runtime type safety.

### Independent Test Criteria

- All 5 entity types defined with required fields
- Enum types for status and roles
- Utility functions for version comparison
- Type validation passes TypeScript strict mode

---

- [x] T014 Create TypeScript entity interfaces in packages/types/src/master-db.ts
  - Product interface
  - License interface with LicenseStatus enum
  - TenantRegistry interface
  - MMCUser interface with MMCUserRole enum
  - PlatformSchemaVersion interface

- [x] T015 Create TypeScript input/output types in packages/types/src/master-db.ts
  - CreateProductInput, UpdateProductInput
  - CreateLicenseInput, UpdateLicenseInput
  - CreateTenantRegistryInput, UpdateTenantRegistryInput
  - CreateMMCUserInput, UpdateMMCUserInput

- [x] T016 Create TypeScript utility functions in packages/types/src/master-db-utils.ts
  - parseVersion() - Parse semantic version string to major.minor.patch
  - isVersionCompatible() - Check if requested version >= minimum version
  - isLicenseActive() - Check if license is in ACTIVE state

- [x] T017 Create error code enumeration in packages/types/src/error-codes.ts
  - MasterDBErrorCode enum with HTTP codes (400, 403, 404, 409, 423, 426, 500)
  - ErrorResponse interface matching API envelope

- [x] T018 Create API response envelope types in packages/types/src/api-response.ts
  - APIResponse<T> generic interface
  - Matches: { success: boolean, data: T | null, error: { code, message } | null }

---

## Phase 4: Validation and Utility Functions

### Validation Goal

Implement runtime validation for input data and utility functions for common operations.

### Independent Test Criteria

- Validation rules enforce constraints from schema contracts
- Version parsing handles semantic versions correctly
- License state checking works for all statuses
- All validation functions handle edge cases

---

- [x] T019 Create validation schema in packages/validation/src/master-db-schema.ts
  - validateProduct() - Check name, slug, version format, enabled_modules JSON
  - validateLicense() - Check workspace_slug format, status values, date ranges
  - validateTenantRegistry() - Check db_host, db_port, workspace_slug
  - validateMMCUser() - Check email format, role values

- [x] T020 Create RBAC permission matrix in packages/types/src/rbac.ts
  - RolePermissions object with admin, operator, read_only roles
  - Define permissions: create_product, update_product, delete_product, etc.

- [x] T021 Create logging utilities for master DB operations in
      packages/domain-core/src/logging/master-db-logger.ts
  - Structured JSON logger with required fields: timestamp, level, service, correlation_id,
    migration_version
  - Log migration start, completion, failure events

---

## Phase 5: Comprehensive Testing

### Test Goal

Validate schema integrity, migration execution, isolation, and transaction safety through unit,
integration, and isolation tests.

### Independent Test Criteria (All tests pass)

- Schema constraints enforced
- Migration idempotency verified
- Isolation maintained (no tenant data leakage)
- Transaction atomicity confirmed
- Error handling works
- Version compatibility logic correct
- All edge cases handled

---

- [x] T022 [P] Write schema constraint validation tests in
      apps/api/tests/db/master/schema-constraints.test.ts
  - Test products table: UUID PK, unique slug constraint, JSONB validation
  - Test licenses table: UUID PK, FK to products, unique workspace_slug, status enum
  - Test tenants_registry table: UUID PK, FK to licenses, unique workspace_slug
  - Test mmc_users table: auto-increment PK, unique email, role enum
  - Test platform_schema_version: single row (id=1), version fields

- [x] T023 [P] Write migration execution tests in apps/api/tests/db/master/migration-001.test.ts
  - Test migration creates all 5 tables
  - Test all constraints enforced (FK, UNIQUE, CHECK)
  - Test all 5 indexes exist
  - Test platform_schema_version initialized
  - Test migration record inserted in \_schema_migrations

- [x] T024 [P] Write idempotency tests in apps/api/tests/db/master/idempotency.test.ts
  - Re-run migration on already-migrated DB should not fail
  - Verify migration tracked in \_schema_migrations (version '001' exists)
  - Verify each table created exactly once

- [x] T025 [P] Write isolation tests in apps/api/tests/db/master/isolation.test.ts
  - Verify master tables do NOT exist in tenant databases
  - Verify tenant tables do NOT exist in master database
  - Verify connection pool isolation maintained
  - Verify no cross-tenant data access possible

- [x] T026 [P] Write transaction atomicity tests in
      apps/api/tests/db/master/transaction-atomicity.test.ts
  - Simulate migration failure (e.g., FK constraint error)
  - Verify no partial schema created
  - Verify all changes rolled back
  - Verify \_schema_migrations entry NOT inserted on failure

- [x] T027 [P] Write transaction rollback tests in
      apps/api/tests/db/master/transaction-rollback.test.ts
  - Verify ROLLBACK on SQL error reverses all changes
  - Verify database state consistent after rollback
  - Verify no orphaned tables or indexes

- [x] T028 [P] Write version compatibility tests in apps/api/tests/db/master/version-compat.test.ts
  - Test isVersionCompatible() with various version pairs
  - Test schema_version validation logic
  - Test product_version validation logic
  - Test minimum version enforcement

- [x] T029 [P] Write license state validation tests in
      apps/api/tests/db/master/license-state.test.ts
  - Test isLicenseActive() for ACTIVE status
  - Test isLicenseActive() for SOFT_LOCKED (with deadline check)
  - Test isLicenseActive() for ARCHIVED status
  - Test isLicenseActive() with deleted_at timestamp

- [x] T030 [P] Write error handling tests in apps/api/tests/db/master/error-handling.test.ts
  - Test DB connection failure → 500 with retry logic
  - Test FK constraint violation → 409 Conflict
  - Test duplicate workspace_slug → 409 Conflict
  - Test invalid version format → 400 Bad Request

- [x] T031 [P] Write security tests in apps/api/tests/db/master/security.test.ts
  - Verify db_password_encrypted field never logged plain text
  - Verify password_hash never logged plain text
  - Verify migration logs contain no credentials
  - Verify structured logs follow schema contract

- [x] T032 [P] Write data integrity tests in apps/api/tests/db/master/data-integrity.test.ts
  - Verify timestamp fields auto-populated with server NOW()
  - Verify foreign key constraints prevent orphaning
  - Verify unique constraints prevent duplicates
  - Verify check constraints enforce status values

---

## Phase 6: Polish and Deployment Readiness

### Polish Goal

Ensure code quality, documentation, and deployment readiness for production deployment.

### Independent Test Criteria

- TypeScript strict mode passes
- ESLint passes
- Documentation complete
- Migration deployable
- Error codes documented
- Logging output validated

---

- [x] T033 Run TypeScript strict mode validation on all files in apps/api/src/db/master/
  - Fix any type errors
  - Ensure no 'any' types
  - No implicit any

- [x] T034 Run ESLint on migration and utility files in apps/api/src/db/master/
  - Fix linting issues
  - Ensure 2-space indentation
  - No console.log statements

- [x] T035 Generate error code documentation in docs/API_ERROR_CODES.md
  - Document all MasterDBErrorCode enum values
  - HTTP status codes and meanings
  - When each error is thrown

- [x] T036 Update migration documentation in docs/02_DEVOPS_DEPLOYMENT/04_DATABASE_STRATEGY.md
  - Add master database migration procedure
  - Add rollback procedure (snapshot restore)
  - Add version compatibility notes

- [x] T037 Create migration checklist in apps/api/src/db/master/MIGRATION_CHECKLIST.md
  - Pre-deployment: SQL validation, backup creation, etc.
  - Post-deployment: Verify tables, indexes, initial data
  - Rollback plan documented

- [x] T038 Verify all logging outputs match structured JSON schema
  - Sample logs from migration execution
  - Verify all required fields present: timestamp, level, service, correlation_id
  - No unstructured console output

- [x] T039 Document public API contract for master DB types in packages/types/README.md
  - Export list: Product, License, TenantRegistry, MMCUser, PlatformSchemaVersion
  - Export list: Validation functions, error codes, utility functions
  - Usage examples

- [x] T040 Create deployment guide in docs/DEPLOYMENT_PROCEDURE.md
  - Step 1: Create master database and apply migrations
  - Step 2: Initialize platform_schema_version
  - Step 3: Verify all tables exist
  - Step 4: Run deployment verification tests
  - Step 5: Monitor logs for errors

---

## Phase 7: Files Modified Summary

**Created Files**:

- apps/api/src/db/master/migrations/001_initial_schema.ts (migration)
- apps/api/src/db/master/runner.ts (migration executor)
- apps/api/src/db/master/loader.ts (migration loader)
- apps/api/src/db/master/validator.ts (migration validator)
- apps/api/src/db/master/schema-migrations.ts (tracking table schema)
- packages/types/src/master-db.ts (entity types)
- packages/types/src/master-db-utils.ts (utility functions)
- packages/types/src/error-codes.ts (error enumeration)
- packages/types/src/api-response.ts (response envelope)
- packages/validation/src/master-db-schema.ts (validation functions)
- packages/types/src/rbac.ts (RBAC permissions)
- packages/domain-core/src/logging/master-db-logger.ts (structured logging)

**Test Files Created**:

- apps/api/tests/db/master/schema-constraints.test.ts
- apps/api/tests/db/master/migration-001.test.ts
- apps/api/tests/db/master/idempotency.test.ts
- apps/api/tests/db/master/isolation.test.ts
- apps/api/tests/db/master/transaction-atomicity.test.ts
- apps/api/tests/db/master/transaction-rollback.test.ts
- apps/api/tests/db/master/version-compat.test.ts
- apps/api/tests/db/master/license-state.test.ts
- apps/api/tests/db/master/error-handling.test.ts
- apps/api/tests/db/master/security.test.ts
- apps/api/tests/db/master/data-integrity.test.ts

**Documentation Files**:

- docs/API_ERROR_CODES.md
- docs/02_DEVOPS_DEPLOYMENT/04_DATABASE_STRATEGY.md (updated)
- apps/api/src/db/master/MIGRATION_CHECKLIST.md
- docs/DEPLOYMENT_PROCEDURE.md

**Files NOT Modified**:

- Frontend files (no frontend required)
- Worker files (no background jobs)
- Tenant database files (master DB only)
- Unrelated API modules

---

## Dependency Graph

```
Phase 1 (Setup)
  ├─ T001: Create migration directory
  ├─ T002: Create migration runner
  ├─ T003: Create tracking table schema
  ├─ T004: Create migration loader
  └─ T005: Create migration validator
       ↓
Phase 2 (Schema Migration)
  ├─ T006-T012: Implement migration 001_initial_schema.ts
  └─ T013: Add error handling
       ↓
Phase 3 (Types)
  ├─ T014: Entity types
  ├─ T015: Input/output types
  ├─ T016: Utility functions
  ├─ T017: Error codes
  └─ T018: API response envelope
       ↓
Phase 4 (Validation)
  ├─ T019: Validation schema
  ├─ T020: RBAC permissions
  └─ T021: Logging utilities
       ↓
Phase 5 (Testing) - CAN PARALLELIZE T022-T032
  ├─ T022-T032: All tests independent
       ↓
Phase 6 (Polish)
  ├─ T033: TypeScript validation
  ├─ T034: ESLint validation
  ├─ T035: Error code docs
  ├─ T036: Migration docs
  ├─ T037: Migration checklist
  ├─ T038: Logging validation
  ├─ T039: Type API docs
  └─ T040: Deployment guide
```

---

## Parallel Execution Strategy

**Sequential Dependencies**: Phases 1-6 must execute sequentially

**Parallelizable Within Phase 5**: Tests T022-T032 can execute in parallel (11 independent test
files)

**Suggested Developer Assignment**:

- Developer 1: Phases 1-4
- Developer 2: Phase 5 (tests can run in parallel)
- Developer 3: Phase 6 (parallel, non-blocking)

---

## MVP Scope

For minimal viable deployment:

**Required** (Phase 1-2):

- T001-T013: Migration infrastructure and schema creation

**Required** (Phase 3-4):

- T014-T021: Types, validation, logging (needed by future features)

**Required** (Phase 5):

- T023: Migration execution tests
- T024: Idempotency tests
- T025: Isolation tests

**Optional** (can defer):

- T022: Schema constraint tests (covered by integration)
- T026-T032: Additional test coverage (covered by T023-T025)
- T033-T040: Documentation and polish (deploy later)

**MVP Execution Time**: ~2-3 days with 1 developer

---

## Task Completion Definition

A task is complete when:

✓ Code written and compiles ✓ Tests pass (if applicable) ✓ File path matches spec ✓ No unrelated
files modified ✓ Layer isolation maintained ✓ Transaction/idempotency requirements met ✓ Logging
structured JSON compliant ✓ No console.log() statements ✓ TypeScript strict mode passing

---

## Quality Gates

Before proceeding to implementation:

- [ ] All tasks reviewed
- [ ] No architectural violations
- [ ] File paths are correct
- [ ] Test coverage adequate
- [ ] Dependency graph valid
- [ ] Expected RTO documented

---

## Next Step: /speckit.analyze

After tasks are approved, run:

```bash
/speckit.analyze
```

This will verify:

- No isolation violations
- No middleware bypass
- No missing transactions
- No version enforcement gaps
- All tasks aligned with constitution
