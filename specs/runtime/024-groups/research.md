# STAGE_24_GROUPS — Technical Research

**Stage:** STAGE_24_GROUPS  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Date:** 2026-03-19  
**Status:** RESOLVED — All unknowns resolved from spec and codebase audit

---

## Overview

This document records all technical research findings, codebase pattern decisions, and resolved
unknowns for the STAGE_24_GROUPS implementation plan. All decisions were validated against the
existing STAGE_23_DEPARTMENTS implementation as the canonical prior-stage reference.

---

## Research Findings

### R-01: Migration Pattern

**Decision:** PoolClient-based, single BEGIN/COMMIT block, forward-only (`down()` throws).

**Evidence from codebase:**

- `apps/api/src/db/tenant/migrations/20260317_001_departments.ts` — canonical template
- Single `client.query('BEGIN')` → sequential DDL statements → `client.query('COMMIT')`
- `ROLLBACK` in catch block
- `down()` throws: `'STAGE_N migration is forward-only. Rollback via snapshot.'`
- All DDL uses `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` for idempotency
- `ADD CONSTRAINT IF NOT EXISTS` for FK idempotency (PG 9.6+)

**Schema version bump strategy:** STAGE_23 sets `version = '1.6.0'`. This migration must set
`version = '1.7.0'` in the single `UPDATE schema_version` statement at end of transaction.

**Migration filename:** `20260319_001_groups.ts` — date prefix matches stage creation date
(2026-03-19).

---

### R-02: Drizzle Schema Patterns

**Decision:** Match STAGE_23 `departments.schema.ts` exactly for column types and index conventions.

**Resolved pattern inventory:**

| Pattern                   | Value                                                                         |
| ------------------------- | ----------------------------------------------------------------------------- |
| Status column             | `varchar('status', { length: 20 }).notNull().default('ENABLED')`              |
| Timestamps                | `timestamp('col', { withTimezone: true }).notNull().defaultNow()`             |
| UUID PK                   | `uuid('id').primaryKey().defaultRandom()`                                     |
| FK (restrict)             | `.references(() => table.id, { onDelete: 'restrict' })`                       |
| FK (set null)             | `.references(() => table.id, { onDelete: 'setNull' })`                        |
| FK (cascade)              | `.references(() => table.id, { onDelete: 'cascade' })`                        |
| No functional uniqueIndex | Unique index owned by migration; not declared in Drizzle schema               |
| Composite PK (join table) | `primaryKey({ columns: [table.col_a, table.col_b] })`                         |
| Soft delete column        | `timestamp('deleted_at', { withTimezone: true })` — nullable, no `.notNull()` |

**Keyset pagination index:** `CREATE INDEX IF NOT EXISTS idx_groups_created_at_id ON groups
(created_at ASC, id ASC)` — created in migration, **not** declared via Drizzle `index()` to avoid
duplicate index creation (same pattern as departments).

**Functional unique index:** `CREATE UNIQUE INDEX IF NOT EXISTS groups_name_lower_unique ON groups
(LOWER(name))` — workspace-scoped case-insensitive name uniqueness. Drizzle cannot express
functional expressions; owned by migration only.

---

### R-03: Domain Package Structure

**Decision:** Mirror STAGE_23 departments domain package exactly.

**Canonical location:** `packages/domain-core/src/groups/`

**Files to create:**

| File                | Purpose                                                                              |
| ------------------- | ------------------------------------------------------------------------------------ |
| `groups.types.ts`   | All TypeScript types and interfaces; pure definitions, no runtime                    |
| `groups.errors.ts`  | `GroupsErrorCode` union type, HTTP status map, default messages, `GroupsError` class |
| `groups.service.ts` | All domain service functions (injected `DbClient`); no direct Pool import            |
| `index.ts`          | Public barrel — re-exports all public symbols                                        |

**Package exports entry** (to add to `packages/domain-core/package.json`):

```json
"./groups": "./src/groups/index.ts"
```

**DbClient structural type:** `groups.types.ts` defines the same `DbClient` interface as
departments — structural type matching `pg.Pool` shape, no `pg` import.

---

### R-04: Routes Structure

**Decision:** Mirror STAGE_23 departments routes folder exactly.

**Canonical location:** `apps/api/src/routes/backoffice/groups/`

**Files to create:**

| File               | Route handled                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `helpers.ts`       | `getDb`, `buildAuditCtx`, `groupErrorResponse`, `successResponse`                                       |
| `index.ts`         | Router factory `createGroupsRouter()` + all re-exports                                                  |
| `list-groups.ts`   | `GET /groups`                                                                                           |
| `create-group.ts`  | `POST /groups`                                                                                          |
| `get-group.ts`     | `GET /groups/:id`                                                                                       |
| `update-group.ts`  | `PUT /groups/:id`                                                                                       |
| `delete-group.ts`  | `DELETE /groups/:id`                                                                                    |
| `student-group.ts` | `PUT /students/:studentId/group`, `DELETE /students/:studentId/group`, `GET /students/:studentId/group` |
| `staff-groups.ts`  | `POST /staff/:staffId/groups`, `DELETE /staff/:staffId/groups/:groupId`, `GET /staff/:staffId/groups`   |

**Route registration order** (critical — matches departments router pattern):

1. `GET /groups` (list — no params)
2. `POST /groups` (create — no params)
3. `GET /groups/:id` (detail — param)
4. `PUT /groups/:id` (update — param)
5. `DELETE /groups/:id` (soft delete — param)
6. Student routes (`/students/:studentId/group`)
7. Staff routes (`/staff/:staffId/groups`, `/staff/:staffId/groups/:groupId`)

---

### R-05: staff_groups FK Target

**Decision:** `staff_id` FK references `backoffice_staff_users(id)` ON DELETE CASCADE.

**Evidence:** `staff-departments.schema.ts` uses `backoffice_staff_users` (not `users`):

```typescript
staff_id: uuid("staff_id")
  .notNull()
  .references(() => backofficeStaffUsers.id, { onDelete: "cascade" });
```

The spec's Data Models table lists `FK → users.id ON DELETE CASCADE` but this is an
abstraction-level name. The actual table in the tenant DB for backoffice staff is
`backoffice_staff_users`. The migration for STAGE_23 confirms:

```sql
CONSTRAINT staff_departments_staff_id_fkey
  FOREIGN KEY (staff_id) REFERENCES backoffice_staff_users(id) ON DELETE CASCADE
```

Groups stage must follow the same FK target.

---

### R-06: groups.department_id FK Behaviour

**Decision:** `groups.department_id` FK → `departments(id)` ON DELETE RESTRICT.

**Rationale from spec (Edge Cases section):**

> "Deletion of department that has anchored groups: Blocked at DB layer via FK ON DELETE RESTRICT
> on `groups.department_id`; groups must be re-anchored or deleted before the department can be
> deleted."

RESTRICT prevents the department from being deleted while any groups reference it. This is
intentional and more conservative than CASCADE.

---

### R-07: staff_groups created_at Column Name

**Decision:** Column is named `created_at` (not `assigned_at`).

**Spec table definition:**

```
| `created_at` | TIMESTAMPTZ | NO | `now()` | Server-set assignment timestamp |
```

Note: `staff_departments` uses `assigned_at`. Groups spec explicitly specifies `created_at` for
`staff_groups`. Use `created_at` in both the migration and Drizzle schema.

---

### R-08: Soft Delete Exclusion Pattern

**Decision:** All list/get queries add `AND deleted_at IS NULL` to WHERE clause. Soft-deleted
groups are invisible to all application queries.

**No separate "active" boolean column.** Soft delete is signalled exclusively by `deleted_at IS
NOT NULL`. This is consistent with planned exam/ads targeting FK references that will use the
`groups.id` — the FK remains valid after soft delete so downstream stage records are not
orphaned.

**Delete guard order inside transaction:**

1. SELECT group for update (lock + existence check)
2. COUNT students WHERE group_id = :id
3. COUNT staff_groups WHERE group_id = :id
4. COUNT exam targets WHERE group_id = :id (safe-pass if table doesn't exist yet)
5. COUNT ads targets WHERE group_id = :id (safe-pass if table doesn't exist yet)
6. UPDATE groups SET deleted_at = NOW() WHERE id = :id

---

### R-09: max_members Race Condition Strategy

**Decision:** READ COMMITTED isolation + `SELECT FOR UPDATE` on `groups` row.

**From spec Clarifications (2026-03-19):**

> "READ COMMITTED (PostgreSQL default). The SELECT FOR UPDATE row lock on the groups row serializes
> all concurrent assignment requests. No phantom rows are possible within the locked scope."

**Count query must exclude the student being assigned:**

```sql
SELECT COUNT(*) FROM students WHERE group_id = $group_id AND id != $student_id
```

This prevents false `GROUP_MAX_MEMBERS_EXCEEDED` when a student already in a full-capacity group
is idempotently re-assigned to the same group.

---

### R-10: Division Mismatch Check Runtime

**Decision:** Division mismatch check (FR-021/FR-022) executes at assignment time inside the
service layer, not inside the transaction lock path. The check queries:

1. The group's `department_id` — if null, skip mismatch check (global group).
2. The department's `division_id` — if null, skip mismatch check (cross-division group).
3. For students: compare `students.division_id` vs `department.division_id`.
4. For staff: compare `backoffice_staff_users.division_id` vs `department.division_id`.
   - If `staff.division_id IS NULL` → workspace-global staff → skip check.

This check does NOT require a `FOR UPDATE` lock (read-only lookup), but must occur inside the
student assignment transaction to maintain consistency with the locked group row.

---

### R-11: Exam / Ads Targeting Tables

**Decision:** The deletion guard for exam and ads references is implemented as a
**try-catch safe-pass** pattern. At STAGE_24 time, the exam targeting and ads targeting tables
do not yet exist. The guard query is:

```sql
SELECT COUNT(*) FROM exam_group_targets WHERE group_id = $id
```

If the table does not exist (relation does not exist error), the guard catches the PG error code
`42P01` (undefined_table) and treats it as count = 0 (safe pass). This allows STAGE_24 to
implement the guard now, where it automatically becomes effective when the targeting tables are
created by downstream stages without any code change.

**Assumption documented in spec:** "If that table does not exist at migration time, the guard
checks a zero-row result and always passes; the guard becomes effective when the exam targeting
stage creates the referenced table."

---

### R-12: Schema Index for Schemas Barrel

**Decision:** `apps/api/src/db/tenant/schemas/index.ts` must be updated to add exports for
`groups.schema.ts` and `staff-groups.schema.ts`. Two files will be added:

```typescript
export * from "./groups.schema";
export * from "./staff-groups.schema";
```

---

### R-13: Backoffice Router Mount Point

**Decision:** Groups router mounts at `/groups` inside the backoffice router, consistent with
departments router mounting at `/departments`. The full URL path becomes:
`/api/v1/backoffice/workspace/groups` (from the spec's endpoint definitions).

**Student and staff sub-routes** are handled within the groups router:

- `/students/:studentId/group` (PUT, DELETE, GET)
- `/staff/:staffId/groups` (POST, GET)
- `/staff/:staffId/groups/:groupId` (DELETE)

These are mounted on the groups router directly (not a separate students router) to keep all
group-assignment logic in one place, consistent with departments `/staff/:staffId/departments`
sub-routes.

---

### R-14: Validation Schema Location

**Decision:** Zod validation schemas are defined in `packages/validation/` following STAGE_23
pattern which references `@zidney/validation/backoffice/departments.schemas`.

**New file to create:**
`packages/validation/src/backoffice/groups.schemas.ts`

Exported as:
`@zidney/validation/backoffice/groups.schemas`

---

## Summary of All Resolved Decisions

| ID   | Topic                  | Decision                                                            |
| ---- | ---------------------- | ------------------------------------------------------------------- |
| R-01 | Migration pattern      | PoolClient, single BEGIN/COMMIT, forward-only, IF NOT EXISTS        |
| R-02 | Drizzle column types   | Match STAGE_23 departments exactly                                  |
| R-03 | Domain package         | `packages/domain-core/src/groups/` + `./groups` export              |
| R-04 | Routes structure       | `apps/api/src/routes/backoffice/groups/`                            |
| R-05 | staff_groups FK        | `backoffice_staff_users(id)` ON DELETE CASCADE (not `users`)        |
| R-06 | department_id FK       | `departments(id)` ON DELETE RESTRICT                                |
| R-07 | staff_groups timestamp | `created_at` (spec defines this; departments uses `assigned_at`)    |
| R-08 | Soft delete            | `deleted_at IS NULL` in all queries; no hard delete                 |
| R-09 | max_members race       | READ COMMITTED + SELECT FOR UPDATE + count excludes current student |
| R-10 | Division check         | Read-only lookup inside assignment transaction; null staff → skip   |
| R-11 | Exam/ads guard         | Safe-pass `42P01` catch; becomes effective when target tables exist |
| R-12 | Schemas barrel         | Add groups + staff-groups exports to schemas/index.ts               |
| R-13 | Router mount           | `/groups` inside backoffice router                                  |
| R-14 | Validation schemas     | `packages/validation/src/backoffice/groups.schemas.ts`              |
