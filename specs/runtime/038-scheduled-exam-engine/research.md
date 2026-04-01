# Research — Stage 38: Scheduled Exam Engine

**Generated**: 2026-04-01
**Branch**: `spec/038-scheduled-exam-engine`
**Status**: COMPLETE (all NEEDS CLARIFICATION resolved)

---

## R-01: Drizzle ORM Schema Patterns (Tenant DB)

### Decision

Use the established `pgTable` pattern from `apps/api/src/db/tenant/schemas/`. All new tables follow the `mcq-exams.schema.ts` conventions exactly.

### Pattern

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const scheduledExams = pgTable(
  "scheduled_exams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // ... fields
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("...", sql`...`), index("idx_...").on(table.field)],
);
export type ScheduledExam = typeof scheduledExams.$inferSelect;
export type NewScheduledExam = typeof scheduledExams.$inferInsert;
```

### Key Observations

- `timestamp` with `{ withTimezone: true }` is the canonical timestamptz pattern.
- `uuid().primaryKey().defaultRandom()` maps to `DEFAULT gen_random_uuid()`.
- `check()` constraints are inline in the table definition array.
- Indexes are also in the same array — no separate `createIndex()` calls needed in Drizzle schema.
- **CONCURRENT unique indexes are NOT expressible in Drizzle schema DSL** — they must be created in migration files (Phase 2, outside transaction), as seen in migrations 014 and 015.
- `varchar` used for enums (no native Drizzle pg enum type used in this codebase — check constraints enforce valid values instead).
- The `attempts` table additions use `ALTER TABLE` in a migration, **not** a new `pgTable` — the Drizzle schema file for `attempts` must be updated to add the new columns.

### Rationale

Consistency with existing `mcq-exams.schema.ts` and `traditional-exams.schema.ts` patterns. Existing codebase has zero pg-enum usage; all enum enforcement is via CHECK constraints, which is intentional.

---

## R-02: BullMQ Deduplication for Auto-Submit Jobs

### Decision

Use BullMQ's built-in `jobId` deduplication (also called "job deduplication ID") with the format `auto_submit:{attempt_id}`. This prevents re-enqueueing the same attempt.

### Pattern (from spec clarification Q2)

```ts
await queue.add(
  "auto-submit-scheduled-attempt",
  { tenantSlug, attemptId, scheduledExamId },
  {
    jobId: `auto_submit:${attemptId}`, // dedup key
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
);
```

### Key Observations

- BullMQ drops a job silently if a job with the same `jobId` already exists in waiting/active/delayed state.
- This is the reactive-trigger mechanism from the heartbeat endpoint (FR-009, Clarification Q2).
- The heartbeat returns `200` immediately after enqueueing; submission is async.
- The idempotency re-check inside the worker (SELECT FOR UPDATE re-validation step 3) is the real idempotency gate regardless of the BullMQ dedup.
- The job-queue package (`packages/job-queue/src/job-schema.ts`) already defines `BaseJob`; new job types extend it.

### Alternatives Considered

- Redis pub/sub for reactive trigger: rejected — adds tight coupling and requires subscriber lifecycle management.
- Inline worker call from heartbeat: rejected — violates p95 < 100ms SLA on heartbeat endpoint (NFR-006).

---

## R-03: `pg_try_advisory_xact_lock` for Single-Attempt Race Prevention

### Decision

Use `pg_try_advisory_xact_lock(hashtext(...))` for single-attempt enforcement instead of SELECT COUNT FOR UPDATE (which does not prevent phantom inserts on non-existent rows).

### Pattern (from spec clarification Q3)

```ts
// In service layer, inside a transaction:
const lockKey = `${userId}:${scheduledExamId}`;
const lockResult = await db.execute(sql`SELECT pg_try_advisory_xact_lock(hashtext(${lockKey}))`);
const acquired = lockResult.rows[0]?.pg_try_advisory_xact_lock === true;
if (!acquired) {
  // Concurrent request in-flight — return 409
  throw new ScheduledExamError("CONCURRENT_ATTEMPT_LOCK_FAILED");
}

const count = await db.execute(
  sql`SELECT COUNT(*) FROM attempts WHERE user_id = ${userId} AND scheduled_exam_id = ${scheduledExamId}`,
);
if (Number(count.rows[0].count) > 0) {
  throw new ScheduledExamError("ALREADY_ATTEMPTED");
}
// Proceed to INSERT within same transaction
```

### Key Observations

- `pg_try_advisory_xact_lock` is transaction-scoped — released automatically on COMMIT or ROLLBACK (no manual release needed).
- `hashtext()` is a PostgreSQL built-in that produces a stable 32-bit integer from a string — safe for advisory lock keys.
- This is the canonical PostgreSQL pattern for "insert-if-not-exists" when the uniqueness condition is conditional (configurable `allow_single_attempt` policy, not a static DB constraint).
- Used only when `allow_single_attempt = true` — no lock overhead for the common case.
- Raw SQL via `db.execute(sql\`...\`)` is appropriate here since this is not a Drizzle query builder operation.

### Alternatives Considered

- `SELECT FOR UPDATE` on existing rows: rejected — cannot lock phantom rows.
- Unique DB constraint on `(user_id, scheduled_exam_id)`: rejected — `allow_single_attempt` is a runtime policy, not a universal constraint.

---

## R-04: Migration File Patterns (Tenant DB)

### Decision

Next migration numbers are `016` and `017`. File naming follows the `YYYYMMDD_NNN_description.ts` pattern with `PoolClient` as the only parameter type.

### Existing Migration Sequence

| Number  | File                                               | Schema Version |
| ------- | -------------------------------------------------- | -------------- |
| 014     | `20260401_014_mcq_exams.ts`                        | 1.20.0         |
| 015     | `20260402_015_traditional_exams.ts`                | 1.21.0         |
| **016** | `20260402_016_create_scheduled_exams.ts`           | **1.22.0**     |
| **017** | `20260402_017_add_scheduled_fields_to_attempts.ts` | **1.23.0**     |

### Pattern (from migrations 014 and 015)

```ts
import type { PoolClient } from "pg";

export const description = "...";

export async function up(client: PoolClient): Promise<void> {
  // PHASE 1: DDL inside transaction
  await client.query("BEGIN");
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS ...`);
    // B-tree indexes (non-concurrent)
    await client.query(`CREATE INDEX idx_... ON ...`);
    // Schema version bump
    await client.query(
      `UPDATE schema_versions SET version = '1.22.0', updated_at = NOW() WHERE id = 1`,
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }

  // PHASE 2: CONCURRENT unique indexes (outside transaction)
  await client.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_... ON ...`);
}
```

### Key Observations

- Two-phase pattern is mandatory whenever a CONCURRENT index is needed.
- CONCURRENT indexes cannot run inside a transaction block.
- `IF NOT EXISTS` on all DDL makes migrations re-runnable safely.
- Schema version is bumped inside Phase 1 transaction — never outside.
- Migration numbers must be zero-padded to 3 digits as part of the timestamp prefix.
- `apps/api/src/db/tenant/migrations/` is the ONLY location for tenant migration files.
- **Never modify existing migration files** (forward-only rule).

### Rationale

Two-phase approach is already established in migrations 014 and 015 for the exact same reason — CONCURRENT unique indexes on `code` fields.

---

## R-05: Route Registration Pattern (Hono, `apps/api/src/`)

### Decision

New scheduled-exam routes live in `apps/api/src/routes/backoffice/scheduled-exams/` (operator routes) and `apps/api/src/routes/mmc/` or a dedicated `apps/api/src/routes/scheduled-exams/` for student-facing routes. Route registration follows the `createMcqExamsRouter()` factory pattern.

### Pattern (from `apps/api/src/routes/backoffice/mcq-exams/index.ts`)

```ts
import { Hono } from "hono";
import { requireAnyPermission } from "../../../middleware/auth/resolve-rbac";
import type { BackofficeEnv } from "../types";

export function createScheduledExamsRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>();

  const readGuard = requireAnyPermission(["exam_manage", "content_manage", "content_read"]);
  const writeGuard = requireAnyPermission(["exam_manage", "content_manage"]);
  const studentGuard = requireAnyPermission(["student"]); // only role=STUDENT

  // Static routes BEFORE parameterised routes
  router.get("/scheduled-exams", readGuard, listScheduledExamsHandler);
  router.post("/scheduled-exams", writeGuard, createScheduledExamHandler);
  router.get("/scheduled-exams/:id", readGuard, getScheduledExamHandler);
  router.patch("/scheduled-exams/:id", writeGuard, updateScheduledExamHandler);
  router.delete("/scheduled-exams/:id", writeGuard, deleteScheduledExamHandler);
  router.post("/scheduled-exams/:id/workflow", writeGuard, workflowTransitionHandler);
  router.post("/scheduled-exams/:id/re-approve", writeGuard, reApproveHandler);
  router.post("/scheduled-exams/:id/attempts", studentGuard, startAttemptHandler);

  // Attempt-scoped routes
  router.post("/attempts/:attemptId/heartbeat", studentGuard, heartbeatHandler);
  router.post("/attempts/:attemptId/submit", studentGuard, submitAttemptHandler);

  return router;
}
```

### Handler pattern (from `create-exam.ts`)

```ts
import type { Context } from "hono";
import { createLogger } from "@zidney/logger";
import { someSchema } from "@zidney/validation/backoffice/scheduled-exams.schemas";
import { someService } from "@zidney/domain-core/scheduled-exam";

const logger = createLogger("scheduled-exams-route:create");

export async function createScheduledExamHandler(c: Context): Promise<Response> {
  try {
    const body = await c.req.json();
    const parsed = someSchema.safeParse(body);
    if (!parsed.success) return errorResponse(c, parsed.error);

    const db = getDb(c); // from BackofficeEnv context
    const audit = buildAuditCtx(c);

    const result = await someService(db, parsed.data, audit);
    return c.json(successResponse(result), 201);
  } catch (err) {
    return errorResponse(c, err);
  }
}
```

### Key Observations

- Route files split per operation (one handler per file), exactly as in `mcq-exams/`.
- A `helpers.ts` file per route directory provides `getDb()`, `buildAuditCtx()`, `successResponse()`, `errorResponse()`.
- `Hono<BackofficeEnv>` provides tenant DB client and auth context via `c.var`.
- Tenant middleware and license middleware are already applied at the parent router level — route handlers must NOT re-apply them.
- Static path segments (`/workflow`, `/re-approve`) MUST be registered before parameterised routes to avoid shadowing.

---

## R-06: Domain Core Module Pattern

### Decision

New module `packages/domain-core/src/scheduled-exam/` follows the `mcq-exams/` module structure: `entity.ts`, `repository.ts`, `service.ts`, `types.ts`, `validators.ts`, `errors.ts`, `index.ts`.

### Key Observations (from `mcq-exams.service.ts`, `mcq-exams.repository.ts`)

- Service layer: orchestrates business logic, manages TX (BEGIN/COMMIT/ROLLBACK), no HTTP imports.
- Repository layer: pure SQL functions, NO transactions opened — all TX in service layer.
- `DbClient` type is a local alias (typically `NodePgDatabase` or raw `pg.PoolClient`) passed as parameter.
- Logger created with `createLogger('module:operation')` from `@zidney/logger`.
- Errors thrown as named class instances (e.g., `new McqExamError('MCQ_EXAM_NOT_FOUND')`); route handlers catch and map to HTTP responses.
- No Drizzle ORM queries in repository that require the schema to be co-located in `packages/` — raw SQL (`client.query(...)`) is used. The Drizzle schema lives in `apps/api/`. The domain-core uses raw SQL via the passed `DbClient`.

### Hash Computation (from spec clarification Q1)

```ts
// packages/domain-core/src/scheduled-exam/scheduled-exam-hash.ts
import crypto from "node:crypto";

export const MCQ_HASH_FIELDS = [
  "id",
  "workflow_status",
  "title",
  "duration_minutes",
  "total_marks",
  "passing_marks",
  "question_selection_mode",
  "questions_count",
  "updated_at",
] as const;

export const TRADITIONAL_HASH_FIELDS = [
  "id",
  "workflow_status",
  "title",
  "duration_minutes",
  "total_marks",
  "passing_marks",
  "topics",
  "updated_at",
] as const;

export function computeBaseExamHash(
  examFields: Record<string, unknown>,
  fieldList: readonly string[],
): string {
  const subset = Object.fromEntries(
    fieldList
      .sort() // deterministic key order
      .map((k) => [
        k,
        examFields[k] instanceof Date ? (examFields[k] as Date).toISOString() : examFields[k],
      ]),
  );
  return crypto.createHash("sha256").update(JSON.stringify(subset)).digest("hex");
}
```

---

## Resolved Clarifications Summary

| #   | Question                                 | Resolution                                                                                     |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Q1  | Hash field set and algorithm             | SHA-256 of deterministic JSON; field lists as exported constants in `scheduled-exam-hash.ts`   |
| Q2  | Worker multi-tenant + reactive trigger   | Per-tenant dispatcher enqueues per-tenant jobs; heartbeat enqueues BullMQ job (no inline call) |
| Q3  | Single-attempt lock strategy             | `pg_try_advisory_xact_lock(hashtext(...))` replaces invalid `WITH LOCK` pattern                |
| Q4  | FR-010 HTTP response for late submission | HTTP 200 with `auto_submitted: true` and submission data                                       |
| Q5  | Student authorization boundary           | Workspace JWT + `role = STUDENT` guard; no per-exam enrollment at Stage 38                     |
