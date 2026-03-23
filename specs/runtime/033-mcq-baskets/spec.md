# Feature Specification: MCQ Baskets

**Feature Branch**: `spec/033-mcq-baskets`
**Stage**: `STAGE_33_MCQ_BASKETS`
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`
**Created**: 2026-03-23
**Status**: DRAFT
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/03_CONTENT_CLASSIFICATION/STAGE_33_MCQ_BASKETS.md`

---

## Overview

This stage implements **MCQ Basket** as a structured grouping tool for curating collections of MCQ
questions within Zidney tenant workspaces. Baskets serve as the runtime grouping layer between
classification entities (Subject, Lesson, Category, Tag) and exam composition tooling (manual
assembly and auto-selection engine).

**What is being built:**

- A `mcq_baskets` table per-tenant: named, coded containers with two types (`LINKED` / `UNLINKED`)
  and a full workflow lifecycle managed by the shared status workflow engine.
- A `mcq_basket_questions` join table linking baskets to MCQ questions with uniqueness enforcement
  and cascade-safe constraints.
- Complete Basket CRUD API endpoints (create, list, get, update, delete), all protected by tenant
  resolver → license middleware.
- Basket-Question link/unlink API: add a question to a basket; remove a question from a basket;
  list questions in a basket.
- Workflow status transition API: drive baskets through the standard lifecycle
  `DRAFT → COMPLETED → UNDER_REVIEW → APPROVED → ENABLED` via the shared workflow engine.
- Deletion guard: prevent deletion of any basket referenced by an MCQ exam configuration or an
  auto-selection rule.
- Auto-selection compatibility: `mcq_basket_questions` supports indexed subquery lookups used by
  the question selection engine.

**What Basket is:**

- A curated or rule-bound container of MCQ questions grouped for reuse across exam configurations.
- A filter dimension in the auto-selection engine (`subject → division → basket → category/tag`).
- A lightweight grouping layer — it does not carry classification authority or override
  question-level metadata.

**What Basket is NOT:**

- Basket is not a classification dimension (it does not replace Subject, Lesson, Category, or Tag).
- Basket does not enforce subject or division override on member questions.
- Basket carries no grading logic; it has no attempt-engine footprint beyond snapshot reference.
- Basket is not responsible for exam assembly directly — it acts as a named pool available to exam
  configuration.

**Two basket types:**

| Type       | Semantics                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `LINKED`   | Basket is logically tied to a subject/division context. Inclusion should respect classification. |
| `UNLINKED` | Free container with no classification enforcement. Used for marketing bundles or custom sets.    |

**Affected system areas:**

| Area                | Affected? | Notes                                                                             |
| ------------------- | --------- | --------------------------------------------------------------------------------- |
| Tenant Isolation    | Yes       | `mcq_baskets` and `mcq_basket_questions` reside in tenant DB only                 |
| License Enforcement | Yes       | License middleware mandatory for all workspace basket routes                      |
| Status Workflow     | Yes       | Basket lifecycle managed by shared workflow engine; no custom state machine       |
| MCQ Questions       | Yes       | `mcq_basket_questions` creates FK dependency on `mcq_questions.id`                |
| Exam Configuration  | Yes       | Deletion guard checks references in exam configuration tables                     |
| Auto-Selection      | Yes       | Basket filter uses indexed subquery into `mcq_basket_questions`                   |
| Attempt Engine      | No        | Basket reference is snapshot-captured at attempt start; no live basket reads      |
| Worker              | No        | Basket CRUD and link/unlink are synchronous; no background job required           |
| Frontoffice         | No        | Basket is a Backoffice composition tool; no student-facing exposure in this stage |

---

## Constitutional Compliance Declaration

This specification is validated against **Zidney Constitution v1.2.0**.

| Rule                                   | Compliance                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| No cross-tenant access                 | ✓ `mcq_baskets` and `mcq_basket_questions` reside exclusively in the tenant DB                                  |
| No middleware bypass                   | ✓ Tenant resolver → license middleware are mandatory before any basket route handler                            |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic                                                               |
| No direct DB instantiation             | ✓ All DB access via tenant resolver context; no global singleton                                                |
| No weakening of snapshot integrity     | ✓ Basket FK in exam config is snapshot-captured at attempt start; no live basket reads during exam              |
| No weakening of transaction boundaries | ✓ All writes (create, update, link, unlink, delete) execute inside an explicit transaction                      |
| No weakening of version enforcement    | ✓ Schema version incremented; migrations are forward-only and never modify existing migration files             |
| Server-authoritative time only         | ✓ All `created_at` / `updated_at` timestamps set server-side; no client-supplied timestamps accepted            |
| No console.log allowed                 | ✓ All logging via structured logger with required fields                                                        |
| Division boundary preserved            | ✓ Basket has no interaction with division isolation rules                                                       |
| Idempotency enforced                   | ✓ Link operation is idempotent via `UNIQUE(basket_id, question_id)`; duplicate link returns 409, not 500        |
| Rate limiting enforced                 | ✓ Platform rate-limiting middleware applied; write routes ≤ 30 req/min, read routes ≤ 120 req/min per workspace |

No exceptions requiring a new ADR were detected for this stage.

---

## Isolation Impact Analysis

| Concern             | Detail                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| Database accessed   | Tenant DB only. Zero master DB access.                                                             |
| Tenant resolution   | Resolved from workspace slug (subdomain or path) before any route handler executes.                |
| Connection pool     | Obtained from `c.get('tenant').pool` — the per-tenant pool injected by tenant resolver middleware. |
| Resolver middleware | Tenant resolver + license middleware run before every basket route handler.                        |
| New tables          | `mcq_baskets`, `mcq_basket_questions` — both in tenant DB only.                                    |
| Shared tenant data  | None. Baskets are tenant-private. Cross-tenant access is structurally impossible.                  |

---

## License & Version Enforcement

| Concern                | Detail                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| License middleware     | Yes — mandatory on all workspace basket routes                                                                      |
| Allowed license states | `ACTIVE` only. `SOFT_LOCKED` → 423. `ARCHIVED` → 403. `NOT_FOUND` → 404.                                            |
| Schema version check   | Yes — requests to tenants below `MIN_SCHEMA_VERSION` for this stage are rejected with 409 `SCHEMA_VERSION_MISMATCH` |
| Product version check  | Enforced at request boundary per Constitution.                                                                      |

---

## Data Model

### Table: `mcq_baskets`

| Column              | Type         | Constraints                                                                                                                                     |
| ------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | UUID         | Primary key                                                                                                                                     |
| `name`              | VARCHAR(255) | NOT NULL                                                                                                                                        |
| `code`              | VARCHAR(100) | NOT NULL, UNIQUE per workspace                                                                                                                  |
| `type`              | VARCHAR(20)  | NOT NULL, CHECK IN (`LINKED`, `UNLINKED`)                                                                                                       |
| `max_questions`     | INTEGER      | Nullable — when `null`, no question-count cap is enforced (unlimited); when set (positive integer), enforced during link and enable transitions |
| `description`       | TEXT         | Nullable                                                                                                                                        |
| `status`            | VARCHAR(30)  | NOT NULL, managed by workflow engine                                                                                                            |
| `created_at`        | TIMESTAMPTZ  | NOT NULL, server-set                                                                                                                            |
| `updated_at`        | TIMESTAMPTZ  | NOT NULL, server-set                                                                                                                            |
| `created_by`        | UUID         | Nullable, FK → `users.id`                                                                                                                       |
| `updated_by`        | UUID         | Nullable, FK → `users.id`                                                                                                                       |
| `status_updated_at` | TIMESTAMPTZ  | Nullable — set by workflow engine on every status transition                                                                                    |
| `status_updated_by` | UUID         | Nullable, FK → `users.id` — set by workflow engine on every status transition                                                                   |

**Indexes:**

- `UNIQUE (code)` — unique basket code per workspace
- `idx_mcq_baskets_type` — supports type-filtered list queries
- `idx_mcq_baskets_status` — supports status-filtered list queries

**Valid status values (workflow-managed):**

`DRAFT` → `COMPLETED` → `UNDER_REVIEW` → `APPROVED` → `ENABLED`

Status is never set directly via the CRUD update endpoint. Transitions are driven exclusively
through the shared workflow engine transition endpoint.

---

### Table: `mcq_basket_questions`

| Column        | Type        | Constraints                                         |
| ------------- | ----------- | --------------------------------------------------- |
| `id`          | UUID        | Primary key                                         |
| `basket_id`   | UUID        | NOT NULL, FK → `mcq_baskets.id` ON DELETE CASCADE   |
| `question_id` | UUID        | NOT NULL, FK → `mcq_questions.id` ON DELETE CASCADE |
| `created_at`  | TIMESTAMPTZ | NOT NULL, server-set                                |

**Constraints:**

- `UNIQUE (basket_id, question_id)` — prevents duplicate question entries in same basket

**Indexes:**

- `idx_mcq_basket_questions_basket_id` — basket → question lookups
- `idx_mcq_basket_questions_question_id` — question → basket lookups

**Cascade rules:**

- Deleting `mcq_questions` row → CASCADE removes `mcq_basket_questions` rows for that question
- Deleting `mcq_baskets` row → CASCADE removes all `mcq_basket_questions` rows for that basket

---

## API Endpoints

All endpoints are prefixed under the workspace-scoped Backoffice route. All requests pass through:
**tenant resolver middleware → license middleware → permission check → handler.**

Error response shape for all endpoints:

```json
{
  "success": false,
  "data": null,
  "error": { "code": "ERROR_CODE", "message": "Human-readable message" }
}
```

---

### Basket Management

#### `POST /workspace/:slug/mcq-baskets`

Create a new basket.

**Permission required:** `question_manage` OR `content_manage`

**Request body:**

```json
{
  "name": "string",
  "code": "string",
  "type": "LINKED | UNLINKED",
  "maxQuestions": 100,
  "description": "string"
}
```

- `name` — required, non-empty string
- `code` — required, non-empty string, must be unique per workspace
- `type` — required, one of `LINKED` or `UNLINKED`
- `maxQuestions` — optional, positive integer
- `description` — optional

**Basket is created with `status = DRAFT`.**

**Success:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "code": "string",
    "type": "LINKED",
    "maxQuestions": 100,
    "description": "string",
    "status": "DRAFT",
    "questionCount": 0,
    "createdAt": "iso8601",
    "updatedAt": "iso8601"
  },
  "error": null
}
```

**Error cases:**

| Status | Error Code              | Condition                                 |
| ------ | ----------------------- | ----------------------------------------- |
| 409    | `BASKET_CODE_DUPLICATE` | `code` already used in this workspace     |
| 422    | `VALIDATION_ERROR`      | Missing required fields or invalid values |
| 403    | `FORBIDDEN`             | Insufficient permission                   |

---

#### `GET /workspace/:slug/mcq-baskets`

List baskets with optional filtering and pagination.

**Permission required:** `question_manage` OR `content_manage` OR `content_read`

**Query params:**

| Param      | Type                            | Description                       |
| ---------- | ------------------------------- | --------------------------------- |
| `type`     | `LINKED \| UNLINKED`            | Filter by basket type             |
| `status`   | workflow status value           | Filter by current status          |
| `search`   | string                          | Partial match on `name` or `code` |
| `page`     | integer (default: 1)            | Pagination page                   |
| `per_page` | integer (default: 20, max: 100) | Page size                         |

**Success:** `200 OK`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "string",
        "code": "string",
        "type": "LINKED",
        "maxQuestions": 100,
        "description": "string",
        "status": "ENABLED",
        "questionCount": 45,
        "createdAt": "iso8601",
        "updatedAt": "iso8601"
      }
    ],
    "total": 12,
    "page": 1,
    "perPage": 20
  },
  "error": null
}
```

---

#### `GET /workspace/:slug/mcq-baskets/:basketId`

Retrieve a single basket by ID.

**Permission required:** `question_manage` OR `content_manage` OR `content_read`

**Success:** `200 OK` — returns the full basket object including `questionCount`.

**Error cases:**

| Status | Error Code         | Condition             |
| ------ | ------------------ | --------------------- |
| 404    | `BASKET_NOT_FOUND` | Basket does not exist |

---

#### `PATCH /workspace/:slug/mcq-baskets/:basketId`

Update basket metadata (`name`, `code`, `maxQuestions`, `description`).

**Permission required:** `question_manage` OR `content_manage`

**Constraint:** `status` is NOT updatable via this endpoint. Use the workflow transition endpoint.

**Request body (partial update):**

```json
{
  "name": "string",
  "code": "string",
  "maxQuestions": 150,
  "description": "string"
}
```

**Success:** `200 OK` — returns the updated basket object.

**Error cases:**

| Status | Error Code              | Condition                            |
| ------ | ----------------------- | ------------------------------------ |
| 404    | `BASKET_NOT_FOUND`      | Basket does not exist                |
| 409    | `BASKET_CODE_DUPLICATE` | New `code` already used in workspace |
| 422    | `VALIDATION_ERROR`      | Invalid field value                  |
| 403    | `FORBIDDEN`             | Insufficient permission              |

---

#### `DELETE /workspace/:slug/mcq-baskets/:basketId`

Delete a basket permanently.

**Permission required:** `question_manage` OR `content_manage`

**Preconditions (deletion guard):**

1. Basket MUST NOT be referenced in any MCQ exam configuration — **regardless of that configuration's
   lifecycle status** (including DRAFT configurations). Any record in the exam configuration table
   that references the basket ID blocks deletion.
2. Basket MUST NOT be referenced in any auto-selection rule — **regardless of that rule's status**
   (including DRAFT rules). Any record in the auto-selection rule table that references the basket
   ID blocks deletion.
3. If either precondition fails, the deletion MUST be rejected. The basket may be disabled via
   workflow transition instead.

**Success:** `200 OK`

```json
{ "success": true, "data": { "deleted": true }, "error": null }
```

**Error cases:**

| Status | Error Code                            | Condition                                      |
| ------ | ------------------------------------- | ---------------------------------------------- |
| 404    | `BASKET_NOT_FOUND`                    | Basket does not exist                          |
| 409    | `BASKET_REFERENCED_IN_EXAM_CONFIG`    | Basket is referenced in an exam configuration  |
| 409    | `BASKET_REFERENCED_IN_AUTO_SELECTION` | Basket is referenced in an auto-selection rule |
| 403    | `FORBIDDEN`                           | Insufficient permission                        |

---

### Basket Workflow Transitions

Basket workflow state is managed exclusively via the **shared status workflow engine** —
no direct status mutation is allowed through the CRUD update endpoint.

#### `POST /workspace/:slug/mcq-baskets/:basketId/workflow/transition`

Trigger a workflow state transition on a basket.

**Permission required:** Transition-specific, mapped per the workflow engine configuration:

- `DRAFT → COMPLETED`: `question_manage` OR `content_manage`
- `COMPLETED → UNDER_REVIEW`: `question_manage` OR `content_manage`
- `UNDER_REVIEW → APPROVED`: `content_review` OR `question_manage`
- `APPROVED → ENABLED`: `content_review` OR `question_manage`

**Request body:**

```json
{ "to": "COMPLETED" }
```

**Valid transitions:**

| From           | To             | Condition                                                                             |
| -------------- | -------------- | ------------------------------------------------------------------------------------- |
| `DRAFT`        | `COMPLETED`    | No conditions (content author may mark basket complete)                               |
| `COMPLETED`    | `UNDER_REVIEW` | No conditions                                                                         |
| `UNDER_REVIEW` | `APPROVED`     | No conditions                                                                         |
| `APPROVED`     | `ENABLED`      | Basket MUST contain at least one question; MUST NOT exceed `max_questions` if defined |

**Guard: basket cannot be ENABLED when empty.**

**Guard: basket cannot be ENABLED when `max_questions` is defined and `questionCount > max_questions`.**

**Success:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "ENABLED",
    "updatedAt": "iso8601"
  },
  "error": null
}
```

**Error cases:**

| Status | Error Code                     | Condition                                                                                              |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 404    | `BASKET_NOT_FOUND`             | Basket does not exist                                                                                  |
| 400    | `INVALID_STATE_TRANSITION`     | Requested transition is not a valid forward step; backward transitions are not permitted in this stage |
| 422    | `BASKET_EMPTY_CANNOT_ENABLE`   | Attempting ENABLED transition on a basket with 0 questions                                             |
| 422    | `BASKET_EXCEEDS_MAX_QUESTIONS` | Basket question count exceeds `max_questions` at ENABLE time                                           |
| 403    | `FORBIDDEN`                    | Insufficient permission for this transition                                                            |

---

### Basket-Question Linking

#### `POST /workspace/:slug/mcq-baskets/:basketId/questions`

Add a question to a basket.

**Permission required:** `question_manage` OR `content_manage`

**Request body:**

```json
{ "questionId": "uuid" }
```

**Preconditions:**

1. Basket exists in the tenant.
2. Question exists in the tenant (`mcq_questions`).
3. `(basket_id, question_id)` combination does not already exist (idempotent uniqueness).

**Success:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "basketId": "uuid",
    "questionId": "uuid",
    "createdAt": "iso8601"
  },
  "error": null
}
```

**Error cases:**

| Status | Error Code                       | Condition                               |
| ------ | -------------------------------- | --------------------------------------- |
| 404    | `BASKET_NOT_FOUND`               | Basket does not exist                   |
| 404    | `QUESTION_NOT_FOUND`             | Question does not exist in tenant       |
| 409    | `BASKET_QUESTION_ALREADY_LINKED` | Question already linked to this basket  |
| 422    | `BASKET_MAX_QUESTIONS_REACHED`   | Adding would exceed `max_questions` cap |
| 403    | `FORBIDDEN`                      | Insufficient permission                 |

---

#### `DELETE /workspace/:slug/mcq-baskets/:basketId/questions/:questionId`

Remove a question from a basket.

**Permission required:** `question_manage` OR `content_manage`

**Success:** `200 OK`

```json
{ "success": true, "data": { "deleted": true }, "error": null }
```

**Error cases:**

| Status | Error Code                  | Condition                             |
| ------ | --------------------------- | ------------------------------------- |
| 404    | `BASKET_NOT_FOUND`          | Basket does not exist                 |
| 404    | `BASKET_QUESTION_NOT_FOUND` | Question is not linked to this basket |
| 403    | `FORBIDDEN`                 | Insufficient permission               |

---

#### `GET /workspace/:slug/mcq-baskets/:basketId/questions`

List all questions linked to a basket.

**Permission required:** `question_manage` OR `content_manage` OR `content_read`

**Query params:** `page`, `per_page`

**Success:** `200 OK`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "questionId": "uuid",
        "createdAt": "iso8601"
      }
    ],
    "total": 45,
    "page": 1,
    "perPage": 20
  },
  "error": null
}
```

**Error cases:**

| Status | Error Code         | Condition             |
| ------ | ------------------ | --------------------- |
| 404    | `BASKET_NOT_FOUND` | Basket does not exist |

---

### Basket Filtering on Entity Lists

When the question selection engine or exam configuration UI queries MCQ questions by basket, the
following filter is used as a subquery. This is referenced in the MCQ question list endpoint via a
`basketId` query parameter.

**Query parameter:** `basketId` (UUID) on the MCQ question list endpoint.

**Filtering logic:**

```sql
WHERE question_id IN (
  SELECT question_id
  FROM mcq_basket_questions
  WHERE basket_id = ?
)
```

**Performance requirement:** Filtering MUST use `idx_mcq_basket_questions_basket_id`. No sequential
scans on large question pools. No N+1 queries.

---

## User Scenarios & Testing

### User Story 1 – Content Manager Creates a Basket (Priority: P1)

A Backoffice content manager creates a new LINKED basket to curate a set of questions for a
specific subject-level exam pool.

**Why this priority:** Basket creation is the prerequisite for all grouping, linking, and exam
composition workflows. Without it nothing else can be tested.

**Independent Test:** Send a valid create request with `type = LINKED`, a unique `code`, and a
`name`. Verify the response has `status = DRAFT`, `questionCount = 0`, and the returned fields
match the input.

**Acceptance Scenarios:**

1. **Given** a valid name, code, and type, **When** a create request is sent, **Then** a basket is
   created with `status = DRAFT` and `questionCount = 0`.
2. **Given** a `code` that already exists in the workspace, **When** a create request is sent,
   **Then** the API returns `409 Conflict` with error code `BASKET_CODE_DUPLICATE`.
3. **Given** a `maxQuestions = 0` or a negative integer, **When** a create request is sent, **Then**
   the API returns `422 Unprocessable Entity` with `VALIDATION_ERROR`.
4. **Given** a user without `question_manage` or `content_manage` permission, **When** a create
   request is sent, **Then** the API returns `403 Forbidden`.
5. **Given** `type` is not `LINKED` or `UNLINKED`, **When** a create request is sent, **Then** the
   API returns `422 Unprocessable Entity` with `VALIDATION_ERROR`.
6. **Given** an active workspace license is absent (SOFT_LOCKED), **When** a create request is
   sent, **Then** the API returns `423 Locked` before reaching the handler.

---

### User Story 2 – Content Manager Lists and Filters Baskets (Priority: P1)

A Backoffice content manager browses the basket catalog to find baskets by type or status.

**Why this priority:** Listing is necessary for all basket selection workflows in exam configuration
and auto-selection rule setup.

**Independent Test:** Create 5 baskets with mixed types and statuses; call the list endpoint; verify
pagination metadata and correct filtering by `type` and `status`.

**Acceptance Scenarios:**

1. **Given** multiple baskets exist, **When** the list endpoint is called without filters, **Then**
   all baskets for the tenant are returned with `id`, `name`, `code`, `type`, `status`,
   `questionCount`, `createdAt`, `updatedAt`, plus pagination metadata.
2. **Given** a `type = LINKED` filter, **Then** only LINKED baskets are returned.
3. **Given** a `status = ENABLED` filter, **Then** only ENABLED baskets are returned.
4. **Given** a `search` query, **Then** only baskets whose `name` or `code` contains the search
   string (case-insensitive) are returned.
5. **Given** no baskets exist, **Then** the list endpoint returns `{ items: [], total: 0 }`.
6. **Given** pagination parameters, **Then** the correct slice is returned.

---

### User Story 3 – Content Manager Links and Unlinks Questions (Priority: P1)

A content manager curates the basket by adding and removing MCQ questions.

**Why this priority:** Linking is the core curation operation. Without it the basket is an empty
shell with no exam utility.

**Independent Test:** Create a basket and a question; link the question to the basket; verify
`questionCount` increases; unlink it; verify `questionCount` decreases.

**Acceptance Scenarios:**

1. **Given** an existing basket and an existing question, **When** a link request is sent, **Then**
   `mcq_basket_questions` row is inserted and `questionCount` on the basket increases by 1.
2. **Given** the same `(basketId, questionId)` pair, **When** a second link request is sent,
   **Then** the API returns `409 Conflict` with `BASKET_QUESTION_ALREADY_LINKED`.
3. **Given** a non-existent `questionId`, **When** a link request is sent, **Then** the API returns
   `404 Not Found` with `QUESTION_NOT_FOUND`.
4. **Given** `maxQuestions = 5` and the basket already has 5 questions linked, **When** a link
   request is sent, **Then** the API returns `422` with `BASKET_MAX_QUESTIONS_REACHED`.
5. **Given** an existing link, **When** an unlink request is sent, **Then** the relation row is
   deleted and `questionCount` decreases by 1.
6. **Given** a `questionId` not linked to the basket, **When** an unlink request is sent, **Then**
   the API returns `404 Not Found` with `BASKET_QUESTION_NOT_FOUND`.
7. **Given** the source MCQ question is permanently deleted, **When** the basket question list is
   queried, **Then** the orphaned relation row has been removed by cascade.

---

### User Story 4 – Content Manager Drives Basket Through Workflow to ENABLED (Priority: P2)

A content manager completes a basket and advances it through review to ENABLED so it can be used
in exam configurations.

**Why this priority:** The workflow gate ensures quality control before a basket enters production
exam use. It depends on P1 creation being complete.

**Independent Test:** Create a basket, add a question, transition to COMPLETED → UNDER_REVIEW →
APPROVED → ENABLED. Verify all status transitions persist correctly.

**Acceptance Scenarios:**

1. **Given** a DRAFT basket, **When** transitioned to `COMPLETED`, **Then** status updates and a
   workflow log entry is created.
2. **Given** a COMPLETED basket, **When** transitioned to `UNDER_REVIEW`, **Then** status updates
   and a log entry is created.
3. **Given** an UNDER_REVIEW basket, **When** transitioned to `APPROVED`, **Then** status updates.
4. **Given** an APPROVED basket with at least one question, **When** transitioned to `ENABLED`,
   **Then** status updates and the basket becomes available for exam use.
5. **Given** an APPROVED basket with zero questions, **When** ENABLED transition is requested,
   **Then** the API returns `422` with `BASKET_EMPTY_CANNOT_ENABLE`.
6. **Given** `maxQuestions = 5` and 7 questions linked, **When** ENABLED transition is requested,
   **Then** the API returns `422` with `BASKET_EXCEEDS_MAX_QUESTIONS`.
7. **Given** a DRAFT basket, **When** a direct transition to `APPROVED` is requested (skipping
   steps), **Then** the API returns `400` with `INVALID_STATE_TRANSITION`.
8. **Given** a user without the required workflow transition permission, **When** a transition is
   requested, **Then** the API returns `403 Forbidden` and no state change occurs.

---

### User Story 5 – Content Manager Attempts to Delete a Referenced Basket (Priority: P2)

A content manager tries to delete a basket that is already referenced in an exam configuration.
The system must prevent orphaned exam references.

**Why this priority:** Deletion guard protects exam integrity. Must be validated before baskets
reach production use.

**Independent Test:** Create a basket, link it to an exam configuration, then attempt to delete
it. Verify the API rejects the deletion with the correct error code.

**Acceptance Scenarios:**

1. **Given** a basket referenced in an exam configuration, **When** delete is requested, **Then**
   the API returns `422` with `BASKET_REFERENCED_IN_EXAM_CONFIG`.
2. **Given** a basket referenced in an auto-selection rule, **When** delete is requested, **Then**
   the API returns `422` with `BASKET_REFERENCED_IN_AUTO_SELECTION`.
3. **Given** a basket with zero references, **When** delete is requested, **Then** the basket and
   all its `mcq_basket_questions` rows are deleted atomically.
4. **Given** a non-existent basket ID, **When** delete is requested, **Then** the API returns
   `404` with `BASKET_NOT_FOUND`.

---

### Edge Cases

- What happens when a tenant deletes an MCQ question that is linked to multiple baskets?
  → CASCADE rule removes the `mcq_basket_questions` rows. Basket `questionCount` must reflect the
  updated count on next read.
- What happens when `max_questions` is null and a basket has many linked questions?
  → No cap enforced. Any number of questions is allowed.
- What happens when a basket's `code` update conflicts with a code used by a soft-deleted basket?
  → Soft-deleted baskets (if hard-delete is not used) must still block the code. Since the design
  uses hard delete, no conflict from deleted baskets.
- What happens when the workflow engine is unavailable or throws?
  → The transition endpoint returns a 500 with the standard error envelope; no partial state
  updates occur.
- What happens when an ENABLED basket has all its questions removed via cascade?
  → The basket status remains ENABLED but `questionCount` becomes 0. The exam system is responsible
  for validating basket content at exam configuration time. This scenario is surfaced via the
  `questionCount = 0` field on the basket response.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow authorized Backoffice staff to create MCQ baskets with `name`,
  `code`, `type` (`LINKED` or `UNLINKED`), optional `maxQuestions`, and optional `description`.
- **FR-002**: Basket `code` MUST be unique per workspace. Duplicate codes MUST be rejected with
  `409 BASKET_CODE_DUPLICATE`.
- **FR-003**: New baskets MUST be created with `status = DRAFT`.
- **FR-004**: Basket `status` MUST be managed exclusively by the shared workflow engine.
  Direct status mutation via the CRUD update endpoint is forbidden.
- **FR-005**: System MUST enforce the workflow transition chain:
  `DRAFT → COMPLETED → UNDER_REVIEW → APPROVED → ENABLED`.
  Out-of-order or backward transitions MUST be rejected with `400 INVALID_STATE_TRANSITION`.
  Backward transitions (e.g. `ENABLED → APPROVED`) are out of scope for this stage and are
  treated as invalid regardless of the requested direction.
- **FR-006**: System MUST prevent transitioning a basket to `ENABLED` when `questionCount = 0`,
  returning `422 BASKET_EMPTY_CANNOT_ENABLE`.
- **FR-007**: System MUST prevent transitioning a basket to `ENABLED` when `max_questions` is
  defined and `questionCount > max_questions`, returning `422 BASKET_EXCEEDS_MAX_QUESTIONS`.
- **FR-008**: System MUST allow authorized staff to list baskets with filters on `type`, `status`,
  and partial `search` on `name` or `code`, with pagination.
- **FR-009**: System MUST allow authorized staff to retrieve a single basket by ID.
- **FR-010**: System MUST allow authorized staff to update basket metadata (`name`, `code`,
  `maxQuestions`, `description`). `type` and `status` are NOT updatable via this endpoint.
- **FR-011**: System MUST allow authorized staff to delete a basket only if it has no references in
  exam configuration tables or auto-selection rule tables, **regardless of those records' lifecycle
  status** (DRAFT, ACTIVE, ARCHIVED, or any other status counts as a blocking reference).
- **FR-012**: Deletion of a basket MUST atomically remove all associated `mcq_basket_questions`
  rows via cascade.
- **FR-013**: System MUST allow authorized staff to link an MCQ question to a basket.
  `(basket_id, question_id)` uniqueness MUST be enforced at the database layer.
- **FR-014**: Linking a question MUST be rejected with `422 BASKET_MAX_QUESTIONS_REACHED` if the
  basket has a `max_questions` limit and is already at capacity.
- **FR-015**: System MUST allow authorized staff to unlink a question from a basket.
- **FR-016**: System MUST allow authorized staff to list all questions linked to a basket with
  pagination.
- **FR-017**: When an MCQ question is deleted, its `mcq_basket_questions` rows MUST be removed
  automatically via CASCADE. The basket status is not altered.
- **FR-018**: All basket-related API routes MUST require an active workspace license. Requests
  from `SOFT_LOCKED` or `ARCHIVED` workspaces MUST be rejected before reaching the handler.
- **FR-019**: All timestamps (`created_at`, `updated_at`) MUST be server-set. Client-supplied
  timestamps MUST be rejected.
- **FR-020**: Basket filter in the auto-selection engine MUST use an indexed subquery into
  `mcq_basket_questions`. N+1 queries are forbidden.
- **FR-021**: All write operations (create, update, link, unlink, delete, transition) MUST execute
  inside an explicit database transaction.
- **FR-022**: All API responses MUST conform to the error contract:
  `{ success: boolean, data: object | null, error: { code, message } | null }`.

### Key Entities

- **MCQ Basket** (`mcq_baskets`): A named, coded container of MCQ questions with a type (`LINKED`
  or `UNLINKED`), an optional question cap, a workflow-managed status, and full audit columns.
- **Basket-Question Link** (`mcq_basket_questions`): A many-to-many join between baskets and MCQ
  questions. Each row has a unique `(basket_id, question_id)` combination and is cascade-removed
  when either side is deleted.

---

## Business Rules

| Rule  | Description                                                                                                |
| ----- | ---------------------------------------------------------------------------------------------------------- |
| BR-01 | Basket `code` must be unique per workspace. Two baskets in the same tenant cannot share a code.            |
| BR-02 | A question may belong to multiple baskets simultaneously.                                                  |
| BR-03 | A basket may contain questions from multiple lessons, subjects, or divisions.                              |
| BR-04 | `LINKED` baskets should contain questions that respect subject/division classification context (advisory). |
| BR-05 | `UNLINKED` baskets have no classification enforcement; any question may be added.                          |
| BR-06 | Basket does NOT override question-level subject, lesson, category, or tag classification.                  |
| BR-07 | Only `ENABLED` baskets may be referenced in exam configurations or auto-selection rules.                   |
| BR-08 | Basket cannot be ENABLED when empty (zero linked questions).                                               |
| BR-09 | Basket cannot be ENABLED when `max_questions` is defined and `questionCount > max_questions`.              |
| BR-10 | Basket deletion is blocked if referenced in any exam configuration or auto-selection rule.                 |
| BR-11 | Duplicate question entries within the same basket are forbidden at the database constraint level.          |
| BR-12 | Auto-selection engine must query basket questions using an indexed subquery; no N+1 queries.               |
| BR-13 | All basket operations are tenant-scoped. Cross-tenant access is structurally impossible.                   |
| BR-14 | Server time is authoritative for all timestamps. Client-supplied timestamps are rejected.                  |

---

## Validation Criteria

Stage is complete when all of the following are satisfied:

- [ ] Basket CRUD (create, list, get, update, delete) is operational and all endpoints return
      responses conforming to the error contract.
- [ ] Basket code uniqueness is enforced at the database level and the API returns
      `BASKET_CODE_DUPLICATE` on conflict.
- [ ] Workflow transitions (`DRAFT → COMPLETED → UNDER_REVIEW → APPROVED → ENABLED`) are enforced
      strictly. Out-of-order transitions are rejected.
- [ ] ENABLED guard: basket cannot be ENABLED with zero questions.
- [ ] ENABLED guard: basket cannot be ENABLED when `questionCount > max_questions`.
- [ ] Basket-question linking works: questions can be added, listed, and removed.
- [ ] Duplicate link guard returns `BASKET_QUESTION_DUPLICATE`.
- [ ] `max_questions` cap is enforced during link operations.
- [ ] Deletion guard rejects delete when basket is referenced in exam config or auto-selection.
- [ ] CASCADE deletion of questions correctly removes orphaned `mcq_basket_questions` rows.
- [ ] Basket filter in auto-selection/query engine uses indexed subquery — no sequential scans.
- [ ] All indexes (`UNIQUE(code)`, `idx_mcq_baskets_type`, `idx_mcq_baskets_status`,
      `idx_mcq_basket_questions_basket_id`, `idx_mcq_basket_questions_question_id`) are verified
      in migration and present in the production schema.
- [ ] License middleware is enforced on all routes; `SOFT_LOCKED` and `ARCHIVED` workspaces
      receive the correct HTTP error before the handler executes.
- [ ] All writes are transactional; partial states are not persisted on failure.
- [ ] Server-side timestamps only; no client-supplied timestamps accepted.
- [ ] All responses conform to `{ success, data, error }` contract.
- [ ] Unit tests and API integration tests pass without regression.
- [ ] `bun run lint` and `bun run typecheck` pass with zero errors.
- [ ] Forward-only migration is present and validated.

---

## Out of Scope

The following are explicitly excluded from this stage and must not be implemented:

- Basket visibility or permission scoping per division — baskets are tenant-global.
- Bulk basket creation or bulk question linking.
- Basket versioning or snapshot history (basket content is live, snapshot captured at exam start).
- Basket analytics or usage reporting dashboards.
- Frontoffice basket display or student-facing basket browsing.
- Basket-level pricing or license caps (no per-basket license gating in this stage).
- `TRADITIONAL_QUESTION` basket support — baskets in this stage are MCQ-only.
- Soft-delete for baskets — only hard-delete with deletion guard is implemented.
- Backward workflow transitions (disabling a basket is out of scope for this stage).
- Basket reordering or priority ranking of questions within a basket.
- Cross-tenant basket templates or global basket libraries.

---

## Clarifications

### Session 2026-03-23

- Q: Can a basket transition backwards (e.g. ENABLED → APPROVED → UNDER_REVIEW)? → A: No. All
  backward transitions return `400 INVALID_STATE_TRANSITION`. The shared workflow engine enforces
  forward-only progression in this stage. Backward transitions (including `ENABLED → APPROVED`) are
  explicitly out of scope and are treated as invalid regardless of the requested direction.

- Q: Which RBAC roles can perform workflow transitions vs. basic CRUD? → A: Basic CRUD
  (`create`, `update`, `delete`, `link`, `unlink`) requires `question_manage` OR `content_manage`.
  Workflow transitions are role-mapped per step: `DRAFT → COMPLETED` and
  `COMPLETED → UNDER_REVIEW` require `question_manage` OR `content_manage`; `UNDER_REVIEW →
APPROVED` and `APPROVED → ENABLED` require `content_review` OR `question_manage`. These mappings
  are registered in the shared workflow engine permission configuration.

- Q: Exact behavior when the link endpoint receives a duplicate (basket_id, question_id) — 200
  idempotent or 409 conflict? → A: `409 Conflict` with error code `BASKET_QUESTION_DUPLICATE`. The
  link operation is NOT idempotent-200. Duplicates are always rejected with a conflict error,
  enforced at both the application layer (pre-check) and the database constraint layer
  (`UNIQUE(basket_id, question_id)`). This is consistent with the Constitutional Compliance
  Declaration in this spec.

- Q: What constitutes a "reference" that blocks deletion — only active/enabled exam configs, or
  all? → A: ALL references regardless of the exam configuration's or auto-selection rule's own
  lifecycle status block deletion. Even a DRAFT exam configuration or a DRAFT auto-selection rule
  that contains a reference to the basket prevents its deletion. This prevents orphaned
  configuration state on any subsequent publish of that configuration.

- Q: If max_questions is null, is there no cap, or is there a system-level default cap? → A:
  `null` means no cap — unlimited questions may be linked to the basket. No system-level default cap
  exists in this stage. The platform write rate limit (≤ 30 req/min per workspace) is the only
  operational throttle. When `max_questions` is set to a positive integer, that value is enforced
  strictly at both link time (`BASKET_MAX_QUESTIONS_REACHED`) and ENABLED transition time
  (`BASKET_EXCEEDS_MAX_QUESTIONS`).
