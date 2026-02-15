# STAGE 53 – Attempt Schema

Phase: 04_RUNTIME  
Domain: 01_ATTEMPT_ENGINE  
Database: Tenant DB  
Status: Critical  
Scope: Unified, snapshot-based attempt persistence model

---

## Objective

Define a unified, immutable, snapshot-based attempt schema that supports:

- MCQ Exams
- MCQ Assessments
- MCQ Scheduled Exams
- Traditional Exams (Topics / Exercises)
- Traditional Scheduled Exams

The attempt engine must guarantee:

- Snapshot integrity
- No dependency on live exam configuration
- Safe autosave behavior
- Deterministic grading
- Concurrency safety

This schema is runtime-critical.

---

## Core Design Principles

1. All attempts are snapshot-based.
2. No grading logic depends on live exam tables.
3. Exam configuration is copied at attempt start.
4. Question order is frozen.
5. Mode behavior is frozen.
6. Grading configuration is frozen.
7. Schema must support autosave.
8. Submission must be idempotent.

---

## attempts Table

Represents one runtime session.

### Required Fields

- id (UUID, PK)
- user_id (FK → users)
- exam_id (nullable for assessment-generated)
- exam_type (MCQ | TRADITIONAL | ASSESSMENT)
- is_scheduled (boolean)
- scheduled_exam_id (nullable)
- mode (RELAX | CHRONO | RUSH)

### Timing Fields

- started_at
- expires_at (nullable)
- submitted_at (nullable)
- auto_submitted (boolean default false)
- forced_submission_reason (nullable)

### Status Fields

- status (IN_PROGRESS | SUBMITTED | GRADED | LOCKED)
- grading_status (PENDING | PROCESSING | COMPLETED | FAILED)

### Result Fields

- total_score (nullable)
- percentage (nullable)
- passed (nullable)

### Snapshot Fields

- exam_snapshot (JSONB)
- grading_snapshot (JSONB)
- random_seed (nullable)

### Audit Fields

- created_at
- updated_at

---

## exam_snapshot (JSONB)

Must include:

- exam_id
- exam_type
- title
- subject_id
- pass_mark
- mode
- duration
- review_allowed
- hint_allowed
- result_effects_enabled
- shuffle_enabled
- selection_rules (if assessment)
- division_scope
- grading_strategy

No runtime grading must query live exam config.

---

## grading_snapshot (JSONB)

Must include:

- scoring_type (PERCENTAGE | POINTS | WEIGHTED)
- per_question_weight (nullable)
- negative_marking (boolean)
- penalty_value (nullable)
- passing_rule_definition
- manual_review_required (boolean)
- grading_algorithm_version

Grading must use snapshot only.

---

## attempt_questions Table

Stores frozen question order.

### Fields

- id (UUID)
- attempt_id (FK → attempts)
- question_id
- order_index
- question_snapshot (JSONB)

### question_snapshot Must Include

- question_text
- question_type
- options (for MCQ)
- correct_answer_definition
- scoring_metadata
- explanation (if allowed)

Indexes:

- attempt_id
- (attempt_id, order_index)
- question_id

Unique constraint:

- (attempt_id, order_index)

---

## attempt_answers Table

Stores autosaved answers.

Fields:

- id (UUID)
- attempt_id (FK → attempts)
- question_id
- answer_payload (JSONB)
- is_correct (nullable)
- score_awarded (nullable)
- saved_at

Indexes:

- attempt_id
- (attempt_id, question_id)

Unique constraint:

- (attempt_id, question_id)

Autosave must upsert based on (attempt_id, question_id).

---

## Concurrency Guarantees

- Attempt creation must be transactional.
- Question snapshot creation must be atomic.
- Submission must be idempotent.
- No duplicate submission allowed.
- Status transitions must be enforced via update condition:
  WHERE status = 'IN_PROGRESS'

---

## Status Lifecycle

IN_PROGRESS → SUBMITTED → GRADED → LOCKED

Rules:

- SUBMITTED is final answer state.
- GRADED occurs after grading process.
- LOCKED used for archived or reviewed attempts.
- No transition backwards allowed.

---

## Isolation Rules

- Attempt must belong to same workspace as user.
- Attempt must not reference cross-tenant data.
- attempt_questions must not reference questions from another tenant.

---

## Performance Considerations

- All foreign keys indexed.
- attempt_answers optimized for frequent writes.
- Snapshot JSONB fields indexed only if required.
- Avoid large JSON bloating — snapshot minimal required data only.

---

## Forbidden

- Live exam config lookup during grading.
- Live question lookup during review.
- Mutable snapshot after submission.
- Cross-tenant attempt queries.
- Full table scan during autosave.

---

## Completion Criteria

Stage complete when:

- Attempt created with frozen snapshot
- Question order preserved
- Autosave works with upsert
- Submission idempotent
- Grading uses snapshot only
- Status transitions enforced
- Concurrent submissions blocked
- Cross-tenant isolation verified
