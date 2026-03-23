# STAGE_24_GROUPS — Technical Implementation Plan

**Stage:** STAGE_24_GROUPS  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Date:** 2026-03-19  
**Branch:** `spec/024-groups`  
**Depends on:** STAGE_22_DIVISIONS, STAGE_23_DEPARTMENTS  
**Status:** READY FOR IMPLEMENTATION

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technical Architecture Decisions](#2-technical-architecture-decisions)
3. [File Change Manifest](#3-file-change-manifest)
4. [Data Model & Migration Plan](#4-data-model--migration-plan)
5. [API Blueprint](#5-api-blueprint)
6. [Service Layer Design](#6-service-layer-design)
7. [Error Handling](#7-error-handling)
8. [Test Strategy](#8-test-strategy)
9. [Dependency Order for Implementation](#9-dependency-order-for-implementation)

---

## 1. Architecture Overview

Groups is a horizontal segmentation layer that sits below Department in the academic hierarchy but
does NOT participate in the Division → Department organizational tree. It is a flat, flexible
container for students and staff that enables targeted content delivery, exam scoping, and
advertisement targeting.

```
┌─────────────────────────────────────────────────────────────┐
│                      Tenant Database                        │
│                                                             │
│  divisions ──FK RESTRICT──► departments ──FK RESTRICT──►   │
│                                                   groups    │
│                                                     │       │
│                              ┌────────────────────┐│       │
│                              │                    ││       │
│                         students             staff_groups   │
│                        .group_id (nullable FK)              │
└─────────────────────────────────────────────────────────────┘

Request path:
  HTTP → tenantResolver → licenseMiddleware → JWT auth → RBAC check
       → Hono route handler
       → domain service (injected DbClient)
       → tenant DB (pool from resolver context)
```

**Trust chain compliance:** Tenant resolver → License → Auth → RBAC → Business logic.  
No shortcutting the chain is permitted at any route handler.

---

## 2. Technical Architecture Decisions

### AD-01: Domain Package Location

Groups domain logic lives in `packages/domain-core/src/groups/` — identical structure to
`packages/domain-core/src/departments/`. Exported at `@zidney/domain-core/groups` via a new
subpath export in `packages/domain-core/package.json`.

**Rationale:** Consistent with established STAGE_23 pattern; keeps business logic out of route
handlers; enforces layer separation (routes → domain ← no reverse).

### AD-02: Soft Delete Strategy

Groups are soft-deleted by setting `deleted_at = NOW()`. Hard delete is NOT permitted.  
All list/get queries MUST include `AND deleted_at IS NULL`.  
The unique index on `LOWER(name)` is a partial index: `WHERE deleted_at IS NULL` — this allows
soft-deleted group names to be reused by new groups if needed.

### AD-03: max_members Enforcement via SELECT FOR UPDATE

Student assignment must use READ COMMITTED + `SELECT FOR UPDATE` on the `groups` row.  
The count query MUST exclude the student being assigned to support idempotent full-capacity
re-assignments:

```sql
SELECT COUNT(*) FROM students WHERE group_id = $group_id AND id != $student_id
```

### AD-04: Staff Assignment Idempotency

`INSERT INTO staff_groups ... ON CONFLICT DO NOTHING` — composite PK `(staff_id, group_id)` makes
this atomic and idempotent. Service returns success on duplicate without error (FR-020).

### AD-05: Exam / Ads Deletion Guard Safe-Pass via SAVEPOINT

Deletion guard queries `exam_group_targets` and `ads_group_targets` tables. Because these tables
do not exist in this stage (created by downstream targeting stages), the guard must use a
**SAVEPOINT per guard query** to handle `42P01 (undefined_table)` without aborting the open
transaction. Without SAVEPOINTs, any `42P01` error inside a `BEGIN…COMMIT` block aborts the
entire PostgreSQL transaction, making all subsequent statements fail with "current transaction is
aborted."

**Canonical pattern:**

```sql
SAVEPOINT sp_exam_guard;
-- try: SELECT COUNT(*) FROM exam_group_targets WHERE group_id = $id AND active = true
-- ON 42P01: ROLLBACK TO SAVEPOINT sp_exam_guard; examCount = 0;
RELEASE SAVEPOINT sp_exam_guard;  -- only if no error

SAVEPOINT sp_ads_guard;
-- try: SELECT COUNT(*) FROM ads_group_targets WHERE group_id = $id AND active = true
-- ON 42P01: ROLLBACK TO SAVEPOINT sp_ads_guard; adsCount = 0;
RELEASE SAVEPOINT sp_ads_guard;   -- only if no error
```

In TypeScript the surrounding deletion helper:

1. Creates the SAVEPOINT before the risky query.
2. Catches `42P01` from `pg`, issues `ROLLBACK TO SAVEPOINT`, sets count = 0.
3. If no error: issues `RELEASE SAVEPOINT`.
4. All steps occur on the same `client` inside the open transaction — no second connection needed.

This keeps the deletion guard **fully transactional** (atomic with the soft-delete UPDATE) while
remaining forward-compatible with downstream targeting stages.

### AD-06: Division Mismatch Check

Division check executes at assignment time in the service layer as a read-only pre-check:

1. If `group.department_id IS NULL` → skip (global group).
2. Fetch `departments.division_id` where `departments.id = group.department_id`.
3. If `department.division_id IS NULL` → skip (cross-division department).
4. For students: reject if `students.division_id != department.division_id`.
5. For staff: reject if `backoffice_staff_users.division_id IS NOT NULL` AND ≠ `department.division_id`.  
   Staff with `division_id = NULL` are workspace-global → skip check.

### AD-07: Student Single-Group Constraint

Enforced by using `UPDATE students SET group_id = $new_gid WHERE id = $student_id`.  
This is an UPDATE, not INSERT. A student can only hold one `group_id` value at a time.  
Old assignment is automatically replaced. No separate "remove old" step required.

### AD-08: Transaction Boundaries

All mutating operations run inside `BEGIN … COMMIT / ROLLBACK` blocks.  
Delete guard checks run inside the same transaction as the soft-delete UPDATE.  
The `exam_group_targets` and `ads_group_targets` guard queries use `SAVEPOINT` per AD-05 to
handle `42P01` without aborting the open transaction.  
Student assignment lock + count check + UPDATE run inside the same transaction.

### AD-09: Validation Schema Location

Zod validation schemas at `packages/validation/src/backoffice/groups.schemas.ts`. Imported by
route handlers at `@zidney/validation/backoffice/groups.schemas`.

### AD-10: Router Registration

Groups router mounts at `/groups` inside the backoffice router. Student and staff sub-routes
(`/students/:studentId/group`, `/staff/:staffId/groups`) are registered on the groups router,
consistent with how `staff_departments` sub-routes live inside the departments router.

---

## 3. File Change Manifest

### 3.1 New Files — Database Layer

| File                                                       | Type   | Description                                                                      |
| ---------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| `apps/api/src/db/tenant/schemas/groups.schema.ts`          | CREATE | Drizzle schema for `groups` table                                                |
| `apps/api/src/db/tenant/schemas/staff-groups.schema.ts`    | CREATE | Drizzle schema for `staff_groups` join table                                     |
| `apps/api/src/db/tenant/migrations/20260319_001_groups.ts` | CREATE | Forward migration: groups + staff_groups + students.group_id; bump 1.6.0 → 1.7.0 |

### 3.2 Modified Files — Database Layer

| File                                                | Type   | Change                                                 |
| --------------------------------------------------- | ------ | ------------------------------------------------------ |
| `apps/api/src/db/tenant/schemas/students.schema.ts` | MODIFY | Add `group_id` nullable FK column + `groupIdIdx` index |
| `apps/api/src/db/tenant/schemas/index.ts`           | MODIFY | Export `groups.schema` and `staff-groups.schema`       |

### 3.3 New Files — Domain Package

| File                                                   | Type   | Description                                                                                  |
| ------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------- |
| `packages/domain-core/src/groups/groups.types.ts`      | CREATE | TypeScript types and interfaces (DbClient, AuditContext, GroupRow, etc.)                     |
| `packages/domain-core/src/groups/groups.errors.ts`     | CREATE | GroupsError class, error codes, HTTP status mapping                                          |
| `packages/domain-core/src/groups/groups.repository.ts` | CREATE | Pure DB query functions: list, getById, create, update, softDelete, counts, SAVEPOINT guards |
| `packages/domain-core/src/groups/groups.service.ts`    | CREATE | 9 domain service orchestration functions (calls repository)                                  |
| `packages/domain-core/src/groups/index.ts`             | CREATE | Public barrel — re-exports all public symbols                                                |

### 3.4 Modified Files — Domain Package

| File                                | Type   | Change                                               |
| ----------------------------------- | ------ | ---------------------------------------------------- |
| `packages/domain-core/package.json` | MODIFY | Add `"./groups": "./src/groups/index.ts"` to exports |
| `packages/domain-core/src/index.ts` | MODIFY | Add `export * from './groups'`                       |

### 3.5 New Files — Validation Package

| File                                                   | Type   | Description                                                                  |
| ------------------------------------------------------ | ------ | ---------------------------------------------------------------------------- |
| `packages/validation/src/backoffice/groups.schemas.ts` | CREATE | Zod schemas for create, update, assign-student, assign-staff body validation |

### 3.6 New Files — API Routes

| File                                                            | Type   | Description                                                       |
| --------------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| `apps/api/src/routes/backoffice/groups/helpers.ts`              | CREATE | `getDb`, `buildAuditCtx`, `groupErrorResponse`, `successResponse` |
| `apps/api/src/routes/backoffice/groups/index.ts`                | CREATE | Router factory `createGroupsRouter()` + re-exports                |
| `apps/api/src/routes/backoffice/groups/list-groups.ts`          | CREATE | `GET /groups` handler                                             |
| `apps/api/src/routes/backoffice/groups/create-group.ts`         | CREATE | `POST /groups` handler                                            |
| `apps/api/src/routes/backoffice/groups/get-group.ts`            | CREATE | `GET /groups/:id` handler                                         |
| `apps/api/src/routes/backoffice/groups/update-group.ts`         | CREATE | `PUT /groups/:id` handler                                         |
| `apps/api/src/routes/backoffice/groups/delete-group.ts`         | CREATE | `DELETE /groups/:id` handler                                      |
| `apps/api/src/routes/backoffice/groups/assign-student-group.ts` | CREATE | `PUT /students/:studentId/group` handler                          |
| `apps/api/src/routes/backoffice/groups/remove-student-group.ts` | CREATE | `DELETE /students/:studentId/group` handler                       |
| `apps/api/src/routes/backoffice/groups/get-student-group.ts`    | CREATE | `GET /students/:studentId/group` handler                          |
| `apps/api/src/routes/backoffice/groups/assign-staff-group.ts`   | CREATE | `POST /staff/:staffId/groups` handler                             |
| `apps/api/src/routes/backoffice/groups/remove-staff-group.ts`   | CREATE | `DELETE /staff/:staffId/groups/:groupId` handler                  |
| `apps/api/src/routes/backoffice/groups/get-staff-groups.ts`     | CREATE | `GET /staff/:staffId/groups` handler                              |

### 3.7 Modified Files — API Router

| File                                                     | Type   | Change                           |
| -------------------------------------------------------- | ------ | -------------------------------- |
| `apps/api/src/routes/backoffice/` _(parent router file)_ | MODIFY | Mount groups router at `/groups` |

### 3.8 New Files — Tests

| File                                                                    | Type   | Description                                |
| ----------------------------------------------------------------------- | ------ | ------------------------------------------ |
| `packages/domain-core/src/groups/__tests__/groups.service.test.ts`      | CREATE | Unit tests for all service functions       |
| `apps/api/src/routes/backoffice/groups/__tests__/groups.routes.test.ts` | CREATE | Integration tests for all 11 API endpoints |

---

## 4. Data Model & Migration Plan

### 4.1 groups Table

```sql
CREATE TABLE IF NOT EXISTS groups (
  id            UUID          NOT NULL DEFAULT gen_random_uuid(),
  name          VARCHAR(255)  NOT NULL,
  department_id UUID,
  max_members   INTEGER
                  CONSTRAINT groups_max_members_check
                    CHECK (max_members IS NULL OR max_members > 0),
  description   TEXT,
  status        VARCHAR(20)   NOT NULL DEFAULT 'ENABLED'
                  CONSTRAINT groups_status_check
                    CHECK (status IN ('ENABLED', 'DISABLED')),
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT groups_pkey
    PRIMARY KEY (id),
  CONSTRAINT groups_department_id_fkey
    FOREIGN KEY (department_id)
      REFERENCES departments(id) ON DELETE RESTRICT
);

-- Partial functional unique index: workspace-scoped, case-insensitive, active-only
CREATE UNIQUE INDEX IF NOT EXISTS groups_name_lower_unique
  ON groups (LOWER(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_groups_department_id ON groups (department_id);
CREATE INDEX IF NOT EXISTS idx_groups_status ON groups (status);
CREATE INDEX IF NOT EXISTS idx_groups_deleted_at ON groups (deleted_at);
CREATE INDEX IF NOT EXISTS idx_groups_created_at_id ON groups (created_at ASC, id ASC);
```

### 4.2 staff_groups Table

```sql
CREATE TABLE IF NOT EXISTS staff_groups (
  staff_id    UUID        NOT NULL,
  group_id    UUID        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT staff_groups_pkey
    PRIMARY KEY (staff_id, group_id),
  CONSTRAINT staff_groups_staff_id_fkey
    FOREIGN KEY (staff_id)
      REFERENCES backoffice_staff_users(id) ON DELETE CASCADE,
  CONSTRAINT staff_groups_group_id_fkey
    FOREIGN KEY (group_id)
      REFERENCES groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_staff_groups_group_id ON staff_groups (group_id);
```

### 4.3 students Table — ALTER

```sql
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS group_id UUID;

ALTER TABLE students
  ADD CONSTRAINT IF NOT EXISTS students_group_id_fkey
    FOREIGN KEY (group_id)
      REFERENCES groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_group_id ON students (group_id);
```

### 4.4 schema_version Bump

```sql
UPDATE schema_version
  SET version    = '1.7.0',
      applied_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
```

### 4.5 Migration Transaction Order

All 6 steps execute in a single `BEGIN … COMMIT` block:

1. `CREATE TABLE groups` + constraints → functional unique index → 4 plain indexes
2. `CREATE TABLE staff_groups` + constraints → 1 index
3. `ALTER TABLE students ADD COLUMN IF NOT EXISTS group_id`
4. `ALTER TABLE students ADD CONSTRAINT IF NOT EXISTS students_group_id_fkey`
5. `CREATE INDEX IF NOT EXISTS idx_students_group_id`
6. `UPDATE schema_version SET version = '1.7.0'`

**Failure in any step → ROLLBACK (entire migration is atomic).**

---

## 5. API Blueprint

All endpoints share the middleware chain:
`correlationId → tenantResolver → licenseEnforcement → schemaVersion → rateLimit → JWT auth → RBAC`

### 5.1 Group CRUD

#### `GET /api/v1/backoffice/workspace/groups`

**Permission:** `can_view` on Groups module  
**Query params:** `limit` (default 20, max 100), `cursor` (UUID), `status` (`ENABLED|DISABLED|all`), `department_id` (UUID)  
**Behavior:**

- Excludes soft-deleted records (`deleted_at IS NULL`)
- Keyset pagination ordered by `(created_at ASC, id ASC)`
- `cursor` = last `id` from previous page; WHERE clause: `(created_at, id) > (cursor_created_at, cursor_id)`
- Returns `{ items, nextCursor, total }` — `total` uses a separate COUNT query with same filters (no cursor)

**Response shape:**

```json
{ "success": true, "data": { "items": [...], "nextCursor": "uuid|null", "total": 5 }, "error": null }
```

---

#### `POST /api/v1/backoffice/workspace/groups`

**Permission:** `can_create` on Groups module  
**Body:** `{ name, department_id?, max_members?, description? }`  
**Validation:**

- `name`: required, 1–255 chars, no leading/trailing whitespace after trim, no control characters
- `department_id`: valid UUID when provided; must resolve to a non-deleted department in tenant DB
- `max_members`: positive integer (≥ 1) or null/absent
- `description`: optional text

**Transaction:**

1. Validate `department_id` existence (if provided)
2. Check `LOWER(name)` uniqueness among non-deleted groups
3. INSERT into `groups`
4. COMMIT

**Response:** 201 with created group object.  
**Errors:** 409 `GROUP_NAME_DUPLICATE`, 422 `VALIDATION_ERROR`

---

#### `GET /api/v1/backoffice/workspace/groups/:id`

**Permission:** `can_view` on Groups module  
**Behavior:** SELECT WHERE id = :id AND deleted_at IS NULL  
**Response:** 200 with group object, or 404 `GROUP_NOT_FOUND`

---

#### `PUT /api/v1/backoffice/workspace/groups/:id`

**Permission:** `can_edit` on Groups module  
**Body:** all fields optional — `name?`, `department_id?`, `max_members?`, `description?`, `status?`  
**Behavior:**

- Only fields present in body are updated (partial update)
- If `name` changes: check uniqueness
- If `department_id` changes: validate existence
- `max_members` reduction below enrolled count: silently allowed (forward enforcement only)
- Status `DISABLED`: does NOT cascade-remove assignments
- Timestamps: `updated_at = NOW()`

**Transaction:**

1. SELECT group for existence check
2. Conditionally check name uniqueness / department existence
3. UPDATE groups SET ... WHERE id = :id AND deleted_at IS NULL
4. COMMIT

**Response:** 200 with updated group object.  
**Errors:** 404 `GROUP_NOT_FOUND`, 409 `GROUP_NAME_DUPLICATE`, 422 `VALIDATION_ERROR`

---

#### `DELETE /api/v1/backoffice/workspace/groups/:id`

**Permission:** `can_delete` on Groups module  
**Behavior:** Soft delete — sets `deleted_at = NOW()`.

**Transaction:**

1. SELECT id WHERE id = :id AND deleted_at IS NULL FOR UPDATE (lock + existence check)
2. COUNT students WHERE group_id = :id
3. COUNT staff_groups WHERE group_id = :id
4. SAVEPOINT sp_exam_guard; COUNT exam_group_targets WHERE group_id = :id; ON 42P01: ROLLBACK TO sp_exam_guard, examCount = 0 (see AD-05)
5. SAVEPOINT sp_ads_guard; COUNT ads_group_targets WHERE group_id = :id; ON 42P01: ROLLBACK TO sp_ads_guard, adsCount = 0 (see AD-05)
6. If any count > 0: ROLLBACK + appropriate error
7. UPDATE groups SET deleted_at = NOW() WHERE id = :id
8. COMMIT

**Response:** 200 `{ "success": true, "data": { "deleted": true }, "error": null }`  
**Errors:** 404 `GROUP_NOT_FOUND`, 422 `GROUP_HAS_ASSIGNMENTS`, 422 `GROUP_REFERENCED_BY_EXAM`, 422 `GROUP_REFERENCED_BY_ADS`

---

### 5.2 Student Group Assignment

#### `PUT /api/v1/backoffice/workspace/students/:studentId/group`

**Permission:** `can_edit` on Students module  
**Body:** `{ group_id: "uuid" }`

**Transaction sequence (READ COMMITTED + SELECT FOR UPDATE):**

```sql
BEGIN;

-- 1. Verify student exists
SELECT id, division_id FROM students WHERE id = $student_id;
-- → 404 STUDENT_NOT_FOUND if no row

-- 2. Lock and fetch group
SELECT id, status, max_members, department_id
  FROM groups
  WHERE id = $group_id AND deleted_at IS NULL
  FOR UPDATE;
-- → 404 GROUP_NOT_FOUND if no row
-- → 422 GROUP_DISABLED if status = 'DISABLED'

-- 3. Division mismatch check (if group has department_id)
-- (read-only lookup — no additional lock required)
SELECT d.division_id
  FROM departments d
  WHERE d.id = $group.department_id;
-- → compare with students.division_id
-- → 422 GROUP_DIVISION_MISMATCH if mismatch

-- 4. Count current members (exclude student being assigned — idempotent re-assign fix)
SELECT COUNT(*) FROM students
  WHERE group_id = $group_id AND id != $student_id;
-- → 422 GROUP_MAX_MEMBERS_EXCEEDED if count >= max_members (and max_members IS NOT NULL)

-- 5. Update student's group
UPDATE students
  SET group_id = $group_id, updated_at = NOW()
  WHERE id = $student_id;

COMMIT;
```

**Response:** 200 `{ "success": true, "data": { "student_id": "uuid", "group_id": "uuid" }, "error": null }`  
**Errors:** 404 `STUDENT_NOT_FOUND`, 404 `GROUP_NOT_FOUND`, 422 `GROUP_DISABLED`, 422 `GROUP_MAX_MEMBERS_EXCEEDED`, 422 `GROUP_DIVISION_MISMATCH`

---

#### `DELETE /api/v1/backoffice/workspace/students/:studentId/group`

**Permission:** `can_edit` on Students module

**Transaction:**

1. SELECT student WHERE id = :studentId → 404 `STUDENT_NOT_FOUND` if absent
2. Check student.group_id IS NOT NULL → 404 `GROUP_STUDENT_ASSIGNMENT_NOT_FOUND` if null
3. UPDATE students SET group_id = NULL, updated_at = NOW() WHERE id = :studentId
4. COMMIT

**Response:** 200 `{ "success": true, "data": { "student_id": "uuid", "group_id": null }, "error": null }`  
**Errors:** 404 `STUDENT_NOT_FOUND`, 404 `GROUP_STUDENT_ASSIGNMENT_NOT_FOUND`

---

#### `GET /api/v1/backoffice/workspace/students/:studentId/group`

**Permission:** `can_view` on Students module or Groups module  
**Behavior:** SELECT group joined via student.group_id  
**Response:** 200 with single group object or `data: null` if student has no group  
**Errors:** 404 `STUDENT_NOT_FOUND`

---

### 5.3 Staff Group Assignment

#### `POST /api/v1/backoffice/workspace/staff/:staffId/groups`

**Permission:** `can_edit` on Groups module  
**Body:** `{ group_id: "uuid" }`

**Transaction:**

1. Verify staff exists: SELECT id, division_id FROM backoffice_staff_users WHERE id = :staffId → 404 `STAFF_NOT_FOUND`
2. Lock group: SELECT id, status, department_id FROM groups WHERE id = :groupId AND deleted_at IS NULL FOR UPDATE → 404 `GROUP_NOT_FOUND` / 422 `GROUP_DISABLED`
3. Division mismatch check (read-only, same logic as student assignment)
4. Idempotent upsert: `INSERT INTO staff_groups (staff_id, group_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`
5. COMMIT
6. Return updated list of staff's groups

**Response:** 200 with list of all groups assigned to staff member  
**Errors:** 404 `STAFF_NOT_FOUND`, 404 `GROUP_NOT_FOUND`, 422 `GROUP_DISABLED`, 422 `GROUP_DIVISION_MISMATCH`

---

#### `DELETE /api/v1/backoffice/workspace/staff/:staffId/groups/:groupId`

**Permission:** `can_edit` on Groups module

**Transaction:**

1. Verify staff exists → 404 `STAFF_NOT_FOUND`
2. Verify group exists (including soft-deleted check) → 404 `GROUP_NOT_FOUND`
3. DELETE FROM staff_groups WHERE staff_id = :staffId AND group_id = :groupId
4. Check rowCount: if 0 → 404 `GROUP_STAFF_ASSIGNMENT_NOT_FOUND`
5. COMMIT
6. Return updated list of staff's remaining groups

**Response:** 200 with list of remaining groups  
**Errors:** 404 `STAFF_NOT_FOUND`, 404 `GROUP_NOT_FOUND`, 404 `GROUP_STAFF_ASSIGNMENT_NOT_FOUND`

---

#### `GET /api/v1/backoffice/workspace/staff/:staffId/groups`

**Permission:** `can_view` on Groups module  
**Behavior:** SELECT groups via staff_groups JOIN groups WHERE staff_id = :staffId AND g.deleted_at IS NULL

**Response schema:**

```json
{
  "success": true,
  "data": {
    "groups": [{ "id": "uuid", "name": "Alpha cohort", "status": "ENABLED" }]
  },
  "error": null
}
```

**Errors:** 404 `STAFF_NOT_FOUND`

---

## 6. Service Layer Design

### 6.1 Service Functions

All service functions in `packages/domain-core/src/groups/groups.service.ts` accept an injected
`DbClient` and `AuditContext`. No direct Pool instantiation. No HTTP logic.

| Function                 | Signature                                                              | Notes                               |
| ------------------------ | ---------------------------------------------------------------------- | ----------------------------------- |
| `listGroups`             | `(db, input: ListGroupsInput) → ListGroupsResult`                      | Keyset pagination                   |
| `createGroup`            | `(db, input: CreateGroupInput, audit) → GroupRow`                      | Uniqueness check + INSERT           |
| `getGroupById`           | `(db, id: string) → GroupRow \| null`                                  | Returns null if not found / deleted |
| `updateGroup`            | `(db, id: string, input: UpdateGroupInput, audit) → GroupRow`          | Partial update                      |
| `deleteGroup`            | `(db, id: string, audit) → void`                                       | Soft delete with guards             |
| `assignStudentToGroup`   | `(db, studentId: string, groupId: string, audit) → StudentGroupResult` | SELECT FOR UPDATE + count           |
| `removeStudentFromGroup` | `(db, studentId: string, audit) → StudentGroupResult`                  | SET group_id = NULL                 |
| `getStudentGroup`        | `(db, studentId: string) → GroupRow \| null`                           | Read-only                           |
| `assignStaffToGroup`     | `(db, staffId: string, groupId: string, audit) → GroupRow[]`           | Idempotent upsert                   |
| `removeStaffFromGroup`   | `(db, staffId: string, groupId: string, audit) → GroupRow[]`           | DELETE + 404 guard                  |
| `getStaffGroups`         | `(db, staffId: string) → GroupRow[]`                                   | Join query                          |

### 6.2 Types (groups.types.ts)

```typescript
export interface DbClient {
  /* structural — matches pg.Pool */
}
export interface AuditContext {
  user_id;
  correlation_id;
  workspace_slug;
  workspace_id;
}

export enum GroupStatus {
  ENABLED = "ENABLED",
  DISABLED = "DISABLED",
}

export interface GroupRow {
  id: string;
  name: string;
  department_id: string | null;
  max_members: number | null;
  description: string | null;
  status: "ENABLED" | "DISABLED";
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ListGroupsInput {
  limit: number;
  cursor?: string;
  status?: "ENABLED" | "DISABLED" | "all";
  department_id?: string;
}

export interface ListGroupsResult {
  items: GroupRow[];
  nextCursor: string | null;
  total: number;
}

export interface CreateGroupInput {
  name: string;
  department_id?: string;
  max_members?: number;
  description?: string;
}

export interface UpdateGroupInput {
  name?: string;
  department_id?: string | null;
  max_members?: number | null;
  description?: string | null;
  status?: "ENABLED" | "DISABLED";
}

export interface StudentGroupResult {
  student_id: string;
  group_id: string | null;
}

export interface StaffGroupRow {
  staff_id: string;
  group_id: string;
  created_at: Date;
}
```

### 6.3 Shared Helpers Pattern

Route `helpers.ts` exposes:

- `getDb(c: Context): DbClient` — extracts `tenant.pool` from Hono context
- `buildAuditCtx(c: Context): AuditContext` — extracts `correlation_id`, `workspace_id`, `workspace_slug`, `staff_user.user_id`
- `groupErrorResponse(c, err)` — maps `GroupsError` → HTTP response using `GROUPS_ERROR_HTTP_STATUS`
- `successResponse(data)` — returns `{ success: true, data, error: null }`

### 6.4 Logging Requirements

Every mutating operation must log via `@zidney/logger` with:

```typescript
logger.info("Group created", {
  correlation_id,
  workspace_slug,
  workspace_id,
  user_id,
  event: "GROUP_CREATED",
  group_id: group.id,
  name: group.name,
});
```

**Event names:** `GROUP_CREATED`, `GROUP_UPDATED`, `GROUP_DELETED`, `GROUP_STUDENT_ASSIGNED`,
`GROUP_STUDENT_REMOVED`, `GROUP_STAFF_ASSIGNED`, `GROUP_STAFF_REMOVED`

Validation rejections: log at `WARN` with error code.  
DB transaction failures: log at `ERROR` with full error context (no PII).  
`console.log` is strictly forbidden.

---

## 7. Error Handling

### 7.1 Error Codes (groups.errors.ts)

```typescript
export type GroupsErrorCode =
  | "GROUP_NOT_FOUND" // 404
  | "STUDENT_NOT_FOUND" // 404
  | "STAFF_NOT_FOUND" // 404
  | "GROUP_STUDENT_ASSIGNMENT_NOT_FOUND" // 404
  | "GROUP_STAFF_ASSIGNMENT_NOT_FOUND" // 404
  | "GROUP_NAME_DUPLICATE" // 409
  | "GROUP_DIVISION_MISMATCH" // 422
  | "GROUP_HAS_ASSIGNMENTS" // 422
  | "GROUP_REFERENCED_BY_EXAM" // 422
  | "GROUP_REFERENCED_BY_ADS" // 422
  | "GROUP_MAX_MEMBERS_EXCEEDED" // 422
  | "GROUP_DISABLED" // 422
  | "VALIDATION_ERROR"; // 422
```

### 7.2 HTTP Status Mapping

| Code                                 | HTTP |
| ------------------------------------ | ---- |
| `GROUP_NOT_FOUND`                    | 404  |
| `STUDENT_NOT_FOUND`                  | 404  |
| `STAFF_NOT_FOUND`                    | 404  |
| `GROUP_STUDENT_ASSIGNMENT_NOT_FOUND` | 404  |
| `GROUP_STAFF_ASSIGNMENT_NOT_FOUND`   | 404  |
| `GROUP_NAME_DUPLICATE`               | 409  |
| `GROUP_DIVISION_MISMATCH`            | 422  |
| `GROUP_HAS_ASSIGNMENTS`              | 422  |
| `GROUP_REFERENCED_BY_EXAM`           | 422  |
| `GROUP_REFERENCED_BY_ADS`            | 422  |
| `GROUP_MAX_MEMBERS_EXCEEDED`         | 422  |
| `GROUP_DISABLED`                     | 422  |
| `VALIDATION_ERROR`                   | 422  |

### 7.3 Error Response Shape

All errors conform to the platform response contract:

```json
{
  "success": false,
  "data": null,
  "error": { "code": "GROUP_NOT_FOUND", "message": "Group not found." }
}
```

### 7.4 Error Class

```typescript
export class GroupsError extends Error {
  constructor(
    public code: GroupsErrorCode,
    public message: string = GROUPS_ERROR_MESSAGES[code],
    public httpStatus: number = GROUPS_ERROR_HTTP_STATUS[code],
  ) {
    super(message);
    this.name = "GroupsError";
  }
}
```

### 7.5 Route Error Handler

`groupErrorResponse` in `helpers.ts`:

```typescript
if (err instanceof GroupsError) {
  return c.json(
    { success: false, data: null, error: { code: err.code, message: err.message } },
    err.httpStatus,
  );
}
// Unexpected errors: log at ERROR, return 500
logger.error("Unexpected error in groups route", { correlation_id, error: err });
return c.json(
  {
    success: false,
    data: null,
    error: { code: "INTERNAL_ERROR", message: "Internal server error." },
  },
  500,
);
```

---

## 8. Test Strategy

### 8.1 Unit Tests

**File:** `packages/domain-core/src/groups/__tests__/groups.service.test.ts`

Test each service function with a mock `DbClient`. No real database required.

| Test                                                                | Scenario                                    |
| ------------------------------------------------------------------- | ------------------------------------------- |
| `listGroups` — no cursor, all statuses                              | Returns all non-deleted groups              |
| `listGroups` — status filter                                        | Returns only matching status                |
| `listGroups` — department_id filter                                 | Returns only matching department            |
| `listGroups` — cursor pagination                                    | Correct keyset WHERE clause                 |
| `createGroup` — success                                             | INSERT called; created group returned       |
| `createGroup` — name duplicate                                      | Throws `GROUP_NAME_DUPLICATE`               |
| `createGroup` — invalid department_id                               | Throws `VALIDATION_ERROR`                   |
| `updateGroup` — name change success                                 | UPDATE called; updated group returned       |
| `updateGroup` — name duplicate on rename                            | Throws `GROUP_NAME_DUPLICATE`               |
| `updateGroup` — reduce max_members below count                      | Silent success                              |
| `deleteGroup` — no assignments                                      | Soft delete succeeds                        |
| `deleteGroup` — has student assignments                             | Throws `GROUP_HAS_ASSIGNMENTS`              |
| `deleteGroup` — has staff assignments                               | Throws `GROUP_HAS_ASSIGNMENTS`              |
| `deleteGroup` — exam reference (table exists)                       | Throws `GROUP_REFERENCED_BY_EXAM`           |
| `deleteGroup` — exam reference (SAVEPOINT exam guard, table absent) | Soft delete succeeds                        |
| `assignStudentToGroup` — success                                    | student.group_id updated                    |
| `assignStudentToGroup` — group DISABLED                             | Throws `GROUP_DISABLED`                     |
| `assignStudentToGroup` — max_members exceeded                       | Throws `GROUP_MAX_MEMBERS_EXCEEDED`         |
| `assignStudentToGroup` — idempotent re-assign at full capacity      | Count excludes student; succeeds            |
| `assignStudentToGroup` — division mismatch                          | Throws `GROUP_DIVISION_MISMATCH`            |
| `assignStudentToGroup` — global group (dept null)                   | No division check; succeeds                 |
| `removeStudentFromGroup` — success                                  | group_id set to null                        |
| `removeStudentFromGroup` — no assignment                            | Throws `GROUP_STUDENT_ASSIGNMENT_NOT_FOUND` |
| `assignStaffToGroup` — success                                      | INSERT into staff_groups                    |
| `assignStaffToGroup` — idempotent (duplicate)                       | ON CONFLICT DO NOTHING; success             |
| `assignStaffToGroup` — group DISABLED                               | Throws `GROUP_DISABLED`                     |
| `assignStaffToGroup` — division mismatch                            | Throws `GROUP_DIVISION_MISMATCH`            |
| `assignStaffToGroup` — staff division null → global                 | Skip mismatch; success                      |
| `removeStaffFromGroup` — success                                    | DELETE from staff_groups; rowCount = 1      |
| `removeStaffFromGroup` — not assigned                               | Throws `GROUP_STAFF_ASSIGNMENT_NOT_FOUND`   |

### 8.2 Integration Tests

**File:** `apps/api/src/routes/backoffice/groups/__tests__/groups.routes.test.ts`

Full HTTP request cycle against a real test database (tenant isolation per test run).

**Setup:** Use existing test helpers at `tests/` — `db-manager.ts`, `http-client.ts`.

| Test Category                       | Scenarios                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| **CRUD — happy path**               | Create, read, list, update, delete group via HTTP; validate response shapes   |
| **Name uniqueness**                 | POST with duplicate name → 409; PUT rename to existing → 409                  |
| **Status lifecycle**                | Create → ENABLED; update to DISABLED; re-enable; confirm all transitions      |
| **Soft delete guards**              | DELETE group with student → 422; DELETE group with staff → 422                |
| **Soft delete — clean**             | DELETE group with no assignments → 200 `{ deleted: true }`                    |
| **List filters**                    | `?status=ENABLED`, `?status=DISABLED`, `?department_id=uuid`, combined        |
| **Pagination**                      | List with `limit=2`, use `cursor` for next page; confirm totals               |
| **Student assignment — happy path** | Assign, confirm group_id updated; re-fetch student                            |
| **Student re-assign**               | Assign student to group A, then group B; confirm group_id = B only            |
| **Student remove**                  | Assign, then remove; confirm group_id = null                                  |
| **Student remove — not assigned**   | DELETE with no assignment → 404 `GROUP_STUDENT_ASSIGNMENT_NOT_FOUND`          |
| **max_members enforcement**         | Fill to capacity; attempt +1 → 422 `GROUP_MAX_MEMBERS_EXCEEDED`               |
| **max_members — null**              | Assign unlimited students; no capacity rejection                              |
| **max_members race condition**      | Two concurrent PUT student-group requests for last slot; exactly one succeeds |
| **DISABLED group — student**        | Assign student → 422 `GROUP_DISABLED`                                         |
| **DISABLED group — staff**          | Assign staff → 422 `GROUP_DISABLED`                                           |
| **Disabled hidden from selection**  | `GET /groups?status=ENABLED` excludes DISABLED groups                         |
| **Staff assignment — happy path**   | Assign staff to 2 groups; GET confirms both                                   |
| **Staff assignment — idempotent**   | POST same (staff, group) twice; 200 both times; single row                    |
| **Staff remove**                    | Assign, remove; confirm not in list                                           |
| **Staff remove — not assigned**     | DELETE → 404 `GROUP_STAFF_ASSIGNMENT_NOT_FOUND`                               |
| **Division mismatch — student**     | Student in division X; group anchored to dept in division Y → 422             |
| **Division mismatch — staff**       | Staff in division X; group anchored → 422                                     |
| **Global group**                    | `department_id = null` → no division check; any student/staff assigned        |
| **Staff global (division null)**    | Staff with null division; anchored group → bypass mismatch                    |
| **Tenant isolation**                | Groups from tenant A invisible from tenant B requests                         |
| **License enforcement**             | SOFT_LOCKED → 423; ARCHIVED → 403                                             |
| **RBAC enforcement**                | No `can_create` → 403; no `can_delete` → 403                                  |
| **Audit logging**                   | Each mutation emits structured log with all required fields                   |
| **Schema version**                  | Migration bumped to 1.7.0; runtime rejects tenant under 1.7.0                 |
| **max_members reduce**              | Reduce below current count; update succeeds; old assignments intact           |

### 8.3 Concurrency Test (max_members race)

```typescript
// Setup: group with max_members = 1, 0 students assigned
// Act: two concurrent PUT /students/:id/group with different student IDs
const [res1, res2] = await Promise.all([
  httpClient.put(`/students/${student1Id}/group`, { group_id: groupId }),
  httpClient.put(`/students/${student2Id}/group`, { group_id: groupId }),
]);
// Assert: exactly one 200 and exactly one 422 GROUP_MAX_MEMBERS_EXCEEDED
const statuses = [res1.status, res2.status].sort();
expect(statuses).toEqual([200, 422]);
```

---

## 9. Dependency Order for Implementation

### Phase A — Foundation (no dependencies beyond STAGE_23)

**Step 1: Migration**  
Create `apps/api/src/db/tenant/migrations/20260319_001_groups.ts`.  
Run migration against test DB to validate DDL.

**Step 2: Drizzle Schemas**  
Create `groups.schema.ts` and `staff-groups.schema.ts`.  
Modify `students.schema.ts` to add `group_id` column + index.  
Update `schemas/index.ts` to export both new schemas.

---

### Phase B — Domain Package

**Step 3: Types**  
Create `packages/domain-core/src/groups/groups.types.ts` with all interfaces and enums.

**Step 4: Errors**  
Create `packages/domain-core/src/groups/groups.errors.ts` with `GroupsErrorCode`, HTTP status map, default messages, `GroupsError` class.

**Step 5: Service**  
Create `packages/domain-core/src/groups/groups.service.ts` with all 11 service functions.  
Each function accepts injected `DbClient`; no direct Pool import.

**Step 6: Barrel + Package Export**  
Create `packages/domain-core/src/groups/index.ts`.  
Update `packages/domain-core/package.json` exports with `"./groups"` entry.  
Update `packages/domain-core/src/index.ts` with `export * from './groups'`.

---

### Phase C — Validation Schemas

**Step 7: Zod Schemas**  
Create `packages/validation/src/backoffice/groups.schemas.ts`:

- `createGroupBodySchema` — `{ name, department_id?, max_members?, description? }`
- `updateGroupBodySchema` — all optional, partial
- `assignStudentGroupBodySchema` — `{ group_id: uuid }`
- `assignStaffGroupBodySchema` — `{ group_id: uuid }`

---

### Phase D — API Routes (depends on Phase B + C)

**Step 8: Route Helpers**  
Create `apps/api/src/routes/backoffice/groups/helpers.ts`.  
Import `GroupsError`, `GROUPS_ERROR_HTTP_STATUS` from `@zidney/domain-core/groups`.

**Step 9: Route Handlers**  
Create in this order (simpler → complex):

1. `get-group.ts`
2. `list-groups.ts`
3. `create-group.ts`
4. `update-group.ts`
5. `delete-group.ts`
6. `student-group.ts`
7. `staff-groups.ts`

**Step 10: Router Index + Mount**  
Create `apps/api/src/routes/backoffice/groups/index.ts`.  
Mount groups router in the parent backoffice router file.

---

### Phase E — Tests (depends on Phase B + D)

**Step 11: Unit Tests**  
Create `packages/domain-core/src/groups/__tests__/groups.service.test.ts`.  
Cover all service function branches (see §8.1).

**Step 12: Integration Tests**  
Create `apps/api/src/routes/backoffice/groups/__tests__/groups.routes.test.ts`.  
Cover all 11 endpoints, all error codes, concurrency scenario (see §8.2).

---

### Phase F — Validation Gate

**Step 13: Run lint, type-check, test**

```bash
bun run lint
bun run typecheck
bun run test --filter packages/domain-core
bun run test --filter apps/api
```

**Step 14: Run architecture audit**

```bash
bun scripts/infra-audit.ts
bun scripts/ai-guard.ts
```

---

## Appendix A — Complete Endpoint Summary

| Method | Path                              | Permission          | Domain Function          |
| ------ | --------------------------------- | ------------------- | ------------------------ |
| GET    | `/groups`                         | `can_view` Groups   | `listGroups`             |
| POST   | `/groups`                         | `can_create` Groups | `createGroup`            |
| GET    | `/groups/:id`                     | `can_view` Groups   | `getGroupById`           |
| PUT    | `/groups/:id`                     | `can_edit` Groups   | `updateGroup`            |
| DELETE | `/groups/:id`                     | `can_delete` Groups | `deleteGroup`            |
| PUT    | `/students/:studentId/group`      | `can_edit` Students | `assignStudentToGroup`   |
| DELETE | `/students/:studentId/group`      | `can_edit` Students | `removeStudentFromGroup` |
| GET    | `/students/:studentId/group`      | `can_view` Students | `getStudentGroup`        |
| POST   | `/staff/:staffId/groups`          | `can_edit` Groups   | `assignStaffToGroup`     |
| DELETE | `/staff/:staffId/groups/:groupId` | `can_edit` Groups   | `removeStaffFromGroup`   |
| GET    | `/staff/:staffId/groups`          | `can_view` Groups   | `getStaffGroups`         |

---

## Appendix B — Constitution Compliance Checklist

| Rule                              | Status | Notes                                           |
| --------------------------------- | ------ | ----------------------------------------------- |
| Database-per-tenant               | ✓      | All tables in tenant DB only                    |
| No cross-tenant joins             | ✓      | All queries scoped to tenant pool               |
| License middleware mandatory      | ✓      | All routes require license check                |
| No direct DB instantiation        | ✓      | `DbClient` injected via tenant resolver         |
| Server-authoritative time         | ✓      | `NOW()` in all timestamps; client time rejected |
| Forward-only migration            | ✓      | `down()` throws                                 |
| Structured logging                | ✓      | `@zidney/logger`; no `console.log`              |
| No secrets in code                | ✓      | No environment secrets in route/domain code     |
| Soft delete (no hard delete)      | ✓      | `deleted_at` strategy throughout                |
| Attempt engine unchanged          | ✓      | Feature does not touch attempts                 |
| SELECT FOR UPDATE for concurrency | ✓      | max_members race condition handled              |
| Idempotent staff assign           | ✓      | `ON CONFLICT DO NOTHING`                        |
| Import boundary (apps→packages)   | ✓      | Routes import from `@zidney/domain-core`        |
| No UI → DB imports                | ✓      | No Drizzle imports in frontend                  |
