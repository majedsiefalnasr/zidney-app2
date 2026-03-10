# Comprehensive Test Implementation Plan

**Stage**: STAGE_TEST_01_PLATFORM_FOUNDATION  
**Branch**: test-001-platform-foundation  
**Date**: 2026-02-26  
**Phase**: Phase 1 — Design & Execution Planning

---

## Executive Summary

This document defines the complete test implementation strategy for validating 31 atomic test
scenarios across 8 architectural areas. The plan establishes testing infrastructure, artifact
organization, execution phases, and validation criteria.

**Objective**: Establish that Phase 01 PLATFORM_FOUNDATION meets all non-negotiable architectural
guarantees before promotion to PRODUCTION_READY.

---

## Test Suite Overview

### Statistics

| Dimension         | Value                                   |
| ----------------- | --------------------------------------- |
| Total Tests       | 31                                      |
| Test Areas        | 8                                       |
| Test Files        | 5 (unit + integration + static + perf)  |
| Estimated Runtime | 45-60 minutes (with real databases)     |
| Mock/Real Ratio   | 70% mock (unit), 30% real (integration) |

### Test Architecture

```
tests/
├── unit/                                    (20 tests, ~15 min)
│   ├── 01-tenant-isolation.test.ts          (Tests 1.1-1.4) ← Mock DB
│   ├── 03-license-engine.test.ts            (Tests 3.1-3.3) ← Mock DB
│   └── 05-rate-limiting.test.ts             (Tests 5.1-5.2) ← Mock DB/Redis
│
├── integration/                             (8 tests, ~30 min)
│   ├── 01-tenant-isolation.test.ts          (Tests 1.1-1.4) ← Real DB
│   ├── 02-provisioning.test.ts              (Tests 2.1-2.3) ← Real DB
│   ├── 06-observability.test.ts             (Tests 6.1-6.2) ← Real DB
│   └── 07-attempt-engine.test.ts            (Tests 7.1-7.3) ← Real DB
│
├── static/                                  (3 tests, ~5 min)
│   └── 04-migration-discipline.test.ts      (Tests 4.1-4.3) ← File scanning
│
└── performance/                             (depends on load tool)
    └── 08-performance-baseline.test.ts      (Tests 8.1-8.3) ← Real setup
```

### Test Area Mapping

| Area                | Tests            | Files              | Type                | Dependencies        |
| ------------------- | ---------------- | ------------------ | ------------------- | ------------------- |
| 1. Tenant Isolation | 1.1-1.4 (4)      | unit + integration | Cross-workspace     | None                |
| 2. Provisioning     | 2.1-2.3 (3)      | integration        | Setup operations    | DB + Redis          |
| 3. License Engine   | 3.1-3.3a-c (9)   | unit               | State transitions   | License model       |
| 4. Migrations       | 4.1-4.3 (3)      | static             | File validation     | Migration files     |
| 5. Rate Limiting    | 5.1a-c + 5.2 (4) | unit + integration | Threshold + headers | Redis               |
| 6. Observability    | 6.1-6.2 (2)      | integration        | Logging + errors    | Real execution      |
| 7. Attempt Engine   | 7.1-7.3 (3)      | integration        | Snapshot + worker   | Phase 02 schema     |
| 8. Performance      | 8.1-8.3 (3)      | performance        | Latency baselines   | Real infrastructure |

---

## Detailed Test Execution Plan

### Phase A: Unit Tests (Tests 1.1-1.4, 3.1-3.3, 5.1-5.2)

**Duration**: ~15 minutes  
**Environment**: Local (mocked DB/Redis)  
**Parallelizable**: Yes (Vitest --run --reporter=verbose)

#### Setup Requirements

```typescript
// tests/unit/setup.ts
import { InMemoryPool } from "../test-helpers";
import { InstrumentedRedisClient } from "../test-helpers";
import { createMockTenantPool } from "../test-helpers";

beforeEach(async () => {
  // Create isolated test environment
  const masterDb = new InMemoryPool();
  const tenantPoolMap = new Map();
  const redis = new InstrumentedRedisClient();

  // Return shared context
  return { masterDb, tenantPoolMap, redis };
});

afterEach(async () => {
  // Clear all mocks
  vi.clearAllMocks();
});
```

#### Unit Test Files

**1. tests/unit/01-tenant-isolation.test.ts** (Tests 1.1-1.4)

```typescript
describe("Area 1: Tenant Isolation Validation", () => {
  it("Test 1.1: Cross-tenant data access rejection", async () => {
    // Setup
    const wsA = await seedWorkspace(masterDb, { slug: "ws-a" });
    const wsB = await seedWorkspace(masterDb, { slug: "ws-b" });
    const userA = await seedUser(tenantDbA, { workspace_id: wsA.id });

    // Act
    const jwtA = generateJWT(userA.id, wsA.id);
    const response = await client.setJWT(jwtA).get(`/api/workspaces/${wsB.slug}/students`);

    // Assert
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(response.body).toMatchObject(RFC7807_ERROR_SCHEMA);
  });

  it("Test 1.2: Master database boundary enforcement", async () => {
    // Scan codebase for direct master_db access in tenant routes
    const routeFiles = await glob("apps/api/src/routes/**/*.ts");
    for (const file of routeFiles) {
      const content = readFileSync(file, "utf-8");
      // Verify: no direct master_db.query() in tenant-bound routes
      expect(content).not.toMatch(/tenant.*route.*master_db\.query/);
    }
  });

  it("Test 1.3: Resolver middleware enforcement", async () => {
    // Verify service fails without resolver
    const appWithoutResolver = new Hono()
      .use(correlationId)
      // .use(tenantResolver) ← MISSING
      .use(license)
      .get("/api/test", (c) => c.json({ ok: true }));

    const res = await appWithoutResolver.request(new Request("http://localhost/api/test"));

    expect(res.status).toBe(500);
    expect(res.ok).toBe(false);
  });

  it("Test 1.4: Workspace slug immutability in context", async () => {
    // Attempt override via request body
    const userA = seedUser(tenantDbA);
    const jwtA = generateJWT(userA.id, wsA.id);

    const response = await client.setJWT(jwtA).post(`/api/workspaces/${wsA.slug}/students`, {
      email: "new@example.com",
      workspace_slug: "workspace-b-evil", // ← Attempt override
    });

    // Resolver should ignore body, use authenticated context
    expect(response.body.data.workspace_id).toBe(wsA.id);
  });
});
```

**2. tests/unit/03-license-engine.test.ts** (Tests 3.1-3.3)

```typescript
describe("Area 3: License Engine Validation", () => {
  describe("Test 3.1: License State Machine", () => {
    it("3.1a: Valid transition ACTIVE → SOFT_LOCKED", async () => {
      const license = await seedLicense(masterDb, { status: "ACTIVE" });
      const response = await client.patch(`/api/licenses/${license.id}`, {
        status: "SOFT_LOCKED",
      });

      expect(response.status).toBe(200);
      expect(response.data.license.status).toBe("SOFT_LOCKED");
    });

    it("3.1d: Invalid transition ARCHIVED → ACTIVE (rejected)", async () => {
      const license = await seedLicense(masterDb, { status: "ARCHIVED" });
      const response = await client.patch(`/api/licenses/${license.id}`, {
        status: "ACTIVE",
      });

      expect(response.status).toBe(409);
      expect(response.body.error_code).toBe("INVALID_TRANSITION");
      expect(response.body).toMatchObject({
        ...RFC7807_ERROR_SCHEMA,
        current_state: "ARCHIVED",
        requested_state: "ACTIVE",
      });
    });

    // 3.1b, 3.1c, 3.1e follow same pattern...
  });

  it("Test 3.2: Version Enforcement", async () => {
    const workspace = await seedWorkspace(masterDb);
    const license = await seedLicense(masterDb, { workspace_id: workspace.id });

    // Simulate version mismatch
    const tenantDb = createMockTenantDb();
    await tenantDb.update(schemaVersion).set({ version: "1.9.0" });

    // Expected schema version is 2.0.0
    const response = await client.get(`/api/workspaces/${workspace.slug}/students`);

    expect(response.status).toBe(426);
    expect(response.body.error_code).toBe("UPGRADE_REQUIRED");
  });

  describe("Test 3.3: Limit Enforcement", () => {
    it("3.3a: Student limit enforcement", async () => {
      const license = await seedLicense(masterDb, { max_students: 100 });
      const students = await seedStudentsBulk(tenantDb, 100);

      // Attempt 101st
      const response = await client.post(`/api/workspaces/${ws.slug}/students`, {
        email: "over-limit@example.com",
      });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        error_code: "LIMIT_EXCEEDED",
        limit: 100,
        current: 100,
      });
    });

    it("3.3c: Limit check is transactional", async () => {
      // Within transaction, create 11 when limit is 10
      expect(async () => {
        await tenantDb.transaction(async (tx) => {
          await seedStudentsBulk(tx, 11);
        });
      }).rejects.toThrow("LIMIT_EXCEEDED");

      // Verify 0 students created (all-or-nothing)
      const count = await tenantDb.select(sql`count(*)`).from(students);
      expect(count).toBe(0);
    });
  });
});
```

**3. tests/unit/05-rate-limiting.test.ts** (Tests 5.1-5.2)

```typescript
describe("Area 5: Rate Limiting Validation", () => {
  describe("Test 5.1: Threshold Enforcement", () => {
    it("5.1a: Login endpoint rate limit (5/min per IP)", async () => {
      for (let i = 0; i < 5; i++) {
        const res = await client.post("/api/login", {
          email: "test@example.com",
          password: "wrong",
        });
        expect([200, 401]).toContain(res.status); // Success or auth failure
      }

      // 6th request should be rate-limited
      const res = await client.post("/api/login", {
        email: "test@example.com",
        password: "wrong",
      });
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeDefined();
    });

    it("5.1c: Submission idempotency bypasses rate limiting", async () => {
      const submission1 = await client.post(
        `/api/workspaces/${ws.slug}/attempts/${att.id}/submissions`,
        { questionId: "q1", answer: "A" },
      );
      expect(submission1.status).toBe(202);

      // Identical resubmission (idempotent)
      const submission2 = await client.post(
        `/api/workspaces/${ws.slug}/attempts/${att.id}/submissions`,
        { questionId: "q1", answer: "A" },
      );
      expect(submission2.status).toBe(202); // Not rate-limited

      // Different question (distinct operation)
      const submission3 = await client.post(
        `/api/workspaces/${ws.slug}/attempts/${att.id}/submissions`,
        { questionId: "q2", answer: "B" },
      );
      expect(submission3.status).toBe(202);
    });
  });

  it("Test 5.2: Rate limit header verification", async () => {
    const res = await client.get(`/api/workspaces/${ws.slug}/students`);

    expect(res.headers.get("X-RateLimit-Limit")).toBe("1000");
    expect(res.headers.get("X-RateLimit-Remaining")).toMatch(/^\d+$/);
    expect(res.headers.get("X-RateLimit-Reset")).toMatch(/^\d+$/);

    // Verify decrease on subsequent request
    const remaining1 = parseInt(res.headers.get("X-RateLimit-Remaining")!);
    const res2 = await client.get(`/api/workspaces/${ws.slug}/students`);
    const remaining2 = parseInt(res2.headers.get("X-RateLimit-Remaining")!);

    expect(remaining2).toBe(remaining1 - 1);
  });
});
```

---

### Phase B: Integration Tests (Tests 1.1-1.4, 2.1-2.3, 6.1-6.2, 7.1-7.3)

**Duration**: ~30 minutes  
**Environment**: Docker (real PostgreSQL + Redis)  
**Parallelizable**: Partial (tests within same area sequential, areas parallel)

#### Docker Setup

```yaml
# docker-compose.test.yml
version: "3.8"
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: master_db
      POSTGRES_PASSWORD: test
    volumes:
      - postgres_data_test:/var/lib/postgresql/data
    ports:
      - "5433:5432"

  redis:
    image: redis:7
    ports:
      - "6380:6379"
```

**Startup Command**:

```bash
docker-compose -f docker-compose.test.yml up -d
# Wait for services healthy
npm run test:integration
```

#### Integration Test Files

**1. tests/integration/01-tenant-isolation.test.ts** (Tests 1.1-1.4 with real DB)

```typescript
describe("Area 1: Tenant Isolation (Integration)", () => {
  let masterDb: Database;
  let redis: RedisClient;

  beforeAll(async () => {
    // Connect to real Docker PostgreSQL
    masterDb = new Database({
      host: "localhost",
      port: 5433,
      database: "master_db",
      password: "test",
    });

    redis = new RedisClient({
      host: "localhost",
      port: 6380,
    });

    await masterDb.init();
    await redis.connect();
  });

  afterAll(async () => {
    await masterDb.close();
    await redis.disconnect();
  });

  beforeEach(async () => {
    // Create fresh test environments for each test
    const env = await setupMultiWorkspaceTest(masterDb);
    return { env };
  });

  afterEach(async () => {
    // Cleanup (drop tenant databases, delete master records)
    await teardownTestEnvironment(env);
  });

  it("Test 1.1: Cross-tenant data access rejection (Real DB)", async () => {
    const { env } = getContext();

    // Authenticate as user from Workspace A
    const jwtA = generateJWT(env.userA.id, env.wsA.id);

    // Attempt to access Workspace B resource
    const response = await httpClient.setJWT(jwtA).get(`/api/workspaces/${env.wsB.slug}/students`);

    expect(response.status).toBe(403);

    // Verify no data leakage
    expect(response.body.data).toBeNull();

    // Verify audit log recorded attempt
    const auditLogs = await masterDb
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, "unauthorized_access_attempt"),
          eq(auditLog.workspace_id, env.wsB.id),
        ),
      );
    expect(auditLogs.length).toBeGreaterThan(0);
  });
});
```

**2. tests/integration/02-provisioning.test.ts** (Tests 2.1-2.3)

```typescript
describe("Area 2: Provisioning Validation", () => {
  it("Test 2.1: Deterministic database creation (idempotency)", async () => {
    const ws = await seedWorkspace(masterDb, { slug: "test-idempotent" });
    const lic = await seedLicense(masterDb, { workspace_id: ws.id });

    // First provision
    const result1 = await provisioning.provision(ws.id);
    expect(result1.success).toBe(true);

    // Query database list
    const dbList1 = await adminDb.query(`SELECT datname FROM pg_database WHERE datname LIKE $1`, [
      `${ws.slug}_tenant_db`,
    ]);
    expect(dbList1.rows.length).toBe(1);

    // Second provision (idempotent)
    const result2 = await provisioning.provision(ws.id);
    expect(result2.success).toBe(true);
    expect(result2.message).toMatch(/already provisioned/);

    // Verify still only one database
    const dbList2 = await adminDb.query(`SELECT datname FROM pg_database WHERE datname LIKE $1`, [
      `${ws.slug}_tenant_db`,
    ]);
    expect(dbList2.rows.length).toBe(1);
  });

  it("Test 2.2: Distributed lock enforcement under concurrency", async () => {
    const ws = await seedWorkspace(masterDb, { slug: "test-concurrent" });

    // Simulate 5 concurrent provisioning requests
    const results = await Promise.allSettled([
      provisioning.provision(ws.id),
      provisioning.provision(ws.id),
      provisioning.provision(ws.id),
      provisioning.provision(ws.id),
      provisioning.provision(ws.id),
    ]);

    const successes = results.filter((r) => r.status === "fulfilled" && r.value.success);
    const failures = results.filter((r) => r.status === "rejected" || !r.value?.success);

    expect(successes.length).toBe(1); // Exactly one succeeded
    expect(failures.length).toBe(4); // Others failed
    expect(failures.every((f) => f.reason?.message.includes("already in progress"))).toBe(true);
  });

  it("Test 2.3: Baseline schema integrity", async () => {
    const ws = await seedWorkspace(masterDb);
    await provisioning.provision(ws.id);

    const tenantDb = await getTenantPool(ws.id).getConnection();

    // Check required tables
    const requiredTables = [
      "users",
      "roles",
      "permissions",
      "students",
      "staff",
      "attempts",
      "submissions",
      "questions_snapshot",
      "schema_version",
    ];

    for (const table of requiredTables) {
      const exists = await tenantDb.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [table],
      );
      expect(exists.rows.length).toBe(1, `Table ${table} should exist`);
    }

    // Verify schema_version
    const [version] = await tenantDb.select().from(schemaVersion).limit(1);
    expect(version.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic version
  });
});
```

**3. tests/integration/06-observability.test.ts** (Tests 6.1-6.2)

```typescript
describe("Area 6: Observability Validation", () => {
  let logSpy: any;

  beforeEach(() => {
    // Capture logs
    logSpy = vi.spyOn(logger, "log");
  });

  it("Test 6.1: Structured logging compliance", async () => {
    const ws = await seedWorkspace(masterDb);
    const client = createHttpClient();

    // Make request
    const response = await client.get(`/api/workspaces/${ws.slug}/students`);

    // Examine logs
    const logCalls = logSpy.mock.calls.filter(([entry]) =>
      entry.message?.includes("GET /api/workspaces"),
    );

    expect(logCalls.length).toBeGreaterThan(0);

    const entry = logCalls[0][0];

    // Verify required fields
    expect(entry).toMatchObject({
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), // ISO 8601
      level: expect.stringMatching(/INFO|WARN|ERROR/),
      service: "api",
      workspace_slug: ws.slug,
      workspace_id: ws.id,
      correlation_id: expect.any(String),
      message: expect.any(String),
    });

    // Verify log is valid JSON
    expect(() => JSON.parse(JSON.stringify(entry))).not.toThrow();
  });

  it("Test 6.2: Error response contract (RFC 7807)", async () => {
    const response = await client.get(`/api/workspaces/nonexistent/students`);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      type: "https://api.zidney.io/errors/not_found",
      title: "Resource Not Found",
      status: 404,
      detail: expect.stringContaining("workspace"),
      instance: "/api/workspaces/nonexistent/students",
      error_code: "NOT_FOUND",
    });
  });
});
```

**4. tests/integration/07-attempt-engine.test.ts** (Tests 7.1-7.3)

```typescript
describe("Area 7: Attempt Engine Validation", () => {
  it("Test 7.1: Snapshot immutability", async () => {
    const ws = await setupCompleteTestEnvironment();
    const exam = await seedExam(ws.tenantDb, {
      title: "Original Exam",
      total_points: 100,
      pass_threshold: 60,
    });
    const student = await seedStudent(ws.tenantDb, 1);

    // Student starts attempt (snapshot created)
    const attempt = await seedAttempt(ws.tenantDb, {
      exam_id: exam.id,
      student_id: student.id,
      snapshot_config: JSON.stringify({
        exam_title: "Original Exam",
        total_points: 100,
        pass_threshold: 60,
        passing_grade: "D",
      }),
    });

    // Modify exam after attempt started
    await ws.tenantDb
      .update(exams)
      .set({ pass_threshold: 80, passing_grade: "C" })
      .where(eq(exams.id, exam.id));

    // Verify attempt snapshot unchanged
    const snapshotConfig = JSON.parse(attempt.snapshot_config);
    expect(snapshotConfig.pass_threshold).toBe(60); // Not 80
    expect(snapshotConfig.passing_grade).toBe("D"); // Not C
  });

  it("Test 7.2: Worker-only grading authority", async () => {
    // Scan API codebase
    const apiFiles = await glob("apps/api/src/routes/**/*.ts");
    for (const file of apiFiles) {
      const content = readFileSync(file, "utf-8");
      // Verify no grading logic in routes
      expect(content).not.toMatch(/calculateScore|gradeSubmission|evaluateAnswer/);
    }

    // Make submission
    const ws = await setupCompleteTestEnvironment();
    const response = await client.post(
      `/api/workspaces/${ws.workspace.slug}/attempts/${ws.attempt.id}/submissions`,
      { questionId: "q1", answer: "A" },
    );

    // Verify 202 (not 200) — async processing
    expect(response.status).toBe(202);

    // Verify score is NULL (not yet graded)
    const submission = response.data.submission;
    expect(submission.score).toBeNull();

    // Verify task queued for Worker
    const queueLength = await redis.lLen("worker:grading:queue");
    expect(queueLength).toBeGreaterThan(0);
  });

  it("Test 7.3: Server-authoritative time only", async () => {
    const ws = await setupCompleteTestEnvironment();
    const attemptDeadline = new Date(Date.now() + 60000); // 60 sec from now
    const attempt = await seedAttempt(ws.tenantDb, {
      deadline_at: attemptDeadline,
    });

    // Malicious client tries to manipulate time
    const fakeFutureTime = new Date(Date.now() + 120000); // Fake: 2 min in future

    const response = await client.post(
      `/api/workspaces/${ws.workspace.slug}/attempts/${attempt.id}/submissions`,
      {
        questionId: "q1",
        answer: "A",
        client_timestamp: fakeFutureTime.toISOString(), // ← Ignored
      },
    );

    // Server time used for deadline, not client time
    const submission = response.data.submission;
    expect(submission.submitted_at).toBeCloseTo(new Date());
    expect(submission.submitted_at).not.toBeCloseTo(fakeFutureTime);
  });
});
```

---

### Phase C: Static Analysis (Test 4.1-4.3)

**Duration**: ~5 minutes  
**Environment**: No runtime needed  
**Parallelizable**: Yes

#### Migration Validation Tests

**tests/static/04-migration-discipline.test.ts**

```typescript
describe("Area 4: Migration Discipline Validation", () => {
  it("Test 4.1: Forward-only migration check", async () => {
    const migrationsPath = "apps/api/src/db/*/migrations";
    const migrationFiles = (await glob(migrationsPath)) + "/**/*.sql";

    for (const file of migrationFiles) {
      const content = readFileSync(file, "utf-8");

      // Split into UP and DOWN
      const upMatch = content.match(/^-- UP([\s\S]+?)(?:-- DOWN|$)/m);
      const upSection = upMatch?.[1] || "";

      // Forbidden patterns in UP section
      const forbiddenPatterns = ["DROP TABLE", "DROP COLUMN", "DELETE FROM", "TRUNCATE"];
      for (const pattern of forbiddenPatterns) {
        expect(upSection.toUpperCase()).not.toContain(
          pattern,
          `${file} contains ${pattern} in UP section`,
        );
      }
    }
  });

  it("Test 4.2: Migration hash immutability", async () => {
    // Load historical migration hashes from .migrations.json
    const hashFile = "apps/api/.migrations.json";
    const hashData = JSON.parse(readFileSync(hashFile, "utf-8"));

    // Calculate current hashes
    const migrationsPath = "apps/api/src/db/*/migrations/**/*.sql";
    const migrationFiles = await glob(migrationsPath);

    for (const file of migrationFiles) {
      const content = readFileSync(file, "utf-8");
      const currentHash = crypto.createHash("sha256").update(content).digest("hex");

      const filename = path.basename(file);
      if (hashData[filename]) {
        expect(currentHash).toBe(
          hashData[filename],
          `${filename} hash changed (immutability violation)`,
        );
      }
    }
  });

  it("Test 4.3: Duplicate migration ID detection", async () => {
    const migrationsPath = "apps/api/src/db/*/migrations/**/*.sql";
    const migrationFiles = await glob(migrationsPath);

    // Extract migration IDs (numbers)
    const migrationIds = migrationFiles.map((file) => {
      const match = path.basename(file).match(/^(\d+)_/);
      return match ? parseInt(match[1]) : null;
    });

    // Check for duplicates
    const uniqueIds = new Set(migrationIds);
    expect(uniqueIds.size).toBe(
      migrationIds.length,
      `Duplicate migration IDs detected: ${[...migrationIds].filter(
        (id, idx) => migrationIds.indexOf(id) !== idx,
      )}`,
    );
  });
});
```

---

### Phase D: Performance Baseline (Test 8.1-8.3)

**Duration**: ~15 minutes  
**Environment**: Real infrastructure (PostgreSQL + Redis)  
**Parallelizable**: No (sequential latency sampling)

#### Performance Test Setup

**tests/performance/08-performance-baseline.test.ts**

```typescript
describe("Area 8: Performance Baseline", () => {
  it("Test 8.1: Middleware overhead < 1ms", async () => {
    // Create minimal endpoint with all middleware
    const app = new Hono()
      .use(correlationId)
      .use(tenantResolver)
      .use(license)
      .use(schemaVersion)
      .get("/api/test/echo", (c) => c.json({ ok: true }));

    // Baseline: no middleware
    const baselineApp = new Hono().get("/api/test/echo", (c) => c.json({ ok: true }));

    const timings: number[] = [];

    for (let i = 0; i < 1000; i++) {
      const start = performance.now();
      await app.request(new Request("http://localhost/api/test/echo"));
      timings.push(performance.now() - start);
    }

    const baselineTimings: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const start = performance.now();
      await baselineApp.request(new Request("http://localhost/api/test/echo"));
      baselineTimings.push(performance.now() - start);
    }

    const metrics = calculateMetrics(timings);
    const baselineMetrics = calculateMetrics(baselineTimings);
    const overhead = {
      p95: metrics.p95_ms - baselineMetrics.p95_ms,
      p99: metrics.p99_ms - baselineMetrics.p99_ms,
    };

    expect(overhead.p95).toBeLessThan(1);
    expect(overhead.p99).toBeLessThan(1.5);
  });

  it("Test 8.2: License check query < 5ms", async () => {
    // Create 10,000 license records
    const licenses = Array(10000)
      .fill(0)
      .map(() => ({
        id: randomUUID(),
        workspace_id: randomUUID(),
        status: "ACTIVE",
      }));

    await masterDb.insert(licenseTable).values(licenses);

    const timings: number[] = [];

    for (let i = 0; i < 1000; i++) {
      const randomId = licenses[Math.floor(Math.random() * licenses.length)].id;

      const start = performance.now();
      await masterDb
        .select()
        .from(licenseTable)
        .where(and(eq(licenseTable.id, randomId), eq(licenseTable.status, "ACTIVE")))
        .limit(1);
      timings.push(performance.now() - start);
    }

    const metrics = calculateMetrics(timings);

    expect(metrics.p95_ms).toBeLessThan(5);
    expect(metrics.p99_ms).toBeLessThan(7);
  });

  it("Test 8.3: Provisioning lock resolution < 50ms", async () => {
    const redis = new RedisClient({
      host: "localhost",
      port: 6380,
    });

    const timings: number[] = [];

    for (let i = 0; i < 100; i++) {
      const lockKey = `provision:ws-${i}`;

      // Measure lock acquisition
      const acquireStart = performance.now();
      const acquired = await redis.set(lockKey, "owner", "EX", 60, "NX");
      timings.push(performance.now() - acquireStart);

      // Measure lock release
      const releaseStart = performance.now();
      await redis.del(lockKey);
      timings.push(performance.now() - releaseStart);
    }

    const metrics = calculateMetrics(timings);

    expect(metrics.p95_ms).toBeLessThan(50);
    expect(metrics.p99_ms).toBeLessThan(100);
  });
});
```

---

## Execution Timeline

### Sequential Execution (Development)

```bash
# Phase C (fast, no dependencies): ~5 min
npm run test:static

# Phase A (unit, no DB): ~15 min
npm run test:unit

# Phase B (integration, requires Docker): ~30 min
docker-compose -f docker-compose.test.yml up -d
npm run test:integration
docker-compose -f docker-compose.test.yml down

# Phase D (performance): ~15 min
npm run test:performance
```

**Total**: ~65 minutes

### Parallel Execution (CI/CD)

```bash
# Spawn parallel jobs
job1: npm run test:static      # 5 min
job2: npm run test:unit        # 15 min
job3: docker-compose + npm run test:integration  # 30 min
job4: npm run test:performance # 15 min

# Critical path: job3 (30 min)
# Total CI time: ~35 minutes
```

---

## Test Result Reporting

### Summary Report

```
======================================================================
STAGE_TEST_01_PLATFORM_FOUNDATION - VALIDATION REPORT
======================================================================

Phase: Phase 1 — Design & Execution

Total Tests: 31
├─ Passed: 31 ✅
├─ Failed: 0 ❌
└─ Skipped: 0 ⏭️

Test Coverage:
├─ Area 1 (Tenant Isolation): 4/4 ✅
├─ Area 2 (Provisioning): 3/3 ✅
├─ Area 3 (License Engine): 9/9 ✅
├─ Area 4 (Migrations): 3/3 ✅
├─ Area 5 (Rate Limiting): 4/4 ✅
├─ Area 6 (Observability): 2/2 ✅
├─ Area 7 (Attempt Engine): 3/3 ✅
└─ Area 8 (Performance): 3/3 ✅

Execution Time:
├─ Unit tests: 14:32
├─ Integration tests: 28:19
├─ Static analysis: 4:07
├─ Performance tests: 14:51
└─ Total: 61:49

Architecture Validation:
├─ Tenant isolation: PASS ✅
├─ No cross-tenant leakage: PASS ✅
├─ License enforcement: PASS ✅
├─ Migration integrity: PASS ✅
├─ Rate limiting: PASS ✅
├─ Observability: PASS ✅
├─ Attempt engine: PASS ✅
└─ Performance baselines: PASS ✅

Conclusion: ALL VALIDATION TESTS PASSED ✅

Stage Status: READY FOR PRODUCTION_READY PROMOTION

======================================================================
```

### Failure Case Example

```
---
FAILED: Test 3.1d (Invalid License Transition)
---

Expected: Response code 409
Got: 200

Error Detail:
License L5 transitioned from ARCHIVED to ACTIVE without rejection.
State machine validation was bypassed.

Root Cause:
Missing state machine check in license PATCH handler before DB update.

Recommended Fix:
Add validation in apps/api/src/handlers/licenses.ts:
  if (currentLicense.status === 'ARCHIVED' && newStatus !== 'ARCHIVED') {
    return createRFC7807Response(409, 'INVALID_TRANSITION', ...)
  }

---
```

---

## Prerequisites and Dependencies

### External Dependencies

| Dependency  | Type             | Version | Purpose                    |
| ----------- | ---------------- | ------- | -------------------------- |
| PostgreSQL  | Database         | 15+     | Test data storage          |
| Redis       | Cache            | 7+      | Distributed locking        |
| Node.js/Bun | Runtime          | 20+     | Test execution             |
| Vitest      | Test Framework   | 1.0+    | Unit/integration testing   |
| Docker      | Containerization | 24+     | Test environment isolation |

### Assumed Complete Phases

- ✅ Phase 01 PLATFORM_FOUNDATION — Schema and migrations
- ✅ Phase 02 EXAM_MODULE — Exam/question tables (needed for tests 7.1-7.3)

### Test Data Seeding Fixtures

- ✅ Workspace creation
- ✅ License provisioning
- ✅ User/student seeding
- ✅ Attempt/submission creation
- ✅ Multi-workspace scenarios

---

## Architecture Validation Checklist

### Before Running Tests

- [ ] PostgreSQL running on localhost:5433
- [ ] Redis running on localhost:6380
- [ ] API service can start without errors
- [ ] Worker service available (for grading tests)
- [ ] All Phase 01+02 migrations applied
- [ ] Test data seeding utilities configured
- [ ] Logging configured (structured JSON)
- [ ] Rate limiting feature flags enabled

### Post-Test Validation

- [ ] All 31 tests PASS
- [ ] Zero test regressions from previous runs
- [ ] Performance baselines met (middleware <1ms, lock <50ms)
- [ ] No cross-tenant data access detected
- [ ] No grading logic in API (Worker-only)
- [ ] Error responses follow RFC 7807
- [ ] Structured logging all fields present
- [ ] Migration integrity verified
- [ ] Snapshot immutability confirmed
- [ ] Server-authoritative time enforced

---

## Success Criteria (Stage-Level Pass Conditions)

**This validation stage PASSES when:**

✅ All 31 tests execute and PASS  
✅ No test failures or regressions  
✅ All 8 validation areas PASS  
✅ Performance baselines achieved  
✅ Architecture guarantees verified  
✅ RFC 7807 error contracts enforced  
✅ Structured logging complete  
✅ No mutations to frozen Migration files

**This stage BLOCKS promotion if:**

❌ Any test FAILS  
❌ Performance baseline not met  
❌ Cross-tenant access possible  
❌ Grading logic detected in API  
❌ Error responses non-compliant

---

## Post-Execution Artifacts

### Generated During Test Run

1. **Audit Log**: `audits/VALIDATION_REPORT.md`
   - Complete test results
   - Performance metrics
   - Architecture validation summary

2. **Coverage Report**: `coverage/phase-01-validation.json`
   - Code coverage metrics
   - Uncovered critical paths (if any)

3. **Load Test Results**: `reports/performance-baseline.json`
   - Latency percentiles
   - Throughput metrics
   - Anomalies detected

### Promotion Decision

```yaml
Stage: STAGE_TEST_01_PLATFORM_FOUNDATION
Result: PASSED ✅
Timestamp: 2026-02-26T14:30:00Z
Approved By: CI/Pipeline
Next Stage: PRODUCTION_READY
Action: Merge test-001-platform-foundation → main
```

---

## Summary

**Comprehensive Test Plan Created**: ✅

- 31 atomic tests mapped to infrastructure
- 5 test files organized by execution layer
- 4 execution phases planned and sequenced
- Success criteria defined and measurable
- Prerequisites and dependencies documented
- Failure scenarios and remediation planned

**All 3 Phases Complete**: ✅

- Phase 0 (Research): ✅ Resolved
- Phase 1 (Design): ✅ Completed (this doc)
- Phase 2 (Execution): ⏳ Ready to implement

**Ready for Implementation Phase** ✅
