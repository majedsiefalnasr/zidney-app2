Zidney Strict Tasks Template (Execution Discipline)

Before generating tasks, validate:

- Plan complied with Zidney Constitution v1.2.0
- No architectural violations exist
- Stage scope is respected

If not compliant → STOP and explain conflict.

---

## Stage Context

Specify:

- Phase: 1 – Platform Foundation
- Stage: STAGE_02_MULTI_TENANCY_ARCHITECTURE
- Related Plan: specs/runtime/002-multi-tenancy-architecture/plan.md
- Related Spec: specs/runtime/002-multi-tenancy-architecture/spec.md
- Related ADR: ADR-0001-database-per-tenant.md, ADR-0007-product-version-compatibility.md

Tasks must not extend beyond this stage.

---

## Task Categorization (Mandatory Structure)

Tasks must be grouped into:

Infrastructure Tasks

- Migration files
- Schema updates
- Version bumping
- Config updates

API Tasks

- Route creation
- Middleware wiring
- Validation schema
- Transaction wrapping
- Error handling
- Rate limiting configuration

Worker Tasks (if applicable)

- Queue definition
- Idempotency enforcement
- Transaction handling
- Retry & DLQ setup
- Logging instrumentation

Frontend Tasks (if applicable)

- API consumption
- State management
- UI wiring (shadcn-vue + Tailwind v4)
- No business logic

Observability Tasks

- Structured logging
- Correlation ID propagation
- Metrics emission
- Error mapping

Testing Tasks

- Unit tests
- Integration tests
- Isolation tests
- Idempotency tests
- Concurrency tests (if runtime)
- Version mismatch tests

---

## Implementation Strategy

MVP First: Complete tenant resolver middleware with basic enforcement.

Incremental Delivery: Add connection pooling, then version checks, then error handling.

Parallel Opportunities: Infrastructure and API tasks can be parallel after setup.

Dependency Order: Infrastructure → API → Observability → Testing

---

## Phase 1: Setup Tasks

- [x] T001 Create migration file for tenants_registry table in apps/api/src/db/master/migrations/
- [x] T002 Update schema_version in master DB after migration
- [x] T003 Add PLATFORM_PRODUCT_VERSION environment variable to API config
- [x] T003A Create master registry repository in
      apps/api/src/repositories/master/tenant-registry.repository.ts

---

## Phase 2: Foundational Tasks (Blocking Prerequisites)

- [x] T004 [P] Implement tenant slug extraction from subdomain or path in
      apps/api/src/middleware/tenant-resolver.ts
- [x] T004A Ensure correlation ID middleware executes before tenant resolver in apps/api/src/app.ts
- [x] T005 [P] Add registry caching with TTL=60s, key=workspace_slug, no manual invalidation in
      apps/api/src/middleware/tenant-resolver.ts
- [x] T006 [P] Implement lazy connection pool creation in apps/api/src/middleware/tenant-resolver.ts
- [x] T006A Create tenant pool manager module in apps/api/src/db/tenant/pool-manager.ts
- [x] T007 Wire tenant resolver middleware globally for /api/workspace/\* routes in
      apps/api/src/app.ts

---

## Phase 3: Core Implementation

- [x] T008 Implement license status enforcement in apps/api/src/middleware/tenant-resolver.ts
- [x] T009 Implement schema version compatibility check in
      apps/api/src/middleware/tenant-resolver.ts
- [x] T010 Implement product version compatibility check using semver in
      apps/api/src/middleware/tenant-resolver.ts
- [x] T011 Add connection pool guardrails (max 10 per pool) in
      apps/api/src/middleware/tenant-resolver.ts
- [x] T012 Implement error response formatting with workspace and request_id in
      apps/api/src/middleware/tenant-resolver.ts
- [x] T013 Add structured logging with workspace_slug and correlation_id in
      apps/api/src/middleware/tenant-resolver.ts

---

## Phase 4: Error Handling & Recovery

- [x] T014 Map 404 for tenant not found in apps/api/src/middleware/tenant-resolver.ts
- [x] T015 Map 403 for archived license in apps/api/src/middleware/tenant-resolver.ts
- [x] T016 Map 423 for soft locked license in apps/api/src/middleware/tenant-resolver.ts
- [x] T017 Map 426 for version mismatch in apps/api/src/middleware/tenant-resolver.ts
- [x] T018 Map 503 for DB unavailable in apps/api/src/middleware/tenant-resolver.ts

---

## Phase 5: Testing & Validation

- [x] T019 [P] Add unit tests for slug extraction in
      apps/api/src/middleware/**tests**/tenant-resolver.test.ts
- [x] T020 [P] Add unit tests for license enforcement in
      apps/api/src/middleware/**tests**/tenant-resolver.test.ts
- [x] T021 [P] Add unit tests for version checks in
      apps/api/src/middleware/**tests**/tenant-resolver.test.ts
- [x] T022 [P] Add integration test for resolver middleware in
      apps/api/tests/integration/tenant-resolver.test.ts
- [x] T023 [P] Add isolation test to verify no cross-tenant access in
      apps/api/tests/integration/isolation.test.ts
- [x] T024 [P] Add version mismatch test in apps/api/tests/integration/version-compatibility.test.ts

---

## Dependencies

Story Completion Order:

- Setup tasks must complete before any implementation
- Foundational tasks enable core implementation
- Core implementation enables error handling
- All implementation enables testing

Parallel Execution Examples:

- T004, T005, T006 can be implemented in parallel
- T019-T024 can be implemented in parallel after core tasks

---

## Task Details

### Infrastructure Tasks

- **T001**: Create migration file for tenants_registry table
  - Layer: Infrastructure
  - Transactional: No (migration)
  - Idempotent: Yes (migration framework)
  - Middleware: N/A
  - Version enforcement: Updates schema_version

- **T002**: Update schema_version in master DB
  - Layer: Infrastructure
  - Transactional: Yes
  - Idempotent: Yes
  - Middleware: N/A
  - Version enforcement: N/A

- **T003**: Add environment variable
  - Layer: Infrastructure
  - Transactional: N/A
  - Idempotent: N/A
  - Middleware: N/A
  - Version enforcement: N/A

- **T003A**: Create master registry repository
  - Layer: API
  - Transactional: No
  - Idempotent: N/A
  - Middleware: N/A
  - Version enforcement: No

### API Tasks

- **T004**: Implement slug extraction
  - Layer: API
  - Transactional: No
  - Idempotent: N/A
  - Middleware: Tenant resolver
  - Version enforcement: No

- **T004A**: Ensure correlation ID middleware ordering
  - Layer: API
  - Transactional: No
  - Idempotent: N/A
  - Middleware: Global wiring
  - Version enforcement: No

- **T005**: Add registry caching with TTL=60s, key=workspace_slug, no manual invalidation
  - Layer: API
  - Transactional: No
  - Idempotent: N/A
  - Middleware: Tenant resolver
  - Version enforcement: No

- **T006**: Implement pool creation
  - Layer: API
  - Transactional: No
  - Idempotent: N/A
  - Middleware: Tenant resolver
  - Version enforcement: No

- **T006A**: Create tenant pool manager module
  - Layer: API
  - Transactional: No
  - Idempotent: N/A
  - Middleware: N/A
  - Version enforcement: No

- **T007**: Wire middleware
  - Layer: API
  - Transactional: No
  - Idempotent: N/A
  - Middleware: Global wiring
  - Version enforcement: No

- **T008**: License enforcement
  - Layer: API
  - Transactional: No
  - Idempotent: N/A
  - Middleware: Tenant resolver
  - Version enforcement: No

- **T009**: Schema version check
  - Layer: API
  - Transactional: No
  - Idempotent: N/A
  - Middleware: Tenant resolver
  - Version enforcement: Yes

- **T010**: Product version check
  - Layer: API
  - Transactional: No
  - Idempotent: N/A
  - Middleware: Tenant resolver
  - Version enforcement: Yes

- **T011**: Pool guardrails
  - Layer: API
  - Transactional: No
  - Idempotent: N/A
  - Middleware: Tenant resolver
  - Version enforcement: No

- **T012**: Error formatting
  - Layer: API
  - Transactional: No
  - Idempotent: N/A
  - Middleware: Tenant resolver
  - Version enforcement: No

- **T013**: Structured logging
  - Layer: API
  - Transactional: No
  - Idempotent: N/A
  - Middleware: Tenant resolver
  - Version enforcement: No

- **T014-T018**: Error mappings
  - Layer: API
  - Transactional: No
  - Idempotent: N/A
  - Middleware: Tenant resolver
  - Version enforcement: No

### Testing Tasks

- **T019-T024**: Various tests
  - Layer: Testing
  - Transactional: As needed for test
  - Idempotent: N/A
  - Middleware: N/A
  - Version enforcement: Tested

---

## Non-Goals Confirmation

Tasks must not:

- Introduce new architecture
- Bypass middleware
- Touch unrelated layers
- Modify unrelated stages

If needed → new Stage required.

---

## Completion Checklist

Before finishing tasks, verify:

- All write paths transactional
- All critical endpoints idempotent
- Isolation preserved
- Version enforcement active
- Logging structured
- No business logic in frontend
- No grading in API
- No direct DB instantiation

---

## Final Compliance Statement

Task set compliant with Zidney Constitution v1.2.0 — No violations detected.
