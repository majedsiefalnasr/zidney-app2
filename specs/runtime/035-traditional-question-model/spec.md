# Feature Specification: Traditional Question Model

**Feature Branch**: `spec/035-traditional-question-model`
**Stage**: `STAGE_35_TRADITIONAL_QUESTION_MODEL`
**Phase**: `03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE`
**Created**: 2026-03-31
**Status**: DRAFT
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/04_EXAM_ENGINE_CORE/STAGE_35_TRADITIONAL_QUESTION_MODEL.md`

---

## Overview

This stage implements the **Traditional Question Model** — the foundational data model for all
paper-style (non-MCQ) questions in Zidney. It introduces a normalized, scalable question structure
supporting three question types (`TRUE_FALSE`, `FILL_BLANK`, `SHORT_ANSWER`), with full academic
boundary enforcement, classification linking, workflow lifecycle integration, self-correction
support (v1), and tenant isolation.

**What is being built:**

- A `traditional_questions` table per-tenant: the core question record holding academic context
  (subject, division, lesson), structural context (subsection), question type, rich text content,
  correct answer, correction criteria, score, and workflow-managed status.
- A `traditional_question_categories` join table: links questions to category values for
  classification.
- A `traditional_question_tags` join table: links questions to tags for flexible labeling.
- Complete Question CRUD API endpoints (create, list, get, update, delete), all protected by
  tenant resolver → license middleware.
- Classification linking API: manage category and tag associations per question.
- Workflow status transition API: drive questions through the standard lifecycle
  `DRAFT → COMPLETED → UNDER_REVIEW → APPROVED → ENABLED` via the shared workflow engine.
- Type-specific validation rules enforced at API level before any status transition.
- Academic boundary enforcement: subject, division, and lesson must be hierarchically consistent.
- Structural hierarchy enforcement: question must belong to exactly one subsection within the
  traditional exam template structure.
- Self-correction model (v1): store raw answer, self-marked correct flag, awarded score, and
  max score snapshot at attempt time — extensible for future AI grading.
- Deletion guard: prevent deletion of any question referenced in traditional exams, exercises,
  or active attempts.
- Indexed columns for efficient filtering and future selection engine support.

**What Traditional Question Model is:**

- A paper-style question entity structurally separate from the MCQ engine.
- A tenant-isolated, normalized data structure with strict referential integrity.
- A workflow-managed entity that progresses through a lifecycle before becoming exam-eligible.
- A classification-aware entity linked to subjects, divisions, lessons, categories, and tags.
- A scored entity — every question carries a positive numeric score.
- A structurally bound entity — every question must belong to a subsection within an exam template.

**What Traditional Question Model is NOT:**

- Traditional questions are NOT MCQ questions — they share no tables, no option model, no
  polymorphic structures with the MCQ engine.
- Traditional questions do NOT carry embedded grading logic — grading is performed at attempt
  time using self-correction (v1) or future AI grading.
- Traditional questions do NOT store denormalized answer arrays or JSON blob structures for
  options — TRUE_FALSE and FILL_BLANK types store `correct_answer` as structured JSON.
- Traditional questions do NOT own their workflow state machine — status transitions are managed
  by the shared workflow engine.
- Traditional questions do NOT reference MCQ baskets — basket composition is an MCQ-specific
  concept.

**Three question types:**

| Type           | Semantics                                                                     |
| -------------- | ----------------------------------------------------------------------------- |
| `TRUE_FALSE`   | Binary answer. `correct_answer` is required (stores `true` or `false`).       |
| `FILL_BLANK`   | Text-entry answer. `correct_answer` required (may be JSON array of accepted). |
| `SHORT_ANSWER` | Free-text answer. `correct_answer` optional. Self-corrected in v1.            |

**Affected system areas:**

| Area                    | Affected? | Notes                                                                              |
| ----------------------- | --------- | ---------------------------------------------------------------------------------- |
| Tenant Isolation        | Yes       | All tables reside in tenant DB only                                                |
| License Enforcement     | Yes       | License middleware mandatory for all workspace question routes                     |
| Status Workflow         | Yes       | Question lifecycle managed by shared workflow engine; no custom state machine      |
| Academic Hierarchy      | Yes       | Subject, division, lesson FK constraints with hierarchical boundary enforcement    |
| Template Structure      | Yes       | Question must belong to a subsection (subsection → section → template)             |
| Classification          | Yes       | Category and tag linking via join tables                                           |
| Traditional Exam Config | Yes       | Deletion guard checks references in traditional exam configuration tables          |
| Self-Correction (v1)    | Yes       | Grading model supports raw_answer, self_marked_correct, awarded_score at attempt   |
| Attempt Engine          | No        | Question is snapshot-captured at attempt start; no live question reads during exam |
| Worker                  | No        | Question CRUD is synchronous; no background job required in this stage             |
| Frontoffice             | No        | Question authoring is a Backoffice tool; no student-facing exposure in this stage  |

---

## Constitutional Compliance Declaration

This specification is validated against **Zidney Constitution v1.2.0**.

| Rule                                   | Compliance                                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No cross-tenant access                 | ✓ All traditional question tables reside exclusively in the tenant DB                                                                                    |
| No middleware bypass                   | ✓ Tenant resolver → license middleware are mandatory before any question route handler                                                                   |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic — self-correction model is defined, not executed                                                       |
| No direct DB instantiation             | ✓ All DB access via tenant resolver context; no global singleton                                                                                         |
| No weakening of snapshot integrity     | ✓ Question data is snapshot-captured at attempt start; no live reads during exam                                                                         |
| No weakening of transaction boundaries | ✓ All writes execute inside an explicit transaction                                                                                                      |
| No weakening of version enforcement    | ✓ Schema version incremented; migrations are forward-only                                                                                                |
| Server-authoritative time only         | ✓ All timestamps set server-side; no client-supplied timestamps accepted                                                                                 |
| No console.log allowed                 | ✓ All logging via structured logger                                                                                                                      |
| Division boundary preserved            | ✓ Division must belong to workspace scope; cross-division assignment is forbidden                                                                        |
| Idempotency enforced                   | ✓ Classification links enforce UNIQUE constraints; duplicate link returns 409, not 500                                                                   |
| Rate limiting enforced                 | ✓ Platform rate-limiting middleware applied per STAGE_08 defaults; write routes ≤ 30 req/min, read routes ≤ 120 req/min. No question-specific overrides. |
| Normalized data model                  | ✓ No JSON answer storage for options. No polymorphic question table. All relations use foreign keys.                                                     |
| Separate engine boundary               | ✓ Traditional engine is completely separate from MCQ engine — no shared option tables or polymorphism.                                                   |

No exceptions requiring a new ADR were detected for this stage.

---

## Isolation Impact Analysis

| Concern             | Detail                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Database accessed   | Tenant DB only. Zero master DB access.                                                                           |
| Tenant resolution   | Resolved from workspace slug (subdomain or path) before any route handler executes.                              |
| Connection pool     | Obtained from `c.get('tenant').pool` — the per-tenant pool injected by tenant resolver middleware.               |
| Resolver middleware | Tenant resolver + license middleware run before every question route handler.                                    |
| New tables          | `traditional_questions`, `traditional_question_categories`, `traditional_question_tags` — all in tenant DB only. |
| Shared tenant data  | None. Questions are tenant-private. Cross-tenant access is structurally impossible.                              |

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

### Table: `traditional_questions`

| Column                | Type          | Constraints                                                                   |
| --------------------- | ------------- | ----------------------------------------------------------------------------- |
| `id`                  | UUID          | Primary key                                                                   |
| `subject_id`          | UUID          | NOT NULL, FK → `subjects.id`                                                  |
| `division_id`         | UUID          | Nullable, FK → `divisions.id`                                                 |
| `lesson_id`           | UUID          | Nullable, FK → `lessons.id`                                                   |
| `subsection_id`       | UUID          | NOT NULL, FK → `traditional_exam_subsections.id`                              |
| `question_type`       | VARCHAR(20)   | NOT NULL, CHECK IN (`TRUE_FALSE`, `FILL_BLANK`, `SHORT_ANSWER`)               |
| `content`             | TEXT          | NOT NULL (rich text)                                                          |
| `correct_answer`      | JSONB         | Nullable — see type-specific rules                                            |
| `correction_criteria` | JSONB         | Nullable — self-correction guidance for SHORT_ANSWER                          |
| `score`               | NUMERIC(10,2) | NOT NULL, CHECK > 0                                                           |
| `language`            | VARCHAR(10)   | NOT NULL                                                                      |
| `status`              | VARCHAR(30)   | NOT NULL, managed by workflow engine                                          |
| `created_at`          | TIMESTAMPTZ   | NOT NULL, server-set                                                          |
| `updated_at`          | TIMESTAMPTZ   | NOT NULL, server-set                                                          |
| `created_by`          | UUID          | Nullable, FK → `users.id`                                                     |
| `updated_by`          | UUID          | Nullable, FK → `users.id`                                                     |
| `deleted_at`          | TIMESTAMPTZ   | Nullable — soft delete marker; NULL = active, NOT NULL = deleted              |
| `status_updated_at`   | TIMESTAMPTZ   | Nullable — set by workflow engine on every status transition                  |
| `status_updated_by`   | UUID          | Nullable, FK → `users.id` — set by workflow engine on every status transition |

**Indexes:**

- `idx_trad_questions_subject_id` — supports subject-filtered queries
- `idx_trad_questions_division_id` — supports division-filtered queries
- `idx_trad_questions_lesson_id` — supports lesson-filtered queries
- `idx_trad_questions_subsection_id` — supports subsection-filtered queries
- `idx_trad_questions_question_type` — supports type-filtered queries
- `idx_trad_questions_status` — supports status-filtered queries
- `idx_trad_questions_deleted_at` — excludes soft-deleted rows from list queries

**Academic boundary constraints:**

- `subject_id` is always required.
- `division_id`, when set, must belong to the workspace scope.
- `lesson_id`, when set, must belong to the same subject as the question.
- Cross-subject or cross-division assignment is forbidden.

**Structural hierarchy constraint:**

- `subsection_id` is always required.
- The referenced subsection must belong to a section within a template that is bound to the
  same subject as the question.
- Question cannot exist outside a subsection.

**Valid status values (workflow-managed):**

`DRAFT` → `COMPLETED` → `UNDER_REVIEW` → `APPROVED` → `ENABLED`

Status is never set directly via the CRUD update endpoint. Transitions are driven exclusively
through the shared workflow engine transition endpoint.

**Score constraint:**

- `score` must be a positive number (`score > 0`).
- Score is required at creation time.

**Correct answer storage by type:**

| Type           | `correct_answer`                                                                | `correction_criteria`                   |
| -------------- | ------------------------------------------------------------------------------- | --------------------------------------- |
| `TRUE_FALSE`   | REQUIRED — JSONB: `{ "value": true }` or `{ "value": false }`                   | Not applicable (auto-gradable)          |
| `FILL_BLANK`   | REQUIRED — JSONB: `{ "accepted_values": ["answer1", "answer2"] }`               | Optional — grading hints for review     |
| `SHORT_ANSWER` | Optional — JSONB: `{ "model_answer": "..." }` (reference answer for correction) | Optional — JSONB: `{ "rubric": "..." }` |

---

### Table: `traditional_question_categories`

| Column              | Type | Constraints                                                 |
| ------------------- | ---- | ----------------------------------------------------------- |
| `id`                | UUID | Primary key                                                 |
| `question_id`       | UUID | NOT NULL, FK → `traditional_questions.id` ON DELETE CASCADE |
| `category_value_id` | UUID | NOT NULL, FK → `category_values.id` ON DELETE CASCADE       |

**Constraints:**

- `UNIQUE (question_id, category_value_id)` — prevents duplicate category assignments

**Indexes:**

- `idx_trad_question_categories_question_id` — question → categories lookups
- `idx_trad_question_categories_category_value_id` — category → questions lookups

**Cascade rules:**

- Deleting `traditional_questions` row → CASCADE removes all category links
- Deleting `category_values` row → CASCADE removes all links for that value

---

### Table: `traditional_question_tags`

| Column        | Type | Constraints                                                 |
| ------------- | ---- | ----------------------------------------------------------- |
| `id`          | UUID | Primary key                                                 |
| `question_id` | UUID | NOT NULL, FK → `traditional_questions.id` ON DELETE CASCADE |
| `tag_id`      | UUID | NOT NULL, FK → `tags.id` ON DELETE CASCADE                  |

**Constraints:**

- `UNIQUE (question_id, tag_id)` — prevents duplicate tag assignments

**Indexes:**

- `idx_trad_question_tags_question_id` — question → tags lookups
- `idx_trad_question_tags_tag_id` — tag → questions lookups

**Cascade rules:**

- Deleting `traditional_questions` row → CASCADE removes all tag links
- Deleting `tags` row → CASCADE removes all links for that tag

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

All rich text fields — `content` on questions — MUST be sanitized server-side before storage.
Sanitization uses a **whitelist approach**: only explicitly allowed HTML elements and attributes
are preserved. All `<script>` tags, event handler attributes (`onclick`, `onerror`, etc.), and
dangerous HTML constructs are stripped. Sanitization occurs within the request validation layer
before the data reaches the domain logic or database.

---

### Question Management

#### `POST /workspace/:slug/traditional-questions`

Create a new traditional question.

**Permission required:** `question_manage` OR `content_manage`

**Request body:**

```json
{
  "subjectId": "uuid",
  "divisionId": "uuid | null",
  "lessonId": "uuid | null",
  "subsectionId": "uuid",
  "questionType": "TRUE_FALSE | FILL_BLANK | SHORT_ANSWER",
  "language": "ar",
  "content": "rich text string",
  "correctAnswer": "object | null",
  "correctionCriteria": "object | null",
  "score": 5.0
}
```

- `subjectId` — required, must reference an existing subject in the tenant
- `divisionId` — optional, must belong to the workspace scope when set
- `lessonId` — optional, must belong to the same subject when set
- `subsectionId` — required, must reference an existing traditional exam subsection. The
  subsection's parent section's parent template must be bound to the same subject.
- `questionType` — required, one of `TRUE_FALSE`, `FILL_BLANK`, `SHORT_ANSWER`
- `language` — required, non-empty string
- `content` — required, non-empty rich text
- `correctAnswer` — type-specific; required for `TRUE_FALSE` and `FILL_BLANK`, optional for
  `SHORT_ANSWER`
- `correctionCriteria` — optional, applicable to `SHORT_ANSWER` type
- `score` — required, must be > 0

**Question is created with `status = DRAFT`.**

**Type-specific validation on correct_answer at creation:**

- `TRUE_FALSE`: `correctAnswer` must be `{ "value": true }` or `{ "value": false }`. Required.
- `FILL_BLANK`: `correctAnswer` must be `{ "accepted_values": ["..."] }` with at least one
  non-empty string. Required.
- `SHORT_ANSWER`: `correctAnswer` is optional (may contain `{ "model_answer": "..." }`).

**Success:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "subjectId": "uuid",
    "divisionId": "uuid | null",
    "lessonId": "uuid | null",
    "subsectionId": "uuid",
    "questionType": "TRUE_FALSE",
    "language": "ar",
    "content": "rich text",
    "correctAnswer": { "value": true },
    "correctionCriteria": null,
    "score": 5.0,
    "status": "DRAFT",
    "createdAt": "iso8601",
    "updatedAt": "iso8601"
  },
  "error": null
}
```

**Error cases:**

| Status | Error Code                    | Condition                                                  |
| ------ | ----------------------------- | ---------------------------------------------------------- |
| 422    | `VALIDATION_ERROR`            | Missing required fields, invalid values                    |
| 422    | `INVALID_CORRECT_ANSWER`      | `correctAnswer` format invalid for the given question type |
| 422    | `CORRECT_ANSWER_REQUIRED`     | `correctAnswer` missing for `TRUE_FALSE` or `FILL_BLANK`   |
| 422    | `INVALID_SCORE`               | Score is not a positive number                             |
| 404    | `SUBJECT_NOT_FOUND`           | Subject does not exist in tenant                           |
| 404    | `SUBSECTION_NOT_FOUND`        | Subsection does not exist in tenant                        |
| 422    | `SUBSECTION_SUBJECT_MISMATCH` | Subsection's template is not bound to the same subject     |
| 422    | `LESSON_SUBJECT_MISMATCH`     | Lesson does not belong to the specified subject            |
| 422    | `DIVISION_SCOPE_VIOLATION`    | Division does not belong to the workspace scope            |
| 403    | `FORBIDDEN`                   | Insufficient permission                                    |

---

#### `GET /workspace/:slug/traditional-questions`

List questions with filtering and pagination.

**Permission required:** `question_manage` OR `content_manage` OR `content_read`

**Query params:**

| Param             | Type                                       | Description              |
| ----------------- | ------------------------------------------ | ------------------------ |
| `subjectId`       | UUID                                       | Filter by subject        |
| `divisionId`      | UUID                                       | Filter by division       |
| `lessonId`        | UUID                                       | Filter by lesson         |
| `subsectionId`    | UUID                                       | Filter by subsection     |
| `questionType`    | `TRUE_FALSE \| FILL_BLANK \| SHORT_ANSWER` | Filter by question type  |
| `status`          | workflow status value                      | Filter by current status |
| `categoryValueId` | UUID                                       | Filter by category value |
| `tagId`           | UUID                                       | Filter by tag            |
| `search`          | string                                     | Partial match on content |
| `page`            | integer (default: 1)                       | Pagination page          |
| `perPage`         | integer (default: 20, max: 100)            | Page size                |

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
        "subsectionId": "uuid",
        "questionType": "TRUE_FALSE",
        "language": "ar",
        "content": "rich text (truncated for list)",
        "score": 5.0,
        "status": "ENABLED",
        "createdAt": "iso8601",
        "updatedAt": "iso8601"
      }
    ],
    "total": 200,
    "page": 1,
    "perPage": 20
  },
  "error": null
}
```

**Classification filter logic (subquery-based):**

- `categoryValueId`: `WHERE id IN (SELECT question_id FROM traditional_question_categories WHERE category_value_id = ?)`
- `tagId`: `WHERE id IN (SELECT question_id FROM traditional_question_tags WHERE tag_id = ?)`

**Performance requirement:** All filter queries MUST use indexed lookups. No sequential scans on
large question pools. No N+1 queries.

---

#### `GET /workspace/:slug/traditional-questions/:questionId`

Retrieve a single question by ID, including classification links.

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
    "subsectionId": "uuid",
    "questionType": "TRUE_FALSE",
    "language": "ar",
    "content": "full rich text",
    "correctAnswer": { "value": true },
    "correctionCriteria": null,
    "score": 5.0,
    "status": "DRAFT",
    "categories": [{ "id": "uuid", "categoryValueId": "uuid" }],
    "tags": [{ "id": "uuid", "tagId": "uuid" }],
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

#### `PATCH /workspace/:slug/traditional-questions/:questionId`

Update question metadata.

**Permission required:** `question_manage` OR `content_manage`

**Constraint:** `status` is NOT updatable via this endpoint. Use the workflow transition endpoint.
`question_type` is NOT updatable after creation — changing the type would invalidate the correct
answer structure. `subsection_id` is NOT updatable after creation — structural reassignment
requires delete and recreate.

**Concurrency control:** Client MUST send the last-known `updatedAt` value. The API compares it
against the current `updated_at` in the database. If they do not match, the API rejects the
request with `409 Conflict` (`CONCURRENT_UPDATE_CONFLICT`). This prevents lost updates from
concurrent editors.

**Transaction scope:** The entire PATCH operation — metadata update, type-specific validation —
executes inside a single atomic database transaction. Any failure rolls back the entire operation.

**Request body (partial update):**

```json
{
  "updatedAt": "iso8601 (required — last-known updated_at for optimistic concurrency)",
  "subjectId": "uuid",
  "divisionId": "uuid | null",
  "lessonId": "uuid | null",
  "language": "ar",
  "content": "rich text string",
  "correctAnswer": "object | null",
  "correctionCriteria": "object | null",
  "score": 5.0
}
```

- When `correctAnswer` is provided, type-specific validation is re-enforced.
- When `score` is provided, positivity check is applied.
- Academic boundary rules are re-validated when `subjectId`, `divisionId`, or `lessonId` changes.

**Success:** `200 OK` — returns the full updated question object.

**Error cases:**

| Status | Error Code                   | Condition                                       |
| ------ | ---------------------------- | ----------------------------------------------- |
| 404    | `QUESTION_NOT_FOUND`         | Question does not exist                         |
| 409    | `CONCURRENT_UPDATE_CONFLICT` | `updatedAt` does not match current value        |
| 422    | `VALIDATION_ERROR`           | Invalid field value                             |
| 422    | `INVALID_CORRECT_ANSWER`     | `correctAnswer` format invalid for type         |
| 422    | `INVALID_SCORE`              | Score is not a positive number                  |
| 422    | `QUESTION_TYPE_IMMUTABLE`    | Attempt to change `questionType`                |
| 422    | `SUBSECTION_IMMUTABLE`       | Attempt to change `subsectionId`                |
| 404    | `SUBJECT_NOT_FOUND`          | Subject does not exist in tenant                |
| 422    | `LESSON_SUBJECT_MISMATCH`    | Lesson does not belong to the specified subject |
| 422    | `DIVISION_SCOPE_VIOLATION`   | Division does not belong to the workspace scope |
| 403    | `FORBIDDEN`                  | Insufficient permission                         |

---

#### `DELETE /workspace/:slug/traditional-questions/:questionId`

Delete a question. The deletion strategy depends on the question's status and references:

- **Soft delete (primary mechanism):** Sets `deleted_at` to the current server timestamp.
  This is the default behavior for all questions regardless of status. Soft-deleted questions
  are excluded from list queries (`WHERE deleted_at IS NULL`).
- **Hard delete (restricted):** Permanently removes the question and all associated data. Hard
  delete is ONLY allowed when BOTH conditions are met: (1) the question is in `DRAFT` status,
  AND (2) the question has zero exam/exercise references. If either condition fails, the API
  falls back to soft delete or rejects the operation.

**Permission required:** `question_manage` OR `content_manage`

**Preconditions (deletion guard — applies to both soft and hard delete):**

1. Question MUST NOT be referenced in any active attempt — deletion of any kind is blocked
   during active attempts.
2. For hard delete: question MUST be in `DRAFT` status AND MUST NOT be referenced in any
   traditional exam configuration or exercise.
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

- All `traditional_question_categories` rows for this question are cascade-deleted.
- All `traditional_question_tags` rows for this question are cascade-deleted.

**Soft deletion behavior:**

- Question remains in the database with `deleted_at` populated.
- Soft-deleted questions are excluded from all list/filter queries.
- Classification links are preserved (not cascade-deleted) for audit trail.

---

### Question Workflow Transitions

Question workflow state is managed exclusively via the **shared status workflow engine** —
no direct status mutation is allowed through the CRUD update endpoint.

#### `POST /workspace/:slug/traditional-questions/:questionId/workflow/transition`

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

| From           | To             | Condition                                                        |
| -------------- | -------------- | ---------------------------------------------------------------- |
| `DRAFT`        | `COMPLETED`    | No conditions (content author may mark question complete)        |
| `COMPLETED`    | `UNDER_REVIEW` | No conditions                                                    |
| `UNDER_REVIEW` | `APPROVED`     | No conditions                                                    |
| `APPROVED`     | `ENABLED`      | Question MUST have valid `correct_answer` for type + `score > 0` |

**Guard: question cannot be ENABLED without valid correct answer (for applicable types).**

Specifically, the ENABLED transition guard validates:

- `TRUE_FALSE`: `correct_answer` must be defined with a boolean value
- `FILL_BLANK`: `correct_answer` must be defined with at least one accepted value
- `SHORT_ANSWER`: no `correct_answer` requirement (self-corrected in v1)
- All types: `score` must be > 0
- All types: `content` must be non-empty

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

| Status | Error Code                 | Condition                                           |
| ------ | -------------------------- | --------------------------------------------------- |
| 404    | `QUESTION_NOT_FOUND`       | Question does not exist                             |
| 400    | `INVALID_STATE_TRANSITION` | Requested transition is not a valid forward step    |
| 422    | `CORRECT_ANSWER_REQUIRED`  | Missing correct answer for TRUE_FALSE or FILL_BLANK |
| 422    | `INVALID_CORRECT_ANSWER`   | Correct answer format invalid for question type     |
| 422    | `INVALID_SCORE`            | Score is not positive                               |
| 403    | `FORBIDDEN`                | Insufficient permission for this transition         |

---

### Classification Linking

#### `POST /workspace/:slug/traditional-questions/:questionId/categories`

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

#### `DELETE /workspace/:slug/traditional-questions/:questionId/categories/:categoryValueId`

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

#### `POST /workspace/:slug/traditional-questions/:questionId/tags`

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

#### `DELETE /workspace/:slug/traditional-questions/:questionId/tags/:tagId`

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

## Self-Correction Model (v1)

For `SHORT_ANSWER` questions (and optionally for other types), the system stores grading data
at attempt time. This stage defines the data contract; actual attempt logic is implemented in
the runtime phase.

**Self-correction record per question attempt:**

| Field                 | Type          | Description                                            |
| --------------------- | ------------- | ------------------------------------------------------ |
| `raw_answer`          | TEXT          | Student's raw text response                            |
| `self_marked_correct` | BOOLEAN       | Whether the student marked their own answer as correct |
| `awarded_score`       | NUMERIC(10,2) | Score awarded (self-reported or system-calculated)     |
| `max_score_snapshot`  | NUMERIC(10,2) | Snapshot of `score` from the question at attempt start |

**Design constraints:**

- Self-correction data is stored in the attempt engine tables (future stage), NOT in the
  question model tables.
- The question model exports `score` and `correct_answer` which are snapshot-captured at
  attempt start.
- Teacher override of self-correction scores is supported.
- Future AI scoring can inject `awarded_score` without schema changes.

---

## User Scenarios & Testing

### User Story 1 – Content Author Creates a TRUE_FALSE Question (Priority: P1)

A Backoffice content author creates a new true/false traditional question, selecting a subject,
assigning it to a subsection within a template, and specifying the correct answer and score.

**Why this priority:** Question creation is the foundational operation — all other features
(workflow, classification) depend on questions existing.

**Independent Test:** Send a valid create request with `questionType = TRUE_FALSE`, a valid
`subjectId`, `subsectionId`, content, score, and a `correctAnswer` of `{ "value": true }`.
Verify the response has `status = DRAFT` and all fields persisted.

**Acceptance Scenarios:**

1. **Given** a valid subject, subsection (in same subject's template), content, language, score
   of 5, and `correctAnswer = { "value": true }`, **When** a create request is sent with
   `questionType = TRUE_FALSE`, **Then** a question is created with `status = DRAFT`.
2. **Given** `questionType = TRUE_FALSE` and missing `correctAnswer`, **When** a create request
   is sent, **Then** the API returns `422` with `CORRECT_ANSWER_REQUIRED`.
3. **Given** `questionType = TRUE_FALSE` and `correctAnswer = { "value": "maybe" }`, **When** a
   create request is sent, **Then** the API returns `422` with `INVALID_CORRECT_ANSWER`.
4. **Given** a non-existent `subjectId`, **When** a create request is sent, **Then** the API
   returns `404` with `SUBJECT_NOT_FOUND`.
5. **Given** a `subsectionId` whose template is bound to a different subject, **When** a create
   request is sent, **Then** the API returns `422` with `SUBSECTION_SUBJECT_MISMATCH`.

---

### User Story 2 – Content Author Creates FILL_BLANK and SHORT_ANSWER Questions (Priority: P1)

A content author creates questions of each supported type to verify type-specific validation.

**Why this priority:** All three question types must be validated independently.

**Independent Test:** Create one question of each type with valid correct answers, then attempt
creation with invalid configurations to verify rejection.

**Acceptance Scenarios:**

1. **Given** `questionType = FILL_BLANK` and `correctAnswer = { "accepted_values": ["Paris"] }`,
   **When** a create request is sent, **Then** a question is created successfully.
2. **Given** `questionType = FILL_BLANK` and missing `correctAnswer`, **When** a create request
   is sent, **Then** the API returns `422` with `CORRECT_ANSWER_REQUIRED`.
3. **Given** `questionType = FILL_BLANK` and `correctAnswer = { "accepted_values": [] }`,
   **When** a create request is sent, **Then** the API returns `422` with `INVALID_CORRECT_ANSWER`.
4. **Given** `questionType = SHORT_ANSWER` and no `correctAnswer`, **When** a create request is
   sent, **Then** a question is created successfully (correct answer is optional).
5. **Given** `questionType = SHORT_ANSWER` with `correctionCriteria = { "rubric": "key points" }`,
   **When** a create request is sent, **Then** a question is created with criteria persisted.

---

### User Story 3 – Content Author Updates Question Metadata (Priority: P2)

A content author edits a question's content, correct answer, and score.

**Why this priority:** Editing is essential for the content authoring workflow, but depends on
creation working first.

**Independent Test:** Create a TRUE_FALSE question, then PATCH with new content and a different
correct answer. Verify the update is persisted atomically.

**Acceptance Scenarios:**

1. **Given** an existing TRUE_FALSE question, **When** a PATCH is sent with new content and
   `correctAnswer = { "value": false }` and the correct `updatedAt`, **Then** the question is
   updated atomically.
2. **Given** an existing question, **When** a PATCH attempts to change `questionType`, **Then**
   the API returns `422` with `QUESTION_TYPE_IMMUTABLE`.
3. **Given** an existing question, **When** a PATCH attempts to change `subsectionId`, **Then**
   the API returns `422` with `SUBSECTION_IMMUTABLE`.
4. **Given** a PATCH with `score = 0`, **When** the request is sent, **Then** the API returns
   `422` with `INVALID_SCORE`.
5. **Given** an existing question updated by another user, **When** a PATCH is sent with a stale
   `updatedAt` value, **Then** the API returns `409` with `CONCURRENT_UPDATE_CONFLICT`.

---

### User Story 4 – Reviewer Progresses Question Through Workflow (Priority: P2)

A reviewer advances a question from DRAFT through to ENABLED status using the workflow engine.

**Why this priority:** Workflow integration is critical — only ENABLED questions are usable in
topics or exercises.

**Independent Test:** Create a question in DRAFT, then submit sequential transition requests
through the full lifecycle. Verify ENABLED transition fails without valid correct answer.

**Acceptance Scenarios:**

1. **Given** a DRAFT TRUE_FALSE question with valid correct answer and score, **When** transitions
   are submitted in order (COMPLETED → UNDER_REVIEW → APPROVED → ENABLED), **Then** each
   transition succeeds.
2. **Given** a DRAFT FILL_BLANK question with missing correct answer, **When** ENABLED transition
   is attempted, **Then** the API returns `422` with `CORRECT_ANSWER_REQUIRED`.
3. **Given** an ENABLED question, **When** a backward transition (e.g., to DRAFT) is attempted,
   **Then** the API returns `400` with `INVALID_STATE_TRANSITION`.

---

### User Story 5 – Content Manager Classifies Questions (Priority: P3)

A content manager assigns category values and tags to questions for organization.

**Why this priority:** Classification enables content discovery but depends on questions and
classification entities existing.

**Independent Test:** Create a question, then link a category value and a tag. Verify links
appear in the question detail response.

**Acceptance Scenarios:**

1. **Given** an existing question and a valid category value, **When** a category link request
   is sent, **Then** the link is created and visible in the question detail.
2. **Given** an existing category link, **When** the same link request is sent again, **Then**
   the API returns `409` with `QUESTION_CATEGORY_ALREADY_LINKED`.
3. **Given** an existing question and a valid tag, **When** a tag link request is sent, **Then**
   the link is created.
4. **Given** a classification link exists, **When** a delete request is sent for that link,
   **Then** the link is removed.

---

### User Story 6 – Content Manager Lists and Filters Questions (Priority: P3)

A content manager browses the question pool using multi-dimensional filters.

**Why this priority:** Listing and filtering enables content discovery — a read operation that
depends on questions existing.

**Independent Test:** Create several questions with different subjects, types, and subsections.
Verify that each filter parameter correctly narrows the result set.

**Acceptance Scenarios:**

1. **Given** questions across 2 subjects, **When** listing with `subjectId` filter, **Then** only
   questions for that subject are returned.
2. **Given** questions of type TRUE_FALSE and SHORT_ANSWER, **When** listing with
   `questionType = TRUE_FALSE`, **Then** only TRUE_FALSE questions are returned.
3. **Given** questions in different subsections, **When** listing with `subsectionId` filter,
   **Then** only questions for that subsection are returned.
4. **Given** pagination params `page = 2, perPage = 10`, **When** listing, **Then** the correct
   page of results is returned with accurate `total` count.

---

### User Story 7 – Content Manager Attempts to Delete a Referenced Question (Priority: P3)

A content manager tries to delete a question that is referenced in a traditional exam.

**Why this priority:** Deletion guard prevents data integrity violations.

**Independent Test:** Create a question, reference it in an exam config (or mock the reference
check), then attempt deletion and verify rejection.

**Acceptance Scenarios:**

1. **Given** a DRAFT question not referenced anywhere, **When** a delete request is sent, **Then**
   the question is hard-deleted and all its classifications are cascade-removed.
2. **Given** an ENABLED question not in any active attempt, **When** a delete request is sent,
   **Then** the question is soft-deleted (`deleted_at` timestamp set).
3. **Given** a question referenced in an active attempt, **When** a delete request is sent,
   **Then** the API returns `409` with `QUESTION_REFERENCED_IN_ACTIVE_ATTEMPT`.

---

### Edge Cases

- What happens when a question is created with `score = 0`?
  → API returns `422 INVALID_SCORE` — score must be positive.
- What happens when a question is created with `score = -5`?
  → API returns `422 INVALID_SCORE` — score must be positive.
- What happens when `correctAnswer` for FILL_BLANK has only empty strings?
  → API returns `422 INVALID_CORRECT_ANSWER` — at least one non-empty accepted value required.
- What happens when a referenced subject is deleted after questions exist?
  → Subject deletion is guarded by FK constraints; subject cannot be deleted while questions
  reference it.
- What happens when content is empty or whitespace-only?
  → API returns `422 VALIDATION_ERROR` — content must be non-empty after trimming.
- What happens with concurrent classification link operations?
  → The UNIQUE constraint ensures idempotent behavior — concurrent duplicate links result in
  one success and one `409 Conflict`.
- What happens when `subsectionId` references a subsection from a different subject's template?
  → API returns `422 SUBSECTION_SUBJECT_MISMATCH`.
- What happens when a tenant's license is not ACTIVE?
  → License middleware rejects the request before the handler executes (423 for SOFT_LOCKED,
  403 for ARCHIVED).
- What happens when `questionType = SHORT_ANSWER` and `correctionCriteria` is provided but
  `correctAnswer` is not?
  → Allowed. SHORT_ANSWER does not require correct answer; criteria alone is valid for
  self-correction guidance.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST support creating traditional questions with types `TRUE_FALSE`,
  `FILL_BLANK`, and `SHORT_ANSWER`.
- **FR-002**: System MUST enforce type-specific correct answer validation rules at question
  creation and update.
- **FR-003**: System MUST enforce academic boundary rules — subject is required; lesson must
  belong to the same subject; division must belong to the workspace scope.
- **FR-004**: System MUST enforce structural hierarchy — every question must belong to exactly
  one subsection, and the subsection's template must be bound to the same subject.
- **FR-005**: System MUST create questions in `DRAFT` status via the workflow engine.
- **FR-006**: System MUST prevent ENABLED transition for questions with missing required correct
  answer or invalid score.
- **FR-007**: System MUST execute question updates inside a single atomic database transaction.
- **FR-008**: System MUST prevent `questionType` from being changed after creation.
- **FR-009**: System MUST prevent `subsectionId` from being changed after creation.
- **FR-010**: System MUST support linking questions to multiple category values and tags via
  dedicated join tables.
- **FR-011**: System MUST enforce uniqueness on all classification links.
- **FR-012**: System MUST support listing questions with multi-dimensional filtering by subject,
  division, lesson, subsection, question type, status, category value, and tag.
- **FR-013**: System MUST use timestamp-based soft delete via a `deleted_at` column as the
  primary deletion mechanism. Hard delete is only allowed for DRAFT questions with no references.
- **FR-014**: System MUST cascade-delete classification links when a question is hard-deleted.
- **FR-015**: System MUST enforce tenant isolation — all question data resides in the tenant
  database with no cross-tenant access.
- **FR-016**: System MUST enforce license middleware on all question routes.
- **FR-017**: System MUST use normalized tables with foreign keys — no polymorphic question tables
  shared with MCQ.
- **FR-018**: System MUST index all filterable columns.
- **FR-019**: System MUST set all timestamps server-side.
- **FR-020**: System MUST enforce optimistic concurrency control on question updates via
  `updated_at` comparison.
- **FR-021**: System MUST sanitize rich text content server-side before storage.
- **FR-022**: System MUST enforce `score > 0` constraint at both API and database levels.
- **FR-023**: System MUST store correct answer data in JSONB format with type-specific schemas.

### Key Entities

- **Traditional Question**: The core content entity representing a paper-style question with
  academic context (subject, division, lesson), structural context (subsection), a question type,
  rich text content, correct answer, correction criteria, a score, and a workflow-managed status.
- **Traditional Question Category**: A many-to-many link between a question and a category value.
- **Traditional Question Tag**: A many-to-many link between a question and a tag.

---

## Assumptions

- The shared status workflow engine (Stage 020) is operational and exposes the standard transition
  endpoint pattern.
- Subjects, divisions, and lessons tables exist from prior stages (Stage 028, 022, 029) with
  proper FK targets.
- Category values and tags tables exist from prior stages (031, 032) with proper FK targets.
- The `traditional_exam_subsections` table MUST exist as a prerequisite (defined in a prior or
  concurrent stage for traditional exam template structure). If it does not exist at migration
  time, the `subsection_id` FK will fail — this is a hard dependency.
- The attempt engine snapshot model (future runtime phase) will capture question data
  (`content`, `correct_answer`, `correction_criteria`, `score`) at attempt start.
- Rich text content is stored as a text/HTML string.
- Permissions (`question_manage`, `content_manage`, `content_review`, `content_read`) are defined
  in the role-permission system (Stage 021).
- The traditional question engine is fully separate from the MCQ question engine — no shared
  tables, no polymorphic structures.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Content authors can create questions of all 3 types with valid correct answers
  in under 30 seconds per question.
- **SC-002**: Type-specific validation correctly rejects 100% of invalid correct answer formats
  at creation, update, and ENABLE transitions.
- **SC-003**: Academic boundary enforcement correctly prevents 100% of cross-subject lesson
  assignments and out-of-scope division assignments.
- **SC-004**: Structural hierarchy enforcement prevents 100% of questions without a valid
  subsection assignment.
- **SC-005**: Question listing with any single filter returns results in under 1 second for
  pools up to 10,000 questions.
- **SC-006**: Workflow transitions complete successfully for valid forward progressions and reject
  100% of invalid transitions.
- **SC-007**: Classification linking operates idempotently — duplicate link attempts return
  consistent error responses.
- **SC-008**: Deletion guard prevents 100% of deletion attempts on questions referenced in
  active attempts.
- **SC-009**: Zero cross-tenant data leakage — all question data is scoped to the originating
  tenant database.
- **SC-010**: Score constraint enforced at both API and DB levels — zero questions with
  score ≤ 0 can exist in the database.
