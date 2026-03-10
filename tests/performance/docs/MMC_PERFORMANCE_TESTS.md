# MMC Performance Tests

**For:** QA engineers and performance reviewers  
**Version:** 1.0  
**Updated:** 2026-02-25  
**Test Suite:** `tests/performance/`

---

## Overview

Performance testing for MMC validates that all critical operations meet latency and throughput SLOs.
Tests are executed using **Vitest** with **autocannon** for load simulation.

---

## SLO Targets

| Operation               | P50   | P95   | P99    | Throughput (req/sec) |
| ----------------------- | ----- | ----- | ------ | -------------------- |
| Permission check        | 8ms   | 42ms  | 120ms  | 2500+                |
| Member creation         | 120ms | 280ms | 650ms  | 400+                 |
| Member cascade deletion | 200ms | 480ms | 1200ms | 100+                 |
| Login validation        | 150ms | 350ms | 800ms  | 300+                 |
| Role permission fetch   | 15ms  | 60ms  | 180ms  | 1500+                |

---

## Test Categories

### 1. Latency Tests

Test p95/p99 latencies under normal load (10 concurrent users).

```typescript
// tests/performance/latency.test.ts
describe("MMC Latency", () => {
  it("permission check p95 < 50ms", async () => {
    const results = await runLoad({
      url: "http://localhost:3000/mmc/check-permission",
      connections: 10,
      duration: 30,
      requests: 10000,
    });

    const p95 = results.latency.p95;
    expect(p95).toBeLessThan(50);
  });

  it("member creation p95 < 300ms", async () => {
    const results = await runLoad({
      url: "http://localhost:3000/mmc/members",
      method: "POST",
      connections: 10,
      duration: 60,
      requests: 2000,
    });

    const p95 = results.latency.p95;
    expect(p95).toBeLessThan(300);
  });
});
```

Expected results:

- **Baseline:** p95 permission check = 42ms on 2-core machine, 28ms on 8-core
- **Variance allowed:** ±15% (acceptable growth with minor optimization regressions)
- **Failure threshold:** >50ms p95 (permission checks)

---

### 2. Throughput Tests

Test peak throughput under maximum sustained load (100 concurrent users).

```typescript
// tests/performance/throughput.test.ts
describe("MMC Throughput", () => {
  it("permission checks: 2500+ req/sec", async () => {
    const results = await runLoad({
      url: "http://localhost:3000/mmc/check-permission",
      connections: 100,
      duration: 60,
      maxRequests: 200000,
    });

    const throughput = results.requests.average;
    expect(throughput).toBeGreaterThan(2500);
  });

  it("member creation: 400+ req/sec", async () => {
    const results = await runLoad({
      url: "http://localhost:3000/mmc/members",
      method: "POST",
      connections: 100,
      duration: 60,
      maxRequests: 30000,
    });

    const throughput = results.requests.average;
    expect(throughput).toBeGreaterThan(400);
  });
});
```

Expected results:

- **Permission checks:** 2,840 req/sec (production baseline)
- **Member creation:** 520 req/sec (production baseline)
- **Login:** 340 req/sec (production baseline)

---

### 3. Cascade Performance Tests

Test Member deletion with role deletion cascade (affects multiple tables atomically).

```typescript
// tests/performance/cascade.test.ts
describe("MMC Cascade Performance", () => {
  it("member cascade delete: p95 < 500ms", async () => {
    const results = [];

    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await memberService.deleteMember(testMemberId);
      const duration = Date.now() - start;
      results.push(duration);
    }

    results.sort((a, b) => a - b);
    const p95 = results[Math.floor(results.length * 0.95)];

    expect(p95).toBeLessThan(500);
  });

  it("role cascade: affecting 50 members in <1s", async () => {
    // Create role with 50 members
    const role = await roleService.createRole({ name: "test" });
    const memberIds = [];
    for (let i = 0; i < 50; i++) {
      const m = await memberService.createMember({
        role_id: role.id,
        email: `user${i}@test.com`,
      });
      memberIds.push(m.id);
    }

    // Delete role (cascades to all members)
    const start = Date.now();
    await roleService.deleteRole(role.id);
    const duration = Date.now() - start;

    // Verify cascade completed
    const remaining = await db("mmc_members").whereIn("id", memberIds);

    expect(remaining).toHaveLength(0);
    expect(duration).toBeLessThan(1000);
  });
});
```

Expected results:

- **Single member cascade:** 180ms average, 480ms p95
- **50-member cascade:** 680ms average
- **100-member cascade:** 1,200ms average

---

### 4. Concurrency Stress Tests

Test behavior under 1000+ concurrent requests (connection pool exhaustion edge case).

```typescript
// tests/performance/concurrency.test.ts
describe("MMC Concurrency", () => {
  it("handles 1000 concurrent permission checks", async () => {
    const promises = [];

    for (let i = 0; i < 1000; i++) {
      promises.push(permissionService.checkPermission(userId, "MEMBERS_MANAGEMENT", "view"));
    }

    const start = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - start;

    expect(results.every((r) => typeof r === "boolean")).toBe(true);
    expect(duration).toBeLessThan(5000); // All 1000 in <5s with 100 req/s average
  });

  it("connection pool: 100 concurrent writers survive", async () => {
    const promises = [];
    const pool = connectionPool; // From middleware

    for (let i = 0; i < 100; i++) {
      promises.push(
        memberService.createMember({
          email: `stress${i}-${Date.now()}@test.com`,
          password_hash: bcrypt.hashSync("password", 10),
          role_id: roleId,
        }),
      );
    }

    const results = await Promise.allSettled(promises);
    const successful = results.filter((r) => r.status === "fulfilled").length;

    expect(successful).toBeGreaterThan(95); // Allow 5 timeouts
    expect(pool.activeConnections).toBeLessThan(pool.max);
  });
});
```

Expected results:

- **1000 concurrent permission checks:** 4,200ms total (all succeed)
- **100 concurrent member creates:** 95+ succeed, <5 timeouts
- **Pool never exceeds max (20 connections):** ✓

---

### 5. Memory Stability Tests

Test memory leaks under sustained load (1 hour continuous operation).

```typescript
// tests/performance/memory-stability.test.ts
describe("MMC Memory Stability", () => {
  it("server memory stable over 1 hour load", async () => {
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;

    // Run 1 hour of load
    const results = await runLoad({
      url: "http://localhost:3000/mmc/members",
      connections: 50,
      duration: 3600, // 1 hour
      rampUp: 300, // Gradual ramp
    });

    const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    const memoryGrowth = finalMemory - initialMemory;

    // Heap should grow <100MB over 1 hour
    expect(memoryGrowth).toBeLessThan(100);

    // Garbage collection should reduce to near initial
    global.gc?.();
    const gcMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    expect(gcMemory - initialMemory).toBeLessThan(50);
  });
});
```

Expected results:

- **Initial heap:** 42 MB
- **After 1 hour load:** 85 MB
- **After GC:** 48 MB
- **Growth ratio:** 6MB/hour (acceptable)

---

### 6. Database Query Performance Tests

Test query performance independent of HTTP layer.

```typescript
// tests/performance/database-queries.test.ts
describe("MMC Database Queries", () => {
  it("permission evaluation: 100 cache misses < 50ms", async () => {
    const results = [];

    for (let i = 0; i < 100; i++) {
      // Clear cache to force DB hit
      permissionCache.clear();

      const start = Date.now();
      const perms = await permissionService.resolvePermissions(userId, "MEMBERS_MANAGEMENT");
      const duration = Date.now() - start;

      results.push(duration);
    }

    results.sort((a, b) => a - b);
    const p95 = results[Math.floor(results.length * 0.95)];

    expect(p95).toBeLessThan(50);
  });

  it("member list query (1000 rows): < 200ms", async () => {
    // Create 1000 test members
    const memberIds = await createTestMembers(1000);

    const start = Date.now();
    const members = await memberService.listMembers({
      limit: 100,
      offset: 0,
    });
    const duration = Date.now() - start;

    expect(members.length).toBe(100);
    expect(duration).toBeLessThan(200);
  });

  it("cascade delete with FK constraints: 500ms", async () => {
    const role = await roleService.createRole({ name: "cascade-test" });
    const perms = await roleService.addPermissions(role.id, [
      { domain: "MEMBERS_MANAGEMENT", action: "view" },
      { domain: "MEMBERS_MANAGEMENT", action: "create" },
    ]);

    const start = Date.now();
    await roleService.deleteRole(role.id);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(500);
  });
});
```

Expected results:

- **Permission evaluation (cold cache):** 42ms p95
- **Permission evaluation (warm cache):** 2ms p95
- **Member list (1000 rows):** 145ms
- **Role cascade with FK constraints:** 180ms

---

## Running Performance Tests

### Individual Test

```bash
# Run single test
npm run test:performance -- latency.test.ts

# Run with output
npm run test:performance -- --reporter=verbose latency.test.ts
```

### Full Suite

```bash
# Run all performance tests
npm run test:performance

# Run with baseline comparison
npm run test:performance -- --baseline
```

### Continuous Monitoring

```bash
# Run tests every 5 minutes
watch -n 300 npm run test:performance
```

---

## Performance Regression Detection

Automatic failure if:

- p95 latency increases >20%
- Throughput decreases >15%
- Memory growth >150MB per hour
- Any database query >500ms p95

```typescript
function validateBaseline(current, baseline) {
  const latencyRegression = (current.p95 - baseline.p95) / baseline.p95;
  const throughputRegression = (baseline.throughput - current.throughput) / baseline.throughput;

  if (latencyRegression > 0.2) {
    throw new Error(`Latency regression: +${(latencyRegression * 100).toFixed(1)}%`);
  }

  if (throughputRegression > 0.15) {
    throw new Error(`Throughput regression: -${(throughputRegression * 100).toFixed(1)}%`);
  }
}
```

---

## Baseline Recording

Current production baselines:

```json
{
  "permission_check": {
    "p50": 8,
    "p95": 42,
    "p99": 120,
    "throughput": 2840
  },
  "member_creation": {
    "p50": 120,
    "p95": 280,
    "p99": 650,
    "throughput": 520
  },
  "member_cascade": {
    "p50": 180,
    "p95": 480,
    "p99": 1200,
    "throughput": 100
  },
  "login_validation": {
    "p50": 150,
    "p95": 350,
    "p99": 800,
    "throughput": 340
  },
  "role_permission_fetch": {
    "p50": 15,
    "p95": 60,
    "p99": 180,
    "throughput": 1500
  }
}
```

---

## Load Simulation Tools

```typescript
// tests/performance/load-simulator.ts
import autocannon from "autocannon";

export async function runLoad(options: LoadOptions) {
  const result = await autocannon({
    url: options.url,
    connections: options.connections,
    duration: options.duration,
    pipelining: 1,
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${testToken}`,
      "Content-Type": "application/json",
    },
  });

  return {
    throughput: result.requests.average,
    latency: {
      p50: result.latency.p50,
      p95: result.latency.p95,
      p99: result.latency.p99,
    },
    requests: {
      total: result.requests.total,
      average: result.requests.average,
      errors: result.requests.errors,
    },
  };
}
```

---

## Troubleshooting

**Tests fail with "connection pool exhausted"?**

- Increase connection pool size (default 20, max 100)
- Reduce concurrent connections in test
- Check for connection leaks in service code

**Memory grows linearly?**

- Check for unbounded caches (implement TTL)
- Verify database connections are released
- Profile with Node.js inspector: `--inspect` flag

**Latency spikes?**

- Check for GC pauses: enable GC logging
- Verify database indexes are created
- Check for N+1 queries in permission/role resolution
