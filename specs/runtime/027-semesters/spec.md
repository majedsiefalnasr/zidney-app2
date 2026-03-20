# Feature Specification: Semesters

**Feature Branch**: `spec/027-semesters`
**Stage**: `STAGE_27_SEMESTERS`
**Phase**: `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE`
**Created**: 2026-03-20
**Status**: DRAFT
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_27_SEMESTERS.md`

---

## Feature Overview

This stage implements **Semester** as an academic time-segmentation entity within a Zidney
workspace (tenant). Semesters provide a temporal classification layer that allows Backoffice
administrators to group students, subjects, and downstream content (exams, library, lives) by
academic period.

**What is being built:**

- A `semesters` table per-tenant supporting name (unique-per-workspace), optional description,
  optional `start_date` / `end_date` window with server-validated ordering, status
  (`ENABLED | DISABLED`), and soft-delete capability.
- A nullable `semester_id` foreign key column added to the `students` table, enabling optional
  one-semester-per-student classification.
- A nullable `semester_id` foreign key column added to the `subjects` table, enabling optional
  semester-scoped subject grouping.
- API endpoints for full Semester CRUD (list, create, read, update, delete) accessible to
  authorized Backoffice staff.
- Business rules governing unique name enforcement, date-window validation, status-gated assignment
  blocking, and transactionally safe deletion guards.

**Semesters are a supplementary academic time-segmentation entity.** Division remains the primary
academic isolation boundary. Semester scope never overrides and never replaces division-based
access control. All division-first filtering rules remain unchanged.

**Primary use cases:**

| Use Case                 | How Semesters Are Applied                                    |
| ------------------------ | ------------------------------------------------------------ |
| Academic period grouping | Tag students and subjects to a named semester window         |
| Subject scoping          | Filter available subjects by semester in configuration views |
| Exam / content scoping   | Future modules filter by `semester_id` after division check  |
| Reporting segmentation   | Segment operational reports by semester                      |
| Student enrollment class | Classify students by enrollment semester for analytics       |

**Phase & Stage mapping:** Phase 03 Backoffice Core, Academic Structure domain. This stage follows
STAGE_26_TEAMS and precedes STAGE_28_SUBJECTS. It depends on the `students` and `subjects` tables
existing. All downstream stages that optionally reference `semester_id` must remain backward
compatible (nullable FK).

**Affected system areas:**

| Area                | Affected? | Notes                                                                               |
| ------------------- | --------- | ----------------------------------------------------------------------------------- |
| Tenant Isolation    | Yes       | Semesters reside exclusively in tenant DB; no shared semester data across tenants   |
| License Enforcement | Yes       | License middleware mandatory for all workspace semester routes                      |
| Attempt Engine      | No        | Semester FK on subjects/exams is informational; snapshots are unaffected            |
| Worker              | No        | Semester CRUD is synchronous; no background processing required                     |
| Runtime             | No        | Semesters are a Backoffice configuration concept                                    |
| Frontoffice         | No        | Frontoffice inherits semester context indirectly via student record; no direct CRUD |
| Academic Visibility | Yes       | `semester_id` FK added to `students` and `subjects`; division boundary preserved    |

---

## Constitutional Compliance Declaration

This specification is validated against **Zidney Constitution v1.2.0**.

| Rule                                   | Compliance                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| No cross-tenant access                 | ✓ All semester tables reside exclusively within the tenant DB                                  |
| No middleware bypass                   | ✓ Tenant resolver → license middleware mandatory before any semester route                     |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic                                              |
| No direct DB instantiation             | ✓ All DB access originates from tenant resolver context                                        |
| No weakening of snapshot integrity     | ✓ Feature does not touch attempt snapshots                                                     |
| No weakening of transaction boundaries | ✓ All writes (deletion guards, FK additions) are transactional                                 |
| No weakening of version enforcement    | ✓ Schema version incremented; migration is forward-only                                        |
| Server-authoritative time only         | ✓ `created_at` / `updated_at` set by server; `start_date` / `end_date` are calendar dates only |
| No console.log allowed                 | ✓ All logging via structured logger with required fields                                       |
| Division isolation preserved           | ✓ Division-first filtering always precedes any semester filter                                 |

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
  - `semesters` — new table in tenant DB
- **Tables modified:**
  - `students` — nullable `semester_id FK (ON DELETE RESTRICT)` column added
  - `subjects` — **not modified in this stage** (clarified); `semester_id` column and FK are added
    by STAGE_28_SUBJECTS when the `subjects` table is created

**Confirmed:** No shared tenant data. No cross-tenant joins. No global semester singleton. No
modifications to division, department, group, exam, or content visibility tables.

---

## License & Version Enforcement

- **License middleware required:** Yes — all Backoffice Semester API routes require an active
  workspace license.
- **Allowed license states:** `ACTIVE` only.
  - `SOFT_LOCKED` → 423 Locked
  - `ARCHIVED` → 403 Forbidden
  - `NOT_FOUND` → 404 Not Found
- **Limit enforcement required:** No global semester-count limits in this stage.
- **`schema_version` checked:** Yes — migration increments `schema_version` to the next value. The
  middleware enforces `schema_version >= MIN_SCHEMA_VERSION` semantics. Tenants below the minimum
  receive HTTP 409 with error code `SCHEMA_VERSION_MISMATCH` before any semester business logic
  executes. Tenants at a higher schema version remain forward-compatible.
- **`product_version` checked:** Yes — enforced at request boundary per Constitution.

---

## User Scenarios & Testing

### User Story 1 – Administrator Creates a Semester (Priority: P1)

A Backoffice administrator creates a new semester within the workspace to define an academic time
period.

**Why this priority:** Semester creation is the prerequisite for any student or subject semester
assignment. No filtering or enrollment classification is possible until at least one semester
exists.

**Independent Test:** Create a semester named "Fall 2026" with no dates and no description, verify
it appears in the list endpoint with `status = ENABLED`, `description = null`, `start_date = null`,
`end_date = null`.

**Acceptance Scenarios:**

1. **Given** an active workspace license, **When** a staff member with semester management
   permission sends a create request with a unique name, no dates, and no description, **Then** the
   semester is persisted with `status = ENABLED` and all optional fields set to `null`.
2. **Given** a semester with the same name already exists in the workspace, **When** a second
   create request uses the same name, **Then** the API returns 409 Conflict with error code
   `SEMESTER_NAME_DUPLICATE`.
3. **Given** a create request with a missing or empty name, **Then** the API returns 422 with error
   code `VALIDATION_ERROR` and a descriptive field-level message.
4. **Given** a create request with `start_date = "2026-01-01"` and `end_date = "2025-12-31"`,
   **Then** the API returns 422 with `SEMESTER_DATE_RANGE_INVALID` because `end_date` is before
   `start_date`.
5. **Given** a create request with only `start_date` and no `end_date`, **Then** the semester is
   created successfully; no date-range validation is applied when only one date is provided.
6. **Given** a create request with only `end_date` and no `start_date`, **Then** the semester is
   created successfully.
7. **Given** a staff member without semester management permission, **When** they attempt to create
   a semester, **Then** the API returns 403 Forbidden.

---

### User Story 2 – Administrator Views the Semester List (Priority: P1)

A Backoffice administrator lists all semesters in the workspace with optional status and date
filters.

**Why this priority:** Required for semester assignment dropdowns, configuration screens, and
reporting dashboards.

**Independent Test:** Seed three semesters with mixed statuses and date windows, call the list
endpoint without filters, confirm all three are returned with all expected fields.

**Acceptance Scenarios:**

1. **Given** multiple semesters exist, **When** the list endpoint is called without filters,
   **Then** all semesters are returned with `id`, `name`, `description`, `start_date`, `end_date`,
   `status`, `created_at`, and `updated_at`.
2. **Given** a `status = DISABLED` filter, **Then** only disabled semesters are returned.
3. **Given** a `status = ENABLED` filter, **Then** only enabled semesters are returned and disabled
   semesters are excluded.
4. **Given** no semesters exist, **Then** an empty `items` list is returned with `total = 0`.
5. **Given** a `search` query parameter, **Then** only semesters whose name contains the query
   (case-insensitive) are returned.

---

### User Story 3 – Administrator Reads Semester Detail (Priority: P2)

A Backoffice administrator retrieves the full detail of a single semester by its ID.

**Why this priority:** Required for confirmation screens before update or delete operations.

**Independent Test:** Create a semester, retrieve it by its ID, confirm all fields match the
created values.

**Acceptance Scenarios:**

1. **Given** a semester with a valid ID, **When** an admin sends a detail request, **Then** the
   full semester object is returned with all fields.
2. **Given** a non-existent ID, **Then** the API returns 404 with `SEMESTER_NOT_FOUND`.
3. **Given** a valid semester ID belonging to a different tenant, **Then** the API returns 404
   (not 403, to avoid information leakage).

---

### User Story 4 – Administrator Updates a Semester (Priority: P2)

A Backoffice administrator updates the name, description, dates, or status of an existing semester.

**Why this priority:** Semester names and date windows must be correctable as academic calendars
evolve.

**Independent Test:** Create a semester named "Spring 2026", update its `description` and
`end_date`, confirm the updated values are returned on the detail endpoint.

**Acceptance Scenarios:**

1. **Given** a semester with `name = "Spring 2026"`, **When** an admin renames it to
   "Spring Term 2026", **Then** the change is persisted and the updated name is returned.
2. **Given** an admin attempts to rename a semester to a name already used by another semester in
   the workspace, **Then** the API returns 409 with `SEMESTER_NAME_DUPLICATE`.
3. **Given** an admin updates `end_date` to a date before the existing `start_date`, **Then** the
   API returns 422 with `SEMESTER_DATE_RANGE_INVALID`.
4. **Given** an admin sets `status = DISABLED`, **Then** the semester is disabled; existing
   student and subject assignments remain valid and are unaffected.
5. **Given** an admin re-enables a DISABLED semester (`status = ENABLED`), **Then** the semester
   becomes available for new assignments again.
6. **Given** a partial update payload (`PATCH`), **Then** only the provided fields are updated; all
   other fields remain unchanged.

---

### User Story 5 – Administrator Deletes a Semester (Priority: P3)

A Backoffice administrator deletes a semester that is not currently referenced by any student,
subject, exam, or content entity.

**Why this priority:** Keeps the semester namespace clean; prevents orphaned time-period
classifications.

**Independent Test:** Create a semester with no student or subject assignments, delete it, confirm
it no longer appears in the list endpoint.

**Acceptance Scenarios:**

1. **Given** a semester with no students, subjects, exams, or content entities referencing it,
   **When** an admin sends a delete request, **Then** the semester is soft-deleted and the API
   returns 200 with `{ "deleted": true }`.
2. **Given** a semester referenced by at least one student, **When** an admin attempts to delete
   it, **Then** the API returns 422 with `SEMESTER_HAS_STUDENTS`.
3. **Given** a semester referenced by at least one subject, **When** an admin attempts to delete
   it, **Then** the API returns 422 with `SEMESTER_HAS_SUBJECTS`.
4. **Given** a DISABLED semester with no references, **When** an admin sends a delete request,
   **Then** the deletion succeeds and the API returns 200 with `{ "deleted": true }`.
5. **Given** an admin attempts to delete a semester that has already been soft-deleted, **Then** the
   API returns 404 with `SEMESTER_NOT_FOUND`.
6. **Given** a non-existent ID, **Then** the API returns 404 with `SEMESTER_NOT_FOUND`.

---

### User Story 6 – Assign a Student to a Semester (Priority: P2)

A Backoffice administrator assigns a student to an ENABLED semester.

**Why this priority:** Student-semester classification drives enrollment analytics and downstream
exam targeting.

**Independent Test:** Create an ENABLED semester and a student, assign the student to the
semester, verify `semester_id` is persisted on the student record.

**Acceptance Scenarios:**

1. **Given** an ENABLED semester and a student with no current semester, **When** an admin assigns
   the semester to the student, **Then** `semester_id` is persisted on the student record.
2. **Given** a DISABLED semester, **When** an admin attempts to assign it to a student, **Then**
   the API returns 422 with `SEMESTER_DISABLED`.
3. **Given** a student already assigned to a semester, **When** an admin assigns a different
   ENABLED semester, **Then** the assignment is updated and the previous reference is replaced.
4. **Given** a non-existent semester ID is passed as the assignment, **Then** the API returns 422
   with `SEMESTER_NOT_FOUND`.
5. **Given** an admin clears `semester_id` by setting it to `null`, **Then** the student becomes
   unassigned from any semester.

---

### User Story 7 – Assign a Subject to a Semester (Priority: P2)

A Backoffice administrator optionally associates a subject with a semester for scoping purposes.

**Why this priority:** Subject-semester grouping enables semester-filtered content views and
academic reporting.

**Independent Test:** Create an ENABLED semester and a subject, associate the subject with the
semester, verify `semester_id` is persisted on the subject record.

**Acceptance Scenarios:**

1. **Given** an ENABLED semester and a subject with no current semester, **When** a subject-update
   request sets `semester_id`, **Then** the association is persisted on the subject record.
2. **Given** a DISABLED semester ID is provided in a subject update, **Then** the API returns 422
   with `SEMESTER_DISABLED`.
3. **Given** a non-existent semester ID is provided, **Then** the API returns 422 with
   `SEMESTER_NOT_FOUND`.
4. **Given** `semester_id = null` is sent in a subject update, **Then** the subject is
   disassociated from any semester.

---

## Functional Requirements

### FR-01: Semester CRUD

- The system must support Create, Read (list + detail), Update (partial via PATCH), and Delete
  operations for semesters — all scoped to the workspace tenant DB.
- All operations require authentication and Backoffice role with semester management permission.

### FR-02: Unique Name Enforcement

- `name` must be unique within a workspace (case-sensitive match against existing non-deleted
  semester names).
- Uniqueness is enforced transactionally via database unique constraint on `(workspace, name)` or
  equivalent per-tenant scoping.
- Violations return HTTP 409 with code `SEMESTER_NAME_DUPLICATE`.

### FR-03: Date-Range Validation

- If both `start_date` and `end_date` are provided and non-null, the server must validate that
  `end_date >= start_date`.
- Validation runs on both Create and Update operations.
- Violation returns HTTP 422 with code `SEMESTER_DATE_RANGE_INVALID`.
- If only one of the two dates is provided, no cross-field validation is applied.

### FR-04: Status Gating

- ENABLED: Semester is available for assignment to students and subjects.
- DISABLED: Semester cannot be assigned to new students or subjects. Existing references remain
  valid. A DISABLED semester can still be read, listed, or updated.
- Status transitions (ENABLED → DISABLED and DISABLED → ENABLED) are allowed at any time via
  PATCH.

### FR-05: Soft Deletion

- Semester deletion is implemented as a soft delete (e.g., `deleted_at` timestamp or `deleted`
  boolean column).
- Soft-deleted semesters do not appear in list or detail responses.
- Hard delete is not allowed.

### FR-06: Deletion Guards

- Deletion (soft) is refused if the semester is referenced by any of the following:
  - `students.semester_id`
  - `subjects.semester_id`
  - Any future exam or content entity with `semester_id` (enforced once those tables exist)
- Referential check is performed transactionally inside a single DB transaction.
- Violation returns HTTP 422 with a code indicating which entity type holds the reference
  (e.g., `SEMESTER_HAS_STUDENTS`, `SEMESTER_HAS_SUBJECTS`).

### FR-07: Student Semester Assignment

- `students.semester_id` is a nullable FK to `semesters.id`.
- Assignment to an ENABLED semester succeeds; assignment to a DISABLED semester is rejected.
- A student can be reassigned to a different semester or unassigned (set to null).
- Student assignment is managed via student update endpoints (not a dedicated semester assignment
  endpoint); validation of `semester_id` is injected into the existing student write path.

### FR-08: Subject Semester Association

- `subjects.semester_id` is a nullable FK to `semesters.id`.
- Same ENABLED-only assignment rule applies.
- Subject association is managed via subject write endpoints; validation of `semester_id` is
  injected into the subject write path.

### FR-09: Division Boundary Supremacy

- Division-based access control must always execute before any semester-based filter.
- Semester filtering is a supplementary context; it cannot bypass or override division scope.
- This rule is enforced in every query path that combines division and semester constraints.

### FR-10: Listing and Filtering

- The semester list endpoint must support:
  - `status` filter (`ENABLED | DISABLED`)
  - `search` query for name substring match (case-insensitive)
  - Pagination via `page` and `limit` parameters
  - Results ordered by `name` ascending by default
- `limit` values outside the inclusive range 1–100 are rejected with HTTP 422 `VALIDATION_ERROR`.
  Silent clamping is not applied; the client must send a valid value.

---

## Data Model

### New Table: `semesters` (Tenant DB)

| Column        | Type                     | Nullable | Notes                                  |
| ------------- | ------------------------ | -------- | -------------------------------------- |
| `id`          | UUID (PK)                | No       | Server-generated                       |
| `name`        | varchar(255)             | No       | Unique within workspace (unique index) |
| `description` | text                     | Yes      | Optional long-form description         |
| `start_date`  | date                     | Yes      | Optional start of semester window      |
| `end_date`    | date                     | Yes      | Optional end of semester window        |
| `status`      | enum(ENABLED, DISABLED)  | No       | Default ENABLED                        |
| `deleted_at`  | timestamp with time zone | Yes      | Null = active; non-null = soft-deleted |
| `created_at`  | timestamp with time zone | No       | Server-set on insert                   |
| `updated_at`  | timestamp with time zone | No       | Server-set on insert and update        |

**Indexes:**

| Index                        | Type   | Purpose                               |
| ---------------------------- | ------ | ------------------------------------- |
| `unique(name)` where deleted | Unique | Enforce unique name among active rows |
| `index(status)`              | B-tree | Status filter performance             |
| `index(start_date)`          | B-tree | Date-based queries                    |
| `index(deleted_at)`          | B-tree | Exclude soft-deleted rows efficiently |

> **Note on unique constraint:** Because soft delete is used, the unique name constraint must be
> defined as a partial unique index on `name` WHERE `deleted_at IS NULL`, or else ensured
> programmatically with a SELECT FOR UPDATE check before insert/update.

---

### Modified Table: `students` (Tenant DB)

| Column        | Change | Type                     | Nullable | Notes                                                                                     |
| ------------- | ------ | ------------------------ | -------- | ----------------------------------------------------------------------------------------- |
| `semester_id` | ADD    | UUID (FK → semesters.id) | Yes      | Optional; ON DELETE RESTRICT — DB-level safety net; hard delete is forbidden by app logic |

---

### Modified Table: `subjects` (Tenant DB)

> **Delegation to STAGE_28_SUBJECTS (Clarified):** Because `subjects` does not exist at the time
> this migration runs, adding `semester_id` here would require conditional DDL (`ADD COLUMN IF
EXISTS`) against a non-existent table — which is invalid. The `subjects.semester_id` column
> **and** its FK constraint are therefore the sole responsibility of STAGE_28_SUBJECTS. This
> migration does not touch the `subjects` table at all. When STAGE_28_SUBJECTS creates the
> `subjects` table it must include `semester_id UUID REFERENCES semesters(id) ON DELETE RESTRICT`
> in the CREATE TABLE statement, making the FK constraint immediately present without a separate
> ALTER TABLE.

---

### Migration Requirements

- One forward-only migration file for this stage.
- Creates `semesters` table.
- Adds `semester_id UUID REFERENCES semesters(id) ON DELETE RESTRICT` to `students` (nullable FK).
- Does **not** modify the `subjects` table; `semester_id` column and FK are entirely the
  responsibility of STAGE_28_SUBJECTS (clarified — subjects table does not exist at migration time).
- Increments `schema_version`.
- Reversible only via snapshot restore — no down migration.

---

## API Endpoints

All endpoints require:

- Authentication (Backoffice staff session)
- Tenant resolution via middleware
- License validation middleware (ACTIVE license required)
- Structured error response envelope:
  `{ "success": boolean, "data": object | null, "error": { "code": string, "message": string } | null }`

### Semester CRUD

| Method   | Path             | Description                | Permission         |
| -------- | ---------------- | -------------------------- | ------------------ |
| `GET`    | `/semesters`     | List semesters (paginated) | `semesters:read`   |
| `POST`   | `/semesters`     | Create a semester          | `semesters:write`  |
| `GET`    | `/semesters/:id` | Get semester detail        | `semesters:read`   |
| `PATCH`  | `/semesters/:id` | Update semester (partial)  | `semesters:write`  |
| `DELETE` | `/semesters/:id` | Soft-delete semester       | `semesters:delete` |

---

### GET /semesters — List Semesters

**Query parameters:**

| Parameter | Type              | Required | Description                            |
| --------- | ----------------- | -------- | -------------------------------------- |
| `status`  | ENABLED\|DISABLED | No       | Filter by status                       |
| `search`  | string            | No       | Case-insensitive name substring filter |
| `page`    | integer ≥ 1       | No       | Pagination page (default: 1)           |
| `limit`   | integer 1–100     | No       | Items per page (default: 20)           |

**Success response (200):**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Fall 2026",
        "description": null,
        "start_date": "2026-09-01",
        "end_date": "2027-01-31",
        "status": "ENABLED",
        "created_at": "2026-03-20T00:00:00.000Z",
        "updated_at": "2026-03-20T00:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  },
  "error": null
}
```

---

### POST /semesters — Create Semester

**Request body:**

```json
{
  "name": "Fall 2026",
  "description": "First semester of academic year 2026-2027",
  "start_date": "2026-09-01",
  "end_date": "2027-01-31"
}
```

| Field         | Type   | Required | Validation                                            |
| ------------- | ------ | -------- | ----------------------------------------------------- |
| `name`        | string | Yes      | 1–255 characters; unique per workspace                |
| `description` | string | No       | Max 5000 characters                                   |
| `start_date`  | date   | No       | ISO 8601 date (`YYYY-MM-DD`)                          |
| `end_date`    | date   | No       | ISO 8601 date; if both dates present, must be ≥ start |

**Success response (201):** Full semester object.

**Error codes:**

| Code                          | HTTP | Trigger                                            |
| ----------------------------- | ---- | -------------------------------------------------- |
| `SEMESTER_NAME_DUPLICATE`     | 409  | Name already exists in workspace (active semester) |
| `SEMESTER_DATE_RANGE_INVALID` | 422  | `end_date` < `start_date` when both are present    |
| `VALIDATION_ERROR`            | 422  | Missing required fields or type violations         |
| `UNAUTHORIZED`                | 401  | No valid session                                   |
| `FORBIDDEN`                   | 403  | Missing `semesters:write` permission               |
| `SCHEMA_VERSION_MISMATCH`     | 409  | Tenant schema below minimum required version       |

---

### GET /semesters/:id — Semester Detail

**Success response (200):** Full semester object.

**Error codes:**

| Code                 | HTTP | Trigger                            |
| -------------------- | ---- | ---------------------------------- |
| `SEMESTER_NOT_FOUND` | 404  | Semester not found or soft-deleted |
| `UNAUTHORIZED`       | 401  | No valid session                   |

---

### PATCH /semesters/:id — Update Semester

**Request body:** Any combination of updatable fields (partial update).

| Field         | Type                | Validation                                         |
| ------------- | ------------------- | -------------------------------------------------- |
| `name`        | string              | 1–255 chars; unique in workspace (excluding self)  |
| `description` | string \| null      | Max 5000 chars; null clears the value              |
| `start_date`  | date \| null        | ISO 8601; null clears value                        |
| `end_date`    | date \| null        | ISO 8601; null clears value; if both → end ≥ start |
| `status`      | ENABLED \| DISABLED | Status transition allowed at any time              |

**Success response (200):** Updated full semester object.

**Error codes:**

| Code                          | HTTP | Trigger                                             |
| ----------------------------- | ---- | --------------------------------------------------- |
| `SEMESTER_NOT_FOUND`          | 404  | Semester not found or soft-deleted                  |
| `SEMESTER_NAME_DUPLICATE`     | 409  | New name clashes with another active semester       |
| `SEMESTER_DATE_RANGE_INVALID` | 422  | Resulting date window has `end_date` < `start_date` |
| `VALIDATION_ERROR`            | 422  | Invalid field types or values                       |

---

### DELETE /semesters/:id — Soft-Delete Semester

**Success response (200):**

```json
{ "success": true, "data": { "deleted": true }, "error": null }
```

**Error codes:**

| Code                    | HTTP | Trigger                                      |
| ----------------------- | ---- | -------------------------------------------- |
| `SEMESTER_NOT_FOUND`    | 404  | Semester not found or already soft-deleted   |
| `SEMESTER_HAS_STUDENTS` | 422  | One or more students reference this semester |
| `SEMESTER_HAS_SUBJECTS` | 422  | One or more subjects reference this semester |
| `FORBIDDEN`             | 403  | Missing `semesters:delete` permission        |

---

## Transaction Boundaries

| Operation                           | Transaction Required | Notes                                                                                                                                                                                                             |
| ----------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create semester                     | Yes                  | Unique-name check + insert must be atomic (SELECT FOR UPDATE or deferred constraint)                                                                                                                              |
| Update semester                     | Yes                  | Name uniqueness re-check + update must be atomic                                                                                                                                                                  |
| Soft-delete semester                | Yes                  | Transaction opens with `SELECT ... FOR UPDATE` on the semester row, then referential guard queries, then sets `deleted_at`; second concurrent request waits for lock, reads `deleted_at IS NOT NULL`, returns 404 |
| Student semester assignment update  | Yes                  | Transaction opens with `SELECT status FROM semesters WHERE id = ? FOR UPDATE`; ENABLED check + FK update must be atomic; prevents TOCTOU with concurrent status change                                            |
| Subject semester association update | Yes                  | Same `SELECT ... FOR UPDATE` pattern on semester row as student assignment; ENABLED check + FK update atomic                                                                                                      |

**Idempotency:**

| Operation               | Idempotent? | Strategy                                                          |
| ----------------------- | ----------- | ----------------------------------------------------------------- |
| Create semester         | No          | Duplicate name rejected with 409; no retry idempotency key needed |
| Update semester         | Yes         | PATCH with same payload is a no-op; no state change               |
| Soft-delete semester    | No          | Second delete on same ID returns 404 (already deleted)            |
| Student assignment      | Yes         | Setting same `semester_id` twice is a no-op                       |
| Clear assignment (null) | Yes         | Setting `semester_id = null` twice is a no-op                     |

---

## Authoritative Time Usage

- `created_at` and `updated_at` are set exclusively by the server using the DB server clock
  (`NOW()` or equivalent).
- `start_date` and `end_date` are calendar date values provided by the Backoffice user representing
  the academic calendar. They are **not used as server deadlines** and are not validated against
  current server time. Their ordering relative to each other is validated (`end_date >= start_date`)
  but their absolute values are not restricted.
- Client-supplied timestamps are never trusted for `created_at` or `updated_at`.
- `deleted_at` is set by the server at soft-delete time.

---

## Observability Requirements

All semester API handlers must emit structured logs with the following fields:

| Field            | Required | Value                                                  |
| ---------------- | -------- | ------------------------------------------------------ |
| `timestamp`      | Yes      | ISO 8601 server time                                   |
| `level`          | Yes      | `info` / `warn` / `error`                              |
| `service`        | Yes      | `api`                                                  |
| `workspace_slug` | Yes      | Resolved from tenant context                           |
| `workspace_id`   | Yes      | Resolved from tenant context                           |
| `user_id`        | Yes      | Authenticated staff user ID (when available)           |
| `correlation_id` | Yes      | Propagated from request header or generated at ingress |
| `attempt_id`     | No       | Not applicable for this stage                          |
| `event`          | Yes      | Descriptive event name, e.g., `semester.created`       |
| `semester_id`    | Yes      | For all events after creation                          |

`console.log` is strictly forbidden. All logging must use the shared structured logger package.

---

## Rate Limiting & Abuse Protection

| Endpoint                | Classification | Rate Limit Policy                              |
| ----------------------- | -------------- | ---------------------------------------------- |
| `GET /semesters`        | auth/admin     | Standard Backoffice read rate (per workspace)  |
| `POST /semesters`       | auth/admin     | Standard Backoffice write rate (per workspace) |
| `GET /semesters/:id`    | auth/admin     | Standard Backoffice read rate                  |
| `PATCH /semesters/:id`  | auth/admin     | Standard Backoffice write rate                 |
| `DELETE /semesters/:id` | auth/admin     | Standard Backoffice write rate                 |

All endpoints are behind the authentication middleware. No public access is exposed.

---

## Layer Separation Confirmation

| Rule                                       | Compliance                                                    |
| ------------------------------------------ | ------------------------------------------------------------- |
| Frontend contains no business logic        | ✓ Semester status gating and date validation are backend-only |
| API contains no grading logic              | ✓ Feature does not touch attempt or grading                   |
| Worker contains no HTTP logic              | ✓ No worker involvement in this stage                         |
| MMC does not access tenant DB              | ✓ MMC has no direct access to semester data                   |
| No direct DB creation outside provisioning | ✓ All tables created via migration system                     |

---

## Security

- **Authentication:** All routes require a valid Backoffice staff session token.
- **Authorization:** Permission-based access control:
  - `semesters:read` for GET endpoints
  - `semesters:write` for POST and PATCH endpoints
  - `semesters:delete` for DELETE endpoint
- **Tenant isolation:** All semester queries are scoped to the resolved tenant DB connection. No
  cross-tenant access is possible.
- **Input validation:** All request bodies are validated using the project validation library before
  any DB operation.
- **SQL injection prevention:** All DB queries use parameterized statements via the ORM / query
  builder. No raw string interpolation into SQL.
- **DISABLED state as security boundary:** A DISABLED semester cannot be assigned to new students
  or subjects, enforced at the backend. UI-only enforcement is insufficient.
- **Soft-delete visibility:** Soft-deleted semesters are invisible in list and detail responses but
  remain in the DB for referential integrity. Deleted IDs return 404, not 410, to avoid state
  disclosure.

---

## Error Handling

All API error responses follow the standard envelope:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SEMESTER_NAME_DUPLICATE",
    "message": "A semester with this name already exists in the workspace."
  }
}
```

**Full error code inventory:**

| Code                          | HTTP | Description                                                             |
| ----------------------------- | ---- | ----------------------------------------------------------------------- |
| `SEMESTER_NOT_FOUND`          | 404  | Semester does not exist or is soft-deleted                              |
| `SEMESTER_NAME_DUPLICATE`     | 409  | Semester name already in use by an active semester in this workspace    |
| `SEMESTER_DATE_RANGE_INVALID` | 422  | `end_date` is before `start_date` when both dates are provided          |
| `SEMESTER_DISABLED`           | 422  | Attempt to assign a DISABLED semester to a student or subject           |
| `SEMESTER_HAS_STUDENTS`       | 422  | Cannot delete; one or more students reference this semester             |
| `SEMESTER_HAS_SUBJECTS`       | 422  | Cannot delete; one or more subjects reference this semester             |
| `VALIDATION_ERROR`            | 422  | Generic field-level validation failure (empty name, invalid date, etc.) |
| `SCHEMA_VERSION_MISMATCH`     | 409  | Tenant schema version below minimum; update required                    |
| `UNAUTHORIZED`                | 401  | Missing or invalid authentication token                                 |
| `FORBIDDEN`                   | 403  | Authenticated user lacks required permission                            |
| `LICENSE_SOFT_LOCKED`         | 423  | Workspace license is soft-locked                                        |
| `LICENSE_ARCHIVED`            | 403  | Workspace license is archived                                           |

---

## Validation Criteria

This stage is complete when all of the following are verified:

| Criterion                                   | Verification Method                                               |
| ------------------------------------------- | ----------------------------------------------------------------- |
| Semester CRUD works end-to-end              | Integration tests covering create/read/update/delete flows        |
| Unique name enforced within workspace       | Duplicate name returns 409 `SEMESTER_NAME_DUPLICATE`              |
| Date-range validation enforced              | `end_date < start_date` returns 422 `SEMESTER_DATE_RANGE_INVALID` |
| DISABLED semester not assignable            | Assign attempt returns 422 `SEMESTER_DISABLED`                    |
| Existing assignments survive status change  | Disable semester → student/subject refs unchanged                 |
| Deletion blocked when referenced            | Delete returns 422 `SEMESTER_HAS_STUDENTS` / `_HAS_SUBJECTS`      |
| Soft delete works; hard delete not possible | Deleted semester returns 404; not 200 on re-fetch                 |
| Student optional assignment works           | Set/clear `semester_id` on student record                         |
| Subject optional association works          | Set/clear `semester_id` on subject record                         |
| Division boundary not affected              | Division filters still applied before semester filters            |
| Tenant isolation enforced                   | Cross-tenant semester ID returns 404                              |
| License middleware enforced                 | SOFT_LOCKED returns 423; ARCHIVED returns 403                     |
| Schema version incremented in migration     | `schema_version` is bumped; version mismatch returns 409          |
| All writes transactional                    | Concurrent conflicting creates produce exactly one success        |
| Structured logs emitted                     | Required log fields present on all operations                     |
| Unit tests for business logic               | Name uniqueness, date validation, deletion guard logic covered    |
| Integration tests for API flow              | POST/GET/PATCH/DELETE flows tested with tenant context            |
| Idempotency for student/subject assignment  | Setting the same `semester_id` twice produces no error            |

---

## Failure Modes & Recovery

| Failure Mode                                 | Behavior                                                                                                                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB connection failure during create          | Transaction rolled back; 503 returned to client                                                                                                                                           |
| Partial update (network drop)                | Transaction rolled back; client retries PATCH safely (idempotent)                                                                                                                         |
| Concurrent duplicate name insert             | DB unique constraint or SELECT FOR UPDATE ensures only one succeeds; 409                                                                                                                  |
| Delete with concurrent student assign        | Transactional guard detects reference; delete fails with 422                                                                                                                              |
| Concurrent soft-delete of same semester      | First request acquires `SELECT FOR UPDATE` lock, completes soft-delete; second request waits, reads `deleted_at IS NOT NULL` after lock releases, returns 404 — no double-delete possible |
| Assignment to concurrently-disabled semester | `SELECT FOR UPDATE` on semester row inside assignment transaction; if disable committed first, ENABLED check fails with 422 `SEMESTER_DISABLED`; no phantom read possible                 |
| Schema version mismatch                      | License middleware intercepts before any semester logic; 409                                                                                                                              |
| Soft-deleted semester queried by ID          | Returns 404 (not 410) — no state disclosure                                                                                                                                               |

---

## Test Strategy

### Unit Tests

- Name uniqueness validation logic (including null / empty edge cases)
- Date-range cross-field validation (`start_date`, `end_date` combinations)
- Deletion guard logic (all reference categories)
- Status-gated assignment validation
- Division-before-semester filter ordering logic

### Integration Tests

- POST /semesters — happy path, name-duplicate, date-range violation, missing name
- GET /semesters — no filters, status filter, search filter, empty result
- GET /semesters/:id — found, not found, cross-tenant (not found)
- PATCH /semesters/:id — name change, name collision, date update, status toggle, clear dates
- DELETE /semesters/:id — no refs (success), with student ref, with subject ref, already deleted
- Student semester assignment via student update endpoint
- Subject semester association via subject update endpoint

### Transaction Tests

- Concurrent create with same name: only one succeeds
- Concurrent delete + student assign to same semester: transactional guard holds

### Isolation Tests

- Semester created in tenant A is not visible in tenant B

### Version Compatibility Tests

- Tenant below minimum schema version receives 409 before semester logic executes

---

## Explicit Non-Goals

This stage does NOT:

- Replace or replicate division-based access control. Semester is supplementary.
- Introduce cross-division visibility. Students in different divisions cannot see each other via
  semester context.
- Implement exam or content entity semester filtering (scoped to future stages).
- Implement a hard delete mechanism.
- Introduce any semester-based billing or license limits.
- Modify Frontoffice routing or rendering behavior directly.
- Implement semester assignment as a dedicated endpoint — `semester_id` is a field on the student
  and subject update payloads.
- Validate `start_date` / `end_date` against current server time (date values are calendar
  representations, not server deadlines).

---

## Assumptions

- `students` table already exists in the tenant DB before this migration runs (introduced in an
  earlier stage).
- `subjects` table does not exist before this migration (introduced in STAGE_28_SUBJECTS); neither
  the `semester_id` column nor the FK constraint is added to `subjects` in this migration.
  STAGE_28_SUBJECTS is entirely responsible for adding `subjects.semester_id UUID REFERENCES
semesters(id) ON DELETE RESTRICT` as part of the CREATE TABLE statement for `subjects`.
- Role-based permission identifiers (`semesters:read`, `semesters:write`, `semesters:delete`) align
  with the permission model established in STAGE_21_ROLE_PERMISSION_SYSTEM.
- The partial unique index (WHERE `deleted_at IS NULL`) is the preferred approach for name
  uniqueness with soft-delete; if the DB engine does not support partial indexes, a SELECT FOR
  UPDATE guard is used instead.

---

## Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.

---

## Clarifications

### Session 2026-03-20

- **Q1: Migration ordering — how to handle `subjects.semester_id` FK when `subjects` table does not yet exist during STAGE_27 migration?**
  → **A:** STAGE_27 migration does **not** touch the `subjects` table at all. Adding a column to a non-existent table is invalid DDL. Both the `semester_id` column and its FK constraint (`ON DELETE RESTRICT`) are the sole responsibility of STAGE_28_SUBJECTS, which includes `semester_id UUID REFERENCES semesters(id) ON DELETE RESTRICT` directly in its `CREATE TABLE subjects` statement. Conditional DDL (`ADD COLUMN IF NOT EXISTS` against a possible absent table) is explicitly rejected as it introduces migration fragility and violates Zidney's forward-only migration discipline.

- **Q2: Concurrent soft-delete — what happens when two admins delete the same semester simultaneously?**
  → **A:** The soft-delete transaction must open with `SELECT ... FOR UPDATE` on the target semester row as its **first** DB operation, before any referential guard queries. The first request acquires the row lock, performs the reference checks, sets `deleted_at = NOW()`, and commits. The second concurrent request blocks on the lock, then — after the first commits — reads `deleted_at IS NOT NULL` and returns 404 `SEMESTER_NOT_FOUND`. This guarantees exactly one soft-delete succeeds regardless of request concurrency. The update-WHERE pattern (`UPDATE ... WHERE deleted_at IS NULL`) alone is insufficient because referential checks must also execute inside the same serialized lock scope.

- **Q3: Pagination `limit` out-of-range behavior — should `limit=200` silently clamp to 100 or return a validation error?**
  → **A:** `limit` values outside the inclusive range 1–100 return HTTP 422 with error code `VALIDATION_ERROR`. Silent clamping is not used. Explicit rejection aligns with Zidney's validation-first request contract and prevents clients from submitting unbounded queries without knowing they were quietly constrained. The existing endpoint spec already states `integer 1–100`; this clarification makes the 422 rejection the canonical behavior.

- **Q4: Race condition — what happens when a student is assigned to a semester that is concurrently being disabled?**
  → **A:** The student assignment transaction must acquire a row-level lock on the semester using `SELECT status FROM semesters WHERE id = ? FOR UPDATE` **before** writing to `students`. This eliminates the time-of-check / time-of-use (TOCTOU) window: if the disable PATCH committed first, the assignment transaction reads `status = DISABLED` under the lock and returns 422 `SEMESTER_DISABLED`; if the assignment committed first, the disable PATCH proceeds normally without conflict. Relying on PostgreSQL's default `READ COMMITTED` isolation without an explicit row lock is insufficient — a concurrent disable can commit between the status read and the student write within the same READ COMMITTED transaction. The same `SELECT ... FOR UPDATE` pattern applies to subject semester associations.

- **Q5: FK `ON DELETE` clause for `students.semester_id` (and future `subjects.semester_id`) — `RESTRICT` or `SET NULL`?**
  → **A:** `ON DELETE RESTRICT`. Rationale: (a) The programmatic deletion guard is the primary enforcement layer — it blocks app-level soft-deletes when references exist. (b) `RESTRICT` acts as a DB-level safety net preventing accidental hard deletes (e.g., by maintenance scripts or direct DB access) from silently orphaning student records. (c) `SET NULL` would allow bypassing of the deletion guard at the DB layer, contradicting Zidney's data integrity guarantees. Since hard delete is unconditionally forbidden by the spec, the `RESTRICT` constraint is effectively never triggered by normal application flows, but it enforces the hard-delete prohibition at the database boundary.
