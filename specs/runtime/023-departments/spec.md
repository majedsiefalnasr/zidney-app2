# Feature Specification: Departments

**Feature Branch**: `spec/023-departments`  
**Stage**: `STAGE_23_DEPARTMENTS`  
**Phase**: `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE`  
**Created**: 2026-03-17  
**Status**: DRAFT  
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_23_DEPARTMENTS.md`

---

## Feature Overview

This stage implements **Department** as the secondary hierarchical organizational-academic entity
within a Zidney workspace (tenant). Department sits below Division in the academic trust chain and
provides fine-grained segmentation for students, staff, content visibility, and reporting.

**What is being built:**

- A `departments` table per-tenant supporting unlimited-depth self-referencing hierarchy, optional
  Division association, type classification (`MAIN | SUB | SIMPLE`), and configurable user limits.
- A `staff_departments` join table per-tenant enabling many-to-many staff-to-department assignment.
- API endpoints for full Department CRUD (list, create, read, update, delete) plus hierarchy
  traversal endpoints (subtree, full tree), all accessible to authorized Backoffice staff.
- Cycle detection at the API layer enforced on every parent-change request.
- Transactional `max_users` enforcement on student assignment.
- Business rules governing name uniqueness within parent scope, parent-child division consistency,
  deletion guards (children exist, active assignments), and status-based assignment blocking.

**Department is NOT a replacement for Division.** Division remains the primary isolation boundary.
Department is secondary, optional segmentation. Department may exist without a Division association
(cross-division scope) or may be scoped to a specific Division.

**Phase & Stage mapping:** Phase 03 Backoffice Core, Academic Structure domain. This stage depends
on STAGE_22_DIVISIONS (divisions table must exist) and must be stable before STAGE_24_GROUPS.

**Affected system areas:**

| Area                | Affected? | Notes                                                                 |
| ------------------- | --------- | --------------------------------------------------------------------- |
| Tenant Isolation    | Yes       | All tables reside exclusively in tenant DB; no shared department data |
| License Enforcement | Yes       | License middleware is mandatory for all workspace department routes   |
| Attempt Engine      | No        | Department scope does not alter attempt snapshot or grading flow      |
| Worker              | No        | Department CRUD is synchronous; no background job required            |
| Runtime             | No        | Department is a Backoffice configuration concept only in this stage   |
| Frontoffice         | No        | Content filtering by department is optional and not implemented here  |

---

## Constitutional Compliance Declaration

This specification is validated against **Zidney Constitution v1.2.0**.

| Rule                                   | Compliance                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| No cross-tenant access                 | ✓ All department tables reside exclusively within the tenant DB                  |
| No middleware bypass                   | ✓ Tenant resolver → license middleware are mandatory before any department route |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic                                |
| No direct DB instantiation             | ✓ All DB access originates from tenant resolver context                          |
| No weakening of snapshot integrity     | ✓ Feature does not touch attempt snapshots                                       |
| No weakening of transaction boundaries | ✓ All writes (including max_users check and cycle detection) are transactional   |
| No weakening of version enforcement    | ✓ Schema version bump required; migration is forward-only                        |
| Server-authoritative time only         | ✓ All `created_at` / `updated_at` timestamps are set by the server               |
| No console.log allowed                 | ✓ All logging via structured logger with required fields                         |
| Division boundary preserved            | ✓ Department cannot be assigned outside its parent's division scope              |

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
  - `departments` — new table in tenant DB
  - `staff_departments` — new join table in tenant DB
  - `students` — `department_id` nullable FK column added (references `departments.id`, ON DELETE SET NULL)

**Confirmed:** No shared tenant data. No cross-tenant joins. No global department singleton.

---

## License & Version Enforcement

- **License middleware required:** Yes — all Backoffice Department API routes require an active
  workspace license.
- **Allowed license states:** `ACTIVE` only.
  - `SOFT_LOCKED` → 423 Locked
  - `ARCHIVED` → 403 Forbidden
  - `NOT_FOUND` → 404 Not Found
- **Limit enforcement required:** No department-count limits in this stage; general workspace limits
  apply.
- **`schema_version` checked:** Yes — migration increments schema version; runtime rejects
  incompatible tenants.
- **`product_version` checked:** Yes — enforced at request boundary per Constitution.

---

## User Scenarios & Testing

### User Story 1 – Administrator Creates a Department (Priority: P1)

A Backoffice administrator creates a new top-level or nested department for the workspace.

**Why this priority:** Foundation of department-based segmentation. All downstream student and staff
assignment depends on departments existing.

**Independent Test:** Create a top-level department named "Engineering", verify it appears in the
list endpoint with `status = ENABLED`, `parent_id = null`, and `type = MAIN`.

**Acceptance Scenarios:**

1. **Given** an active workspace license, **When** a staff member with department management
   permission sends a create request with a unique name and `parent_id = null`, **Then** the
   department is persisted with `status = ENABLED`, `parent_id = null`, and `division_id` as
   supplied.
2. **Given** a department with the same name already exists under the same parent scope, **When** a
   second create request uses the same name under the same parent, **Then** the API returns 409
   Conflict with error code `DEPARTMENT_NAME_DUPLICATE`.
3. **Given** a create request with `parent_id` referencing an existing department with
   `division_id = X` and the request body specifies `division_id = Y (Y ≠ X)`, **Then** the API
   returns 422 with error code `DEPARTMENT_DIVISION_MISMATCH`.
4. **Given** a create request with a missing or empty name, **Then** the API returns 422 with error
   code `VALIDATION_ERROR` and a descriptive field-level message.
5. **Given** a staff member without department management permission, **When** they attempt to
   create a department, **Then** the API returns 403 Forbidden.

---

### User Story 2 – Administrator Views the Department List (Priority: P1)

A Backoffice administrator can list all departments in the workspace with optional filters.

**Why this priority:** Required for all assignment UIs and hierarchy configuration.

**Independent Test:** Seed three departments of mixed types and statuses; call the list endpoint
without filters; confirm all three are returned with correct fields.

**Acceptance Scenarios:**

1. **Given** multiple departments exist, **When** the list endpoint is called without filters,
   **Then** all departments are returned with `id`, `name`, `type`, `status`, `parent_id`,
   `division_id`, `max_users`, `description`, `created_at`, and `updated_at`.
2. **Given** a `division_id` filter is applied, **Then** only departments associated with that
   division are returned.
3. **Given** a `status = DISABLED` filter is applied, **Then** only disabled departments are
   returned.
4. **Given** a `parent_id` filter is applied, **Then** only direct children of that parent are
   returned.
5. **Given** a `type` filter is applied, **Then** only departments of that type are returned.

---

### User Story 3 – Administrator Updates a Department (Priority: P2)

A Backoffice administrator updates the name, description, type, `max_users`, `parent_id`, or
`division_id` of an existing department.

**Why this priority:** Operational correctness — department names and structure evolve during
enrollment periods.

**Independent Test:** Create a department, update its name to a new unique value, confirm the
updated name is returned on the detail endpoint.

**Acceptance Scenarios:**

1. **Given** a department with name "Engineering", **When** an admin renames it to "Science",
   **Then** the change is persisted and the updated name is returned immediately.
2. **Given** an admin attempts to rename a department to a name already used by another department
   under the same parent scope, **Then** the API returns 409 with `DEPARTMENT_NAME_DUPLICATE`.
3. **Given** an admin attempts to change `parent_id` to a value that would create a circular
   reference, **Then** the API returns 422 with `DEPARTMENT_CIRCULAR_REFERENCE`.
4. **Given** an admin attempts to change `parent_id` to a department whose `division_id` conflicts
   with the current department's `division_id`, **Then** the API returns 422 with
   `DEPARTMENT_DIVISION_MISMATCH`.

---

### User Story 4 – Administrator Disables a Department (Priority: P2)

A Backoffice administrator disables a department. The department is marked `DISABLED` but not
deleted. Existing assignments remain valid; new assignments are blocked.

**Why this priority:** Supports academic year transitions without data loss.

**Independent Test:** Enable a department, assign a student to it, disable the department, confirm
`status = DISABLED` and the student still holds the `department_id` reference.

**Acceptance Scenarios:**

1. **Given** a department with `status = ENABLED`, **When** an admin sets it to `DISABLED`, **Then**
   the status is updated and all existing student and staff assignments remain intact.
2. **Given** `status = DISABLED`, **When** an admin attempts to assign a new student to the
   department, **Then** the API returns 422 with `DEPARTMENT_DISABLED`.
3. **Given** a disabled department, **When** an admin re-enables it, **Then** `status` is set to
   `ENABLED` and new assignments are again permitted.

---

### User Story 5 – Administrator Deletes a Department (Priority: P2)

A Backoffice administrator hard-deletes a department that has no children and no active assignments.

**Why this priority:** Keeps academic structure clean; prevents orphaned segmentation blocks.

**Independent Test:** Create a department with no children and no assignments, delete it, and
confirm it no longer appears in the list endpoint.

**Acceptance Scenarios:**

1. **Given** a department with no children and no active student or staff assignments, **When** an
   admin sends a delete request, **Then** the department is removed from the DB and returns 200
   with `{ deleted: true }`.
2. **Given** a department with child departments, **When** an admin attempts to delete it, **Then**
   the API returns 422 with `DEPARTMENT_HAS_CHILDREN`.
3. **Given** a department with active student assignments, **When** an admin attempts to delete it,
   **Then** the API returns 422 with `DEPARTMENT_HAS_ASSIGNMENTS`.
4. **Given** a department with active staff assignments in `staff_departments`, **When** an admin
   attempts to delete it, **Then** the API returns 422 with `DEPARTMENT_HAS_ASSIGNMENTS`.

---

### User Story 6 – Administrator Views Department Hierarchy (Priority: P2)

A Backoffice administrator retrieves the full department tree or the subtree rooted at a specific
department.

**Why this priority:** Administrators need hierarchy visibility for structure review and nested
assignment configuration.

**Independent Test:** Seed a 3-level hierarchy (root → child → grandchild). Call the tree endpoint
and confirm all three levels are returned in nested form.

**Acceptance Scenarios:**

1. **Given** a 3-level hierarchy, **When** the tree endpoint is called, **Then** the response
   contains a nested structure representing all departments.
2. **Given** a department with two direct children, **When** the `/:id/children` endpoint is
   called, **Then** only the direct children are returned (not grandchildren).
3. **Given** a department with no children, **When** `/:id/children` is called, **Then** an empty
   list is returned.

---

### User Story 7 – Staff Multi-Department Assignment (Priority: P2)

A Backoffice administrator assigns a staff member to multiple departments via the
staff-departments endpoint.

**Why this priority:** Staff (e.g., teachers) often span multiple academic departments.

**Independent Test:** Assign a staff member to two departments, fetch their department list, confirm
both are returned. Remove one, confirm only one remains.

**Acceptance Scenarios:**

1. **Given** a staff member and two enabled departments, **When** both are assigned, **Then** both
   entries exist in `staff_departments`.
2. **Given** an attempt to add a department already assigned, **Then** the API is idempotent and
   returns success (no duplicate error).
3. **Given** an attempt to assign a `DISABLED` department to a staff member, **Then** the API
   returns 422 with `DEPARTMENT_DISABLED`.
4. **Given** an attempt to assign a department whose `division_id` does not match any of the
   staff member's current divisions, **Then** the API returns 422 with
   `DEPARTMENT_DIVISION_MISMATCH`.

---

### User Story 8 – Student Assignment with max_users Enforcement (Priority: P1)

A student is assigned to a department that has a `max_users` limit set. The system enforces the
limit transactionally.

**Why this priority:** Ensures capacity constraints are not violated under concurrent assignment
requests.

**Independent Test:** Set `max_users = 2` on a department. Assign 2 students successfully. Attempt
to assign a 3rd student and confirm 422 with `DEPARTMENT_MAX_USERS_EXCEEDED`.

**Acceptance Scenarios:**

1. **Given** a department with `max_users = 50` and 49 currently assigned students, **When** the
   50th student is assigned, **Then** the assignment succeeds.
2. **Given** a department at full capacity (`max_users` reached), **When** a new student assignment
   is attempted, **Then** the API returns 422 with `DEPARTMENT_MAX_USERS_EXCEEDED`.
3. **Given** `max_users = null`, **When** any number of students are assigned, **Then** no capacity
   rejection occurs.
4. **Given** two concurrent assignment requests for the last slot, **Then** only one succeeds; the
   other receives 422 with `DEPARTMENT_MAX_USERS_EXCEEDED` (enforced inside a transaction with
   count lock).

---

### Edge Cases

- **Changing `parent_id` of a node that has children:** API must run cycle detection against the
  full subtree to prevent the reparenting from creating a cycle.
- **Department with `division_id = null` (cross-division):** Valid. May be assigned to users from
  any division. Division filtering still applies at the containing layer.
- **Assigning a student to a department outside their division:** Rejected with
  `DEPARTMENT_DIVISION_MISMATCH` if the department's `division_id` is not null and does not match
  the student's `division_id`.
- **Depth of hierarchy:** No enforced depth limit. Cycle detection covers all ancestor paths.
- **Concurrent max_users check:** The count check must execute inside the assignment transaction
  with a row-locking SELECT to prevent race conditions; optimistic concurrency is insufficient.

---

## Functional Requirements

- **FR-001**: The system MUST store departments within the tenant DB in a `departments` table with
  columns: `id`, `name`, `type`, `parent_id`, `division_id`, `max_users`, `description`, `status`,
  `created_at`, `updated_at`.
- **FR-002**: Department `name` MUST be unique within the same parent scope — same `parent_id`
  value (including `null`). Case-insensitive comparison enforced at API layer; functional index
  enforced at DB layer.
- **FR-003**: `parent_id` must reference an existing `departments.id` within the same tenant DB,
  or be `null` for root-level departments.
- **FR-004**: If a department has `division_id` set, its `parent_id` (if not null) MUST reference a
  department with the same `division_id` or a department with `division_id = null`.
- **FR-005**: No circular hierarchy is permitted. Cycle detection MUST execute at the API layer on
  every create or update that sets `parent_id`.
- **FR-006**: The system MUST store staff-department assignments in a `staff_departments` join table
  with columns: `staff_id`, `department_id`, `assigned_at`.
- **FR-007**: Each `(staff_id, department_id)` pair in `staff_departments` MUST be unique
  (composite primary key).
- **FR-008**: The `students` table MUST have a nullable `department_id` FK column referencing
  `departments.id` with `ON DELETE SET NULL`.
- **FR-009**: Student assignment to a department with `status = DISABLED` MUST be rejected with
  `DEPARTMENT_DISABLED`.
- **FR-010**: Staff assignment to a department with `status = DISABLED` MUST be rejected with
  `DEPARTMENT_DISABLED`.
- **FR-011**: If `max_users` is set on a department, student assignment MUST check the current
  assigned student count inside a database transaction. If the count equals `max_users`, the
  assignment MUST be rejected with `DEPARTMENT_MAX_USERS_EXCEEDED`.
- **FR-012**: `max_users` enforcement MUST be transactional; no cached counters.
- **FR-013**: Deleting a department that has child departments MUST be rejected with
  `DEPARTMENT_HAS_CHILDREN`. FK `ON DELETE RESTRICT` on `parent_id` also enforces this at DB layer.
- **FR-014**: Deleting a department with active student or staff assignments MUST be rejected with
  `DEPARTMENT_HAS_ASSIGNMENTS`.
- **FR-015**: All department API endpoints MUST apply the tenant resolver middleware and license
  middleware before any business logic.
- **FR-016**: All department list/filter queries MUST scope results to the resolved tenant's DB
  connection; no cross-tenant joins.
- **FR-017**: Staff assignment to a department MUST be idempotent — re-posting the same
  `(staff_id, department_id)` pair returns success without creating a duplicate row.
- **FR-018**: If `department.division_id` is not null, any student assigned to the department
  MUST have the same `division_id`. Violation MUST return 422 with
  `DEPARTMENT_DIVISION_MISMATCH`.
- **FR-019**: If `department.division_id` is not null, any staff member assigned to the department
  MUST have that division in their `staff_divisions` assignments. Violation MUST return 422 with
  `DEPARTMENT_DIVISION_MISMATCH`.
- **FR-020**: The `GET /departments/tree` endpoint MUST return all departments for the workspace in
  a nested structure.
- **FR-021**: The `GET /departments/:id/children` endpoint MUST return only the direct children of
  the specified department.
- **FR-022**: All API responses MUST conform to the platform contract:
  `{ success: boolean, data: object | null, error: { code: string, message: string } | null }`.
- **FR-023**: All mutating operations MUST execute inside database transactions.
- **FR-024**: Server-authoritative timestamps (`now()`) MUST be used for all `created_at` and
  `updated_at` values.
- **FR-025**: Structured logging with `correlation_id` and `workspace_slug` MUST be emitted on
  every mutating operation.

---

## Success Criteria

- **SC-001**: A workspace administrator can create, read, list, update, and delete any department
  without error within the normal operating flow.
- **SC-002**: Circular hierarchy creation is rejected 100% of the time at the API layer.
- **SC-003**: Department deletion is blocked whenever children or active assignments exist.
- **SC-004**: `max_users` enforcement prevents over-assignment under concurrent requests.
- **SC-005**: Staff can be assigned to multiple departments; the assignment is idempotent.
- **SC-006**: All department operations produce structured audit log entries.
- **SC-007**: No department data from tenant A is accessible from tenant B under any circumstances.
- **SC-008**: Division-scoped departments reject out-of-division user assignments correctly.
- **SC-009**: Disabling a department blocks new assignments while preserving all existing data.

---

## Data Models

### Table: `departments`

| Column        | Type         | Nullable | Default             | Notes                                                             |
| ------------- | ------------ | -------- | ------------------- | ----------------------------------------------------------------- |
| `id`          | UUID         | NO       | `gen_random_uuid()` | Primary key                                                       |
| `name`        | VARCHAR(255) | NO       | —                   | Required; unique within same parent scope                         |
| `type`        | VARCHAR(20)  | NO       | —                   | `MAIN \| SUB \| SIMPLE`; `CHECK` constraint enforced in migration |
| `parent_id`   | UUID         | YES      | NULL                | FK → `departments.id` ON DELETE RESTRICT; null = root department  |
| `division_id` | UUID         | YES      | NULL                | FK → `divisions.id` ON DELETE RESTRICT; null = cross-division     |
| `max_users`   | INTEGER      | YES      | NULL                | Null = unlimited; positive integer only                           |
| `description` | TEXT         | YES      | NULL                |                                                                   |
| `status`      | VARCHAR(20)  | NO       | `ENABLED`           | `CHECK (status IN ('ENABLED','DISABLED'))` enforced in migration  |
| `created_at`  | TIMESTAMPTZ  | NO       | `now()`             | Server-set; client time not trusted                               |
| `updated_at`  | TIMESTAMPTZ  | NO       | `now()`             | Server-set on every update                                        |

**Constraints:**

- `PRIMARY KEY (id)`
- `UNIQUE (LOWER(name), COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid))` — unique
  index enforcing case-insensitive name uniqueness within parent scope at DB layer
- `CHECK (type IN ('MAIN', 'SUB', 'SIMPLE'))`
- `CHECK (status IN ('ENABLED', 'DISABLED'))`
- `CHECK (max_users IS NULL OR max_users > 0)`
- `FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE RESTRICT` — blocks parent deletion
  while children exist
- `FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE RESTRICT`

**Indexes:**

- `idx_departments_parent_id` on `(parent_id)` — hierarchy traversal and children queries
- `idx_departments_division_id` on `(division_id)` — division-scoped filtering
- `idx_departments_status` on `(status)` — status filter queries
- `idx_departments_type` on `(type)` — type filter queries
- `idx_departments_created_at_id` on `(created_at ASC, id ASC)` — keyset pagination composite index

---

### Table: `staff_departments`

| Column          | Type        | Nullable | Default | Notes                                              |
| --------------- | ----------- | -------- | ------- | -------------------------------------------------- |
| `staff_id`      | UUID        | NO       | —       | FK → `backoffice_staff_users.id` ON DELETE CASCADE |
| `department_id` | UUID        | NO       | —       | FK → `departments.id` ON DELETE CASCADE            |
| `assigned_at`   | TIMESTAMPTZ | NO       | `now()` | Server-set assignment timestamp                    |

**Constraints:**

- `PRIMARY KEY (staff_id, department_id)` (composite)
- `FOREIGN KEY (staff_id) REFERENCES backoffice_staff_users(id) ON DELETE CASCADE`
- `FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE`

**Indexes:**

- `idx_staff_departments_department_id` on `(department_id)` — covers department-in-use guard
- Composite PK `(staff_id, department_id)` serves staff-prefix queries; no separate index needed

---

### Modification: `students` table

| Column          | Type | Nullable | Notes                                                                 |
| --------------- | ---- | -------- | --------------------------------------------------------------------- |
| `department_id` | UUID | YES      | Nullable FK → `departments.id` ON DELETE SET NULL. Added in Stage 23. |

**Constraint added:**
`FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL`

---

## API Endpoints

### Authentication & Authorization (All Department Endpoints)

All department endpoints require:

1. Tenant resolver middleware (resolves workspace from subdomain/path slug)
2. License middleware (`ACTIVE` license required)
3. JWT validation (Backoffice staff session)
4. RBAC permission check (role must have department management permission for write operations;
   view permission for read operations)

---

### `GET /api/v1/backoffice/workspace/departments`

List all departments for the workspace with optional filters. Supports cursor-based pagination.

**Authorization:** Backoffice staff with `can_view` on Departments module.

**Query parameters:**

| Parameter     | Type    | Required | Default | Notes                                               |
| ------------- | ------- | -------- | ------- | --------------------------------------------------- |
| `limit`       | integer | No       | `20`    | Maximum items per page. Max: `100`.                 |
| `cursor`      | string  | No       | —       | Opaque cursor (UUID of last item on previous page). |
| `status`      | string  | No       | `all`   | Filter: `ENABLED`, `DISABLED`, or `all`.            |
| `division_id` | UUID    | No       | —       | Filter by division association.                     |
| `parent_id`   | UUID    | No       | —       | Filter by direct parent. Use `null` for root items. |
| `type`        | string  | No       | —       | Filter: `MAIN`, `SUB`, or `SIMPLE`.                 |

**Response 200:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Engineering",
        "type": "MAIN",
        "parent_id": null,
        "division_id": null,
        "max_users": null,
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
reflects the full count matching all applied filters, independent of cursor.

---

### `POST /api/v1/backoffice/workspace/departments`

Create a new department.

**Authorization:** Backoffice staff with `can_create` on Departments module.

**Request body:**

```json
{
  "name": "Engineering",
  "type": "MAIN",
  "parent_id": null,
  "division_id": null,
  "max_users": null,
  "description": "Optional description"
}
```

**Validation rules:**

- `name`: required, max 255 chars, not blank, no control characters
- `type`: required, one of `MAIN | SUB | SIMPLE`
- `parent_id`: optional UUID; must reference existing department in same tenant DB
- `division_id`: optional UUID; must reference existing enabled division in same tenant DB
- If `parent_id` is provided: `division_id` consistency check required (FR-004)
- Cycle detection: N/A for new departments (no parent chain exists yet)

**Response 201:** Created department object (same shape as list item).

**Error responses:**

- 409 `DEPARTMENT_NAME_DUPLICATE` — name already exists within same parent scope
- 422 `DEPARTMENT_NOT_FOUND` — `parent_id` references non-existent department
- 422 `DEPARTMENT_DIVISION_MISMATCH` — division_id inconsistent with parent's division scope
- 422 `VALIDATION_ERROR` — missing or invalid fields

---

### `GET /api/v1/backoffice/workspace/departments/:id`

Retrieve a single department by ID.

**Authorization:** Backoffice staff with `can_view` on Departments module.

**Response 200:** Single department object.

**Response 404:**

```json
{
  "success": false,
  "data": null,
  "error": { "code": "DEPARTMENT_NOT_FOUND", "message": "Department not found." }
}
```

---

### `PUT /api/v1/backoffice/workspace/departments/:id`

Update an existing department.

**Authorization:** Backoffice staff with `can_edit` on Departments module.

**Request body (all fields optional; only provided fields updated):**

```json
{
  "name": "Science",
  "type": "SUB",
  "parent_id": "uuid-or-null",
  "division_id": "uuid-or-null",
  "max_users": 100,
  "description": "Updated description"
}
```

**Behavior:**

- Cycle detection MUST run if `parent_id` changes.
- Division consistency MUST be validated if `parent_id` or `division_id` changes.
- Name uniqueness within new parent scope MUST be validated if `name` or `parent_id` changes.

**Response 200:** Updated department object.

**Error responses:**

- 404 `DEPARTMENT_NOT_FOUND`
- 409 `DEPARTMENT_NAME_DUPLICATE`
- 422 `DEPARTMENT_CIRCULAR_REFERENCE`
- 422 `DEPARTMENT_DIVISION_MISMATCH`
- 422 `VALIDATION_ERROR`

---

### `DELETE /api/v1/backoffice/workspace/departments/:id`

Hard-delete a department with no children and no active assignments.

**Authorization:** Backoffice staff with `can_delete` on Departments module.

**Response 200:**

```json
{ "success": true, "data": { "deleted": true }, "error": null }
```

**Error responses:**

- 404 `DEPARTMENT_NOT_FOUND`
- 422 `DEPARTMENT_HAS_CHILDREN` — one or more child departments exist
- 422 `DEPARTMENT_HAS_ASSIGNMENTS` — active student or staff assignments exist

---

### `GET /api/v1/backoffice/workspace/departments/:id/children`

Retrieve the direct children of a department.

**Authorization:** Backoffice staff with `can_view` on Departments module.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Sub-Engineering",
        "type": "SUB",
        "parent_id": "parent-uuid",
        "division_id": null,
        "status": "ENABLED"
      }
    ]
  },
  "error": null
}
```

---

### `GET /api/v1/backoffice/workspace/departments/tree`

Retrieve the full hierarchical department tree for the workspace.

**Authorization:** Backoffice staff with `can_view` on Departments module.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "tree": [
      {
        "id": "uuid",
        "name": "Engineering",
        "type": "MAIN",
        "status": "ENABLED",
        "children": [
          {
            "id": "uuid",
            "name": "Software",
            "type": "SUB",
            "status": "ENABLED",
            "children": []
          }
        ]
      }
    ]
  },
  "error": null
}
```

**Note:** The tree endpoint returns all departments for the workspace with nested child arrays. For
workspaces with very large hierarchies, this endpoint may be paginated by top-level root nodes in a
future stage.

---

### `GET /api/v1/backoffice/workspace/staff/:staff_id/departments`

List all departments assigned to a specific staff member.

**Authorization:** Backoffice staff with `can_view` on Departments module.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "departments": [{ "id": "uuid", "name": "Engineering", "status": "ENABLED" }]
  },
  "error": null
}
```

---

### `POST /api/v1/backoffice/workspace/staff/:staff_id/departments`

Assign a department to a staff member (idempotent).

**Authorization:** Backoffice staff with `can_edit` on Departments module.

**Request body:**

```json
{
  "department_id": "uuid"
}
```

**Response 200:** Updated list of staff's departments.

**Error responses:**

- 404 `DEPARTMENT_NOT_FOUND`
- 422 `DEPARTMENT_DISABLED`
- 422 `DEPARTMENT_DIVISION_MISMATCH`

---

### `DELETE /api/v1/backoffice/workspace/staff/:staff_id/departments/:department_id`

Remove a department assignment from a staff member.

**Authorization:** Backoffice staff with `can_edit` on Departments module.

**Response 200:** Updated list of staff's remaining departments.

**Error responses:**

- 404 `DEPARTMENT_NOT_FOUND`
- 404 `DEPT_STAFF_ASSIGNMENT_NOT_FOUND` — `department_id` is not in the staff member's current assignments

---

## Transaction Boundaries

| Operation                    | Transactional? | Notes                                                                   |
| ---------------------------- | -------------- | ----------------------------------------------------------------------- |
| Create department            | Yes            | Insert + name uniqueness check + division consistency check             |
| Update department            | Yes            | Cycle detection + name check + division check + single row update       |
| Delete department            | Yes            | Children check + assignment check + delete within single transaction    |
| Assign staff department      | Yes            | Upsert on `staff_departments`; idempotent by composite PK               |
| Remove staff department      | Yes            | Delete from `staff_departments`; atomic                                 |
| Assign student to department | Yes            | `max_users` count check (SELECT FOR UPDATE) + assignment update; atomic |

- All writes use server-authoritative timestamps (`now()` server-side only).
- `max_users` count check MUST use `SELECT FOR UPDATE` or equivalent row lock to prevent race
  conditions under concurrent assignment requests.

---

## Error Codes Reference

| Code                              | HTTP Status | Description                                                                   |
| --------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| `DEPARTMENT_NOT_FOUND`            | 404         | No department with the given ID exists in this workspace                      |
| `DEPT_STAFF_ASSIGNMENT_NOT_FOUND` | 404         | The specified department is not in the staff member's current assignments     |
| `DEPARTMENT_NAME_DUPLICATE`       | 409         | A department with the same name already exists within the same parent scope   |
| `DEPARTMENT_CIRCULAR_REFERENCE`   | 422         | Setting parent_id would create a circular reference in the hierarchy          |
| `DEPARTMENT_DIVISION_MISMATCH`    | 422         | Department's division_id is inconsistent with parent or user's division scope |
| `DEPARTMENT_HAS_CHILDREN`         | 422         | Cannot delete; one or more child departments exist                            |
| `DEPARTMENT_HAS_ASSIGNMENTS`      | 422         | Cannot delete; active student or staff assignments exist                      |
| `DEPARTMENT_MAX_USERS_EXCEEDED`   | 422         | Student assignment rejected because max_users limit has been reached          |
| `DEPARTMENT_DISABLED`             | 422         | Cannot assign to a DISABLED department                                        |
| `VALIDATION_ERROR`                | 422         | Request body failed field-level validation                                    |

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

- All `departments` and `staff_departments` queries MUST use the tenant-resolved DB connection.
- No cross-tenant department data exposure at any layer.
- Tenant identity is resolved only from the subdomain/path slug — never from the request body.

### RBAC Enforcement

- Read operations (list, detail, tree, children) require `can_view` on the Departments module.
- Write operations (create, update) require `can_create` / `can_edit` on the Departments module.
- Delete requires `can_delete` on the Departments module.
- Staff assignment operations require `can_edit` on the Departments module.
- All permission checks execute server-side via the RBAC middleware defined in STAGE_21.

### Input Validation

- Department `name` MUST be validated for max length (255 chars), must not be blank, must not
  contain control characters.
- `parent_id` and `division_id` MUST be valid UUIDs when provided.
- `type` MUST be one of `MAIN | SUB | SIMPLE`.
- `status` updates MUST be one of `ENABLED | DISABLED`.
- `max_users` MUST be a positive integer when provided.
- All UUID references MUST be validated against the resolved tenant DB.

### Rate Limiting

Standard Backoffice API rate limits apply (as defined in STAGE_08). Write endpoints are subject to
Backoffice rate limiting. No custom per-endpoint rate limit required for departments at this stage.

### Audit Logging

Every mutating department operation MUST produce a structured log entry with:

- `timestamp` (server-authoritative)
- `level`
- `service`
- `workspace_slug`
- `workspace_id`
- `user_id`
- `correlation_id`
- `event` (e.g., `DEPARTMENT_CREATED`, `DEPARTMENT_UPDATED`, `DEPARTMENT_DELETED`,
  `DEPARTMENT_STAFF_ASSIGNED`, `DEPARTMENT_STAFF_REMOVED`)

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
- **Backward compatibility:** Existing `students` rows will have `department_id = null` after
  migration. No backfill required (column is nullable).

**Migration steps (ordered):**

1. Create `departments` table with all columns, constraints, and indexes.
2. Create `staff_departments` join table with all columns, constraints, and indexes.
3. Add nullable `department_id` column to `students` table.
4. Add FK constraint: `students.department_id REFERENCES departments(id) ON DELETE SET NULL`.
5. Add index: `idx_students_department_id` on `students(department_id)`.
6. Increment `schema_version`.

**Hard Dependencies:**

- `divisions` table MUST exist (created by STAGE_22_DIVISIONS migration) before this migration
  runs, as `departments.division_id` references `divisions.id`.
- `backoffice_staff_users` table MUST exist before `staff_departments` can be created.
- `students` table MUST exist before step 3.

**Must run before:**

- STAGE_24_GROUPS (groups may reference department_id)
- Student management stages requiring department assignment
- Staff management stages requiring department assignment

---

## Testing Requirements

| Test Type                  | Coverage Required                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------- |
| Unit tests                 | Cycle detection algorithm, division consistency check, max_users enforcement logic     |
| Integration tests          | All API endpoints, all error codes, all 4xx/5xx paths                                  |
| Hierarchy traversal test   | Create 3-level tree, call `/tree` and `/:id/children`; confirm correct structure       |
| Cycle detection test       | Attempt to set parent_id = child's id; confirm 422 DEPARTMENT_CIRCULAR_REFERENCE       |
| Max users concurrency test | Two concurrent requests for last slot; exactly one succeeds                            |
| Idempotency test           | POST staff-department with duplicate — returns success, no duplicate row               |
| Isolation test             | Two tenants; departments in tenant A not visible from tenant B                         |
| FK constraint test         | Delete department with children rejected at DB layer (ON DELETE RESTRICT on parent_id) |
| Division mismatch test     | Assign student with division_id X to department with division_id Y; confirm 422        |
| Status enforcement test    | Assign student/staff to DISABLED department; confirm 422 DEPARTMENT_DISABLED           |
| Deletion guard test        | Department with active assignments or children; confirm 422                            |
| Audit log test             | Each mutation event produces correct structured log entry with all required fields     |
| License enforcement test   | Requests with SOFT_LOCKED → 423; ARCHIVED → 403; no license → 404                      |
| RBAC enforcement test      | Requests without required permission → 403                                             |
| Schema version test        | Migration increments schema_version; runtime rejects requests under old schema version |

---

## Assumptions

1. **`divisions` table pre-exists:** STAGE_22_DIVISIONS creates the `divisions` table before this
   stage migrates. This spec does not re-specify the divisions boot step.
2. **`backoffice_staff_users` table exists:** Created by STAGE_17 / STAGE_21; available before this
   migration runs.
3. **`students` table exists:** Created by a prior stage; the nullable `department_id` column is
   added in this stage's migration.
4. **RBAC module exists:** STAGE_21 provides the RBAC permission framework referenced here.
5. **Rate limiting infrastructure exists:** STAGE_08 defines the Backoffice rate limiting layer.
6. **Structured logger packages available:** `packages/logger` is available for all log calls.

---

## Out of Scope

The following items are explicitly excluded from this stage:

- **Content visibility filtering by department:** Department-based content filtering logic is
  optional and deferred to a future stage. The data model supports it, but no filtering
  implementation is included here.
- **Tagging system:** Departments are not a tagging mechanism.
- **Commercial structure:** Departments have no billing, payment, or subscription association.
- **Department-level exam scheduling:** Scheduling by department is not implemented in this stage.
- **Advertisements targeting by department:** Ads targeting using department scope is out of scope.
- **Automatic max_users for staff:** Staff is not counted toward `max_users` in this stage.
  `max_users` applies to students only.
- **Soft delete:** Departments are hard-deleted only. Soft delete is not implemented.
- **Bulk operations:** Bulk create, update, or delete of departments is not in scope.
- **Department re-enable after workspace-level lock:** No workspace-level department locking exists
  in this stage (unlike the disable-divisions operation in STAGE_22).

---

## Non-Functional Requirements

| Requirement               | Rule                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Transactionality          | All writes (create, update, delete, assignment) execute inside DB transactions                                                        |
| Structured logging        | Required on every mutating operation; fields: timestamp, level, service, workspace_slug, workspace_id, user_id, correlation_id, event |
| Rate limiting             | Write endpoints subject to Backoffice rate limits (STAGE_08)                                                                          |
| Server-authoritative time | Client time never trusted; all timestamps set server-side                                                                             |
| Tenant isolation          | All queries are scoped to tenant DB; no cross-tenant access                                                                           |
| Idempotency               | Staff department assignment POST is idempotent                                                                                        |
| Cycle detection           | Enforced at API layer on every create/update setting parent_id                                                                        |
| Concurrency safety        | max_users check uses SELECT FOR UPDATE (or equivalent) to prevent race conditions                                                     |
| No console.log            | All output through packages/logger                                                                                                    |
| No secrets in code        | All environment-scoped configuration only                                                                                             |

---

## Clarifications

### Session 2026-03-17

**Q1: What algorithm must be used for cycle detection — a recursive SQL CTE or an application-layer ancestor walk?**

The spec mandates cycle detection at the API layer but leaves the implementation strategy open. An
implementer needs a definitive approach because a recursive CTE executed inside the write transaction
and an application-layer loop have different locking and correctness semantics in deep hierarchies.

Resolution: Cycle detection MUST use a recursive SQL CTE executed inside the same database
transaction as the update, before the row is written. The canonical form is:

```sql
WITH RECURSIVE ancestors AS (
  SELECT id, parent_id FROM departments WHERE id = $proposed_parent_id
  UNION ALL
  SELECT d.id, d.parent_id FROM departments d
  JOIN ancestors a ON d.id = a.parent_id
)
SELECT id FROM ancestors WHERE id = $current_department_id
```

If any row is returned, the update MUST be rejected with `DEPARTMENT_CIRCULAR_REFERENCE`. This
approach is preferred over an application-layer loop because it executes atomically within the
transaction, prevents TOCTOU races on concurrent hierarchy changes, and handles arbitrary-depth trees
in a single round-trip. Application-layer traversal is NOT acceptable.

---

**Q2: What should happen when an admin reduces `max_users` to a value below the current number of assigned students?**

FR-011 and FR-012 specify max_users enforcement for new assignments only. No rule covers the inverse
operation — reducing the limit after the cap has already been exceeded by existing assignments (e.g.,
dept has 40 students, admin sets max_users = 20). An implementer cannot determine whether to reject
the update, allow it silently, or issue a warning.

Resolution: Reducing `max_users` below the current assigned student count is silently allowed. The
`max_users` field is a forward-only cap on new assignments; it does not retroactively invalidate
existing ones. After the update, existing student records remain unchanged. New assignments will be
blocked until the enrolled count drops below the new limit. No error code or warning is returned by
the update operation. Implementers MUST NOT add a validation check comparing the new `max_users`
value against the current student count during a department update.

---

**Q3: When reparenting a department that has children with explicit `division_id` values, must division consistency be re-validated recursively across the entire subtree, or only for the direct parent-child relationship?**

FR-004 constrains the moved node against its new parent but is silent about the moved node's
descendants. If department A (division X) has children B and C (also division X) and is reparented
under a new parent with division Y, the spec validates A vs. new parent, but it is ambiguous whether
B and C must also be re-validated against A's new ancestor chain.

Resolution: Division consistency during reparenting validates the **moved node only** against its
new immediate parent per FR-004. Child departments of the moved node are NOT re-validated
recursively. The division_id invariant is upheld at creation and update time of each individual
node; cascading re-validation across the subtree is not required and would be O(subtree size).
Existing children's division_id values were legal when those children were created and remain legal
under reparenting because the parent-child division constraint is evaluated bottom-up only (child
must be compatible with its parent, not the other way around). Implementers MUST NOT add subtree
re-validation on reparent.

---

**Q4: For concurrent `max_users` enforcement, which row must the `SELECT FOR UPDATE` lock target — the `departments` row or rows in the `students` table?**

The spec specifies "SELECT FOR UPDATE or equivalent row lock" but does not identify the locked row.
Locking a count result has no direct equivalent; the implementer must decide whether to lock the
`departments` row (serializing all concurrent assignments to the same department) or to issue a
locking count query against `students`.

Resolution: The `SELECT FOR UPDATE` lock MUST be placed on the **`departments` row itself**. The
implementer MUST issue:

```sql
SELECT id, max_users FROM departments WHERE id = $department_id FOR UPDATE
```

as the first statement inside the assignment transaction, before counting assigned students. This
serializes all concurrent assignment requests for the same department through a single row lock.
After acquiring the lock, a plain (non-locking) `SELECT COUNT(*)` against `students` is executed to
check the current occupancy. If count ≥ max_users, the transaction is rolled back and
`DEPARTMENT_MAX_USERS_EXCEEDED` is returned. Locking individual student rows is NOT the intended
approach and would not prevent the race condition correctly.

---

**Q5: When `parent_id` is included in a PUT request body with an explicit `null` value, does it mean "reparent to root" (set parent_id = NULL) or is it treated as field absence (no change)?**

The PUT endpoint is documented as "all fields optional; only provided fields updated." JSON `null`
and field absence are distinct in JSON payloads, but the spec does not state whether `null` triggers
the reparent-to-root operation or is treated the same as omitting the field. This directly affects
whether cycle detection and division consistency checks must run.

Resolution: An explicit `null` value for `parent_id` in the PUT body MUST be interpreted as
"reparent to root" — i.e., `parent_id` is set to `NULL` in the database. Omitting the `parent_id`
key entirely means "no change to parent_id." The API handler MUST distinguish these two cases by
inspecting whether the key is present in the parsed request body, not by checking whether its value
is null. When `parent_id` is explicitly set to null: (a) no cycle detection is needed (a null parent
has no ancestors and cannot create a cycle), (b) division consistency MUST still be re-validated
because moving a department to root level removes it from a parent-scoped division context, and
(c) name uniqueness within the null-parent scope MUST be re-evaluated.
