# Plan: Lessons (STAGE_29)

**Feature Branch**: `spec/029-lessons`
**Stage**: `STAGE_29_LESSONS`
**Phase**: `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE`
**Spec**: `specs/runtime/029-lessons/spec.md`
**Plan Generated**: 2026-03-21
**Constitution Version**: v1.2.0

---

## Stage Alignment

- **Phase**: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE
- **Stage**: STAGE_29_LESSONS
- **Related Spec File**: `specs/runtime/029-lessons/spec.md`
- **Related ADR**: ADR-0008 (forward-only migrations), ADR (multi-tenant DB-per-tenant)
- **Parent Stage**: STAGE_28_SUBJECTS (dependency — `subjects` table must exist before migration)

---

## Architectural Scope Confirmation

| Check                                  | Status       | Notes                                                                      |
| -------------------------------------- | ------------ | -------------------------------------------------------------------------- |
| No cross-tenant data access            | ✅ CONFIRMED | `lessons` resides exclusively in tenant DB; tenant resolved via middleware |
| No middleware bypass                   | ✅ CONFIRMED | Tenant resolver → license middleware mandatory for all lesson routes       |
| No direct DB instantiation             | ✅ CONFIRMED | All DB access via `c.get('tenant').pool`; no global singleton              |
| No grading logic outside Worker        | ✅ CONFIRMED | Feature does not touch attempt or grading logic                            |
| No weakening of snapshot integrity     | ✅ CONFIRMED | Lesson FKs in downstream content snapshot-captured at attempt start        |
| No weakening of transaction boundaries | ✅ CONFIRMED | All writes wrapped in explicit transactions at service layer               |
| No weakening of version enforcement    | ✅ CONFIRMED | Schema version incremented; migration is forward-only                      |
| No layer boundary violation            | ✅ CONFIRMED | domain-core has no HTTP dependencies; UI never imports DB schemas          |

**No ADR exceptions required.** This stage is a direct mirror of STAGE_28_SUBJECTS.

---

## Implementation Strategy

Lessons is a **direct structural mirror of the Subjects domain** (STAGE_28). No new architectural patterns are introduced.

**Implementation order**:

1. Domain-first: `packages/domain-core/src/lessons/` (types → errors → repository → service → dependency-registry → index)
2. Validation: `packages/validation/src/backoffice/lessons.schemas.ts`
3. Migration: write and validate `20260321_007_lessons.ts`
4. Routes: handlers one-by-one with shared `helpers.ts`
5. Tests: unit (service) + integration (routes) as final gate

**Key constraint**: `subjects` table must exist in all tenant DBs before migration `007` is applied. The FK DDL in Step 2 will fail at DDL time if `subjects` does not exist — this is safe and expected.

---

## File Inventory

### New Files (CREATE)

| File                                                                           | Purpose                                                                                                                           |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain-core/src/lessons/lessons.types.ts`                            | DbClient, AuditContext, LessonRow, all input/result types                                                                         |
| `packages/domain-core/src/lessons/lessons.errors.ts`                           | LessonsErrorCode, LESSONS_ERROR_HTTP_STATUS, LESSONS_ERROR_MESSAGES, LessonsError                                                 |
| `packages/domain-core/src/lessons/lessons.repository.ts`                       | Pure SQL query functions — no transactions, accept DbClient                                                                       |
| `packages/domain-core/src/lessons/lessons.service.ts`                          | Business logic with transaction management — all writes transactional                                                             |
| `packages/domain-core/src/lessons/lessons.dependency-registry.ts`              | Stub registry — returns 0 (no downstream tables in this stage)                                                                    |
| `packages/domain-core/src/lessons/index.ts`                                    | Public barrel re-exports                                                                                                          |
| `packages/domain-core/src/lessons/__tests__/lessons.service.test.ts`           | Unit tests for service layer                                                                                                      |
| `packages/validation/src/backoffice/lessons.schemas.ts`                        | Zod schemas: listLessonsQuerySchema, activeLessonsQuerySchema, lessonParamsSchema, createLessonBodySchema, updateLessonBodySchema |
| `apps/api/src/db/tenant/migrations/20260321_007_lessons.ts`                    | Forward-only DDL migration; version 1.12.0 → 1.13.0                                                                               |
| `apps/api/src/routes/backoffice/lessons/index.ts`                              | Hono router factory; all 6 routes registered                                                                                      |
| `apps/api/src/routes/backoffice/lessons/list-lessons.ts`                       | `GET /lessons` handler                                                                                                            |
| `apps/api/src/routes/backoffice/lessons/create-lesson.ts`                      | `POST /lessons` handler                                                                                                           |
| `apps/api/src/routes/backoffice/lessons/get-lesson.ts`                         | `GET /lessons/:id` handler                                                                                                        |
| `apps/api/src/routes/backoffice/lessons/get-active-lessons.ts`                 | `GET /lessons/runtime` — no auth, for UI dropdowns                                                                                |
| `apps/api/src/routes/backoffice/lessons/update-lesson.ts`                      | `PATCH /lessons/:id` handler                                                                                                      |
| `apps/api/src/routes/backoffice/lessons/delete-lesson.ts`                      | `DELETE /lessons/:id` soft-delete handler                                                                                         |
| `apps/api/src/routes/backoffice/lessons/helpers.ts`                            | `getDb`, `buildAuditCtx`, `successResponse`, `lessonsErrorResponse`                                                               |
| `apps/api/src/routes/backoffice/lessons/__tests__/lessons.integration.test.ts` | Integration tests for all lesson routes                                                                                           |

### Modified Files (UPDATE)

| File                                                                | Change                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/domain-core/package.json`                                 | Add `"./lessons": "./src/lessons/index.ts"` subpath export |
| `packages/domain-core/src/subjects/subjects.dependency-registry.ts` | Register `countLessonsForSubject` check function           |
| `apps/api/src/app.ts`                                               | Import lessonsRouter, register via `app.route()`           |

> No Drizzle schema file needed. `lessons` table is managed exclusively via SQL migrations, consistent with the subjects pattern.

---

## Migration Plan (DDL)

**File**: `apps/api/src/db/tenant/migrations/20260321_007_lessons.ts`
**Version Before**: `1.12.0` → **Version After**: `1.13.0`
**Applies To**: All tenant databases

### Migration structure

```typescript
import type { PoolClient } from "pg";

export const description =
  "Add lessons table with subject FK, status lifecycle, and composite uniqueness index";

export async function up(client: PoolClient): Promise<void> {
  await client.query("BEGIN");
  try {
    // Steps 1–8
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}
```

### Step 1 — Create `lessons` table

```sql
CREATE TABLE IF NOT EXISTS lessons (
  id          UUID          NOT NULL DEFAULT gen_random_uuid(),
  subject_id  UUID          NOT NULL,
  name        VARCHAR(255)  NOT NULL,
  code        VARCHAR(100),
  description TEXT,
  status      VARCHAR(20)   NOT NULL DEFAULT 'ENABLED'
                CONSTRAINT lessons_status_check CHECK (status IN ('ENABLED', 'DISABLED')),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by  UUID,
  updated_by  UUID,
  CONSTRAINT  lessons_pkey PRIMARY KEY (id)
)
```

### Step 2 — FK: `subject_id → subjects(id) ON DELETE RESTRICT`

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'lessons'
      AND constraint_name = 'lessons_subject_id_fkey'
  ) THEN
    ALTER TABLE lessons
      ADD CONSTRAINT lessons_subject_id_fkey
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT;
  END IF;
END
$$
```

**Rationale**: `RESTRICT` (not `CASCADE`) — subject deletion must be blocked when lessons exist. Combined with the subjects dependency-registry registration, this gives two layers of protection.

### Step 3 — FK: `created_by → users(id) ON DELETE SET NULL`

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'lessons'
      AND constraint_name = 'lessons_created_by_fkey'
  ) THEN
    ALTER TABLE lessons
      ADD CONSTRAINT lessons_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END
$$
```

### Step 4 — FK: `updated_by → users(id) ON DELETE SET NULL`

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'lessons'
      AND constraint_name = 'lessons_updated_by_fkey'
  ) THEN
    ALTER TABLE lessons
      ADD CONSTRAINT lessons_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END
$$
```

### Step 5 — Case-insensitive composite unique index

```sql
CREATE UNIQUE INDEX IF NOT EXISTS unique_lessons_subject_name
  ON lessons (subject_id, LOWER(name))
```

**Rationale**: Functional index on `LOWER(name)` enforces case-insensitive uniqueness within a subject. "Algebra" and "algebra" in the same subject collide. This matches the subjects domain pattern.

### Step 6 — `idx_lessons_subject_id`

```sql
CREATE INDEX IF NOT EXISTS idx_lessons_subject_id ON lessons (subject_id)
```

### Step 7 — `idx_lessons_status`

```sql
CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons (status)
```

### Step 8 — Schema version bump

```sql
UPDATE _schema_versions
  SET version    = '1.13.0',
      updated_at = NOW()
  WHERE name = 'schema_version'
```

> **⚠ Table name**: `_schema_versions` (confirmed from `20260320_006_subjects.ts`), not `schema_config`.

### Migration Safety Checklist

- [x] All DDL idempotent (`IF NOT EXISTS` + `DO $$ IF NOT EXISTS` blocks)
- [x] Wrapped in `BEGIN / COMMIT / ROLLBACK`
- [x] Forward-only — no `down()` function (ADR-0008)
- [x] `ON DELETE RESTRICT` on `subject_id`
- [x] `ON DELETE SET NULL` on `created_by` / `updated_by`
- [x] `MIN_SCHEMA_VERSION = "1.13.0"` enforced at middleware (Clarification Q4)

---

## API Contracts

**Route prefix**: `/workspace/:slug/backoffice/lessons`
**Middleware stack**: tenant-resolver → schema-version-check (≥ 1.13.0) → license-check → auth

> Static paths declared before parameterised in Hono router. `/lessons/runtime` registered before `/lessons/:id`.

### Route table

| Method   | Path               | Handler                   | Auth                                  |
| -------- | ------------------ | ------------------------- | ------------------------------------- |
| `GET`    | `/lessons`         | `listLessonsHandler`      | Authenticated Backoffice user         |
| `POST`   | `/lessons`         | `createLessonHandler`     | `question_manage` OR `subject_manage` |
| `GET`    | `/lessons/runtime` | `getActiveLessonsHandler` | License check only                    |
| `GET`    | `/lessons/:id`     | `getLessonHandler`        | Authenticated Backoffice user         |
| `PATCH`  | `/lessons/:id`     | `updateLessonHandler`     | `question_manage` OR `subject_manage` |
| `DELETE` | `/lessons/:id`     | `deleteLessonHandler`     | `question_manage` OR `subject_manage` |

### GET /lessons

Query params: `subject_id` (UUID, opt), `status` (ENABLED|DISABLED, opt), `search` (max 100, opt), `page` (default 1), `limit` (default 20, max 100)

Success 200:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "subject_id": "uuid",
        "name": "string",
        "code": "string|null",
        "description": "string|null",
        "status": "ENABLED|DISABLED",
        "created_at": "ISO8601",
        "updated_at": "ISO8601",
        "created_by": "uuid|null",
        "updated_by": "uuid|null"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  },
  "error": null
}
```

### POST /lessons

Body: `{ subject_id: UUID (req), name: string (req, max 255, trimmed), code: string|null (opt, max 100), description: string|null (opt) }`

Success 201: `{ success: true, data: LessonRow, error: null }`

Errors: 422 `VALIDATION_ERROR`, 404 `LESSON_SUBJECT_NOT_FOUND`, 409 `LESSON_NAME_DUPLICATE`, 403 `FORBIDDEN`, 423 `LICENSE_LOCKED`

### GET /lessons/runtime

Query: `subject_id` (UUID, required). Returns `{ id, name, code }[]` for all ENABLED lessons in subject.

Success 200: `{ success: true, data: [{ id, name, code }], error: null }`

> `data` is a flat array — not paginated. Only ENABLED lessons for the given `subject_id`, ordered `name ASC`.

### GET /lessons/:id

Success 200: `{ success: true, data: LessonRow, error: null }`

Errors: 422 `VALIDATION_ERROR` (invalid UUID), 404 `LESSON_NOT_FOUND`

### PATCH /lessons/:id

Body (min 1 field; `subject_id` forbidden): `{ name?, code?, description?, status? }`

Success 200: `{ success: true, data: LessonRow, error: null }`

Errors: 422 `VALIDATION_ERROR`, 404 `LESSON_NOT_FOUND`, 422 `LESSON_DISABLED` (non-status field on disabled lesson — applies even if `status: ENABLED` also present per Q7), 409 `LESSON_NAME_DUPLICATE`, 422 `LESSON_ALREADY_ENABLED`, 422 `LESSON_ALREADY_DISABLED`, 403 `FORBIDDEN`

### DELETE /lessons/:id

Soft delete. Sets `status = DISABLED`. No SQL `DELETE`.

Success 200: `{ success: true, data: { deleted: true }, error: null }`

Errors: 422 `VALIDATION_ERROR`, 404 `LESSON_NOT_FOUND`, 422 `LESSON_ALREADY_DISABLED`, 403 `FORBIDDEN`

---

## Domain Package Design

### `lessons.types.ts`

```typescript
export interface DbClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface AuditContext {
  user_id: string | null; // nullable: ON DELETE SET NULL semantics (Q5)
  correlation_id: string;
  workspace_slug: string;
  workspace_id: string;
}

export type LessonStatus = "ENABLED" | "DISABLED";

export interface LessonRow {
  id: string;
  subject_id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: LessonStatus;
  created_at: Date | string;
  updated_at: Date | string;
  created_by: string | null;
  updated_by: string | null;
}

export interface ListLessonsInput {
  page: number;
  limit: number;
  subject_id?: string;
  status?: LessonStatus;
  search?: string;
}

export interface ListLessonsResult {
  items: LessonRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateLessonInput {
  subject_id: string;
  name: string;
  code?: string | null;
  description?: string | null;
}

export interface UpdateLessonInput {
  name?: string;
  code?: string | null;
  description?: string | null;
  status?: LessonStatus;
}
```

### `lessons.errors.ts`

**`LessonsErrorCode` union type** (8 codes):

| Code                           | HTTP | Message                                                           |
| ------------------------------ | ---- | ----------------------------------------------------------------- |
| `LESSON_NOT_FOUND`             | 404  | `'Lesson not found.'`                                             |
| `LESSON_SUBJECT_NOT_FOUND`     | 404  | `'Subject not found.'`                                            |
| `LESSON_NAME_DUPLICATE`        | 409  | `'A lesson with this name already exists in this subject.'`       |
| `LESSON_DISABLED`              | 422  | `'Lesson is disabled. Re-enable it before editing other fields.'` |
| `LESSON_ALREADY_DISABLED`      | 422  | `'Lesson is already disabled.'`                                   |
| `LESSON_ALREADY_ENABLED`       | 422  | `'Lesson is already enabled.'`                                    |
| `LESSON_HAS_DEPENDENT_CONTENT` | 409  | `'Lesson has dependent content and cannot be deleted.'`           |
| `VALIDATION_ERROR`             | 422  | `'Invalid request data.'`                                         |

`LessonsError extends Error` with `code: LessonsErrorCode` and `httpStatus: number`. Follows `SubjectsError` constructor pattern exactly.

> `LESSON_HAS_DEPENDENT_CONTENT` → HTTP 409 (Conflict). Hard-delete blocked = resource-state conflict, not unprocessable entity.

### `lessons.repository.ts` function contract

All functions accept `DbClient`. No transactions. No framework imports. Parameterized SQL only (`$1`, `$2` placeholders; NEVER string interpolation).

**Read functions**:

| Function                                                      | SQL                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `findLessonById(db, id)`                                      | `SELECT … FROM lessons WHERE id = $1::uuid`                                                                   |
| `findLessons(db, opts)`                                       | Dynamic WHERE + `ILIKE '%' \|\| $n \|\| '%'` for search, `LIMIT`/`OFFSET`                                     |
| `countLessons(db, opts)`                                      | `SELECT COUNT(*) …` with same filter clauses                                                                  |
| `findActiveLessonsForSubject(db, subject_id)`                 | `SELECT id, name, code FROM lessons WHERE subject_id = $1::uuid AND status = 'ENABLED'`                       |
| `subjectExists(db, subject_id)`                               | `SELECT EXISTS(SELECT 1 FROM subjects WHERE id = $1::uuid)`                                                   |
| `lessonNameExistsInSubject(db, subject_id, name, excludeId?)` | `SELECT EXISTS(… WHERE subject_id = $1 AND LOWER(name) = LOWER($2) AND ($3::uuid IS NULL OR id != $3::uuid))` |

**Write functions** (accept transactional `DbClient`):

| Function                                     | SQL                                                  |
| -------------------------------------------- | ---------------------------------------------------- |
| `insertLesson(db, input, audit)`             | `INSERT INTO lessons … RETURNING *`                  |
| `updateLessonRow(db, id, fields, updatedBy)` | Dynamic `SET` clause, `UPDATE lessons … RETURNING *` |

### `lessons.service.ts` function contract

Logger: `createLogger('domain:lessons')`

**Reads**:

- `listLessons(db, input)` → `Promise.all([countLessons, findLessons])` → `ListLessonsResult`
- `getLesson(db, id)` → `findLessonById`; throws `LESSON_NOT_FOUND` if null
- `getActiveLessons(db, subject_id)` → `subjectExists(db, subject_id)` → false → throw `LESSON_SUBJECT_NOT_FOUND`; then `findActiveLessonsForSubject(db, subject_id)` → flat `Array<{ id, name, code }>`

**`createLesson` TX flow**:

1. `subjectExists(tx, input.subject_id)` → false → throw `LESSON_SUBJECT_NOT_FOUND`
2. `lessonNameExistsInSubject(tx, input.subject_id, input.name)` → true → throw `LESSON_NAME_DUPLICATE`
3. `insertLesson(tx, input, audit)` → catch PG `23505` → throw `LESSON_NAME_DUPLICATE` (race guard)
4. Return `LessonRow`

**`updateLesson` TX flow**:

1. `findLessonById(tx, id)` → null → throw `LESSON_NOT_FOUND`
2. `hasNonStatusFields` = `name`|`code`|`description` present in input
3. If `hasNonStatusFields && lesson.status === 'DISABLED'` → throw `LESSON_DISABLED` _(applies even if `status: ENABLED` also present — Clarification Q7)_
4. If status-field only updates:
   - `input.status === 'ENABLED' && lesson.status === 'ENABLED'` → throw `LESSON_ALREADY_ENABLED`
   - `input.status === 'DISABLED' && lesson.status === 'DISABLED'` → throw `LESSON_ALREADY_DISABLED`
5. If `name` in input: `lessonNameExistsInSubject(tx, lesson.subject_id, input.name, id)` → true → throw `LESSON_NAME_DUPLICATE`
6. `updateLessonRow(tx, id, fields, audit.user_id)` → catch PG `23505` → throw `LESSON_NAME_DUPLICATE`
7. Return updated `LessonRow`

**`deleteLesson` TX flow**:

1. `findLessonById(tx, id)` → null → throw `LESSON_NOT_FOUND`
2. `lesson.status === 'DISABLED'` → throw `LESSON_ALREADY_DISABLED`
3. `updateLessonRow(tx, id, { status: 'DISABLED', updated_at: new Date() }, audit.user_id)`
4. Return `{ deleted: true as const }`

### `lessons.dependency-registry.ts`

**STAGE_29 stub.** `lessonDependencyRegistry` starts empty. `checkLessonDependencies` unconditionally returns `0`.

The `DELETE /lessons/:id` soft-delete handler **does not invoke** the dependency registry. `LESSON_HAS_DEPENDENT_CONTENT` is reserved for a future hard-delete surface (out of scope in this stage per Clarification Q8).

Downstream stages (MCQ Questions, traditional questions, auto-selection configs) append `DependencyCheckFn` entries when they introduce `lesson_id` FKs.

---

## Transaction Boundaries

| Operation          | Boundary                    | Concurrency Protection                             |
| ------------------ | --------------------------- | -------------------------------------------------- |
| `listLessons`      | None — read-only            | —                                                  |
| `getLesson`        | None — read-only            | —                                                  |
| `getActiveLessons` | None — read-only            | —                                                  |
| `createLesson`     | `BEGIN … COMMIT / ROLLBACK` | `UNIQUE (subject_id, LOWER(name))` + `23505` catch |
| `updateLesson`     | `BEGIN … COMMIT / ROLLBACK` | `UNIQUE` guard on name change + `23505` catch      |
| `deleteLesson`     | `BEGIN … COMMIT / ROLLBACK` | Status read-then-write within same TX              |

**Isolation level**: `READ COMMITTED` (PostgreSQL default). No `FOR UPDATE NOWAIT` — the ENABLED↔DISABLED state machine is simple and the unique constraint is the authoritative concurrency guard.

**Repository contract**: Repository functions **never** open transactions. Service layer exclusively manages `BEGIN / COMMIT / ROLLBACK`.

---

## Idempotency Contract

| Endpoint                           | Idempotent? | Notes                                                  |
| ---------------------------------- | ----------- | ------------------------------------------------------ |
| `GET /lessons`                     | ✅ Yes      | Pure read                                              |
| `GET /lessons/:id`                 | ✅ Yes      | Pure read                                              |
| `GET /lessons/runtime`             | ✅ Yes      | Pure read                                              |
| `POST /lessons`                    | ❌ No       | Duplicate → 409 `LESSON_NAME_DUPLICATE`                |
| `PATCH /lessons/:id` (status only) | Partial     | Re-sending same status → 422                           |
| `DELETE /lessons/:id`              | Partial     | Re-sending on disabled → 422 `LESSON_ALREADY_DISABLED` |

**Race condition handling** (Clarifications Q2 + Q3):

- Pre-insert `SELECT EXISTS(…)` — optimistic fast-path (avoids constraint exceptions in common case)
- `UNIQUE (subject_id, LOWER(name))` index — authoritative correctness guarantee
- PG error code `23505` caught at service layer → translated to `LESSON_NAME_DUPLICATE`
- First committed INSERT wins; loser receives clean 409 — no retry, no merge

---

## Error Code Registry

**Domain-owned** (mapped in `LESSONS_ERROR_HTTP_STATUS`):

| Error Code                     | HTTP | Description                                                 |
| ------------------------------ | ---- | ----------------------------------------------------------- |
| `LESSON_NOT_FOUND`             | 404  | Lesson ID not in tenant DB                                  |
| `LESSON_SUBJECT_NOT_FOUND`     | 404  | `subject_id` references no valid subject                    |
| `LESSON_NAME_DUPLICATE`        | 409  | `(subject_id, name)` uniqueness violated (case-insensitive) |
| `LESSON_DISABLED`              | 422  | DISABLED lesson; non-status field edit attempted            |
| `LESSON_ALREADY_DISABLED`      | 422  | `status = DISABLED` on already-DISABLED lesson              |
| `LESSON_ALREADY_ENABLED`       | 422  | `status = ENABLED` on already-ENABLED lesson                |
| `LESSON_HAS_DEPENDENT_CONTENT` | 409  | Hard-delete blocked (reserved; not surfaced in this stage)  |
| `VALIDATION_ERROR`             | 422  | Zod schema validation failure                               |

**Middleware-owned** (not in `LESSONS_ERROR_HTTP_STATUS` — see Clarification Q6):

| Error Code                | HTTP | Owner              |
| ------------------------- | ---- | ------------------ |
| `FORBIDDEN`               | 403  | Auth middleware    |
| `LICENSE_LOCKED`          | 423  | License middleware |
| `LICENSE_ARCHIVED`        | 403  | License middleware |
| `LICENSE_NOT_FOUND`       | 404  | License middleware |
| `SCHEMA_VERSION_MISMATCH` | 409  | Schema middleware  |

---

## Validation Rules

### `lessonParamsSchema`

- `id`: required, valid UUID

### `listLessonsQuerySchema`

- `subject_id`: optional, valid UUID
- `status`: optional, `ENABLED | DISABLED`
- `search`: optional, string max 100 chars
- `page`: optional, integer ≥ 1 (default `1`), coerced from string via `.transform(parseInt).pipe(...)`
- `limit`: optional, integer 1–100 (default `20`), coerced from string

### `activeLessonsQuerySchema`

- `subject_id`: **required**, valid UUID
- Used exclusively by `GET /lessons/runtime` (license-only endpoint)
- Emits `422 VALIDATION_ERROR` when `subject_id` is missing or not a valid UUID — distinct from the
  `404 LESSON_SUBJECT_NOT_FOUND` that fires when the subject does not exist in the tenant DB

### `createLessonBodySchema`

- `subject_id`: required, valid UUID
- `name`: required, non-empty, max 255, `.trim()`, whitespace-only rejected via `.refine()`
- `code`: optional, max 100, nullable
- `description`: optional, nullable

### `updateLessonBodySchema`

- `name`: optional, non-empty if provided, max 255, `.trim()`
- `code`: optional, max 100, nullable
- `description`: optional, nullable
- `status`: optional, `ENABLED | DISABLED` enum
- `subject_id`: **forbidden** — must not appear (stripped or schema-rejected)
- (body): at least one field required — `.refine(obj => Object.keys(obj).length > 0, ...)`

---

## Database Impact

**Master DB**: No changes. No migration. No version bump.

**Tenant DB**:

- New table: `lessons`
- New FKs: `subject_id → subjects(id) RESTRICT`, `created_by → users(id) SET NULL`, `updated_by → users(id) SET NULL`
- New indexes: `unique_lessons_subject_name` (functional, case-insensitive), `idx_lessons_subject_id`, `idx_lessons_status`
- Version change: `1.12.0 → 1.13.0`

---

## Version Enforcement Strategy

- `MIN_SCHEMA_VERSION = "1.13.0"` (Clarification Q4)
- All lesson routes (including `GET`) enforce this at the schema-check middleware layer
- Tenants on `1.12.0` or below receive `409 SCHEMA_VERSION_MISMATCH` before any handler executes
- Migration `20260321_007_lessons.ts` is the gating migration

---

## Authoritative Time Handling

- `created_at` and `updated_at` set by DB `DEFAULT NOW()` — never from client
- `updated_at` is refreshed on every write via the `updateLessonRow` function
- No client-supplied timestamps accepted or validated

---

## Observability & Logging

All route handlers emit structured log entries via `@zidney/logger`:

- **`debug`** on entry: `correlation_id`, `workspace_id`, relevant input fields (no PII)
- **`info`** on successful mutation: `lesson_id`, `workspace_id`, `correlation_id`
- **`warn`** on domain errors: `error_code`, `error_message`, `correlation_id`, `workspace_id`
- **`error`** on unexpected exceptions: error name, message (no stack traces in responses)

Pattern mirrors the subjects route logger (`createLogger('domain:lessons')`, `createLogger('lessons-route:helpers')`).

---

## Failure Modes

| Failure                            | Handling                                                          |
| ---------------------------------- | ----------------------------------------------------------------- |
| DB unavailable                     | 503 from connection middleware; handler never invoked             |
| Schema version mismatch (< 1.13.0) | 409 `SCHEMA_VERSION_MISMATCH`; handler never invoked              |
| License blocked                    | 423/403 from license middleware; handler never invoked            |
| Duplicate POST                     | 409 `LESSON_NAME_DUPLICATE` via pre-check or `23505` catch        |
| Race on unique constraint          | Loser gets 409 `LESSON_NAME_DUPLICATE` from `23505` catch         |
| Partial transaction failure        | Full `ROLLBACK`; no partial state persisted (Clarification Q1)    |
| Invalid UUID path param            | 422 `VALIDATION_ERROR` from Zod before any handler logic          |
| Missing auth                       | 401 from auth middleware; handler never invoked                   |
| Missing permission                 | 403 `FORBIDDEN` from permission middleware; handler never invoked |

---

## Security Review

| Concern                        | Status                                                             |
| ------------------------------ | ------------------------------------------------------------------ |
| RBAC enforced server-side      | ✅ `question_manage` OR `subject_manage` via permission middleware |
| No role checks in frontend     | ✅ N/A — API-only stage                                            |
| No secrets in responses        | ✅ Stack traces stripped from all error responses                  |
| JWT workspace scope enforced   | ✅ Tenant resolver validates workspace membership                  |
| No sensitive data in logs      | ✅ Only IDs and error codes; no PII, passwords, or tokens          |
| SQL injection prevention       | ✅ Parameterized queries exclusively; zero string interpolation    |
| Tenant cross-access prevention | ✅ All queries scoped to tenant DB client from request context     |

---

## Testing Strategy

### Unit Tests — `packages/domain-core/src/lessons/__tests__/lessons.service.test.ts`

Mock `DbClient` with `vi.fn()`. Test each service function in isolation.

**`createLesson`**:

- ✅ Creates lesson when subject exists and name is unique
- ✅ Throws `LESSON_SUBJECT_NOT_FOUND` when `subjectExists` returns false
- ✅ Throws `LESSON_NAME_DUPLICATE` when name already exists in subject
- ✅ Throws `LESSON_NAME_DUPLICATE` when DB returns `23505` (race guard)

**`updateLesson`**:

- ✅ Updates name on ENABLED lesson
- ✅ Throws `LESSON_NOT_FOUND` for unknown id
- ✅ Throws `LESSON_DISABLED` for non-status field update on DISABLED lesson
- ✅ Throws `LESSON_DISABLED` when `status=ENABLED` + `name` both present on DISABLED lesson (Q7)
- ✅ Throws `LESSON_ALREADY_ENABLED` for redundant `status=ENABLED`
- ✅ Throws `LESSON_ALREADY_DISABLED` for redundant `status=DISABLED`
- ✅ Throws `LESSON_NAME_DUPLICATE` when new name collides
- ✅ Re-enables DISABLED lesson with `{ status: 'ENABLED' }` only

**`deleteLesson`**:

- ✅ Sets status=DISABLED; returns `{ deleted: true }`
- ✅ Throws `LESSON_NOT_FOUND` for unknown id
- ✅ Throws `LESSON_ALREADY_DISABLED` for already-disabled lesson

**`listLessons` / `getLesson`**:

- ✅ Returns paginated `ListLessonsResult`
- ✅ Throws `LESSON_NOT_FOUND` for unknown id

### Integration Tests — `apps/api/src/routes/backoffice/lessons/__tests__/lessons.integration.test.ts`

Real tenant test DB with migrations 001–007 applied.

**Coverage**:

- `GET /lessons` — pagination, `subject_id` filter, `status` filter, `search` filter
- `POST /lessons` — 201 happy path; 404 subject not found; 409 name duplicate; 422 missing fields; 403 auth
- `GET /lessons/runtime` — returns only ENABLED lessons; minimal shape `{ id, name, code }`
- `GET /lessons/:id` — 200 happy path; 404 not found; 422 invalid UUID
- `PATCH /lessons/:id` — field update; status transitions; DISABLED guard; Q7 scenario; name duplicate 409
- `DELETE /lessons/:id` — `{ deleted: true }`; 422 already disabled
- **Tenant isolation**: lesson from tenant-A returns 404 from tenant-B context
- **Schema version**: tenant on `1.12.0` returns 409 `SCHEMA_VERSION_MISMATCH`

---

## Dependency Registration

### Lessons registers in Subjects dependency registry

`packages/domain-core/src/subjects/subjects.dependency-registry.ts` must include:

```typescript
// Added by STAGE_29 — prevents subject deletion when lessons reference it
const countLessonsForSubject: DependencyCheckFn = async (db, subjectId) => {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM lessons WHERE subject_id = $1::uuid`,
    [subjectId],
  );
  return parseInt(result.rows[0]?.count ?? "0", 10);
};

subjectDependencyRegistry.push(countLessonsForSubject);
```

### Lessons dependency registry is a stub

`lessonDependencyRegistry` starts empty. MCQ Questions, Traditional Questions, and downstream stages append their own check functions when they introduce `lesson_id` FKs.

---

## Rollback Strategy

Forward-only (ADR-0008). No automated rollback.

**Manual rollback** (DBA operation — irreversible):

1. `DROP TABLE IF EXISTS lessons CASCADE`
2. `UPDATE _schema_versions SET version = '1.12.0', updated_at = NOW() WHERE name = 'schema_version'`
3. Revert `subjects.dependency-registry.ts` — remove `countLessonsForSubject` registration
4. Remove `lessonsRouter` from `apps/api/src/routes/backoffice/index.ts`
5. Remove lessons barrel from `packages/domain-core/src/index.ts`

**Feature flags**: None. Route availability governed by `MIN_SCHEMA_VERSION = 1.13.0`.

---

## Deployment Notes

### Migration fan-out order

1. Confirm `20260320_006_subjects.ts` applied to all tenants (ver ≥ 1.12.0)
2. Apply `20260321_007_lessons.ts` to all tenant databases via migration runner
3. Confirm `_schema_versions.version = '1.13.0'` for all tenants before enabling lesson routes

### Route registration checklist

- [ ] `apps/api/src/routes/backoffice/index.ts` — mount `lessonsRouter`
- [ ] `packages/domain-core/src/index.ts` — export lessons domain barrel
- [ ] `packages/validation/src/backoffice/index.ts` — re-export lessons schemas (if barrel exists)

### Environment gates

- No environment-specific configuration required
- No feature flags required
- No Redis or Worker dependency introduced

---

## Non-Goals

Per spec (fully out of scope for STAGE_29):

- No hard-delete endpoint
- No lesson translations / multi-language support
- No lesson ordering or sequence numbers
- No bulk create/update/disable operations
- No per-lesson permissions
- No lesson-level question counts or coverage metrics
- No Frontoffice API for lessons
- No subject-count license limits
- No lesson reuse across subjects

---

## Final Compliance Statement

Implementation plan compliant with **Zidney Constitution v1.2.0** — No violations detected.

All architectural patterns are direct mirrors of STAGE_28_SUBJECTS. No new architectural patterns introduced. No ADR required.
