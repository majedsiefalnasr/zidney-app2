# Feature Specification: Divisions

**Feature Branch**: `spec/022-divisions`  
**Stage**: `STAGE_22_DIVISIONS`  
**Phase**: `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE`  
**Created**: 2026-03-16  
**Status**: DRAFT  
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_22_DIVISIONS.md`

---

## Feature Overview

This stage implements **Division** as the primary academic isolation layer within a Zidney workspace
(tenant). A Division is a first-class, hard-boundary scope dimension that controls visibility and
access grouping for all academic entities including students, staff, subjects, exams, library
content, live sessions, and advertisements.

**What is being built:**

- A `divisions` table per-tenant holding division definitions, statuses, and the immutable default
  flag.
- A `staff_divisions` join table per-tenant enabling many-to-many staff-to-division assignment.
- API endpoints for full Division CRUD (create, read, update, toggle status) accessible to
  authorized Backoffice staff.
- A privileged `disable-divisions` system operation that transactionally reassigns all references to
  the default division and places the workspace in single-division mode.
- Enforcement of `division_id` on all student records (NOT NULL) and minimum-one-division on all
  staff assignments.
- A workspace-level feature flag governing divisions-enabled mode vs. single-division mode.

**Phase & Stage mapping:** Phase 03 Backoffice Core, Academic Structure domain. This stage must be
stable before STAGE_23_DEPARTMENTS, as divisions precede departments in the academic hierarchy.

**Affected system areas:**

| Area                | Affected? | Notes                                                               |
| ------------------- | --------- | ------------------------------------------------------------------- |
| Tenant Isolation    | Yes       | All tables reside exclusively in tenant DB; no shared division data |
| License Enforcement | Yes       | License middleware is mandatory for all workspace division routes   |
| Attempt Engine      | No        | Division scope does not alter the attempt snapshot or grading flow  |
| Worker              | No        | Division CRUD is synchronous; disable-divisions is synchronous      |
| Runtime             | No        | Division is a Backoffice configuration concept only in this stage   |
| Frontoffice         | No        | Students see content filtered by division; not configured here      |

---

## Constitutional Compliance Declaration

This specification is validated against **Zidney Constitution v1.2.0**.

| Rule                                   | Compliance                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| No cross-tenant access                 | ✓ All division tables reside exclusively within the tenant DB                  |
| No middleware bypass                   | ✓ Tenant resolver → license middleware are mandatory before any division route |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic                              |
| No direct DB instantiation             | ✓ All DB access originates from tenant resolver context                        |
| No weakening of snapshot integrity     | ✓ Feature does not touch attempt snapshots                                     |
| No weakening of transaction boundaries | ✓ All writes and the disable-divisions operation are transactional             |
| No weakening of version enforcement    | ✓ Schema version bump required; migration is forward-only                      |
| Server-authoritative time only         | ✓ All `created_at` / `updated_at` timestamps are set by the server             |
| No console.log allowed                 | ✓ All logging via structured logger with required fields                       |
| Tenant-scoped default division         | ✓ Default division is created during tenant bootstrap, cannot be deleted       |

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
  - `divisions` — new table in tenant DB
  - `staff_divisions` — new join table in tenant DB
  - `students` — `division_id` FK column added (must reference `divisions.id`, NOT NULL)
  - `staff_users` — no structural change in this stage (join table handles the relationship)

**Confirmed:** No shared tenant data. No cross-tenant joins. No global division singleton.

---

## License & Version Enforcement

- **License middleware required:** Yes — all Backoffice Division API routes require an active
  workspace license.
- **Allowed license states:** `ACTIVE` only.
  - `SOFT_LOCKED` → 423 Locked
  - `ARCHIVED` → 403 Forbidden
  - `NOT_FOUND` → 404 Not Found
- **Limit enforcement required:** No division-specific count limits in this stage; general workspace
  limits apply.
- **`schema_version` checked:** Yes — migration increments schema version; runtime rejects
  incompatible tenants.
- **`product_version` checked:** Yes — enforced at request boundary per Constitution.

---

## User Scenarios & Testing

### User Story 1 – Administrator Creates a Division (Priority: P1)

A Backoffice administrator creates a new division for the workspace by providing a name and optional
description.

**Why this priority:** Foundation of academic segmentation. All downstream assignment and filtering
depend on divisions existing.

**Independent Test:** Create a division named "Grade 10A", verify it appears in the list endpoint
with status ENABLED, and confirm it is not the default division.

**Acceptance Scenarios:**

1. **Given** an active workspace license, **When** a staff member with division management
   permission sends a create request with a unique name, **Then** the division is persisted in the
   tenant DB with status `ENABLED` and `is_default = false`.
2. **Given** a division with the same name already exists, **When** a second create request uses the
   same name, **Then** the API returns 409 Conflict with error code `DIVISION_NAME_CONFLICT`.
3. **Given** a create request with an empty or missing name, **Then** the API returns 422 with error
   code `VALIDATION_ERROR` and a descriptive field-level message.
4. **Given** a staff member without division management permission, **When** they attempt to create
   a division, **Then** the API returns 403 Forbidden.

---

### User Story 2 – Administrator Views the Division List (Priority: P1)

A Backoffice administrator can list all divisions in the workspace to understand the current
academic structure.

**Why this priority:** Required for all assignment UIs and filtering configuration.

**Independent Test:** Seed three divisions; call the list endpoint; confirm all three are returned
with correct fields including `is_default` and `status`.

**Acceptance Scenarios:**

1. **Given** three divisions exist (one default, two custom), **When** the list endpoint is called,
   **Then** all three are returned with `id`, `name`, `description`, `is_default`, `status`,
   `created_at`, and `updated_at`.
2. **Given** only the default division exists, **When** the list endpoint is called, **Then** the
   single default division is returned.
3. **Given** a staff member without read permission, **When** the list endpoint is called, **Then**
   the API returns 403 Forbidden.

---

### User Story 3 – Administrator Updates a Division (Priority: P2)

A Backoffice administrator updates the name or description of an existing non-default division.

**Why this priority:** Operational correctness — academic naming evolves over enrollment periods.

**Independent Test:** Create a division, update its name, confirm the updated name is returned on
the detail endpoint, and confirm the name uniqueness constraint rejects duplicate names.

**Acceptance Scenarios:**

1. **Given** a non-default division with name "Grade 10A", **When** an admin renames it to "Grade
   10B", **Then** the change is persisted and the updated name is returned immediately.
2. **Given** an admin attempts to rename a division to a name already used by another division,
   **Then** the API returns 409 Conflict with `DIVISION_NAME_CONFLICT`.
3. **Given** an admin attempts to update the `is_default` flag via the update endpoint, **Then** the
   API ignores the `is_default` field and preserves the existing value.
4. **Given** an admin attempts to update the default division's name, **Then** the update is
   accepted — only `is_default` is immutable, not the name or description.

---

### User Story 4 – Administrator Disables a Non-Default Division (Priority: P2)

A Backoffice administrator disables a non-default division. The division is marked `DISABLED` but
not deleted. Students and staff previously assigned to it remain assigned until manually reassigned.

**Why this priority:** Supports academic year transitions without data loss.

**Independent Test:** Enable a division, assign a student to it, disable the division, confirm the
division status is `DISABLED` and the student still holds the `division_id` reference.

**Acceptance Scenarios:**

1. **Given** a non-default division with status `ENABLED`, **When** an admin toggles it to
   `DISABLED`, **Then** the status is updated and the division remains in the DB with all
   assignments intact.
2. **Given** the default division, **When** an admin attempts to disable it, **Then** the API
   returns 422 Unprocessable Entity with error code `DEFAULT_DIVISION_IMMUTABLE`.
3. **Given** a division is already `DISABLED`, **When** an admin re-enables it, **Then** the status
   is set to `ENABLED`.

---

### User Story 5 – Administrator Deletes a Non-Default Division (Priority: P2)

A Backoffice administrator hard-deletes a non-default, non-referenced division from the workspace.

**Why this priority:** Keeps academic structure clean; prevents orphaned configuration.

**Independent Test:** Create a division with no students or staff assigned, delete it, and confirm
it no longer appears in the list endpoint.

**Acceptance Scenarios:**

1. **Given** a non-default division with no students or staff assigned, **When** an admin sends a
   delete request, **Then** the division is removed from the DB and returns 200 with success.
2. **Given** a non-default division with active student assignments, **When** an admin attempts to
   delete it, **Then** the API returns 422 with error code `DIVISION_IN_USE` and a count of
   affected student records.
3. **Given** a non-default division with active staff assignments, **When** an admin attempts to
   delete it, **Then** the API returns 422 with error code `DIVISION_IN_USE` and a count of
   affected staff assignments.
4. **Given** the default division, **When** an admin attempts to delete it, **Then** the API
   returns 422 with error code `DEFAULT_DIVISION_IMMUTABLE`.

---

### User Story 6 – Disable-Divisions System Operation (Priority: P1)

A Backoffice super-administrator disables the divisions feature for the entire workspace. All
academic entities are transactionally reassigned to the default division; non-default divisions are
disabled; the workspace enters single-division mode.

**Why this priority:** Architectural integrity — cross-division leakage is a critical failure mode.

**Independent Test:** Seed multiple divisions with students and staff assigned. Execute the
disable-divisions operation. Verify all students reference the default division, all staff only have
the default division in their join table, all non-default divisions are marked `DISABLED`, and the
workspace feature flag is locked to single-division mode.

**Acceptance Scenarios:**

1. **Given** a workspace with 3 divisions and students/staff distributed across them, **When** the
   disable-divisions operation is confirmed, **Then** all entities are reassigned to the default
   division inside a single transaction; on any failure the entire operation is rolled back.
2. **Given** the disable-divisions operation completes, **When** the list endpoint is called,
   **Then** only the default division is returned with status `ENABLED`; all others are `DISABLED`.
3. **Given** single-division mode is enabled, **When** any create/update division call is attempted,
   **Then** the API returns 423 Locked with error code `DIVISIONS_FEATURE_DISABLED`.
4. **Given** single-division mode is enabled, **Then** the workspace feature flag must prevent
   re-enabling without an explicit migration or super-admin override.
5. **Given** the disable-divisions operation is requested without the required confirmation token,
   **Then** the API returns 422 with error code `DESTRUCTIVE_CONFIRMATION_REQUIRED`.

---

### User Story 7 – Staff Multi-Division Assignment (Priority: P2)

A Backoffice administrator assigns a staff member to multiple divisions via the staff-divisions
endpoint.

**Why this priority:** Staff often span multiple academic segments (e.g., a teacher covering two
classes/grades).

**Independent Test:** Assign a staff member to two divisions, fetch their division list, confirm
both are returned. Remove one, confirm only one remains.

**Acceptance Scenarios:**

1. **Given** a staff member and two enabled divisions, **When** both divisions are assigned to the
   staff member, **Then** both entries exist in `staff_divisions` and are returned on the staff
   member's profile.
2. **Given** an attempt to add a division that is already assigned to the staff member, **Then** the
   API is idempotent and returns success (not a duplicate error).
3. **Given** an attempt to remove a staff member's only remaining division, **Then** the API returns
   422 with error code `STAFF_MINIMUM_DIVISION_REQUIRED`.
4. **Given** an attempt to assign a `DISABLED` division to a staff member, **Then** the API returns
   422 with error code `DIVISION_DISABLED`.

---

### Edge Cases

- **Student created without `division_id`:** The API rejects the student creation request with 422
  and error code `DIVISION_REQUIRED`. The database also enforces NOT NULL at the schema level.
- **Division deleted while students are assigned:** Blocked at API layer with `DIVISION_IN_USE`;
  the FK `ON DELETE RESTRICT` constraint also prevents database-level deletion.
- **All non-default divisions disabled — workspace not in single-division mode:** Valid state; the
  default division remains accessible and student/staff assignment continues to the default.
- **Concurrent disable-divisions operations:** The transaction serialization at the DB level
  prevents dual execution; the second concurrent request will receive a conflict or serialization
  error and must be retried by the client.
- **Setting `is_default = true` via the update endpoint:** The field is silently ignored; `is_default`
  is immutable after creation and can only be set during tenant bootstrap.
- **Attempting to re-enable divisions after disable-divisions:** Returns 423 Locked with
  `DIVISIONS_FEATURE_LOCKED`; re-enablement requires an explicit schema migration by an operator.

---

## Functional Requirements

- **FR-001**: The system MUST store divisions within the tenant DB in a `divisions` table with
  columns: `id`, `name`, `description`, `is_default`, `status`, `created_at`, `updated_at`.
- **FR-002**: Division `name` MUST be unique per tenant workspace (case-insensitive comparison
  enforced at API layer; unique index enforced at DB layer).
- **FR-003**: Exactly one row in `divisions` MUST have `is_default = true` at all times.
- **FR-004**: The default division MUST always have `status = ENABLED`.
- **FR-005**: `is_default` MUST be immutable after row creation (except during system migration by
  operator tooling).
- **FR-006**: The system MUST store staff-division assignments in a `staff_divisions` join table
  with columns: `staff_id`, `division_id`, `assigned_at`.
- **FR-007**: Each `(staff_id, division_id)` pair in `staff_divisions` MUST be unique
  (composite primary or unique key).
- **FR-008**: The `students` table MUST have a `division_id` column with a NOT NULL foreign key
  referencing `divisions.id`.
- **FR-009**: All student create/update operations MUST include a valid `division_id` that
  references an `ENABLED` division.
- **FR-010**: Staff members MUST be assigned to at least one division; attempts to remove the last
  division must be rejected with `STAFF_MINIMUM_DIVISION_REQUIRED`.
- **FR-011**: The disable-divisions operation MUST execute inside a single database transaction
  that reassigns all students, all staff_divisions entries, and marks all non-default divisions
  `DISABLED`.
- **FR-012**: On any failure during the disable-divisions operation the entire transaction MUST
  be rolled back — no partial state is permitted.
- **FR-013**: The disable-divisions operation MUST require an explicit destructive confirmation
  token in the request; absence MUST return 422 `DESTRUCTIVE_CONFIRMATION_REQUIRED`.
- **FR-014**: After successful disable-divisions, the workspace settings record MUST have the
  divisions feature flag set to `DISABLED` (single-division mode).
- **FR-015**: While divisions are `DISABLED` at workspace level, any attempt to create, edit, or
  re-enable non-default divisions MUST return 423 Locked with `DIVISIONS_FEATURE_DISABLED`.
- **FR-016**: Attempting to delete the default division MUST return 422 with
  `DEFAULT_DIVISION_IMMUTABLE`.
- **FR-017**: Attempting to disable the default division MUST return 422 with
  `DEFAULT_DIVISION_IMMUTABLE`.
- **FR-018**: Deleting a division that has active student or staff assignments MUST return 422
  with `DIVISION_IN_USE`.
- **FR-019**: All division API endpoints MUST apply the tenant resolver middleware and license
  middleware before any business logic.
- **FR-020**: All division list/filter queries MUST scope results to the resolved tenant's DB
  connection; no cross-tenant joins.
- **FR-021**: Assigning a `DISABLED` division to a student or staff member MUST return 422 with
  `DIVISION_DISABLED`.
- **FR-022**: The disable-divisions operation MUST produce a structured audit log entry containing:
  triggering user id, timestamp, and per-entity-type affected record count.
- **FR-023**: All API responses MUST conform to the platform error contract:
  `{ success: boolean, data: object | null, error: { code: string, message: string } | null }`.
- **FR-024**: Re-enabling the divisions feature after a disable-divisions operation MUST be blocked
  at the API layer with 423 Locked and `DIVISIONS_FEATURE_LOCKED`.
- **FR-025**: Adding a duplicate staff-division assignment (same `staff_id` + `division_id`) MUST
  be idempotent — the API returns success without creating a duplicate row.
- **FR-026**: The `GET /api/v1/backoffice/workspace/divisions` endpoint MUST support cursor-based
  pagination with optional `limit` (integer, default 20, max 100), `cursor` (opaque string — UUID
  of the last item on the previous page), and `status` (`ENABLED | DISABLED | all`, default `all`)
  query parameters.
- **FR-027**: The list endpoint response MUST use the shape `{ items, nextCursor, total }` where
  `nextCursor` is `null` when no further pages exist, and `total` reflects the full count matching
  the `status` filter independently of the current page cursor.
- **FR-028**: The `disable-divisions` rate-limiting mechanism MUST be fail-closed: if Redis is
  unavailable the request MUST be rejected with 503 Service Unavailable. Rate limiting on
  destructive endpoints must not be bypassed.

---

## Success Criteria

- **SC-001**: A workspace administrator can create, view, update, and disable any non-default
  division without error within the normal operating flow.
- **SC-002**: Any attempt to delete or disable the default division is rejected 100% of the time,
  both at the API and database layers.
- **SC-003**: Students cannot be created or updated without a valid division assignment under any
  circumstances.
- **SC-004**: Staff cannot have their last division assignment removed; the system rejects such
  attempts without partial state.
- **SC-005**: The disable-divisions operation either completes fully (all references reassigned,
  all non-defaults disabled, feature flag set) or leaves the system in its original state — no
  partial outcome.
- **SC-006**: After the disable-divisions operation, all content visibility queries that filter by
  division produce results scoped only to the default division.
- **SC-007**: The workspace can operate in single-division mode with zero user-visible errors for
  all standard academic workflows.
- **SC-008**: All division operations produce structured audit log entries within the same
  transaction as the mutation.
- **SC-009**: No division data or identifiers from tenant A are accessible from tenant B under
  any circumstances.
- **SC-010**: The disable-divisions operation rejects duplicate or concurrent invocations
  gracefully without corrupting data.

---

## Data Models

### Table: `divisions`

| Column        | Type                    | Nullable | Default             | Notes                               |
| ------------- | ----------------------- | -------- | ------------------- | ----------------------------------- |
| `id`          | UUID                    | NO       | `gen_random_uuid()` | Primary key                         |
| `name`        | VARCHAR(255)            | NO       | —                   | Unique per workspace (unique index) |
| `description` | TEXT                    | YES      | NULL                |                                     |
| `is_default`  | BOOLEAN                 | NO       | `false`             | Exactly one row must be `true`      |
| `status`      | ENUM(ENABLED, DISABLED) | NO       | `ENABLED`           | Default division always `ENABLED`   |
| `created_at`  | TIMESTAMPTZ             | NO       | `now()`             | Server-set; client time not trusted |
| `updated_at`  | TIMESTAMPTZ             | NO       | `now()`             | Server-set on every update          |

**Constraints:**

- `PRIMARY KEY (id)`
- `UNIQUE (name)` — case-insensitive enforcement at API layer; unique index at DB layer
- `CHECK (status IN ('ENABLED', 'DISABLED'))`
- Application-level invariant: exactly one row with `is_default = true`
- Application-level invariant: row with `is_default = true` must always have `status = ENABLED`

**Indexes:**

- `idx_divisions_status` on `(status)`
- `idx_divisions_is_default` on `(is_default)`

---

### Table: `staff_divisions`

| Column        | Type        | Nullable | Default | Notes                                   |
| ------------- | ----------- | -------- | ------- | --------------------------------------- |
| `staff_id`    | UUID        | NO       | —       | FK → `staff_users.id` ON DELETE CASCADE |
| `division_id` | UUID        | NO       | —       | FK → `divisions.id` ON DELETE RESTRICT  |
| `assigned_at` | TIMESTAMPTZ | NO       | `now()` | Server-set assignment timestamp         |

**Constraints:**

- `PRIMARY KEY (staff_id, division_id)` (composite)
- `FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE`
- `FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE RESTRICT`

**Indexes:**

- `idx_staff_divisions_staff_id` on `(staff_id)`
- `idx_staff_divisions_division_id` on `(division_id)`

---

### Modification: `students` table

| Column        | Type | Nullable | Notes                                                      |
| ------------- | ---- | -------- | ---------------------------------------------------------- |
| `division_id` | UUID | NO       | FK → `divisions.id` ON DELETE RESTRICT. NOT NULL enforced. |

**Constraint added:** `FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE RESTRICT`

---

## API Endpoints

### Authentication & Authorization (All Division Endpoints)

All division endpoints require:

1. Tenant resolver middleware (resolves workspace from subdomain/path slug)
2. License middleware (`ACTIVE` license required)
3. JWT validation (Backoffice staff session)
4. RBAC permission check (role must have division management permission for write operations,
   view permission for read operations)

---

### `GET /api/v1/backoffice/workspace/divisions`

List all divisions for the workspace. Supports cursor-based pagination.

**Authorization:** Backoffice staff with `can_view` on Divisions module.

**Query parameters:**

| Parameter | Type    | Required | Default | Notes                                              |
| --------- | ------- | -------- | ------- | -------------------------------------------------- |
| `limit`   | integer | No       | `20`    | Maximum items per page. Max: `100`.                |
| `cursor`  | string  | No       | —       | Opaque cursor from previous response `nextCursor`. |
| `status`  | string  | No       | `all`   | Filter by status: `ENABLED`, `DISABLED`, or `all`. |

**Response 200:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Default",
        "description": null,
        "is_default": true,
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

**Cursor implementation:** The `nextCursor` value is the `id` (UUID) of the last item returned.
Pass it as the `cursor` query parameter to fetch the next page. Results are ordered by
`created_at ASC, id ASC` for stable, deterministic pagination. `total` reflects the full count
matching the `status` filter, independent of the current page cursor.

---

### `GET /api/v1/backoffice/workspace/divisions/:id`

Retrieve a single division by ID.

**Authorization:** Backoffice staff with `can_view` on Divisions module.

**Response 200:** Single division object (same shape as list item).

**Response 404:**

```json
{
  "success": false,
  "data": null,
  "error": { "code": "DIVISION_NOT_FOUND", "message": "Division not found." }
}
```

---

### `POST /api/v1/backoffice/workspace/divisions`

Create a new division.

**Authorization:** Backoffice staff with `can_create` on Divisions module.

**Request body:**

```json
{
  "name": "Grade 10A",
  "description": "Optional description"
}
```

**Response 201:** Created division object.

**Error responses:**

- 409 `DIVISION_NAME_CONFLICT` — name already exists
- 422 `VALIDATION_ERROR` — missing or invalid fields
- 423 `DIVISIONS_FEATURE_DISABLED` — workspace in single-division mode

---

### `PUT /api/v1/backoffice/workspace/divisions/:id`

Update an existing division's name and/or description.

**Authorization:** Backoffice staff with `can_edit` on Divisions module.

**Request body:**

```json
{
  "name": "Grade 10B",
  "description": "Updated description"
}
```

**Behavior:**

- `is_default` field in request body is silently ignored.
- Default division name and description CAN be updated.

**Response 200:** Updated division object.

**Error responses:**

- 404 `DIVISION_NOT_FOUND`
- 409 `DIVISION_NAME_CONFLICT`
- 422 `VALIDATION_ERROR`
- 423 `DIVISIONS_FEATURE_DISABLED`

---

### `PATCH /api/v1/backoffice/workspace/divisions/:id/status`

Toggle division status between `ENABLED` and `DISABLED`.

**Authorization:** Backoffice staff with `can_edit` on Divisions module.

**Request body:**

```json
{
  "status": "DISABLED"
}
```

**Response 200:** Updated division object.

**Error responses:**

- 404 `DIVISION_NOT_FOUND`
- 422 `DEFAULT_DIVISION_IMMUTABLE` — attempt to disable the default division
- 422 `VALIDATION_ERROR` — `status` field is not one of `ENABLED | DISABLED`
- 423 `DIVISIONS_FEATURE_DISABLED`

---

### `DELETE /api/v1/backoffice/workspace/divisions/:id`

Hard-delete a non-default, non-referenced division.

**Authorization:** Backoffice staff with `can_delete` on Divisions module.

**Response 200:**

```json
{ "success": true, "data": { "deleted": true }, "error": null }
```

**Error responses:**

- 404 `DIVISION_NOT_FOUND`
- 422 `DEFAULT_DIVISION_IMMUTABLE` — attempt to delete the default division
- 422 `DIVISION_IN_USE` — active student or staff assignments exist
- 423 `DIVISIONS_FEATURE_DISABLED`

---

### `POST /api/v1/backoffice/workspace/divisions/disable-divisions`

Disable the divisions feature for the entire workspace. Transactionally reassigns all references to
the default division and locks single-division mode.

**Authorization:** `WORKSPACE_ADMIN` role (highest Backoffice role; no separate super-admin permission exists).

**Request body:**

```json
{
  "confirmation": "DISABLE_DIVISIONS"
}
```

The `confirmation` value must be the exact string `"DISABLE_DIVISIONS"` to proceed.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "students_reassigned": 142,
    "staff_divisions_reassigned": 38,
    "divisions_disabled": 4
  },
  "error": null
}
```

**Error responses:**

- 422 `DESTRUCTIVE_CONFIRMATION_REQUIRED` — confirmation token missing or incorrect
- 423 `DIVISIONS_FEATURE_LOCKED` — feature already locked (re-invocation blocked)

**Transaction isolation level:** `SERIALIZABLE` — required to prevent phantom reads during the
full-set reassignment of division references.

**Transactional guarantees:**

1. Reassign `students.division_id` → default division ID for all non-default-division students
2. Delete all `staff_divisions` rows where `division_id != default_id`, then execute:
   `INSERT INTO staff_divisions (staff_id, division_id, assigned_at) SELECT DISTINCT staff_id, :default_id, now() FROM deleted_rows ON CONFLICT (staff_id, division_id) DO NOTHING` — atomic, idempotent, no pre-check required
3. Set `status = DISABLED` for all non-default divisions
4. Set workspace settings `divisions_enabled = false`
5. Write structured audit log entry
6. Commit — or rollback entirely on any failure

---

### `GET /api/v1/backoffice/workspace/staff/:staff_id/divisions`

List all divisions assigned to a specific staff member.

**Authorization:** Backoffice staff with `can_view` on Staff module.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "divisions": [{ "id": "uuid", "name": "Grade 10A", "status": "ENABLED" }]
  },
  "error": null
}
```

---

### `POST /api/v1/backoffice/workspace/staff/:staff_id/divisions`

Assign a division to a staff member (idempotent).

**Authorization:** Backoffice staff with `can_edit` on Staff module.

**Request body:**

```json
{
  "division_id": "uuid"
}
```

**Response 200:** Updated list of staff's divisions.

**Error responses:**

- 404 `DIVISION_NOT_FOUND`
- 422 `DIVISION_DISABLED` — attempt to assign a disabled division
- 423 `DIVISIONS_FEATURE_DISABLED`

---

### `DELETE /api/v1/backoffice/workspace/staff/:staff_id/divisions/:division_id`

Remove a division assignment from a staff member.

**Authorization:** Backoffice staff with `can_edit` on Staff module.

**Response 200:** Updated list of staff's remaining divisions.

**Error responses:**

- 404 `DIV_STAFF_ASSIGNMENT_NOT_FOUND` — `division_id` is not in the staff member's current assignments
- 404 `DIVISION_NOT_FOUND`
- 422 `STAFF_MINIMUM_DIVISION_REQUIRED` — removing the staff member's last division

---

## Transaction Boundaries

| Operation                       | Transactional? | Notes                                                                                              |
| ------------------------------- | -------------- | -------------------------------------------------------------------------------------------------- |
| Create division                 | Yes            | Insert + potential unique constraint conflict                                                      |
| Update division                 | Yes            | Idempotent read-then-write; single row update                                                      |
| Toggle division status          | Yes            | Single row update; default-check within same transaction                                           |
| Delete division                 | Yes            | FK check + delete within single transaction                                                        |
| Assign staff division           | Yes            | Upsert on `staff_divisions`; idempotent by composite PK                                            |
| Remove staff division           | Yes            | Min-one check + delete; atomic                                                                     |
| **Disable-divisions operation** | **Yes (full)** | All reassignments, disables, and flag update in one transaction; `SERIALIZABLE` isolation required |

- All writes use server-authoritative timestamps (`now()` server-side only).
- Retry policy: client must retry on serialization failures (HTTP 503/conflict hint); server does
  not retry internally for synchronous endpoints.

---

## Error Codes Reference

| Code                                | HTTP Status | Description                                                             |
| ----------------------------------- | ----------- | ----------------------------------------------------------------------- |
| `DIVISION_NOT_FOUND`                | 404         | No division with the given ID exists in this workspace                  |
| `DIV_STAFF_ASSIGNMENT_NOT_FOUND`    | 404         | The specified division is not in the staff member's current assignments |
| `DIVISION_NAME_CONFLICT`            | 409         | A division with the same name already exists                            |
| `DEFAULT_DIVISION_IMMUTABLE`        | 422         | Cannot delete or disable the default division                           |
| `DIVISION_IN_USE`                   | 422         | Division has active student or staff assignments; cannot delete         |
| `DIVISION_DISABLED`                 | 422         | Attempt to assign an entity to a `DISABLED` division                    |
| `DIVISION_REQUIRED`                 | 422         | Student record missing required `division_id`                           |
| `STAFF_MINIMUM_DIVISION_REQUIRED`   | 422         | Removing this division would leave staff with zero divisions            |
| `DESTRUCTIVE_CONFIRMATION_REQUIRED` | 422         | Disable-divisions called without required confirmation token            |
| `DIVISIONS_FEATURE_DISABLED`        | 423         | Workspace is in single-division mode; operation not permitted           |
| `DIVISIONS_FEATURE_LOCKED`          | 423         | Divisions feature is locked; re-enable requires operator migration      |
| `VALIDATION_ERROR`                  | 422         | Request body failed field-level validation                              |

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

- All `divisions` and `staff_divisions` queries MUST use the tenant-resolved DB connection.
- No cross-tenant division data exposure at any layer.
- Tenant identity is resolved only from the subdomain/path slug — never from the request body.

### RBAC Enforcement

- Read operations (list, detail) require `can_view` on the Divisions module.
- Write operations (create, update, toggle) require `can_create` / `can_edit` on the Divisions
  module.
- Delete requires `can_delete` on the Divisions module.
- The disable-divisions operation requires the `WORKSPACE_ADMIN` role — the same as standard
  division mutating operations. No separate super-admin role is introduced. The operation is
  additionally protected by: (1) rate limit of 1 req/min/workspace via Redis (fail-closed — 503 if
  Redis unavailable), (2) required `confirmation: "DISABLE_DIVISIONS"` parameter in the request
  body, and (3) workspace must have `ACTIVE` status.
- All permission checks execute server-side via the RBAC middleware defined in STAGE_21.

### Input Validation

- Division `name` MUST be validated for max length (255 chars), must not be blank, must not contain
  control characters.
- `division_id` in student/staff payloads MUST be a valid UUID and MUST reference an existing,
  `ENABLED` division in the resolved tenant DB.
- The `confirmation` token for disable-divisions MUST be checked with constant-time string
  comparison.

### Rate Limiting

| Endpoint Category             | Limit                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Standard division CRUD        | Governed by Backoffice API rate limits (STAGE_08)                                                            |
| `disable-divisions` operation | 1 request per minute per workspace (destructive op); Redis required — fail-closed (503 if Redis unavailable) |

### Audit Logging

Every mutating division operation MUST produce a structured log entry with:

- `timestamp` (server-authoritative)
- `level`
- `service`
- `workspace_slug`
- `workspace_id`
- `user_id`
- `correlation_id`
- `event` (e.g., `DIVISION_CREATED`, `DIVISION_DISABLED`, `DIVISIONS_FEATURE_DISABLED`)
- `affected_count` (for disable-divisions only)

`console.log` is strictly forbidden. All logging via the platform structured logger (`packages/logger`).

---

## Observability Requirements

- Structured log fields: all fields listed in Audit Logging section above.
- `correlation_id` propagated from the incoming request header through all DB operations.
- `workspace_slug` and `workspace_id` included in every log line.
- The disable-divisions operation MUST log a summary of affected record counts at `INFO` level.
- All validation rejections should log at `WARN` level with the error code.
- DB transaction failures should log at `ERROR` level with full error context.
- No sensitive data (student PII, staff credentials) logged at any level.

---

## Migration Requirements

- **Migration file location:** `apps/api/src/db/tenant/migrations/`
- **Migration type:** Additive (new tables + one column addition to `students`)
- **Forward-only:** No destructive rollback; restore-from-snapshot for rollback.
- **Version bump required:** Yes — schema version incremented.
- **Backward compatibility:** During-migration, existing `students` rows must have `division_id`
  set to the workspace default division; a migration step that assigns the default must be included.

**Migration steps (ordered):**

1. Create `divisions` table with all columns, constraints, and indexes.
2. Create `staff_divisions` join table with all columns, constraints, and indexes.
3. Add `division_id` column to `students` (nullable initially).
4. Backfill `students.division_id` with the default division ID (requires default division to exist,
   per STAGE_17_TENANT_BOOTSTRAP guarantee).
5. Alter `students.division_id` to NOT NULL.
6. Add FK constraint: `students.division_id REFERENCES divisions(id) ON DELETE RESTRICT`.
7. Increment `schema_version`.

**Dependencies:**

- Default division row MUST exist (created by STAGE_17_TENANT_BOOTSTRAP) before step 4.
- This migration MUST run before STAGE_23_DEPARTMENTS migrations.

---

## Testing Requirements

| Test Type                 | Coverage Required                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| Unit tests                | Business rules: default immutability, min-one staff division, disable-divisions logic     |
| Integration tests         | All API endpoints, all error codes, all 4xx/5xx paths                                     |
| Transaction rollback test | disable-divisions partial failure → full rollback confirmed                               |
| Idempotency test          | POST staff division assignment with duplicate — returns success, no duplicate row created |
| Isolation test            | Two tenants; divisions in tenant A not visible from tenant B requests                     |
| FK constraint test        | Student without division rejected at DB layer; default division delete rejected at DB     |
| Single-division mode test | Post-disable: create/edit divisions returns 423; all entities reference default division  |
| Audit log test            | Each mutation event produces correct structured log entry                                 |
| License enforcement test  | Requests with SOFT_LOCKED → 423; ARCHIVED → 403; no license → 404                         |
| RBAC enforcement test     | Requests without division management permission → 403                                     |

---

## Assumptions

1. **Default division pre-exists:** STAGE_17_TENANT_BOOTSTRAP creates the default division row as
   part of tenant provisioning. This spec does not re-specify that bootstrap step.
2. **Workspace settings table exists:** A `workspace_settings` or equivalent table with a
   `divisions_enabled` boolean column is available (specified in STAGE_18_WORKSPACE_SETTINGS).
3. **`staff_users` table exists:** The `staff_users` table from STAGE_17/STAGE_21 is in place.
4. **`students` table exists prior to migration:** The migration must handle partial backfill
   safely if students were created before this migration runs (non-production only scenario).
5. **Re-enabling divisions after disable-divisions is explicitly out-of-scope:** Such a flow
   requires schema migrations and workflow that belong to a future operational stage.
6. **Division-based content visibility filtering** (subjects, exams, library, live sessions) is
   enforced inside those respective stages; this spec only defines the division data layer and its
   direct assignment rules.
7. **No soft-delete pattern:** Divisions use hard delete (blocked if in use) and status toggling
   for operational management. Soft-delete / `deleted_at` pattern is not applied here.

---

## Out-of-Scope

- **Division-scoped content visibility for exams, subjects, and library:** Filtering logic for
  academic content by division is defined in the stages for each content type (e.g., STAGE_23+).
- **Re-enabling divisions after disable-divisions:** Irreversible in this stage; recovery is an
  operator-level migration task outside this feature scope.
- **Division hierarchy or sub-divisions:** Divisions are flat in this stage; no parent-child
  relationships.
- **Division-specific configurations or settings:** Each division shares the workspace settings;
  per-division configuration is not in scope.
- **Student transfer between divisions:** Reassigning a student from one division to another is
  governed by the Student Management stage, not this stage.
- **Analytics or reporting by division:** Reporting stages consume the division data model but are
  outside this spec.
- **Frontoffice division awareness:** Students and staff interact with division-filtered content
  transparently; the Frontoffice layer does not expose division management UI.
- **Division-specific branding or theming:** White-label customization is workspace-level only per
  AGENTS.md contract.

---

## Compliant with Zidney Constitution v1.2.0 — No violations detected.

---

## Clarifications

### Session 2026-03-16

- Q: Staff_divisions PK collision during disable-divisions transaction → A: Use `INSERT INTO staff_divisions (staff_id, division_id, assigned_at) SELECT DISTINCT staff_id, :default_id, now() FROM deleted_rows ON CONFLICT (staff_id, division_id) DO NOTHING`. This is atomic, idempotent, requires no pre-check, and is consistent with the POST /staff/:id/divisions idempotency contract.
- Q: Transaction isolation level for disable-divisions → A: `SERIALIZABLE` isolation level is required. Rationale: the operation reads the full set of non-default divisions (to reassign FKs) and deletes them; concurrent inserts of new references to those divisions between the read and delete would create integrity violations. SERIALIZABLE prevents phantom reads and ensures the full reassignment is atomic and consistent.
- Q: RBAC permission identifier for disable-divisions → A: The disable-divisions operation requires the `WORKSPACE_ADMIN` role (same as division mutating operations). There is no additional elevated permission — it is already the highest Backoffice role. The operation is additionally protected by: (1) rate limit: 1 req/min/workspace, (2) explicit confirmation parameter in request body (`confirmation: "DISABLE_DIVISIONS"`), and (3) soft-lock check (workspace must be ACTIVE). No separate super-admin role is introduced.
- Q: PATCH /divisions/:id/status missing VALIDATION_ERROR for invalid status values → A: `VALIDATION_ERROR` (422 Unprocessable Entity) added to the PATCH /divisions/:id/status error responses. Triggered when `status` field is not one of `ENABLED | DISABLED`. Aligns with the global validation error contract.
- Q: DELETE /staff/:staff_id/divisions/:division_id — unassigned division behavior → A: If the `division_id` does not exist in the staff's current assignments, return `DIV_STAFF_ASSIGNMENT_NOT_FOUND` (404). Consistent with the existing error contract and prevents silent no-ops that could mask client bugs. Additionally, if the deletion would leave the staff member with zero divisions, reject with `STAFF_MINIMUM_DIVISION_REQUIRED` (422) — this constraint was already in the error codes table but was missing from the endpoint's documented error responses.
