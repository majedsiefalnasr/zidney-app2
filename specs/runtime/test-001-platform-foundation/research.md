# Research Phase: Test Infrastructure Investigation

**Stage**: STAGE_TEST_01_PLATFORM_FOUNDATION  
**Branch**: test-001-platform-foundation  
**Date**: 2026-02-26  
**Phase**: Phase 0 — Research

---

## Overview

This document resolves infrastructure unknowns discovered during technical context analysis for the
31-test validation suite.

---

## R1: Test Framework Selection

### Decision: Vitest + Hono Testing Utilities

**Rationale**:

- Project already uses Vitest (vitest.config.ts exists)
- Hono provides `HonoRequest` testing utilities
- Existing test-helpers.ts demonstrates test context creation pattern
- Supports async/await for database operations
- Native ESM support aligns with Bun runtime

**Alternative Considered**:

- Jest: Heavier footprint, not required for ESM-first project
- Playwright: For E2E browser testing (out of scope for validation tests)

**Implementation**:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestClient, createTestContext } from "../test-helpers";
```

**Conclusion**: Use existing Vitest infrastructure. No new framework needed.

---

## R2: Test Data Seeding Strategy

### Decision: Hybrid Approach (SQL + ORM)

**Rationale**:

- Workspace provisioning happens at database creation level (SQL migrations)
- Test data (students, exams, etc.) managed via Drizzle ORM
- Isolation via `test-workspace-{uuid}` naming pattern
- Each test gets isolated workspace + tenant database

**Seeding Approach**:

```typescript
// Phase 1: Create master workspace record
const workspace = await masterDb
  .insert(workspaces)
  .values({
    id: workspaceId,
    slug: `test-${randomUUID()}`,
    name: "Test Workspace",
    owner_id: adminUserId,
  })
  .returning();

// Phase 2: Trigger provisioning (creates tenant database)
await provisioningService.provision(workspaceId);

// Phase 3: Create test data in tenant DB
const tenantDb = await getTenantPool(workspaceId).getConnection();
const student = await tenantDb
  .insert(students)
  .values({
    id: studentId,
    workspace_id: workspaceId,
    email: `student-${randomUUID()}@test.local`,
    enrollment_id: `ENR-${randomUUID()}`,
  })
  .returning();
```

**Cleanup Strategy**:

- Teardown phase: Drop entire tenant database
- Rationale: Clean isolation, no state pollution between tests

**Conclusion**: Use hybrid SQL + ORM seeding. Aligns with existing test-helpers pattern.

---

## R3: Multi-Database Isolation (Tenant A vs B)

### Decision: Test Pool Manager with Per-Tenant Connection

**Rationale**:

- API already implements tenant-pool.ts mapping
- Each tenant gets isolated PostgreSQL database
- Connection pooling prevents exhaustion
- In-memory test environment uses mock Pool (test-helpers.ts)

**Local Test Setup**:

```typescript
// Docker Compose creates base PostgreSQL
// On test startup:
// 1. Create master_db database
// 2. Create independent tenant databases dynamically:
//    - test_tenant_a_db
//    - test_tenant_b_db
// 3. Pool manager maps workspace:db connections

type TenantPoolManager = Map<workspaceId => PostgreSQL.Pool>

// Test isolation enforced at connection level
const tenantAPool = tenantPoolManager.get('workspace-a')
const tenantBPool = tenantPoolManager.get('workspace-b')
// Attempting cross-tenant query automatically fails (wrong pool)
```

**Performance Consideration**:

- Creating/destroying databases is slow (1-2 seconds per test)
- Solution: Create 2-3 reusable test databases and reset schema between tests
- Or: Use in-memory mock pools for non-integration tests

**Conclusion**: Use test-helpers.ts InMemoryPool for unit tests. Use real PostgreSQL for integration
tests (cached databases).

---

## R4: Mock/Spy Strategy for Distributed Lock Verification

### Decision: Redis Mock + Observation Pattern

**Rationale**:

- Test 2.2 requires verifying lock acquisition/release under concurrency
- Cannot rely on real Redis in unit tests (too slow, flaky)
- Can't mock lock without losing visibility into timing

**Implementation**:

```typescript
// InMemoryRedisClient (in test-helpers.ts) with instrumentation
class InstrumentedRedisClient extends InMemoryRedisClient {
  locks = new Map<string, { acquiredAt: number; owner: string }>();

  async acquireLock(key: string, owner: string, ttl: number) {
    if (this.locks.has(key)) {
      throw new Error(`Lock already held by ${this.locks.get(key)?.owner}`);
    }
    this.locks.set(key, {
      acquiredAt: Date.now(),
      owner,
    });
    // Simulate lock TTL expiry
    setTimeout(() => this.locks.delete(key), ttl * 1000);
  }

  // Observable: Spies can track calls via Vitest mocking
  async releaseLock(key: string) {
    this.locks.delete(key);
  }
}

// In test:
const redisClient = new InstrumentedRedisClient();
const acquireSpy = vi.spyOn(redisClient, "acquireLock");

// Simulate concurrent requests
await Promise.all([provisioning(workspace, redisClient), provisioning(workspace, redisClient)]);

// Verify only one acquisition succeeded
expect(acquireSpy).toHaveBeenCalledTimes(2);
expect(acquireSpy.mock.results[0].value.error).toBe(undefined); // First succeeded
expect(acquireSpy.mock.results[1].value.error).toMatch(/already held/); // Second failed
```

**Real Redis Tests**:

- Integration test suite runs with real Redis
- Separate from unit tests (in tests/integration/ directory)

**Conclusion**: Use InMemoryRedisClient with Vitest spies for unit tests. Maintain separate
integration test suite for real Redis.

---

## R5: Performance Measurement Infrastructure

### Decision: Instrumentation via Middleware Hooks + Timing Utilities

**Rationale**:

- Test 8.1-8.3 require precise latency measurement
- Can't rely on system time alone (GC, OS scheduling)
- Need to isolate middleware overhead from handler overhead

**Implementation**:

```typescript
// Middleware timing wrapper
type TimedMiddleware = {
  name: string;
  duration_ms: number;
  sequence_number: number;
};

// Hook into Hono middleware chain
const timedApp = new Hono();
const timings: TimedMiddleware[] = [];

timedApp.use(async (c, next) => {
  const start = performance.now();
  await next();
  const duration_ms = performance.now() - start;
  timings.push({
    name: "correlationId",
    duration_ms,
    sequence_number: 1,
  });
});

// After request, extract timings
const response = await timedApp.fetch(request);
const correlationId = response.headers.get("X-Correlation-ID");
const requestTimings = extractTimings(correlationId);

// Validate: middleware overhead < 1ms
const middlewareTotal = requestTimings
  .filter((t) => ["correlationId", "tenantResolver", "license", "schema"].includes(t.name))
  .reduce((sum, t) => sum + t.duration_ms, 0);

expect(middlewareTotal).toBeLessThan(1);
```

**Load Testing Tools**:

- Use `k6` or `wrk` for concurrent request testing (vs 1000 sequential)
- Execute load tests separately from unit tests (tests/load/ directory)

**Metrics Collection**:

```typescript
type PerformanceMetrics = {
  min_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  max_ms: number;
  mean_ms: number;
};

function calculateMetrics(timings: number[]): PerformanceMetrics {
  const sorted = timings.sort((a, b) => a - b);
  return {
    min_ms: sorted[0],
    p50_ms: sorted[Math.floor(sorted.length * 0.5)],
    p95_ms: sorted[Math.floor(sorted.length * 0.95)],
    p99_ms: sorted[Math.floor(sorted.length * 0.99)],
    max_ms: sorted[sorted.length - 1],
    mean_ms: timings.reduce((a, b) => a + b, 0) / timings.length,
  };
}
```

**Conclusion**: Instrument Hono middleware with performance.now() timers. Use Vitest metrics
collection. Separate load tests into dedicated suite.

---

## R6: WebSocket Testing for Rate Limiting

### Decision: Simulate WS Submission via HTTP 202 Polling

**Rationale**:

- Test 5.1c covers submission idempotency and rate limiting
- Full WebSocket implementation is Phase 04 (RUNTIME)
- Submission endpoint is HTTP-first in Phase 01 (PLATFORM_FOUNDATION)
- Can test rate limiting without WebSocket infrastructure

**Scope Clarification**:

- Phase 01 does NOT include WebSocket connections
- Submission is HTTP POST endpoint (returns 202 Accepted)
- Grading happens in Worker (asynchronous)
- Rate limiting applies to HTTP submission endpoint

**Implementation for Phase 01**:

```typescript
// Test submission endpoint (HTTP, not WebSocket)
const submission1 = await client.post(`/api/workspaces/w1/attempts/a1/submissions`, {
  questionId: "q1",
  answer: "A",
});
expect(submission1.status).toBe(202); // Accepted, not processed

// Idempotent resubmission (same data)
const submission2 = await client.post(`/api/workspaces/w1/attempts/a1/submissions`, {
  questionId: "q1",
  answer: "A",
});
expect(submission2.status).toBe(202); // Idempotent, accepted again

// Different submission (distinct question)
const submission3 = await client.post(`/api/workspaces/w1/attempts/a1/submissions`, {
  questionId: "q2",
  answer: "B",
});
expect(submission3.status).toBe(202); // New submission, accepted
```

**WebSocket Rate Limiting**:

- Scheduled for Phase 04 (RUNTIME) validation
- Tracks connection count per user
- Limit: 1 WS connection per user per attempt

**Conclusion**: No WebSocket tests in Phase 01. Test HTTP submission endpoint rate limiting only.

---

## R7: API Endpoint Coverage

### Decision: Map Spec Requirements to Existing API Routes

**Rationale**:

- Phase 01 establishes foundational endpoints
- Tests verify existing functionality, not new endpoint development
- Route mapping aligns with middleware test requirements

**Endpoint Mapping**:

| Test    | Endpoint                                           | Method   | Purpose                               |
| ------- | -------------------------------------------------- | -------- | ------------------------------------- |
| 1.1-1.4 | `/api/workspaces/{wsId}/students`                  | GET      | Cross-tenant access rejection         |
| 2.1-2.3 | `/api/internal/provision`                          | POST     | Workspace provisioning                |
| 3.1a-e  | `/api/licenses/{id}`                               | PATCH    | License state transitions             |
| 3.2     | `/api/workspaces/{wsId}/students`                  | GET      | Version enforcement via middleware    |
| 3.3a-c  | `/api/workspaces/{wsId}/students`                  | POST     | Limit enforcement                     |
| 4.1-4.3 | `apps/api/src/db/*/migrations`                     | N/A      | File scanning, not API                |
| 5.1a-c  | `/api/login`, `/api/workspaces/{wsId}/...`         | POST/GET | Rate limit headers/enforcement        |
| 6.1-6.2 | (Any endpoint)                                     | Any      | Log inspection, not endpoint-specific |
| 7.1     | `/api/workspaces/{wsId}/attempts/{id}/submissions` | POST     | Snapshot immutability                 |
| 7.2     | `/api/workspaces/{wsId}/attempts/{id}/submissions` | POST     | Worker-only grading validation        |
| 7.3     | `/api/workspaces/{wsId}/attempts/{id}/submissions` | POST     | Server-authoritative time             |
| 8.1-8.3 | `/api/test/echo` (minimal endpoint)                | GET      | Middleware overhead measurement       |

**Conclusion**: Use existing route structure. No new endpoints needed for validation.

---

## R8: Concurrency Test Infrastructure

### Decision: Promise.all() with Spy Mocks + Timing Verification

**Rationale**:

- Test 2.2 requires simulating 5 concurrent provisioning requests
- Cannot use real concurrency (race conditions are timing-dependent)
- Use Vitest's concurrent test runner capabilities

**Implementation Pattern**:

```typescript
it("should serialize concurrent provisioning via lock", async () => {
  const workspaceId = "ws-concurrent-test";
  const redisClient = new InstrumentedRedisClient();

  // Simulate 5 concurrent provision attempts (within 100ms window)
  const results = await Promise.allSettled([
    provisioning.provision(workspaceId, redisClient),
    provisioning.provision(workspaceId, redisClient),
    provisioning.provision(workspaceId, redisClient),
    provisioning.provision(workspaceId, redisClient),
    provisioning.provision(workspaceId, redisClient),
  ]);

  // Exactly one should succeed
  const successes = results.filter((r) => r.status === "fulfilled" && r.value.success);
  expect(successes.length).toBe(1);

  // Others should fail with lock error
  const failures = results.filter((r) => r.status === "rejected" || !r.value.success);
  expect(failures.length).toBe(4);
  expect(failures.every((f) => f.reason?.message.includes("already in progress"))).toBe(true);
});
```

**Alternative: Test Harness with Controlled Timing**:

```typescript
// If real concurrency needed, use test harness with controllable delays
class ConcurrencyTestHarness {
  private barriers = new Map<string, { waiters: number; release: () => void }>();

  async synchronizeAndRelease(testId: string, count: number) {
    // Wait for exactly N tasks to arrive at barrier before releasing all
    // This avoids timing-dependent race conditions
  }
}
```

**Conclusion**: Use Promise.allSettled() for simple concurrency tests. Use ConcurrencyTestHarness if
precise ordering needed.

---

## R9: Error Contract Validation

### Decision: RFC 7807 Response Schema Mapper

**Rationale**:

- Test 6.2 verifies RFC 7807 error format compliance
- Must validate all error codes (400, 401, 403, 404, 409, 426, 429, 500)
- Can automate validation via schema

**Implementation**:

```typescript
// RFC 7807 response contract
type RFC7807Response = {
  type: string; // URL to error documentation
  title: string; // Short error title
  status: number; // HTTP status code
  detail: string; // Detailed explanation
  instance: string; // Request identifier
  // Optional extension fields
  error_code?: string; // Custom error code
  limit?: number; // For limit errors
  current?: number; // Current value
};

// Validation helper
function validateRFC7807(response: unknown): boolean {
  const required = ["type", "title", "status", "detail", "instance"];
  return required.every((field) => field in response);
}

// In test:
const res = await client.get(`/api/workspaces/invalid/students`);
expect(res.status).toBe(404);
expect(validateRFC7807(res.body)).toBe(true);
expect(res.body.status).toBe(404);
expect(res.body.instance).toMatch(/\/api\/workspaces/);
```

**Error Code Mapping**: | HTTP Status | Error Code | Title | Instance |
|------------|-----------|-------|----------| | 400 | INVALID_INPUT | Validation Error | /endpoint |
| 401 | UNAUTHORIZED | Unauthorized | /endpoint | | 403 | FORBIDDEN | Insufficient Permission |
/endpoint | | 404 | NOT_FOUND | Resource Not Found | /endpoint | | 409 | CONFLICT | State Machine
Violation | /endpoint | | 426 | UPGRADE_REQUIRED | Schema Mismatch | /endpoint | | 429 |
RATE_LIMITED | Too Many Requests | /endpoint | | 500 | INTERNAL_ERROR | Server Error | /endpoint |

**Conclusion**: Create RFC7807 schema validator. Use in all error tests.

---

## R10: Database Schema Assumptions

### Decision: Document Baseline Schema Required from Phase 02

**Rationale**:

- Phase 01 PLATFORM_FOUNDATION establishes foundational tables
- Phase 02 expansion stages add question/exam tables
- Validation tests assume complete Phase 01 schema

**Baseline Schema (Phase 01 Assumption)**:

```sql
-- Master database
CREATE TABLE workspaces (...)
CREATE TABLE licenses (...)
CREATE TABLE subscriptions (...)

-- Tenant database
CREATE TABLE users (...)
CREATE TABLE roles (...)
CREATE TABLE permissions (...)
CREATE TABLE students (...)
CREATE TABLE staff (...)
CREATE TABLE attempts (...)
CREATE TABLE submissions (...)
CREATE TABLE questions_snapshot (...)
CREATE TABLE schema_version (...)
```

**Phase Dependency Chain**:

```
Phase 01: Core tables (users, attempts, etc.)
  ↓
Phase 02: Exam module (exams table, questions table)
  ↓
Phase 03: Grading module (grading_rules table)
  ↓
Phase 04: Runtime (session tables, WebSocket state)
```

**Validation Tests Require**:

- Phase 01 schema: ✅ Assumed complete
- Phase 02 schema: ✅ Assumed complete (needed for attempt/exam tests 7.1-7.3)
- Phase 03, 04: Not required for Phase 01 validation

**Conclusion**: Assume Phase 01 + Phase 02 schema complete. External dependency identified.

---

## R11: Mock vs Real Decision Matrix

### Decision: Tiered Testing Approach

**Rationale**:

- Unit tests: Mocked database, Redis
- Integration tests: Real PostgreSQL, Redis
- Performance tests: Real services
- Each tier validates different concern

**Test Tier Decision**:

| Test    | Tier               | DB             | Redis          | Rationale                                     |
| ------- | ------------------ | -------------- | -------------- | --------------------------------------------- |
| 1.1-1.4 | Unit + Integration | Mock then Real | Mock           | Isolation critical; run both ways             |
| 2.1-2.3 | Integration        | Real           | Mock           | Provisioning needs real DB                    |
| 3.1-3.3 | Unit               | Mock           | Mock           | License logic is pure business logic          |
| 4.1-4.3 | Static             | N/A            | N/A            | File scanning, no execution                   |
| 5.1-5.2 | Unit + Integration | Mock then Real | Mock then Real | Rate limit logic pure; verify with real Redis |
| 6.1-6.2 | Integration        | Real           | Real           | Logging requires live execution               |
| 7.1-7.3 | Integration        | Real           | Real           | Attempt/snapshot needs real attempt records   |
| 8.1-8.3 | Performance        | Real           | Real           | Measure real latency                          |

**File Organization**:

```
tests/
├── unit/
│   ├── 01-tenant-isolation.test.ts     (Tests 1.1-1.4)
│   ├── 03-license-engine.test.ts       (Tests 3.1-3.3)
│   ├── 05-rate-limiting.test.ts        (Tests 5.1-5.2)
├── integration/
│   ├── 01-tenant-isolation.test.ts     (Tests 1.1-1.4 with real DB)
│   ├── 02-provisioning.test.ts         (Tests 2.1-2.3)
│   ├── 06-observability.test.ts        (Tests 6.1-6.2)
│   ├── 07-attempt-engine.test.ts       (Tests 7.1-7.3)
├── static/
│   ├── 04-migration-discipline.test.ts (Tests 4.1-4.3)
└── performance/
    └── 08-performance-baseline.test.ts (Tests 8.1-8.3)
```

**Conclusion**: Use tiered testing. Mocks for logic, real services for integration and performance.

---

## Summary Table

| Research Area      | Decision               | Status              |
| ------------------ | ---------------------- | ------------------- |
| R1: Framework      | Vitest + Hono          | ✅ Confirmed        |
| R2: Seeding        | Hybrid SQL+ORM         | ✅ Confirmed        |
| R3: Multi-DB       | Pool Manager           | ✅ Confirmed        |
| R4: Mock/Spy       | InMemoryRedis + Vitest | ✅ Confirmed        |
| R5: Performance    | Instrumentation + k6   | ✅ Confirmed        |
| R6: WebSocket      | N/A for Phase 01       | ✅ Out of Scope     |
| R7: Endpoints      | Existing routes        | ✅ Confirmed        |
| R8: Concurrency    | Promise.allSettled()   | ✅ Confirmed        |
| R9: Error Contract | RFC 7807 Validator     | ✅ Confirmed        |
| R10: Schema        | Phase 01+02 assumed    | ✅ Dependency noted |
| R11: Mock vs Real  | Tiered approach        | ✅ Confirmed        |

---

## All Clarifications Resolved ✅

- Test framework identified: Vitest (existing)
- Test data strategy: Hybrid SQL + ORM seeding
- Database isolation: Pool Manager with in-memory + real tiers
- Lock mocking: InMemoryRedisClient with Vitest spies
- Performance measurement: performance.now() instrumentation
- WebSocket: Out of scope for Phase 01
- API endpoints: Mapped to existing routes
- Concurrency: Promise.allSettled() pattern
- Error handling: RFC 7807 schema
- Schema assumptions: Phase 01+02 required
- Mock vs Real: Tiered testing strategy

**Ready for Phase 1: Design & Contracts** ✅
