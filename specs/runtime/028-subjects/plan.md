# Technical Plan: Subjects (STAGE_28)

**Stage:** STAGE_28_SUBJECTS  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Plan Date:** 2026-03-20  
**Risk Level:** HIGH  
**Architect:** Zidney Orchestrator  
**Constitution Version:** v1.2.0

---

## Plan Summary

This plan details the complete technical implementation of the **Subject** domain — the root
academic entity within a Zidney tenant workspace. Subjects are the upstream prerequisite for every
piece of downstream academic content (questions, exams, exercises, library items, live sessions,
categories). Nothing in Phase 04+ may exist without a subject.

**Scope of this plan:**

- One forward-only tenant DB migration (`20260320_006_subjects.ts`) creating the `subjects` table,
  all required indexes, FKs to `divisions` and `semesters`, and a `schema_version` bump from
  `1.11.0` → `1.12.0`
- Drizzle ORM schema definition for `subjects`
- Domain package `packages/domain-core/src/subjects/` with types, errors, dependency registry,
  repository, and service
- Validation schemas in `packages/validation/src/backoffice/subjects.schemas.ts`
- Seven route handlers + helpers + index under `apps/api/src/routes/backoffice/subjects/`:
  List, Create, Get, Update, Transition, Delete, and Runtime (ACTIVE-only)
- Route registration in `apps/api/src/app.ts`
- Unit tests for service layer and state machine
- Integration tests for all seven API endpoints

**NOT in scope:**

- Translation storage schema (handled by STAGE_19, already in place)
- Downstream content table FKs (registered additively by their respective downstream stages)
- Frontoffice subject page (STAGE_UI; no direct frontoffice subject CRUD per spec)
- Hard delete (soft-delete only per FR-07)
- Backward workflow transition (ARCHIVED is terminal per FR-14)

---

## Architectural Scope Confirmation

| Rule                                | Status                                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| No cross-tenant data access         | ✓ `subjects` table resides exclusively in tenant DB                                                  |
| No middleware bypass                | ✓ All routes: correlationId → tenantResolver → licenseEnforcement → auth → handler                   |
| No direct DB instantiation          | ✓ All DB access from `c.get('tenant').pool` via tenant resolver context                              |
| No grading logic outside Worker     | ✓ Feature does not touch attempt/grading systems                                                     |
| No weakening of snapshot integrity  | ✓ Subject FK in downstream snapshots is immutable after capture; this stage does not touch snapshots |
| No weakening of version enforcement | ✓ `schema_version` bumped; license middleware enforces `schema_version >= MIN`                       |
| No layer boundary violation         | ✓ UI→DB import forbidden; packages→apps import forbidden                                             |

No ADR required. All decisions align with existing ADRs 0001–0008.

---

## Phase 0 — Research & Pattern Resolution (Complete)

### Migration pattern (from `20260320_005_semesters.ts`)

```typescript
export const description = "...";
export async function up(client: PoolClient): Promise<void> {
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

- All DDL in a single `BEGIN/COMMIT` block with `ROLLBACK` on any error
- `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` for idempotency
- `schema_version` bumped `1.11.0` → `1.12.0`
- Previous migration: `20260320_005_semesters.ts` → next file: `20260320_006_subjects.ts`

### Schema pattern (from `semesters.schema.ts`, `divisions.schema.ts`)

- Partial functional unique index (`LOWER(name) WHERE deleted_at IS NULL`) owned by migration DDL
  only. Drizzle cannot represent partial functional indexes; no `uniqueIndex()` declared in schema.
- Partial unique index for `code` also migration-only: `UNIQUE(code) WHERE code IS NOT NULL`
- Drizzle `varchar` for status (not `pgEnum`) — consistent with all prior stages
- FK columns declared as `uuid` in Drizzle; FK constraints in migration DDL only
- `deleted_at TIMESTAMPTZ` for soft delete

### Domain service pattern (from `semesters.service.ts`)

- Write operations open `BEGIN` on `DbClient`, wrap in `try/catch`, always `ROLLBACK` in catch
- CAS (Compare-And-Swap) for workflow transitions: `UPDATE subjects SET status = $new WHERE id = $id AND status = $expected`; zero rows affected → `SUBJECT_TRANSITION_CONFLICT`
- Read operations: no transaction; snapshot isolation sufficient
- `lockSubjectForUpdate` uses `SELECT ... FOR UPDATE NOWAIT` for concurrent guardsi
- `pg` error code `55P03` (lock conflict) mapped to 503 in `subjectsErrorResponse`

### Subjects workflow state machine

Subjects use a **custom inline state machine** (not the global `WorkflowEngine` which targets
COMPLETED/UNDER_REVIEW/APPROVED/ENABLED). The subjects state machine defines:

```
DRAFT ──▶ ACTIVE ──▶ ARCHIVED
                         ▲ (terminal — no outbound transition)
```

Allowed transitions:

| from     | to       | valid?       |
| -------- | -------- | ------------ |
| DRAFT    | ACTIVE   | ✓            |
| ACTIVE   | ARCHIVED | ✓            |
| DRAFT    | ARCHIVED | ✗            |
| ACTIVE   | DRAFT    | ✗            |
| ARCHIVED | anything | ✗ (terminal) |

Validation: `SUBJECT_INVALID_TRANSITION` (422) for any non-listed transition.

### Dependency check registry pattern

The subjects dependency check registry is a **configurable function registry** — an array of
async check functions each querying one dependent table. At STAGE_28 launch, no downstream content
tables exist yet (MCQ, exams, etc. come later). The registry starts empty. Downstream stages add
their own check entries during their implementation. The `deleteSubject` service function
iterates the registry and aggregates counts before setting `deleted_at`.

### Pagination pattern

Offset-based pagination (`page` + `limit`) following the semesters pattern. Response shape:

```json
{ "items": [...], "total": <count>, "page": <page>, "limit": <limit> }
```

SQL template: `OFFSET (page - 1) * limit LIMIT limit`

### Route registration pattern (from `app.ts`)

```typescript
app.route("/api/v1/backoffice/workspace", subjectsRouter);
```

The subjects router mounts all routes at `/subjects` prefix. The runtime endpoint
(`GET /subjects/runtime`) is declared **before** `GET /subjects/:id` in router registration to
prevent Hono matching `"runtime"` as the `:id` parameter value.

---

## Phase 1 — Data Model

### 1.1 New Table: `subjects`

```sql
CREATE TABLE IF NOT EXISTS subjects (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name               VARCHAR(255)  NOT NULL,
  code               VARCHAR(100),
  division_id        UUID          REFERENCES divisions(id) ON DELETE RESTRICT,
  semester_id        UUID          REFERENCES semesters(id) ON DELETE RESTRICT,
  is_multilanguage   BOOLEAN       NOT NULL DEFAULT false,
  default_language   VARCHAR(10)   NOT NULL,
  description        TEXT,
  status             VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT subjects_status_check CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))
);
```

### 1.2 Indexes

```sql
-- Case-insensitive name uniqueness among non-deleted subjects (partial functional)
CREATE UNIQUE INDEX IF NOT EXISTS subjects_name_lower_unique_active
  ON subjects (LOWER(name)) WHERE deleted_at IS NULL;

-- Partial unique index for optional code (NULL values excluded from uniqueness check)
CREATE UNIQUE INDEX IF NOT EXISTS subjects_code_unique_non_null
  ON subjects (code) WHERE code IS NOT NULL AND deleted_at IS NULL;

-- FK traversal — division filter
CREATE INDEX IF NOT EXISTS idx_subjects_division_id
  ON subjects (division_id) WHERE deleted_at IS NULL;

-- FK traversal — semester filter
CREATE INDEX IF NOT EXISTS idx_subjects_semester_id
  ON subjects (semester_id) WHERE deleted_at IS NULL;

-- Status filter (runtime ACTIVE queries, workflow transition checks)
CREATE INDEX IF NOT EXISTS idx_subjects_status
  ON subjects (status) WHERE deleted_at IS NULL;

-- Compound: division + status (runtime active-by-division queries)
CREATE INDEX IF NOT EXISTS idx_subjects_division_status
  ON subjects (division_id, status) WHERE deleted_at IS NULL;

-- Compound: semester + status (runtime active-by-semester queries)
CREATE INDEX IF NOT EXISTS idx_subjects_semester_status
  ON subjects (semester_id, status) WHERE deleted_at IS NULL;

-- Soft-delete exclusion scan optimization
CREATE INDEX IF NOT EXISTS idx_subjects_deleted_at
  ON subjects (deleted_at);
```

**Rationale for compound indexes:** `(division_id, status)` and `(semester_id, status)` serve the
runtime query pattern `WHERE division_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`.
Without these, PostgreSQL would require a sequential scan or two separate index scans merged via
bitmap. Identified as a gap in the performance checklist (CHK047–CHK080) and addressed here.

### 1.3 Schema Version Bump

```sql
UPDATE _schema_versions
  SET version = '1.12.0',
      updated_at = NOW()
  WHERE name = 'schema_version';
```

Previous: `1.11.0` (STAGE_27_SEMESTERS) → New: `1.12.0`

### 1.4 FK Design Decisions

| Constraint                                      | Type        | Rationale                                                                                                                           |
| ----------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `division_id → divisions.id ON DELETE RESTRICT` | FK RESTRICT | Application-level guard (subject deletion before division deletion) handles this before DB constraint fires; DB level is safety net |
| `semester_id → semesters.id ON DELETE RESTRICT` | FK RESTRICT | Same pattern; semesters cannot be deleted if subjects reference them                                                                |

**Note on `division_id` nullability:** `division_id` is nullable in the DB schema. When divisions are
disabled in workspace settings, the service auto-assigns the workspace default division ID at
create/update time. This means `division_id` is always populated at the application layer for
active subjects, even though the column is nullable. The null-safe handling in queries uses
`WHERE division_id = $1` only when a filter is explicitly requested.

---

## Phase 2 — Implementation Plan (Ordered)

### Layer 1: Migration

**File:** `apps/api/src/db/tenant/migrations/20260320_006_subjects.ts`

Steps inside single `BEGIN/COMMIT`:

1. `CREATE TABLE IF NOT EXISTS subjects` — all columns + status CHECK constraint
2. `CREATE UNIQUE INDEX IF NOT EXISTS subjects_name_lower_unique_active`
3. `CREATE UNIQUE INDEX IF NOT EXISTS subjects_code_unique_non_null`
4. `CREATE INDEX IF NOT EXISTS idx_subjects_division_id`
5. `CREATE INDEX IF NOT EXISTS idx_subjects_semester_id`
6. `CREATE INDEX IF NOT EXISTS idx_subjects_status`
7. `CREATE INDEX IF NOT EXISTS idx_subjects_division_status`
8. `CREATE INDEX IF NOT EXISTS idx_subjects_semester_status`
9. `CREATE INDEX IF NOT EXISTS idx_subjects_deleted_at`
10. `UPDATE _schema_versions SET version = '1.12.0'`

**Import:** `import type { PoolClient } from 'pg'`  
**Description export:** `'Add subjects table with workflow status, FK constraints, and composite indexes'`

---

### Layer 2: Drizzle Schema

**File:** `apps/api/src/db/tenant/schemas/subjects.schema.ts`

```typescript
import { boolean, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 100 }),
    division_id: uuid("division_id"),
    semester_id: uuid("semester_id"),
    is_multilanguage: boolean("is_multilanguage").notNull().default(false),
    default_language: varchar("default_language", { length: 10 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    divisionIdIdx: index("idx_subjects_division_id").on(table.division_id),
    semesterIdIdx: index("idx_subjects_semester_id").on(table.semester_id),
    statusIdx: index("idx_subjects_status").on(table.status),
    divisionStatusIdx: index("idx_subjects_division_status").on(table.division_id, table.status),
    semesterStatusIdx: index("idx_subjects_semester_status").on(table.semester_id, table.status),
    deletedAtIdx: index("idx_subjects_deleted_at").on(table.deleted_at),
    // subjects_name_lower_unique_active (partial functional): migration-owned, not declared here
    // subjects_code_unique_non_null (partial unique): migration-owned, not declared here
    // FK constraints (division_id, semester_id): migration-owned, not declared here
  }),
);

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;
```

**Note:** FK references (`divisions.id`, `semesters.id`) are owned by migration DDL only.
Drizzle `references()` API would generate conflicting FK definitions that cannot express the
`RESTRICT` behaviour correctly alongside the partial functional indexes. This follows the
convention established for divisions, teams, semesters.

---

### Layer 3: Domain Package — `packages/domain-core/src/subjects/`

#### 3.1 `subjects.types.ts`

```typescript
export type SubjectStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface SubjectRow {
  id: string;
  name: string;
  code: string | null;
  division_id: string | null;
  semester_id: string | null;
  is_multilanguage: boolean;
  default_language: string;
  description: string | null;
  status: SubjectStatus;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSubjectInput {
  name: string;
  code?: string | null;
  division_id?: string | null;
  semester_id?: string | null;
  is_multilanguage?: boolean;
  default_language: string;
  description?: string | null;
}

export interface UpdateSubjectInput {
  name?: string;
  code?: string | null;
  division_id?: string | null;
  semester_id?: string | null;
  is_multilanguage?: boolean;
  default_language?: string;
  description?: string | null;
}

export interface TransitionSubjectInput {
  target_status: SubjectStatus;
  expected_current_status: SubjectStatus;
}

export interface ListSubjectsInput {
  page: number;
  limit: number;
  status?: SubjectStatus;
  search?: string;
  division_id?: string;
  semester_id?: string;
}

export interface ListSubjectsResult {
  items: SubjectRow[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditContext {
  user_id: string;
  correlation_id: string;
  workspace_slug: string;
  workspace_id: string;
}

export type DbClient = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};
```

#### 3.2 `subjects.errors.ts`

Error codes and HTTP status mapping:

```typescript
export type SubjectsErrorCode =
  | "SUBJECT_NOT_FOUND" // 404
  | "SUBJECT_NAME_DUPLICATE" // 409
  | "SUBJECT_CODE_DUPLICATE" // 409
  | "SUBJECT_DIVISION_NOT_FOUND" // 404
  | "SUBJECT_SEMESTER_NOT_FOUND" // 404
  | "SUBJECT_SEMESTER_DIVISION_MISMATCH" // 422
  | "SUBJECT_INVALID_TRANSITION" // 422
  | "SUBJECT_TRANSITION_CONFLICT" // 409
  | "SUBJECT_ARCHIVED" // 422
  | "SUBJECT_HAS_DEPENDENT_CONTENT" // 422
  | "VALIDATION_ERROR"; // 422
```

| Code                                 | HTTP | Meaning                                                               |
| ------------------------------------ | ---- | --------------------------------------------------------------------- |
| `SUBJECT_NOT_FOUND`                  | 404  | Subject not found or soft-deleted                                     |
| `SUBJECT_NAME_DUPLICATE`             | 409  | Name already taken in workspace                                       |
| `SUBJECT_CODE_DUPLICATE`             | 409  | Code already taken in workspace                                       |
| `SUBJECT_DIVISION_NOT_FOUND`         | 404  | `division_id` not found in tenant (avoids information leakage vs 403) |
| `SUBJECT_SEMESTER_NOT_FOUND`         | 404  | `semester_id` not found in tenant                                     |
| `SUBJECT_SEMESTER_DIVISION_MISMATCH` | 422  | Semester belongs to a different division                              |
| `SUBJECT_INVALID_TRANSITION`         | 422  | Target state not reachable from current state                         |
| `SUBJECT_TRANSITION_CONFLICT`        | 409  | CAS failure — another concurrent transition won                       |
| `SUBJECT_ARCHIVED`                   | 422  | Subject is archived; no mutations allowed                             |
| `SUBJECT_HAS_DEPENDENT_CONTENT`      | 422  | Deletion blocked by dependency registry                               |
| `VALIDATION_ERROR`                   | 422  | Zod schema validation failure                                         |

#### 3.3 `subjects.dependency-registry.ts`

```typescript
// Configurable dependency check registry.
// Each entry is an async function that returns a count of dependent records.
// At STAGE_28 launch the registry is empty — no downstream content tables exist yet.
// Downstream stages (MCQ, exams, etc.) append their own check functions here.

export type DependencyCheckFn = (db: DbClient, subjectId: string) => Promise<number>;

export const subjectDependencyRegistry: DependencyCheckFn[] = [];

export async function checkSubjectDependencies(db: DbClient, subjectId: string): Promise<number> {
  const counts = await Promise.all(subjectDependencyRegistry.map((fn) => fn(db, subjectId)));
  return counts.reduce((sum, n) => sum + n, 0);
}
```

#### 3.4 `subjects.repository.ts`

Pure SQL query functions — no transactions opened. Service layer manages all transaction
boundaries.

**Read queries:**

- `findSubjectById(db, id)` → `SubjectRow | null` (excludes `deleted_at IS NOT NULL`)
- `findSubjects(db, { offset, limit, status?, search?, division_id?, semester_id? })` → `SubjectRow[]`
- `countSubjects(db, { status?, search?, division_id?, semester_id? })` → `number`
- `lockSubjectForUpdate(db, id)` → `{ id, status, deleted_at } | null` (`SELECT ... FOR UPDATE NOWAIT`)

**Write queries (service-layer-called inside transaction):**

- `subjectNameExists(db, name, excludeId?)` → `boolean`
- `subjectCodeExists(db, code, excludeId?)` → `boolean`
- `insertSubject(db, data)` → `SubjectRow`
- `updateSubjectRow(db, id, data)` → `SubjectRow`
- `casTransitionSubject(db, id, targetStatus, expectedCurrentStatus)` → `{ rowCount: number }`
- `softDeleteSubject(db, id)` → `void`

**Name uniqueness query example:**

```sql
SELECT EXISTS(
  SELECT 1 FROM subjects
  WHERE LOWER(name) = LOWER($1)
    AND deleted_at IS NULL
    AND ($2::uuid IS NULL OR id <> $2::uuid)
) AS exists
```

**`findSubjects` query pattern:**

```sql
SELECT id, name, code, division_id, semester_id, is_multilanguage,
       default_language, description, status, deleted_at, created_at, updated_at
FROM subjects
WHERE deleted_at IS NULL
  [AND status = $status]
  [AND division_id = $division_id]
  [AND semester_id = $semester_id]
  [AND (LOWER(name) LIKE LOWER('%' || $search || '%')
        OR LOWER(code) LIKE LOWER('%' || $search || '%'))]
ORDER BY created_at DESC
LIMIT $limit OFFSET $offset
```

#### 3.5 `subjects.service.ts`

Implements all business logic. Uses `BEGIN/COMMIT/ROLLBACK` directly. All write operations are
transactional.

**`listSubjects(db, input)`** — No transaction. Calls `countSubjects` + `findSubjects` in
`Promise.all`, returns `ListSubjectsResult`.

**`createSubject(db, input, audit)`** — Transaction:

```
BEGIN
  1. If divisions are enabled AND division_id provided:
       lockDivision(db, division_id) → DivisionNotFound if null
  2. If semester_id provided:
       lockSemester(db, semester_id) → SemesterNotFound if null
       If division_id provided AND divisions enabled:
         validateSemesterBelongsToDivision → SUBJECT_SEMESTER_DIVISION_MISMATCH
  3. If divisions are DISABLED (checked via workspace_settings at service call time):
       Auto-assign division_id = workspace default division UUID
  4. subjectNameExists(db, name) → SUBJECT_NAME_DUPLICATE if true
  5. If code provided: subjectCodeExists(db, code) → SUBJECT_CODE_DUPLICATE if true
  6. insertSubject(db, { name, code, division_id, semester_id, is_multilanguage,
                          default_language, description, status: 'DRAFT' })
COMMIT / ROLLBACK on error
```

**`getSubjectById(db, id)`** — No transaction. Calls `findSubjectById(db, id)`; throws
`SUBJECT_NOT_FOUND` if null.

**`updateSubject(db, id, input, audit)`** — Transaction:

```
BEGIN
  1. lockSubjectForUpdate(db, id) → SUBJECT_NOT_FOUND if null
  2. If subject.status === 'ARCHIVED': throw SUBJECT_ARCHIVED
  3. If name changed: subjectNameExists(db, input.name, id) → SUBJECT_NAME_DUPLICATE
  4. If code changed: subjectCodeExists(db, input.code, id) → SUBJECT_CODE_DUPLICATE
  5. If division_id changed AND divisions enabled:
       Validate division exists → SUBJECT_DIVISION_NOT_FOUND
  6. If semester_id changed:
       Validate semester exists → SUBJECT_SEMESTER_NOT_FOUND
       If division_id provided: validateSemesterBelongsToDivision
  7. updateSubjectRow(db, id, mergedInput)
COMMIT / ROLLBACK on error
```

**`transitionSubjectStatus(db, id, input, audit)`** — Transaction:

```
BEGIN
  1. lockSubjectForUpdate(db, id) → SUBJECT_NOT_FOUND if null
  2. Validate transition legality:
       ALLOWED = { DRAFT→ACTIVE, ACTIVE→ARCHIVED }
       Any other pair → SUBJECT_INVALID_TRANSITION
  3. CAS update:
       casTransitionSubject(db, id, target_status, expected_current_status)
       rowCount = 0 → SUBJECT_TRANSITION_CONFLICT (concurrent transition won)
  4. Log observed transition
COMMIT / ROLLBACK on error
```

**`deleteSubject(db, id, audit)`** — Transaction:

```
BEGIN
  1. lockSubjectForUpdate(db, id) → SUBJECT_NOT_FOUND if null
  2. checkSubjectDependencies(db, id) → count > 0 → SUBJECT_HAS_DEPENDENT_CONTENT
  3. softDeleteSubject(db, id) → set deleted_at = NOW()
COMMIT / ROLLBACK on error
```

#### 3.6 `index.ts` (barrel)

Exports all types, errors, and service functions. Follows `semesters/index.ts` pattern.

---

### Layer 4: Validation Schemas

**File:** `packages/validation/src/backoffice/subjects.schemas.ts`

```typescript
const MAX_NAME_LENGTH = 255;
const MAX_CODE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_LANGUAGE_LENGTH = 10;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const SubjectStatusEnum = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
```

**Schemas to implement:**

| Schema                        | Purpose                                                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listSubjectsQuerySchema`     | `page`, `limit`, `status?`, `search?`, `division_id?`, `semester_id?`                                                                                                                                               |
| `subjectParamsSchema`         | `id: z.string().uuid()`                                                                                                                                                                                             |
| `createSubjectBodySchema`     | `name` (trim, min 1, max 255, no whitespace-only), `code?` (trim, max 100), `division_id?` (uuid), `semester_id?` (uuid), `is_multilanguage?` (bool), `default_language` (min 2, max 10), `description?` (max 2000) |
| `updateSubjectBodySchema`     | Same as create but all optional + `.refine()` requiring at least one field                                                                                                                                          |
| `transitionSubjectBodySchema` | `target_status: SubjectStatusEnum`, `expected_current_status: SubjectStatusEnum`                                                                                                                                    |

**Whitespace-only name guard (from security checklist CHK001):**

```typescript
name: z.string()
  .min(1, 'name is required')
  .max(MAX_NAME_LENGTH)
  .refine((s) => s.trim().length > 0, 'name must not be whitespace only')
  .transform((s) => s.trim()),
```

---

### Layer 5: Route Handlers

**Directory:** `apps/api/src/routes/backoffice/subjects/`

**Files:**

| File                     | Handler                                                              | Endpoint                        | Method |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------- | ------ |
| `index.ts`               | `createSubjectsRouter()`                                             | Router mount                    | —      |
| `helpers.ts`             | `getDb`, `buildAuditCtx`, `successResponse`, `subjectsErrorResponse` | —                               | —      |
| `list-subjects.ts`       | `listSubjectsHandler`                                                | `GET /subjects`                 | GET    |
| `create-subject.ts`      | `createSubjectHandler`                                               | `POST /subjects`                | POST   |
| `get-active-subjects.ts` | `getActiveSubjectsHandler`                                           | `GET /subjects/runtime`         | GET    |
| `get-subject.ts`         | `getSubjectHandler`                                                  | `GET /subjects/:id`             | GET    |
| `update-subject.ts`      | `updateSubjectHandler`                                               | `PATCH /subjects/:id`           | PATCH  |
| `transition-subject.ts`  | `transitionSubjectHandler`                                           | `POST /subjects/:id/transition` | POST   |
| `delete-subject.ts`      | `deleteSubjectHandler`                                               | `DELETE /subjects/:id`          | DELETE |

**Route registration order in `index.ts`** (static before parameterized):

```typescript
router.get("/subjects", listSubjectsHandler);
router.post("/subjects", createSubjectHandler);
router.get("/subjects/runtime", getActiveSubjectsHandler); // ← MUST be before /subjects/:id
router.get("/subjects/:id", getSubjectHandler);
router.patch("/subjects/:id", updateSubjectHandler);
router.post("/subjects/:id/transition", transitionSubjectHandler);
router.delete("/subjects/:id", deleteSubjectHandler);
```

#### `helpers.ts` pattern

```typescript
import type { AuditContext, DbClient } from '@zidney/domain-core/subjects'
import { SubjectsError, SUBJECTS_ERROR_HTTP_STATUS, SUBJECTS_ERROR_MESSAGES }
  from '@zidney/domain-core/subjects'

export function getDb(c: Context): DbClient { ... }          // c.get('tenant').pool
export function buildAuditCtx(c: Context): AuditContext { ... }  // user.id, correlation_id, etc.
export function successResponse<T>(data: T): { success: true; data: T; error: null }
export function subjectsErrorResponse(c: Context, err: unknown): Response
```

`subjectsErrorResponse` handles:

- `pg` error `55P03` (NOWAIT lock) → 503
- `err instanceof SubjectsError` → mapped HTTP status from `SUBJECTS_ERROR_HTTP_STATUS`
- ZodError → 422 `VALIDATION_ERROR`
- Unknown → 500 `INTERNAL_ERROR`

#### `list-subjects.ts` handler outline

```typescript
const query = await listSubjectsQuerySchema.parseAsync(c.req.query());
const result = await listSubjects(getDb(c), { ...query });
return c.json(successResponse(result), 200);
```

#### `get-active-subjects.ts` handler outline (Runtime — ACTIVE only)

```typescript
const query = await listSubjectsQuerySchema
  .omit({ status: true }) // status is forced to ACTIVE; not a client param
  .parseAsync(c.req.query());
const result = await listSubjects(getDb(c), { ...query, status: "ACTIVE" });
return c.json(successResponse(result), 200);
```

Rate limit classification for this handler: `auth/runtime` (600 req/min per token).

#### `transition-subject.ts` handler outline

```typescript
const params = await subjectParamsSchema.parseAsync(c.req.param());
const body = await transitionSubjectBodySchema.parseAsync(await c.req.json());
const result = await transitionSubjectStatus(getDb(c), params.id, body, buildAuditCtx(c));
return c.json(successResponse(result), 200);
```

---

### Layer 6: Route Registration

**File:** `apps/api/src/app.ts`

Add import:

```typescript
import { subjectsRouter } from "./routes/backoffice/subjects";
```

Add route registration (after semesters):

```typescript
// Subjects endpoints — Stage 028, permission guard applied per route
app.route("/api/v1/backoffice/workspace", subjectsRouter);
```

---

### Layer 7: Tests

#### 7.1 Unit Tests

**File:** `packages/domain-core/src/subjects/__tests__/subjects.service.test.ts`

Test coverage (mock `DbClient`):

| Test                                             | Coverage                                   |
| ------------------------------------------------ | ------------------------------------------ |
| `createSubject` — success path                   | Happy path with full fields                |
| `createSubject` — name duplicate                 | Returns SUBJECT_NAME_DUPLICATE             |
| `createSubject` — code duplicate                 | Returns SUBJECT_CODE_DUPLICATE             |
| `createSubject` — semester-division mismatch     | Returns SUBJECT_SEMESTER_DIVISION_MISMATCH |
| `createSubject` — divisions disabled auto-assign | division_id auto-set to default            |
| `getSubjectById` — not found                     | Returns SUBJECT_NOT_FOUND                  |
| `updateSubject` — archived subject               | Returns SUBJECT_ARCHIVED                   |
| `transitionSubjectStatus` — DRAFT→ACTIVE         | Success                                    |
| `transitionSubjectStatus` — ACTIVE→ARCHIVED      | Success                                    |
| `transitionSubjectStatus` — ARCHIVED→anything    | Returns SUBJECT_INVALID_TRANSITION         |
| `transitionSubjectStatus` — CAS conflict         | Returns SUBJECT_TRANSITION_CONFLICT        |
| `deleteSubject` — with dependencies              | Returns SUBJECT_HAS_DEPENDENT_CONTENT      |
| `deleteSubject` — no dependencies                | Sets deleted_at                            |

#### 7.2 Integration Tests

**File:** `apps/api/src/routes/backoffice/subjects/__tests__/subjects.integration.test.ts`

Test coverage (vitest with HTTP client):

| Scenario                                       | HTTP                                                   |
| ---------------------------------------------- | ------------------------------------------------------ |
| Full CRUD lifecycle: create→read→update→delete | 201, 200, 200, 200                                     |
| Create — duplicate name                        | 409 `SUBJECT_NAME_DUPLICATE`                           |
| Create — duplicate code                        | 409 `SUBJECT_CODE_DUPLICATE`                           |
| Create — invalid body                          | 422 `VALIDATION_ERROR`                                 |
| Create — whitespace-only name                  | 422 `VALIDATION_ERROR`                                 |
| List — default pagination                      | 200 with `items`, `total`, `page`, `limit`             |
| List — status filter                           | 200 with filtered results                              |
| List — division_id filter                      | 200 with scoped results                                |
| List — semester_id filter                      | 200 with scoped results                                |
| List — search by name partial                  | 200 with matching results                              |
| Runtime `GET /subjects/runtime`                | 200 with only ACTIVE subjects                          |
| Workflow DRAFT→ACTIVE                          | 200                                                    |
| Workflow ACTIVE→ARCHIVED                       | 200                                                    |
| Workflow terminal ARCHIVED→ACTIVE              | 422 `SUBJECT_INVALID_TRANSITION`                       |
| Workflow CAS conflict                          | 409 `SUBJECT_TRANSITION_CONFLICT`                      |
| Soft delete with no dependencies               | 200                                                    |
| Soft delete — already deleted (re-GET)         | 404                                                    |
| Divisions disabled — auto-assign               | 201 with system default division_id                    |
| No auth token                                  | 401                                                    |
| Wrong permission scope                         | 403                                                    |
| SOFT_LOCKED license                            | 423                                                    |
| Schema version mismatch                        | 409 `SCHEMA_VERSION_MISMATCH`                          |
| Cross-tenant isolation                         | PASS (two-tenant parallel fetch returns disjoint sets) |

---

## Phase 3 — Middleware & Security

### Middleware chain (unchanged — follows all prior academic stages)

```
correlationId → tenantResolver → licenseEnforcement → schemaVersionCheck
→ rateLimit → authentication → rbacPermissionCheck → routeHandler
```

### RBAC permission check

All 7 subject endpoints check `subjects:manage` permission (FR-15 single unified scope).

```typescript
if (!c.get("permissions")?.includes("subjects:manage")) {
  return c.json({ success: false, data: null, error: { code: "FORBIDDEN", message: "..." } }, 403);
}
```

### Input whitespace-only name guard

Enforced at Zod schema layer (`refine` + `transform`). No whitespace-only names reach service.

### Description length cap

Max 2,000 characters (`MAX_DESCRIPTION_LENGTH = 2000`) enforced in Zod schema.

### Code validation

Codewhen provided: trim + max 100 chars. No `LOWER()` case-insensitivity required for code (case-sensitive
per spec; case-insensitivity only applies to `name`).

---

## Phase 4 — Error Contract Summary

All responses follow: `{ success: boolean, data: object | null, error: { code, message } | null }`

| Scenario                       | HTTP | `error.code`                                                 |
| ------------------------------ | ---- | ------------------------------------------------------------ |
| Subject not found              | 404  | `SUBJECT_NOT_FOUND`                                          |
| Name duplicate                 | 409  | `SUBJECT_NAME_DUPLICATE`                                     |
| Code duplicate                 | 409  | `SUBJECT_CODE_DUPLICATE`                                     |
| Division not found             | 404  | `SUBJECT_DIVISION_NOT_FOUND`                                 |
| Semester not found             | 404  | `SUBJECT_SEMESTER_NOT_FOUND`                                 |
| Semester-division mismatch     | 422  | `SUBJECT_SEMESTER_DIVISION_MISMATCH`                         |
| Invalid workflow transition    | 422  | `SUBJECT_INVALID_TRANSITION`                                 |
| Concurrent transition conflict | 409  | `SUBJECT_TRANSITION_CONFLICT`                                |
| Subject is archived            | 422  | `SUBJECT_ARCHIVED`                                           |
| Has dependent content          | 422  | `SUBJECT_HAS_DEPENDENT_CONTENT`                              |
| Input validation failure       | 422  | `VALIDATION_ERROR`                                           |
| DB lock contention (pg 55P03)  | 503  | `SUBJECT_NOT_FOUND` (masks lock — consistent with semesters) |
| Schema version mismatch        | 409  | `SCHEMA_VERSION_MISMATCH` (from license middleware)          |
| License SOFT_LOCKED            | 423  | `LICENSE_SOFT_LOCKED` (from license middleware)              |
| License ARCHIVED               | 403  | `LICENSE_ARCHIVED` (from license middleware)                 |
| Internal error                 | 500  | `INTERNAL_ERROR`                                             |

---

## Phase 5 — Logging Requirements

Each handler emits a structured log entry **after** the response is committed (or on error):

```typescript
logger.info("Subject created", {
  correlation_id: audit.correlation_id,
  workspace_id: audit.workspace_id,
  workspace_slug: audit.workspace_slug,
  user_id: audit.user_id,
  subject_id: row.id,
  subject_name: row.name,
});
```

Minimum required fields per the observability spec:

| Field            | Source                                                              |
| ---------------- | ------------------------------------------------------------------- |
| `correlation_id` | `c.get('correlation_id')`                                           |
| `workspace_id`   | `c.get('workspace_id')`                                             |
| `workspace_slug` | `c.get('workspace_slug')`                                           |
| `user_id`        | `c.get('user').id`                                                  |
| `subject_id`     | From returned row (post-create) or params (other ops)               |
| `action`         | e.g. `subject.create`, `subject.update`, `subject.transition`, etc. |

---

## Phase 6 — Constitutional Compliance Checklist

| Rule                                   | Status                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------- |
| Database-per-tenant isolation          | ✓ `subjects` in tenant DB only; no master DB writes                         |
| License middleware always in chain     | ✓ Enforced before any route handler                                         |
| Server-authoritative time              | ✓ `created_at`, `updated_at`, `deleted_at` set by `NOW()` / `DEFAULT NOW()` |
| All writes transactional               | ✓ BEGIN/COMMIT/ROLLBACK in every write service function                     |
| Forward-only migration                 | ✓ No down migration; `IF NOT EXISTS` idempotency guards                     |
| Soft-delete only                       | ✓ Hard delete forbidden; `deleted_at IS NOT NULL` excludes records          |
| No business logic on frontend          | ✓ All filtering, workflow, visibility enforced at API layer                 |
| No worker involvement                  | ✓ Subjects CRUD is fully synchronous                                        |
| Version compatibility enforced         | ✓ `schema_version 1.12.0` enforced by license middleware                    |
| Structured logging with correlation ID | ✓ All handlers use `createLogger` from `@zidney/logger`                     |

---

## Open Items Addressed From Checklists

| Checklist Gap                                                   | Resolution in this Plan                                                       |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| CHK performance: missing `(division_id, status)` compound index | Added `idx_subjects_division_status`                                          |
| CHK performance: missing `(semester_id, status)` compound index | Added `idx_subjects_semester_status`                                          |
| CHK performance: max page size not specified                    | `MAX_LIMIT = 100` enforced in Zod schema                                      |
| CHK performance: no pagination strategy                         | Offset-based `page`/`limit` matching semesters pattern                        |
| CHK security: whitespace-only name not excluded                 | Added `refine()` in `createSubjectBodySchema`                                 |
| CHK security: max description length undefined                  | `MAX_DESCRIPTION_LENGTH = 2000` in Zod schema                                 |
| CHK security: code character set undefined                      | Code is trim-only; no special character exclusion required per business rules |
| CHK security: 429 rate-limit error contract                     | Handled by global rate-limit middleware (not in this plan's scope)            |
