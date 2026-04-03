# Implementation Plan: Student Management (STAGE_42)

**Stage**: STAGE_42_STUDENT_MANAGEMENT  
**Phase**: 03_BACKOFFICE_CORE / 05_USER_MANAGEMENT  
**Branch**: `spec/042-student-management`  
**Plan Generated**: 2026-04-06  
**Pattern reference**: STAGE_41_STAFF_MANAGEMENT (identical architectural patterns)

---

## Executive Summary

This stage wires a fully functional student management subsystem into the Zidney backoffice.
The existing `students` table is incomplete — it lacks the 7 identity columns required for
authentication and account lifecycle. A single forward-only migration adds those columns, two
CHECK constraints, and two indexes. The domain-core students module mirrors the established
staff-management pattern: raw-SQL repository, SERIALIZABLE-transaction service, typed error
class, and a bulk-import helper. A Backoffice API router exposes 9 endpoints under
`/api/v1/backoffice/workspace/:workspaceSlug/students`. The frontoffice login handler is
migrated from the legacy `users` table to the `students` table.

---

## Migration Name Correction

> ⚠️ The spec.md states migration filename `20260403_022_student_management.ts`, but sequence
> 021 was dated `20260405`. To maintain date monotonicity the correct filename is:
> **`20260406_022_student_management.ts`**
>
> Schema version bump: `1.27.0 → 1.28.0` (spec.md stated `1.10.0 → 1.11.0` — that is incorrect;
> migration 021 already set the version to `1.27.0`, so this migration must advance to `1.28.0`).

---

## Phase Overview

| Phase | Scope                        | Key Files                                     |
| ----- | ---------------------------- | --------------------------------------------- |
| A     | DB layer                     | Migration 022, students.schema.ts (modified)  |
| B     | Domain-core module           | packages/domain-core/src/students/\*          |
| C     | Validation schemas           | packages/validation/src/student.schema.ts     |
| D     | Backoffice API routes        | apps/api/src/routes/backoffice/students/\*    |
| E     | Auth migration (frontoffice) | apps/api/src/routes/auth/frontoffice-login.ts |
| F     | App registration + tests     | app.ts, **tests**/\*.test.ts                  |

Phases A–C are foundational and dependency-ordered (D depends on B+C, E depends on A, F depends on D+E).

---

## Phase A — Database Layer

### A1: Migration File

**File (create new):**
`apps/api/src/db/tenant/migrations/20260406_022_student_management.ts`

**Format** (mirrors migration 021 exactly):

```typescript
/**
 * Migration: Student Management Identity Columns
 *
 * File: apps/api/src/db/tenant/migrations/20260406_022_student_management.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 *
 * Purpose:
 * Add identity and authentication columns to the existing `students` table so
 * that students can log in via the Frontoffice, have lifecycle (active/disabled),
 * and subscription-based access control can be enforced at runtime.
 *
 * Impact:
 * - Adds 7 columns to `students` with safe NOT-NULL defaults
 * - Adds 2 CHECK constraints for enum correctness
 * - Adds 2 partial indexes for lifecycle queries
 * - Bumps workspace_schema_versions to 1.28.0
 *
 * Safety:
 * - Idempotent via ADD COLUMN IF NOT EXISTS / ADD CONSTRAINT IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
 * - No data loss — all new columns have safe defaults
 * - password_hash defaults to '' — admin must trigger password-set workflow
 *
 * References:
 * - ADR-0003: Database schema evolution
 * - AGENTS.md (apps/api): Migration governance
 * - Previous migration: 20260405_021_add_staff_hierarchy_levels_fkey.ts (1.27.0)
 */
```

DDL inside `up()`:

```sql
-- 1. Add identity columns (all idempotent)
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS phone               VARCHAR(50),
  ADD COLUMN IF NOT EXISTS password_hash       TEXT         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20)  NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS status              VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS token_version       INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_login_count  INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until        TIMESTAMPTZ;

-- 2. Add CHECK constraints
ALTER TABLE students
  ADD CONSTRAINT IF NOT EXISTS chk_students_status
    CHECK (status IN ('ACTIVE', 'DISABLED')),
  ADD CONSTRAINT IF NOT EXISTS chk_students_subscription_status
    CHECK (subscription_status IN ('ACTIVE', 'EXPIRED', 'NONE'));

-- 3. Lifecycle query indexes
CREATE INDEX IF NOT EXISTS idx_students_status
  ON students (status);
CREATE INDEX IF NOT EXISTS idx_students_subscription_status
  ON students (subscription_status);

-- 4. Bump schema version (workspace-scoped table)
UPDATE workspace_schema_versions
  SET version = '1.28.0',
      updated_at = NOW()
  WHERE 1=1;
```

`down()` reverts all columns, constraints, and indexes; bumps version back to `1.27.0`.

---

### A2: Drizzle Schema Update

**File (modify existing):**
`apps/api/src/db/tenant/schemas/students.schema.ts`

Add these imports to the existing import block:

- `integer` (from drizzle-orm/pg-core)
- `text` (from drizzle-orm/pg-core)
- `check` (from drizzle-orm/pg-core)
- `sql` (from drizzle-orm)

Add these columns after `semester_id` in the `pgTable` definition:

```typescript
/** Optional contact number — nullable. */
phone: varchar('phone', { length: 50 }),
/**
 * Argon2id password hash — plaintext never stored.
 * Defaults to '' (empty); admin must trigger password-set workflow post-migration.
 * NEVER included in API responses.
 */
password_hash: text('password_hash').notNull().default(''),
/** Subscription access gate. Added in STAGE_42. */
subscription_status: varchar('subscription_status', { length: 20 }).notNull().default('NONE'),
/**
 * Account lifecycle gate. Added in STAGE_42.
 * ACTIVE | DISABLED. Replaces legacy `users.is_active` for Frontoffice auth.
 */
status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
/**
 * JWT invalidation counter — incremented on credential change or disable.
 * Added in STAGE_42.
 */
token_version: integer('token_version').notNull().default(0),
/** Brute-force counter — reset on successful login. Added in STAGE_42. */
failed_login_count: integer('failed_login_count').notNull().default(0),
/** Account lock expiry — NULL means not locked. Added in STAGE_42. */
locked_until: timestamp('locked_until', { withTimezone: true }),
```

Add to the table config (indexes object):

```typescript
statusIdx: index('idx_students_status').on(table.status),
subscriptionStatusIdx: index('idx_students_subscription_status').on(table.subscription_status),
// Email index added here at ORM level (DB constraint already exists from bootstrap)
emailIdx: index('idx_students_email_unique').on(table.email),
// CHECK constraints (mirrors DB constraints from migration 022)
validStatus: check('chk_students_status', sql`${table.status} IN ('ACTIVE', 'DISABLED')`),
validSubscriptionStatus: check(
  'chk_students_subscription_status',
  sql`${table.subscription_status} IN ('ACTIVE', 'EXPIRED', 'NONE')`
),
```

No change to `export type Student` or `export type NewStudent` — Drizzle infers these automatically.

---

## Phase B — Domain-Core Module

**Directory (create new):** `packages/domain-core/src/students/`

All files follow the identical pattern of `packages/domain-core/src/staff/`.  
No HTTP, no framework imports, no env vars. Pure TypeScript functions only.

### B1: `students.types.ts`

Exact types as per spec.md. Key correction: `AuditContext` must include
`workspace_slug: string` (required by the shared audit infrastructure, as used in staff):

```typescript
export interface AuditContext {
  user_id: string;
  workspace_id: string;
  workspace_slug: string;
  correlation_id: string;
}
```

(spec.md showed `performed_by` and `request_id` — those are wrong field names; staff uses
`user_id` and `correlation_id`. This is corrected here.)

### B2: `students.errors.ts`

Pattern mirrors `staff.errors.ts` exactly.

Error codes and HTTP status mapping:

| Code                          | HTTP |
| ----------------------------- | ---- |
| `STUDENT_NOT_FOUND`           | 404  |
| `STUDENT_EMAIL_CONFLICT`      | 409  |
| `STUDENT_LIMIT_EXCEEDED`      | 422  |
| `STUDENT_DIVISION_REQUIRED`   | 422  |
| `STUDENT_DIVISION_INACTIVE`   | 422  |
| `STUDENT_DEPARTMENT_MISMATCH` | 422  |
| `STUDENT_GROUP_MISMATCH`      | 422  |
| `STUDENT_HAS_ATTEMPTS`        | 409  |
| `STUDENT_ALREADY_DISABLED`    | 409  |
| `STUDENT_ALREADY_ACTIVE`      | 409  |
| `STUDENT_INVALID_INPUT`       | 400  |

```typescript
export type StudentErrorCode =
  | "STUDENT_NOT_FOUND"
  | "STUDENT_EMAIL_CONFLICT"
  | "STUDENT_LIMIT_EXCEEDED"
  | "STUDENT_DIVISION_REQUIRED"
  | "STUDENT_DIVISION_INACTIVE"
  | "STUDENT_DEPARTMENT_MISMATCH"
  | "STUDENT_GROUP_MISMATCH"
  | "STUDENT_HAS_ATTEMPTS"
  | "STUDENT_ALREADY_DISABLED"
  | "STUDENT_ALREADY_ACTIVE"
  | "STUDENT_INVALID_INPUT";

export const STUDENT_ERROR_HTTP: Record<StudentErrorCode, number> = {
  STUDENT_NOT_FOUND: 404,
  STUDENT_EMAIL_CONFLICT: 409,
  STUDENT_LIMIT_EXCEEDED: 422,
  STUDENT_DIVISION_REQUIRED: 422,
  STUDENT_DIVISION_INACTIVE: 422,
  STUDENT_DEPARTMENT_MISMATCH: 422,
  STUDENT_GROUP_MISMATCH: 422,
  STUDENT_HAS_ATTEMPTS: 409,
  STUDENT_ALREADY_DISABLED: 409,
  STUDENT_ALREADY_ACTIVE: 409,
  STUDENT_INVALID_INPUT: 400,
};

export class StudentError extends Error {
  readonly code: StudentErrorCode;
  readonly httpStatus: number;
  constructor(code: StudentErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.httpStatus = STUDENT_ERROR_HTTP[code];
  }
}
```

### B3: `students.repository.ts`

Raw SQL functions. All accept `DbClient` (not `Pool`). All use parameterized `$N` placeholders.

**Key repository functions:**

```typescript
// Read
findStudentById(db, workspaceId, studentId): Promise<StudentRow | null>
findStudentByEmailForUpdate(db, workspaceId, email): Promise<StudentRow | null>  // SELECT FOR UPDATE
countActiveStudents(db, workspaceId): Promise<number>                            // SELECT FOR UPDATE

// Write
insertStudent(db, fields): Promise<StudentRow>
updateStudent(db, workspaceId, studentId, fields): Promise<StudentRow | null>
updateStudentStatus(db, workspaceId, studentId, status, tokenVersionIncrement: boolean): Promise<StudentRow | null>
updateSubscriptionStatus(db, workspaceId, studentId, subscriptionStatus): Promise<StudentRow | null>
softDeleteStudent(db, workspaceId, studentId): Promise<boolean>
bulkInsertStudents(db, rows): Promise<StudentRow[]>

// Validation helpers (must run inside caller's transaction)
checkStudentHasAttempts(db, workspaceId, studentId): Promise<boolean>
validateDivisionActive(db, workspaceId, divisionId): Promise<boolean>
validateDepartmentBelongsToDivision(db, workspaceId, departmentId, divisionId): Promise<boolean>
validateGroupBelongsToDepartmentOrDivision(db, workspaceId, groupId, departmentId, divisionId): Promise<boolean>
```

**listStudents** builds a dynamic WHERE clause from `StudentListQuery` (status, subscription_status,
division_id filters) and uses a single COUNT(\*) OVER() window expression for total pagination.

**countActiveStudents** must use `SELECT COUNT(*) FROM students WHERE workspace_id = $1 AND status = 'ACTIVE' FOR UPDATE` to prevent TOCTOU race on student_limit enforcement.

### B4: `students.service.ts`

Business logic. Mirrors `staff.service.ts`.

Transaction pattern:

```typescript
async function createStudent(db, input, studentLimit, audit): Promise<StudentRecord> {
  const client = await db.connect();
  await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  try {
    // 1. Email uniqueness — SELECT FOR UPDATE
    // 2. Student limit — SELECT COUNT FOR UPDATE
    // 3. Division active check
    // 4. Department belongs to division (if provided)
    // 5. Group belongs to department/division (if provided)
    // 6. Hash password via hashStaffPassword (from @zidney/domain-core/auth/staff-password)
    // 7. insertStudent()
    await client.query("COMMIT");
    return toStudentRecord(row);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
```

`toStudentRecord()` strips `password_hash`, `failed_login_count`, and `locked_until` from the
database row before returning the public `StudentRecord`.

`disableStudent`: sets `status = 'DISABLED'`, bumps `token_version` by 1.
`enableStudent`: sets `status = 'ACTIVE'`.
`deleteStudent`: checks `checkStudentHasAttempts` — if true throw `STUDENT_HAS_ATTEMPTS`; else call `softDeleteStudent`.
`updateSubscriptionStatus`: simple UPDATE, no SERIALIZABLE required.
`bulkImportStudents`: delegates to `students.bulk-import.ts`.

### B5: `students.bulk-import.ts`

Processes rows in batches of 50. For each batch:

```typescript
for (const batch of chunks(rows, 50)) {
  const client = await db.connect();
  await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  try {
    const current = await countActiveStudents(client, workspaceId); // FOR UPDATE
    for (const row of batch) {
      if (current + inserted >= studentLimit) {
        /* record STUDENT_LIMIT_EXCEEDED per row */ continue;
      }
      // Per-row: email check, hash password, insert
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
return { inserted, skipped, errors };
```

### B6: `index.ts`

Re-exports all service functions (`createStudent`, `listStudents`, `getStudentById`,
`updateStudent`, `disableStudent`, `enableStudent`, `deleteStudent`,
`updateSubscriptionStatus`, `bulkImportStudents`) and all types from `students.types.ts` and
`StudentError`, `StudentErrorCode`, `STUDENT_ERROR_HTTP` from `students.errors.ts`.

---

## Phase C — Validation Schemas

**File (create new):** `packages/validation/src/student.schema.ts`

Pattern mirrors `staff.schema.ts`.

```typescript
import { z } from "zod";

// Subscription status enum
export const subscriptionStatusSchema = z.enum(["ACTIVE", "EXPIRED", "NONE"]);

// Student status enum
export const studentStatusSchema = z.enum(["ACTIVE", "DISABLED"]);

// Create
export const createStudentBodySchema = z.object({
  email: z.string().email().trim().max(255),
  first_name: z.string().trim().min(1).max(255),
  last_name: z.string().trim().min(1).max(255),
  phone: z.string().trim().max(50).nullable().optional(),
  password: z.string().min(8).max(128),
  division_id: z.string().uuid(),
  department_id: z.string().uuid().nullable().optional(),
  group_id: z.string().uuid().nullable().optional(),
  semester_id: z.string().uuid().nullable().optional(),
  subscription_status: subscriptionStatusSchema.optional(),
});

// Update (at least one field required)
export const updateStudentBodySchema = z
  .object({
    first_name: z.string().trim().min(1).max(255).optional(),
    last_name: z.string().trim().min(1).max(255).optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    division_id: z.string().uuid().optional(),
    department_id: z.string().uuid().nullable().optional(),
    group_id: z.string().uuid().nullable().optional(),
    semester_id: z.string().uuid().nullable().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field must be provided for update",
  });

// List query
export const studentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: studentStatusSchema.optional(),
  subscription_status: subscriptionStatusSchema.optional(),
  division_id: z.string().uuid().optional(),
});

// Bulk import
export const bulkImportRowSchema = z.object({
  email: z.string().email().trim().max(255),
  first_name: z.string().trim().min(1).max(255),
  last_name: z.string().trim().min(1).max(255),
  phone: z.string().trim().max(50).nullable().optional(),
  password: z.string().min(8).max(128),
  division_id: z.string().uuid(),
  department_id: z.string().uuid().nullable().optional(),
  group_id: z.string().uuid().nullable().optional(),
  semester_id: z.string().uuid().nullable().optional(),
  subscription_status: subscriptionStatusSchema.optional(),
});

export const bulkImportBodySchema = z.array(bulkImportRowSchema).min(1).max(500);

// Update subscription status
export const updateSubscriptionStatusBodySchema = z.object({
  subscription_status: subscriptionStatusSchema,
});
```

Also register schemas in `packages/validation/src/index.ts` via named exports.

---

## Phase D — Backoffice API Routes

**Directory (create new):** `apps/api/src/routes/backoffice/students/`

### D0: `helpers.ts`

Mirrors `apps/api/src/routes/backoffice/staff/helpers.ts`:

```typescript
import type { Context } from "hono";
import type { BackofficeEnv } from "../../../app.types";
import type { DbClient } from "@zidney/domain-core/students";
import { StudentError } from "@zidney/domain-core/students";
import { createLogger } from "@zidney/logger";

const logger = createLogger("students-route");

export function getDb(c: Context<BackofficeEnv>): DbClient {
  return c.get("tenant").pool as DbClient;
}

export function buildAuditCtx(c: Context<BackofficeEnv>) {
  const user = c.get("user");
  const tenant = c.get("tenant");
  return {
    user_id: user.id,
    workspace_id: tenant.workspaceId,
    workspace_slug: tenant.workspaceSlug,
    correlation_id: c.get("correlationId") ?? "",
  };
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function studentErrorResponse(c: Context, err: unknown) {
  if (err instanceof StudentError) {
    return c.json(
      { success: false, data: null, error: { code: err.code, message: err.message } },
      err.httpStatus as Parameters<typeof c.json>[1],
    );
  }
  logger.error({ err }, "Unhandled student route error");
  return c.json(
    {
      success: false,
      data: null,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    },
    500,
  );
}
```

### D1: `index.ts` — Router Assembly

Pattern mirrors `apps/api/src/routes/backoffice/staff/index.ts`.

```typescript
import { Hono } from "hono";
import type { BackofficeEnv } from "../../../app.types";
import { createPermissionGuard } from "../../../middleware/backoffice-permission-guard-v2";
import { PermissionModule } from "@zidney/domain-core";
import { createLogger } from "@zidney/logger";

// Handlers
import { handleCreateStudent } from "./create-student";
import { handleListStudents } from "./list-students";
import { handleGetStudent } from "./get-student";
import { handleUpdateStudent } from "./update-student";
import { handleDisableStudent } from "./disable-student";
import { handleEnableStudent } from "./enable-student";
import { handleDeleteStudent } from "./delete-student";
import { handleUpdateSubscriptionStatus } from "./update-subscription-status";
import { handleBulkImportStudents } from "./bulk-import-students";

const logger = createLogger("students-router");

const studentsRouter = new Hono<BackofficeEnv>();

// ── RBAC guards ────────────────────────────────────────────────────────────

const canView = createPermissionGuard(logger, PermissionModule.USERS, "can_view");
const canCreate = createPermissionGuard(logger, PermissionModule.USERS, "can_create");
const canEdit = createPermissionGuard(logger, PermissionModule.USERS, "can_edit");
const canDelete = createPermissionGuard(logger, PermissionModule.USERS, "can_delete");

// ── IMPORTANT: action sub-paths BEFORE /:id ────────────────────────────────
// disable/enable/subscription routes MUST be registered before /:id to prevent
// Hono matching '/:id' on 'disable', 'enable', 'subscription', 'bulk-import'

studentsRouter.post("/students/bulk-import", canCreate, handleBulkImportStudents);
studentsRouter.patch("/students/:id/disable", canEdit, handleDisableStudent);
studentsRouter.patch("/students/:id/enable", canEdit, handleEnableStudent);
studentsRouter.patch("/students/:id/subscription", canEdit, handleUpdateSubscriptionStatus);

// ── CRUD ───────────────────────────────────────────────────────────────────
studentsRouter.post("/students", canCreate, handleCreateStudent);
studentsRouter.get("/students", canView, handleListStudents);
studentsRouter.get("/students/:id", canView, handleGetStudent);
studentsRouter.patch("/students/:id", canEdit, handleUpdateStudent);
studentsRouter.delete("/students/:id", canDelete, handleDeleteStudent);

export { studentsRouter };
```

### D2: Handler files

Each handler file follows the same shape as `create-staff.ts`:

```typescript
// create-student.ts
import type { Context } from "hono";
import type { BackofficeEnv } from "../../../app.types";
import { createStudentBodySchema } from "@zidney/validation";
import { createStudent } from "@zidney/domain-core/students";
import { createLogger } from "@zidney/logger";
import { getDb, buildAuditCtx, studentErrorResponse } from "./helpers";

const logger = createLogger("create-student");

export async function handleCreateStudent(c: Context<BackofficeEnv>) {
  try {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          success: false,
          data: null,
          error: { code: "INVALID_JSON", message: "Invalid request body" },
        },
        400,
      );
    }

    const parsed = createStudentBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          data: null,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        },
        400,
      );
    }

    const db = getDb(c);
    const audit = buildAuditCtx(c);
    const studentLimit = c.get("license")?.student_limit ?? 100;
    const student = await createStudent(
      db,
      { workspace_id: c.get("tenant").workspaceId, ...parsed.data },
      studentLimit,
      audit,
    );

    return c.json({ success: true, data: student, error: null }, 201);
  } catch (err) {
    return studentErrorResponse(c, err);
  }
}
```

Remaining handlers follow the same try/catch structure:

- `list-students.ts` → `handleListStudents`: parses query string with `studentListQuerySchema`, calls `listStudents`
- `get-student.ts` → `handleGetStudent`: validates `:id` UUID, calls `getStudentById`
- `update-student.ts` → `handleUpdateStudent`: validates `:id` UUID + body, calls `updateStudent`
- `disable-student.ts` → `handleDisableStudent`: validates `:id` UUID, calls `disableStudent`
- `enable-student.ts` → `handleEnableStudent`: validates `:id` UUID, calls `enableStudent`
- `delete-student.ts` → `handleDeleteStudent`: validates `:id` UUID, calls `deleteStudent`
- `update-subscription-status.ts` → `handleUpdateSubscriptionStatus`: validates `:id` UUID + body, calls `updateSubscriptionStatus`
- `bulk-import-students.ts` → `handleBulkImportStudents`: parses body as array, calls `bulkImportStudents`

All handlers strip `password_hash` from any raw row before serialising (service layer returns `StudentRecord` which already omits it).

---

## Phase E — Frontoffice Login Migration

**File (modify existing):**
`apps/api/src/routes/auth/frontoffice-login.ts`

**Current state:** Queries the legacy `users` table using `WHERE role = 'student'` to authenticate students.

**Required change:** Replace **all** SQL statements that target `users` with equivalent statements targeting `students`. Specifically:

1. Replace the `SELECT` query:

   ```sql
   -- REMOVE:
   SELECT id, email, password_hash, token_version, locked_until, role
   FROM users WHERE email = $1 AND role = 'student' FOR UPDATE

   -- REPLACE WITH:
   SELECT id, email, password_hash, token_version, locked_until,
          status, failed_login_count
   FROM students WHERE email = $1 AND workspace_id = $2 FOR UPDATE
   ```

2. Replace `is_active` check with `status = 'ACTIVE'` check.

3. Replace any UPDATE statements for `failed_login_count` and `locked_until` to target `students` table.

4. Pass `workspace_id` as a query parameter everywhere (scoped to tenant workspace, not global user table).

5. The function signature and JWT payload structure are preserved — only the table and column names change.

**Implementation constraint:** This file already connects using a `PoolClient` pattern consistent with domain-core. No new abstraction layer is needed.

---

## Phase F — App Registration + Tests

### F1: `apps/api/src/app.ts` — Router registration

After the existing `staffRouter` mount (line ~216):

```typescript
import { studentsRouter } from "./routes/backoffice/students";
// ...
app.route("/api/v1/backoffice/workspace", studentsRouter);
```

The students router is mounted at the **same path** as `staffRouter`. The sub-path `/students`
is declared inside the router itself, resulting in full URLs like:
`/api/v1/backoffice/workspace/:workspaceSlug/students`

### F2: Integration Tests

**File (create new):**
`apps/api/src/routes/backoffice/students/__tests__/students.test.ts`

Test coverage required:

| Test                                           | Assertions                                     |
| ---------------------------------------------- | ---------------------------------------------- |
| POST /students success                         | Returns 201 + StudentRecord (no password_hash) |
| POST /students email conflict                  | Returns 409 STUDENT_EMAIL_CONFLICT             |
| POST /students limit exceeded                  | Returns 422 STUDENT_LIMIT_EXCEEDED             |
| POST /students invalid division                | Returns 422 STUDENT_DIVISION_INACTIVE          |
| GET /students (paginated)                      | Returns 200 + StudentListResult                |
| GET /students/:id found                        | Returns 200 + StudentRecord                    |
| GET /students/:id not found                    | Returns 404 STUDENT_NOT_FOUND                  |
| PATCH /students/:id update                     | Returns 200 + updated StudentRecord            |
| PATCH /students/:id/disable                    | Returns 200 + status=DISABLED                  |
| PATCH /students/:id/enable                     | Returns 200 + status=ACTIVE                    |
| PATCH /students/:id/disable (already disabled) | Returns 409 STUDENT_ALREADY_DISABLED           |
| DELETE /students/:id (no attempts)             | Returns 200 + { deleted: true }                |
| DELETE /students/:id (has attempts)            | Returns 409 STUDENT_HAS_ATTEMPTS               |
| PATCH /students/:id/subscription               | Returns 200 + updated subscription_status      |
| POST /students/bulk-import (success)           | Returns 200 + BulkImportResult                 |
| POST /students/bulk-import (limit reached)     | Returns 200 + BulkImportResult with errors     |

### F3: Domain-Core Unit Tests

**File (create new):**
`packages/domain-core/src/students/__tests__/students.service.test.ts`

Test coverage required:

| Test                                 | Assertions                                     |
| ------------------------------------ | ---------------------------------------------- |
| createStudent — success              | Returns StudentRecord                          |
| createStudent — email conflict       | Throws StudentError STUDENT_EMAIL_CONFLICT     |
| createStudent — limit exceeded       | Throws StudentError STUDENT_LIMIT_EXCEEDED     |
| createStudent — ROLLBACK on error    | Verifies client.query('ROLLBACK') called       |
| disableStudent — success             | Returns StudentRecord with status=DISABLED     |
| disableStudent — already disabled    | Throws StudentError STUDENT_ALREADY_DISABLED   |
| enableStudent — success              | Returns StudentRecord with status=ACTIVE       |
| enableStudent — already active       | Throws StudentError STUDENT_ALREADY_ACTIVE     |
| deleteStudent — no attempts          | Calls softDeleteStudent                        |
| deleteStudent — has attempts         | Throws StudentError STUDENT_HAS_ATTEMPTS       |
| bulkImportStudents — partial failure | Returns correct inserted/skipped/errors counts |

---

## Transaction Boundaries

| Operation                | Isolation Level | Tables Locked                          |
| ------------------------ | --------------- | -------------------------------------- |
| createStudent            | SERIALIZABLE    | students (FOR UPDATE on email + count) |
| updateStudent            | READ COMMITTED  | students (single row by PK)            |
| disableStudent           | READ COMMITTED  | students (single row by PK)            |
| enableStudent            | READ COMMITTED  | students (single row by PK)            |
| deleteStudent            | READ COMMITTED  | students (single row by PK), attempts  |
| updateSubscriptionStatus | READ COMMITTED  | students (single row by PK)            |
| bulkImportStudents       | SERIALIZABLE    | students (FOR UPDATE count per batch)  |

---

## Error Response Contract

All route handlers return the standard contract on error:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "STUDENT_NOT_FOUND",
    "message": "Student not found"
  }
}
```

HTTP status is determined by `STUDENT_ERROR_HTTP[errorCode]`.

---

## Dependencies

No new npm packages are required. All imports are from existing workspace packages:

| Import path                               | Package                              |
| ----------------------------------------- | ------------------------------------ |
| `@zidney/domain-core/students`            | packages/domain-core (new submodule) |
| `@zidney/validation`                      | packages/validation                  |
| `@zidney/logger`                          | packages/logger                      |
| `@zidney/domain-core/auth/staff-password` | packages/domain-core (existing)      |
| `hono`                                    | existing                             |
| `pg`                                      | existing                             |
| `drizzle-orm/pg-core`                     | existing                             |

---

## File Creation / Modification Checklist

### New files

- [ ] `apps/api/src/db/tenant/migrations/20260406_022_student_management.ts`
- [ ] `packages/domain-core/src/students/students.types.ts`
- [ ] `packages/domain-core/src/students/students.errors.ts`
- [ ] `packages/domain-core/src/students/students.repository.ts`
- [ ] `packages/domain-core/src/students/students.service.ts`
- [ ] `packages/domain-core/src/students/students.bulk-import.ts`
- [ ] `packages/domain-core/src/students/index.ts`
- [ ] `packages/validation/src/student.schema.ts`
- [ ] `apps/api/src/routes/backoffice/students/helpers.ts`
- [ ] `apps/api/src/routes/backoffice/students/index.ts`
- [ ] `apps/api/src/routes/backoffice/students/create-student.ts`
- [ ] `apps/api/src/routes/backoffice/students/list-students.ts`
- [ ] `apps/api/src/routes/backoffice/students/get-student.ts`
- [ ] `apps/api/src/routes/backoffice/students/update-student.ts`
- [ ] `apps/api/src/routes/backoffice/students/disable-student.ts`
- [ ] `apps/api/src/routes/backoffice/students/enable-student.ts`
- [ ] `apps/api/src/routes/backoffice/students/delete-student.ts`
- [ ] `apps/api/src/routes/backoffice/students/update-subscription-status.ts`
- [ ] `apps/api/src/routes/backoffice/students/bulk-import-students.ts`
- [ ] `apps/api/src/routes/backoffice/students/__tests__/students.test.ts`
- [ ] `packages/domain-core/src/students/__tests__/students.service.test.ts`

### Modified files

- [ ] `apps/api/src/db/tenant/schemas/students.schema.ts` — add 7 columns + 2 constraints + 2 indexes
- [ ] `packages/validation/src/index.ts` — re-export student schemas
- [ ] `apps/api/src/routes/auth/frontoffice-login.ts` — target `students` table
- [ ] `apps/api/src/app.ts` — register studentsRouter

Total: 22 new files + 4 modified files = 26 file operations
