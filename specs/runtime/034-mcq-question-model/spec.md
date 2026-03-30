# Feature Specification: MCQ Question Model

**Feature Branch**: `spec/034-mcq-question-model`
**Stage**: `STAGE_34_MCQ_QUESTION_MODEL`
**Phase**: `03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE`
**Created**: 2026-03-30
**Status**: DRAFT
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/04_EXAM_ENGINE_CORE/STAGE_34_MCQ_QUESTION_MODEL.md`

---

## Overview

This stage implements the **MCQ Question Model** — the foundational data model for all
multiple-choice questions in Zidney. It introduces a normalized, scalable question structure
supporting four question types (`SINGLE`, `MULTIPLE`, `TRUE_FALSE`, `ARRANGEMENT`), with full
academic boundary enforcement, classification linking, workflow lifecycle integration, and tenant
isolation.

**What is being built:**

- A `mcq_questions` table per-tenant: the core question record holding academic context (subject,
  division, lesson), question type, content, explanation, usage flags, and workflow-managed status.
- A `mcq_question_options` table per-tenant: normalized answer options with per-type validation
  rules (correct-answer count, option count, ordering).
- A `mcq_question_categories` join table: links questions to category values for classification.
- A `mcq_question_tags` join table: links questions to tags for flexible labeling.
- A `mcq_question_baskets` join table: links questions to MCQ baskets for exam composition grouping.
- Complete Question CRUD API endpoints (create, list, get, update, delete), all protected by tenant
  resolver → license middleware.
- Option management API: add, update, reorder, and remove options within a question.
- Classification linking API: manage category, tag, and basket associations per question.
- Workflow status transition API: drive questions through the standard lifecycle
  `DRAFT → COMPLETED → UNDER_REVIEW → APPROVED → ENABLED` via the shared workflow engine.
- Type-specific validation rules enforced at API level before any status transition.
- Academic boundary enforcement: subject, division, and lesson must be hierarchically consistent.
- Deletion guard: prevent deletion of any question referenced in MCQ exams, scheduled exams, or
  active attempts.
- Auto-selection compatibility: all filterable columns indexed for the question selection engine.

**What MCQ Question Model is:**

- The atomic unit of exam content — every exam in Zidney is composed of MCQ questions.
- A tenant-isolated, normalized data structure with strict referential integrity.
- A workflow-managed entity that progresses through a lifecycle before becoming exam-eligible.
- A classification-aware entity linked to subjects, divisions, lessons, categories, tags, and
  baskets.

**What MCQ Question Model is NOT:**

- MCQ questions are not exam configurations — they are content building blocks selected into exams.
- MCQ questions do not carry grading logic — grading is performed by the attempt engine using
  snapshots.
- MCQ questions do not store denormalized option arrays or JSON answer blobs — all options are
  normalized rows.
- MCQ questions do not own their workflow state machine — status transitions are managed by the
  shared workflow engine.

**Four question types:**

| Type          | Semantics                                                                              |
| ------------- | -------------------------------------------------------------------------------------- |
| `SINGLE`      | Exactly 1 correct option. Minimum 2 options.                                           |
| `MULTIPLE`    | 1 or more correct options. Minimum 2 options.                                          |
| `TRUE_FALSE`  | Exactly 2 options. Exactly 1 correct.                                                  |
| `ARRANGEMENT` | All options required. `order_index` defines correct sequence. `is_correct` is ignored. |

**Affected system areas:**

| Area                | Affected? | Notes                                                                              |
| ------------------- | --------- | ---------------------------------------------------------------------------------- |
| Tenant Isolation    | Yes       | All tables reside in tenant DB only                                                |
| License Enforcement | Yes       | License middleware mandatory for all workspace question routes                     |
| Status Workflow     | Yes       | Question lifecycle managed by shared workflow engine; no custom state machine      |
| Academic Hierarchy  | Yes       | Subject, division, lesson FK constraints with hierarchical boundary enforcement    |
| Classification      | Yes       | Category, tag, and basket linking via join tables                                  |
| Exam Configuration  | Yes       | Deletion guard checks references in exam configuration tables                      |
| Auto-Selection      | Yes       | Indexed columns support the auto-selection engine's filter queries                 |
| Attempt Engine      | No        | Question is snapshot-captured at attempt start; no live question reads during exam |
| Worker              | No        | Question CRUD is synchronous; no background job required in this stage             |
| Frontoffice         | No        | Question authoring is a Backoffice tool; no student-facing exposure in this stage  |

---

## Clarifications

### Session 2026-03-30

- Q: What is the transaction scope for PATCH question updates (metadata + options)? → A: Single atomic transaction. Metadata update + full option replacement + validation all in one transaction; any failure rolls back everything.
- Q: How are concurrent question updates handled? → A: Optimistic concurrency control via `updated_at` timestamp. Client must send the last-known `updated_at`; API rejects with 409 Conflict if it doesn't match.
- Q: How is rich text content sanitized? → A: All rich text fields (question content, option content, explanation) MUST be sanitized server-side before storage. Strip dangerous HTML/script tags using a whitelist approach for allowed HTML elements.
- Q: What rate limiting applies to question endpoints? → A: Follow the platform-standard rate limits from STAGE_08 (Rate Limiting and Security). No question-specific overrides.
- Q: What is the deletion strategy — soft delete or hard delete? → A: Status-based soft delete is the primary mechanism. Hard delete is only allowed for DRAFT questions with no exam references. The deletion guard checks exam references before any delete operation.

---

## Constitutional Compliance Declaration

This specification is validated against **Zidney Constitution v1.2.0**.

| Rule                                   | Compliance                                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No cross-tenant access                 | ✓ All MCQ tables reside exclusively in the tenant DB                                                                                                     |
| No middleware bypass                   | ✓ Tenant resolver → license middleware are mandatory before any question route handler                                                                   |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic                                                                                                        |
| No direct DB instantiation             | ✓ All DB access via tenant resolver context; no global singleton                                                                                         |
| No weakening of snapshot integrity     | ✓ Question data is snapshot-captured at attempt start; no live reads during exam                                                                         |
| No weakening of transaction boundaries | ✓ All writes execute inside an explicit transaction                                                                                                      |
| No weakening of version enforcement    | ✓ Schema version incremented; migrations are forward-only                                                                                                |
| Server-authoritative time only         | ✓ All timestamps set server-side; no client-supplied timestamps accepted                                                                                 |
| No console.log allowed                 | ✓ All logging via structured logger                                                                                                                      |
| Division boundary preserved            | ✓ Division must belong to workspace scope; cross-division assignment is forbidden                                                                        |
| Idempotency enforced                   | ✓ Classification links enforce UNIQUE constraints; duplicate link returns 409, not 500                                                                   |
| Rate limiting enforced                 | ✓ Platform rate-limiting middleware applied per STAGE_08 defaults; write routes ≤ 30 req/min, read routes ≤ 120 req/min. No question-specific overrides. |
| Normalized data model                  | ✓ No JSON answer storage. No denormalized option arrays. All relations use foreign keys.                                                                 |

No exceptions requiring a new ADR were detected for this stage.

---

## Isolation Impact Analysis

| Concern             | Detail                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Database accessed   | Tenant DB only. Zero master DB access.                                                                                                   |
| Tenant resolution   | Resolved from workspace slug (subdomain or path) before any route handler executes.                                                      |
| Connection pool     | Obtained from `c.get('tenant').pool` — the per-tenant pool injected by tenant resolver middleware.                                       |
| Resolver middleware | Tenant resolver + license middleware run before every question route handler.                                                            |
| New tables          | `mcq_questions`, `mcq_question_options`, `mcq_question_categories`, `mcq_question_tags`, `mcq_question_baskets` — all in tenant DB only. |
| Shared tenant data  | None. Questions are tenant-private. Cross-tenant access is structurally impossible.                                                      |

---

## License & Version Enforcement

| Concern                | Detail                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| License middleware     | Yes — mandatory on all workspace question routes                                                                    |
| Allowed license states | `ACTIVE` only. `SOFT_LOCKED` → 423. `ARCHIVED` → 403. `NOT_FOUND` → 404.                                            |
| Schema version check   | Yes — requests to tenants below `MIN_SCHEMA_VERSION` for this stage are rejected with 409 `SCHEMA_VERSION_MISMATCH` |
| Product version check  | Enforced at request boundary per Constitution.                                                                      |

---

## Data Model

### Table: `mcq_questions`

| Column              | Type        | Constraints                                                                   |
| ------------------- | ----------- | ----------------------------------------------------------------------------- |
| `id`                | UUID        | Primary key                                                                   |
| `subject_id`        | UUID        | NOT NULL, FK → `subjects.id`                                                  |
| `division_id`       | UUID        | Nullable, FK → `divisions.id`                                                 |
| `lesson_id`         | UUID        | Nullable, FK → `lessons.id`                                                   |
| `question_type`     | VARCHAR(20) | NOT NULL, CHECK IN (`SINGLE`, `MULTIPLE`, `TRUE_FALSE`, `ARRANGEMENT`)        |
| `language`          | VARCHAR(10) | NOT NULL                                                                      |
| `content`           | TEXT        | NOT NULL (rich text)                                                          |
| `explanation`       | TEXT        | Nullable                                                                      |
| `is_revision_only`  | BOOLEAN     | NOT NULL, DEFAULT `false`                                                     |
| `is_exam_only`      | BOOLEAN     | NOT NULL, DEFAULT `false`                                                     |
| `status`            | VARCHAR(30) | NOT NULL, managed by workflow engine                                          |
| `created_at`        | TIMESTAMPTZ | NOT NULL, server-set                                                          |
| `updated_at`        | TIMESTAMPTZ | NOT NULL, server-set                                                          |
| `created_by`        | UUID        | Nullable, FK → `users.id`                                                     |
| `updated_by`        | UUID        | Nullable, FK → `users.id`                                                     |
| `status_updated_at` | TIMESTAMPTZ | Nullable — set by workflow engine on every status transition                  |
| `status_updated_by` | UUID        | Nullable, FK → `users.id` — set by workflow engine on every status transition |

**Indexes:**

- `idx_mcq_questions_subject_id` — supports subject-filtered queries and auto-selection
- `idx_mcq_questions_division_id` — supports division-filtered queries
- `idx_mcq_questions_lesson_id` — supports lesson-filtered queries
- `idx_mcq_questions_question_type` — supports type-filtered queries
- `idx_mcq_questions_status` — supports status-filtered queries

**Academic boundary constraints:**

- `subject_id` is always required.
- `division_id`, when set, must belong to the workspace scope.
- `lesson_id`, when set, must belong to the same subject as the question.
- Cross-subject or cross-division assignment is forbidden.

**Valid status values (workflow-managed):**

`DRAFT` → `COMPLETED` → `UNDER_REVIEW` → `APPROVED` → `ENABLED`

Status is never set directly via the CRUD update endpoint. Transitions are driven exclusively
through the shared workflow engine transition endpoint.

---

### Table: `mcq_question_options`

| Column        | Type        | Constraints                                         |
| ------------- | ----------- | --------------------------------------------------- |
| `id`          | UUID        | Primary key                                         |
| `question_id` | UUID        | NOT NULL, FK → `mcq_questions.id` ON DELETE CASCADE |
| `content`     | TEXT        | NOT NULL (rich text)                                |
| `is_correct`  | BOOLEAN     | NOT NULL, DEFAULT `false`                           |
| `order_index` | INTEGER     | NOT NULL                                            |
| `created_at`  | TIMESTAMPTZ | NOT NULL, server-set                                |

**Constraints:**

- `UNIQUE (question_id, order_index)` — prevents duplicate ordering within a question

**Indexes:**

- `idx_mcq_question_options_question_id` — question → options lookups

**Cascade rules:**

- Deleting `mcq_questions` row → CASCADE removes all `mcq_question_options` rows for that question

**Type-specific validation rules (enforced at API level):**

| Question Type | Option Count | Correct Count              | `is_correct` | `order_index`            |
| ------------- | ------------ | -------------------------- | ------------ | ------------------------ |
| `SINGLE`      | Minimum 2    | Exactly 1                  | Normal usage | Sequential ordering      |
| `MULTIPLE`    | Minimum 2    | Minimum 1                  | Normal usage | Sequential ordering      |
| `TRUE_FALSE`  | Exactly 2    | Exactly 1                  | Normal usage | Sequential ordering      |
| `ARRANGEMENT` | Minimum 2    | N/A — `is_correct` ignored | Ignored      | Defines correct sequence |

---

### Table: `mcq_question_categories`

| Column              | Type | Constraints                                           |
| ------------------- | ---- | ----------------------------------------------------- |
| `id`                | UUID | Primary key                                           |
| `question_id`       | UUID | NOT NULL, FK → `mcq_questions.id` ON DELETE CASCADE   |
| `category_value_id` | UUID | NOT NULL, FK → `category_values.id` ON DELETE CASCADE |

**Constraints:**

- `UNIQUE (question_id, category_value_id)` — prevents duplicate category assignments

**Indexes:**

- `idx_mcq_question_categories_question_id` — question → categories lookups
- `idx_mcq_question_categories_category_value_id` — category → questions lookups (auto-selection)

**Cascade rules:**

- Deleting `mcq_questions` row → CASCADE removes all `mcq_question_categories` rows
- Deleting `category_values` row → CASCADE removes all `mcq_question_categories` rows for that value

---

### Table: `mcq_question_tags`

| Column        | Type | Constraints                                         |
| ------------- | ---- | --------------------------------------------------- |
| `id`          | UUID | Primary key                                         |
| `question_id` | UUID | NOT NULL, FK → `mcq_questions.id` ON DELETE CASCADE |
| `tag_id`      | UUID | NOT NULL, FK → `tags.id` ON DELETE CASCADE          |

**Constraints:**

- `UNIQUE (question_id, tag_id)` — prevents duplicate tag assignments

**Indexes:**

- `idx_mcq_question_tags_question_id` — question → tags lookups
- `idx_mcq_question_tags_tag_id` — tag → questions lookups (auto-selection)

**Cascade rules:**

- Deleting `mcq_questions` row → CASCADE removes all `mcq_question_tags` rows
- Deleting `tags` row → CASCADE removes all `mcq_question_tags` rows for that tag

---

### Table: `mcq_question_baskets`

| Column        | Type | Constraints                                         |
| ------------- | ---- | --------------------------------------------------- |
| `id`          | UUID | Primary key                                         |
| `question_id` | UUID | NOT NULL, FK → `mcq_questions.id` ON DELETE CASCADE |
| `basket_id`   | UUID | NOT NULL, FK → `mcq_baskets.id` ON DELETE CASCADE   |

**Constraints:**

- `UNIQUE (question_id, basket_id)` — prevents duplicate basket assignments

**Indexes:**

- `idx_mcq_question_baskets_question_id` — question → baskets lookups
- `idx_mcq_question_baskets_basket_id` — basket → questions lookups (auto-selection)

**Cascade rules:**

- Deleting `mcq_questions` row → CASCADE removes all `mcq_question_baskets` rows
- Deleting `mcq_baskets` row → CASCADE removes all `mcq_question_baskets` rows for that basket

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

**Rich text content sanitization (applies to all write endpoints):**

All rich text fields — `content` on questions, `content` on options, and `explanation` on
questions — MUST be sanitized server-side before storage. Sanitization uses a **whitelist
approach**: only explicitly allowed HTML elements and attributes are preserved. All `<script>`
tags, event handler attributes (`onclick`, `onerror`, etc.), and dangerous HTML constructs are
stripped. Sanitization occurs within the request validation layer before the data reaches the
domain logic or database.

---

### Question Management

#### `POST /workspace/:slug/mcq-questions`

Create a new MCQ question.

**Permission required:** `question_manage` OR `content_manage`

**Request body:**

```json
{
  "subjectId": "uuid",
  "divisionId": "uuid | null",
  "lessonId": "uuid | null",
  "questionType": "SINGLE | MULTIPLE | TRUE_FALSE | ARRANGEMENT",
  "language": "ar",
  "content": "rich text string",
  "explanation": "string | null",
  "isRevisionOnly": false,
  "isExamOnly": false,
  "options": [
    {
      "content": "rich text string",
      "isCorrect": true,
      "orderIndex": 0
    }
  ]
}
```

- `subjectId` — required, must reference an existing subject in the tenant
- `divisionId` — optional, must belong to the workspace scope when set
- `lessonId` — optional, must belong to the same subject when set
- `questionType` — required, one of `SINGLE`, `MULTIPLE`, `TRUE_FALSE`, `ARRANGEMENT`
- `language` — required, non-empty string
- `content` — required, non-empty rich text
- `explanation` — optional
- `isRevisionOnly` — optional, defaults to `false`
- `isExamOnly` — optional, defaults to `false`
- `options` — required, must satisfy type-specific validation rules

**Question is created with `status = DRAFT`.**

**Type-specific validation on options at creation:**

- `SINGLE`: Minimum 2 options; exactly 1 marked `isCorrect = true`
- `MULTIPLE`: Minimum 2 options; at least 1 marked `isCorrect = true`
- `TRUE_FALSE`: Exactly 2 options; exactly 1 marked `isCorrect = true`
- `ARRANGEMENT`: Minimum 2 options; `isCorrect` is ignored; `orderIndex` defines correct sequence

**Success:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "subjectId": "uuid",
    "divisionId": "uuid | null",
    "lessonId": "uuid | null",
    "questionType": "SINGLE",
    "language": "ar",
    "content": "rich text",
    "explanation": "text | null",
    "isRevisionOnly": false,
    "isExamOnly": false,
    "status": "DRAFT",
    "options": [
      {
        "id": "uuid",
        "content": "rich text",
        "isCorrect": true,
        "orderIndex": 0
      }
    ],
    "createdAt": "iso8601",
    "updatedAt": "iso8601"
  },
  "error": null
}
```

**Error cases:**

| Status | Error Code                     | Condition                                                         |
| ------ | ------------------------------ | ----------------------------------------------------------------- |
| 422    | `VALIDATION_ERROR`             | Missing required fields, invalid values, or option rule violation |
| 422    | `INVALID_OPTION_CONFIGURATION` | Options do not satisfy type-specific rules                        |
| 404    | `SUBJECT_NOT_FOUND`            | Subject does not exist in tenant                                  |
| 422    | `LESSON_SUBJECT_MISMATCH`      | Lesson does not belong to the specified subject                   |
| 422    | `DIVISION_SCOPE_VIOLATION`     | Division does not belong to the workspace scope                   |
| 403    | `FORBIDDEN`                    | Insufficient permission                                           |

---

#### `GET /workspace/:slug/mcq-questions`

List questions with filtering and pagination.

**Permission required:** `question_manage` OR `content_manage` OR `content_read`

**Query params:**

| Param             | Type                                              | Description                    |
| ----------------- | ------------------------------------------------- | ------------------------------ |
| `subjectId`       | UUID                                              | Filter by subject              |
| `divisionId`      | UUID                                              | Filter by division             |
| `lessonId`        | UUID                                              | Filter by lesson               |
| `questionType`    | `SINGLE \| MULTIPLE \| TRUE_FALSE \| ARRANGEMENT` | Filter by question type        |
| `status`          | workflow status value                             | Filter by current status       |
| `categoryValueId` | UUID                                              | Filter by category value       |
| `tagId`           | UUID                                              | Filter by tag                  |
| `basketId`        | UUID                                              | Filter by basket               |
| `isRevisionOnly`  | boolean                                           | Filter revision-only questions |
| `isExamOnly`      | boolean                                           | Filter exam-only questions     |
| `search`          | string                                            | Partial match on content       |
| `page`            | integer (default: 1)                              | Pagination page                |
| `perPage`         | integer (default: 20, max: 100)                   | Page size                      |

**Success:** `200 OK`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "subjectId": "uuid",
        "divisionId": "uuid | null",
        "lessonId": "uuid | null",
        "questionType": "SINGLE",
        "language": "ar",
        "content": "rich text (truncated for list)",
        "isRevisionOnly": false,
        "isExamOnly": false,
        "status": "ENABLED",
        "optionCount": 4,
        "createdAt": "iso8601",
        "updatedAt": "iso8601"
      }
    ],
    "total": 500,
    "page": 1,
    "perPage": 20
  },
  "error": null
}
```

**Classification filter logic (subquery-based):**

- `categoryValueId`: `WHERE id IN (SELECT question_id FROM mcq_question_categories WHERE category_value_id = ?)`
- `tagId`: `WHERE id IN (SELECT question_id FROM mcq_question_tags WHERE tag_id = ?)`
- `basketId`: `WHERE id IN (SELECT question_id FROM mcq_question_baskets WHERE basket_id = ?)`

**Performance requirement:** All filter queries MUST use indexed lookups. No sequential scans on
large question pools. No N+1 queries.

---

#### `GET /workspace/:slug/mcq-questions/:questionId`

Retrieve a single question by ID, including all options and classification links.

**Permission required:** `question_manage` OR `content_manage` OR `content_read`

**Success:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "subjectId": "uuid",
    "divisionId": "uuid | null",
    "lessonId": "uuid | null",
    "questionType": "SINGLE",
    "language": "ar",
    "content": "full rich text",
    "explanation": "text | null",
    "isRevisionOnly": false,
    "isExamOnly": false,
    "status": "DRAFT",
    "options": [
      {
        "id": "uuid",
        "content": "rich text",
        "isCorrect": true,
        "orderIndex": 0
      }
    ],
    "categories": [{ "id": "uuid", "categoryValueId": "uuid" }],
    "tags": [{ "id": "uuid", "tagId": "uuid" }],
    "baskets": [{ "id": "uuid", "basketId": "uuid" }],
    "createdAt": "iso8601",
    "updatedAt": "iso8601"
  },
  "error": null
}
```

**Error cases:**

| Status | Error Code           | Condition               |
| ------ | -------------------- | ----------------------- |
| 404    | `QUESTION_NOT_FOUND` | Question does not exist |

---

#### `PATCH /workspace/:slug/mcq-questions/:questionId`

Update question metadata and/or options.

**Permission required:** `question_manage` OR `content_manage`

**Constraint:** `status` is NOT updatable via this endpoint. Use the workflow transition endpoint.
`question_type` is NOT updatable after creation — changing the type would invalidate existing
options.

**Concurrency control:** Client MUST send the last-known `updatedAt` value. The API compares it
against the current `updated_at` in the database. If they do not match, the API rejects the
request with `409 Conflict` (`CONCURRENT_UPDATE_CONFLICT`). This prevents lost updates from
concurrent editors.

**Transaction scope:** The entire PATCH operation — metadata update, full option replacement,
and type-specific validation — executes inside a single atomic database transaction. Any failure
(validation error, constraint violation, concurrency conflict) rolls back the entire operation.

**Request body (partial update):**

```json
{
  "updatedAt": "iso8601 (required — last-known updated_at for optimistic concurrency)",
  "subjectId": "uuid",
  "divisionId": "uuid | null",
  "lessonId": "uuid | null",
  "language": "ar",
  "content": "rich text string",
  "explanation": "string | null",
  "isRevisionOnly": false,
  "isExamOnly": false,
  "options": [
    {
      "id": "uuid (existing option to update, omit for new)",
      "content": "rich text string",
      "isCorrect": true,
      "orderIndex": 0
    }
  ]
}
```

- When `options` is provided, the full option set is replaced (full replacement strategy):
  options not in the array are deleted, existing options matching by `id` are updated, new options
  (without `id`) are created.
- Type-specific validation is re-enforced on the resulting option set.
- Academic boundary rules are re-validated when `subjectId`, `divisionId`, or `lessonId` changes.

**Success:** `200 OK` — returns the full updated question object including options.

**Error cases:**

| Status | Error Code                     | Condition                                       |
| ------ | ------------------------------ | ----------------------------------------------- |
| 404    | `QUESTION_NOT_FOUND`           | Question does not exist                         |
| 409    | `CONCURRENT_UPDATE_CONFLICT`   | `updatedAt` does not match current value        |
| 422    | `VALIDATION_ERROR`             | Invalid field value                             |
| 422    | `INVALID_OPTION_CONFIGURATION` | Options do not satisfy type-specific rules      |
| 422    | `QUESTION_TYPE_IMMUTABLE`      | Attempt to change `questionType`                |
| 404    | `SUBJECT_NOT_FOUND`            | Subject does not exist in tenant                |
| 422    | `LESSON_SUBJECT_MISMATCH`      | Lesson does not belong to the specified subject |
| 422    | `DIVISION_SCOPE_VIOLATION`     | Division does not belong to the workspace scope |
| 403    | `FORBIDDEN`                    | Insufficient permission                         |

---

#### `DELETE /workspace/:slug/mcq-questions/:questionId`

Delete a question. The deletion strategy depends on the question's status and references:

- **Soft delete (primary mechanism):** Sets the question status to a terminal deleted state.
  This is the default behavior for all questions regardless of status. Soft-deleted questions
  are excluded from list queries and are not selectable for exam composition.
- **Hard delete (restricted):** Permanently removes the question and all associated data. Hard
  delete is ONLY allowed when BOTH conditions are met: (1) the question is in `DRAFT` status,
  AND (2) the question has zero exam references (not in any exam config, scheduled exam, or
  active attempt). If either condition fails, the API falls back to soft delete or rejects
  the operation.

**Permission required:** `question_manage` OR `content_manage`

**Preconditions (deletion guard — applies to both soft and hard delete):**

1. Question MUST NOT be referenced in any active attempt — deletion of any kind is blocked
   during active attempts.
2. For hard delete: question MUST be in `DRAFT` status AND MUST NOT be referenced in any
   MCQ exam configuration or scheduled exam.
3. If hard-delete preconditions fail but soft-delete is valid, the API performs a soft delete.

**Success:** `200 OK`

```json
{ "success": true, "data": { "deleted": true, "deleteType": "soft | hard" }, "error": null }
```

**Error cases:**

| Status | Error Code                              | Condition                                                         |
| ------ | --------------------------------------- | ----------------------------------------------------------------- |
| 404    | `QUESTION_NOT_FOUND`                    | Question does not exist                                           |
| 409    | `QUESTION_REFERENCED_IN_ACTIVE_ATTEMPT` | Question is referenced in an active attempt (blocks all deletion) |
| 403    | `FORBIDDEN`                             | Insufficient permission                                           |

**Cascade effects on hard deletion:**

- All `mcq_question_options` rows for this question are cascade-deleted.
- All `mcq_question_categories` rows for this question are cascade-deleted.
- All `mcq_question_tags` rows for this question are cascade-deleted.
- All `mcq_question_baskets` rows for this question are cascade-deleted.

**Soft deletion behavior:**

- Question remains in the database with a terminal deleted status.
- Soft-deleted questions are excluded from all list/filter queries.
- Soft-deleted questions are not selectable for exam composition or auto-selection.
- Options and classification links are preserved (not cascade-deleted) for audit trail.

---

### Question Workflow Transitions

Question workflow state is managed exclusively via the **shared status workflow engine** —
no direct status mutation is allowed through the CRUD update endpoint.

#### `POST /workspace/:slug/mcq-questions/:questionId/workflow/transition`

Trigger a workflow state transition on a question.

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

| From           | To             | Condition                                                       |
| -------------- | -------------- | --------------------------------------------------------------- |
| `DRAFT`        | `COMPLETED`    | No conditions (content author may mark question complete)       |
| `COMPLETED`    | `UNDER_REVIEW` | No conditions                                                   |
| `UNDER_REVIEW` | `APPROVED`     | No conditions                                                   |
| `APPROVED`     | `ENABLED`      | Question MUST have valid options satisfying type-specific rules |

**Guard: question cannot be ENABLED without valid options.**

Specifically, the ENABLED transition guard validates:

- `SINGLE`: at least 2 options AND exactly 1 correct
- `MULTIPLE`: at least 2 options AND at least 1 correct
- `TRUE_FALSE`: exactly 2 options AND exactly 1 correct
- `ARRANGEMENT`: at least 2 options (correct count check skipped; `order_index` defines correctness)

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

| Status | Error Code                     | Condition                                                 |
| ------ | ------------------------------ | --------------------------------------------------------- |
| 404    | `QUESTION_NOT_FOUND`           | Question does not exist                                   |
| 400    | `INVALID_STATE_TRANSITION`     | Requested transition is not a valid forward step          |
| 422    | `INVALID_OPTION_CONFIGURATION` | Options do not satisfy type-specific rules at ENABLE time |
| 422    | `QUESTION_HAS_NO_OPTIONS`      | Question has zero options at ENABLE time                  |
| 403    | `FORBIDDEN`                    | Insufficient permission for this transition               |

---

### Classification Linking

#### `POST /workspace/:slug/mcq-questions/:questionId/categories`

Add a category value to a question.

**Permission required:** `question_manage` OR `content_manage`

**Request body:**

```json
{ "categoryValueId": "uuid" }
```

**Preconditions:**

1. Question exists in the tenant.
2. Category value exists in the tenant (`category_values`).
3. `(question_id, category_value_id)` combination does not already exist.

**Success:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "questionId": "uuid",
    "categoryValueId": "uuid"
  },
  "error": null
}
```

**Error cases:**

| Status | Error Code                         | Condition                                      |
| ------ | ---------------------------------- | ---------------------------------------------- |
| 404    | `QUESTION_NOT_FOUND`               | Question does not exist                        |
| 404    | `CATEGORY_VALUE_NOT_FOUND`         | Category value does not exist in tenant        |
| 409    | `QUESTION_CATEGORY_ALREADY_LINKED` | Category value already linked to this question |
| 403    | `FORBIDDEN`                        | Insufficient permission                        |

---

#### `DELETE /workspace/:slug/mcq-questions/:questionId/categories/:categoryValueId`

Remove a category value from a question.

**Permission required:** `question_manage` OR `content_manage`

**Success:** `200 OK`

```json
{ "success": true, "data": { "deleted": true }, "error": null }
```

**Error cases:**

| Status | Error Code                    | Condition                                     |
| ------ | ----------------------------- | --------------------------------------------- |
| 404    | `QUESTION_NOT_FOUND`          | Question does not exist                       |
| 404    | `QUESTION_CATEGORY_NOT_FOUND` | Category value is not linked to this question |
| 403    | `FORBIDDEN`                   | Insufficient permission                       |

---

#### `POST /workspace/:slug/mcq-questions/:questionId/tags`

Add a tag to a question.

**Permission required:** `question_manage` OR `content_manage`

**Request body:**

```json
{ "tagId": "uuid" }
```

**Success:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "questionId": "uuid",
    "tagId": "uuid"
  },
  "error": null
}
```

**Error cases:**

| Status | Error Code                    | Condition                           |
| ------ | ----------------------------- | ----------------------------------- |
| 404    | `QUESTION_NOT_FOUND`          | Question does not exist             |
| 404    | `TAG_NOT_FOUND`               | Tag does not exist in tenant        |
| 409    | `QUESTION_TAG_ALREADY_LINKED` | Tag already linked to this question |
| 403    | `FORBIDDEN`                   | Insufficient permission             |

---

#### `DELETE /workspace/:slug/mcq-questions/:questionId/tags/:tagId`

Remove a tag from a question.

**Permission required:** `question_manage` OR `content_manage`

**Success:** `200 OK`

```json
{ "success": true, "data": { "deleted": true }, "error": null }
```

**Error cases:**

| Status | Error Code               | Condition                          |
| ------ | ------------------------ | ---------------------------------- |
| 404    | `QUESTION_NOT_FOUND`     | Question does not exist            |
| 404    | `QUESTION_TAG_NOT_FOUND` | Tag is not linked to this question |
| 403    | `FORBIDDEN`              | Insufficient permission            |

---

#### `POST /workspace/:slug/mcq-questions/:questionId/baskets`

Add a question to a basket.

**Permission required:** `question_manage` OR `content_manage`

**Request body:**

```json
{ "basketId": "uuid" }
```

**Success:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "questionId": "uuid",
    "basketId": "uuid"
  },
  "error": null
}
```

**Error cases:**

| Status | Error Code                       | Condition                                    |
| ------ | -------------------------------- | -------------------------------------------- |
| 404    | `QUESTION_NOT_FOUND`             | Question does not exist                      |
| 404    | `BASKET_NOT_FOUND`               | Basket does not exist in tenant              |
| 409    | `QUESTION_BASKET_ALREADY_LINKED` | Question already linked to this basket       |
| 422    | `BASKET_MAX_QUESTIONS_REACHED`   | Adding would exceed basket's `max_questions` |
| 403    | `FORBIDDEN`                      | Insufficient permission                      |

---

#### `DELETE /workspace/:slug/mcq-questions/:questionId/baskets/:basketId`

Remove a question from a basket.

**Permission required:** `question_manage` OR `content_manage`

**Success:** `200 OK`

```json
{ "success": true, "data": { "deleted": true }, "error": null }
```

**Error cases:**

| Status | Error Code                  | Condition                             |
| ------ | --------------------------- | ------------------------------------- |
| 404    | `QUESTION_NOT_FOUND`        | Question does not exist               |
| 404    | `QUESTION_BASKET_NOT_FOUND` | Question is not linked to this basket |
| 403    | `FORBIDDEN`                 | Insufficient permission               |

---

## User Scenarios & Testing

### User Story 1 – Content Author Creates a SINGLE-Type MCQ Question (Priority: P1)

A Backoffice content author creates a new single-answer MCQ question, providing the question
content, selecting a subject, and adding answer options with exactly one correct answer.

**Why this priority:** Question creation is the foundational operation — all other features
(workflow, classification, exam composition) depend on questions existing.

**Independent Test:** Send a valid create request with `questionType = SINGLE`, a valid
`subjectId`, content text, and 4 options (1 correct). Verify the response has `status = DRAFT`,
all options returned with correct IDs.

**Acceptance Scenarios:**

1. **Given** a valid subject, content, language, and 4 options with 1 correct, **When** a create
   request is sent with `questionType = SINGLE`, **Then** a question is created with
   `status = DRAFT` and all options persisted.
2. **Given** `questionType = SINGLE` and 4 options with 2 marked correct, **When** a create
   request is sent, **Then** the API returns `422` with `INVALID_OPTION_CONFIGURATION`.
3. **Given** `questionType = SINGLE` and only 1 option, **When** a create request is sent,
   **Then** the API returns `422` with `INVALID_OPTION_CONFIGURATION`.
4. **Given** a non-existent `subjectId`, **When** a create request is sent, **Then** the API
   returns `404` with `SUBJECT_NOT_FOUND`.
5. **Given** a `lessonId` that belongs to a different subject, **When** a create request is sent,
   **Then** the API returns `422` with `LESSON_SUBJECT_MISMATCH`.

---

### User Story 2 – Content Author Creates TRUE_FALSE and ARRANGEMENT Questions (Priority: P1)

A content author creates questions of each supported type to verify type-specific validation.

**Why this priority:** All four question types must be validated independently — they form the
complete content model.

**Independent Test:** Create one question of each type with valid options, then attempt creation
with invalid option configurations to verify rejection.

**Acceptance Scenarios:**

1. **Given** `questionType = TRUE_FALSE` and exactly 2 options with 1 correct, **When** a create
   request is sent, **Then** a question is created successfully.
2. **Given** `questionType = TRUE_FALSE` and 3 options, **When** a create request is sent,
   **Then** the API returns `422` with `INVALID_OPTION_CONFIGURATION`.
3. **Given** `questionType = MULTIPLE` and 4 options with 2 correct, **When** a create request
   is sent, **Then** a question is created successfully.
4. **Given** `questionType = MULTIPLE` and 4 options with 0 correct, **When** a create request
   is sent, **Then** the API returns `422` with `INVALID_OPTION_CONFIGURATION`.
5. **Given** `questionType = ARRANGEMENT` and 5 options with sequential `orderIndex`, **When** a
   create request is sent, **Then** a question is created with `is_correct` values ignored.

---

### User Story 3 – Content Author Updates Question and Options (Priority: P2)

A content author edits a question's content, explanation, and replaces the option set.

**Why this priority:** Editing is essential for the content authoring workflow, but depends on
creation working first.

**Independent Test:** Create a SINGLE question, then PATCH with new content and a different option
set. Verify old options are removed and new options are persisted with correct validation.

**Acceptance Scenarios:**

1. **Given** an existing SINGLE question with 4 options, **When** a PATCH is sent with 3 new
   options (1 correct) and the correct `updatedAt`, **Then** the old options are replaced and the
   new set is persisted atomically.
2. **Given** an existing question, **When** a PATCH attempts to change `questionType`, **Then**
   the API returns `422` with `QUESTION_TYPE_IMMUTABLE`.
3. **Given** a PATCH with options violating type rules, **When** the request is sent, **Then**
   the API returns `422` with `INVALID_OPTION_CONFIGURATION`.
4. **Given** a PATCH changing `lessonId` to a lesson from a different subject, **When** the
   request is sent, **Then** the API returns `422` with `LESSON_SUBJECT_MISMATCH`.
5. **Given** an existing question updated by another user, **When** a PATCH is sent with a stale
   `updatedAt` value, **Then** the API returns `409` with `CONCURRENT_UPDATE_CONFLICT`.

---

### User Story 4 – Reviewer Progresses Question Through Workflow (Priority: P2)

A reviewer advances a question from DRAFT through to ENABLED status using the workflow engine.

**Why this priority:** Workflow integration is critical for content quality control — only ENABLED
questions are selectable in exams.

**Independent Test:** Create a question in DRAFT, then submit sequential transition requests
through the full lifecycle. Verify ENABLED transition fails without valid options.

**Acceptance Scenarios:**

1. **Given** a DRAFT question with valid options, **When** transitions are submitted in order
   (COMPLETED → UNDER_REVIEW → APPROVED → ENABLED), **Then** each transition succeeds and status
   updates correctly.
2. **Given** a DRAFT question with no options, **When** ENABLED transition is attempted, **Then**
   the API returns `422` with `QUESTION_HAS_NO_OPTIONS`.
3. **Given** a SINGLE question with 2 correct options, **When** ENABLED transition is attempted,
   **Then** the API returns `422` with `INVALID_OPTION_CONFIGURATION`.
4. **Given** an ENABLED question, **When** a backward transition (e.g., to DRAFT) is attempted,
   **Then** the API returns `400` with `INVALID_STATE_TRANSITION`.

---

### User Story 5 – Content Manager Classifies Questions (Priority: P3)

A content manager assigns category values, tags, and basket memberships to questions for
organization and auto-selection engine compatibility.

**Why this priority:** Classification is essential for exam composition and auto-selection but
depends on questions and classification entities existing.

**Independent Test:** Create a question, then link a category value, a tag, and a basket. Verify
all links appear in the question detail response. Attempt duplicate links and verify 409 response.

**Acceptance Scenarios:**

1. **Given** an existing question and a valid category value, **When** a category link request is
   sent, **Then** the link is created and visible in the question detail.
2. **Given** an existing category link, **When** the same link request is sent again, **Then**
   the API returns `409` with `QUESTION_CATEGORY_ALREADY_LINKED`.
3. **Given** an existing question and a valid tag, **When** a tag link request is sent, **Then**
   the link is created.
4. **Given** an existing question and a valid basket, **When** a basket link request is sent,
   **Then** the link is created.
5. **Given** a basket with `maxQuestions` already reached, **When** a basket link request is sent,
   **Then** the API returns `422` with `BASKET_MAX_QUESTIONS_REACHED`.
6. **Given** a classification link exists, **When** a delete request is sent for that link,
   **Then** the link is removed.

---

### User Story 6 – Content Manager Lists and Filters Questions (Priority: P3)

A content manager browses the question pool using multi-dimensional filters to find specific
questions.

**Why this priority:** Listing and filtering enables content discovery but is a read operation
that depends on questions and classification data existing.

**Independent Test:** Create several questions with different subjects, types, and classification
links. Verify that each filter parameter correctly narrows the result set.

**Acceptance Scenarios:**

1. **Given** questions across 2 subjects, **When** listing with `subjectId` filter, **Then** only
   questions for that subject are returned.
2. **Given** questions of type SINGLE and MULTIPLE, **When** listing with `questionType = SINGLE`,
   **Then** only SINGLE questions are returned.
3. **Given** a question linked to a tag, **When** listing with `tagId` filter, **Then** only
   tagged questions are returned.
4. **Given** pagination params `page = 2, perPage = 10`, **When** listing, **Then** the correct
   page of results is returned with accurate `total` count.

---

### User Story 7 – Content Manager Attempts to Delete a Referenced Question (Priority: P3)

A content manager tries to delete a question that is referenced in an exam configuration.

**Why this priority:** Deletion guard prevents data integrity violations but is a safety feature
tested after CRUD and workflow.

**Independent Test:** Create a question, reference it in an exam config (or mock the reference
check), then attempt deletion and verify rejection.

**Acceptance Scenarios:**

1. **Given** a DRAFT question not referenced anywhere, **When** a delete request is sent, **Then**
   the question is hard-deleted and all its options/classifications are cascade-removed.
2. **Given** an ENABLED question not in any active attempt, **When** a delete request is sent,
   **Then** the question is soft-deleted (status set to terminal deleted state) and excluded from
   list queries.
3. **Given** a question referenced in an active attempt, **When** a delete request is sent,
   **Then** the API returns `409` with `QUESTION_REFERENCED_IN_ACTIVE_ATTEMPT`.
4. **Given** a DRAFT question referenced in an exam configuration, **When** a delete request is
   sent, **Then** the question is soft-deleted (hard delete preconditions not met).

---

### Edge Cases

- What happens when a question is created with duplicate `orderIndex` values in options?
  → API returns `422 VALIDATION_ERROR` — order indices must be unique within a question.
- What happens when all options are removed from an ENABLED question via PATCH?
  → Options cannot be emptied if the question is ENABLED; the system rejects the update with
  `INVALID_OPTION_CONFIGURATION`. Questions must be transitioned back before option removal.
- What happens when a referenced subject is deleted after questions exist?
  → Subject deletion is guarded by FK constraints; subject cannot be deleted while questions
  reference it.
- What happens when content is empty or whitespace-only?
  → API returns `422 VALIDATION_ERROR` — content must be non-empty after trimming.
- What happens with concurrent classification link operations?
  → The UNIQUE constraint ensures idempotent behavior — concurrent duplicate links result in
  one success and one `409 Conflict`.
- What happens when `divisionId` is provided but `subjectId` is missing?
  → `subjectId` is required — API returns `422 VALIDATION_ERROR`.
- What happens when a tenant's license is not ACTIVE?
  → License middleware rejects the request before the handler executes (423 for SOFT_LOCKED,
  403 for ARCHIVED).

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST support creating MCQ questions with types `SINGLE`, `MULTIPLE`,
  `TRUE_FALSE`, and `ARRANGEMENT`.
- **FR-002**: System MUST enforce type-specific option validation rules at question creation
  and update.
- **FR-003**: System MUST enforce academic boundary rules — subject is required; lesson must
  belong to the same subject; division must belong to the workspace scope.
- **FR-004**: System MUST create questions in `DRAFT` status via the workflow engine.
- **FR-005**: System MUST prevent ENABLED transition for questions with invalid or missing options.
- **FR-006**: System MUST execute question updates (metadata + full option replacement +
  validation) inside a single atomic database transaction; any failure rolls back the entire
  operation.
- **FR-007**: System MUST prevent `questionType` from being changed after creation.
- **FR-008**: System MUST support linking questions to multiple category values, tags, and baskets
  via dedicated join tables.
- **FR-009**: System MUST enforce uniqueness on all classification links (no duplicate
  question-category, question-tag, or question-basket pairs).
- **FR-010**: System MUST support listing questions with multi-dimensional filtering by subject,
  division, lesson, question type, status, category value, tag, basket, revision flag, and exam
  flag.
- **FR-011**: System MUST use status-based soft delete as the primary deletion mechanism. Hard
  delete is only allowed for DRAFT questions with no exam references. Deletion of any kind is
  blocked for questions referenced in active attempts.
- **FR-012**: System MUST cascade-delete options and classification links when a question is
  hard-deleted.
- **FR-013**: System MUST enforce tenant isolation — all question data resides in the tenant
  database with no cross-tenant access.
- **FR-014**: System MUST enforce license middleware on all question routes.
- **FR-015**: System MUST use normalized tables with foreign keys — no JSON answer storage, no
  denormalized option arrays.
- **FR-016**: System MUST index all filterable columns to support the auto-selection engine.
- **FR-017**: System MUST set all timestamps server-side — no client-supplied timestamps accepted.
- **FR-018**: System MUST enforce `UNIQUE(question_id, order_index)` on options to prevent
  duplicate ordering.
- **FR-019**: System MUST enforce optimistic concurrency control on question updates via
  `updated_at` comparison; rejected mismatches return 409 Conflict.
- **FR-020**: System MUST sanitize all rich text fields (question content, option content,
  explanation) server-side before storage using an HTML element whitelist approach.

### Key Entities

- **MCQ Question**: The core content entity representing a multiple-choice question with academic
  context (subject, division, lesson), a question type, rich text content, an optional explanation,
  usage flags (revision-only, exam-only), and a workflow-managed status.
- **MCQ Question Option**: An individual answer choice for a question, with rich text content, a
  correct/incorrect flag, and a display order index. Options are type-validated and normalized.
- **MCQ Question Category**: A many-to-many link between a question and a category value, enabling
  classification-based filtering and auto-selection.
- **MCQ Question Tag**: A many-to-many link between a question and a tag, enabling flexible
  labeling and filtering.
- **MCQ Question Basket**: A many-to-many link between a question and an MCQ basket, enabling
  grouped question pools for exam composition.

---

## Assumptions

- The shared status workflow engine (Stage 020) is operational and exposes the standard transition
  endpoint pattern.
- Subjects, divisions, and lessons tables exist from prior stages (Stage 028, 022, 029) with
  proper FK targets.
- Category values, tags, and MCQ baskets tables exist from prior stages (031, 032, 033) with
  proper FK targets.
- The auto-selection engine (future stage) will consume indexed columns defined in this model —
  index design is forward-compatible.
- The attempt engine snapshot model (future runtime phase) will capture question and option data
  at attempt start — no live reads are required from this model during exam execution.
- Rich text content is stored as a text/HTML string — the rendering engine is a frontend concern
  outside this stage's scope.
- Permissions (`question_manage`, `content_manage`, `content_review`, `content_read`) are defined
  in the role-permission system (Stage 021).

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Content authors can create questions of all 4 types with valid options in under
  30 seconds per question.
- **SC-002**: Type-specific validation correctly rejects 100% of invalid option configurations
  (wrong correct count, insufficient options) at creation, update, and ENABLE transitions.
- **SC-003**: Academic boundary enforcement correctly prevents 100% of cross-subject lesson
  assignments and out-of-scope division assignments.
- **SC-004**: Question listing with any single filter (subject, type, status, tag, category,
  basket) returns results in under 1 second for pools up to 10,000 questions.
- **SC-005**: Workflow transitions complete successfully for valid forward progressions and reject
  100% of invalid transitions (backward, missing options, invalid options).
- **SC-006**: Classification linking (categories, tags, baskets) operates idempotently — duplicate
  link attempts return consistent error responses without data corruption.
- **SC-007**: Deletion guard prevents 100% of deletion attempts on questions referenced in exam
  configurations, scheduled exams, or active attempts.
- **SC-008**: Zero cross-tenant data leakage — all question data is scoped to the originating
  tenant database with no shared state.
