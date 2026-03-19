# Feature Specification: Groups

**Feature Branch**: `spec/024-groups`  
**Stage**: `STAGE_24_GROUPS`  
**Phase**: `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE`  
**Created**: 2026-03-19  
**Status**: DRAFT  
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_24_GROUPS.md`

---

## Feature Overview

This stage implements **Group** as an optional logical clustering layer for students and staff
within a Zidney workspace (tenant). Groups sit below Department in the academic context but are
**not** a structural hierarchy entity. They are flexible segmentation containers used to direct
content, exams, advertisements, and notifications to specific subsets of workspace members.

**What is being built:**

- A `groups` table per-tenant supporting optional Department association, configurable member caps,
  status toggling (ENABLED | DISABLED), and description text.
- A `staff_groups` join table per-tenant enabling many-to-many staff-to-group assignment.
- A `group_id` nullable FK column on the `students` table, enforcing the one-group-per-student
  constraint at both the application and database layer.
- API endpoints for full Group CRUD (list, create, read, update, delete), student single-group
  assignment, and staff multi-group assignment — all accessible to authorized Backoffice staff.
- Transactional `max_members` enforcement on student assignment using `SELECT FOR UPDATE`, with no
  reliance on cached counts.
- Business rules governing name uniqueness within the workspace, optional division boundary via
  `department_id`, deletion guards (active student/staff assignments, exam targeting, ads
  targeting), and status-based assignment blocking.

**Groups are NOT structural hierarchy nodes.** They do not participate in the Division → Department
organizational tree. They are horizontal segmentation labels that may optionally be anchored to a
Department to inherit that Department's division boundary.

**Primary use cases:**

| Use Case                 | How Groups Are Applied                                                    |
| ------------------------ | ------------------------------------------------------------------------- |
| Content visibility       | `WHERE (content.group_id IS NULL OR content.group_id = student.group_id)` |
| Exam targeting           | Exam delivery scoped to a specific group                                  |
| Advertisements targeting | Ads displayed only to members of a target group                           |
| Notification targeting   | Push or in-app notifications sent to a specific group                     |
| Operational segmentation | Reporting, dashboards, and analytics scoped by group membership           |

**Phase & Stage mapping:** Phase 03 Backoffice Core, Academic Structure domain. This stage depends
on STAGE_22_DIVISIONS (divisions table must exist) and STAGE_23_DEPARTMENTS (departments table must
exist) and must be stable before student-facing group filtering is enabled in downstream stages.

**Affected system areas:**

| Area                | Affected? | Notes                                                                          |
| ------------------- | --------- | ------------------------------------------------------------------------------ |
| Tenant Isolation    | Yes       | All tables reside exclusively in tenant DB; no shared group data               |
| License Enforcement | Yes       | License middleware is mandatory for all workspace group routes                 |
| Attempt Engine      | No        | Group scope does not alter attempt snapshot or grading flow in this stage      |
| Worker              | No        | Group CRUD is synchronous; no background job required                          |
| Runtime             | No        | Group is a Backoffice configuration concept only in this stage                 |
| Frontoffice         | No        | Content filtering by group is a downstream stage concern; not implemented here |

---

## Constitutional Compliance Declaration

This specification is validated against **Zidney Constitution v1.2.0**.

| Rule                                   | Compliance                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| No cross-tenant access                 | ✓ All group tables reside exclusively within the tenant DB                       |
| No middleware bypass                   | ✓ Tenant resolver → license middleware are mandatory before any group route      |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic                                |
| No direct DB instantiation             | ✓ All DB access originates from tenant resolver context                          |
| No weakening of snapshot integrity     | ✓ Feature does not touch attempt snapshots                                       |
| No weakening of transaction boundaries | ✓ All writes (including max_members check and deletion guards) are transactional |
| No weakening of version enforcement    | ✓ Schema version bump required; migration is forward-only                        |
| Server-authoritative time only         | ✓ All `created_at` / `updated_at` timestamps are set by the server               |
| No console.log allowed                 | ✓ All logging via structured logger with required fields                         |
| Division boundary preserved            | ✓ Cross-division group access blocked when department_id is set on the group     |

No exceptions requiring an ADR were detected for this stage.

---

## Isolation Impact Analysis

- **Database accessed:** Tenant DB only (resolved per workspace slug / subdomain context).
- **Tenant resolution:** Via existing tenant resolver middleware executed before any route handler.
- **Connection pool:** Obtained from tenant-scoped in-memory connection pool map; no global
  singleton.
- **Resolver middleware:** Mandatory — no route handler may access the DB before tenant and license
  validation.
- **Tables introduced or modified:**
  - `groups` — new table in tenant DB
  - `staff_groups` — new join table in tenant DB
  - `students` — `group_id` nullable FK column added (references `groups.id`, ON DELETE SET NULL)

**Confirmed:** No shared tenant data. No cross-tenant joins. No global group singleton.

---

## License & Version Enforcement

- **License middleware required:** Yes — all Backoffice Group API routes require an active
  workspace license.
- **Allowed license states:** `ACTIVE` only.
  - `SOFT_LOCKED` → 423 Locked
  - `ARCHIVED` → 403 Forbidden
  - `NOT_FOUND` → 404 Not Found
- **Limit enforcement required:** No global group-count limits in this stage; `max_members` per
  group is enforced transactionally.
- **`schema_version` checked:** Yes — migration increments schema version; runtime rejects
  incompatible tenants.
- **`product_version` checked:** Yes — enforced at request boundary per Constitution.

---

## User Scenarios & Testing

### User Story 1 – Administrator Creates a Group (Priority: P1)

A Backoffice administrator creates a new group within the workspace, optionally associating it with
a department and setting a member capacity.

**Why this priority:** Groups are the entry point for all targeted content delivery, exam scoping,
and ad targeting. No downstream targeting is possible without groups existing.

**Independent Test:** Create a group named "Alpha cohort" with no department association, verify it
appears in the list endpoint with `status = ENABLED` and `department_id = null`.

**Acceptance Scenarios:**

1. **Given** an active workspace license, **When** a staff member with group management permission
   sends a create request with a unique name, `department_id = null`, and `max_members = null`,
   **Then** the group is persisted with `status = ENABLED` and all nullable fields set to `null`.
2. **Given** a group with the same name already exists in the workspace, **When** a second create
   request uses the same name, **Then** the API returns 409 Conflict with error code
   `GROUP_NAME_DUPLICATE`.
3. **Given** a create request with `department_id` referencing a non-existent department, **Then**
   the API returns 422 with error code `VALIDATION_ERROR` and a descriptive field-level message.
4. **Given** a create request with a missing or empty name, **Then** the API returns 422 with error
   code `VALIDATION_ERROR` and a descriptive field-level message.
5. **Given** a staff member without group management permission, **When** they attempt to create a
   group, **Then** the API returns 403 Forbidden.
6. **Given** a create request with `max_members = 0`, **Then** the API returns 422 with
   `VALIDATION_ERROR` — `max_members` must be a positive integer when provided.

---

### User Story 2 – Administrator Views the Group List (Priority: P1)

A Backoffice administrator lists all groups in the workspace with optional filters.

**Why this priority:** Required for all assignment UIs and targeting configuration screens.

**Independent Test:** Seed three groups of mixed statuses and department associations; call the list
endpoint without filters; confirm all three are returned with correct fields.

**Acceptance Scenarios:**

1. **Given** multiple groups exist, **When** the list endpoint is called without filters, **Then**
   all groups are returned with `id`, `name`, `department_id`, `max_members`, `description`,
   `status`, `created_at`, and `updated_at`.
2. **Given** a `department_id` filter is applied, **Then** only groups associated with that
   department are returned.
3. **Given** a `status = DISABLED` filter is applied, **Then** only disabled groups are returned.
4. **Given** a `status = ENABLED` filter is applied, **Then** only enabled groups are returned and
   DISABLED groups are excluded from the results.
5. **Given** no groups exist, **Then** an empty `items` list is returned with `total = 0`.

---

### User Story 3 – Administrator Updates a Group (Priority: P2)

A Backoffice administrator updates the name, description, `max_members`, `department_id`, or
`status` of an existing group.

**Why this priority:** Groups evolve during academic periods; capacity adjustments and re-anchoring
to departments must be supported.

**Independent Test:** Create a group named "Beta cohort", update its `description` and
`max_members`, confirm the updated values are returned on the detail endpoint.

**Acceptance Scenarios:**

1. **Given** a group with `name = "Beta cohort"`, **When** an admin renames it to "Gamma cohort",
   **Then** the change is persisted and the updated name is returned immediately.
2. **Given** an admin attempts to rename a group to a name already used by another group in the
   workspace, **Then** the API returns 409 with `GROUP_NAME_DUPLICATE`.
3. **Given** an admin changes `max_members` to a value below the current assigned student count,
   **Then** the update is silently allowed; existing assignments are unchanged; new assignments
   will be blocked until enrolled count drops below the new limit.
4. **Given** an admin changes `department_id` to a department in a different division than existing
   assigned students, **Then** the update is allowed (division mismatch is checked at assignment
   time, not at group definition time).
5. **Given** a `department_id` referencing a non-existent department, **Then** the API returns 422
   with `VALIDATION_ERROR`.

---

### User Story 4 – Administrator Disables a Group (Priority: P2)

A Backoffice administrator disables a group. The group is marked `DISABLED` but not deleted.
Existing student and staff assignments remain; new assignments are blocked.

**Why this priority:** Supports academic period transitions without data loss; disabled groups
continue to serve existing assignments while blocking new intake.

**Independent Test:** Enable a group, assign a student to it, disable the group, confirm
`status = DISABLED`, the student still holds the `group_id` reference, and attempting to assign a
new student returns 422.

**Acceptance Scenarios:**

1. **Given** a group with `status = ENABLED`, **When** an admin sets it to `DISABLED`, **Then** the
   status is updated and all existing student and staff assignments remain intact.
2. **Given** `status = DISABLED`, **When** an admin attempts to assign a new student to the group,
   **Then** the API returns 422 with `GROUP_DISABLED`.
3. **Given** `status = DISABLED`, **When** an admin attempts to assign a new staff member to the
   group, **Then** the API returns 422 with `GROUP_DISABLED`.
4. **Given** a disabled group, **When** an admin re-enables it, **Then** `status` is set to
   `ENABLED` and new assignments are again permitted.
5. **Given** `status = DISABLED`, **Then** the group MUST NOT appear in any selection list or
   dropdown used for assignment.

---

### User Story 5 – Administrator Deletes a Group (Priority: P2)

A Backoffice administrator deletes a group that has no active assignments and no active exam or ads
targeting references.

**Why this priority:** Keeps group namespace clean; prevents orphaned targeting blocks.

**Independent Test:** Create a group with no assignments and no targeting references; delete it;
confirm it no longer appears in the list endpoint.

**Acceptance Scenarios:**

1. **Given** a group with no student/staff assignments and no active exam or ads references,
   **When** an admin sends a delete request, **Then** the group is soft-deleted and returns 200
   with `{ deleted: true }`.
2. **Given** a group with at least one assigned student or staff member, **When** an admin attempts
   to delete it, **Then** the API returns 422 with `GROUP_HAS_ASSIGNMENTS`.
3. **Given** a group referenced by an active exam targeting rule, **When** an admin attempts to
   delete it, **Then** the API returns 422 with `GROUP_REFERENCED_BY_EXAM`.
4. **Given** a group referenced by an active ads targeting rule, **When** an admin attempts to
   delete it, **Then** the API returns 422 with `GROUP_REFERENCED_BY_ADS`.
5. **Given** a group that is DISABLED but still has staff assignments, **When** an admin attempts to
   delete it, **Then** the API returns 422 with `GROUP_HAS_ASSIGNMENTS`.

---

### User Story 6 – Administrator Assigns a Student to a Group (Priority: P1)

A Backoffice administrator assigns a single student to one group. If the student is already
assigned to another group, the previous assignment must be replaced (or rejected — see constraint).

**Why this priority:** Student group membership drives all downstream content and exam targeting
in the student runtime.

**Independent Test:** Assign a student to a group with `max_members = 2`, assign 1 more student
(total = 2), attempt to assign a 3rd student to the same group and confirm 422
`GROUP_MAX_MEMBERS_EXCEEDED`.

**Acceptance Scenarios:**

1. **Given** a student with no group and an ENABLED group with capacity available, **When** the
   assignment endpoint is called, **Then** `student.group_id` is updated and the response confirms
   the new assignment.
2. **Given** a student already assigned to group A, **When** an admin assigns the student to group
   B, **Then** the student's `group_id` is updated to group B atomically (old assignment replaced,
   not stacked).
3. **Given** a group with `max_members = 1` and 1 student already assigned, **When** a second
   student assignment is attempted, **Then** the API returns 422 with `GROUP_MAX_MEMBERS_EXCEEDED`.
4. **Given** `max_members = null`, **When** any number of students are assigned, **Then** no
   capacity rejection occurs.
5. **Given** two concurrent assignment requests for the last available slot, **Then** exactly one
   succeeds; the other receives 422 with `GROUP_MAX_MEMBERS_EXCEEDED` (enforced inside a
   transaction with `SELECT FOR UPDATE` on the `groups` row).
6. **Given** a DISABLED group, **When** a student assignment is attempted, **Then** the API returns
   422 with `GROUP_DISABLED`.
7. **Given** a group whose `department_id` is set (division-anchored), **When** a student from a
   different division is assigned, **Then** the API returns 422 with `GROUP_DIVISION_MISMATCH`.

---

### User Story 7 – Administrator Removes a Student from a Group (Priority: P2)

A Backoffice administrator removes a student's current group assignment.

**Why this priority:** Students may move between academic segments; the group assignment must be
revocable without deleting the student record.

**Independent Test:** Assign a student to a group, call the remove endpoint, confirm
`student.group_id = null`.

**Acceptance Scenarios:**

1. **Given** a student assigned to a group, **When** the remove endpoint is called, **Then**
   `student.group_id` is set to `null` and the operation returns success.
2. **Given** a student with no group assignment, **When** the remove endpoint is called, **Then**
   the API returns 404 with `GROUP_STUDENT_ASSIGNMENT_NOT_FOUND`.

---

### User Story 8 – Administrator Assigns Staff to Multiple Groups (Priority: P2)

A Backoffice administrator assigns a staff member to one or more groups via the staff-groups
endpoint.

**Why this priority:** Staff may oversee multiple learning segments simultaneously; multi-group
staff access is required for content visibility and reporting.

**Independent Test:** Assign a staff member to two groups; fetch their group list; confirm both
are returned. Remove one; confirm only one remains.

**Acceptance Scenarios:**

1. **Given** a staff member and two ENABLED groups, **When** both are assigned, **Then** both
   entries exist in `staff_groups`.
2. **Given** an attempt to assign a group already assigned to a staff member, **Then** the API is
   idempotent and returns success without creating a duplicate row.
3. **Given** a DISABLED group, **When** an admin attempts to assign it to a staff member, **Then**
   the API returns 422 with `GROUP_DISABLED`.
4. **Given** a group whose `department_id` is set, establishing a division boundary, **When** a
   staff member from a different division is assigned, **Then** the API returns 422 with
   `GROUP_DIVISION_MISMATCH`.
5. **Given** an attempt to remove a group from a staff member's assignments, **When** the group
   was never assigned, **Then** the API returns 404 with `GROUP_STAFF_ASSIGNMENT_NOT_FOUND`.

---

### Edge Cases

- **Group with `department_id = null` (global scope):** Valid. May be assigned to students or
  staff from any division. No division filtering applies.
- **Group with `department_id` set (division-anchored):** Division is inherited indirectly via
  `departments.division_id`. Cross-division assignment is rejected.
- **Student switching groups:** Re-assigning a student to a different group is atomic — the old
  `group_id` is replaced in the same transaction; the student NEVER holds two group IDs
  simultaneously.
- **Reducing `max_members` below current count:** Silently allowed. Existing assignments
  are unchanged; forward enforcement applies to new assignments only.
- **Concurrent max_members check:** The count check must execute inside the assignment transaction
  with a `SELECT FOR UPDATE` lock on the `groups` row to prevent race conditions; optimistic
  concurrency is insufficient.
- **Staff counted toward `max_members`:** Staff assignments DO NOT count toward `max_members`.
  `max_members` is a student-only capacity constraint.
- **Deletion of department that has anchored groups:** Blocked at DB layer via FK `ON DELETE
RESTRICT` on `groups.department_id`; groups must be re-anchored or deleted before the department
  can be deleted.

---

## Functional Requirements

- **FR-001**: The system MUST store groups within the tenant DB in a `groups` table with columns:
  `id`, `name`, `department_id`, `max_members`, `description`, `status`, `created_at`,
  `updated_at`.
- **FR-002**: Group `name` MUST be unique within the workspace (tenant-scoped). Case-insensitive
  comparison enforced at the API layer; unique index enforced at the DB layer.
- **FR-003**: `department_id` MUST reference an existing `departments.id` within the same tenant
  DB when provided, or be `null` for workspace-wide groups.
- **FR-004**: The system MUST store staff-group assignments in a `staff_groups` join table with
  columns: `staff_id`, `group_id`, `created_at`.
- **FR-005**: Each `(staff_id, group_id)` pair in `staff_groups` MUST be unique (composite primary
  key).
- **FR-006**: The `students` table MUST have a nullable `group_id` FK column referencing
  `groups.id` with `ON DELETE SET NULL`.
- **FR-007**: Each student MUST belong to at most 1 group. The application layer MUST enforce
  single-group assignment by updating (not inserting) the student's `group_id` field.
- **FR-008**: Student assignment to a group with `status = DISABLED` MUST be rejected with
  `GROUP_DISABLED`.
- **FR-009**: Staff assignment to a group with `status = DISABLED` MUST be rejected with
  `GROUP_DISABLED`.
- **FR-010**: If `max_members` is set on a group, student assignment MUST check the current
  assigned student count inside a database transaction using `SELECT FOR UPDATE` on the `groups`
  row. If the count equals `max_members`, the assignment MUST be rejected with
  `GROUP_MAX_MEMBERS_EXCEEDED`.
- **FR-011**: `max_members` enforcement MUST be transactional; no cached counters; no
  client-side enforcement.
- **FR-012**: Staff assignment MUST NOT count toward `max_members`. `max_members` is a
  student-only capacity constraint.
- **FR-013**: Deleting a group with active student or staff assignments MUST be rejected with
  `GROUP_HAS_ASSIGNMENTS`. Reference checks MUST execute inside the delete transaction.
- **FR-014**: Deleting a group referenced by an active exam targeting rule MUST be rejected with
  `GROUP_REFERENCED_BY_EXAM`.
- **FR-015**: Deleting a group referenced by an active ads targeting rule MUST be rejected with
  `GROUP_REFERENCED_BY_ADS`.
- **FR-016**: Deletion MUST be transactional; all reference checks (students, staff, exam, ads)
  MUST run inside the same transaction before the delete executes.
- **FR-017**: Soft delete is the REQUIRED strategy for group deletion (set `deleted_at` timestamp;
  do not hard-delete the row). Hard delete is NOT allowed.
- **FR-018**: All group API endpoints MUST apply the tenant resolver middleware and license
  middleware before any business logic.
- **FR-019**: All group list/filter queries MUST scope results to the resolved tenant's DB
  connection; no cross-tenant joins.
- **FR-020**: Staff group assignment MUST be idempotent — re-posting the same `(staff_id,
group_id)` pair returns success without creating a duplicate row.
- **FR-021**: If `group.department_id` is set, and `department.division_id` is not null, any
  student assigned to the group MUST have the same `division_id` as the department. Violation MUST
  return 422 with `GROUP_DIVISION_MISMATCH`.
- **FR-022**: If `group.department_id` is set, and `department.division_id` is not null, any staff
  member assigned to the group MUST have that division in their effective division scope. Violation
  MUST return 422 with `GROUP_DIVISION_MISMATCH`. Staff division scope is resolved via the STAGE_21
  staff profile model as a single `division_id` FK equality check. A staff member whose
  `division_id` is `null` is treated as workspace-global and the mismatch check is skipped for
  that assignment.
- **FR-023**: Groups with `status = DISABLED` MUST NOT appear in any selection list or dropdown
  used for assignment. They MUST only appear in management list views when explicitly requested via
  filter.
- **FR-024**: All API responses MUST conform to the platform contract:
  `{ success: boolean, data: object | null, error: { code: string, message: string } | null }`.
- **FR-025**: All mutating operations MUST execute inside database transactions.
- **FR-026**: Server-authoritative timestamps (`now()`) MUST be used for all `created_at` and
  `updated_at` values.
- **FR-027**: Structured logging with `correlation_id` and `workspace_slug` MUST be emitted on
  every mutating operation.
- **FR-028**: Visibility enforcement for content targeting (`WHERE group_id IS NULL OR group_id =
student.group_id`) MUST occur at the backend query layer only. Frontend MUST NOT perform
  group-based content filtering.
- **FR-029**: Group names MUST be validated for max length (255 chars), must not be blank, and
  must not contain control characters.
- **FR-030**: `max_members` MUST be a positive integer when provided; zero is not allowed.

---

## Success Criteria

- **SC-001**: A workspace administrator can create, read, list, update, and delete any group
  without error within the normal operating flow.
- **SC-002**: Each student belongs to at most one group at any time; the constraint is enforced
  transactionally and no double-assignment is possible.
- **SC-003**: `max_members` enforcement prevents over-assignment under concurrent requests.
- **SC-004**: Staff can be assigned to multiple groups; the assignment is idempotent.
- **SC-005**: Group deletion is blocked when students or staff are assigned, or when active exam or
  ads targeting references exist.
- **SC-006**: Disabling a group blocks all new assignments while preserving all existing data.
- **SC-007**: Disabled groups do not appear in assignment selection lists.
- **SC-008**: All group operations produce structured audit log entries containing all required
  fields.
- **SC-009**: No group data from tenant A is accessible from tenant B under any circumstances.
- **SC-010**: Division-anchored groups reject out-of-division user assignments correctly.

---

## Data Models

### Table: `groups`

| Column          | Type         | Nullable | Default             | Notes                                                               |
| --------------- | ------------ | -------- | ------------------- | ------------------------------------------------------------------- |
| `id`            | UUID         | NO       | `gen_random_uuid()` | Primary key                                                         |
| `name`          | VARCHAR(255) | NO       | —                   | Required; unique within workspace (tenant-scoped, case-insensitive) |
| `department_id` | UUID         | YES      | NULL                | FK → `departments.id` ON DELETE RESTRICT; null = workspace-wide     |
| `max_members`   | INTEGER      | YES      | NULL                | Null = unlimited; positive integer only; student-only cap           |
| `description`   | TEXT         | YES      | NULL                |                                                                     |
| `status`        | VARCHAR(20)  | NO       | `'ENABLED'`         | `CHECK (status IN ('ENABLED','DISABLED'))` enforced in migration    |
| `deleted_at`    | TIMESTAMPTZ  | YES      | NULL                | Soft delete marker; null = active record                            |
| `created_at`    | TIMESTAMPTZ  | NO       | `now()`             | Server-set; client time not trusted                                 |
| `updated_at`    | TIMESTAMPTZ  | NO       | `now()`             | Server-set on every update                                          |

**Constraints:**

- `PRIMARY KEY (id)`
- `UNIQUE (LOWER(name))` — workspace-scoped case-insensitive name uniqueness at DB layer
- `CHECK (status IN ('ENABLED', 'DISABLED'))`
- `CHECK (max_members IS NULL OR max_members > 0)`
- `FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT`
  — blocks department deletion while groups are anchored to it

**Indexes:**

- `idx_groups_department_id` on `(department_id)` — department-anchored filtering and FK guard
- `idx_groups_status` on `(status)` — status filter queries
- `idx_groups_deleted_at` on `(deleted_at)` — soft-delete exclusion pattern
- `idx_groups_created_at_id` on `(created_at ASC, id ASC)` — keyset pagination composite index

---

### Table: `staff_groups`

| Column       | Type        | Nullable | Default | Notes                                              |
| ------------ | ----------- | -------- | ------- | -------------------------------------------------- |
| `staff_id`   | UUID        | NO       | —       | FK → `backoffice_staff_users.id` ON DELETE CASCADE |
| `group_id`   | UUID        | NO       | —       | FK → `groups.id` ON DELETE CASCADE                 |
| `created_at` | TIMESTAMPTZ | NO       | `now()` | Server-set assignment timestamp                    |

**Constraints:**

- `PRIMARY KEY (staff_id, group_id)` (composite)
- `FOREIGN KEY (staff_id) REFERENCES backoffice_staff_users(id) ON DELETE CASCADE`
- `FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE`

**Indexes:**

- `idx_staff_groups_group_id` on `(group_id)` — covers group-in-use guard and staff listing
- Composite PK `(staff_id, group_id)` serves staff-prefix lookups; no separate index needed

---

### Modification: `students` table

| Column     | Type | Nullable | Notes                                                            |
| ---------- | ---- | -------- | ---------------------------------------------------------------- |
| `group_id` | UUID | YES      | Nullable FK → `groups.id` ON DELETE SET NULL. Added in Stage 24. |

**Constraint added:**
`FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL`

**Index added:**
`idx_students_group_id` on `students(group_id)` — supports group member count queries and lookups

---

## API Endpoints

### Authentication & Authorization (All Group Endpoints)

All group endpoints require:

1. Tenant resolver middleware (resolves workspace from subdomain/path slug)
2. License middleware (`ACTIVE` license required)
3. JWT validation (Backoffice staff session)
4. RBAC permission check (role must have group management permission for write operations;
   view permission for read operations)

---

### `GET /api/v1/backoffice/workspace/groups`

List all active (non-deleted) groups for the workspace with optional filters. Supports
cursor-based pagination.

**Authorization:** Backoffice staff with `can_view` on Groups module.

**Query parameters:**

| Parameter       | Type    | Required | Default | Notes                                               |
| --------------- | ------- | -------- | ------- | --------------------------------------------------- |
| `limit`         | integer | No       | `20`    | Maximum items per page. Max: `100`.                 |
| `cursor`        | string  | No       | —       | Opaque cursor (UUID of last item on previous page). |
| `status`        | string  | No       | `all`   | Filter: `ENABLED`, `DISABLED`, or `all`.            |
| `department_id` | UUID    | No       | —       | Filter by department association.                   |

**Response 200:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Alpha cohort",
        "department_id": null,
        "max_members": null,
        "description": null,
        "status": "ENABLED",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
      }
    ],
    "nextCursor": null,
    "total": 1
  },
  "error": null
}
```

**Cursor implementation:** `nextCursor` is the `id` of the last item returned. Pass as `cursor`
parameter to fetch the next page. Results are ordered by `created_at ASC, id ASC`. `total`
reflects the full count matching all applied filters, independent of cursor. Soft-deleted records
are excluded from all results. Pagination is **forward-only** — no previous-page cursor is supported.

---

### `POST /api/v1/backoffice/workspace/groups`

Create a new group.

**Authorization:** Backoffice staff with `can_create` on Groups module.

**Request body:**

```json
{
  "name": "Alpha cohort",
  "department_id": null,
  "max_members": null,
  "description": "Optional description"
}
```

**Validation rules:**

- `name`: required, max 255 chars, not blank, no control characters
- `department_id`: optional UUID; must reference an existing, non-deleted department in the same
  tenant DB
- `max_members`: optional; must be a positive integer when provided
- `description`: optional text

**Response 201:** Created group object (same shape as list item).

**Error responses:**

- 409 `GROUP_NAME_DUPLICATE` — name already exists within this workspace (case-insensitive)
- 422 `VALIDATION_ERROR` — missing or invalid fields (includes invalid/non-existent department_id,
  max_members ≤ 0)

---

### `GET /api/v1/backoffice/workspace/groups/:id`

Retrieve a single group by ID.

**Authorization:** Backoffice staff with `can_view` on Groups module.

**Response 200:** Single group object.

**Response 404:**

```json
{
  "success": false,
  "data": null,
  "error": { "code": "GROUP_NOT_FOUND", "message": "Group not found." }
}
```

---

### `PUT /api/v1/backoffice/workspace/groups/:id`

Update an existing group. All fields are optional; only provided fields are updated.

**Authorization:** Backoffice staff with `can_edit` on Groups module.

**Request body (all fields optional):**

```json
{
  "name": "Beta cohort",
  "department_id": "uuid-or-null",
  "max_members": 50,
  "description": "Updated description",
  "status": "DISABLED"
}
```

**Behavior:**

- Name uniqueness within the workspace MUST be validated if `name` changes.
- `department_id` referential integrity MUST be validated if `department_id` changes.
- Reducing `max_members` below the current enrolled student count is silently allowed (forward
  enforcement only).
- Status change to `DISABLED` does NOT cascade-remove existing assignments.

**Response 200:** Updated group object.

**Error responses:**

- 404 `GROUP_NOT_FOUND`
- 409 `GROUP_NAME_DUPLICATE`
- 422 `VALIDATION_ERROR`

---

### `DELETE /api/v1/backoffice/workspace/groups/:id`

Soft-delete a group that has no active assignments and no active targeting references.

**Authorization:** Backoffice staff with `can_delete` on Groups module.

**Response 200:**

```json
{ "success": true, "data": { "deleted": true }, "error": null }
```

**Error responses:**

- 404 `GROUP_NOT_FOUND` — group does not exist or is already soft-deleted
- 422 `GROUP_HAS_ASSIGNMENTS` — students or staff are currently assigned
- 422 `GROUP_REFERENCED_BY_EXAM` — one or more active exam targeting rules reference this group
- 422 `GROUP_REFERENCED_BY_ADS` — one or more active ads targeting rules reference this group

---

### `PUT /api/v1/backoffice/workspace/students/:studentId/group`

Assign or reassign a student to a group. Replaces the student's current group atomically.

**Authorization:** Backoffice staff with `can_edit` on Students module.

**Request body:**

```json
{
  "group_id": "uuid"
}
```

**Behavior:**

- Runs inside a transaction.
- Locks the target `groups` row with `SELECT FOR UPDATE`.
- Counts current `students WHERE group_id = :group_id`.
- Rejects if count equals `max_members`.
- Updates `student.group_id = :group_id` (replaces any prior assignment).

**Response 200:**

```json
{
  "success": true,
  "data": { "student_id": "uuid", "group_id": "uuid" },
  "error": null
}
```

**Error responses:**

- 404 `STUDENT_NOT_FOUND` — student_id does not exist in this workspace
- 404 `GROUP_NOT_FOUND`
- 422 `GROUP_DISABLED`
- 422 `GROUP_MAX_MEMBERS_EXCEEDED`
- 422 `GROUP_DIVISION_MISMATCH` — group is division-anchored; student is in a different division

---

### `DELETE /api/v1/backoffice/workspace/students/:studentId/group`

Remove a student's current group assignment (set `student.group_id = null`).

**Authorization:** Backoffice staff with `can_edit` on Students module.

**Response 200:**

```json
{
  "success": true,
  "data": { "student_id": "uuid", "group_id": null },
  "error": null
}
```

**Error responses:**

- 404 `STUDENT_NOT_FOUND` — student_id does not exist in this workspace
- 404 `GROUP_STUDENT_ASSIGNMENT_NOT_FOUND` — student has no current group assignment

---

### `GET /api/v1/backoffice/workspace/students/:studentId/group`

Read the group currently assigned to a student. Returns `data: null` if the student has no group.

**Authorization:** Backoffice staff with `can_view` on Students module OR `can_view` on Groups module.

**Response 200 (assigned):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Alpha cohort",
    "status": "ENABLED",
    "department_id": null,
    "max_members": null,
    "description": null,
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  },
  "error": null
}
```

**Response 200 (no group assigned):**

```json
{
  "success": true,
  "data": null,
  "error": null
}
```

**Error responses:**

- 404 `STUDENT_NOT_FOUND` — studentId does not exist in this workspace

---

### `GET /api/v1/backoffice/workspace/staff/:staffId/groups`

List all groups currently assigned to a specific staff member.

**Authorization:** Backoffice staff with `can_view` on Groups module.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "groups": [{ "id": "uuid", "name": "Alpha cohort", "status": "ENABLED" }]
  },
  "error": null
}
```

---

### `POST /api/v1/backoffice/workspace/staff/:staffId/groups`

Assign a group to a staff member (idempotent).

**Authorization:** Backoffice staff with `can_edit` on Groups module.

**Request body:**

```json
{
  "group_id": "uuid"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "groups": [{ "id": "uuid", "name": "Alpha cohort", "status": "ENABLED" }]
  },
  "error": null
}
```

**Error responses:**

- 404 `STAFF_NOT_FOUND` — staffId does not exist in this workspace
- 404 `GROUP_NOT_FOUND`
- 422 `GROUP_DISABLED`
- 422 `GROUP_DIVISION_MISMATCH`

---

### `DELETE /api/v1/backoffice/workspace/staff/:staffId/groups/:groupId`

Remove a group assignment from a staff member.

**Authorization:** Backoffice staff with `can_edit` on Groups module.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "groups": [{ "id": "uuid", "name": "Alpha cohort", "status": "ENABLED" }]
  },
  "error": null
}
```

**Error responses:**

- 404 `STAFF_NOT_FOUND` — staffId does not exist in this workspace
- 404 `GROUP_NOT_FOUND`
- 404 `GROUP_STAFF_ASSIGNMENT_NOT_FOUND` — `groupId` is not in the staff member's current
  assignments

---

## Transaction Boundaries

| Operation                 | Transactional? | Notes                                                                                   |
| ------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| Create group              | Yes            | Insert + name uniqueness check + department reference check                             |
| Update group              | Yes            | Name check + department reference check + single row update                             |
| Delete group              | Yes            | Student/staff assignment check + exam ref check + ads ref check + soft-delete in one TX |
| Assign student to group   | Yes            | `SELECT FOR UPDATE` on `groups` row + count check + `student.group_id` update; atomic   |
| Remove student from group | Yes            | `student.group_id = null` update; atomic                                                |
| Assign staff to group     | Yes            | Upsert on `staff_groups`; idempotent by composite PK                                    |
| Remove staff from group   | Yes            | Delete from `staff_groups`; atomic                                                      |

- All writes use server-authoritative timestamps (`now()` server-side only).
- `max_members` count check MUST use `SELECT FOR UPDATE` on the `groups` row to serialize
  concurrent student assignment requests. The locked row must be the `groups` row (not a
  count-only query) to prevent TOCTOU races.

---

## Error Codes Reference

| Code                                 | HTTP Status | Description                                                                         |
| ------------------------------------ | ----------- | ----------------------------------------------------------------------------------- |
| `GROUP_NOT_FOUND`                    | 404         | No group with the given ID exists in this workspace (or it is soft-deleted)         |
| `STUDENT_NOT_FOUND`                  | 404         | No student with the given ID exists in this workspace (path param validation)       |
| `STAFF_NOT_FOUND`                    | 404         | No staff member with the given ID exists in this workspace (path param validation)  |
| `GROUP_STUDENT_ASSIGNMENT_NOT_FOUND` | 404         | Student has no current group assignment                                             |
| `GROUP_STAFF_ASSIGNMENT_NOT_FOUND`   | 404         | Staff member does not have the specified group in their current assignments         |
| `GROUP_NAME_DUPLICATE`               | 409         | A group with the same name already exists within this workspace (case-insensitive)  |
| `GROUP_DIVISION_MISMATCH`            | 422         | Group is division-anchored; the user being assigned belongs to a different division |
| `GROUP_HAS_ASSIGNMENTS`              | 422         | Cannot delete; active student or staff assignments exist                            |
| `GROUP_REFERENCED_BY_EXAM`           | 422         | Cannot delete; one or more active exam targeting rules reference this group         |
| `GROUP_REFERENCED_BY_ADS`            | 422         | Cannot delete; one or more active ads targeting rules reference this group          |
| `GROUP_MAX_MEMBERS_EXCEEDED`         | 422         | Student assignment rejected because max_members limit has been reached              |
| `GROUP_DISABLED`                     | 422         | Cannot assign to a DISABLED group                                                   |
| `VALIDATION_ERROR`                   | 422         | Request body failed field-level validation                                          |

All error responses conform to:

```json
{
  "success": false,
  "data": null,
  "error": { "code": "ERROR_CODE", "message": "Human-readable description." }
}
```

---

## Security Requirements

### Tenant Isolation

- All `groups` and `staff_groups` queries MUST use the tenant-resolved DB connection.
- No cross-tenant group data exposure at any layer.
- Tenant identity is resolved only from the subdomain/path slug — never from the request body.

### RBAC Enforcement

- Read operations (list, detail) require `can_view` on the Groups module.
- Write operations (create, update) require `can_create` / `can_edit` on the Groups module.
- Delete requires `can_delete` on the Groups module.
- Staff group assignment operations require `can_edit` on the Groups module.
- Student group assignment operations require `can_edit` on the Students module.
- All permission checks execute server-side via the RBAC middleware defined in STAGE_21.

### Input Validation

- Group `name` MUST be validated for max length (255 chars), must not be blank, must not
  contain control characters.
- `department_id` MUST be a valid UUID when provided.
- `max_members` MUST be a positive integer when provided.
- `status` updates MUST be one of `ENABLED | DISABLED`.
- All UUID references MUST be validated against the resolved tenant DB.
- `group_id` on student/staff assignment endpoints MUST be validated as an existing, non-deleted
  group in the tenant DB.

### Rate Limiting

Standard Backoffice API rate limits apply (as defined in STAGE_08). Write endpoints are subject to
Backoffice rate limiting. No custom per-endpoint rate limit required for groups at this stage.

### Audit Logging

Every mutating group operation MUST produce a structured log entry with:

- `timestamp` (server-authoritative)
- `level`
- `service`
- `workspace_slug`
- `workspace_id`
- `user_id`
- `correlation_id`
- `event` (e.g., `GROUP_CREATED`, `GROUP_UPDATED`, `GROUP_DELETED`, `GROUP_STUDENT_ASSIGNED`,
  `GROUP_STUDENT_REMOVED`, `GROUP_STAFF_ASSIGNED`, `GROUP_STAFF_REMOVED`)

`console.log` is strictly forbidden. All logging via the platform structured logger
(`packages/logger`).

---

## Observability Requirements

- Structured log fields: all fields listed in Audit Logging section above.
- `correlation_id` propagated from the incoming request header through all DB operations.
- `workspace_slug` and `workspace_id` included in every log line.
- All validation rejections should log at `WARN` level with the error code.
- DB transaction failures should log at `ERROR` level with full error context.
- No sensitive data (student PII, staff credentials) logged at any level.

---

## Migration Requirements

- **Migration file location:** `apps/api/src/db/tenant/migrations/`
- **Migration type:** Additive (new tables + one nullable column on `students`)
- **Forward-only:** No destructive rollback; restore-from-snapshot for rollback.
- **Version bump required:** Yes — schema version incremented.
- **Backward compatibility:** Existing `students` rows will have `group_id = null` after
  migration. No backfill required (column is nullable).

**Migration steps (ordered):**

1. Create `groups` table with all columns, constraints, and indexes.
2. Create `staff_groups` join table with all columns, constraints, and indexes.
3. Add nullable `group_id` column to `students` table.
4. Add FK constraint: `students.group_id REFERENCES groups(id) ON DELETE SET NULL`.
5. Add index: `idx_students_group_id` on `students(group_id)`.
6. Increment `schema_version` by +1 (monotonic integer; one increment per forward migration
   file; exact pre-migration value is the value established by STAGE_23_DEPARTMENTS + all
   intervening migrations; runtime rejects requests where `schema_version < required_minimum`).

**Hard Dependencies:**

- `departments` table MUST exist (created by STAGE_23_DEPARTMENTS migration) before this
  migration runs, as `groups.department_id` references `departments.id`.
- `users` table MUST exist before `staff_groups` can be created.
- `students` table MUST exist before step 3.

**Must run before:**

- Content visibility filtering stages that apply group-scoped WHERE predicates
- Exam targeting stages that reference `groups.id`
- Ads targeting stages that reference `groups.id`

---

## Testing Requirements

| Test Type                            | Coverage Required                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| Unit tests                           | max_members enforcement logic, division boundary check, name uniqueness logic               |
| Integration tests                    | All API endpoints, all error codes, all 4xx/5xx paths                                       |
| Student single-group constraint      | Assign student to group A, then group B; confirm group_id = B only; no duplicate rows       |
| Max members concurrency test         | Two concurrent requests for last slot; exactly one succeeds                                 |
| Idempotency test                     | POST staff-group with duplicate — returns success, no duplicate row in staff_groups         |
| Isolation test                       | Two tenants; groups in tenant A not visible from tenant B                                   |
| Deletion guard — assignments         | Delete group with assigned students/staff; confirm 422 GROUP_HAS_ASSIGNMENTS                |
| Deletion guard — exam ref            | Delete group referenced by active exam; confirm 422 GROUP_REFERENCED_BY_EXAM                |
| Deletion guard — ads ref             | Delete group referenced by active ads; confirm 422 GROUP_REFERENCED_BY_ADS                  |
| Soft-delete verification             | Deleted group disappears from list; existing FK references remain valid until cascade fires |
| Division mismatch test (student)     | Assign student (division X) to group anchored to department (division Y); confirm 422       |
| Division mismatch test (staff)       | Assign staff (division X) to group anchored to department (division Y); confirm 422         |
| Status enforcement test              | Assign student/staff to DISABLED group; confirm 422 GROUP_DISABLED                          |
| Disabled group hidden from selection | List endpoint with `status = ENABLED` filter; DISABLED groups must not appear               |
| max_members = null test              | Assign unlimited students; confirm no capacity rejection                                    |
| max_members reduce test              | Reduce max_members below current count; confirm update succeeds; old assignments unaffected |
| Audit log test                       | Each mutation event produces correct structured log entry with all required fields          |
| License enforcement test             | SOFT_LOCKED → 423; ARCHIVED → 403; no license → 404                                         |
| RBAC enforcement test                | Requests without required permission → 403                                                  |
| Schema version test                  | Migration increments schema_version; runtime rejects requests under old schema version      |

---

## Transaction Safety: `max_members` Lock Strategy

The `SELECT FOR UPDATE` lock MUST target the `groups` row, not a derived count result. The
canonical transaction sequence for student group assignment is:

```sql
BEGIN; -- READ COMMITTED isolation (PostgreSQL default); SELECT FOR UPDATE provides row-level serialization

-- Lock the group row to serialize concurrent assignments
SELECT id, max_members, status FROM groups
  WHERE id = $group_id AND deleted_at IS NULL
  FOR UPDATE;

-- Count current student members inside the locked transaction.
-- MUST exclude the student being assigned to support idempotent re-assignment
-- at full capacity (prevents false GROUP_MAX_MEMBERS_EXCEEDED on same-group re-assign).
SELECT COUNT(*) FROM students WHERE group_id = $group_id AND id != $student_id;

-- If count >= max_members: ROLLBACK and return GROUP_MAX_MEMBERS_EXCEEDED
-- Otherwise: proceed

UPDATE students SET group_id = $group_id, updated_at = now()
  WHERE id = $student_id;

COMMIT;
```

This approach serializes all concurrent assignment attempts against the same group, preventing
race conditions. Application-layer count caching or optimistic concurrency is NOT acceptable.

**Isolation level:** READ COMMITTED (PostgreSQL default) is sufficient. The `SELECT FOR UPDATE`
row lock on `groups` serializes all concurrent assignment attempts; no phantom rows are possible
because the count is scoped to a specific `group_id` UUID with a held row lock. SERIALIZABLE is
not required and would add unnecessary contention overhead.

---

## Assumptions

1. **`departments` table pre-exists:** STAGE_23_DEPARTMENTS creates the `departments` table before
   this stage migrates. This spec does not re-specify the departments boot step.
2. **`users` table exists:** Assumed to be the base user table that `staff_groups.staff_id`
   references. Available before this migration runs.
3. **`students` table exists:** Created by a prior stage; the nullable `group_id` column is added
   in this stage's migration.
4. **RBAC module exists:** STAGE_21 provides the RBAC permission framework referenced here.
5. **Rate limiting infrastructure exists:** STAGE_08 defines the Backoffice rate limiting layer.
6. **Structured logger package available:** `packages/logger` is available for all log calls.
7. **Exam targeting table exists or will exist:** The deletion guard for `GROUP_REFERENCED_BY_EXAM`
   assumes a table or relation tracking exam-to-group targeting. If that table does not exist at
   migration time, the guard checks a zero-row result and always passes; the guard becomes
   effective when the exam targeting stage creates the referenced table.
8. **Ads targeting table exists or will exist:** Same assumption as exam targeting above.

---

## Out of Scope

The following items are explicitly excluded from this stage:

- **Content visibility filtering by group:** The query predicate (`WHERE group_id IS NULL OR
group_id = student.group_id`) is defined in this spec as a contract but is NOT implemented in
  any content query in this stage. Downstream content stages apply this predicate.
- **Exam group targeting implementation:** This spec defines deletion guards for exam targeting
  references but does not implement the exam-to-group targeting assignment flow.
- **Ads group targeting implementation:** Same as exam targeting — deletion guards only.
- **Notification targeting by group:** Defined as a use case but not implemented in this stage.
- **Group nesting or hierarchy:** Groups are flat. No parent_id. No tree structure.
- **Bulk group operations:** Bulk create, update, or delete is not in scope.
- **Group-level reporting or analytics views:** Reporting is a downstream stage concern.
- **max_members for staff:** Staff count is excluded from max_members enforcement by design.
- **Group import/export:** Not in scope.
- **Student self-service group selection:** This is a Backoffice-only feature in this stage.

---

## Non-Functional Requirements

| Requirement               | Rule                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Transactionality          | All writes (create, update, delete, assignment) execute inside DB transactions                                                        |
| Structured logging        | Required on every mutating operation; fields: timestamp, level, service, workspace_slug, workspace_id, user_id, correlation_id, event |
| Rate limiting             | Write endpoints subject to Backoffice rate limits (STAGE_08)                                                                          |
| Server-authoritative time | Client time never trusted; all timestamps set server-side                                                                             |
| Tenant isolation          | All queries are scoped to tenant DB; no cross-tenant access                                                                           |
| Idempotency               | Staff group assignment POST is idempotent                                                                                             |
| Concurrency safety        | max_members check uses `SELECT FOR UPDATE` on `groups` row to prevent race conditions                                                 |
| Soft delete               | Groups are soft-deleted only (`deleted_at` set); no hard delete allowed                                                               |
| No console.log            | All output through `packages/logger`                                                                                                  |
| No secrets in code        | All environment-scoped configuration only                                                                                             |
| Single-group constraint   | Student may belong to at most 1 group; enforced at application layer via UPDATE (not INSERT)                                          |

---

## Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.

---

## Clarifications

### Session 2026-03-19

> Ambiguity scan performed against risk areas: Transactions, Idempotency, Concurrency,
> Version Enforcement, Middleware Order, Security/RBAC, Error Contract, Isolation Boundaries.
> All 5 questions were self-resolved from spec context and Zidney Constitution v1.2.0 rules.

- **Q: Does the `SELECT COUNT(*)` in the student assignment transaction need to exclude the student
  being assigned, to prevent a false `GROUP_MAX_MEMBERS_EXCEEDED` when a student in a full-capacity
  group is re-assigned to the same group?**  
  → **A: Yes — critical correctness fix.** Without the exclusion, student A already in group G
  (max_members = 1) triggers count = 1 ≥ max_members = 1 → incorrectly returns 422 on idempotent
  re-assignment. The count query MUST be:
  `SELECT COUNT(*) FROM students WHERE group_id = $group_id AND id != $student_id`.
  The canonical SQL in the **Transaction Safety** section has been updated accordingly.

- **Q: What PostgreSQL transaction isolation level applies to the SELECT FOR UPDATE student
  assignment transaction?**  
  → **A: READ COMMITTED** (PostgreSQL default). The `SELECT FOR UPDATE` row lock on the `groups`
  row serializes all concurrent assignment requests. No phantom rows are possible within the
  locked scope (count query is a point-in-time read inside a held row lock). SERIALIZABLE isolation
  is not required and would add unnecessary overhead. The **Transaction Safety** section has been
  annotated with this decision.

- **Q: What 404 error codes apply when `student_id` or `staff_id` path parameters reference
  non-existent tenant entities?**  
  → **A: `STUDENT_NOT_FOUND` (404) and `STAFF_NOT_FOUND` (404)** — added to the Error Codes
  Reference table and to the error response lists of all affected endpoints
  (`PUT /students/:id/group`, `DELETE /students/:id/group`, `POST /staff/:id/groups`,
  `DELETE /staff/:id/groups/:group_id`). These checks execute after tenant resolution and license
  validation, before any group-level business logic.

- **Q: How is a staff member's "effective division scope" resolved for FR-022
  `GROUP_DIVISION_MISMATCH` enforcement?**  
  → **A: Single `division_id` FK equality check** on the staff profile record (STAGE_21 model).
  A staff member's effective division is their `division_id` field. If `division_id` is `null` on
  the staff profile, the staff member is workspace-global and the mismatch check is bypassed for
  that assignment. FR-022 has been updated with this resolution.

- **Q: What is the schema_version increment mechanism — monotonic integer, semver, or other?**  
  → **A: Monotonic integer, incremented by exactly +1 per forward migration file.** The exact
  pre-migration value is whatever STAGE_23_DEPARTMENTS established plus any intervening migrations.
  The runtime rejects tenant requests where `schema_version < required_minimum` (≥ check).
  No semver is used. Migration step 6 in the **Migration Requirements** section has been updated
  with this detail.

**Coverage summary after this session:**

| Taxonomy Category               | Status   | Notes                                                        |
| ------------------------------- | -------- | ------------------------------------------------------------ |
| Transactions                    | Resolved | Count exclusion bug fixed; isolation level documented        |
| Idempotency                     | Resolved | Idempotent re-assign edge case explicitly handled via fix    |
| Concurrency (SELECT FOR UPDATE) | Resolved | READ COMMITTED + row lock documented; SQL corrected          |
| Version enforcement             | Resolved | Monotonic +1 integer strategy documented in migration step 6 |
| Middleware order                | Clear    | Already unambiguous (tenant→license→JWT→RBAC)                |
| RBAC / Security                 | Resolved | Staff division scope clarified in FR-022                     |
| Error contract                  | Resolved | STUDENT_NOT_FOUND + STAFF_NOT_FOUND added                    |
| Isolation boundaries            | Clear    | Fully specified; no cross-tenant risk detected               |
