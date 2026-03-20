# Technical Plan: Semesters (STAGE_27)

**Stage:** STAGE_27_SEMESTERS  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Plan Date:** 2026-03-20  
**Risk Level:** HIGH  
**Architect:** Zidney Orchestrator  
**Constitution Version:** v1.2.0

---

## Plan Summary

This plan details the complete technical implementation of the Semesters academic time-segmentation
entity for a Zidney workspace. The implementation follows the same layered architecture established
by STAGE_22 through STAGE_26 (Divisions → Departments → Groups → Hierarchy → Teams).

**Scope of this plan:**

- One forward-only tenant DB migration (creates `semesters` table, alters `students` to add
  `semester_id` FK)
- Drizzle ORM schema definitions for `semesters` and updated `students`
- Domain package `packages/domain-core/src/semesters/` with types, errors, repository, and service
- Validation schemas in `packages/validation/src/backoffice/semesters.schemas.ts`
- Five route handlers + helpers + index under
  `apps/api/src/routes/backoffice/semesters/`
- Route registration in `apps/api/src/app.ts`
- Unit tests for service layer (vitest)
- Integration tests for all five API endpoints (vitest with handler mocking)
- Package export registration in `packages/domain-core/package.json`

**NOT in scope:**

- `subjects` table modification (delegated to STAGE_28)
- Dedicated student semester assignment endpoint (assignment via student `PATCH` — governed by
  student domain stage)
- Hard delete
- Frontend changes

---

## Phase 0 — Research & Pattern Resolution (Complete)

### Migration pattern (from `20260316_001_divisions.ts` + `20260319_004_teams.ts`)

```typescript
export const description = "...";
export async function up(client: PoolClient) {
  await client.query("BEGIN");
  try {
    // DDL steps
    // schema_version bump
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}
```

- All DDL in a single `BEGIN/COMMIT` block
- `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` for idempotency
- `schema_version` bumped from `1.10.0` → `1.11.0`
- Latest migration: `20260319_004_teams.ts` → next file: `20260320_005_semesters.ts`

### Schema pattern (from `divisions.schema.ts`, `teams.schema.ts`)

```typescript
export const semesters = pgTable('semesters', { ... }, (table) => ({
  idx_semesters_status: index('idx_semesters_status').on(table.status),
  ...
}))
```

- Functional partial unique index (`LOWER(name) WHERE deleted_at IS NULL`) owned by migration only
  (Drizzle cannot express this; no `uniqueIndex()` in schema declaration)
- Drizzle `varchar` for status (not `pgEnum`) — matches all prior stages
- `deleted_at TIMESTAMPTZ` for soft delete

### Domain service pattern (from `teams.service.ts`)

- All write operations open `BEGIN` directly on the `DbClient`, wrap in `try/catch`, always call
  `ROLLBACK` in catch before re-throw
- `SELECT ... FOR UPDATE` used inside transaction for concurrent safety on delete and assignment
- Read operations have no transaction

### Pagination pattern

The spec explicitly requires **page/limit (offset-based) pagination** for semesters, not the
cursor-based pagination used by teams/divisions. This is intentional — semesters are expected to be
a small set and administrators need random page access.

Response shape:

```json
{ "items": [...], "total": <count>, "page": <page>, "limit": <limit> }
```

SQL: `OFFSET (page - 1) * limit LIMIT limit`

### Route handler pattern (from `apps/api/src/routes/backoffice/teams/`)

Each handler file:

- Imports its domain service function from `@zidney/domain-core/semesters`
- Uses `getDb(c)` and `buildAuditCtx(c)` from `./helpers`
- Calls validation schema `.parseAsync()` before service call
- Returns `c.json(successResponse(result), status)`
- Delegates all errors to `semestersErrorResponse(c, err)` in helpers

### Error response pattern

`helpers.ts` re-exports `successResponse` and implements `semestersErrorResponse` by checking if
`err instanceof SemestersError`, pulling `err.httpStatus` and `err.code` for the structured
envelope, and falling back to 500 with `INTERNAL_ERROR` for unknown errors.

---

## Phase 1 — Data Model

### 1.1 New Table: `semesters`

```sql
CREATE TABLE IF NOT EXISTS semesters (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  start_date  DATE,
  end_date    DATE,
  status      VARCHAR(20)  NOT NULL DEFAULT 'ENABLED',
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT semesters_status_check CHECK (status IN ('ENABLED', 'DISABLED'))
);
```

**Indexes:**

```sql
-- Case-insensitive unique name among active (non-deleted) semesters
CREATE UNIQUE INDEX IF NOT EXISTS semesters_name_lower_unique_active
  ON semesters (LOWER(name)) WHERE deleted_at IS NULL;

-- Status filter
CREATE INDEX IF NOT EXISTS idx_semesters_status
  ON semesters (status) WHERE deleted_at IS NULL;

-- start_date queries
CREATE INDEX IF NOT EXISTS idx_semesters_start_date
  ON semesters (start_date) WHERE deleted_at IS NULL;

-- Efficient soft-delete exclusion
CREATE INDEX IF NOT EXISTS idx_semesters_deleted_at
  ON semesters (deleted_at);
```

### 1.2 Altered Table: `students`

```sql
-- Add nullable semester_id FK (ON DELETE RESTRICT — existing FK pattern from earlier stages)
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS semester_id UUID REFERENCES semesters(id) ON DELETE RESTRICT;

-- FK traversal index
CREATE INDEX IF NOT EXISTS idx_students_semester_id
  ON students (semester_id) WHERE semester_id IS NOT NULL;
```

**Rationale for `ON DELETE RESTRICT`:** Prevents hard-deleting a semester while students are
assigned. Since hard-delete is forbidden by the application, this DB-level guard is a safety net
only. The service layer enforces soft-delete-with-reference-check before this constraint fires.

### 1.3 Schema Version

```sql
UPDATE _schema_versions
  SET version = '1.11.0',
      updated_at = NOW()
  WHERE service = 'tenant';
```

Previous: `1.10.0` (STAGE_26_TEAMS) → New: `1.11.0`

### 1.4 Unique Name Constraint Design

The `LOWER(name) WHERE deleted_at IS NULL` partial index enforces case-insensitive uniqueness among
active semesters at the DB level. Because Drizzle ORM cannot represent a partial functional index
in a schema file, the index is declared only in the migration DDL. The Drizzle schema file will
**not** declare a `uniqueIndex()` on `name` — consistent with the pattern used for divisions, teams,
and other soft-delete entities.

The service-layer `SELECT FOR UPDATE` guard inside create/update transactions provides an additional
concurrent-safe uniqueness check that precedes the DB unique constraint violation, giving clean
409 error codes instead of raw PG `23505` errors.

---

## Phase 2 — Implementation Plan (Ordered)

### Layer 1: Migration

**File:** `apps/api/src/db/tenant/migrations/20260320_005_semesters.ts`

Steps inside single `BEGIN/COMMIT`:

1. `CREATE TABLE IF NOT EXISTS semesters` — all columns + status CHECK
2. `CREATE UNIQUE INDEX IF NOT EXISTS semesters_name_lower_unique_active`
3. `CREATE INDEX IF NOT EXISTS idx_semesters_status`
4. `CREATE INDEX IF NOT EXISTS idx_semesters_start_date`
5. `CREATE INDEX IF NOT EXISTS idx_semesters_deleted_at`
6. `ALTER TABLE students ADD COLUMN IF NOT EXISTS semester_id` with FK + `ON DELETE RESTRICT`
7. `CREATE INDEX IF NOT EXISTS idx_students_semester_id`
8. `UPDATE _schema_versions SET version = '1.11.0'`

---

### Layer 2: Drizzle Schema

**File:** `apps/api/src/db/tenant/schemas/semesters.schema.ts`

```typescript
import { date, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const semesters = pgTable(
  "semesters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    start_date: date("start_date"),
    end_date: date("end_date"),
    status: varchar("status", { length: 20 }).notNull().default("ENABLED"),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("idx_semesters_status").on(table.status),
    startDateIdx: index("idx_semesters_start_date").on(table.start_date),
    deletedAtIdx: index("idx_semesters_deleted_at").on(table.deleted_at),
    // Partial functional unique index semesters_name_lower_unique_active
    // is owned by migration; not declared here (Drizzle cannot express partial functional index).
  }),
);

export type Semester = typeof semesters.$inferSelect;
export type NewSemester = typeof semesters.$inferInsert;
```

**File:** `apps/api/src/db/tenant/schemas/students.schema.ts` (update)

Add `semester_id` column to the existing `pgTable` definition:

```typescript
semester_id: uuid('semester_id').references(() => semesters.id, { onDelete: 'restrict' }),
```

Add `semesterIdIdx` to the table callback, and import `semesters` from `./semesters.schema`.

---

### Layer 3: Domain Package — Types

**File:** `packages/domain-core/src/semesters/semesters.types.ts`

Exports:

- `DbClient` — structural interface (same as in every domain module)
- `AuditContext` — same interface (user_id, correlation_id, workspace_slug, workspace_id)
- `SemesterStatus` enum (`ENABLED`, `DISABLED`)
- `SemesterRow` — mirrors DB row: id, name, description, start_date, end_date, status, deleted_at,
  created_at, updated_at (all date/timestamp fields as `Date | string | null` matching PG driver
  output)
- `ListSemestersInput` — `{ page: number; limit: number; status?: 'ENABLED'|'DISABLED'; search?: string }`
- `ListSemestersResult` — `{ items: SemesterRow[]; total: number; page: number; limit: number }`
- `CreateSemesterInput` — `{ name: string; description?: string|null; start_date?: string|null; end_date?: string|null }`
- `UpdateSemesterInput` — all fields optional; same as create but partial
- `DeleteSemesterResult` — `{ deleted: boolean }`

---

### Layer 4: Domain Package — Errors

**File:** `packages/domain-core/src/semesters/semesters.errors.ts`

Error codes:

| Code                          | HTTP |
| ----------------------------- | ---- |
| `SEMESTER_NOT_FOUND`          | 404  |
| `SEMESTER_NAME_DUPLICATE`     | 409  |
| `SEMESTER_DATE_RANGE_INVALID` | 422  |
| `SEMESTER_DISABLED`           | 422  |
| `SEMESTER_HAS_STUDENTS`       | 422  |
| `SEMESTER_HAS_SUBJECTS`       | 422  |
| `VALIDATION_ERROR`            | 422  |

Class pattern (matching `TeamsError`):

```typescript
export class SemestersError extends Error {
  constructor(
    public readonly code: SemestersErrorCode,
    message?: string,
  ) {
    super(message ?? SEMESTERS_ERROR_MESSAGES[code]);
    this.name = "SemestersError";
  }
  get httpStatus(): number {
    return SEMESTERS_ERROR_HTTP_STATUS[this.code];
  }
}
```

---

### Layer 5: Domain Package — Repository

**File:** `packages/domain-core/src/semesters/semesters.repository.ts`

Pure SQL query functions — no transactions opened here (service layer owns transactions).

| Function                                   | SQL Operation                                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `findSemesters(db, opts)`                  | SELECT with status/search filter, ORDER BY name, OFFSET/LIMIT                                                     |
| `countSemesters(db, opts)`                 | SELECT COUNT(\*) with same filters                                                                                |
| `findSemesterById(db, id)`                 | SELECT by id WHERE deleted_at IS NULL                                                                             |
| `lockSemesterForUpdate(db, id)`            | SELECT id, status, deleted_at FROM semesters WHERE id=? FOR UPDATE                                                |
| `semesterNameExists(db, name, excludeId?)` | SELECT EXISTS for LOWER(name) match WHERE deleted_at IS NULL                                                      |
| `insertSemester(db, input)`                | INSERT INTO semesters RETURNING \*                                                                                |
| `updateSemesterRow(db, id, input)`         | UPDATE semesters SET ... updated_at=NOW() WHERE id=? RETURNING \*                                                 |
| `softDeleteSemester(db, id)`               | UPDATE semesters SET deleted_at=NOW(), updated_at=NOW() WHERE id=?                                                |
| `countStudentsForSemester(db, id)`         | SELECT COUNT(\*) FROM students WHERE semester_id=? AND deleted_at IS NULL (if soft-delete); plain COUNT otherwise |
| `countSubjectsForSemester(db, id)`         | SELECT 0 always (subjects table does not exist yet — returns 0 so delete guard passes for subjects)               |

> **Note on `countSubjectsForSemester`:** The `subjects` table does not exist until STAGE_28. The
> deletion guard for SEMESTER_HAS_SUBJECTS can return 0 in this migration. This is safe because
> there are no subjects to reference semesters. When STAGE_28 adds the `subjects` table with
> `semester_id FK`, it must also update this query (or the service will naturally remain compatible
> as the subjects SELECT COUNT will start finding rows).

> **Alternative approach:** Skip the subjects guard in the delete service entirely and add a
> comment noting it will be wired in STAGE_28; for now the hard FK `ON DELETE RESTRICT` on
> `subjects.semester_id` provides a DB-level safety net when the column exists. **This is the
> chosen approach** — `deleteSemester` will only guard on `students` in STAGE_27, keeping the
> service lean and adding annotation for STAGE_28.

---

### Layer 6: Domain Package — Service

**File:** `packages/domain-core/src/semesters/semesters.service.ts`

#### `listSemesters(db, input) → Promise<ListSemestersResult>` (read-only)

1. Call `countSemesters(db, opts)` for total
2. Call `findSemesters(db, { ...opts, offset: (page - 1) * limit })` for page
3. Return `{ items, total, page, limit }`

#### `createSemester(db, input, audit) → Promise<SemesterRow>`

1. `BEGIN`
2. Validate date range: if both `start_date` and `end_date` provided and non-null, assert
   `end_date >= start_date`; throw `SEMESTER_DATE_RANGE_INVALID`
3. Check `semesterNameExists(db, input.name)` → throw `SEMESTER_NAME_DUPLICATE` if true
4. `insertSemester(db, input)` → returns row
5. `COMMIT`
6. Log `semester.created`
7. Return row

#### `getSemesterById(db, id) → Promise<SemesterRow>`

1. `findSemesterById(db, id)` → if null throw `SEMESTER_NOT_FOUND`
2. Return row

#### `updateSemester(db, id, input, audit) → Promise<SemesterRow>`

1. `BEGIN`
2. `findSemesterById(db, id)` → if null throw `SEMESTER_NOT_FOUND`
3. If `input.name` provided, check `semesterNameExists(db, input.name, id)` → throw
   `SEMESTER_NAME_DUPLICATE` if found for a different row
4. Resolve effective `start_date` and `end_date` (merge input with existing row values) and
   validate ordering: if both effective dates are non-null, assert `end_date >= start_date`; throw
   `SEMESTER_DATE_RANGE_INVALID`
5. `updateSemesterRow(db, id, input)` → returns updated row
6. `COMMIT`
7. Log `semester.updated`
8. Return updated row

#### `deleteSemester(db, id, audit) → Promise<void>`

1. `BEGIN`
2. `lockSemesterForUpdate(db, id)`:
   - If row missing throw `SEMESTER_NOT_FOUND`
   - If `deleted_at IS NOT NULL` throw `SEMESTER_NOT_FOUND`
3. `countStudentsForSemester(db, id)` → if > 0 throw `SEMESTER_HAS_STUDENTS`
4. `softDeleteSemester(db, id)`
5. `COMMIT`
6. Log `semester.deleted`

> **Concurrency safety note:** `SELECT ... FOR UPDATE` in step 2 ensures that if a second concurrent
> delete request comes in, it blocks until the first transaction commits. After the lock releases,
> the second request reads `deleted_at IS NOT NULL` and correctly returns `SEMESTER_NOT_FOUND`.
> Similarly, a concurrent student assignment transaction using `SELECT status FROM semesters FOR
UPDATE` (in the student domain) will serialize against this delete.

---

### Layer 7: Domain Package — Barrel

**File:** `packages/domain-core/src/semesters/index.ts`

```typescript
export * from "./semesters.errors";
export * from "./semesters.service";
export type {
  AuditContext,
  CreateSemesterInput,
  DbClient,
  DeleteSemesterResult,
  ListSemestersInput,
  ListSemestersResult,
  SemesterRow,
  UpdateSemesterInput,
} from "./semesters.types";
export { SemesterStatus } from "./semesters.types";
```

**File:** `packages/domain-core/package.json` (update)

Add to `exports`:

```json
"./semesters": "./src/semesters/index.ts",
"./teams": "./src/teams/index.ts"
```

> Note: `./teams` is currently absent from the package.json exports map (STAGE_26 oversight);
> adding it aligns the manifest with actual usage.

---

### Layer 8: Validation Schemas

**File:** `packages/validation/src/backoffice/semesters.schemas.ts`

| Schema                     | Validates                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `listSemestersQuerySchema` | `page` (int ≥1, default 1), `limit` (1–100, default 20), `status` (enum, optional), `search` (string, optional)             |
| `semesterParamsSchema`     | `id` (UUID string)                                                                                                          |
| `createSemesterBodySchema` | `name` (1–255, trimmed, required), `description` (max 5000, nullable), `start_date` (YYYY-MM-DD or null), `end_date` (same) |
| `updateSemesterBodySchema` | All create fields optional; `.refine()` to ensure at least one field provided                                               |

`limit` out of range → Zod validation fails → handler catches ZodError → returns 422
`VALIDATION_ERROR`. No silent clamping.

Date validation pattern (`start_date`, `end_date`): validate format as ISO 8601 date regex
`/^\d{4}-\d{2}-\d{2}$/`. Cross-field ordering is validated in the service layer to apply
consistent error codes on both create and update.

---

### Layer 9: Route Handlers

**Directory:** `apps/api/src/routes/backoffice/semesters/`

#### `helpers.ts`

Shared utilities (same pattern as `teams/helpers.ts`):

- `getDb(c)` — extracts `tenant.pool` from Hono context
- `buildAuditCtx(c)` — builds `AuditContext` from authenticated user
- `successResponse(data)` — returns `{ success: true, data, error: null }`
- `semestersErrorResponse(c, err)` — maps `SemestersError` to HTTP + structured envelope; ZodError
  maps to 422 `VALIDATION_ERROR`; unknown errors map to 500 `INTERNAL_ERROR`

#### `list-semesters.ts`

```
GET /semesters — listSemestersQuerySchema → listSemesters() → 200 successResponse
```

#### `create-semester.ts`

```
POST /semesters — createSemesterBodySchema (body) → createSemester() → 201 successResponse
```

#### `get-semester.ts`

```
GET /semesters/:id — semesterParamsSchema (param) → getSemesterById() → 200 successResponse
```

#### `update-semester.ts`

```
PATCH /semesters/:id — semesterParamsSchema + updateSemesterBodySchema → updateSemester() → 200 successResponse
```

#### `delete-semester.ts`

```
DELETE /semesters/:id — semesterParamsSchema → deleteSemester() → 200 successResponse({ deleted: true })
```

#### `index.ts`

Creates and exports `semestersRouter` mounting all five handlers on correct paths. No sub-routes
with conflicting path params — simple CRUD only.

```typescript
router.get("/semesters", listSemestersHandler);
router.post("/semesters", createSemesterHandler);
router.get("/semesters/:id", getSemesterHandler);
router.patch("/semesters/:id", updateSemesterHandler);
router.delete("/semesters/:id", deleteSemesterHandler);
```

---

### Layer 10: Route Registration

**File:** `apps/api/src/app.ts` (update)

Add after the teams router registration:

```typescript
import { semestersRouter } from "./routes/backoffice/semesters/index";
// ...
app.route("/api/v1/backoffice/workspace", semestersRouter);
```

---

### Layer 11: Unit Tests

**File:** `packages/domain-core/src/semesters/__tests__/semesters.service.test.ts`

Test coverage:

| Test Group        | Cases                                                                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSemester`  | Happy path; duplicate name → 409; end < start → 422; only start → ok; only end → ok                                                                                                    |
| `getSemesterById` | Found; not found → 404                                                                                                                                                                 |
| `updateSemester`  | Name change happy path; name collision (other row) → 409; date range invalid → 422; effective date validation (new end < existing start) → 422; status toggle; allows description null |
| `deleteSemester`  | Happy path (no refs); has students → 422; already deleted → 404; not found → 404                                                                                                       |
| `listSemesters`   | Returns page 1; status filter; search filter; empty result; page 2                                                                                                                     |

Tests use a mocked `DbClient` that returns predetermined query results. No real DB required.

---

### Layer 12: Integration Tests

**File:**
`apps/api/src/routes/backoffice/semesters/__tests__/semesters.integration.test.ts`

Pattern (same as `teams.integration.test.ts`):

- `vi.mock('@zidney/domain-core/semesters', ...)` — mock all service functions
- `vi.mock('../helpers', ...)` — mock `getDb`, `buildAuditCtx`, `successResponse`,
  `semestersErrorResponse`
- Test each handler in isolation; assert HTTP status and response shape

Coverage per handler:

| Handler           | Cases                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `list-semesters`  | No filters → 200; status filter → 200; empty → 200                                                         |
| `create-semester` | Happy path → 201; `SEMESTER_NAME_DUPLICATE` → 409; `SEMESTER_DATE_RANGE_INVALID` → 422; missing name → 422 |
| `get-semester`    | Found → 200; `SEMESTER_NOT_FOUND` → 404                                                                    |
| `update-semester` | Name update → 200; `SEMESTER_NOT_FOUND` → 404; `SEMESTER_NAME_DUPLICATE` → 409                             |
| `delete-semester` | No refs → 200; `SEMESTER_HAS_STUDENTS` → 422; `SEMESTER_NOT_FOUND` → 404                                   |

---

## Phase 3 — API Contracts (Confirmed)

### Endpoint List

| Method | Path           | Handler               | Schema Inputs                          | Success |
| ------ | -------------- | --------------------- | -------------------------------------- | ------- |
| GET    | /semesters     | listSemestersHandler  | query: listSemestersQuerySchema        | 200     |
| POST   | /semesters     | createSemesterHandler | body: createSemesterBodySchema         | 201     |
| GET    | /semesters/:id | getSemesterHandler    | param: semesterParamsSchema            | 200     |
| PATCH  | /semesters/:id | updateSemesterHandler | param + body: updateSemesterBodySchema | 200     |
| DELETE | /semesters/:id | deleteSemesterHandler | param: semesterParamsSchema            | 200     |

### Response Envelope

All responses conform to:

```typescript
{ success: boolean; data: T | null; error: { code: string; message: string } | null }
```

---

## Phase 4 — Transaction Boundaries (Confirmed)

| Operation         | Transaction | Lock Strategy                                                      | Rollback Trigger                           |
| ----------------- | ----------- | ------------------------------------------------------------------ | ------------------------------------------ |
| `createSemester`  | Yes         | Implicit deferred via partial unique index + name check FOR UPDATE | Duplicate, date error, DB error            |
| `updateSemester`  | Yes         | Row read + name check within transaction                           | Not found, duplicate, date error, DB error |
| `deleteSemester`  | Yes         | `SELECT FOR UPDATE` on semester row                                | Not found, has students, DB error          |
| `listSemesters`   | No          | None — read only                                                   | N/A                                        |
| `getSemesterById` | No          | None — read only                                                   | N/A                                        |

---

## Phase 5 — Non-Functional Compliance

| Requirement              | Implementation                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Structured logging       | All service write functions emit `logger.info(event, { user_id, workspace_id, ... })` |
| No `console.log`         | `createLogger('semesters-service')` from `@zidney/logger`                             |
| Tenant isolation         | All DB access via `getDb(c)` which reads `tenant.pool` from Hono context              |
| License middleware       | Inherited from `/api/v1/backoffice/workspace` global middleware in app.ts             |
| Rate limiting            | Inherited from workspace-scoped middleware stack                                      |
| SQL injection prevention | All queries use parameterized placeholders (`$1`, `$2`, ...); no string interpolation |
| Input validation         | Zod schemas validated before any service call; ZodError → 422 `VALIDATION_ERROR`      |
| Division boundary        | Semester filter is additive only; division-based queries not modified                 |

---

## Phase 6 — File List (Complete Ordered Delivery)

### New Files

```
apps/api/src/db/tenant/migrations/20260320_005_semesters.ts
apps/api/src/db/tenant/schemas/semesters.schema.ts
packages/domain-core/src/semesters/semesters.types.ts
packages/domain-core/src/semesters/semesters.errors.ts
packages/domain-core/src/semesters/semesters.repository.ts
packages/domain-core/src/semesters/semesters.service.ts
packages/domain-core/src/semesters/__tests__/semesters.service.test.ts
packages/domain-core/src/semesters/index.ts
packages/validation/src/backoffice/semesters.schemas.ts
apps/api/src/routes/backoffice/semesters/helpers.ts
apps/api/src/routes/backoffice/semesters/list-semesters.ts
apps/api/src/routes/backoffice/semesters/create-semester.ts
apps/api/src/routes/backoffice/semesters/get-semester.ts
apps/api/src/routes/backoffice/semesters/update-semester.ts
apps/api/src/routes/backoffice/semesters/delete-semester.ts
apps/api/src/routes/backoffice/semesters/index.ts
apps/api/src/routes/backoffice/semesters/__tests__/semesters.integration.test.ts
```

### Modified Files

```
apps/api/src/db/tenant/schemas/students.schema.ts
packages/domain-core/package.json
apps/api/src/app.ts
```

---

## Phase 7 — Architecture Compliance Checklist

| Rule                                              | Status                                                         |
| ------------------------------------------------- | -------------------------------------------------------------- |
| Database-per-tenant                               | ✓ All tables in tenant DB; no cross-tenant joins               |
| No global DB singleton                            | ✓ Pool accessed via `tenant.pool` from resolver                |
| License middleware mandatory                      | ✓ Mounted at `/api/v1/backoffice/workspace` level              |
| Layer boundaries: UI → domain packages disallowed | ✓ No domain imports in route handlers or UI                    |
| Import boundary: apps → packages allowed          | ✓ Domain function imports from `@zidney/domain-core/semesters` |
| No db schema imports in UI                        | ✓ Drizzle schemas not imported by route handlers               |
| No HTTP logic in domain packages                  | ✓ Service layer has no Hono/HTTP imports                       |
| All writes transactional                          | ✓ BEGIN/COMMIT/ROLLBACK in every write service fn              |
| Server-authoritative time                         | ✓ created_at/updated_at/deleted_at all use DB NOW()            |
| Forward-only migration                            | ✓ No down() function; reversible only via snapshot             |
| Migration naming convention                       | ✓ `20260320_005_semesters.ts`                                  |
| Schema version incremented                        | ✓ 1.10.0 → 1.11.0                                              |
| Soft delete only                                  | ✓ `deleted_at` timestamp; hard delete not implemented          |
| Structured logging (no console.log)               | ✓ `@zidney/logger` used exclusively                            |
| Rate limiting                                     | ✓ Inherited from workspace middleware stack                    |
| Input validation at boundary                      | ✓ Zod schemas before any service invocation                    |
| Division boundary preserved                       | ✓ No modification to any division-scoped query                 |
| Attempt engine unaffected                         | ✓ No snapshot, attempt, or grading logic touched               |

---

## Plan Sign-Off

This plan fully covers the spec defined in `specs/runtime/027-semesters/spec.md` with all
clarifications from session 2026-03-20 applied:

1. **Migration ordering clarified**: STAGE_27 does NOT touch `subjects` table.
2. **Concurrent soft-delete**: `SELECT ... FOR UPDATE` pattern on semester row.
3. **Pagination**: page/limit (offset-based), HTTP 422 for out-of-range limit (no silent clamping).
4. **Assignment race condition**: `SELECT status FOR UPDATE` before write.
5. **FK ON DELETE clause**: `RESTRICT` on students.semester_id.

**Ready for task breakdown (Step 4).**
