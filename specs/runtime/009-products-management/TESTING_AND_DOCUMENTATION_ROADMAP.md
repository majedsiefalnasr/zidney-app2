# Products Management - Testing & Documentation Roadmap

**Stage:** STAGE_09_PRODUCTS  
**Phase:** 02_PLATFORM_MMC  
**Completion Status:** 51/79 tasks (64% complete)

---

## Phase 10: Integration Tests (T052-T060)

Required tests for complete API coverage.

### Product CRUD Tests

**T052: Product Creation Test** (tests/integration/products/test_create.ts)

- Valid product creation returns 201 with ProductResponse
- Version set to 1, current_version = 1
- Version 1 record created in product_versions
- Audit log entry created with action=CREATE
- Duplicate slug returns 409

**T053: Product Listing Test** (tests/integration/products/test_list.ts)

- GET /products returns ACTIVE products only by default
- ?status=INACTIVE returns inactive products only
- ?status=all returns both active and inactive
- Pagination works (limit/offset)
- Search by name (en/ar) works
- Results sorted by created_at DESC

**T054: Product Get Test** (tests/integration/products/test_get.ts)

- GET /products/:id returns single product
- Invalid product_id returns 404

**T055: Product Update Test** (tests/integration/products/test_update.ts)

- Valid update returns 200 with updated ProductResponse
- current_version incremented
- New version record created in product_versions
- Audit log entry created with action=UPDATE
- No update (same data) returns 200 without version increment
- Cannot update slug (immutable)

**T056: Status Change Test** (tests/integration/products/test_status_change.ts)

- Change ACTIVE → INACTIVE succeeds, returns 200
- Change INACTIVE → ACTIVE succeeds, returns 200
- Status change does NOT increment current_version
- Audit log created with action=STATUS_CHANGE (no version numbers)
- Version field immutable (not included in PATCH request)

**T057: Product Deletion Test** (tests/integration/products/test_delete.ts)

- DELETE product without licenses succeeds, returns 204
- DELETE product with licenses fails, returns 409
- Product not found returns 404

### Audit Log Tests

**T058: Audit Log Query Test** (tests/integration/products/test_audit_log.ts)

- GET /products/:id/audit-log returns paginated audit entries
- Filtering by action works (CREATE, UPDATE, STATUS_CHANGE)
- Date range filtering works (from_date, to_date)
- Results sorted by timestamp DESC
- Unauthorized access returns 401
- Without AUDIT_READ permission returns 403

### Transaction Atomicity Tests

**T059: Transaction Rollback Test** (tests/integration/products/test_transactions.ts)

- If any part of createProduct fails, entire transaction rolls back
- If any part of updateProduct fails, no version increment
- Product remains in consistent state after failed operation
- Audit log not created if operation rolls back

### Error Handling Tests

**T060: Error Response Test** (tests/integration/products/test_errors.ts)

- DUPLICATE_SLUG returns 409 with proper error response
- INVALID_MODULE_ENUM returns 400 with proper error response
- INVALID_NAME_LOCALIZATION returns 400 with proper error response
- PRODUCT_NOT_FOUND returns 404 with proper error response
- UNAUTHORIZED returns 401 with proper error response
- FORBIDDEN returns 403 with proper error response
- WORKSPACE_LOCKED returns 423 with proper error response
- All errors follow {success, data, error} format

---

## Phase 11: Unit Tests (T061-T065)

Tests for individual functions and edge cases.

**T061: Service Validation Tests** (tests/unit/products/test_service_validation.ts)

- validateProductName() accepts valid names, rejects invalid
- validateModulesEnum() accepts valid modules, rejects invalid
- validateSlug() accepts valid slugs, rejects invalid
- validateSlugUniqueness() detects duplicates

**T062: Service Logic Tests** (tests/unit/products/test_service_logic.ts)

- createProduct() increments current_version correctly
- updateProduct() detects structural changes
- updateProduct() avoids version bump for no changes
- changeProductStatus() preserves current_version
- getProductName() fallsback correctly (ar → en)

**T063: Service Edge Cases** (tests/unit/products/test_service_edge_cases.ts)

- Null/undefined handling in name, description
- Empty module list rejected
- Single character slug supported
- Very long names/descriptions handled
- Special characters in names handled

**T064: Module Enum Tests** (tests/unit/types/test_module_enum.ts)

- All six modules defined
- isValidModule() validates correctly
- getModuleLabel() returns correct labels (en/ar)

**T065: Product Type Tests** (tests/unit/types/test_product_types.ts)

- Product interface complete
- AuditLogEntry interface complete
- ApiResponse interface flexible for different data types

---

## Phase 12: Contract/Specification Tests (T066-T067)

API compliance with OpenAPI specification.

**T066: OpenAPI Specification** (docs/api/products-management-api-spec.yaml)

- 6 endpoints fully documented (POST, GET, PUT, PATCH, DELETE)
- Request/response schemas
- Authentication (JWT + scopes)
- Error responses (all 13 codes)
- Rate limiting headers
- Example payloads

**T067: Contract Tests** (tests/contract/products/test_contract.ts)

- POST /products response matches OpenAPI schema
- GET /products response matches OpenAPI schema
- GET /products/:id response matches OpenAPI schema
- PUT /products/:id response matches OpenAPI schema
- PATCH /products/:id/status response matches OpenAPI schema
- DELETE /products/:id response (204) matches spec
- GET /audit-log response matches OpenAPI schema
- All error responses match error schema in spec

---

## Phase 13: Performance & Concurrency Tests (T068-T071)

Verify performance under load and concurrent access.

**T068: Concurrent Update Test** (tests/load/products/test_concurrent_updates.ts)

- 10+ concurrent updates to same product
- Version increments are consistent (no lost updates)
- Each update creates new version record
- No duplicate version numbers for same product
- Audit logs for all concurrent updates preserved

**T069: Slug Uniqueness Concurrency Test** (tests/load/products/test_slug_concurrency.ts)

- 10+ concurrent product creations with same slug
- Only one succeeds (409 for duplicates)
- No phantom reads

**T070: List Performance Test** (tests/load/products/test_list_performance.ts)

- Listing 1000+ products completes within 1 second
- Pagination works correctly at scale
- Search performance acceptable (< 500ms)
- Indexes used effectively

**T071: Audit Log Query Performance Test** (tests/load/products/test_audit_performance.ts)

- Querying 10000+ audit log entries completes within 1 second
- Filtering and pagination work at scale
- Timestamp index effective

---

## Phase 14: Documentation & Finalization (T072-T079)

Final documentation and validation.

**T072: API Documentation** (docs/API_PRODUCTS_MANAGEMENT.md)

- Endpoint reference (all 6 operations)
- Request/response examples
- Error handling guide
- Rate limiting details
- Authentication/authorization model
- Code examples (curl, client lib)

**T073: Implementation Guide** (docs/IMPLEMENTATION_PRODUCTS.md)

- Architecture overview (API → Domain → DB)
- File structure (packages/domain-core, apps/api/src/routes)
- Adding new modules (enum, validation, provisioning)
- Extension points for Stage 10 (License Engine)

**T074: Database README** (apps/api/src/db/master/migrations/README_PRODUCTS.md)

- Schema overview (products, product_versions, product_audit_logs)
- Versioning model explanation
- Immutability guarantees
- Migration strategy

**T075-T077: Quality Checks**

- [T075] Run full test suite to confirm all passes
- [T076] Run linter and type checker on all new code
- [T077] Verify code coverage > 80% for packages/domain-core

**T078: CHANGELOG Entry**

- Product entity added
- 6 API endpoints added
- Version history support
- Audit logging capability

**T079: Architecture Validation**

- Execute validation script: scripts/validate-hard-mode.js
- Verify no cross-tenant access
- Verify license middleware present on all routes
- Verify structured logging in all operations
- Verify no secrets in code

---

## Next Steps

1. **Phase 10 (T052-T060)**: Create comprehensive integration tests
2. **Phase 11 (T061-T065)**: Create unit tests for validation and services
3. **Phase 12 (T066-T067)**: Generate OpenAPI spec and contract tests
4. **Phase 13 (T068-T071)**: Run load tests and concurrency tests
5. **Phase 14 (T072-T079)**: Finalize documentation and validation

**Estimated Remaining Time:** 3-4 weeks (1-2 people) for full test coverage and documentation

**Key Success Criteria:**

- ✅ All 13 error codes tested and working
- ✅ Version immutability verified under concurrent load
- ✅ Audit trail complete and immutable
- ✅ Rate limiting enforced on all endpoints
- ✅ Integration tests cover all critical paths
- ✅ Code coverage > 80%
- ✅ No architectural drift detected
- ✅ Ready for Stage 10 (License Engine)
