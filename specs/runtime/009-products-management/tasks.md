# Tasks: Products Management (STAGE_09_PRODUCTS)

**Stage:** STAGE_09_PRODUCTS  
**Phase:** 02_PLATFORM_MMC  
**Spec File:** [specs/phases/02_PLATFORM_MMC/STAGE_09_PRODUCTS.md](../../phases/02_PLATFORM_MMC/STAGE_09_PRODUCTS.md)  
**Plan Report:** [reports/PLAN_REPORT.md](reports/PLAN_REPORT.md)  
**Analyze Report:** [reports/ANALYZE_REPORT.md](reports/ANALYZE_REPORT.md)

**Organization**: Tasks organized by functional component to enable parallel implementation.

---

## Phase 1: Setup & Infrastructure

**Purpose**: Initialize project structure, define types, and establish foundational code patterns

**⚠️ CRITICAL**: This phase MUST complete before other work begins

- [x] T001 Create Module enum and validators in packages/types/src/enums/Module.ts
- [x] T002 [P] Create Product type definitions in packages/types/src/products/Product.ts
- [x] T003 [P] Create product validation schemas in packages/validation/src/products/productValidation.ts
- [x] T004 [P] Create API response types in packages/types/src/api/ApiResponse.ts
- [x] T005 Create database migration type definitions in apps/api/src/db/types/Migration.ts
- [x] T006 Initialize Pino logger for products service in packages/logging/src/products.ts
- [x] T007 Create error codes constants in packages/types/src/errors/ErrorCodes.ts

**Checkpoint**: Type system, enums, and validation infrastructure ready for database and service implementation

---

## Phase 2: Database & Migrations

**Purpose**: Establish master_db schema for products, versioning, and audit logging

**Dependencies**: Must complete Phase 1 first

- [x] T008 Create database migration file apps/api/src/db/master/migrations/001_initial_products_schema.ts with:
  - `products` table (id, name, slug, description, enabled_modules, status, current_version, created_at, updated_at)
  - Check constraints (name.en required, slug format, status values, modules not empty)
  - Indexes on slug, status, created_at, updated_at
  - Foreign key with ON DELETE RESTRICT (for future licenses table)

- [x] T009 Create product_versions table in same migration file:
  - Columns: id, product_id, version_number, name, enabled_modules, description, change_summary, created_at
  - Unique constraint on (product_id, version_number)
  - Indexes on product_id and version_number

- [x] T010 Create product_audit_logs table in same migration file:
  - Columns: id, product_id, action, previous_version, new_version, changed_fields, performed_by, timestamp
  - Check constraint on action values (CREATE, UPDATE, STATUS_CHANGE)
  - Indexes on product_id, action, timestamp, performed_by

- [x] T011 Add transaction wrapper and idempotency checks in migration file (all DDL in single transaction)

- [x] T012 Create schema_version increment logic in migration post-execution

**Checkpoint**: Master DB schema fully initialized with immutable version and audit tables. Migration is reversible via snapshot only.

---

## Phase 3: Domain Layer - Services & Validation

**Purpose**: Implement business logic for product operations

**Dependencies**: Must complete Phase 2 first

### Core Product Service Functions

- [x] T013 Implement createProduct() in packages/domain-core/src/products/productService.ts with:
  - Input validation (name, slug, modules)
  - Slug uniqueness check
  - Atomic transaction: insert product → insert version 1 → insert audit log
  - Return created Product with current_version = 1

- [x] T014 Implement updateProduct() in packages/domain-core/src/products/productService.ts with:
  - Detect actual changes (no version bump if nothing changes)
  - Atomic transaction: insert new version → update product → insert audit log
  - Compute field diff for changed_fields
  - Generate change_summary
  - Return updated Product with incremented current_version

- [x] T015 Implement changeProductStatus() in packages/domain-core/src/products/productService.ts with:
  - Status validation (ACTIVE or INACTIVE)
  - Atomic transaction: update status → insert audit log (NO version increment)
  - Return updated Product with same current_version

- [x] T016 [P] Implement getProductById() in packages/domain-core/src/products/productService.ts
- [x] T017 [P] Implement getProductBySlug() in packages/domain-core/src/products/productService.ts
- [x] T018 [P] Implement listProducts() in packages/domain-core/src/products/productService.ts with:
  - Default ACTIVE products only
  - Support ?status=ACTIVE|INACTIVE|all filter
  - Support search by name (en/ar) and slug
  - Pagination (limit/offset, max 100)
  - Sorted by created_at DESC

- [x] T019 Implement deleteProduct() in packages/domain-core/src/products/productService.ts with:
  - Check for existing licenses (will throw error)
  - Cascade delete: audit logs → versions → product (atomic)

- [x] T020 Implement getProductAuditLog() in packages/domain-core/src/products/productService.ts with:
  - Pagination (limit/offset, max 100)
  - Filters: action, from_date, to_date
  - Sorted by timestamp DESC
  - Return paginated AuditLogEntry[] with performed_by user details

### Validation Functions

- [x] T021 [P] Implement validateProductName() in packages/validation/src/products/productValidation.ts
- [x] T022 [P] Implement validateModulesEnum() in packages/validation/src/products/productValidation.ts
- [x] T023 [P] Implement validateSlug() in packages/validation/src/products/productValidation.ts
- [x] T024 [P] Implement validateSlugUniqueness() in packages/validation/src/products/productValidation.ts
- [x] T025 [P] Implement getProductName() (localization helper) in packages/validation/src/products/productValidation.ts

### Helper Functions

- [x] T026 [P] Implement generateChangeSummary() helper in packages/domain-core/src/products/productService.ts
- [x] T027 [P] Implement computeFieldDiff() helper in packages/domain-core/src/products/productService.ts

**Checkpoint**: All domain services functional and testable independently. Transaction atomicity verified. Version immutability enforced.

---

## Phase 4: API Layer - Middleware & Infrastructure

**Purpose**: Establish API routing, middleware order, and error handling

**Dependencies**: Must complete Phase 3 first

- [x] T028 Create correlation ID middleware in apps/api/src/middleware/correlationIdMiddleware.ts with:
  - Extract or generate x-correlation-id header
  - Set on context for all downstream handlers
  - Include in response header

- [x] T029 Create license validation middleware in apps/api/src/middleware/licenseMiddleware.ts with:
  - Validate license status (ACTIVE/SOFT_LOCKED/ARCHIVED/DELETED)
  - Return appropriate HTTP status (423/403/404) for locked/archived/missing
  - Log structured warning on failure

- [x] T030 Create audit read permission middleware in apps/api/src/middleware/auditReadMiddleware.ts with:
  - Check if user has AUDIT_READ role/permission
  - Used only on GET /products/:id/audit-log endpoint

- [x] T031 Create error handler utility in apps/api/src/utils/errorHandler.ts with:
  - Map domain errors to HTTP status codes and response format
  - Implement all 13 error codes with correct HTTP status
  - Structured error response: {success: false, data: null, error: {code, message}}

- [x] T032 Create API response wrapper utility in apps/api/src/utils/responseWrapper.ts with:
  - Success response: {success: true, data: {...}}
  - Error response: {success: false, data: null, error: {...}}

**Checkpoint**: Middleware chain established in correct order. Error handling standardized. All responses follow API contract.

---

## Phase 5: API Layer - Endpoints (Part 1 - Read Operations)

**Purpose**: Implement read-only endpoints for product queries

**Dependencies**: Must complete Phase 4 first

- [x] T033 Implement GET /api/v1/mmc/products in apps/api/src/routes/mmc/products.ts with:
  - Middleware chain: correlationIdMiddleware → authMiddleware → licenseMiddleware
  - Query params: status, search, limit, offset
  - Call listProducts() domain service
  - Return paginated response with ProductResponse[]
  - Implement rate limiting: 100 req/min per user

- [x] T034 [P] Implement GET /api/v1/mmc/products/:id in apps/api/src/routes/mmc/products.ts with:
  - Same middleware chain
  - Call getProductById() domain service
  - Return single ProductResponse
  - Return 404 if not found
  - Implement rate limiting: 100 req/min per user

- [x] T035 [P] Implement GET /api/v1/mmc/products/:id/audit-log in apps/api/src/routes/mmc/products.ts with:
  - Middleware chain: correlationIdMiddleware → authMiddleware → auditReadMiddleware → licenseMiddleware
  - Query params: limit, offset, action, from_date, to_date
  - Call getProductAuditLog() domain service
  - Return paginated AuditLogEntry[] with performed_by details
  - Implement rate limiting: 50 req/min per user

**Checkpoint**: All read operations functional. Query filtering and pagination confirmed. Audit access restricted to authorized admins.

---

## Phase 6: API Layer - Endpoints (Part 2 - Write Operations)

**Purpose**: Implement create/update operations

**Dependencies**: Must complete Phase 5 first

- [x] T036 Implement POST /api/v1/mmc/products in apps/api/src/routes/mmc/products.ts with:
  - Middleware chain: correlationIdMiddleware → authMiddleware → licenseMiddleware
  - Request body: {name: {en, ar?}, slug, description?, enabled_modules[]}
  - Validate request body against createProductSchema (Zod)
  - Call createProduct() domain service
  - Return 201 Created with ProductResponse
  - Log structured info: product_created with productId, slug, modules
  - Implement rate limiting: 10 req/min per user

- [x] T037 Implement PUT /api/v1/mmc/products/:id in apps/api/src/routes/mmc/products.ts with:
  - Middleware chain: correlationIdMiddleware → authMiddleware → licenseMiddleware
  - Request body: {name?, description?, enabled_modules?} (partial update)
  - Validate against updateProductSchema (Zod)
  - Call updateProduct() domain service
  - Return 200 OK with ProductResponse
  - Log structured info: product_updated with oldVersion, newVersion
  - Handle version increment and change tracking
  - Implement rate limiting: 20 req/min per user

- [x] T038 Implement PATCH /api/v1/mmc/products/:id/status in apps/api/src/routes/mmc/products.ts with:
  - Middleware chain: correlationIdMiddleware → authMiddleware → licenseMiddleware
  - Request body: {status: 'ACTIVE' | 'INACTIVE'}
  - Call changeProductStatus() domain service
  - Return 200 OK with ProductResponse
  - Log structured info: product_status_changed with oldStatus, newStatus
  - Ensure status change does NOT increment version
  - Implement rate limiting: 20 req/min per user

**Checkpoint**: All write operations functional. Atomic transactions verified. Version immutability confirmed across operations. Rate limiting applied.

---

## Phase 7: API Layer - Endpoint (Part 3 - Delete Operation)

**Purpose**: Implement product deletion with constraints

**Dependencies**: Must complete Phase 6 first

- [x] T039 Implement DELETE /api/v1/mmc/products/:id in apps/api/src/routes/mmc/products.ts with:
  - Middleware chain: correlationIdMiddleware → authMiddleware → licenseMiddleware
  - Call deleteProduct() domain service
  - Return 204 No Content on success
  - Return 409 Conflict if licenses exist (PRODUCT_HAS_LICENSES error)
  - Return 404 if product not found
  - Log structured info: product_deleted with productId
  - Note: Hard delete only, no soft delete

**Checkpoint**: Delete operation enforces foreign key constraint. Conflict response prevents accidental deletion.

---

## Phase 8: Logging & Observability

**Purpose**: Implement structured logging and monitoring

**Dependencies**: Must complete Phase 5 first

- [x] T040 [P] Add structured logging to productService.ts:
  - Log on createProduct entry/success/error with productId and slug
  - Log on updateProduct with oldVersion/newVersion
  - Log on changeProductStatus with oldStatus/newStatus
  - Log on deleteProduct with productId
  - Include correlationId in all logs

- [x] T041 [P] Add error logging in error handler:
  - Log all 400/409/404/423/500 errors with code and message
  - Include stack trace for 500 errors
  - Include correlationId for tracing

- [x] T042 [P] Add performance metrics logging:
  - Log operation duration in milliseconds
  - Log slow operations (> 500ms) at WARN level

- [x] T043 Add Prometheus metrics in apps/api/src/metrics/products.ts:
  - Histogram: product_create_duration_ms, product_update_duration_ms, product_list_duration_ms, product_delete_duration_ms
  - Counter: product_create_total (by status: success/failure), product_update_total, product_delete_total, product_error_total (by error_code)
  - Gauge: product_count (ACTIVE), product_count (INACTIVE), product_count_by_module_enabled

**Checkpoint**: All operations produce struktured logs. Performance metrics collected. Correlation IDs propagate through entire request lifecycle.

---

## Phase 9: Rate Limiting Implementation

**Purpose**: Configure rate limiting with Redis

**Dependencies**: Must complete Phase 6 first

- [x] T044 Create rate limiting middleware in apps/api/src/middleware/rateLimitMiddleware.ts with:
  - Redis sliding window algorithm
  - Per-endpoint limits configurable

- [x] T045 Apply rate limiting to POST /api/v1/mmc/products: 10 req/min per user
- [x] T046 Apply rate limiting to PUT /api/v1/mmc/products/:id: 20 req/min per user
- [x] T047 Apply rate limiting to PATCH /api/v1/mmc/products/:id/status: 20 req/min per user
- [x] T048 Apply rate limiting to GET /api/v1/mmc/products: 100 req/min per user
- [x] T049 Apply rate limiting to GET /api/v1/mmc/products/:id: 100 req/min per user
- [x] T050 Apply rate limiting to GET /api/v1/mmc/products/:id/audit-log: 50 req/min per user
- [x] T051 Return 429 Too Many Requests on rate limit exceeded

**Checkpoint**: Rate limiting enforced on all endpoints. No endpoint accepts more than 100 requests/min per user.

---

## Phase 10: Integration Tests

**Purpose**: Verify end-to-end functionality and atomicity

**Dependencies**: Must complete Phase 6 first (can run in parallel with Phase 8-9)

### Product CRUD Tests

- [x] T052 Create product creation test in tests/integration/products/test_create.ts:
  - Valid product creation returns 201 with ProductResponse
  - Version set to 1, current_version = 1
  - Version 1 record created in product_versions
  - Audit log entry created with action=CREATE
  - Duplicate slug returns 409

- [x] T053 Create product listing test in tests/integration/products/test_list.ts:
  - GET /products returns ACTIVE products only by default
  - ?status=INACTIVE returns inactive products only
  - ?status=all returns both active and inactive
  - Pagination works (limit/offset)
  - Search by name (en/ar) works
  - Results sorted by created_at DESC

- [x] T054 Create product get test in tests/integration/products/test_get.ts:
  - GET /products/:id returns single product
  - Invalid product_id returns 404

- [x] T055 Create product update test in tests/integration/products/test_update.ts:
  - Valid update returns 200 with updated ProductResponse
  - current_version incremented
  - New version record created in product_versions
  - Audit log entry created with action=UPDATE
  - No update (same data) returns 200 without version increment
  - Cannot update slug (immutable)

- [x] T056 Create status change test in tests/integration/products/test_status_change.ts:
  - Change ACTIVE → INACTIVE succeeds, returns 200
  - Change INACTIVE → ACTIVE succeeds, returns 200
  - Status change does NOT increment current_version
  - Audit log created with action=STATUS_CHANGE (no version numbers)
  - Version field immutable (not included in PATCH request)

- [x] T057 Create product deletion test in tests/integration/products/test_delete.ts:
  - DELETE product without licenses succeeds, returns 204
  - DELETE product with licenses fails, returns 409
  - Product not found returns 404

### Audit Log Tests

- [x] T058 Create audit log query test in tests/integration/products/test_audit_log.ts:
  - GET /products/:id/audit-log returns paginated audit entries
  - Filtering by action works (CREATE, UPDATE, STATUS_CHANGE)
  - Date range filtering works (from_date, to_date)
  - Results sorted by timestamp DESC
  - Unauthorized access returns 401
  - Without AUDIT_READ permission returns 403

### Transaction Atomicity Tests

- [x] T059 Create transaction rollback test in tests/integration/products/test_transactions.ts:
  - If any part of createProduct fails, entire transaction rolls back
  - If any part of updateProduct fails, no version increment
  - Product remains in consistent state after failed operation
  - Audit log not created if operation rolls back

### Error Handling Tests

- [x] T060 [P] Create error response test in tests/integration/products/test_errors.ts:
  - DUPLICATE_SLUG returns 409 with proper error response
  - INVALID_MODULE_ENUM returns 400 with proper error response
  - INVALID_NAME_LOCALIZATION returns 400 with proper error response
  - PRODUCT_NOT_FOUND returns 404 with proper error response
  - UNAUTHORIZED returns 401 with proper error response
  - FORBIDDEN returns 403 with proper error response
  - WORKSPACE_LOCKED returns 423 with proper error response
  - All errors follow {success, data, error} format

**Checkpoint**: All critical paths tested. Atomicity verified. Error responses correct. Integration complete.

---

## Phase 11: Unit Tests

**Purpose**: Test individual functions and edge cases

**Dependencies**: Must complete Phase 3 first (can run in parallel with Phase 7-10)

### Domain Service Unit Tests

- [x] T061 [P] Create productService validation tests in tests/unit/products/test_service_validation.ts:
  - validateProductName() accepts valid names, rejects invalid
  - validateModulesEnum() accepts valid modules, rejects invalid
  - validateSlug() accepts valid slugs, rejects invalid
  - validateSlugUniqueness() detects duplicates

- [x] T062 [P] Create productService logic tests in tests/unit/products/test_service_logic.ts:
  - createProduct() increments current_version correctly
  - updateProduct() detects structural changes
  - updateProduct() avoids version bump for no changes
  - changeProductStatus() preserves current_version
  - getProductName() fallsback correctly (ar → en)

- [x] T063 [P] Create productService edge cases in tests/unit/products/test_service_edge_cases.ts:
  - Null/undefined handling in name, description
  - Empty module list rejected
  - Single character slug supported
  - Very long names/descriptions handled
  - Special characters in names handled

### Type & Validation Tests

- [x] T064 [P] Create Module enum tests in tests/unit/types/test_module_enum.ts:
  - All six modules defined
  - isValidModule() validates correctly
  - getModuleLabel() returns correct labels (en/ar)

- [x] T065 [P] Create Product type tests in tests/unit/types/test_product_types.ts:
  - Product interface complete
  - AuditLogEntry interface complete
  - ApiResponse interface flexible for different data types

**Checkpoint**: Unit tests verify business logic correctness. Edge cases handled. Type safety confirmed.

---

## Phase 12: Contract/Specification Tests

**Purpose**: Verify API compliance with OpenAPI specification

**Dependencies**: Must complete Phase 6 first

- [x] T066 Create OpenAPI specification file in docs/api/products-management-api-spec.yaml with:
  - 6 endpoints fully documented (POST, GET, PUT, PATCH, DELETE)
  - Request/response schemas
  - Authentication (JWT + scopes)
  - Error responses (all 13 codes)
  - Rate limiting headers
  - Example payloads

- [x] T067 Create contract tests in tests/contract/products/test_contract.ts:
  - POST /products response matches OpenAPI schema
  - GET /products response matches OpenAPI schema
  - GET /products/:id response matches OpenAPI schema
  - PUT /products/:id response matches OpenAPI schema
  - PATCH /products/:id/status response matches OpenAPI schema
  - DELETE /products/:id response (204) matches spec
  - GET /audit-log response matches OpenAPI schema
  - All error responses match error schema in spec

**Checkpoint**: API fully compliant with OpenAPI specification. Responses validated against schema.

---

## Phase 13: Performance & Concurrency Tests

**Purpose**: Verify performance under load and concurrent access

**Dependencies**: Must complete Phase 10 first

- [x] T068 Create concurrent update test in tests/load/products/test_concurrent_updates.ts:
  - 10+ concurrent updates to same product
  - Version increments are consistent (no lost updates)
  - Each update creates new version record
  - No duplicate version numbers for same product
  - Audit logs for all concurrent updates preserved

- [x] T069 Create slug uniqueness concurrency test in tests/load/products/test_slug_concurrency.ts:
  - 10+ concurrent product creations with same slug
  - Only one succeeds (409 for duplicates)
  - No phantom reads

- [x] T070 Create list operation performance test in tests/load/products/test_list_performance.ts:
  - Listing 1000+ products completes within 1 second
  - Pagination works correctly at scale
  - Search performance acceptable (< 500ms)
  - Indexes used effectively

- [x] T071 Create audit log query performance test in tests/load/products/test_audit_performance.ts:
  - Querying 10000+ audit log entries completes within 1 second
  - Filtering and pagination work at scale
  - Timestamp index effective

**Checkpoint**: System performs well under concurrent load. No race conditions. Indexes effective.

---

## Phase 14: Documentation & Finalization

**Purpose**: Document implementation and prepare for handoff

**Dependencies**: Must complete Phase 11 first

- [x] T072 Create API documentation in docs/API_PRODUCTS_MANAGEMENT.md with:
  - Endpoint reference (all 6 operations)
  - Request/response examples
  - Error handling guide
  - Rate limiting details
  - Authentication/authorization model
  - Code examples (curl, client lib)

- [x] T073 Create implementation guide in docs/IMPLEMENTATION_PRODUCTS.md with:
  - Architecture overview (API → Domain → DB)
  - File structure (packages/domain-core, apps/api/src/routes)
  - Adding new modules (enum, validation, provisioning)
  - Extension points for Stage 10 (License Engine)

- [x] T074 Create database README in apps/api/src/db/master/migrations/README_PRODUCTS.md with:
  - Schema overview (products, product_versions, product_audit_logs)
  - Versioning model explanation
  - Immutability guarantees
  - Migration strategy

- [x] T075 [P] Run full test suite to confirm all passes
- [x] T076 [P] Run linter and type checker on all new code
- [x] T077 [P] Verify code coverage > 80% for packages/domain-core

- [x] T078 Create CHANGELOG entry documenting:
  - Product entity added
  - 6 API endpoints added
  - Version history support
  - Audit logging capability

- [x] T079 Validate no architectural drift:
  - Execute validation script: scripts/validate-hard-mode.js
  - Verify no cross-tenant access
  - Verify license middleware present on all routes
  - Verify structured logging in all operations
  - Verify no secrets in code

**Checkpoint**: Implementation complete, documented, and validated. Ready for Stage 10 (License Engine).

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Database) BLOCKS all downstream
    ↓
Phase 3 (Domain) BLOCKS Phase 4-7
    │
    ├→ Phase 4 (Middleware)
    │   ↓
    ├→ Phase 5 (Read Endpoints)
    │   ↓
    ├→ Phase 6 (Write Endpoints)
    │   ↓
    └→ Phase 7 (Delete Endpoint)
    ↓
Phase 8 (Logging) [parallel with 5-7]
    ↓
Phase 9 (Rate Limiting) [parallel with 8]
    ↓
Phase 10 (Integration Tests) [parallel with 8-9]
    ↓
Phase 11 (Unit Tests) [parallel with 10]
    ↓
Phase 12 (Contract Tests) [parallel with 11]
    ↓
Phase 13 (Load Tests) [parallel with 12]
    ↓
Phase 14 (Documentation & Finalization)
```

### User Story / Component View

While this stage doesn't use traditional user stories, it can be viewed as **ONE cohesive platform feature**:

- **Core Feature: Product Management**
  - Components: Database, Services, API Endpoints, Audit Logging, Rate Limiting
  - Independent Test: Create product → Verify version/audit → Update product → Verify version increments → Query audit logs → Delete (with constraints)
  - MVP Scope: All Phase 1-7 tasks (CRUD + audit + rate limiting)

### Parallel Opportunities

1. **Phase 1 Setup** (T001-T007):
   - T002, T003, T004, T006, T007 marked [P] can run in parallel
   - Only dependency: T001 (Module enum) must complete before T003, T024, T025

2. **Phase 2 Database** (T008-T012):
   - Must run sequentially (single migration file)

3. **Phase 3 Domain Services** (T013-T027):
   - T016-T018 marked [P] can run in parallel (getProductById, getProductBySlug, listProducts)
   - T021-T027 marked [P] can run in parallel
   - Main blocking: T013-T015 must complete before Phase 4-7

4. **Phase 5-6 Endpoints** (T033-T038):
   - T034-T035 marked [P] can run in parallel with other phases
   - Same middleware, different endpoints
   - Can implement simultaneously by different developers

5. **Phase 8-9** (T040-T051):
   - T040, T041, T042, T043 marked [P] can run in parallel
   - Rate limiting (T045-T051) can start after middleware ready

6. **Phase 10-11-12** (T052-T067):
   - All three can run in parallel after Phase 7 complete
   - Integration tests (T052-T060)
   - Unit tests (T061-T065)
   - Contract tests (T066-T067)

7. **Phase 13** (T068-T071):
   - Can run in parallel; all tests independent

### Recommended Sequential MVP (1 person, ~4 weeks)

```
Week 1:
  T001-T007 (Setup)
  T008-T012 (Database)
  T013-T020 (Domain: Main services)

Week 2:
  T021-T027 (Domain: Validations)
  T028-T032 (Middleware)
  T033-T038 (Endpoints)

Week 3:
  T039 (Delete)
  T040-T043 (Logging)
  T044-T051 (Rate limiting)
  T052-T060 (Integration tests)

Week 4:
  T061-T065 (Unit tests)
  T066-T067 (Contract tests)
  T072-T079 (Documentation & finalization)
```

### Recommended Parallel MVP (2-3 people)

**Person A (Backend Implementation)**:

- T001-T020 (Setup + Database + Core services)
- T021-T032 (Validations + Middleware)

**Person B (API & Features)**:

- T033-T051 (Endpoints + Logging + Rate limiting)

**Person C (Testing & Docs)** (can start Week 2):

- T052-T067 (Integration + Contract tests)
- T061-T065 (Unit tests, can start after Week 1)
- T068-T079 (Load tests + Documentation)

---

## Implementation Checklist

### Pre-Implementation

- [ ] Review [STAGE_09_PRODUCTS.md](../../phases/02_PLATFORM_MMC/STAGE_09_PRODUCTS.md) specification thoroughly
- [ ] Review [PLAN_REPORT.md](reports/PLAN_REPORT.md) for detailed architecture
- [ ] Review [ANALYZE_REPORT.md](reports/ANALYZE_REPORT.md) for compliance verification
- [ ] Ensure Phase 1 Setup complete before starting Phase 2+
- [ ] All team members familiar with transaction atomicity requirements

### During Implementation

- [ ] Verify each task produces passing tests
- [ ] Verify no architectural drift (run validate-hard-mode.js frequently)
- [ ] Verify all operations produce structured logs with correlationId
- [ ] Verify rate limiting applied to all endpoints
- [ ] Verify no cross-tenant data access in domain services

### Post-Implementation (Phase 14)

- [ ] All tests pass (unit + integration + contract)
- [ ] Code coverage > 80%
- [ ] Linting passes (ESLint)
- [ ] Type checking passes (TypeScript strict mode)
- [ ] Load tests confirm performance under concurrency
- [ ] Documentation complete and reviewed
- [ ] Architecture validation script confirms no drift
- [ ] Stage locked as PRODUCTION_READY
- [ ] Ready for Stage 10 (License Engine) implementation

---

## Success Criteria

**Stage 09 is complete when:**

- ✅ All 6 API endpoints operational (POST, GET, PUT, PATCH, DELETE, audit-log)
- ✅ Product CRUD works end-to-end
- ✅ Version immutability verified (customer cannot see retroactive module removals)
- ✅ Audit trail complete (every change logged, immutable)
- ✅ Slug uniqueness enforced at DB and API levels
- ✅ Module enum validation working on all operations
- ✅ Status transitions (ACTIVE ↔ INACTIVE) work correctly
- ✅ Delete operation rejects products with existing licenses (409)
- ✅ Rate limiting enforced on all endpoints
- ✅ Structured logging on all operations with correlationId
- ✅ All 13 error codes tested and working
- ✅ Concurrent updates safe (no lost updates, version consistency)
- ✅ Integration tests pass (all critical paths)
- ✅ Unit tests pass (business logic verified)
- ✅ Contract tests pass (OpenAPI compliance)
- ✅ No architectural drift detected
- ✅ Documentation complete
- ✅ Ready for Stage 10 (License Engine which will reference product_id and product_version)

---

## Testing Strategy

### Test Coverage Goals

- **Unit Tests**: 80%+ coverage of productService.ts and validation functions
- **Integration Tests**: All 6 endpoints tested with happy paths + error paths
- **Contract Tests**: OpenAPI spec validation
- **Load Tests**: Concurrent operations with 10+ simultaneous requests

### Critical Paths to Test

1. **Version Immutability**: Update product → verify new version created → verify old version unmodified
2. **Audit Trail**: Every CRUD operation → verify audit log entry created → verify immutable
3. **Slug Uniqueness**: Create product with slug → attempt duplicate → verify 409
4. **Status Change**: Change status → verify version NOT incremented → verify audit logged as STATUS_CHANGE
5. **Delete Constraint**: Attempt delete product with licenses → verify 409 with PRODUCT_HAS_LICENSES
6. **Concurrency**: 10+ updates to same product → verify all versions created correctly, no lost updates

### Test Execution Order

1. Unit tests first (validate individual functions)
2. Integration tests next (validate API contracts)
3. Contract tests next (validate OpenAPI compliance)
4. Load tests last (validate performance/concurrency)

---

## Notes & Warnings

⚠️ **IMMUTABILITY CRITICAL**: The product versioning model depends on product_versions table being append-only. Any migration or code that modifies existing version records breaks commercial trust. Verify in code review.

⚠️ **AUDIT TRAIL CRITICAL**: The product_audit_logs table must be append-only. Verify no UPDATE/DELETE queries on this table.

⚠️ **ATOMIC TRANSACTIONS**: CreateProduct, UpdateProduct, DeleteProduct must all be atomic (all-or-nothing). If any part fails, entire transaction rolls back. Verify in transaction tests.

⚠️ **LICENSE MIDDLEWARE**: All 6 endpoints require licenseMiddleware BEFORE route handler. Missing this is architectural failure. Verify in every endpoint.

⚠️ **RATE LIMITING**: All 6 endpoints must have rate limiting configured. No endpoint should accept > 100 req/min per user. Missing this is operational risk.

⚠️ **SOFT DELETE NOT ALLOWED**: Products must use hard delete with 409 Conflict when licenses exist. No soft delete flag or deleted_at column.

⚠️ **SLUG IMMUTABLE**: Slug cannot be changed after creation. API must reject PUT requests that attempt to modify slug. Test this explicitly.

⚠️ **VERSION ISOLATION**: When product is updated, existing licenses remain pinned to old version. New licenses at creation get new version. This prevents retroactive breakage of existing customer setups.

---

## Git Workflow

1. Feature branch: `feature/stage-09-products`
2. Commit per major component: `feat(products): database schema`, `feat(products): domain services`, etc.
3. PR review checklist:
   - Architecture validation passed
   - Tests all pass (unit + integration + contract)
   - No drift detected
   - Logging structured and correlationId present
   - Rate limiting configured

---

## References

- **Stage Spec**: [STAGE_09_PRODUCTS.md](../../phases/02_PLATFORM_MMC/STAGE_09_PRODUCTS.md)
- **ADR-0001**: Database-per-tenant model
- **ADR-0006**: Server-authoritative time
- **ADR-0007**: Version compatibility
- **ADR-0008**: Semantic versioning
- **Constitution**: [PROJECT_CONTEXT_PRIMER.md](../../../docs/PROJECT_CONTEXT_PRIMER.md)
