# Spec: Lessons

**Feature Branch**: `spec/029-lessons`
**Stage**: `STAGE_29_LESSONS`
**Phase**: `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE`
**Created**: 2026-03-21
**Status**: DRAFT
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_29_LESSONS.md`

---

## Overview

This stage implements **Lesson** as the smallest structured academic classification unit under
Subject. Lessons enable fine-grained categorization of MCQ questions, traditional questions,
auto-selection filters, and analytics breakdowns within a subject.

**What is being built:**

- A `lessons` table per-tenant containing: `subject_id` FK, `name`, optional `code`,
  optional `description`, `status` (`ENABLED | DISABLED`), and full audit columns
  (`created_at`, `updated_at`, `created_by`, `updated_by`).
- A complete Lesson CRUD API (list, create, read, update, soft-delete) accessible to authorized
  Backoffice staff, protected by tenant resolver and license middleware.
- Status lifecycle management: lessons are disabled via status change (no SQL hard delete exposed).
- Foreign key enforcement: a Subject cannot be deleted while lessons reference it; a Lesson cannot
  be created without a valid Subject.
- Uniqueness enforcement: lesson names must be unique within the same subject.
- Permission gating: all writes require `question_manage` OR `subject_manage` permission.
- Division-level access scoping inherited transitively from the parent Subject.

**What Lesson provides:**

| Use Case                     | How Lessons Are Applied                                                      |
| ---------------------------- | ---------------------------------------------------------------------------- |
| MCQ question tagging         | Every MCQ question may be tagged with a lesson for content segmentation      |
| Traditional question scope   | Traditional questions scoped to a lesson within a subject                    |
| Auto-selection filtering     | Exam auto-selection engines filter question pools by lesson                  |
| Analytics breakdown          | Exam results and pass rates aggregated per lesson within a subject           |
| Backoffice UI classification | Lessons drive the content-classification tree in Backoffice content creators |

**Affected system areas:**

| Area                | Affected? | Notes                                                                         |
| ------------------- | --------- | ----------------------------------------------------------------------------- |
| Tenant Isolation    | Yes       | `lessons` table resides exclusively in tenant DB; never shared across tenants |
| License Enforcement | Yes       | License middleware mandatory for all workspace lesson routes                  |
| Subjects            | Yes       | `subject_id` FK created; Subject deletion blocked when lessons exist          |
| Attempt Engine      | No        | Lesson FK in downstream content is snapshot-captured at attempt start         |
| Worker              | No        | Lesson CRUD is synchronous; no background processing required                 |
| Frontoffice         | No        | Frontoffice inherits lesson context via enrolled exam; no direct lesson CRUD  |
| Academic Content    | Yes       | Lesson is a pre-requisite dependency for MCQ Questions, Traditional Questions |

---

## Constitutional Compliance Declaration

This specification is validated against **Zidney Constitution v1.2.0**.

| Rule                                   | Compliance                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| No cross-tenant access                 | ✓ `lessons` table resides exclusively within the tenant DB                         |
| No middleware bypass                   | ✓ Tenant resolver → license middleware mandatory before any lesson route           |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic                                  |
| No direct DB instantiation             | ✓ All DB access from tenant resolver context; no global singleton                  |
| No weakening of snapshot integrity     | ✓ Lesson FK in downstream content is immutable after attempt capture               |
| No weakening of transaction boundaries | ✓ All writes (create, update, soft-delete) are wrapped in explicit transactions    |
| No weakening of version enforcement    | ✓ Schema version incremented; migration is forward-only                            |
| Server-authoritative time only         | ✓ `created_at`/`updated_at` set by server; no client-supplied timestamps           |
| No console.log allowed                 | ✓ All logging via structured logger with required fields                           |
| Division boundary preserved            | ✓ Division scoping inherited from Subject; no direct division reference in lessons |

---

## User Stories

### US-01 — Create a Lesson (Priority: P1)

**As a** Backoffice administrator or content manager with `question_manage` or `subject_manage`
permission,
**I want to** create a lesson under an existing subject,
**So that** I can classify questions and exam content at a granular level within that subject.

**Acceptance Scenarios:**

1. **Given** an active workspace license and a valid subject, **When** a user with `question_manage`
   permission sends a create request with a unique name within that subject, **Then** the lesson is
   persisted with `status = ENABLED`, and the response envelope contains the created lesson row.
2. **Given** a lesson with the same name already exists for the same subject, **When** a second
   create request uses the same subject and name, **Then** the API returns 409 Conflict with error
   code `LESSON_NAME_DUPLICATE`.
3. **Given** a create request references a `subject_id` that does not exist in the tenant DB,
   **Then** the API returns 404 Not Found with error code `LESSON_SUBJECT_NOT_FOUND`.
4. **Given** a create request references a `subject_id` belonging to another tenant, **Then** the
   API returns 404 Not Found (no 403, to prevent information leakage).
5. **Given** a `name` field is missing or empty, **Then** the API returns 422 with error code
   `VALIDATION_ERROR` and a descriptive field-level message.
6. **Given** a staff member without `question_manage` AND without `subject_manage` permission,
   **When** they attempt to create a lesson, **Then** the API returns 403 Forbidden.

---

### US-02 — List Lessons (Priority: P1)

**As a** Backoffice content creator,
**I want to** list all lessons under a given subject with optional filters,
**So that** I can select the correct lesson when creating or editing a question.

**Acceptance Scenarios:**

1. **Given** multiple lessons exist under a subject, **When** the list endpoint is called with
   `subject_id` filter and no other filters, **Then** all non-deleted lessons for that subject are
   returned with pagination metadata.
2. **Given** a `status` filter is applied, **Then** only lessons matching that status are returned.
3. **Given** a `search` query is supplied, **Then** only lessons whose `name` matches (case-
   insensitive partial match) are returned.
4. **Given** no `subject_id` filter is supplied, **Then** the endpoint lists lessons across all
   subjects accessible to the requester (subject to tenant isolation).
5. **Given** an invalid `page` or `limit` value, **Then** the API returns 422 with
   error code `VALIDATION_ERROR`.

---

### US-03 — Get a Single Lesson (Priority: P1)

**As a** Backoffice content manager,
**I want to** retrieve the full details of a single lesson by ID,
**So that** I can view or audit its configuration.

**Acceptance Scenarios:**

1. **Given** a valid `id` belonging to the current tenant, **When** the get endpoint is called,
   **Then** the full lesson row is returned.
2. **Given** an `id` that does not exist in the tenant DB, **Then** the API returns 404 with error
   code `LESSON_NOT_FOUND`.
3. **Given** an `id` belonging to another tenant, **Then** the API returns 404 (no 403).

---

### US-04 — Update a Lesson (Priority: P1)

**As a** Backoffice administrator,
**I want to** update a lesson's name, code, or description,
**So that** I can correct errors or improve clarity without recreating the lesson.

**Acceptance Scenarios:**

1. **Given** a valid lesson `id` and a new unique name within the same subject, **When** an update
   request is submitted, **Then** the lesson is updated and the response contains the updated row.
2. **Given** an update request changes `name` to a value already taken by another lesson under the
   same subject, **Then** the API returns 409 Conflict with error code `LESSON_NAME_DUPLICATE`.
3. **Given** an update request on a lesson with status `DISABLED`, **Then** the API returns 422
   with error code `LESSON_DISABLED` (lesson is disabled; re-enable before editing name/code).
4. **Given** a staff member without `question_manage` AND without `subject_manage` permission,
   **Then** the API returns 403 Forbidden.

---

### US-05 — Disable (Soft-Delete) a Lesson (Priority: P1)

**As a** Backoffice administrator,
**I want to** disable a lesson that is no longer relevant,
**So that** it cannot be selected in new content while preserving historical data integrity.

**Acceptance Scenarios:**

1. **Given** a lesson with status `ENABLED`, **When** a delete request is sent, **Then** the
   lesson's `status` is set to `DISABLED` and the response returns `{ deleted: true }`.
2. **Given** a lesson that is already `DISABLED`, **When** a delete request is sent, **Then** the
   API returns 422 with error code `LESSON_ALREADY_DISABLED`.
3. **Given** a lesson that is referenced by MCQ questions, traditional questions, auto-selection
   configurations, or exam configurations, **When** a hard SQL DELETE is attempted (only possible
   via internal tooling), **Then** the FK constraint (`ON DELETE RESTRICT` on downstream tables)
   prevents deletion at the database level.
4. **Given** a staff member without the required permissions, **Then** the API returns 403
   Forbidden.

---

### US-06 — Re-enable a Lesson (Priority: P2)

**As a** Backoffice administrator,
**I want to** re-enable a previously disabled lesson,
**So that** it can be used in new question creation or auto-selection filters again.

**Acceptance Scenarios:**

1. **Given** a lesson with status `DISABLED`, **When** an update request sets `status = ENABLED`,
   **Then** the lesson's status is updated and the response contains the updated row.
2. **Given** a lesson with status `ENABLED`, **When** an update request sets `status = ENABLED`,
   **Then** the API returns 422 with error code `LESSON_ALREADY_ENABLED`.

---

## Data Model

### Table: `lessons` (Tenant DB only)

| Column        | Type           | Constraints                                       | Notes                        |
| ------------- | -------------- | ------------------------------------------------- | ---------------------------- |
| `id`          | `UUID`         | `PRIMARY KEY DEFAULT gen_random_uuid()`           |                              |
| `subject_id`  | `UUID`         | `NOT NULL`, `FK → subjects.id ON DELETE RESTRICT` | Mandatory parent             |
| `name`        | `VARCHAR(255)` | `NOT NULL`                                        | Unique within subject        |
| `code`        | `VARCHAR(100)` | `NULLABLE`                                        | Optional free-form code      |
| `description` | `TEXT`         | `NULLABLE`                                        |                              |
| `status`      | `VARCHAR(20)`  | `NOT NULL DEFAULT 'ENABLED'`                      | ENUM: `ENABLED \| DISABLED`  |
| `created_at`  | `TIMESTAMPTZ`  | `NOT NULL DEFAULT NOW()`                          | Server-set                   |
| `updated_at`  | `TIMESTAMPTZ`  | `NOT NULL DEFAULT NOW()`                          | Server-set on every write    |
| `created_by`  | `UUID`         | `NULLABLE`, `FK → users.id ON DELETE SET NULL`    | Audit: creator user ID       |
| `updated_by`  | `UUID`         | `NULLABLE`, `FK → users.id ON DELETE SET NULL`    | Audit: last modifier user ID |

**Status CHECK constraint:**

```sql
CONSTRAINT lessons_status_check CHECK (status IN ('ENABLED', 'DISABLED'))
```

**Unique constraint:**

```sql
CONSTRAINT lessons_subject_name_key UNIQUE (subject_id, name)
```

### Indexes

| Index Name                 | Columns              | Type   | Purpose                      |
| -------------------------- | -------------------- | ------ | ---------------------------- |
| `idx_lessons_subject_id`   | `subject_id`         | B-tree | Subject-scoped queries       |
| `idx_lessons_status`       | `status`             | B-tree | Status-filtered list queries |
| `lessons_subject_name_key` | `(subject_id, name)` | Unique | Uniqueness enforcement       |

### Migration File

Naming follows existing pattern: `YYYYMMDD_NNN_name.ts`

Planned file: `apps/api/src/db/tenant/migrations/20260321_007_lessons.ts`

Schema version increment: `1.12.0 → 1.13.0`

All DDL wrapped in `BEGIN / COMMIT`. Down migration not provided (forward-only per ADR-0008).

### Entity Relationships

```
divisions
    └── subjects (division_id FK)
            └── lessons (subject_id FK)   ← THIS STAGE
                    └── mcq_questions (lesson_id FK — downstream)
                    └── traditional_questions (lesson_id FK — downstream)
```

---

## API Contracts

All lesson routes are registered under the workspace Backoffice namespace:
`/workspace/:slug/backoffice/` (prefix handled by the outer Hono app and tenant/license
middleware stack).

Route file: `apps/api/src/routes/backoffice/lessons/index.ts`

> **Static paths must be declared before parameterised paths** (Hono routing rule.)

### Route Table

| Method   | Path           | Handler function      | Description                               |
| -------- | -------------- | --------------------- | ----------------------------------------- |
| `GET`    | `/lessons`     | `listLessonsHandler`  | Paginated list with optional filters      |
| `POST`   | `/lessons`     | `createLessonHandler` | Create a new lesson                       |
| `GET`    | `/lessons/:id` | `getLessonHandler`    | Get single lesson by ID                   |
| `PATCH`  | `/lessons/:id` | `updateLessonHandler` | Update name, code, description, or status |
| `DELETE` | `/lessons/:id` | `deleteLessonHandler` | Soft-delete (set status = DISABLED)       |

---

### GET /lessons

**Query Parameters:**

| Parameter    | Type     | Required | Description                          |
| ------------ | -------- | -------- | ------------------------------------ |
| `subject_id` | `UUID`   | No       | Filter by parent subject             |
| `status`     | `string` | No       | `ENABLED` \| `DISABLED`              |
| `search`     | `string` | No       | Partial case-insensitive name search |
| `page`       | `number` | No       | Default `1`, min `1`                 |
| `limit`      | `number` | No       | Default `20`, min `1`, max `100`     |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "subject_id": "uuid",
        "name": "string",
        "code": "string | null",
        "description": "string | null",
        "status": "ENABLED | DISABLED",
        "created_at": "ISO8601",
        "updated_at": "ISO8601",
        "created_by": "uuid | null",
        "updated_by": "uuid | null"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  },
  "error": null
}
```

---

### POST /lessons

**Request Body:**

```json
{
  "subject_id": "uuid (required)",
  "name": "string (required, max 255)",
  "code": "string | null (optional, max 100)",
  "description": "string | null (optional)"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "data": { "<lesson row>" },
  "error": null
}
```

**Error Responses:**

| HTTP | Error Code                 | Condition                                       |
| ---- | -------------------------- | ----------------------------------------------- |
| 404  | `LESSON_SUBJECT_NOT_FOUND` | `subject_id` does not exist in tenant DB        |
| 409  | `LESSON_NAME_DUPLICATE`    | `(subject_id, name)` already exists             |
| 422  | `VALIDATION_ERROR`         | Missing required fields or invalid field values |
| 403  | `FORBIDDEN`                | Missing `question_manage` AND `subject_manage`  |
| 423  | `LICENSE_LOCKED`           | Workspace license is `SOFT_LOCKED`              |

---

### GET /lessons/:id

**Path Parameters:** `id` (UUID)

**Success Response (200):**

```json
{
  "success": true,
  "data": { "<lesson row>" },
  "error": null
}
```

**Error Responses:**

| HTTP | Error Code         | Condition                          |
| ---- | ------------------ | ---------------------------------- |
| 404  | `LESSON_NOT_FOUND` | Lesson does not exist in tenant DB |

---

### PATCH /lessons/:id

**Request Body (all fields optional):**

```json
{
  "name": "string (max 255)",
  "code": "string | null (max 100)",
  "description": "string | null",
  "status": "ENABLED | DISABLED"
}
```

At least one field must be provided. `subject_id` is immutable after creation.

**Success Response (200):**

```json
{
  "success": true,
  "data": { "<updated lesson row>" },
  "error": null
}
```

**Error Responses:**

| HTTP | Error Code                | Condition                                        |
| ---- | ------------------------- | ------------------------------------------------ |
| 404  | `LESSON_NOT_FOUND`        | Lesson not found                                 |
| 409  | `LESSON_NAME_DUPLICATE`   | New `(subject_id, name)` already taken           |
| 422  | `LESSON_DISABLED`         | Lesson is DISABLED; re-enable before field edits |
| 422  | `LESSON_ALREADY_ENABLED`  | Status update to ENABLED on already-ENABLED      |
| 422  | `LESSON_ALREADY_DISABLED` | Status update to DISABLED on already-DISABLED    |
| 422  | `VALIDATION_ERROR`        | Invalid field values                             |
| 403  | `FORBIDDEN`               | Missing required permission                      |

---

### DELETE /lessons/:id

Performs a **soft delete** by setting `status = DISABLED`. No SQL `DELETE` is issued.

**Success Response (200):**

```json
{
  "success": true,
  "data": { "deleted": true },
  "error": null
}
```

**Error Responses:**

| HTTP | Error Code                | Condition                   |
| ---- | ------------------------- | --------------------------- |
| 404  | `LESSON_NOT_FOUND`        | Lesson not found            |
| 422  | `LESSON_ALREADY_DISABLED` | Lesson is already DISABLED  |
| 403  | `FORBIDDEN`               | Missing required permission |

---

## Business Rules

### BR-01: Subject Ownership is Immutable

Once a lesson is created, its `subject_id` cannot be changed. Any update request that includes
`subject_id` must return 422 `VALIDATION_ERROR` (or the field must be stripped from the PATCH
schema entirely).

### BR-02: Name Uniqueness is Subject-Scoped

Lesson names must be unique within a given subject. Two lessons in different subjects may share
the same name. Uniqueness is enforced via the `UNIQUE (subject_id, name)` constraint at the
database level and validated at the service layer before insert/update.

### BR-03: Soft Delete Only

The API never issues a SQL `DELETE` on lessons. The `DELETE /lessons/:id` endpoint performs a
status transition to `DISABLED`. The database-level `ON DELETE RESTRICT` FK constraints on
downstream tables (questions, auto-selection configs, exam configs) prevent any accidental
hard deletion from internal tooling.

### BR-04: Disabled Lessons are Read-Only

A `DISABLED` lesson cannot have its `name`, `code`, or `description` updated. The `status` field
is the only mutable field on a DISABLED lesson (to re-enable it). Any PATCH request that attempts
to modify other fields on a DISABLED lesson returns 422 `LESSON_DISABLED`.

### BR-05: Division Scoping via Subject

Lessons do not store a `division_id` directly. Access control at the division level is inherited
from the parent Subject. A user with division-restricted access permissions only sees lessons
belonging to subjects within their accessible divisions.

### BR-06: Status Lifecycle

```
ENABLED  ←───────────────────────────────────────────────────────┐
   │                                                              │
   │  DELETE /lessons/:id  (soft delete)         PATCH status=ENABLED
   ▼                                                              │
DISABLED ─────────────────────────────────────────────────────────┘
```

Initial status on creation: `ENABLED`.

### BR-07: All Writes Transactional

Every create, update, and soft-delete operation must be wrapped in an explicit `BEGIN / COMMIT /
ROLLBACK` block managed by the service layer. Repository functions do not open transactions.

### BR-08: `updated_by` Audit Column

On every write (create, update, soft-delete), `created_by` is set once at creation and never
updated; `updated_by` is set to the acting user ID on every mutation. `ON DELETE SET NULL` ensures
referential integrity if the user is later removed.

---

## Access Control

### Permission Requirements

All write endpoints (`POST`, `PATCH`, `DELETE`) require the acting user to hold at least one of:

| Permission        | Description                                        |
| ----------------- | -------------------------------------------------- |
| `question_manage` | Full access to manage questions and classification |
| `subject_manage`  | Full access to manage subjects and their children  |

Read endpoints (`GET /lessons`, `GET /lessons/:id`) require any authenticated Backoffice user
with access to the workspace (standard session + license validation is sufficient for reads).

### Tenant Isolation

- All lesson queries include the tenant-scoped DB client obtained from `c.get('tenant').pool`.
- No cross-tenant joins. No global DB singleton.
- Tenant resolved via subdomain or path slug before any route handler executes.

### License Middleware

All workspace lesson routes must execute after the license middleware:

| License State | HTTP Response | Error Code          |
| ------------- | ------------- | ------------------- |
| `ACTIVE`      | Continue      | —                   |
| `SOFT_LOCKED` | 423 Locked    | `LICENSE_LOCKED`    |
| `ARCHIVED`    | 403 Forbidden | `LICENSE_ARCHIVED`  |
| `NOT_FOUND`   | 404 Not Found | `LICENSE_NOT_FOUND` |

### Schema Version Enforcement

Requests to tenants whose `schema_version < MIN_SCHEMA_VERSION` are rejected with 409
`SCHEMA_VERSION_MISMATCH` before any lesson business logic executes.

---

## Validation Rules

### `POST /lessons` — createLessonBodySchema

| Field         | Rule                                                              |
| ------------- | ----------------------------------------------------------------- |
| `subject_id`  | Required. Valid UUID format.                                      |
| `name`        | Required. Non-empty string. Max 255 characters.                   |
| `code`        | Optional. Max 100 characters. `null` allowed.                     |
| `description` | Optional. `null` allowed. No max length enforced at schema level. |

### `PATCH /lessons/:id` — updateLessonBodySchema

| Field         | Rule                                                        |
| ------------- | ----------------------------------------------------------- |
| `name`        | Optional. Non-empty string if provided. Max 255 characters. |
| `code`        | Optional. Max 100 characters. `null` allowed.               |
| `description` | Optional. `null` allowed.                                   |
| `status`      | Optional. Must be `ENABLED` or `DISABLED` if provided.      |
| `subject_id`  | **Forbidden in PATCH.** Must not be present.                |

At least one field must be present in the body (zod `.refine()` minimum).

### `GET /lessons` — listLessonsQuerySchema

| Field        | Rule                                     |
| ------------ | ---------------------------------------- |
| `subject_id` | Optional. Valid UUID format if provided. |
| `status`     | Optional. `ENABLED` \| `DISABLED`.       |
| `search`     | Optional. String. Max 100 characters.    |
| `page`       | Optional. Integer ≥ 1. Default `1`.      |
| `limit`      | Optional. Integer 1–100. Default `20`.   |

### Path Parameter — `lessonParamsSchema`

| Field | Rule                         |
| ----- | ---------------------------- |
| `id`  | Required. Valid UUID format. |

---

## Error Handling

All API responses follow the Zidney error contract:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "LESSON_NOT_FOUND",
    "message": "Lesson not found."
  }
}
```

### Error Code Registry

| Error Code                     | HTTP | Description                                                              |
| ------------------------------ | ---- | ------------------------------------------------------------------------ |
| `LESSON_NOT_FOUND`             | 404  | Lesson ID does not exist in tenant DB                                    |
| `LESSON_SUBJECT_NOT_FOUND`     | 404  | `subject_id` does not exist in tenant DB                                 |
| `LESSON_NAME_DUPLICATE`        | 409  | `(subject_id, name)` uniqueness violation                                |
| `LESSON_DISABLED`              | 422  | Lesson is DISABLED; field edits blocked                                  |
| `LESSON_ALREADY_DISABLED`      | 422  | Status update to DISABLED on already-DISABLED lesson                     |
| `LESSON_ALREADY_ENABLED`       | 422  | Status update to ENABLED on already-ENABLED lesson                       |
| `LESSON_HAS_DEPENDENT_CONTENT` | 422  | Hard delete blocked (surface this if a hard-delete path is ever exposed) |
| `VALIDATION_ERROR`             | 422  | Validation failure (field-level messages included)                       |

### Error Logging

All domain errors must be logged via `@zidney/logger` with:

- `correlation_id` — from `c.get('correlation_id')`
- `workspace_id` — from `c.get('workspace_id')`
- `error_code` — from the error instance
- `error_message` — from the error instance

Stack traces must **never** be returned in API responses.

---

## Non-Functional Requirements

### Indexes

The following indexes must be created in the tenant migration:

1. `idx_lessons_subject_id` on `(subject_id)` — all subject-scoped lesson queries
2. `idx_lessons_status` on `(status)` — status-filtered list queries
3. `UNIQUE (subject_id, name)` — uniqueness enforcement at DB level

### Query Requirements

The list endpoint must support server-side filtering for:

- `subject_id` — equality filter
- `status` — equality filter
- `search` — case-insensitive partial match on `name` (e.g., `ILIKE '%term%'`)

Pagination uses offset-based strategy matching the subjects list pattern:
`offset = (page - 1) * limit`.

### Performance Expectations

- List endpoint with `subject_id` filter: indexed, no full table scan.
- All foreign key columns must be covered by an index.
- `CREATE` and `UPDATE` operations must complete within a single short transaction.

### Structured Logging

Every route handler must emit structured log entries using `@zidney/logger`:

```ts
logger.debug("Create lesson", {
  correlation_id: c.get("correlation_id"),
  workspace_id: c.get("workspace_id"),
  subject_id: body.subject_id,
  name: body.name,
});
```

Operations that mutate state must log at `info` level on success and `warn` level on domain
errors.

### Idempotency

`POST /lessons` is not inherently idempotent. Duplicate requests with the same `(subject_id, name)` pair will be rejected at the service layer with `LESSON_NAME_DUPLICATE` (409) before hitting the DB unique constraint. This provides a clean error signal without relying on constraint exceptions.

### Migration Safety

- Migration file must be forward-only (no `down()` function exposed to the migration runner).
- All DDL statements within the migration must be idempotent (`IF NOT EXISTS` guards).
- FK constraints must be wrapped in `DO $$ BEGIN / IF NOT EXISTS / END $$` blocks.
- Schema version must be incremented atomically within the same transaction.

---

## Implementation File Map

Following the subjects domain pattern, the planned implementation files are:

```
packages/domain-core/src/lessons/
  lessons.types.ts               — DbClient, AuditContext, LessonRow, input/result types
  lessons.errors.ts              — LessonsErrorCode, LESSONS_ERROR_HTTP_STATUS, LessonsError
  lessons.repository.ts          — Pure SQL query functions (no transactions)
  lessons.service.ts             — Business logic with transaction management
  lessons.dependency-registry.ts — Downstream dependency check (blocked-delete guard)
  index.ts                       — Public exports

packages/validation/src/backoffice/
  lessons.schemas.ts             — Zod schemas: list query, create body, update body, params

apps/api/src/routes/backoffice/lessons/
  index.ts                       — Router factory
  list-lessons.ts                — GET /lessons
  create-lesson.ts               — POST /lessons
  get-lesson.ts                  — GET /lessons/:id
  update-lesson.ts               — PATCH /lessons/:id
  delete-lesson.ts               — DELETE /lessons/:id
  helpers.ts                     — getDb, buildAuditCtx, successResponse, lessonsErrorResponse

apps/api/src/db/tenant/migrations/
  20260321_007_lessons.ts        — Forward-only DDL migration
```

---

## Out of Scope

- **Hard delete endpoint**: No `DELETE` SQL path is exposed. Lessons are soft-deleted only.
- **Lesson translations / multi-language**: Lesson names are stored in a single language per row.
  Multi-language support for lessons is deferred to the translation infrastructure stage.
- **Lesson ordering / sequence numbers**: Lessons have no defined order within a subject in this
  stage. Ordering is a downstream UI concern.
- **Bulk operations**: Bulk create, bulk update, or bulk disable of lessons is not included.
- **Lesson-level permissions**: No per-lesson permission model. Access is controlled at the
  workspace and subject level.
- **Content counts**: Lesson-level question counts or coverage metrics are not computed in this
  stage. This is a downstream analytics concern.
- **Frontoffice API for lessons**: Frontoffice access to lesson data (for display in exam
  results) is deferred to the relevant Frontoffice stage.
- **Subject-count license limits**: No lesson-count license cap is introduced in this stage.
- **Lesson reuse across subjects**: A lesson is permanently scoped to one subject and cannot be
  linked to or copied across subjects.

---

## Open Questions

_(none — all decisions resolved at specification time using available context and project
conventions)_
