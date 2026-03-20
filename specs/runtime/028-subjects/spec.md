# Feature Specification: Subjects

**Feature Branch**: `spec/028-subjects`
**Stage**: `STAGE_28_SUBJECTS`
**Phase**: `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE`
**Created**: 2026-03-20
**Status**: DRAFT
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_28_SUBJECTS.md`

---

## Feature Overview

This stage implements **Subject** as the primary academic container within a Zidney workspace
(tenant). Subject is the root academic entity that all downstream content depends on — no lesson,
question, exam, exercise, library item, live session, or category may exist without a subject.

**What is being built:**

- A `subjects` table per-tenant supporting: unique name within workspace, optional unique code,
  nullable `division_id` and `semester_id` FKs, multi-language flag with default language,
  optional description, workflow-managed status (`DRAFT | ACTIVE | ARCHIVED`), and soft-delete
  capability.
- A complete Subject CRUD API (list, create, read, update, delete) accessible to authorized
  Backoffice staff, protected by tenant resolver and license middleware.
- Workflow transition endpoints to advance Subject status through `DRAFT → ACTIVE → ARCHIVED`,
  enforced by the global Status Workflow Engine with permission gating.
- Division boundary enforcement: subjects auto-link to the default division when divisions are
  disabled; cross-division subject linking is prohibited.
- Semester boundary enforcement: semester assignment is optional; when provided the semester must
  belong to the same division (if divisions are enabled).
- Multi-language support: when `is_multilanguage = true`, translation entries for all workspace-
  supported languages are required; fallback resolves to `default_language`.
- Visibility filtering at API layer: runtime queries always enforce `status = ACTIVE` and apply
  division and semester filters server-side; no visibility logic on the frontend.
- Soft-delete with dependency guard: subject deletion is blocked if any dependent records exist.

**Subject is the academic isolation boundary for:**

- Content ownership (every piece of academic content is scoped to exactly one subject)
- Filtering logic (exam, exercise, and library selection engines filter by subject)
- Visibility rules (only ACTIVE subjects appear in runtime selection lists)
- Auto-selection engines (question-bank engines resolve candidates per subject)
- Reporting & analytics (all academic metrics aggregated per subject)

**Primary use cases:**

| Use Case                       | How Subjects Are Applied                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| Academic content boundary      | All MCQ, traditional questions, exams, exercises scoped to one subject              |
| Division/semester scoping      | Subject linked to optional division and semester for organizational filtering       |
| Runtime content selection      | Only ACTIVE subjects eligible for schedule, registration, and exam engine selection |
| Multi-language course naming   | Workspace supporting multiple languages requires translated subject names           |
| Reporting segmentation         | Exam results, completion analytics, and pass rates aggregated per subject           |
| Library and live session scope | Library items and live sessions require a subject for categorization                |

**Phase & Stage mapping:** Phase 03 Backoffice Core, Academic Structure domain. This stage follows
STAGE_27_SEMESTERS and is the prerequisite for all downstream academic content stages
(MCQ Questions, Traditional Questions, Exams, Exercises, Scheduled Exams, Library Items, Live
Sessions, and Categories). It depends on the `divisions`, `departments`, `semesters`, and
platform foundation (tenant DB provisioning, license middleware) being stable.

**Affected system areas:**

| Area                | Affected? | Notes                                                                           |
| ------------------- | --------- | ------------------------------------------------------------------------------- |
| Tenant Isolation    | Yes       | `subjects` table resides exclusively in tenant DB; never shared across tenants  |
| License Enforcement | Yes       | License middleware mandatory for all workspace subject routes                   |
| Attempt Engine      | No        | Subject FK is informational in attempt snapshots; snapshots capture ID at start |
| Worker              | No        | Subject CRUD is synchronous; no background processing required                  |
| Runtime             | Yes       | Only ACTIVE subjects visible in runtime; visibility enforcement is server-side  |
| Frontoffice         | No        | Frontoffice inherits subject context via enrolled exam; no direct subject CRUD  |
| Academic Content    | Yes       | Subject is a hard pre-requisite for all downstream academic content stages      |

---

## Constitutional Compliance Declaration

This specification is validated against **Zidney Constitution v1.2.0**.

| Rule                                   | Compliance                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| No cross-tenant access                 | ✓ `subjects` table resides exclusively within the tenant DB; no shared data               |
| No middleware bypass                   | ✓ Tenant resolver → license middleware mandatory before any subject route                 |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic                                         |
| No direct DB instantiation             | ✓ All DB access originates from tenant resolver context; no global singleton              |
| No weakening of snapshot integrity     | ✓ Subject FK stored in downstream snapshots is immutable after capture                    |
| No weakening of transaction boundaries | ✓ All writes (creation, update, workflow transition, deletion guard) are transactional    |
| No weakening of version enforcement    | ✓ Schema version incremented; migration is forward-only                                   |
| Server-authoritative time only         | ✓ `created_at` / `updated_at` / `deleted_at` set by server; no client-supplied timestamps |
| No console.log allowed                 | ✓ All logging via structured logger with required fields                                  |
| Division boundary preserved            | ✓ Division-first filtering always applied; cross-division subject linking is prohibited   |

No exceptions requiring a new ADR were detected for this stage.

---

## Isolation Impact Analysis

- **Database accessed:** Tenant DB only (resolved per workspace slug / subdomain context).
- **Tenant resolution:** Via existing tenant resolver middleware executed before any route handler.
- **Connection pool:** Obtained from tenant-scoped in-memory connection pool map; no global
  singleton.
- **Resolver middleware:** Mandatory — no route handler may access the DB before tenant and license
  validation.
- **Tables introduced:**
  - `subjects` — new table in tenant DB
- **Tables NOT modified in this stage:**
  - `divisions` — already exists; `subjects.division_id → divisions.id` FK is established by this
    stage's migration as an outbound FK on `subjects`, not by modifying the `divisions` table.
  - `semesters` — already exists (STAGE_27); `subjects.semester_id → semesters.id` FK was pre-
    reserved by the semesters migration; the `subjects` table creation activates that FK.
- **Indexes introduced:**
  - `subjects(division_id)` — for division-scoped filtering
  - `subjects(semester_id)` — for semester-scoped filtering
  - `subjects(status)` — for status-gated runtime queries
  - `UNIQUE(code) WHERE code IS NOT NULL` — partial unique index for optional code uniqueness

**Confirmed:** No shared tenant data. No cross-tenant joins. No modification to master DB. No
removal or weakening of existing isolation constraints.

---

## License & Version Enforcement

- **License middleware required:** Yes — all Backoffice Subject API routes require an active
  workspace license.
- **Allowed license states:** `ACTIVE` only.
  - `SOFT_LOCKED` → 423 Locked
  - `ARCHIVED` → 403 Forbidden
  - `NOT_FOUND` → 404 Not Found
- **Limit enforcement required:** No global subject-count limits in this stage (subject capacity
  limits, if any, are a license-tier feature defined in a downstream limits stage).
- **`schema_version` checked:** Yes — migration increments `schema_version` to the next value. The
  middleware enforces `schema_version >= MIN_SCHEMA_VERSION`. Tenants below the minimum receive
  HTTP 409 with error code `SCHEMA_VERSION_MISMATCH` before any subject business logic executes.
  Tenants at a higher schema version remain forward-compatible.
- **`product_version` checked:** Yes — enforced at request boundary per Constitution.

---

## User Scenarios & Testing

### User Story 1 – Administrator Creates a Subject (Priority: P1)

A Backoffice administrator creates a new subject within the workspace to define an academic
content scope.

**Why this priority:** Subject creation is the prerequisite for all downstream academic content.
No question, exam, exercise, or library item can be created until at least one subject exists.

**Independent Test:** Create a subject named "Mathematics" with `default_language = "en"` and no
optional fields. Verify it appears in the list endpoint with `status = DRAFT`,
`is_multilanguage = false`, `code = null`, `division_id = null` (or auto-assigned default),
`semester_id = null`.

**Acceptance Scenarios:**

1. **Given** an active workspace license, **When** a staff member with subject management
   permission sends a create request with a unique name, `default_language`, and no optional
   fields, **Then** the subject is persisted with `status = DRAFT`, `is_multilanguage = false`,
   and all optional fields null.
2. **Given** a subject with the same name already exists in the workspace, **When** a second
   create request uses the same name, **Then** the API returns 409 Conflict with error code
   `SUBJECT_NAME_DUPLICATE`.
3. **Given** a create request supplies a `code` value already used by another subject in the
   workspace, **Then** the API returns 409 Conflict with error code `SUBJECT_CODE_DUPLICATE`.
4. **Given** a create request with a missing or empty `name`, **Then** the API returns 422 with
   error code `VALIDATION_ERROR` and a descriptive field-level message.
5. **Given** a create request with a missing `default_language`, **Then** the API returns 422
   with error code `VALIDATION_ERROR`.
6. **Given** a create request with a `division_id` that belongs to another tenant, **Then** the
   API returns 404 (not 403, to avoid information leakage).
7. **Given** a create request with a `semester_id` that belongs to a different division than
   `division_id`, **When** divisions are enabled, **Then** the API returns 422 with error code
   `SUBJECT_SEMESTER_DIVISION_MISMATCH`.
8. **Given** divisions are disabled in the workspace, **When** a create request omits
   `division_id`, **Then** the subject is automatically linked to the workspace default division.
9. **Given** a staff member without subject management permission, **When** they attempt to create
   a subject, **Then** the API returns 403 Forbidden.

---

### User Story 2 – Administrator Views the Subject List (Priority: P1)

A Backoffice administrator lists all subjects in the workspace with optional filters for division,
semester, status, and search.

**Why this priority:** Required for content creation screens, exam configuration dropdowns, and
reporting dashboards across all downstream stages.

**Independent Test:** Seed three subjects across two divisions and two statuses. Call the list
endpoint without filters; confirm all three are returned with all expected fields. Apply a
`status = ACTIVE` filter; confirm only the matching subjects are returned.

**Acceptance Scenarios:**

1. **Given** multiple subjects exist, **When** the list endpoint is called without filters,
   **Then** all non-deleted subjects are returned with `id`, `name`, `code`, `division_id`,
   `semester_id`, `is_multilanguage`, `default_language`, `description`, `status`, `created_at`,
   and `updated_at`.
2. **Given** a `status = ACTIVE` filter, **Then** only active subjects are returned.
3. **Given** a `division_id` filter, **Then** only subjects belonging to that division are
   returned.
4. **Given** a `semester_id` filter, **Then** only subjects linked to that semester are returned.
5. **Given** a `search` query parameter, **Then** only subjects whose name or code contains the
   query (case-insensitive) are returned.
6. **Given** no subjects exist, **Then** an empty `items` list is returned with `total = 0`.
7. **Given** a soft-deleted subject, **Then** that subject does NOT appear in any list or filter
   result.

---

### User Story 3 – Administrator Reads Subject Detail (Priority: P2)

A Backoffice administrator retrieves the full detail of a single subject by its ID.

**Why this priority:** Required for confirmation screens, edit forms, and dependency audits before
workflow transitions or deletion.

**Independent Test:** Create a subject, retrieve it by its ID, confirm all fields match the
created values including optional nulls.

**Acceptance Scenarios:**

1. **Given** a subject with a valid ID, **When** an admin sends a detail request, **Then** the
   full subject object is returned with all fields.
2. **Given** a non-existent or soft-deleted ID, **Then** the API returns 404 with
   `SUBJECT_NOT_FOUND`.
3. **Given** a valid subject ID belonging to a different tenant, **Then** the API returns 404
   (not 403, to avoid information leakage).

---

### User Story 4 – Administrator Updates a Subject (Priority: P2)

A Backoffice administrator updates the name, code, description, division, semester, or language
settings of an existing subject.

**Why this priority:** Subject metadata must be correctable as academic catalogs evolve, provided
content integrity is not broken.

**Independent Test:** Create a subject named "Physics", update its `description` and `code`,
confirm the updated values are returned on the detail endpoint without affecting other fields.

**Acceptance Scenarios:**

1. **Given** an existing subject, **When** an admin updates its `name` to a unique value, **Then**
   the change is persisted and returned on the next detail request.
2. **Given** an admin attempts to update `name` to a value already used by another subject in the
   workspace, **Then** the API returns 409 with `SUBJECT_NAME_DUPLICATE`.
3. **Given** an admin sets a `code` value already used by another subject, **Then** the API
   returns 409 with `SUBJECT_CODE_DUPLICATE`.
4. **Given** an admin changes `division_id` to a valid division in the same workspace, **Then**
   the change is persisted; any existing `semester_id` is validated against the new division.
5. **Given** an admin sets `is_multilanguage = true` without providing translation entries for all
   workspace-supported languages, **Then** the API returns 422 with
   `SUBJECT_MISSING_TRANSLATIONS`.
6. **Given** an admin updates `default_language` to a language not in the workspace language
   settings, **Then** the API returns 422 with `SUBJECT_INVALID_DEFAULT_LANGUAGE`.
7. **Given** a partial update payload (`PATCH`), **Then** only the provided fields are updated;
   all other fields remain unchanged.
8. **Given** an ARCHIVED subject, **When** an admin attempts to update any field, **Then** the
   API returns 422 with `SUBJECT_ARCHIVED_IMMUTABLE`.

---

### User Story 5 – Administrator Manages Subject Workflow Transitions (Priority: P1)

A Backoffice administrator advances a subject through its lifecycle:
`DRAFT → ACTIVE → ARCHIVED`.

**Why this priority:** Only ACTIVE subjects are visible in runtime and eligible for content
creation. Incorrect workflow state blocks all downstream academic activity for that subject.

**Independent Test:** Create a subject (`DRAFT`), transition it to `ACTIVE`, confirm it appears in
runtime-scoped list results. Transition it to `ARCHIVED`, confirm it is excluded from runtime
results and content creation selectors.

**Acceptance Scenarios:**

1. **Given** a subject in `DRAFT` state, **When** an admin with workflow permission sends a
   transition request to `ACTIVE`, **Then** the subject status is updated to `ACTIVE`.
2. **Given** a subject in `ACTIVE` state, **When** an admin transitions to `ARCHIVED`, **Then**
   the subject status is updated to `ARCHIVED`; all existing content references remain valid.
3. **Given** a subject in `ARCHIVED` state, **When** an admin attempts to transition back to
   `ACTIVE`, **Then** the API returns 422 with `SUBJECT_INVALID_TRANSITION` (ARCHIVED is
   terminal).
4. **Given** a subject in `DRAFT` state, **When** an admin attempts to transition directly to
   `ARCHIVED`, **Then** the API returns 422 with `SUBJECT_INVALID_TRANSITION`.
5. **Given** a staff member without workflow transition permission, **When** they attempt a
   transition, **Then** the API returns 403 Forbidden.
6. **Given** an ACTIVE subject is ARCHIVED, **When** a runtime query requests available subjects,
   **Then** the archived subject is excluded from results without breaking historical content
   metadata.

---

### User Story 6 – Administrator Deletes a Subject (Priority: P3)

A Backoffice administrator deletes a subject that has no dependent academic content.

**Why this priority:** Keeps the subject namespace clean; prevents orphaned content containers
from polluting selection lists and analytics.

**Independent Test:** Create a subject in DRAFT state with no dependent records. Delete it.
Confirm it no longer appears in any list endpoint.

**Acceptance Scenarios:**

1. **Given** a subject in `DRAFT` state with no dependent records, **When** an admin sends a
   delete request, **Then** the subject is soft-deleted and the API returns 200 with
   `{ "deleted": true }`.
2. **Given** a subject referenced by at least one MCQ question, **When** an admin attempts to
   delete it, **Then** the API returns 422 with `SUBJECT_HAS_DEPENDENT_CONTENT`.
3. **Given** a subject referenced by at least one exam, **When** an admin attempts to delete it,
   **Then** the API returns 422 with `SUBJECT_HAS_DEPENDENT_CONTENT`.
4. **Given** a subject in `ACTIVE` or `ARCHIVED` state, **When** an admin attempts a hard delete,
   **Then** the API returns 422 with `SUBJECT_HARD_DELETE_PROHIBITED`.
5. **Given** a staff member without subject deletion permission, **When** they attempt deletion,
   **Then** the API returns 403 Forbidden.
6. **Given** a non-existent subject ID, **Then** the API returns 404 with `SUBJECT_NOT_FOUND`.

---

### User Story 7 – Multi-Language Subject Registration (Priority: P2)

A Backoffice administrator creates a subject that requires name translations in all workspace-
supported languages.

**Why this priority:** Workspaces supporting multiple languages (e.g., Arabic + English) must
present subject names correctly in all UI contexts.

**Independent Test:** Create a subject with `is_multilanguage = true`, `default_language = "ar"`,
and provide English and Arabic translation entries. Retrieve the subject and confirm translation
coverage is reported as complete.

**Acceptance Scenarios:**

1. **Given** `is_multilanguage = true` and translation entries for all supported workspace
   languages, **When** an admin creates the subject, **Then** the subject is persisted with
   translations linked and `translation_coverage = complete`.
2. **Given** `is_multilanguage = true` with translations missing for at least one workspace
   language, **Then** the API returns 422 with `SUBJECT_MISSING_TRANSLATIONS`.
3. **Given** `is_multilanguage = false`, **When** only `default_language` name is provided,
   **Then** the subject is created without translation requirements.
4. **Given** a subject with `is_multilanguage = true`, **When** the fallback language (unresolved
   translation) is requested, **Then** the API returns the `default_language` name as fallback.
5. **Given** `default_language` is not in the workspace's configured language list, **Then** the
   API returns 422 with `SUBJECT_INVALID_DEFAULT_LANGUAGE`.

---

### User Story 8 – Runtime Visibility Enforcement (Priority: P1)

The runtime (Frontoffice and exam configuration engine) can only access subjects that are ACTIVE.
All filtering is server-enforced.

**Why this priority:** If archived or draft subjects leak into runtime, exam configuration and
student experience are broken at the root level.

**Independent Test:** Seed subjects in DRAFT, ACTIVE, and ARCHIVED states. Call the runtime-
scoped subject list endpoint. Confirm only the ACTIVE subject is returned. Confirm DRAFT and
ARCHIVED subjects are absent.

**Acceptance Scenarios:**

1. **Given** the runtime subject list endpoint is called, **When** subjects in DRAFT and ARCHIVED
   states exist, **Then** only ACTIVE subjects are returned.
2. **Given** division filtering is enabled in the workspace, **When** the runtime endpoint is
   called with a `division_id`, **Then** only ACTIVE subjects within that division are returned.
3. **Given** semester filtering is enabled and a `semester_id` is provided, **Then** only ACTIVE
   subjects linked to that semester within the given division are returned.
4. **Given** no active subjects exist in the workspace, **Then** an empty list is returned with
   `total = 0`.
5. **Given** a client attempt to pass `status` as a query parameter on the runtime endpoint,
   **Then** the server ignores the client value and always applies `status = ACTIVE` filter.

---

### User Story 9 – Division-Disabled Mode Auto-Assignment (Priority: P2)

When divisions are disabled at the workspace level, subject creation always auto-assigns to the
default division without requiring `division_id` in the request.

**Why this priority:** Workspaces that disable divisions must not break the FK model and must
maintain data consistency for future re-enablement.

**Independent Test:** Disable divisions in the workspace. Create a subject without `division_id`.
Confirm `division_id` is set to the default division ID in the persisted record.

**Acceptance Scenarios:**

1. **Given** divisions are disabled, **When** a subject is created without `division_id`, **Then**
   the subject is automatically assigned to the workspace default division.
2. **Given** divisions are disabled, **When** a subject is created with an explicit `division_id`,
   **Then** the API returns 422 with `SUBJECT_DIVISION_DISABLED`.
3. **Given** divisions are re-enabled after being disabled, **When** existing subjects are queried,
   **Then** all previously auto-assigned subjects retain their `division_id` and remain valid.
4. **Given** the division toggle is executed, **Then** the toggle operation is transactional;
   no subject is left in an inconsistent FK state.

---

## Functional Requirements

### Subject CRUD

| Ref   | Requirement                                                                                          | Priority |
| ----- | ---------------------------------------------------------------------------------------------------- | -------- |
| FR-01 | The system shall allow authorized staff to create a subject with a unique name within the workspace  | P1       |
| FR-02 | Subject `code`, when provided, must be unique within the workspace (partial unique index)            | P1       |
| FR-03 | Subject `default_language` is mandatory and must match a language in the workspace language settings | P1       |
| FR-04 | `division_id` is nullable; when divisions are disabled, the system auto-assigns default division     | P1       |
| FR-05 | `semester_id` is nullable; when provided, must belong to the same division (if divisions enabled)    | P2       |
| FR-06 | The system shall support full CRUD operations: Create, List, Read, Update, soft-Delete               | P1       |
| FR-07 | Soft delete is the only permitted deletion mechanism; hard delete is prohibited                      | P1       |
| FR-08 | Subject deletion is blocked when any dependent records reference the subject                         | P1       |
| FR-09 | Soft-deleted subjects are excluded from all list, filter, and selection results                      | P1       |

### Workflow Management

| Ref   | Requirement                                                                               | Priority |
| ----- | ----------------------------------------------------------------------------------------- | -------- |
| FR-10 | Subject lifecycle follows DRAFT → ACTIVE → ARCHIVED via the global Status Workflow Engine | P1       |
| FR-11 | Only ACTIVE subjects may be used in runtime content creation and exam configuration       | P1       |
| FR-12 | DRAFT subjects are not visible in Frontoffice or runtime selection engines                | P1       |
| FR-13 | ARCHIVED subjects are hidden but preserved; historical content references remain valid    | P1       |
| FR-14 | ARCHIVED is a terminal state; no transition out of ARCHIVED is permitted                  | P1       |
| FR-15 | Workflow transitions require explicit permission; unauthorized transitions return 403     | P1       |

### Multi-Language

| Ref   | Requirement                                                                                            | Priority |
| ----- | ------------------------------------------------------------------------------------------------------ | -------- |
| FR-16 | When `is_multilanguage = true`, translation entries for all workspace-supported languages are required | P2       |
| FR-17 | Fallback language resolution must return `default_language` name when a translation is missing         | P2       |
| FR-18 | Translation coverage must be tracked and queryable                                                     | P3       |

### Visibility & Filtering

| Ref   | Requirement                                                                                 | Priority |
| ----- | ------------------------------------------------------------------------------------------- | -------- |
| FR-19 | All runtime subject queries must enforce `status = ACTIVE` at the API layer                 | P1       |
| FR-20 | Division and semester filters must be applied server-side; frontend must never control them | P1       |
| FR-21 | Backoffice administrative queries may filter by any status value                            | P2       |

---

## Success Criteria

The Subjects feature is complete and ready for downstream stages when all of the following are met:

1. **Subject creation and retrieval complete in under 500ms** for a workspace with up to 10,000
   subjects, measured from request receipt to response delivery.
2. **100% of runtime queries return only ACTIVE subjects**, verified by integration tests that
   seed DRAFT and ARCHIVED subjects and confirm they are excluded.
3. **Subject deletion is blocked in 100% of cases where dependent records exist**, with
   appropriate error codes returned, verified by integration tests against every dependent entity
   type.
4. **All workflow transitions enforce the DRAFT → ACTIVE → ARCHIVED path**, with invalid
   transitions rejected, verified by state-machine integration tests.
5. **Subject namespace is unique per workspace** — duplicate name and duplicate code conflicts
   are detected and rejected before persistence, with 0 duplicates possible at the DB level.
6. **Division-disabled mode produces no FK constraint violations** — auto-assignment places
   every subject in the default division and existing subjects are unaffected by the toggle.
7. **Multi-language subjects correctly fall back to default language** when a requested language
   has no translation, verified by locale-switching tests.
8. **Cross-tenant isolation holds under concurrent load** — subject queries in parallel requests
   from two different tenant contexts never return data from the wrong tenant.
9. **All writes complete within a transaction** — no partial state persists after any failure
   scenario, verified by rollback injection tests.
10. **Zero downtime for existing tenants during migration** — the schema migration applies
    without locking violations and is backward compatible with schema_version enforcement.

---

## Data Model Changes

### New Table: `subjects`

| Column             | Type                                | Constraints                                      |
| ------------------ | ----------------------------------- | ------------------------------------------------ |
| `id`               | `uuid`                              | PRIMARY KEY, default `gen_random_uuid()`         |
| `name`             | `varchar(255)`                      | NOT NULL                                         |
| `code`             | `varchar(100)`                      | NULLABLE                                         |
| `division_id`      | `uuid`                              | NULLABLE, FK → `divisions.id` ON DELETE RESTRICT |
| `semester_id`      | `uuid`                              | NULLABLE, FK → `semesters.id` ON DELETE RESTRICT |
| `is_multilanguage` | `boolean`                           | NOT NULL, DEFAULT `false`                        |
| `default_language` | `varchar(10)`                       | NOT NULL                                         |
| `description`      | `text`                              | NULLABLE                                         |
| `status`           | `enum('DRAFT','ACTIVE','ARCHIVED')` | NOT NULL, DEFAULT `'DRAFT'`                      |
| `created_at`       | `timestamptz`                       | NOT NULL, DEFAULT `now()`                        |
| `updated_at`       | `timestamptz`                       | NOT NULL, DEFAULT `now()`                        |
| `deleted_at`       | `timestamptz`                       | NULLABLE (soft delete marker)                    |

### Indexes

| Index                        | Type             | Purpose                               |
| ---------------------------- | ---------------- | ------------------------------------- |
| `idx_subjects_division_id`   | B-tree           | Division-scoped filtering             |
| `idx_subjects_semester_id`   | B-tree           | Semester-scoped filtering             |
| `idx_subjects_status`        | B-tree           | Status-gated runtime queries          |
| `uq_subjects_code_partial`   | Unique (partial) | `UNIQUE(code) WHERE code IS NOT NULL` |
| `uq_subjects_name_workspace` | Unique           | Name uniqueness within tenant scope   |

> **Note on name uniqueness:** Because `subjects` is a tenant-scoped table (one DB per tenant),
> the `uq_subjects_name_workspace` is a simple `UNIQUE(name)` constraint. No tenant_id column
> needed.

### Migration Requirements

- **Forward-only:** Migration creates the `subjects` table and all indexes. No rollback migration.
- **Version bump:** `schema_version` incremented in the tenant migration sequence.
- **Backward compatibility:** No existing tables are modified. `subjects.semester_id` FK
  references the `semesters` table created in STAGE_27; that migration is a prerequisite.
- **Downtime risk:** None — adding a new table does not lock existing tables.

---

## Transaction Boundaries

| Operation                | Transactional? | Notes                                                                                        |
| ------------------------ | -------------- | -------------------------------------------------------------------------------------------- |
| Subject create           | Yes            | Name/code uniqueness check + insert as single atomic unit                                    |
| Subject update           | Yes            | Name/code uniqueness check + update as single atomic unit; validates semester-division match |
| Workflow transition      | Yes            | State validation + status update + audit event as single atomic unit                         |
| Subject soft delete      | Yes            | Dependency check + `deleted_at` set as single atomic unit                                    |
| Division-disabled toggle | Yes            | All subjects auto-assignment updates within a single transaction                             |
| Subject list / read      | No             | Read-only; snapshot isolation provides consistency                                           |

**Failure handling:**

- Any mid-transaction failure triggers full rollback; no partial state is persisted.
- On transaction conflict (serialization failure), the request returns 500 with
  `TRANSACTION_CONFLICT` and the client must retry.

---

## Authoritative Time Usage

- All `created_at`, `updated_at`, and `deleted_at` values are set by the database server using
  `now()` / `CURRENT_TIMESTAMP` at transaction commit time.
- No client-supplied timestamps are accepted for these fields.
- Client-supplied dates (if any future stage adds a `start_date` / `end_date` to subjects) must
  be treated as calendar dates only and validated server-side for ordering rules.
- Workflow transitions record a server-generated `transitioned_at` timestamp.

---

## Idempotency Strategy

| Operation                  | Idempotency Key      | Unique Constraint | Replay Behavior                                         |
| -------------------------- | -------------------- | ----------------- | ------------------------------------------------------- |
| Subject create             | `name` (per-tenant)  | Yes               | Duplicate name → 409 `SUBJECT_NAME_DUPLICATE`           |
| Subject create (with code) | `code` (per-tenant)  | Yes (partial)     | Duplicate code → 409 `SUBJECT_CODE_DUPLICATE`           |
| Workflow transition        | `(id, target_state)` | Yes (state check) | Already in target state → 200 with current state (safe) |
| Subject update (PATCH)     | None                 | Name/code checks  | Identical payload → 200 with unchanged record           |
| Subject soft delete        | `deleted_at` check   | Yes               | Already deleted → 404 `SUBJECT_NOT_FOUND`               |

All create and delete operations are safe to retry without producing duplicate records or
inconsistent state.

---

## Observability Requirements

All Subject API handlers must emit structured log entries with the following minimum fields:

| Field            | Required? | Source                                   |
| ---------------- | --------- | ---------------------------------------- |
| `request_id`     | Yes       | Injected by middleware                   |
| `workspace_slug` | Yes       | Resolved by tenant resolver              |
| `user_id`        | Yes       | Authenticated session                    |
| `action`         | Yes       | `subject.create`, `subject.update`, etc. |
| `subject_id`     | Yes       | Present on all post-create operations    |
| `status`         | Yes       | HTTP response status code                |
| `duration_ms`    | Yes       | Request processing duration              |
| `error_code`     | Cond.     | Present on error responses only          |

**Error contract compliance:** All error responses follow the standard contract:

```
{ success: false, data: null, error: { code: string, message: string } }
```

**Metrics (critical path):**

- Subject creation rate (per workspace, per minute)
- Workflow transition events (by transition type)
- Dependency-blocked deletion attempts (to detect orphaned content risks)

---

## Rate Limiting & Abuse Protection

| Endpoint                        | Classification | Rate Limit Policy             |
| ------------------------------- | -------------- | ----------------------------- |
| `POST /subjects`                | auth/admin     | 60 requests/minute per user   |
| `GET /subjects`                 | auth/admin     | 300 requests/minute per user  |
| `GET /subjects/:id`             | auth/admin     | 300 requests/minute per user  |
| `PATCH /subjects/:id`           | auth/admin     | 60 requests/minute per user   |
| `POST /subjects/:id/transition` | auth/admin     | 30 requests/minute per user   |
| `DELETE /subjects/:id`          | auth/admin     | 30 requests/minute per user   |
| `GET /runtime/subjects`         | auth/runtime   | 600 requests/minute per token |

**Replay attack mitigation:** Write operations (create, update, transition, delete) validate
uniqueness constraints database-side to prevent double-submit effects. No separate idempotency
token header is required for synchronous CRUD operations.

---

## Layer Separation Confirmation

| Rule                                       | Confirmed                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Frontend contains no business logic        | ✓ All subject visibility, workflow, and filtering rules enforced at API layer            |
| API contains no grading logic              | ✓ Feature does not touch attempt or grading                                              |
| Worker contains no HTTP logic              | ✓ No worker involvement; feature is fully synchronous                                    |
| MMC does not access tenant DB              | ✓ Feature is Backoffice-only; MMC has no access to tenant subject data                   |
| No direct DB creation outside provisioning | ✓ Migration executed via forward-only migration pipeline; no runtime schema mutation     |
| Frontend never controls visibility filters | ✓ Status, division, and semester filters are always server-enforced on runtime endpoints |

---

## Failure Modes & Recovery

| Failure Mode                         | Handling                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| DB connection failure on write       | Transaction rolls back; API returns 503 with `DB_UNAVAILABLE`                                   |
| Schema version mismatch              | License middleware returns 409 `SCHEMA_VERSION_MISMATCH` before any handler executes            |
| License not ACTIVE                   | License middleware returns 423/403 before any subject logic executes                            |
| Uniqueness constraint violation      | Caught at DB layer, mapped to 409 with `SUBJECT_NAME_DUPLICATE` or `SUBJECT_CODE_DUPLICATE`     |
| FK constraint violation (division)   | Caught at DB layer, mapped to 422 with `SUBJECT_DIVISION_NOT_FOUND`                             |
| FK constraint violation (semester)   | Caught at DB layer, mapped to 422 with `SUBJECT_SEMESTER_NOT_FOUND`                             |
| Dependency check failure on delete   | Pre-delete dependency query detects references; returns 422 `SUBJECT_HAS_DEPENDENT_CONTENT`     |
| Invalid workflow transition          | State-machine validation returns 422 `SUBJECT_INVALID_TRANSITION` before any DB write           |
| Partial transaction failure          | Full rollback; no partial state persisted                                                       |
| Concurrent transition race condition | Last-write-wins within transaction; optimistic lock on `status` column prevents silent override |

---

## Assumptions

The following assumptions are documented to avoid ambiguity during planning:

1. **Workspace default division exists when divisions are disabled.** The division-disabled mode
   requires a "default division" record. This stage assumes that workspace provisioning (STAGE_05
   or equivalent) creates a sentinel default division. If not, division-disabled auto-assignment
   cannot proceed.
2. **`default_language` validation uses workspace language settings.** The workspace must expose
   a configured language list. Validation of `default_language` against this list is performed at
   the API layer on every create/update.
3. **Translation table referenced by multi-language subjects is managed by a separate
   translations infrastructure stage.** This spec declares the contract (`is_multilanguage`,
   `default_language`, translation coverage tracking) but does not implement the translations
   storage schema. That schema must be in place before multi-language subject creation is tested
   end-to-end.
4. **ARCHIVED is terminal.** Once archived, a subject cannot be reactivated. If business
   requirements change, an ADR must be filed before the ARCHIVED → ACTIVE transition is added.
5. **Downstream content tables do not exist yet.** At the time of this stage, MCQ questions,
   exams, etc. are not yet created. Dependency-blocked deletion tests will be executable only
   after those stages land. For this stage, the dependency check must be designed to handle an
   empty dependent table gracefully and must be extensible without schema changes.

---

## Test Strategy

### Unit Tests

- Workflow state machine: all valid and invalid transitions
- Name uniqueness validator
- Code uniqueness validator (partial unique semantics)
- Division-disabled auto-assignment logic
- Semester-division cross-validation
- Multi-language coverage validation
- Dependency check aggregation function (mock dependent entity counts)

### Integration Tests

- Full CRUD lifecycle: create → read → update → transition → delete (DRAFT path)
- Workflow enforcement: DRAFT → ACTIVE → ARCHIVED; ARCHIVED → ACTIVE (must fail)
- Uniqueness enforcement: duplicate name → 409; duplicate code → 409
- Soft delete + dependency guard: subject with MCQ reference → delete blocked; subject with no
  references → deleted
- Visibility filters: seed DRAFT / ACTIVE / ARCHIVED subjects; confirm runtime endpoint returns
  ACTIVE only
- Division filter: subjects across two divisions; confirm filter returns correct subset
- Semester filter: subjects with different semesters; confirm filter returns correct subset
- Division-disabled mode: create without `division_id`; confirm auto-assignment
- Cross-tenant isolation: parallel requests for two tenants must return disjoint datasets
- License enforcement: SOFT_LOCKED license → 423; ARCHIVED license → 403
- Schema version mismatch: request against downlevel tenant → 409

### Additional Required Tests

- **Transaction rollback test:** Inject failure after uniqueness check, before insert; confirm no
  row persisted.
- **Idempotency test:** Submit identical create requests twice; confirm second returns 409 (not
  500 or silent duplicate).
- **Concurrent creation test:** Two simultaneous requests with the same `name`; confirm exactly
  one succeeds and one receives 409.
- **Version compatibility test:** Migration applied to a tenant at N-1 schema version; confirm
  migration advances to N without data loss.
- **Isolation test:** Query subjects from tenant A while tenant B creates subjects concurrently;
  confirm zero data leakage.
