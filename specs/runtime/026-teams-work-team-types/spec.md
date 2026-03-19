# Feature Specification: Teams & Work Team Types

**Feature Branch**: `spec/026-teams-work-team-types`  
**Stage**: `STAGE_26_TEAMS`  
**Phase**: `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE`  
**Created**: 2026-03-19  
**Status**: DRAFT  
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_26_TEAMS.md`

---

## Feature Overview

This stage implements **Team Types** and **Teams** as operational collaboration structures for
staff within a Zidney workspace (tenant). Teams are exclusively staff-facing organizational
entities used for internal coordination and reporting. They are structurally isolated from all
academic visibility, content filtering, exam targeting, and division/department boundaries.

**What is being built:**

- A `team_types` table per-tenant supporting name, optional description, status toggling
  (ENABLED | DISABLED), and a unique-name constraint scoped to the workspace.
- A `teams` table per-tenant with an optional foreign key to `team_types`, configurable
  `max_members` capacity, description, and status (ENABLED | DISABLED).
- A `staff_teams` join table per-tenant enabling many-to-many staff-to-team assignment with a
  composite primary key on `(staff_id, team_id)`.
- API endpoints for full Team Type CRUD (list, create, read, update, delete) and full Team CRUD
  (list, create, read, update, delete), plus staff assignment/removal — all accessible to
  authorized Backoffice staff.
- Transactional `max_members` enforcement on staff-to-team assignment using `SELECT FOR UPDATE` on
  the `teams` row, with no reliance on cached counts.
- Business rules governing name uniqueness within the workspace, team type status constraints,
  assignment blocking for DISABLED teams, and deletion guards for teams with active assignments
  or future reporting configuration references.

**Teams are NOT academic or content-scoping entities.** They do not participate in the
Division → Department → Group visibility hierarchy. They must never be used in content filtering,
exam visibility, or advertising targeting.

**Primary use cases:**

| Use Case               | How Teams Are Applied                                     |
| ---------------------- | --------------------------------------------------------- |
| Staff coordination     | Group staff members into functional operational units     |
| Reporting segmentation | Scope operational reports and dashboards by team          |
| Organizational clarity | Classify teams by Team Type for browsing and bulk actions |

**Phase & Stage mapping:** Phase 03 Backoffice Core, Academic Structure domain (operational
sub-domain). This stage depends on the staff/user table existing. It must be stable before any
downstream reporting or staff-scheduling stages reference `team_id`. Precedes
STAGE_27_SEMESTERS.

**Affected system areas:**

| Area                | Affected? | Notes                                                                            |
| ------------------- | --------- | -------------------------------------------------------------------------------- |
| Tenant Isolation    | Yes       | All tables reside exclusively in tenant DB; no shared team data across tenants   |
| License Enforcement | Yes       | License middleware mandatory for all workspace team and team type routes         |
| Attempt Engine      | No        | Teams do not participate in exam configuration, snapshots, or grading            |
| Worker              | No        | Team CRUD is synchronous; no background job required                             |
| Runtime             | No        | Teams are a Backoffice configuration concept only                                |
| Frontoffice         | No        | Teams are staff-only; students have no visibility into or interaction with teams |
| Academic Visibility | No        | Teams MUST NOT affect exam visibility, content filtering, or division boundaries |

---

## Constitutional Compliance Declaration

This specification is validated against **Zidney Constitution v1.2.0**.

| Rule                                   | Compliance                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| No cross-tenant access                 | ✓ All team tables reside exclusively within the tenant DB                                   |
| No middleware bypass                   | ✓ Tenant resolver → license middleware are mandatory before any team or team type route     |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic                                           |
| No direct DB instantiation             | ✓ All DB access originates from tenant resolver context                                     |
| No weakening of snapshot integrity     | ✓ Feature does not touch attempt snapshots                                                  |
| No weakening of transaction boundaries | ✓ All writes (including max_members check and deletion guards) are transactional            |
| No weakening of version enforcement    | ✓ Schema version bump required; migration is forward-only                                   |
| Server-authoritative time only         | ✓ All `created_at` / `updated_at` timestamps are set by the server                          |
| No console.log allowed                 | ✓ All logging via structured logger with required fields                                    |
| Academic isolation preserved           | ✓ Teams never used in content filtering, exam visibility, or division/department boundaries |

No exceptions requiring an ADR were detected for this stage.

---

## Isolation Impact Analysis

- **Database accessed:** Tenant DB only (resolved per workspace slug / subdomain context).
- **Tenant resolution:** Via existing tenant resolver middleware executed before any route handler.
- **Connection pool:** Obtained from tenant-scoped in-memory connection pool map; no global
  singleton.
- **Resolver middleware:** Mandatory — no route handler may access the DB before tenant and license
  validation.
- **Tables introduced:**
  - `team_types` — new table in tenant DB
  - `teams` — new table in tenant DB
  - `staff_teams` — new join table in tenant DB

**Confirmed:** No shared tenant data. No cross-tenant joins. No global team singleton. No
modifications to any academic visibility table (`students`, `groups`, `departments`, `divisions`,
`exams`, `advertisements`).

---

## License & Version Enforcement

- **License middleware required:** Yes — all Backoffice Team Type and Team API routes require an
  active workspace license.
- **Allowed license states:** `ACTIVE` only.
  - `SOFT_LOCKED` → 423 Locked
  - `ARCHIVED` → 403 Forbidden
  - `NOT_FOUND` → 404 Not Found
- **Limit enforcement required:** No global team-count limits in this stage; `max_members` per team
  is enforced transactionally at assignment time.
- **`schema_version` checked:** Yes — migration increments `schema_version` to the next value.
  The middleware enforces `schema_version >= MIN_SCHEMA_VERSION` semantics (minimum version, not
  exact equality). Tenants below the minimum receive HTTP 409 with error code
  `SCHEMA_VERSION_MISMATCH` before any team business logic executes. Tenants at a higher schema
  version remain forward-compatible.
- **`product_version` checked:** Yes — enforced at request boundary per Constitution.

---

## User Scenarios & Testing

### User Story 1 – Administrator Creates a Team Type (Priority: P1)

A Backoffice administrator creates a new Team Type within the workspace to classify operational
teams.

**Why this priority:** Team Types are the prerequisite classification layer for teams. Without
types, teams cannot be categorized and reporting structures cannot be organized.

**Independent Test:** Create a team type named "Academic Support" with no description, verify it
appears in the list endpoint with `status = ENABLED` and `description = null`.

**Acceptance Scenarios:**

1. **Given** an active workspace license, **When** a staff member with team type management
   permission sends a create request with a unique name and no description, **Then** the team type
   is persisted with `status = ENABLED` and `description = null`.
2. **Given** a team type with the same name already exists in the workspace, **When** a second
   create request uses the same name, **Then** the API returns 409 Conflict with error code
   `TEAM_TYPE_NAME_DUPLICATE`.
3. **Given** a create request with a missing or empty name, **Then** the API returns 422 with error
   code `VALIDATION_ERROR` and a descriptive field-level message.
4. **Given** a staff member without team type management permission, **When** they attempt to
   create a team type, **Then** the API returns 403 Forbidden.

---

### User Story 2 – Administrator Views the Team Type List (Priority: P1)

A Backoffice administrator lists all team types in the workspace with optional status filters.

**Why this priority:** Required for team creation dropdowns and organizational configuration
screens.

**Independent Test:** Seed three team types with mixed statuses, call the list endpoint without
filters, confirm all three are returned with correct fields.

**Acceptance Scenarios:**

1. **Given** multiple team types exist, **When** the list endpoint is called without filters,
   **Then** all team types are returned with `id`, `name`, `description`, `status`,
   `created_at`, and `updated_at`.
2. **Given** a `status = DISABLED` filter is applied, **Then** only disabled team types are
   returned.
3. **Given** a `status = ENABLED` filter is applied, **Then** only enabled team types are returned
   and DISABLED types are excluded from the results.
4. **Given** no team types exist, **Then** an empty `items` list is returned with `total = 0`.

---

### User Story 3 – Administrator Updates a Team Type (Priority: P2)

A Backoffice administrator updates the name, description, or status of an existing team type.

**Why this priority:** Team types evolve as organizational structures change.

**Independent Test:** Create a team type named "Operations", update its `description`, confirm the
updated value is returned on the detail endpoint.

**Acceptance Scenarios:**

1. **Given** a team type with `name = "Operations"`, **When** an admin renames it to
   "Field Operations", **Then** the change is persisted and the updated name is returned.
2. **Given** an admin attempts to rename a team type to a name already used by another type in the
   workspace, **Then** the API returns 409 with `TEAM_TYPE_NAME_DUPLICATE`.
3. **Given** an admin disables a team type (sets `status = DISABLED`), **When** an admin attempts
   to assign a new team to that type, **Then** the API returns 422 with
   `TEAM_TYPE_DISABLED`.
4. **Given** an admin disables a team type, **Then** existing teams that reference that type remain
   active and unaffected.

---

### User Story 4 – Administrator Deletes a Team Type (Priority: P3)

A Backoffice administrator deletes a team type that has no teams referencing it.

**Why this priority:** Keeps the type namespace clean; prevents orphaned classification blocks.

**Independent Test:** Create a team type with no associated teams, delete it, confirm it no longer
appears in the list endpoint.

**Acceptance Scenarios:**

1. **Given** a team type with no teams referencing it, **When** an admin sends a delete request,
   **Then** the team type is soft-deleted and returns 200 with `{ deleted: true }`.
2. **Given** a team type with at least one team referencing it, **When** an admin attempts to
   delete it, **Then** the API returns 422 with `TEAM_TYPE_HAS_TEAMS`.
3. **Given** a DISABLED team type with no teams referencing it, **When** an admin sends a delete
   request, **Then** the deletion succeeds.

---

### User Story 5 – Administrator Creates a Team (Priority: P1)

A Backoffice administrator creates a new team, optionally associating it with a team type and
setting a member capacity.

**Why this priority:** Teams are the core entity for staff operational grouping.

**Independent Test:** Create a team named "Response Team A" with no team type and no max_members,
verify it appears in the list endpoint with `status = ENABLED`, `team_type_id = null`, and
`max_members = null`.

**Acceptance Scenarios:**

1. **Given** an active workspace license, **When** a staff member with team management permission
   sends a create request with a unique name, `team_type_id = null`, and `max_members = null`,
   **Then** the team is persisted with `status = ENABLED` and all nullable fields set to `null`.
2. **Given** a team with the same name already exists in the workspace, **When** a second create
   request uses the same name, **Then** the API returns 409 Conflict with error code
   `TEAM_NAME_DUPLICATE`.
3. **Given** a create request with `team_type_id` referencing a non-existent team type, **Then**
   the API returns 422 with error code `VALIDATION_ERROR`.
4. **Given** a create request with `team_type_id` referencing a DISABLED team type, **Then** the
   API returns 422 with `TEAM_TYPE_DISABLED`.
5. **Given** a create request with `max_members = 0`, **Then** the API returns 422 with
   `VALIDATION_ERROR` — `max_members` must be a positive integer when provided.
6. **Given** a staff member without team management permission, **When** they attempt to create a
   team, **Then** the API returns 403 Forbidden.

---

### User Story 6 – Administrator Views the Team List (Priority: P1)

A Backoffice administrator lists all teams with optional status and team type filters.

**Why this priority:** Required for team assignment UIs and organizational reporting screens.

**Independent Test:** Seed three teams with mixed statuses and team type associations, call the
list endpoint without filters, confirm all three are returned with correct fields.

**Acceptance Scenarios:**

1. **Given** multiple teams exist, **When** the list endpoint is called without filters, **Then**
   all teams are returned with `id`, `name`, `team_type_id`, `max_members`, `description`,
   `status`, `created_at`, and `updated_at`.
2. **Given** a `team_type_id` filter is applied, **Then** only teams associated with that type are
   returned.
3. **Given** a `status = DISABLED` filter is applied, **Then** only disabled teams are returned.
4. **Given** a `status = ENABLED` filter is applied, **Then** only enabled teams are returned and
   DISABLED teams are excluded from the results.
5. **Given** no teams exist, **Then** an empty `items` list is returned with `total = 0`.

---

### User Story 7 – Administrator Updates a Team (Priority: P2)

A Backoffice administrator updates the name, description, `max_members`, `team_type_id`, or
`status` of an existing team.

**Why this priority:** Teams evolve over time; capacity and classification adjustments must be
supported.

**Independent Test:** Create a team named "Beta Crew", update its `max_members` and `description`,
confirm the updated values are returned on the detail endpoint.

**Acceptance Scenarios:**

1. **Given** a team with `name = "Beta Crew"`, **When** an admin renames it to "Gamma Crew",
   **Then** the change is persisted and the updated name is returned.
2. **Given** an admin attempts to rename a team to a name already used by another team in the
   workspace, **Then** the API returns 409 with `TEAM_NAME_DUPLICATE`.
3. **Given** an admin changes `max_members` to a value below the current assigned staff count,
   **Then** the update is silently allowed; existing assignments are unchanged; new assignments
   will be blocked until the enrolled count drops below the new limit.
4. **Given** an admin sets `team_type_id` to reference a DISABLED team type, **Then** the API
   returns 422 with `TEAM_TYPE_DISABLED`.
5. **Given** a `team_type_id` referencing a non-existent team type, **Then** the API returns 422
   with `VALIDATION_ERROR`.

---

### User Story 8 – Administrator Disables a Team (Priority: P2)

A Backoffice administrator disables a team. The team is marked `DISABLED` but not deleted.
Existing staff assignments remain intact; new assignments are blocked.

**Why this priority:** Supports team lifecycle management without data loss; disabled teams
preserve historical assignments while blocking new intake.

**Independent Test:** Enable a team, assign a staff member, disable the team, confirm
`status = DISABLED`, the staff member still holds the assignment, and attempting to assign a new
staff member returns 422.

**Acceptance Scenarios:**

1. **Given** a team with `status = ENABLED`, **When** an admin sets it to `DISABLED`, **Then** the
   status is updated and all existing staff assignments remain intact.
2. **Given** `status = DISABLED`, **When** an admin attempts to assign a new staff member to the
   team, **Then** the API returns 422 with `TEAM_DISABLED`.
3. **Given** a disabled team, **When** an admin re-enables it, **Then** `status` is set to
   `ENABLED` and new assignments are again permitted.
4. **Given** `status = DISABLED`, **Then** the team MUST NOT appear in any selection list or
   dropdown used for assignment.

---

### User Story 9 – Administrator Deletes a Team (Priority: P2)

A Backoffice administrator deletes a team that has no active staff assignments and no active
reporting configuration references.

**Why this priority:** Keeps the team namespace clean; prevents orphaned operational blocks.

**Independent Test:** Create a team with no assignments and no reporting references, delete it,
confirm it no longer appears in the list endpoint.

**Acceptance Scenarios:**

1. **Given** a team with no staff assignments and no reporting configuration references, **When**
   an admin sends a delete request, **Then** the team is soft-deleted and returns 200 with
   `{ deleted: true }`.
2. **Given** a team with at least one assigned staff member, **When** an admin attempts to delete
   it, **Then** the API returns 422 with `TEAM_HAS_ASSIGNMENTS`.
3. **Given** a DISABLED team that still has staff assignments, **When** an admin attempts to delete
   it, **Then** the API returns 422 with `TEAM_HAS_ASSIGNMENTS`.
4. **Given** a team referenced by a reporting configuration, **When** an admin attempts to delete
   it, **Then** the API returns 422 with `TEAM_REFERENCED_BY_REPORTING`.

---

### User Story 10 – Administrator Assigns Staff to a Team (Priority: P1)

A Backoffice administrator assigns a staff member to one or more teams. Staff may belong to
multiple teams simultaneously.

**Why this priority:** Multi-team staff membership drives operational reporting and coordination
workflows.

**Independent Test:** Assign a staff member to a team with `max_members = 2`, assign 1 more staff
member (total = 2), attempt to assign a 3rd staff member to the same team and confirm 422
`TEAM_MAX_MEMBERS_EXCEEDED`.

**Acceptance Scenarios:**

1. **Given** a staff member and an ENABLED team with capacity available, **When** the assignment
   endpoint is called, **Then** a row is inserted into `staff_teams` and the response confirms
   the assignment.
2. **Given** a team with `max_members = 1` and 1 staff member already assigned, **When** a second
   staff assignment is attempted, **Then** the API returns 422 with `TEAM_MAX_MEMBERS_EXCEEDED`.
3. **Given** `max_members = null`, **When** any number of staff members are assigned, **Then** no
   capacity rejection occurs.
4. **Given** two concurrent assignment requests for the last available slot in a team, **Then**
   exactly one succeeds; the other receives 422 with `TEAM_MAX_MEMBERS_EXCEEDED` (enforced inside
   a transaction with `SELECT FOR UPDATE` on the `teams` row).
5. **Given** a DISABLED team, **When** a staff assignment is attempted, **Then** the API returns
   422 with `TEAM_DISABLED`.
6. **Given** an attempt to assign a staff member already in the team, **Then** the API is
   idempotent and returns success without creating a duplicate row.

---

### User Story 11 – Administrator Removes Staff from a Team (Priority: P2)

A Backoffice administrator removes a staff member's assignment from a team.

**Why this priority:** Staff reassignment and team restructuring require revocable membership.

**Independent Test:** Assign a staff member to a team, call the remove endpoint, confirm the row
no longer exists in `staff_teams`.

**Acceptance Scenarios:**

1. **Given** a staff member assigned to a team, **When** the remove endpoint is called, **Then**
   the `staff_teams` row is deleted and the operation returns success.
2. **Given** a staff member not assigned to the team, **When** the remove endpoint is called,
   **Then** the API returns 404 with `TEAM_STAFF_ASSIGNMENT_NOT_FOUND`.

---

### Edge Cases

- **Team with `team_type_id = null` (unclassified):** Valid. May be assigned to any staff member.
  Unclassified teams appear in all team lists unless filtered by type.
- **DISABLED team type — existing teams unaffected:** If a team type is disabled, all teams that
  previously referenced that type remain active. The type constraint only blocks creation and
  re-assignment of teams to the disabled type.
- **Reducing `max_members` below current count:** Silently allowed. Existing assignments are
  unchanged; forward enforcement applies to new assignments only.
- **Concurrent max_members check:** The count check must execute inside the assignment transaction
  with a `SELECT FOR UPDATE` lock on the `teams` row to prevent race conditions; optimistic
  concurrency is insufficient.
- **Staff in multiple teams:** A staff member may simultaneously be assigned to multiple teams.
  There is no upper limit on the number of teams per staff member from the system perspective. The
  `max_members` constraint applies per team, not per staff member.
- **Hard delete prohibited:** Both `team_types` and `teams` must use soft delete (set `deleted_at`;
  do not physically remove the row) to preserve referential integrity and audit trails.
- **Teams and academic data:** Teams must never appear in any query predicate that filters content,
  exams, advertisements, or notifications. Any code path that introduces such a join is a
  constitutional violation.

---

## Functional Requirements

- **FR-001**: The system MUST store team types within the tenant DB in a `team_types` table with
  columns: `id`, `name`, `description`, `status`, `created_at`, `updated_at`.
- **FR-002**: Team type `name` MUST be unique within the workspace (tenant-scoped) among live
  (non-soft-deleted) records only. A partial unique index (`WHERE deleted_at IS NULL`) is enforced
  at the DB layer. Soft-deleted records do not participate in the constraint, allowing name reuse
  after deletion.
- **FR-003**: `team_types.status` MUST be one of `ENABLED` or `DISABLED`. The field is required
  and has no nullable default.
- **FR-004**: The system MUST store teams within the tenant DB in a `teams` table with columns:
  `id`, `name`, `team_type_id`, `max_members`, `description`, `status`, `created_at`,
  `updated_at`.
- **FR-005**: Team `name` MUST be unique within the workspace (tenant-scoped) among live
  (non-soft-deleted) records only. A partial unique index (`WHERE deleted_at IS NULL`) is enforced
  at the DB layer. Soft-deleted records do not participate in the constraint.
- **FR-006**: `teams.team_type_id` MUST reference an existing `team_types.id` within the same
  tenant DB when provided. When `team_type_id` is provided, the referenced team type MUST have
  `status = ENABLED` at the time of team creation or re-assignment.
- **FR-007**: `teams.max_members` MUST be a positive integer when provided. `null` means
  uncapped.
- **FR-008**: `teams.status` MUST be one of `ENABLED` or `DISABLED`. The field is required.
- **FR-009**: The system MUST store staff-team assignments in a `staff_teams` join table with
  columns: `staff_id`, `team_id`, `created_at`.
- **FR-010**: Each `(staff_id, team_id)` pair in `staff_teams` MUST be unique (composite primary
  key).
- **FR-011**: `staff_teams.team_id` MUST cascade delete when the referenced team is deleted
  (`ON DELETE CASCADE`).
- **FR-012**: `staff_teams.staff_id` MUST cascade delete when the referenced staff user is deleted
  (`ON DELETE CASCADE`).
- **FR-013**: Assigning a staff member to a team with `status = DISABLED` MUST be rejected with
  `TEAM_DISABLED`.
- **FR-014**: Staff assignment MUST execute inside a transaction in this exact order: (1) `SELECT
FOR UPDATE` on the `teams` row — unconditionally, even for idempotent re-assignments; (2) check
  if `(staff_id, team_id)` already exists in `staff_teams` — if yes, commit and return success
  (idempotent short-circuit); (3) check `teams.status = ENABLED`; (4) if `max_members` is set,
  count current assignments and reject with `TEAM_MAX_MEMBERS_EXCEEDED` if
  `count >= max_members`; (5) `INSERT INTO staff_teams ... ON CONFLICT (staff_id, team_id) DO
NOTHING` as a DB-level safety net.
- **FR-015**: `max_members` enforcement MUST be transactional; no cached counters; no client-side
  enforcement.
- **FR-016**: Staff-team assignment MUST be idempotent — re-posting the same `(staff_id, team_id)`
  pair MUST return success without creating a duplicate row.
- **FR-017**: Deleting a team with active staff assignments MUST be rejected with
  `TEAM_HAS_ASSIGNMENTS`. Reference check MUST run inside the delete transaction.
- **FR-018**: Deleting a team referenced by a reporting configuration MUST be rejected with
  `TEAM_REFERENCED_BY_REPORTING`. Reference check MUST run inside the delete transaction.
- **FR-019**: Deletion of a team MUST be transactional; all reference checks MUST run inside the
  same transaction before the delete executes.
- **FR-020**: Soft delete is the REQUIRED strategy for team deletion (set `deleted_at` timestamp;
  do not hard-delete the row). Hard delete is NOT allowed.
- **FR-021**: Deleting a team type with at least one team referencing it MUST be rejected with
  `TEAM_TYPE_HAS_TEAMS`.
- **FR-022**: Soft delete is the REQUIRED strategy for team type deletion. Hard delete is NOT
  allowed.
- **FR-023**: Assigning a new team to a DISABLED team type MUST be rejected with
  `TEAM_TYPE_DISABLED`.
- **FR-024**: All team type and team API endpoints MUST apply the tenant resolver middleware and
  license middleware before any business logic executes.
- **FR-025**: All list/filter queries for teams and team types MUST scope results to the resolved
  tenant's DB connection; no cross-tenant joins.
- **FR-026**: DISABLED teams MUST NOT appear in selection lists or dropdowns used for staff
  assignment.
- **FR-027**: DISABLED team types MUST NOT appear in selection lists or dropdowns used for team
  creation or update.
- **FR-028**: Teams MUST NOT be used in any content filtering, exam visibility, advertisement
  targeting, or notification targeting logic. This is a hard constitutional constraint.
- **FR-029**: Teams MUST NOT override or intersect with division or department boundaries.
- **FR-030**: All validations on input fields (`name`, `max_members`, FK references) MUST be
  applied at the API layer before persisting; invalid input MUST return 422 with
  `VALIDATION_ERROR` and descriptive field-level messages.
- **FR-031**: Permission codes from STAGE_21 RBAC are required as follows: `team_types:manage`
  gates all team type create/update/delete endpoints; `teams:manage` gates all team
  create/update/delete endpoints; `staff_teams:assign` gates staff assignment and removal
  endpoints. Holding `teams:manage` does NOT implicitly grant `staff_teams:assign`; both must be
  explicitly held for their respective operations. The default Backoffice admin role holds all
  three. Missing permission returns HTTP 403.
- **FR-032**: When a path-param ID targets a non-existent or soft-deleted team type, the API MUST
  return HTTP 404 with error code `TEAM_TYPE_NOT_FOUND`. When a path-param ID targets a
  non-existent or soft-deleted team, the API MUST return HTTP 404 with error code
  `TEAM_NOT_FOUND`. These codes apply to: GET detail, PUT update, and DELETE endpoints for both
  entity types, and to assignment/removal endpoints when the team ID does not resolve to a live
  record.

---

## Success Criteria

- Backoffice administrators can create, read, update, and delete Team Types within 3 minutes total
  workflow time for a 50-type workspace.
- Backoffice administrators can create, read, update, and delete Teams within 3 minutes total
  workflow time for a 100-team workspace.
- Staff assignments to teams succeed or fail with correct error messages in under 1 second
  (excluding network latency).
- Under concurrent load (10 simultaneous assignment requests to a team at capacity),
  `max_members` is never exceeded — exactly one succeeds and the rest receive clear rejection
  responses.
- Deletion of teams or team types blocked by live references is rejected 100% of the time with
  descriptive error codes.
- No team or team type management operation produces inconsistent state upon transaction rollback.
- Academic data (exams, content, student visibility) remains completely unaffected by any team
  operation.
- Zero cross-tenant team records are accessible regardless of load or configuration.

---

## Key Entities

| Entity        | Storage   | Description                                                  |
| ------------- | --------- | ------------------------------------------------------------ |
| `team_types`  | Tenant DB | Classification types for operational teams                   |
| `teams`       | Tenant DB | Operational staff grouping entity with optional type and cap |
| `staff_teams` | Tenant DB | Many-to-many join between staff users and teams              |

---

## Data Model Changes

**New tables in tenant DB:**

### `team_types`

| Column        | Type                    | Constraints                       |
| ------------- | ----------------------- | --------------------------------- |
| `id`          | UUID                    | Primary key                       |
| `name`        | varchar                 | NOT NULL, unique within workspace |
| `description` | text                    | Nullable                          |
| `status`      | enum(ENABLED, DISABLED) | NOT NULL                          |
| `created_at`  | timestamp               | NOT NULL, server-set              |
| `updated_at`  | timestamp               | NOT NULL, server-set              |
| `deleted_at`  | timestamp               | Nullable (soft delete marker)     |

Indexes: `unique(name) WHERE deleted_at IS NULL` (partial), `index(status)`

### `teams`

| Column         | Type                    | Constraints                                         |
| -------------- | ----------------------- | --------------------------------------------------- |
| `id`           | UUID                    | Primary key                                         |
| `name`         | varchar                 | NOT NULL, unique within workspace                   |
| `team_type_id` | UUID                    | Nullable, FK → `team_types.id` (ON DELETE SET NULL) |
| `max_members`  | integer                 | Nullable, must be > 0 when set                      |
| `description`  | text                    | Nullable                                            |
| `status`       | enum(ENABLED, DISABLED) | NOT NULL                                            |
| `created_at`   | timestamp               | NOT NULL, server-set                                |
| `updated_at`   | timestamp               | NOT NULL, server-set                                |
| `deleted_at`   | timestamp               | Nullable (soft delete marker)                       |

Indexes: `unique(name) WHERE deleted_at IS NULL` (partial), `index(team_type_id)`, `index(status)`

### `staff_teams`

| Column       | Type      | Constraints                                     |
| ------------ | --------- | ----------------------------------------------- |
| `staff_id`   | UUID      | PK component, FK → `users.id` ON DELETE CASCADE |
| `team_id`    | UUID      | PK component, FK → `teams.id` ON DELETE CASCADE |
| `created_at` | timestamp | NOT NULL, server-set                            |

Composite primary key: `(staff_id, team_id)`

**Migration impact:**

- One dedicated forward-only migration adding all three tables.
- `schema_version` incremented.
- No modification to existing tables.
- Backward compatibility: `team_type_id` and `max_members` are nullable; features degrading
  gracefully on tenants at an older schema version will see these tables as absent until migrated.
- Rollback = snapshot restore only (per migration governance rules).

**Version bump required:** Yes (schema_version increment via dedicated migration file).

---

## Transaction Boundaries

| Operation              | Transaction Required | Notes                                                                          |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------ |
| Create team type       | Yes                  | Unique name check + insert must be atomic                                      |
| Update team type       | Yes                  | Name uniqueness re-check + update must be atomic                               |
| Delete team type       | Yes                  | Reference check (teams count) + soft delete must be atomic                     |
| Create team            | Yes                  | Unique name check + team type status check + insert must be atomic             |
| Update team            | Yes                  | Name uniqueness re-check + type status check + update must be atomic           |
| Delete team            | Yes                  | Member count check + reporting reference check + soft delete must be atomic    |
| Assign staff to team   | Yes                  | `SELECT FOR UPDATE` on `teams` row + count check + insert must be fully atomic |
| Remove staff from team | Yes                  | Existence check + delete must be atomic                                        |

**Idempotent operations:**

- Staff-team assignment: re-posting the same `(staff_id, team_id)` pair returns success without
  creating a duplicate row. The `SELECT FOR UPDATE` lock on the `teams` row fires unconditionally
  first; the existing-assignment check executes inside the same transaction before any capacity
  check or insert. `INSERT ... ON CONFLICT (staff_id, team_id) DO NOTHING` is used as a final
  DB-level safety net.

**Failure & rollback:**

- On any transaction failure, the entire operation rolls back with no partial state.
- Concurrent `max_members` enforcement is guaranteed via `SELECT FOR UPDATE`; no optimistic
  locking or cached-count strategies are permitted.

---

## Authoritative Time Usage

- All `created_at` and `updated_at` timestamps are set by the server clock at the DB layer.
- No client-supplied timestamps are accepted or trusted.
- `deleted_at` for soft deletes is set by the server at deletion time.
- No deadline or timer logic is involved in this stage; authoritative time is used exclusively for
  record timestamps.

---

## Idempotency Strategy

| Operation            | Idempotency Key          | Unique Constraint  | Double Submit Protection |
| -------------------- | ------------------------ | ------------------ | ------------------------ |
| Create team type     | `(workspace, name)`      | Yes (DB index)     | Yes — 409 on duplicate   |
| Create team          | `(workspace, name)`      | Yes (DB index)     | Yes — 409 on duplicate   |
| Assign staff to team | `(staff_id, team_id)` PK | Yes (composite PK) | Yes — idempotent success |
| Delete team type     | `id` + reference guard   | N/A                | Idempotent (404 if gone) |
| Delete team          | `id` + reference guard   | N/A                | Idempotent (404 if gone) |

---

## Observability Requirements

All team and team type endpoints must emit structured log entries with the following fields:

| Field            | Required | Notes                                            |
| ---------------- | -------- | ------------------------------------------------ |
| `timestamp`      | Yes      | ISO 8601 server time                             |
| `level`          | Yes      | `info`, `warn`, or `error`                       |
| `service`        | Yes      | `backoffice-api`                                 |
| `workspace_slug` | Yes      | Resolved from tenant context                     |
| `workspace_id`   | Yes      | Resolved from tenant context                     |
| `user_id`        | Yes      | Staff user performing the action                 |
| `correlation_id` | Yes      | Propagated from request headers                  |
| `resource_type`  | Yes      | `team_type` or `team`                            |
| `resource_id`    | If known | UUID of the affected entity                      |
| `action`         | Yes      | `create`, `update`, `delete`, `assign`, `remove` |

Error responses must conform to the platform error contract:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "TEAM_DISABLED",
    "message": "Cannot assign staff to a disabled team."
  }
}
```

No unstructured error responses (`console.log`, plain strings) are allowed.

---

## Rate Limiting & Abuse Protection

| Endpoint Classification  | Policy                                                         |
| ------------------------ | -------------------------------------------------------------- |
| All team/type endpoints  | Auth-gated (Backoffice staff only)                             |
| Rate limit policy        | Standard Backoffice authenticated endpoint limits apply        |
| Replay attack mitigation | Idempotent assignment endpoint prevents duplicate side effects |
| Worker queue protection  | N/A — this stage has no async operations                       |

---

## Layer Separation Confirmation

| Layer       | Confirmation                                                     |
| ----------- | ---------------------------------------------------------------- |
| Frontend    | No business logic in Vue components; all validation in API layer |
| API         | No grading logic; handles routing and calls domain packages      |
| Worker      | Not involved in this stage                                       |
| MMC         | Does not access tenant DB for team data                          |
| DB creation | No new DB connections outside tenant resolver context            |

All team and team type business logic lives in domain packages. API layer only routes and invokes
domain functions. UI layer displays results from API responses.

---

## Failure Modes & Recovery

| Failure Mode                 | Handling                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB connection failure        | Request fails with 503; transaction auto-rolls back; no partial state                                                                             |
| License middleware failure   | 423/403/404 returned before any DB access; no state change                                                                                        |
| Duplicate name on create     | Transaction rolls back; 409 returned with `TEAM_NAME_DUPLICATE` or equivalent                                                                     |
| `max_members` race condition | `SELECT FOR UPDATE` prevents race; loser receives 422 `TEAM_MAX_MEMBERS_EXCEEDED`                                                                 |
| Deletion reference violation | Transaction rolls back; 422 returned with specific error code                                                                                     |
| Team or team type not found  | HTTP 404 with `TEAM_NOT_FOUND` or `TEAM_TYPE_NOT_FOUND`; no state change; applies to GET detail, PUT update, DELETE by path ID                    |
| Schema version mismatch      | HTTP 409 `SCHEMA_VERSION_MISMATCH` returned before DB access; `schema_version >= MIN_SCHEMA_VERSION` check fails; tenant must run migration first |
| Partial transaction failure  | Full rollback; client receives error; client may safely retry (idempotent endpoints)                                                              |

---

## Test Strategy

### Unit Tests

- Team type name uniqueness validation logic
- Team name uniqueness validation logic
- `max_members` validation (must be positive integer or null)
- Team type status constraint on team creation
- Soft delete marker logic

### Integration Tests

- Team type full CRUD lifecycle (create → update → list → delete)
- Team full CRUD lifecycle (create → update → list → delete)
- Staff assignment happy path (assign → list assignments → remove)
- Attempt to assign staff to DISABLED team → 422 `TEAM_DISABLED`
- Attempt to assign staff to a team at `max_members` capacity → 422 `TEAM_MAX_MEMBERS_EXCEEDED`
- Idempotent re-assignment (same `staff_id, team_id`) → 200 success, no duplicate row
- Team delete blocked by active assignment → 422 `TEAM_HAS_ASSIGNMENTS`
- Team type delete blocked by referencing team → 422 `TEAM_TYPE_HAS_TEAMS`
- Soft delete: deleted team/type does not appear in list; count queries exclude it
- License middleware: SOFT_LOCKED workspace → 423 on any team endpoint
- License middleware: ARCHIVED workspace → 403 on any team endpoint
- GET/PUT/DELETE non-existent team by ID → 404 `TEAM_NOT_FOUND`
- GET/PUT/DELETE non-existent team type by ID → 404 `TEAM_TYPE_NOT_FOUND`
- Schema version mismatch (tenant below MIN_SCHEMA_VERSION) → 409 `SCHEMA_VERSION_MISMATCH`

### Transaction Rollback Tests

- Concurrent `max_members` test: 10 goroutines simultaneously attempt to fill the last slot;
  exactly 1 succeeds; 9 receive 422 with no duplicate rows in `staff_teams`
- Deletion reference check: seed a team with 1 assignment; attempt delete in a race with the
  assignment; confirm no partial delete occurs

### Idempotency Tests

- POST same `(staff_id, team_id)` twice in sequence → second call returns success, row count = 1
- POST team type with same name twice → second call returns 409, row count = 1

### Isolation Tests

- Seed team data in tenant A; confirm tenant B cannot see tenant A's teams via any API route
- Confirm `staff_teams` rows from tenant A are not accessible via tenant B's connection pool

### Academic Isolation Regression Tests

- Confirm no team `id` appears in any query used for exam targeting, content filtering, or
  advertisement visibility after this stage is merged

---

## Explicit Non-Goals

- Teams do not affect exam visibility, content filtering, or advertisement targeting — this
  constraint is absolute and will not be revisited in this stage or any downstream stage without
  an explicit ADR.
- Teams do not create or modify division or department boundaries.
- Teams are not visible to students in the Frontoffice.
- No student-to-team assignment exists; teams are exclusively for staff.
- No notification targeting via teams in this stage.
- No audit log UI in this stage (structured logs are sufficient).
- No team membership bulk import feature in this stage.
- No team hierarchy (parent/child teams) in this stage.
- No pagination cursor optimization in this stage (standard offset/limit is acceptable).

---

## Assumptions

- The `users` (staff) table already exists in the tenant DB with a stable UUID primary key.
- The `departments` and `divisions` tables are stable (from STAGE_22 and STAGE_23) and are not
  modified by this stage.
- Reporting configuration tables do not yet exist in this stage; the `TEAM_REFERENCED_BY_REPORTING`
  error code is implemented as a forward-proof reference check that returns false (no block) until
  reporting tables are introduced in a later stage.
- Backoffice role-permission system (STAGE_21) is stable and provides the permission gate for
  team management operations.
- Soft delete convention (`deleted_at` timestamp column) is consistent with other tenant entities
  in the platform.
- The platform's version enforcement and license middleware are stable from their respective
  foundational stages.

---

## Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.

---

## Clarifications

### Session 2026-03-19

- Q: What are the canonical RBAC permission codes for team type management, team management, and
  staff assignment — and how are they differentiated in STAGE_21?
  → A: Three distinct codes: `team_types:manage` covers all team type CRUD; `teams:manage` covers
  all team CRUD; `staff_teams:assign` covers assignment and removal of staff to/from teams.
  Holding `teams:manage` does NOT implicitly grant `staff_teams:assign`. The default Backoffice
  admin role holds all three; team coordinators may hold `staff_teams:assign` alone. Codified as
  FR-031.

- Q: In the idempotent staff-assignment flow, does the `SELECT FOR UPDATE` on the `teams` row fire
  unconditionally or only after a non-locking pre-check for an existing assignment?
  → A: Unconditionally first. Mandated transaction order: (1) `SELECT FOR UPDATE` on `teams`;
  (2) check composite PK for existing assignment — if found, commit and return success (idempotent
  short-circuit); (3) check team status; (4) enforce `max_members`; (5) `INSERT ... ON CONFLICT
DO NOTHING`. This eliminates the TOCTOU risk of a separate non-locking pre-check path entirely.
  Codified in FR-014 and the idempotent operations note.

- Q: Do the `UNIQUE` indexes on `team_types.name` and `teams.name` include soft-deleted rows,
  permanently blocking name reuse after soft-deletion?
  → A: No. Both indexes must be partial (`WHERE deleted_at IS NULL`), scoping uniqueness to live
  records only. Soft-deleted records do not block re-creation under the same name. The 409 error
  codes (`TEAM_TYPE_NAME_DUPLICATE`, `TEAM_NAME_DUPLICATE`) fire only when a live row with that
  name already exists. Codified in FR-002, FR-005, and the Data Model index definitions.

- Q: What is the exact `schema_version` enforcement semantic — `>= MIN_SCHEMA_VERSION` or exact
  equality — and what error code is returned on a mismatch?
  → A: Minimum-version semantics (`>= MIN_SCHEMA_VERSION`). The migration for this stage
  increments `schema_version`; the middleware constant is updated to require at least that version
  before team/team-type endpoints are accessible. Tenants below the minimum receive HTTP 409 with
  `SCHEMA_VERSION_MISMATCH` before any business logic executes. Tenants at a higher version are
  forward-compatible and unaffected. Codified in License & Version Enforcement and Failure Modes.

- Q: Are dedicated `TEAM_NOT_FOUND` and `TEAM_TYPE_NOT_FOUND` error codes defined for
  GET/PUT/DELETE-by-ID operations when the path-param resource does not exist or is soft-deleted?
  → A: These were missing. Both codes are now added as FR-032: `TEAM_TYPE_NOT_FOUND` (HTTP 404)
  applies to GET/PUT/DELETE team type by ID path param; `TEAM_NOT_FOUND` (HTTP 404) applies to
  GET/PUT/DELETE team by path ID and to assignment/removal endpoints when `team_id` does not
  resolve to a live record. Codified in FR-032, Failure Modes, and Integration Tests.
