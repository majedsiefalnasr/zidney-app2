# Feature Specification: MCQ Exam Configuration

**Feature Branch**: `spec/036-mcq-exam-config`
**Stage**: `STAGE_36_MCQ_EXAM_CONFIG`
**Phase**: `03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE`
**Created**: 2026-04-01
**Status**: DRAFT
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/04_EXAM_ENGINE_CORE/STAGE_36_MCQ_EXAM_CONFIG.md`

---

## Overview

This stage implements the **MCQ Exam Configuration** entity — a backoffice-defined assessment
configuration that describes how an MCQ exam is set up, which questions it contains (or how
they are selected), delivery mode constraints, result visibility rules, and certificate
integration. MCQ Exam is a reusable configuration template that scheduled exams and assessment
attempts reference at runtime.

**What is being built:**

- A `mcq_exams` table per-tenant: the core exam configuration record holding subject scope,
  division scope, question selection mode (MANUAL or AUTOMATIC), pass criteria (PERCENTAGE or
  SCORE), delivery mode, and workflow-managed status.
- A `mcq_exam_settings` table per-tenant: one-to-one delivery and result visibility
  configuration for each exam (delivery modes, review flags, result effects, certificate toggle).
- A `mcq_exam_questions` table per-tenant: manual question selection with ordered linking of
  specific MCQ questions to an exam.
- A `mcq_exam_auto_criteria` table per-tenant: automatic question selection criteria with
  percentage-weighted rules based on lessons, category values, tags, and baskets.
- Complete Exam CRUD API endpoints (create, list, get, update, soft-delete), all protected by
  tenant resolver → license middleware.
- Delivery settings management API: create/update the exam settings record.
- Manual question selection API: add, remove, reorder questions for an exam.
- Automatic criteria management API: create, update, delete selection criteria rows.
- Workflow status transition API: drive exams through the standard lifecycle
  `COMPLETED → UNDER_REVIEW → APPROVED → ENABLED` via the shared workflow engine.
- Validation rules enforced at API level: delivery mode consistency, manual count matching,
  automatic criteria percentage sum, subject/division boundary enforcement.
- Deletion guard: prevent deletion of any exam with existing attempts or scheduled exam
  references.
- Immutability constraints: subject cannot change after creation; selection logic cannot change
  after first attempt exists.
- Indexed columns for efficient filtering and selection queries.

**What MCQ Exam Configuration is:**

- A reusable, backoffice-defined assessment template — NOT a scheduled event or attempt.
- A tenant-isolated configuration entity with strict referential integrity.
- A workflow-managed entity that progresses through a lifecycle before becoming schedulable.
- A question-selection authority: defines which questions (manual) or which criteria (automatic)
  produce the question set at attempt start.
- A delivery-mode authority: controls relax, chrono, rush mode availability.
- A result-visibility authority: controls what the student sees after submission.

**What MCQ Exam Configuration is NOT:**

- MCQ Exams are NOT scheduled exams — scheduling is a separate stage (scheduled engine).
- MCQ Exams are NOT attempts — attempt snapshot is taken from the Exam Config at attempt start.
- MCQ Exams do NOT store student responses or grading results.
- MCQ Exams do NOT own their workflow state machine — transitions are managed by the shared
  workflow engine via `executeTransition()`.
- MCQ Exams do NOT dynamically change at runtime — the snapshot contract ensures immutability
  once an attempt begins.
- MCQ Assessments (user-generated) are NOT stored as mcq_exams.

**Selection Modes:**

| Mode        | Semantics                                                                      |
| ----------- | ------------------------------------------------------------------------------ |
| `MANUAL`    | Questions hand-picked by backoffice staff via `mcq_exam_questions` join table  |
| `AUTOMATIC` | Questions selected at runtime via criteria defined in `mcq_exam_auto_criteria` |

**Pass Types:**

| Type         | Semantics                                                   |
| ------------ | ----------------------------------------------------------- |
| `PERCENTAGE` | Student must score ≥ `pass_value`% of total possible points |
| `SCORE`      | Student must score ≥ `pass_value` absolute points           |

**Delivery Modes:**

| Mode     | Semantics                                                         |
| -------- | ----------------------------------------------------------------- |
| `RELAX`  | No time pressure — student completes at own pace                  |
| `CHRONO` | Timed exam — `duration_minutes` enforced as total exam time limit |
| `RUSH`   | Per-question timer — enforced at runtime by attempt engine        |

**Affected system areas:**

| Area                | Affected? | Notes                                                                  |
| ------------------- | --------- | ---------------------------------------------------------------------- |
| Tenant Isolation    | Yes       | All tables reside in tenant DB only                                    |
| License Enforcement | Yes       | License middleware mandatory for all workspace exam routes             |
| Status Workflow     | Yes       | Exam lifecycle managed by shared workflow engine                       |
| Academic Hierarchy  | Yes       | Subject FK required; division FK optional with boundary enforcement    |
| Snapshot Contract   | Yes       | Attempt engine snapshots exam config at attempt start                  |
| Deletion Guard      | Yes       | Cannot delete exam with attempts or scheduled references               |
| Immutability        | Yes       | Subject immutable after creation; selection locked after first attempt |

---

## Functional Requirements

### FR-001: Create MCQ Exam

**Endpoint:** `POST /api/v1/workspace/:slug/mcq-exams`

Create a new MCQ exam configuration record in the `mcq_exams` table.

**Required fields:**

- `name` (string, max 255) — exam display name
- `code` (string, max 100) — unique per tenant, serves as exam identifier
- `subject_id` (uuid) — FK to subjects table, must reference an existing subject
- `language` (string, max 10) — exam language code (e.g., "ar", "en")
- `total_questions` (integer, > 0) — number of questions in the exam
- `pass_type` (enum: PERCENTAGE | SCORE) — pass criteria type
- `pass_value` (numeric, > 0) — pass threshold value
- `selection_mode` (enum: MANUAL | AUTOMATIC) — question selection strategy

**Optional fields:**

- `description` (text) — exam description
- `division_id` (uuid) — FK to divisions table, scopes exam to a division
- `duration_minutes` (integer, nullable) — exam time limit in minutes
- `allow_multiple_attempts` (boolean, default false) — whether retakes are allowed

**Validation rules:**

- `code` must be unique per tenant (case-insensitive, WHERE deleted_at IS NULL)
- `subject_id` must reference a valid subject with status ≠ 'ARCHIVED'
- `division_id`, if provided, must reference a valid division
- `total_questions` must be > 0
- `pass_value` must be > 0
- If `pass_type` = PERCENTAGE, `pass_value` must be ≤ 100
- Initial status: `COMPLETED` (per workflow engine convention)

**Response:** Created exam object with generated `id`, timestamps.

### FR-002: List MCQ Exams

**Endpoint:** `GET /api/v1/workspace/:slug/mcq-exams`

List exam configurations with offset pagination and optional filters.

**Query parameters:**

- `page` (integer, default 1)
- `limit` (integer, default 20, max 100)
- `status` (optional, filter by workflow status)
- `search` (optional, case-insensitive search on name/code)
- `subject_id` (optional, filter by subject)
- `division_id` (optional, filter by division)
- `selection_mode` (optional, filter by MANUAL/AUTOMATIC)

**Response:** `{ items: McqExam[], total: number, page: number, limit: number }`

Excludes soft-deleted records (`deleted_at IS NULL`).

### FR-003: Get MCQ Exam by ID

**Endpoint:** `GET /api/v1/workspace/:slug/mcq-exams/:id`

Retrieve a single exam configuration with its settings, question count, and criteria summary.

**Response:** Full exam object including nested `settings` (from `mcq_exam_settings`),
`questions_count` (from `mcq_exam_questions`), and `criteria_count` (from
`mcq_exam_auto_criteria`).

Returns 404 if exam not found or soft-deleted.

### FR-004: Update MCQ Exam

**Endpoint:** `PATCH /api/v1/workspace/:slug/mcq-exams/:id`

Update mutable fields of an exam configuration.

**Immutable fields (cannot be changed):**

- `subject_id` — immutable after creation

**Conditionally mutable fields:**

- `selection_mode` — only changeable before the exam reaches ENABLED status
- `division_id` — only changeable before ENABLED status

**Always mutable fields (metadata):**

- `name`, `code`, `description`, `language`
- `total_questions`, `duration_minutes`
- `pass_type`, `pass_value`
- `allow_multiple_attempts`

**After first attempt exists:** Only metadata fields (name, description, language,
allow_multiple_attempts) may be changed. Selection mode, total_questions, pass criteria,
and duration become locked.

**Validation:** Same rules as FR-001 for updated fields. `code` uniqueness re-checked if changed.

### FR-005: Soft-Delete MCQ Exam

**Endpoint:** `DELETE /api/v1/workspace/:slug/mcq-exams/:id`

Soft-delete an exam by setting `deleted_at = NOW()`.

**Deletion guards:**

- Cannot delete if exam has any attempts (future: check attempts table)
- Cannot delete if exam is referenced by any scheduled exam (future: check scheduled_exams)
- Cannot delete if status = ENABLED (must disable first via workflow)

**Response:** 204 No Content on success.

### FR-006: Manage Exam Delivery Settings

**Endpoint:** `PUT /api/v1/workspace/:slug/mcq-exams/:id/settings`

Create or update the one-to-one delivery settings record in `mcq_exam_settings`.

**Fields:**

- `allow_relax_mode` (boolean) — enable relax delivery mode
- `allow_chrono_mode` (boolean) — enable chrono delivery mode
- `allow_rush_mode` (boolean) — enable rush delivery mode
- `allow_review_answers` (boolean) — allow answer review during exam
- `allow_review_hints` (boolean) — allow hint display during exam
- `allow_result_effects` (boolean) — show visual effects on result
- `show_results_after_submit` (boolean) — show results immediately
- `show_correct_answers` (boolean) — reveal correct answers after submission
- `show_explanations` (boolean) — show question explanations after submission
- `enable_certificate` (boolean) — enable certificate generation on pass
- `message_template_id` (uuid, nullable) — FK to message templates

**Validation rules:**

- At least one delivery mode must be enabled (relax OR chrono OR rush)
- If `allow_chrono_mode` = true, the parent exam's `duration_minutes` must not be null
- If exam status = ENABLED and has attempts, only non-structural settings may change

### FR-007: Manual Question Selection — Add Questions

**Endpoint:** `POST /api/v1/workspace/:slug/mcq-exams/:id/questions`

Add one or more questions to a MANUAL-mode exam.

**Request body:** `{ questions: [{ question_id: uuid, order_index: integer }] }`

**Validation rules:**

- Exam must be in MANUAL selection mode
- Each `question_id` must reference a valid MCQ question
- Each question's `subject_id` must match the exam's `subject_id`
- If exam has `division_id`, question's `division_id` must match or be null (default division)
- Only questions with status = ENABLED may be added
- `(exam_id, question_id)` must be unique — no duplicate questions
- `(exam_id, order_index)` must be unique — no overlapping order positions
- Cannot modify questions after exam has attempts

### FR-008: Manual Question Selection — Remove Questions

**Endpoint:** `DELETE /api/v1/workspace/:slug/mcq-exams/:id/questions/:questionId`

Remove a single question from a MANUAL-mode exam.

**Validation:**

- Exam must be in MANUAL selection mode
- Cannot modify questions after exam has attempts

### FR-009: Manual Question Selection — Reorder Questions

**Endpoint:** `PUT /api/v1/workspace/:slug/mcq-exams/:id/questions/reorder`

Reorder all questions for a MANUAL-mode exam.

**Request body:** `{ order: [{ question_id: uuid, order_index: integer }] }`

**Validation:**

- Exam must be in MANUAL selection mode
- All question IDs must already be linked to the exam
- All order indices must be unique and contiguous starting from 1
- Cannot modify questions after exam has attempts

### FR-010: Automatic Criteria Management — Set Criteria

**Endpoint:** `PUT /api/v1/workspace/:slug/mcq-exams/:id/criteria`

Replace all auto-selection criteria for an AUTOMATIC-mode exam.

**Request body:**

```json
{
  "criteria": [
    {
      "lesson_ids": ["uuid", ...],
      "category_value_ids": ["uuid", ...],
      "tag_ids": ["uuid", ...],
      "basket_ids": ["uuid", ...],
      "percentage": 40
    }
  ]
}
```

**Validation rules:**

- Exam must be in AUTOMATIC selection mode
- Sum of `percentage` across all criteria must equal exactly 100
- Each `lesson_id` must reference a valid lesson within the exam's subject
- Each `category_value_id` must be a valid category value
- Each `tag_id` must be a valid tag
- Each `basket_id` must be a valid MCQ basket within the exam's subject
- Cannot modify criteria after exam has attempts

### FR-011: Workflow Status Transition

**Endpoint:** `POST /api/v1/workspace/:slug/mcq-exams/:id/transition`

Transition exam status via the shared workflow engine (`executeTransition()`).

**Allowed transitions:**

- COMPLETED → UNDER_REVIEW (action: review)
- UNDER_REVIEW → APPROVED (action: approve)
- APPROVED → ENABLED (action: enable)
- Backward: APPROVED → UNDER_REVIEW (action: return, requires justification)
- Backward: UNDER_REVIEW → COMPLETED (action: return, requires justification)

**Pre-enable validation (before transitioning to ENABLED):**

- If MANUAL mode: count of linked questions must equal `total_questions`
- If AUTOMATIC mode: sum of criteria percentages must equal 100
- Delivery settings must exist with at least one mode enabled
- If chrono mode enabled, `duration_minutes` must not be null

### FR-012: Get Exam Delivery Settings

**Endpoint:** `GET /api/v1/workspace/:slug/mcq-exams/:id/settings`

Retrieve the delivery settings for an exam.

**Response:** Settings object or 404 if no settings configured.

### FR-013: List Exam Questions (Manual Mode)

**Endpoint:** `GET /api/v1/workspace/:slug/mcq-exams/:id/questions`

List all questions linked to a MANUAL-mode exam, ordered by `order_index`.

**Response:** Array of question objects with `order_index`.

### FR-014: Get Exam Criteria (Automatic Mode)

**Endpoint:** `GET /api/v1/workspace/:slug/mcq-exams/:id/criteria`

List all auto-selection criteria for an AUTOMATIC-mode exam.

**Response:** Array of criteria objects with IDs and percentages.

---

## Non-Functional Requirements

### NFR-001: Tenant Isolation

All exam configuration data must reside in the tenant database. No cross-tenant queries are
permitted. Tenant resolution is enforced by the slug-based middleware chain.

### NFR-002: Performance

- List endpoint must return within 200ms for up to 1000 exams per tenant
- All FK lookups and filters must use indexed columns
- Criteria queries must be index-backed for runtime selection performance

### NFR-003: Idempotency

- Create endpoint uses `code` as the natural key — duplicate code returns 409 Conflict
- Settings PUT is idempotent — creates or updates in a single operation
- Criteria PUT is idempotent — replaces all criteria atomically

### NFR-004: Transactional Safety

- All write operations must use BEGIN/COMMIT/ROLLBACK transactions
- Manual question add/remove must be atomic (no partial state)
- Criteria replacement must be atomic (delete old + insert new in one transaction)

### NFR-005: Structured Logging

- All service functions must log using `@zidney/logger`
- Include `correlation_id`, `workspace_slug`, `workspace_id` in all log entries
- Log all state transitions with before/after status

### NFR-006: Snapshot Contract Integrity

- Exam configuration must be snapshot-safe: all runtime-relevant fields must be
  deterministically readable at attempt start time
- No live references during attempt execution — snapshot is the sole source of truth

---

## Data Model

### Table: mcq_exams

| Column                  | Type         | Constraints                           |
| ----------------------- | ------------ | ------------------------------------- |
| id                      | uuid         | PK, default random                    |
| subject_id              | uuid         | FK → subjects.id, NOT NULL, immutable |
| division_id             | uuid         | FK → divisions.id, nullable           |
| name                    | varchar(255) | NOT NULL                              |
| code                    | varchar(100) | NOT NULL, unique per tenant (partial) |
| description             | text         | nullable                              |
| language                | varchar(10)  | NOT NULL                              |
| total_questions         | integer      | NOT NULL, > 0                         |
| duration_minutes        | integer      | nullable                              |
| pass_type               | varchar(20)  | NOT NULL, CHECK (PERCENTAGE, SCORE)   |
| pass_value              | numeric      | NOT NULL, > 0                         |
| allow_multiple_attempts | boolean      | NOT NULL, default false               |
| selection_mode          | varchar(20)  | NOT NULL, CHECK (MANUAL, AUTOMATIC)   |
| status                  | varchar(30)  | NOT NULL, default COMPLETED           |
| deleted_at              | timestamptz  | nullable                              |
| created_at              | timestamptz  | NOT NULL, default NOW()               |
| updated_at              | timestamptz  | NOT NULL, default NOW()               |
| created_by              | uuid         | nullable                              |
| updated_by              | uuid         | nullable                              |

**Indexes:**

- `idx_mcq_exams_subject_id` ON (subject_id)
- `idx_mcq_exams_division_id` ON (division_id)
- `idx_mcq_exams_status` ON (status)
- `idx_mcq_exams_selection_mode` ON (selection_mode)
- `mcq_exams_code_unique_active` UNIQUE ON (LOWER(code)) WHERE deleted_at IS NULL (migration-owned)
- `idx_mcq_exams_deleted_at` ON (deleted_at)

### Table: mcq_exam_settings

| Column                    | Type        | Constraints                         |
| ------------------------- | ----------- | ----------------------------------- |
| id                        | uuid        | PK, default random                  |
| exam_id                   | uuid        | FK → mcq_exams.id, UNIQUE, NOT NULL |
| allow_relax_mode          | boolean     | NOT NULL, default true              |
| allow_chrono_mode         | boolean     | NOT NULL, default false             |
| allow_rush_mode           | boolean     | NOT NULL, default false             |
| allow_review_answers      | boolean     | NOT NULL, default true              |
| allow_review_hints        | boolean     | NOT NULL, default false             |
| allow_result_effects      | boolean     | NOT NULL, default true              |
| show_results_after_submit | boolean     | NOT NULL, default true              |
| show_correct_answers      | boolean     | NOT NULL, default false             |
| show_explanations         | boolean     | NOT NULL, default false             |
| enable_certificate        | boolean     | NOT NULL, default false             |
| message_template_id       | uuid        | nullable                            |
| created_at                | timestamptz | NOT NULL, default NOW()             |
| updated_at                | timestamptz | NOT NULL, default NOW()             |

**Indexes:**

- `idx_mcq_exam_settings_exam_id` UNIQUE ON (exam_id)

### Table: mcq_exam_questions

| Column      | Type        | Constraints                     |
| ----------- | ----------- | ------------------------------- |
| id          | uuid        | PK, default random              |
| exam_id     | uuid        | FK → mcq_exams.id, NOT NULL     |
| question_id | uuid        | FK → mcq_questions.id, NOT NULL |
| order_index | integer     | NOT NULL                        |
| created_at  | timestamptz | NOT NULL, default NOW()         |

**Indexes & Constraints:**

- UNIQUE (exam_id, question_id) — no duplicate questions per exam
- UNIQUE (exam_id, order_index) — no overlapping positions per exam
- `idx_mcq_exam_questions_exam_id` ON (exam_id)
- `idx_mcq_exam_questions_question_id` ON (question_id)

### Table: mcq_exam_auto_criteria

| Column             | Type        | Constraints                        |
| ------------------ | ----------- | ---------------------------------- |
| id                 | uuid        | PK, default random                 |
| exam_id            | uuid        | FK → mcq_exams.id, NOT NULL        |
| lesson_ids         | uuid[]      | nullable, array of lesson UUIDs    |
| category_value_ids | uuid[]      | nullable, array of category values |
| tag_ids            | uuid[]      | nullable, array of tag UUIDs       |
| basket_ids         | uuid[]      | nullable, array of basket UUIDs    |
| percentage         | integer     | NOT NULL, 0–100                    |
| created_at         | timestamptz | NOT NULL, default NOW()            |
| updated_at         | timestamptz | NOT NULL, default NOW()            |

**Indexes:**

- `idx_mcq_exam_auto_criteria_exam_id` ON (exam_id)

**Constraint:** Sum of `percentage` across all criteria for a given exam must equal 100
(application-level enforcement; checked at save and pre-enable validation).

---

## API Route Summary

| Method | Path                                                    | FR     | Description              |
| ------ | ------------------------------------------------------- | ------ | ------------------------ |
| POST   | /api/v1/workspace/:slug/mcq-exams                       | FR-001 | Create exam              |
| GET    | /api/v1/workspace/:slug/mcq-exams                       | FR-002 | List exams               |
| GET    | /api/v1/workspace/:slug/mcq-exams/:id                   | FR-003 | Get exam by ID           |
| PATCH  | /api/v1/workspace/:slug/mcq-exams/:id                   | FR-004 | Update exam              |
| DELETE | /api/v1/workspace/:slug/mcq-exams/:id                   | FR-005 | Soft-delete exam         |
| PUT    | /api/v1/workspace/:slug/mcq-exams/:id/settings          | FR-006 | Upsert delivery settings |
| GET    | /api/v1/workspace/:slug/mcq-exams/:id/settings          | FR-012 | Get delivery settings    |
| POST   | /api/v1/workspace/:slug/mcq-exams/:id/questions         | FR-007 | Add questions (manual)   |
| GET    | /api/v1/workspace/:slug/mcq-exams/:id/questions         | FR-013 | List questions (manual)  |
| DELETE | /api/v1/workspace/:slug/mcq-exams/:id/questions/:qid    | FR-008 | Remove question (manual) |
| PUT    | /api/v1/workspace/:slug/mcq-exams/:id/questions/reorder | FR-009 | Reorder questions        |
| PUT    | /api/v1/workspace/:slug/mcq-exams/:id/criteria          | FR-010 | Set criteria (auto)      |
| GET    | /api/v1/workspace/:slug/mcq-exams/:id/criteria          | FR-014 | Get criteria (auto)      |
| POST   | /api/v1/workspace/:slug/mcq-exams/:id/transition        | FR-011 | Workflow transition      |

---

## Error Codes

| Code                                | HTTP | Description                                      |
| ----------------------------------- | ---- | ------------------------------------------------ |
| MCQ_EXAM_NOT_FOUND                  | 404  | Exam not found or soft-deleted                   |
| MCQ_EXAM_CODE_EXISTS                | 409  | Duplicate exam code within tenant                |
| MCQ_EXAM_SUBJECT_IMMUTABLE          | 400  | Attempt to change subject_id after creation      |
| MCQ_EXAM_SELECTION_LOCKED           | 400  | Selection mode/questions locked after attempts   |
| MCQ_EXAM_DELETION_BLOCKED           | 409  | Exam has attempts or scheduled references        |
| MCQ_EXAM_INVALID_PASS_VALUE         | 400  | pass_value out of valid range                    |
| MCQ_EXAM_NO_DELIVERY_MODE           | 400  | No delivery mode enabled in settings             |
| MCQ_EXAM_CHRONO_NO_DURATION         | 400  | Chrono mode enabled but duration_minutes is null |
| MCQ_EXAM_MANUAL_COUNT_MISMATCH      | 400  | Question count ≠ total_questions at enable       |
| MCQ_EXAM_AUTO_SUM_INVALID           | 400  | Criteria percentages do not sum to 100           |
| MCQ_EXAM_QUESTION_SUBJECT_MISMATCH  | 400  | Question subject doesn't match exam subject      |
| MCQ_EXAM_QUESTION_DIVISION_MISMATCH | 400  | Question division doesn't match exam division    |
| MCQ_EXAM_QUESTION_NOT_ENABLED       | 400  | Question status is not ENABLED                   |
| MCQ_EXAM_QUESTION_DUPLICATE         | 409  | Question already linked to exam                  |
| MCQ_EXAM_SETTINGS_NOT_FOUND         | 404  | Settings not configured for exam                 |
| MCQ_EXAM_ENABLE_VALIDATION          | 400  | Pre-enable validation failed (generic)           |
| MCQ_EXAM_STATUS_LOCKED              | 400  | Cannot delete ENABLED exam                       |

---

## Dependencies

### Upstream (this stage depends on):

- **STAGE_28_SUBJECTS** — subjects table FK
- **STAGE_22_DIVISIONS** — divisions table FK
- **STAGE_34_MCQ_QUESTION_MODEL** — mcq_questions table FK for manual selection
- **STAGE_20_STATUS_WORKFLOW_ENGINE** — shared workflow engine for status transitions
- **STAGE_33_MCQ_BASKETS** — mcq_baskets for automatic criteria

### Downstream (future stages depend on this):

- **Scheduled Exam Engine** — references mcq_exams for scheduled events
- **Attempt Engine** — snapshots exam config at attempt creation
- **Backoffice UI** — exam management screens

---

## Constraints

- Database-per-tenant architecture — no cross-tenant queries
- Tenant resolver → license middleware mandatory on all routes
- All writes must be transactional (BEGIN/COMMIT/ROLLBACK)
- Server-authoritative time only (NOW() for all timestamps)
- Structured logging via @zidney/logger — no console.log
- Error contract: `{ success, data, error: { code, message } }`
- No direct DB Pool instantiation — injected DbClient only
- Workflow transitions via shared engine — no custom state machine
- Snapshot integrity: exam config must be deterministically readable at attempt start

---

## Clarifications

### Session 2026-04-01

**Q1: Workflow Engine Entity Registration — the existing `ENTITY_TABLE_MAP` has `exam: 'exams'`
but this stage creates `mcq_exams`. Should we register a new entity type `mcq_exam: 'mcq_exams'`
or reuse the generic `exam` mapping?**

A1: Register a new entity type `mcq_exam` → `mcq_exams` in `ENTITY_TABLE_MAP`. The existing
`exam: 'exams'` mapping is a forward declaration for a generic exam entity that does not yet
exist. MCQ exams and traditional exams (future) will use separate entity type keys. The workflow
transition API call must use `entity_type: 'mcq_exam'`.

**Q2: Initial workflow status — the stage file specifies initial status as `COMPLETED`. MCQ
questions also start at `COMPLETED`. Is this confirmed, or should MCQ exams start at `DRAFT`
like MCQ Baskets?**

A2: MCQ exams start at `COMPLETED` (consistent with subjects and MCQ questions). The `DRAFT`
initial state for MCQ Baskets was a special case because baskets can be incrementally assembled.
Exam configuration is created complete from the start.

**Q3: The workflow engine `executeTransition()` takes `entity_type` and `entity_id`. Does
pre-enable validation (manual count check, criteria sum check, delivery mode check) run inside
the workflow engine or as a separate validation before calling `executeTransition()`?**

A3: Pre-enable validation runs as a **pre-transition hook** in the MCQ exam service layer,
before calling `executeTransition()`. The workflow engine handles generic state machine logic
only. Domain-specific validation (question count, criteria sum, settings existence) is the
responsibility of the MCQ exam service's `transitionStatus()` method. If pre-enable validation
fails, the domain error is thrown before the workflow engine is invoked.

**Q4: Deletion guard for attempts and scheduled exams — these tables don't exist yet. Should
the deletion guard be implemented as a pluggable/extensible check or as a simple
early-return guard that always allows deletion until those stages are built?**

A4: Implement the deletion guard as a structured guard check pattern that currently checks
`status !== ENABLED` (cannot delete enabled exams). Add a TODO comment for future attempt-count
and scheduled-reference guards. Use the error code `MCQ_EXAM_DELETION_BLOCKED` for all deletion
guard failures. When the attempt table exists in a future stage, the guard will be extended.

**Q5: Auto criteria UUID array columns (`lesson_ids`, `category_value_ids`, `tag_ids`,
`basket_ids`) — should these use Postgres native `uuid[]` arrays, or should they be
normalized into separate join tables for referential integrity?**

A5: Use Postgres native `uuid[]` arrays as specified in the stage file. This is the correct
design for criteria-based filtering because: (a) criteria are replaced atomically (`PUT`), never
partially updated; (b) referential integrity is enforced at the application layer during criteria
validation; (c) join tables would add unnecessary complexity for a pattern that is always
read/replaced as a whole unit. If runtime performance requires it, GIN indexes can be added in
a future optimization stage.
