# Test Implementation Guide

## License Management QA Blockers

This guide provides code templates for the 23 tests needed to unblock the Licenses Management stage.

---

## BLOCKER #1: RBAC Tests (Priority 1, Due Immediately)

**File**: Create `apps/api/tests/integration/license-rbac.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestClient } from "../helpers/test-client";
import { db } from "../db";

describe("License RBAC Enforcement", () => {
  let client: any;
  let studentUser: any;
  let staffUser: any;
  let mmcAdminUser: any;
  let license: any;

  beforeAll(async () => {
    // Setup: Create users with different roles
    studentUser = await db.createUser({ role: "student" });
    staffUser = await db.createUser({ role: "staff" });
    mmcAdminUser = await db.createUser({ role: "mmc_admin" });

    // Create a license for state transition tests
    license = await db.master
      .query(
        `INSERT INTO licenses (product_id, workspace_slug, status)
       VALUES ($1, $2, $3) RETURNING *`,
        ["product-uuid", "test.edu", "ACTIVE"],
      )
      .then((r) => r.rows[0]);
  });

  afterAll(async () => {
    await db.cleanup();
  });

  // TEST 1: Student cannot create license
  it("[BLOCKING] Student attempting to create license returns 403", async () => {
    client = createTestClient();
    client.setAuthToken(studentUser.token);

    const response = await client.post("/api/mmc/licenses", {
      product_id: "product-uuid",
      workspace_slug: "new-workspace.edu",
    });

    expect(response.status).toBe(403);
    expect(response.data.error.code).toBe("UNAUTHORIZED");
  });

  // TEST 2: Staff cannot create license
  it("[BLOCKING] Staff attempting to create license returns 403", async () => {
    client = createTestClient();
    client.setAuthToken(staffUser.token);

    const response = await client.post("/api/mmc/licenses", {
      product_id: "product-uuid",
      workspace_slug: "another-workspace.edu",
    });

    expect(response.status).toBe(403);
    expect(response.data.error.code).toBe("UNAUTHORIZED");
  });

  // TEST 3: Only MMC admin can create license
  it("[BLOCKING] Only MMC admin can create license returns 201", async () => {
    client = createTestClient();
    client.setAuthToken(mmcAdminUser.token);

    const response = await client.post("/api/mmc/licenses", {
      product_id: "product-uuid",
      workspace_slug: "admin-created.edu",
    });

    expect(response.status).toBe(201);
    expect(response.data.success).toBe(true);
  });

  // TEST 4: Student cannot transition license state
  it("[BLOCKING] Student attempting state transition returns 403", async () => {
    client = createTestClient();
    client.setAuthToken(studentUser.token);

    const response = await client.patch(`/api/mmc/licenses/${license.id}/state`, {
      target_state: "SOFT_LOCKED",
    });

    expect(response.status).toBe(403);
    expect(response.data.error.code).toBe("UNAUTHORIZED");
  });

  // TEST 5: Student cannot delete license
  it("[BLOCKING] Student attempting delete returns 403", async () => {
    client = createTestClient();
    client.setAuthToken(studentUser.token);

    const response = await client.delete(`/api/mmc/licenses/${license.id}`, {
      confirm_deletion: true,
    });

    expect(response.status).toBe(403);
    expect(response.data.error.code).toBe("UNAUTHORIZED");
  });
});
```

**Code Fix Required** (before tests):

```typescript
// File: apps/api/src/routes/license-router.ts
// Line: 29 (in POST /api/mmc/licenses handler)

licenseRouter.post("/mmc/licenses", async (ctx: Context) => {
  const correlationId = ctx.get("correlation_id");
  const userRole = ctx.get("user_role"); // ADD THIS LINE

  // ADD THESE LINES:
  if (userRole !== "mmc_admin") {
    return ctx.json(toLicenseError("UNAUTHORIZED", 403), { status: 403 });
  }

  // ... rest of handler
});
```

---

## BLOCKER #2: Provisioning Tests (Priority 1, Due Immediately)

**File**: Create `apps/api/tests/integration/license-provisioning.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../db";
import { createLicense } from "@zidney/domain-core/license";
import { ProvisioningQueue } from "../../../worker/src/queues/provisioning";

describe("License Provisioning Failure Handling", () => {
  let masterDb: any;
  let queue: ProvisioningQueue;

  beforeAll(async () => {
    masterDb = db.master;
    queue = new ProvisioningQueue();
  });

  afterAll(async () => {
    await db.cleanup();
    await queue.close();
  });

  // TEST 1: License starts in PENDING_PROVISION
  it("[BLOCKING] License created with status = PENDING_PROVISION", async () => {
    const license = await createLicense(masterDb, {
      product_id: "product-uuid",
      workspace_id: "workspace-uuid",
      workspace_slug: "pending.edu",
      expected_schema_version: "1.0.0",
      expected_product_version: "1.0.0",
    });

    // ✅ CHANGE: Currently status = ACTIVE, should be PENDING_PROVISION
    expect(license.status).toBe("PENDING_PROVISION");
  });

  // TEST 2: Provisioning job fires after license creation
  it("[BLOCKING] Provisioning job enqueued immediately after creation", async () => {
    const enqueueSpy = vi.spyOn(queue, "enqueue");

    await createLicense(masterDb, {
      product_id: "product-uuid",
      workspace_id: "workspace-uuid-2",
      workspace_slug: "job-test.edu",
      expected_schema_version: "1.0.0",
      expected_product_version: "1.0.0",
    });

    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        job_type: "provision_workspace",
        license_id: expect.any(String),
      }),
    );
  });

  // TEST 3: Failed provisioning retries 5 times
  it("[BLOCKING] Provisioning retries 5 times on transient error", async () => {
    const license = await db.master
      .query(
        `INSERT INTO licenses (product_id, workspace_slug, status)
       VALUES ($1, $2, $3) RETURNING *`,
        ["product-uuid", "retry-test.edu", "PENDING_PROVISION"],
      )
      .then((r) => r.rows[0]);

    // Simulate: attempt 1-4 fail, attempt 5 fails → PROVISION_FAILED
    const retrySpy = vi.spyOn(queue, "retry");

    // Mock provisioning job that fails
    const job = {
      id: "job-uuid",
      license_id: license.id,
      attempt: 1,
      max_attempts: 5,
    };

    // Simulate 4 retries
    for (let i = 0; i < 4; i++) {
      await queue.retry(job);
    }

    expect(retrySpy).toHaveBeenCalledTimes(4);

    // After 5 attempts, status should be PROVISION_FAILED
    // Simulate 5th attempt throwing error
    try {
      job.attempt = 5;
      await queue.execute(job);
    } catch (error) {
      // Expected to fail
    }

    const updatedLicense = await db.master
      .query("SELECT status FROM licenses WHERE id = $1", [license.id])
      .then((r) => r.rows[0]);

    expect(updatedLicense.status).toBe("PROVISION_FAILED");
  });

  // TEST 4: After 5 retries, moves to DLQ
  it("[BLOCKING] Failed job moves to DLQ after 5 retries exhausted", async () => {
    const dlqSpy = vi.spyOn(queue, "sendToDLQ");

    const job = {
      id: "job-uuid-dlq",
      license_id: "license-uuid-dlq",
      attempt: 5,
      max_attempts: 5,
      error: "Connection timeout after 5 retries",
    };

    await queue.handleExhaustedRetries(job);

    expect(dlqSpy).toHaveBeenCalledWith(job);
  });

  // TEST 5: Provisioning timeout (30min) triggers PROVISION_FAILED
  it("[BLOCKING] Provisioning timeout (30 min) triggers PROVISION_FAILED", async () => {
    const license = await db.master
      .query(
        `INSERT INTO licenses (product_id, workspace_slug, status, created_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
        [
          "product-uuid",
          "timeout-test.edu",
          "PENDING_PROVISION",
          new Date(Date.now() - 31 * 60 * 1000), // 31 minutes ago
        ],
      )
      .then((r) => r.rows[0]);

    const timeoutCheck = async (lic: any) => {
      const now = new Date();
      const createdAt = new Date(lic.created_at);
      const elapsedMs = now.getTime() - createdAt.getTime();
      const timeoutMs = 30 * 60 * 1000;

      if (elapsedMs > timeoutMs && lic.status === "PENDING_PROVISION") {
        await db.master.query(`UPDATE licenses SET status = $1 WHERE id = $2`, [
          "PROVISION_FAILED",
          lic.id,
        ]);
      }
    };

    await timeoutCheck(license);

    const result = await db.master
      .query("SELECT status FROM licenses WHERE id = $1", [license.id])
      .then((r) => r.rows[0]);

    expect(result.status).toBe("PROVISION_FAILED");
  });

  // TEST 6: Login blocked while PENDING_PROVISION
  it("[BLOCKING] Login request rejects PENDING_PROVISION license with 423", async () => {
    const license = await db.master
      .query(
        `INSERT INTO licenses (product_id, workspace_slug, status)
       VALUES ($1, $2, $3) RETURNING *`,
        ["product-uuid", "login-block.edu", "PENDING_PROVISION"],
      )
      .then((r) => r.rows[0]);

    const client = createTestClient();
    const response = await client.post("/api/auth/login", {
      email: "user@login-block.edu",
      password: "password",
    });

    expect(response.status).toBe(423); // Locked
    expect(response.data.error.code).toMatch(/PENDING_PROVISION|LICENSE_LOCKED/);
  });
});
```

**Infrastructure Changes Needed**:

1. Implement provisioning worker queue task
2. Add retry mechanism (5 retries, exponential backoff)
3. Add timeout detection (30min)
4. Add DLQ integration

---

## BLOCKER #3: Soft-Lock Grace Period Fix (Priority 1, Immediate)

**Code Fix**:

```typescript
// File: packages/domain-core/src/license/service.ts
// Line: 220-224

if (target_state === "SOFT_LOCKED") {
  const softLockUntil = new Date();
  softLockUntil.setDate(softLockUntil.getDate() + 90); // ✅ CHANGE: 7 → 90
  updateQuery += `, soft_lock_until = $4`;
  updateParams.push(softLockUntil);
}
```

**Test to Add**:

```typescript
// File: Create apps/api/tests/integration/license-soft-lock.test.ts

it("[BLOCKING] Soft-lock grace period is 90 days", async () => {
  const license = await db.master
    .query(
      `INSERT INTO licenses (product_id, workspace_slug, status)
     VALUES ($1, $2, $3) RETURNING *`,
      ["product-uuid", "grace-test.edu", "ACTIVE"],
    )
    .then((r) => r.rows[0]);

  // Transition to SOFT_LOCKED
  const transitionResult = await transitionLicenseState(db.master, {
    license_id: license.id,
    target_state: "SOFT_LOCKED",
  });

  const softLockedLicense = transitionResult.license;
  const now = new Date();
  const expected = new Date();
  expected.setDate(expected.getDate() + 90);

  const graceDays = Math.floor(
    (softLockedLicense.soft_lock_until.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  expect(graceDays).toBe(90); // ✅ Should be 90, not 7
});
```

---

## BLOCKER #4: Limits Validation API Tests (Priority 1, Due Soon)

**File**: Create `apps/api/tests/integration/license-limits-api.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestClient } from "../helpers/test-client";
import { db } from "../db";

describe("License Limits Enforcement (API Integration)", () => {
  let client: any;
  let workspace: any;
  let license: any;
  let staffUser: any;

  beforeAll(async () => {
    // Create workspace with license (student_limit: 1)
    workspace = await db.createWorkspace();
    license = await db.master
      .query(
        `INSERT INTO licenses (
        product_id, workspace_id, workspace_slug, status, student_limit, staff_limit
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        ["product-uuid", workspace.id, workspace.slug, "ACTIVE", 1, 10],
      )
      .then((r) => r.rows[0]);

    // Create staff user who can add students
    staffUser = await db.createUser({
      role: "staff",
      workspace_id: workspace.id,
    });

    client = createTestClient();
    client.setAuthToken(staffUser.token);
  });

  afterAll(async () => {
    await db.cleanup();
  });

  // TEST 1: Adding student at limit returns 402
  it("[BLOCKING] POST /api/workspace/users returns 402 when exceeding student_limit", async () => {
    // Already 1 student at limit
    // Try to add another
    const response = await client.post("/api/workspace/users", {
      email: "newstudent@example.com",
      password: "password",
      role: "student",
      name: "New Student",
    });

    expect(response.status).toBe(402);
    expect(response.data.error.code).toBe("LIMIT_EXCEEDED");
    expect(response.data.error.message).toContain("student");
  });

  // TEST 2: Adding staff at limit returns 402
  it("[BLOCKING] POST /api/workspace/staff returns 402 when exceeding staff_limit", async () => {
    // Update license: staff_limit = 1
    await db.master.query("UPDATE licenses SET staff_limit = $1 WHERE id = $2", [1, license.id]);

    // Already 1 staff, try to add another
    const response = await client.post("/api/workspace/staff", {
      email: "newstaff@example.com",
      password: "password",
      name: "New Staff",
    });

    expect(response.status).toBe(402);
    expect(response.data.error.code).toBe("LIMIT_EXCEEDED");
  });

  // TEST 3: Concurrent requests at limit boundary
  it("[BLOCKING] Two concurrent student adds at limit=1 → one succeeds, one blocked", async () => {
    const response1 = client.post("/api/workspace/users", {
      email: "concurrent1@example.com",
      password: "password",
      role: "student",
    });

    const response2 = client.post("/api/workspace/users", {
      email: "concurrent2@example.com",
      password: "password",
      role: "student",
    });

    const [res1, res2] = await Promise.all([response1, response2]);

    // One should succeed (201), one should fail (402)
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 402]);

    // The 402 should have LIMIT_EXCEEDED
    const blockedRes = res1.status === 402 ? res1 : res2;
    expect(blockedRes.data.error.code).toBe("LIMIT_EXCEEDED");
  });
});
```

---

## Additional Tests (Priority 2 & 3)

### Soft-Lock Edge Cases (Priority 2)

```typescript
it('Two concurrent requests during expiry → atomic transition', ...)
it('Expired soft-lock auto-transitions on next request', ...)
it('Cache invalidated immediately after status change', ...)
```

### Divergence Detection (Priority 3)

```typescript
it('Divergence between licenses.status and tenants_registry detected', ...)
it('Middleware uses licenses.status as authority', ...)
```

---

## Summary: Test Implementation Plan

| Blocker       | Tests           | Effort         | File                           |
| ------------- | --------------- | -------------- | ------------------------------ |
| RBAC          | 5               | 1 hour         | `license-rbac.test.ts`         |
| Provisioning  | 6               | 4 hours        | `license-provisioning.test.ts` |
| Soft-Lock Fix | 1 fix + 4 tests | 1 hour         | Various                        |
| Limits API    | 3               | 2 hours        | `license-limits-api.test.ts`   |
| **Total**     | **23+**         | **8–10 hours** | Multiple files                 |

---

**Status**: Ready for implementation  
**Generated**: 2026-02-22
