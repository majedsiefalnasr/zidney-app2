# STAGE 34 – MCQ Question Model

Phase: 03_BACKOFFICE_CORE Domain: 04_EXAM_ENGINE_CORE Database: Tenant DB

---

## Stage Status

Status: DRAFT
Step: specify
Risk Level: UNKNOWN
Last Updated: 2026-03-30T00:01:00Z

Scope Defined:

- 5 normalized tables (mcq_questions, options, categories, tags, baskets)
- 4 question types with type-specific validation
- 13 API endpoints (CRUD, workflow, classification)
- Academic boundary enforcement
- Deletion guards

Deferred Scope:

- None

Constitutional Compliance:

- Specification drafted — constitutional audit pending

Notes:
Specification complete. Clarification step pending.

---

## Objective

Implement a normalized, scalable MCQ question model.

Supported types:

- SINGLE
- MULTIPLE
- TRUE_FALSE
- ARRANGEMENT

The model must:

- Enforce academic boundaries (subject, division, lesson)
- Support classification (categories, tags, baskets)
- Integrate with workflow engine
- Be compatible with automatic selection engine
- Remain tenant-isolated

---

## Core Table Structure

mcq_questions

- id (uuid)
- subject_id (required, fk → subjects.id)
- division_id (nullable, fk → divisions.id)
- lesson_id (nullable, fk → lessons.id)
- question_type (enum: SINGLE | MULTIPLE | TRUE_FALSE | ARRANGEMENT)
- language (varchar)
- content (rich text, required)
- explanation (text, nullable)
- is_revision_only (boolean, default false)
- is_exam_only (boolean, default false)
- status (workflow-managed)
- created_at
- updated_at

Indexes:

- index(subject_id)
- index(division_id)
- index(lesson_id)
- index(question_type)
- index(status)

Constraints:

- subject_id required
- division_id must belong to subject context
- lesson_id must belong to subject

---

mcq_question_options

- id (uuid)
- question_id (fk → mcq_questions.id)
- content (rich text)
- is_correct (boolean)
- order_index (integer)
- created_at

Indexes:

- index(question_id)

Constraints:

- unique(question_id, order_index)
- cascade delete on question delete

---

mcq_question_categories

- id (uuid)
- question_id (fk → mcq_questions.id)
- category_value_id (fk → category_values.id)

Indexes:

- index(question_id)
- index(category_value_id)

Constraint:

- unique(question_id, category_value_id)

---

mcq_question_tags

- id (uuid)
- question_id (fk → mcq_questions.id)
- tag_id (fk → tags.id)

Indexes:

- index(question_id)
- index(tag_id)

Constraint:

- unique(question_id, tag_id)

---

mcq_question_baskets

- id (uuid)
- question_id (fk → mcq_questions.id)
- basket_id (fk → mcq_baskets.id)

Indexes:

- index(question_id)
- index(basket_id)

Constraint:

- unique(question_id, basket_id)

---

## Question Type Rules

SINGLE

- Exactly 1 correct option
- Minimum 2 options

MULTIPLE

- Minimum 1 correct option
- Minimum 2 options

TRUE_FALSE

- Exactly 2 options
- Exactly 1 correct

ARRANGEMENT

- All options required
- order_index defines correct sequence
- is_correct ignored

Validation must be enforced at API level before status transition.

---

## Academic Boundary Rules

1. Question must belong to exactly one subject.
2. Question may belong to one division (nullable → default division applies).
3. Question may belong to one lesson (nullable).
4. Lesson must belong to the same subject.
5. Division must belong to workspace scope.

Cross-subject or cross-division assignment is forbidden.

---

## Classification Rules

Question may have:

- Multiple category values
- Multiple tags
- Multiple baskets

Classification must remain optional but indexed.

Auto-selection engine depends on:

- subject_id
- lesson_id
- division_id
- category_value_id
- tag_id
- basket_id

All filterable columns must be indexed.

---

## Workflow Integration

Status progression (via shared workflow engine):

COMPLETED → UNDER_REVIEW → APPROVED → ENABLED

Rules:

- Question cannot be ENABLED without valid options
- Question cannot be ENABLED if validation fails
- Only ENABLED questions selectable in exams

---

## Deletion Rules

Question deletion must be blocked if referenced in:

- MCQ exams
- Scheduled exams
- Active attempts

Soft delete recommended (status-based) instead of hard delete.

---

## Integrity Guarantees

System must prevent:

- Orphan options
- Duplicate option order
- Invalid correct-answer configuration
- Cross-tenant references
- Using non-enabled questions in exams

---

## Validation Criteria

Stage complete when:

- CRUD operations functional
- Type-specific validation enforced
- Workflow enforced
- Classification linking works
- Basket linking works
- Indexed queries verified
- Deletion guard validated

---

## Architectural Notes

MCQ model must remain normalized.

No JSON answer storage allowed. No denormalized option arrays.

All relations must use foreign keys.

MCQ question model must remain compatible with Attempt snapshot model defined in runtime phase.
