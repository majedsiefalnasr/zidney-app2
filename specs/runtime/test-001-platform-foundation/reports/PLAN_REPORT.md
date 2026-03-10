# Plan Report — STAGE_TEST_01_PLATFORM_FOUNDATION

**Step:** 3 — Plan  
**Timestamp:** 2026-02-26T00:00:00Z  
**Status:** COMPLETE

---

## Summary

Comprehensive technical test implementation plan generated for 31 atomic test scenarios across 8
architectural validation areas. Plan establishes infrastructure design, data model, test
architecture, execution phases, and comprehensive success criteria.

**Artifacts Generated**:

- plan.md (1,247 lines) — detailed test execution strategy
- research.md (811 lines) — infrastructure investigation & decisions
- data-model.md (629 lines) — test fixture patterns & seeding
- contracts/api-responses.md (456 lines) — RFC 7807 response contracts

**Total Planning Documentation**: 3,143 lines

---

## Design Decisions

| #   | Decision                                                            | Rationale                                                     |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Test Framework: Vitest + Hono                                       | Leverage existing project infrastructure; no new dependencies |
| 2   | Data Seeding: Hybrid SQL + ORM                                      | SQL for complex scenarios; ORM factories for fixtures         |
| 3   | Database Isolation: Mock + Real Tiers                               | Mock for unit tests (fast), real for integration (accuracy)   |
| 4   | Test Organization: Phase-based (Unit → Integration → Static → Perf) | Clear separation of concerns; executability in order          |
| 5   | API Contract Format: RFC 7807                                       | Standards-compliant error responses; production-ready         |
| 6   | Performance Measurement: Direct middleware timing                   | Accurately measure overhead without synthetic harness         |

---

## Test Architecture Overview

### File Organization

```
tests/validation/
├── unit/                                    (20 tests, ~15 min runtime)
│   ├── 01-tenant-isolation.test.ts
│   ├── 03-license-engine.test.ts
│   └── 05-rate-limiting.test.ts
│
├── integration/                             (8 tests, ~30 min runtime)
│   ├── 01-tenant-isolation.test.ts
│   ├── 02-provisioning.test.ts
│   ├── 06-observability.test.ts
│   └── 07-attempt-engine.test.ts
│
├── static/                                  (3 tests, ~5 min runtime)
│   └── 04-migration-discipline.test.ts
│
├── performance/
│   └── 08-performance-baseline.test.ts     (depends on load tool; ~15 min)
│
├── fixtures/                                (data factories)
│   ├── workspace.fixtures.ts
│   ├── license.fixtures.ts
│   ├── attempt.fixtures.ts
│   └── ...
│
└── support/                                 (test utilities)
    ├── database-isolation.ts
    ├── mock-lock-provider.ts
    ├── performance-metric-collector.ts
    └── api-contract-validator.ts
```

### Execution Phases

**Phase A — Unit Tests** (16 tests, ~15 min)

- Mock database and services
- Fast feedback loop for logic validation
- No external dependencies

**Phase B — Integration Tests** (12 tests, ~30 min)

- Real databases (Tenant A, Tenant B, Master)
- Real connection pools (with tenant resolver)
- Real distributed lock service (or mock)
- Validates end-to-end request handling

**Phase C — Static Validation** (3 tests, ~5 min)

- Migration file scanning
- Schema version tracking
- No runtime environment needed

**Phase D — Performance Baseline** (3 tests, ~15 min)

- Middleware overhead measurement
- License query latency
- Distributed lock resolution time
- Load generator (k6 or Artillery)

### Test Distribution

| Area                | Unit   | Integration | Static | Perf  | Total  |
| ------------------- | ------ | ----------- | ------ | ----- | ------ |
| 1. Tenant Isolation | 4      | 4           | —      | —     | 4      |
| 2. Provisioning     | —      | 3           | —      | —     | 3      |
| 3. License Engine   | 9      | —           | —      | —     | 9      |
| 4. Migrations       | —      | —           | 3      | —     | 3      |
| 5. Rate Limiting    | 4      | —           | —      | —     | 4      |
| 6. Observability    | —      | 2           | —      | —     | 2      |
| 7. Attempt Engine   | —      | 3           | —      | —     | 3      |
| 8. Performance      | —      | —           | —      | 3     | 3      |
| **TOTAL**           | **20** | **12**      | **3**  | **3** | **31** |

---

## Test Data Model

### Core Entities

**Workspace**: Container for institution data

- Master DB entries: workspace_id, workspace_slug, tier_level
- Tenant DB: per-workspace isolated schema

**License**: Digital permission/quota

- States: ACTIVE, SOFT_LOCKED, ARCHIVED
- Enforced transitions; invalid transitions rejected (409)

**User**: Authentication principal

- Types: teacher, admin
- Roles assigned per workspace

**Student**: Enrollment entity

- Linked to workspace + exam
- Submission records stored in tenant DB

**Attempt**: Exam attempt snapshot

- Immutable once started
- Snapshot: questions, config, grading rules at T0
- Worker finalizes (not API)

**Submission**: Answer submission

- Linked to attempt
- Idempotent submission (same submission_id = no-op on retry)

**QuestionSnapshot**: Immutable question record

- Captured at attempt start
- Prevents live exam config changes during exam

**SchemaVersion**: Migration tracking

- hash: immutable (prevents rollback without snapshot restore)
- version: incremented per migration
- Forward-only constraint enforced

### Seeding Patterns

**Isolated Setup (per test)**:

```typescript
// Each test creates fresh entities
const workspace = await createTestWorkspace();
const license = await createTestLicense(workspace);
const user = await createTestUser(workspace);
const student = await createTestStudent(workspace);
// Cleanup after test
afterEach(() => cleanup(workspace));
```

**Factory Pattern**:

```typescript
// Async factories for complex setups
const workspaceFactory = new WorkspaceFactory();
const workspace = await workspaceFactory.create({
  slug: "test-ws-1",
  tier: "PROFESSIONAL",
  studentLimit: 1000,
});
```

---

## API Response Contracts

### RFC 7807 Error Format

All errors follow RFC 7807 (JSON Problem Details):

```json
{
  "type": "https://api.zidney.local/docs/errors#TENANT_ISOLATION_VIOLATION",
  "title": "Cross-Tenant Access Forbidden",
  "status": 403,
  "detail": "User from workspace-a cannot access workspace-b",
  "instance": "/api/workspaces/workspace-b/students",
  "correlationId": "req-f8a7-4d12-b562-1c2a9e8b3f01"
}
```

### HTTP Error Codes Validated

| Code | Scenario                                                                             | Test               |
| ---- | ------------------------------------------------------------------------------------ | ------------------ |
| 400  | Bad request (invalid input)                                                          | 5.1a               |
| 401  | Unauthorized (no JWT)                                                                | 1.1                |
| 403  | Forbidden (cross-tenant)                                                             | 1.1, 1.2, 1.3, 1.4 |
| 404  | Not found (workspace doesn't exist)                                                  | 1.4                |
| 409  | Conflict (provisional state: soft-locked, limits exceeded, provisioning in progress) | 2.2, 3.1c, 3.3     |
| 426  | Upgrade Required (schema version mismatch)                                           | 3.2                |
| 429  | Too Many Requests (rate limit exceeded)                                              | 5.1                |
| 500  | Server Error (unhandled exception)                                                   | 1.3                |

### Rate Limit Headers

All rate-limited endpoints return:

```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1708978234
```

---

## Critical Path & Success Criteria

### Tests That Block Promotion

**5 critical-path test groups** must pass:

1. **Tests 1.1–1.4** (Tenant Isolation) — FOUNDATIONAL
   - Cross-tenant access MUST be rejected (403)
   - No data leakage possible

2. **Test 2.2** (Concurrent Provisioning) — RACE CONDITION SAFETY
   - Second request MUST fail with 409 at lock layer
   - Prevents partial state updates

3. **Tests 3.1d–e** (Invalid License Transitions) — STATE MACHINE INTEGRITY
   - Cannot transition to undefined states (409)
   - State machine is law

4. **Test 7.2** (Worker-Only Grading) — EXAM INTEGRITY
   - API CANNOT modify grades (403 for grading endpoint attempting write)
   - Worker has exclusive authority

5. **Test 7.3** (Server-Authoritative Time) — DEADLINE SAFETY
   - Client time is NEVER trusted
   - Server time determines all TTL/deadline calculations

**If ANY critical-path test fails → Stage CANNOT be promoted.**

---

## Implementation Timeline

**Sequential Estimate**: 65 minutes (all tests one-by-one)  
**Parallel CI/CD**: 35 minutes (phase-based parallelization)

| Phase                 | Days             | Tests  | Estimated Hours |
| --------------------- | ---------------- | ------ | --------------- |
| Phase A (Unit)        | Week 1 (Mon–Tue) | 20     | 8–10            |
| Phase B (Integration) | Week 2 (Wed–Thu) | 12     | 12–15           |
| Phase C (Static)      | Week 2 (Fri)     | 3      | 2–3             |
| Phase D (Performance) | Week 3 (Mon–Tue) | 3      | 5–8             |
| **Total**             | **3 weeks**      | **31** | **27–36**       |

---

## Infrastructure Requirements

### Database Setup

- PostgreSQL instance (single, multi-schema per tenant)
- Master DB: workspaces, licenses, users
- Tenant DBs: students, exams, attempts, submissions
- Pool manager: in-memory map of connection pools per tenant

### Redis Setup (for rate limiting)

- In-memory or real Redis instance
- Sliding window rate limit counters
- TTL-based cleanup

### Distributed Lock Service

- Real (Postgres advisory locks) OR
- Mock (InMemoryLockProvider with Vitest mocks)

### Performance Testing Tools

- k6 or Artillery for load generation
- Resource monitoring (CPU, memory)
- Network call tracing

---

## Success Metrics

| Metric                 | Target                  | Status                     |
| ---------------------- | ----------------------- | -------------------------- |
| All 31 tests passing   | 100%                    | TBD (Implementation phase) |
| Middleware overhead    | ≤10ms per request       | TBD                        |
| License query latency  | ≤50ms (p95)             | TBD                        |
| Lock resolution time   | ≤100ms (p95)            | TBD                        |
| Documentation coverage | ≥95% of test scenarios  | ✅ PLANNED                 |
| Code coverage          | ≥80% of validation code | TBD                        |

---

## Risks & Mitigations

| Risk                                  | Impact               | Mitigation                                      |
| ------------------------------------- | -------------------- | ----------------------------------------------- |
| Real database setup slow in CI/CD     | Blocks fast feedback | Pre-warm database images; parallelize setup     |
| Performance baselines hard to measure | Can't validate SLOs  | Use direct timing instrumentation in middleware |
| Concurrency tests timing-dependent    | Flaky results        | Use deterministic locks (mock or advisory)      |
| Test data cleanup incomplete          | Cross-test pollution | Explicit per-test factories + afterEach cleanup |

---

## Next Step

Proceed to **Step 4 — Tasks** to break plan into atomic, executable, dependency-ordered task list.
