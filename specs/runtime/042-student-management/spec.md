# Feature Specification: Student Management

**Feature Branch**: `spec/042-student-management`
**Stage**: `STAGE_42_STUDENT_MANAGEMENT`
**Phase**: `03_BACKOFFICE_CORE / 05_USER_MANAGEMENT`
**Created**: 2026-04-03
**Status**: DRAFT
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/05_USER_MANAGEMENT/STAGE_42_STUDENT_MANAGEMENT.md`

---

## Feature Overview

This stage implements the full Student Management lifecycle for the Zidney Backoffice within
the multi-tenant workspace scope. Students are Frontoffice users stored exclusively in the
tenant database. Unlike staff (Backoffice users), students are academically constrained: each
student belongs to exactly one division, may optionally belong to a department, group, and
semester, and is subject to subscription-based access control enforced at the runtime layer.

**What is being built:**

- A forward-only migration (`20260403_022_student_management.ts`) that adds missing identity
  columns to the existing `students` table:
  - `phone` VARCHAR(50) NULLABLE — optional contact number
  - `password_hash` TEXT NOT NULL DEFAULT '' — Argon2id credential (backfilled empty for
    existing rows; admin must trigger password-set workflows post-migration)
  - `subscription_status` VARCHAR(20) NOT NULL DEFAULT 'NONE' — one of `ACTIVE | EXPIRED | NONE`
  - `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' — one of `ACTIVE | DISABLED`
  - `token_version` INTEGER NOT NULL DEFAULT 0 — incremented on credential change for JWT
    invalidation
  - `failed_login_count` INTEGER NOT NULL DEFAULT 0 — brute-force counter (reset on login
    success)
  - `locked_until` TIMESTAMPTZ NULLABLE — account lock expiry (NULL = not locked)
  - DB CHECK constraint: `status IN ('ACTIVE','DISABLED')`
  - DB CHECK constraint: `subscription_status IN ('ACTIVE','EXPIRED','NONE')`
  - Indexes: `idx_students_status`, `idx_students_subscription_status`
  - `schema_version` bump: `1.10.0 → 1.11.0`

- Updated Drizzle schema `apps/api/src/db/tenant/schemas/students.schema.ts` reflecting all new
  columns with correct Drizzle-ORM field types.

- Domain-core `students` module at `packages/domain-core/src/students/` containing:
  - `students.types.ts` — pure type definitions (enums, DB rows, domain records, inputs)
  - `students.errors.ts` — typed error class `StudentError` with registry of error codes
  - `students.repository.ts` — raw SQL repository functions (no framework deps)
  - `students.service.ts` — business logic: create, list, get, update, disable, enable, delete,
    bulk-import
  - `students.bulk-import.ts` — batch insert logic with limit enforcement per-batch
  - `index.ts` — public surface re-exports

- Validation schemas at `packages/validation/src/student.schema.ts` using Zod for all inputs:
  create, update, list query, bulk import row.

- Backoffice API router at `apps/api/src/routes/backoffice/students/` with:
  - `POST /backoffice/students` — create student (transactional limit check, Argon2id password)
  - `GET /backoffice/students` — list students (paginated, filters: status, division_id,
    subscription_status)
  - `GET /backoffice/students/:id` — get one student
  - `PATCH /backoffice/students/:id` — update name/email/phone/academic assignment
  - `PATCH /backoffice/students/:id/disable` — disable account (JWT invalidation via
    token_version bump)
  - `PATCH /backoffice/students/:id/enable` — re-enable a disabled account
  - `DELETE /backoffice/students/:id` — transactional deletion (blocked if attempts exist;
    otherwise executes soft-delete via `status = DISABLED`)
  - `PATCH /backoffice/students/:id/subscription` — update subscription_status
  - `POST /backoffice/students/bulk-import` — multi-row import (ndjson or JSON array,
    validated per-row, stops at student_limit)
  - Route files: `create-student.ts`, `list-students.ts`, `get-student.ts`, `update-student.ts`,
    `disable-student.ts`, `enable-student.ts`, `delete-student.ts`,
    `update-subscription-status.ts`, `bulk-import-students.ts`, `index.ts`
  - `__tests__/students.test.ts` — integration tests

- Update `apps/api/src/routes/auth/frontoffice-login.ts` to query the `students` table
  (instead of the legacy `users` table) using the pg `PoolClient` directly (consistent with
  current implementation style), verifying Argon2id `password_hash` and checking `status =
'ACTIVE'` before issuing JWT. Preserves all existing account-lock / token-version logic but
  pointed to the correct table.

- Registration of `studentsRouter` in `apps/api/src/app.ts`.

- Unit tests for domain-core service and repository functions.

**Phase & Stage mapping:** Phase 03 Backoffice Core, User Management subdomain. This stage
depends on Divisions (22), Departments (23), Groups (24), Semesters (27), Staff Management
(41). Students are Frontoffice users; their academic structure references must already be stable.

**Affected system areas:**

| Area                  | Affected? | Notes                                                                      |
| --------------------- | --------- | -------------------------------------------------------------------------- |
| Tenant Isolation      | Yes       | All student data in tenant DB; `workspace_id` scopes all queries           |
| License Enforcement   | Yes       | `student_limit` enforced transactionally on every student creation         |
| Attempt Engine        | No        | Stage does not modify attempt or grading logic                             |
| Worker                | No        | All student CRUD is synchronous                                            |
| Runtime / Frontoffice | Yes       | `frontoffice-login.ts` updated to use `students` table                     |
| Auth (Frontoffice)    | Yes       | Login queries `students` table; `status` check replaces legacy `is_active` |
| Auth (Backoffice)     | No        | Staff auth unchanged                                                       |

---

## Constitutional Compliance Declaration

| Rule                                   | Compliance                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| No cross-tenant access                 | ✓ All tables reside exclusively within the tenant DB; workspace scopes every query        |
| No middleware bypass                   | ✓ Tenant resolver → license middleware → RBAC guard mandatory before every student route  |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic                                         |
| No direct DB instantiation             | ✓ All DB access via `c.get('tenantDb')` or `getTenantPool(workspaceId)` only              |
| No weakening of snapshot integrity     | ✓ Feature does not touch attempt snapshots                                                |
| No weakening of transaction boundaries | ✓ Create, delete, disable/enable, and bulk-import are fully transactional                 |
| No weakening of version enforcement    | ✓ Migration bumps `schema_version`; runtime rejects incompatible tenants                  |
| Server-authoritative time only         | ✓ `created_at` / `updated_at` set by PostgreSQL `NOW()`; client time never trusted        |
| No console.log allowed                 | ✓ All logging via `createLogger` from `@zidney/logger`                                    |
| Argon2id for student passwords         | ✓ Uses `hashStaffPassword` / `verifyStaffPassword` from `domain-core/auth/staff-password` |

No exceptions requiring an ADR were detected for this stage.

---

## Isolation Impact Analysis

| Boundary                | Impact | Notes                                                            |
| ----------------------- | ------ | ---------------------------------------------------------------- |
| Tenant DB boundary      | ✓      | `students` table in tenant DB; no master DB reference            |
| Cross-tenant query risk | None   | Division validation uses `workspace_id` scope; no global lookup  |
| Auth boundary           | ✓      | `frontoffice-login.ts` adopts `status` column to replace `users` |
| License boundary        | ✓      | `student_limit` enforced under SERIALIZABLE isolation            |
| Attempt preservation    | ✓      | Delete blocked if attempts exist; DISABLED used as soft-delete   |

---

## Database Schema Changes

### Migration File

**File:** `apps/api/src/db/tenant/migrations/20260403_022_student_management.ts`
**Sequence:** 022 (follows `20260405_021_add_staff_hierarchy_levels_fkey.ts`)
**Schema version:** `1.10.0 → 1.11.0`

### DDL (within single transaction)

```sql
BEGIN;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS phone            VARCHAR(50),
  ADD COLUMN IF NOT EXISTS password_hash    TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS status           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS token_version    INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until     TIMESTAMPTZ;

ALTER TABLE students
  ADD CONSTRAINT IF NOT EXISTS chk_students_status
    CHECK (status IN ('ACTIVE', 'DISABLED')),
  ADD CONSTRAINT IF NOT EXISTS chk_students_subscription_status
    CHECK (subscription_status IN ('ACTIVE', 'EXPIRED', 'NONE'));

CREATE INDEX IF NOT EXISTS idx_students_status
  ON students (status);
CREATE INDEX IF NOT EXISTS idx_students_subscription_status
  ON students (subscription_status);
CREATE INDEX IF NOT EXISTS idx_students_email_unique
  ON students (email);

UPDATE schema_versions
  SET version = '1.11.0', updated_at = NOW()
  WHERE name = 'tenant';

COMMIT;
```

### Drizzle Schema Update

**File:** `apps/api/src/db/tenant/schemas/students.schema.ts`

Add these columns to the existing `pgTable` definition (after `semester_id`):

- `phone: varchar('phone', { length: 50 })` — nullable
- `password_hash: text('password_hash').notNull().default('')`
- `subscription_status: varchar('subscription_status', { length: 20 }).notNull().default('NONE')`
- `status: varchar('status', { length: 20 }).notNull().default('ACTIVE')`
- `token_version: integer('token_version').notNull().default(0)`
- `failed_login_count: integer('failed_login_count').notNull().default(0)`
- `locked_until: timestamp('locked_until', { withTimezone: true })` — nullable

Add indexes to the table config:

- `statusIdx: index('idx_students_status').on(table.status)`
- `subscriptionStatusIdx: index('idx_students_subscription_status').on(table.subscription_status)`
- `emailIdx: index('idx_students_email_unique').on(table.email)` (if not already declared)

---

## Domain-Core Module

### `packages/domain-core/src/students/students.types.ts`

```typescript
export type StudentStatus = "ACTIVE" | "DISABLED";
export type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "NONE";

export interface DbClient {
  query<T = unknown>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface StudentRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  password_hash: string;
  division_id: string;
  department_id: string | null;
  group_id: string | null;
  semester_id: string | null;
  subscription_status: SubscriptionStatus;
  status: StudentStatus;
  token_version: number;
  failed_login_count: number;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface StudentRecord {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  division_id: string;
  department_id: string | null;
  group_id: string | null;
  semester_id: string | null;
  subscription_status: SubscriptionStatus;
  status: StudentStatus;
  token_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateStudentInput {
  workspace_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  password: string;
  division_id: string;
  department_id?: string | null;
  group_id?: string | null;
  semester_id?: string | null;
  subscription_status?: SubscriptionStatus;
}

export interface UpdateStudentInput {
  workspace_id: string;
  student_id: string;
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  division_id?: string;
  department_id?: string | null;
  group_id?: string | null;
  semester_id?: string | null;
}

export interface UpdateSubscriptionInput {
  workspace_id: string;
  student_id: string;
  subscription_status: SubscriptionStatus;
}

export interface StudentListQuery {
  workspace_id: string;
  page?: number;
  limit?: number;
  status?: StudentStatus;
  subscription_status?: SubscriptionStatus;
  division_id?: string;
}

export interface StudentListResult {
  items: StudentRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditContext {
  workspace_id: string;
  performed_by: string;
  request_id: string;
}

export interface BulkImportRow {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  password: string;
  division_id: string;
  department_id?: string | null;
  group_id?: string | null;
  semester_id?: string | null;
  subscription_status?: SubscriptionStatus;
}

export interface BulkImportResult {
  inserted: number;
  skipped: number;
  errors: Array<{ row: number; email: string; reason: string }>;
}
```

### `packages/domain-core/src/students/students.errors.ts`

Error codes for the student domain:

- `STUDENT_NOT_FOUND` (404)
- `STUDENT_EMAIL_CONFLICT` (409)
- `STUDENT_LIMIT_EXCEEDED` (422)
- `STUDENT_DIVISION_REQUIRED` (422)
- `STUDENT_DIVISION_INACTIVE` (422)
- `STUDENT_DEPARTMENT_MISMATCH` (422)
- `STUDENT_HAS_ATTEMPTS` (409) — block hard delete
- `STUDENT_ALREADY_DISABLED` (409)
- `STUDENT_ALREADY_ACTIVE` (409)

### `packages/domain-core/src/students/students.repository.ts`

Raw SQL repository functions (no HTTP, no framework). All functions accept `DbClient` and use parameterized queries:

- `findStudentById(db, workspaceId, studentId)` → `StudentRow | null`
- `findStudentByEmailForUpdate(db, workspaceId, email)` → `StudentRow | null` (SELECT FOR UPDATE)
- `countActiveStudents(db, workspaceId)` → `number` (SELECT FOR UPDATE)
- `insertStudent(db, fields)` → `StudentRow`
- `listStudents(db, query)` → `{ rows: StudentRow[], total: number }`
- `updateStudent(db, workspaceId, studentId, fields)` → `StudentRow | null`
- `updateStudentStatus(db, workspaceId, studentId, status, tokenVersionIncrement)` → `StudentRow | null`
- `updateSubscriptionStatus(db, workspaceId, studentId, subscriptionStatus)` → `StudentRow | null`
- `softDeleteStudent(db, workspaceId, studentId)` → `boolean`
- `checkStudentHasAttempts(db, workspaceId, studentId)` → `boolean`
- `bulkInsertStudents(db, rows)` → `StudentRow[]`

Division validation queries (must run in transaction, not standalone):

- `validateDivisionActive(db, workspaceId, divisionId)` → `boolean`
- `validateDepartmentBelongsToDivision(db, workspaceId, departmentId, divisionId)` → `boolean`
- `validateGroupBelongsToDepartmentOrDivision(db, workspaceId, groupId, departmentId, divisionId)` → `boolean`

### `packages/domain-core/src/students/students.service.ts`

Business logic entry points, all transactions managed explicitly:

- `createStudent(db, input, studentLimit, audit)` — SERIALIZABLE isolation; validates:
  1. Email uniqueness (FOR UPDATE lock)
  2. Student limit (FOR UPDATE count)
  3. Division active
  4. Department belongs to division (if present)
  5. Group belongs to department/division (if present)
     → Hashes password with Argon2id; inserts student; commits

- `listStudents(db, query)` — read-only query with pagination and filters

- `getStudentById(db, workspaceId, studentId)` → throws `STUDENT_NOT_FOUND` if absent

- `updateStudent(db, input, audit)` — validates new division/department/group if provided

- `disableStudent(db, workspaceId, studentId, audit)` — sets `status = DISABLED`, bumps
  `token_version`; throws `STUDENT_ALREADY_DISABLED` if already disabled

- `enableStudent(db, workspaceId, studentId, audit)` — sets `status = ACTIVE`; throws
  `STUDENT_ALREADY_ACTIVE` if already active

- `deleteStudent(db, workspaceId, studentId, audit)`:
  - If student has attempts → throws `STUDENT_HAS_ATTEMPTS`
  - Else → calls `softDeleteStudent` (sets `status = DISABLED`)

- `updateSubscriptionStatus(db, input, audit)` — updates subscription_status

- `bulkImportStudents(db, rows, studentLimit, audit)` → `BulkImportResult`
  - SERIALIZABLE isolation per batch of 50
  - Enforces student_limit cumulatively
  - Partial failure reporting per row
  - Stops when limit reached; reports `STUDENT_LIMIT_EXCEEDED` in errors

### `packages/domain-core/src/students/students.bulk-import.ts`

Helper that processes rows in chunks of 50, calling `createStudent` logic inline with:

- Per-row validation
- Transactional batch insert
- Error collection (row index + email + reason)
- Returns `BulkImportResult`

### `packages/domain-core/src/students/index.ts`

Re-exports all public service functions and types.

---

## Validation Schemas

**File:** `packages/validation/src/student.schema.ts`

Using Zod:

- `createStudentSchema` — all create fields, email format, password min 8 chars
- `updateStudentSchema` — all update fields optional, at least one required
- `studentListQuerySchema` — page/limit/status/subscription_status/division_id
- `bulkImportRowSchema` — single row validation
- `bulkImportSchema` — array of rows (max 500)
- `updateSubscriptionStatusSchema` — subscription_status enum

---

## API Routes

### Route file structure

```
apps/api/src/routes/backoffice/students/
├── index.ts                      ← router assembly
├── create-student.ts
├── list-students.ts
├── get-student.ts
├── update-student.ts
├── disable-student.ts
├── enable-student.ts
├── delete-student.ts
├── update-subscription-status.ts
├── bulk-import-students.ts
└── __tests__/
    └── students.test.ts
```

### Endpoint Contracts

All routes protected by: `tenantResolver` → `licenseMiddleware` → `validateJwtMiddleware` (backoffice scope) → RBAC guard (students:manage permission)

**POST /backoffice/students**

- Body: `createStudentSchema`
- 201: `{ success: true, data: StudentRecord, error: null }`
- 409: STUDENT_EMAIL_CONFLICT
- 422: STUDENT_LIMIT_EXCEEDED | STUDENT_DIVISION_INACTIVE | STUDENT_DEPARTMENT_MISMATCH

**GET /backoffice/students**

- Query: `studentListQuerySchema`
- 200: `{ success: true, data: StudentListResult, error: null }`

**GET /backoffice/students/:id**

- 200: `{ success: true, data: StudentRecord, error: null }`
- 404: STUDENT_NOT_FOUND

**PATCH /backoffice/students/:id**

- Body: `updateStudentSchema`
- 200: `{ success: true, data: StudentRecord, error: null }`
- 404: STUDENT_NOT_FOUND
- 409: STUDENT_EMAIL_CONFLICT (if email changed)

**PATCH /backoffice/students/:id/disable**

- 200: `{ success: true, data: StudentRecord, error: null }`
- 404: STUDENT_NOT_FOUND
- 409: STUDENT_ALREADY_DISABLED

**PATCH /backoffice/students/:id/enable**

- 200: `{ success: true, data: StudentRecord, error: null }`
- 404: STUDENT_NOT_FOUND
- 409: STUDENT_ALREADY_ACTIVE

**DELETE /backoffice/students/:id**

- 200: `{ success: true, data: { deleted: true }, error: null }`
- 404: STUDENT_NOT_FOUND
- 409: STUDENT_HAS_ATTEMPTS

**PATCH /backoffice/students/:id/subscription**

- Body: `updateSubscriptionStatusSchema`
- 200: `{ success: true, data: StudentRecord, error: null }`
- 404: STUDENT_NOT_FOUND

**POST /backoffice/students/bulk-import**

- Body: `bulkImportSchema` (JSON array, max 500 rows)
- 200: `{ success: true, data: BulkImportResult, error: null }`
- 422: STUDENT_LIMIT_EXCEEDED (if workspace already at limit before any inserts)

---

## Frontoffice Auth Update

**File:** `apps/api/src/routes/auth/frontoffice-login.ts`

Change the SQL query from:

```sql
SELECT id, email, password_hash, token_version, locked_until, role
FROM users
WHERE email = $1 AND role = 'student'
FOR UPDATE
```

To:

```sql
SELECT id, email, password_hash, token_version, locked_until, 'student' AS role
FROM students
WHERE email = $1 AND status = 'ACTIVE'
FOR UPDATE
```

Also add:

- After successful password verify, check `status = 'ACTIVE'` (already enforced in query)
- `subscription_status` included in JWT payload for runtime middleware to enforce access tier
  (add `subscription_status` to the SELECT and include in token data)
- No change to account lock logic (already handles `failed_login_count` on the users table — but
  since `students` table now has `failed_login_count` and `locked_until`, all account-lock
  UPDATE SQL must also be updated to target `students` table)

Specifically, update all SQL `UPDATE users` statements in `frontoffice-login.ts` to target
the `students` table.

---

## App Registration

**File:** `apps/api/src/app.ts`

Add import:

```typescript
import { studentsRouter } from "./routes/backoffice/students/index";
```

Register under the existing backoffice route mount (after `staffRouter`):

```typescript
app.route("/backoffice/students", studentsRouter);
```

---

## Error Response Format

All errors must follow the standard contract:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "STUDENT_EMAIL_CONFLICT",
    "message": "Email already registered in this workspace"
  }
}
```

Error code → HTTP status mapping:
| Code | HTTP |
|------|------|
| STUDENT_NOT_FOUND | 404 |
| STUDENT_EMAIL_CONFLICT | 409 |
| STUDENT_LIMIT_EXCEEDED | 422 |
| STUDENT_DIVISION_REQUIRED | 422 |
| STUDENT_DIVISION_INACTIVE | 422 |
| STUDENT_DEPARTMENT_MISMATCH | 422 |
| STUDENT_HAS_ATTEMPTS | 409 |
| STUDENT_ALREADY_DISABLED | 409 |
| STUDENT_ALREADY_ACTIVE | 409 |

---

## Structured Logging Requirements

All student operations must emit structured logs via `createLogger('students')` with:

- `correlation_id` — from Hono context
- `workspace_id` — tenant scope
- `student_id` — (where applicable)
- `performed_by` — staff_id from JWT
- `action` — e.g. `student_created`, `student_disabled`, `bulk_import_completed`
- `duration_ms` — elapsed time for write operations

---

## Security Requirements

- Password hashed using Argon2id via existing `hashStaffPassword` / `verifyStaffPassword` util
- Email uniqueness enforced per-tenant via DB unique index
- No global students table; no cross-tenant query
- No cross-tenant division override via request body
- bulk-import enforces same student_limit as individual create
- `password_hash` never included in any API response
- `token_version` incremented on disable to invalidate existing JWTs

---

## Testing Requirements

### Unit Tests

**File:** `packages/domain-core/src/students/__tests__/students.service.test.ts`

- createStudent: email conflict, limit enforced, division inactive, success
- bulkImportStudents: partial failure, limit stop, success
- disableStudent: already disabled, success
- deleteStudent: has attempts blocked, no attempts → soft-delete

### Integration Tests

**File:** `apps/api/src/routes/backoffice/students/__tests__/students.test.ts`

- POST /backoffice/students: 201 success, 409 conflict, 422 limit
- GET /backoffice/students: paginated list
- PATCH /backoffice/students/:id: update fields
- PATCH /backoffice/students/:id/disable: 200, 409
- DELETE /backoffice/students/:id: 409 if attempts, 200 success
- POST /backoffice/students/bulk-import: partial success

### Frontoffice Auth Test

Verify `frontoffice-login.ts` queries `students` table and:

- Returns 401 for unknown email
- Returns 401 for DISABLED student
- Returns 200 for ACTIVE student with correct password

---

## Acceptance Criteria

- [ ] Migration runs cleanly on empty and existing tenant DB
- [ ] Student CRUD works via API
- [ ] `student_limit` enforced transactionally (SERIALIZABLE)
- [ ] Division validation enforced (active, department/group belong to division)
- [ ] `subscription_status` stored and returned
- [ ] DISABLED status blocks frontoffice login
- [ ] Cross-tenant access impossible
- [ ] Attempts preserved after disable (no data loss)
- [ ] Bulk import respects student_limit and reports per-row errors
- [ ] Audit logs generated for all mutating operations
- [ ] `password_hash` never returned in any response
- [ ] All tests pass (unit + integration)
- [ ] TypeScript clean (no errors)
- [ ] Biome lint clean

---

## Clarifications

### Session 2026-04-03

**Q1: Should frontoffice-login be fully migrated to query `students` table or maintain
backward-compatibility with `users` table?**

Decision: Fully migrate to `students` table. The `users` table is a legacy artifact from the
bootstrap migration (004). Stage 42 makes `students` the authoritative table for student
identity. The `users` table is no longer used for student auth after this migration.

**Q2: Should bulk import use a single large transaction or per-row transactions?**

Decision: Per-batch transactions (batches of 50). Each batch is SERIALIZABLE. If one row fails
validation, only that row is skipped; the rest of the batch commits. The `BulkImportResult`
error array captures per-row failures. This prevents a single invalid email from blocking all
500 rows.

**Q3: Should the `students` table be renamed to something other than `students` to avoid
confusion with the old `users` table?**

Decision: Keep `students` table name. The division/department/groups migrations (22-27) already
established `students` as the canonical name.

**Q4: Password for existing students (before Stage 42)?**

Decision: Existing rows get `password_hash = ''` (empty string default). They cannot log in
until a backoffice operator sets their password. This is intentional — there is no legacy
password data to migrate.

**Q5: Should `division_id` validation happen in the DB or in the service layer?**

Decision: Service layer. The DB FK enforces referential integrity (division must exist), but
the business rule (division must be ACTIVE) is enforced by the service before INSERT. This
matches the staff management pattern from Stage 41.
