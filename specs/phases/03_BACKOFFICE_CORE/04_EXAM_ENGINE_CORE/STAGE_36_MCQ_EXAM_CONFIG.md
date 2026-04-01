# STAGE 36 – MCQ Exam Configuration

Phase: 03_BACKOFFICE_CORE Domain: 04_EXAM_ENGINE_CORE Database: Tenant DB

---

## Stage Status

Status: IN PROGRESS
Step: analyze
Risk Level: HIGH
Last Updated: 2026-04-01T00:05:00Z

Drift Analysis: PASSED (all criteria)
Implementation: AUTHORIZED

Scope Authorized:

- 4 tenant-scoped tables (mcq_exams, mcq_exam_settings, mcq_exam_questions, mcq_exam_auto_criteria)
- 14 REST API endpoints under /backoffice/mcq-exams
- Workflow engine integration (mcq_exam entity type)
- Domain-core package (types, errors, repository, validators, service)
- Zod validation schemas
- Migration 014 (schema 1.19.0 → 1.20.0)

Architecture Governance Compliance:

- All drift criteria passed — implementation authorized

Notes:
Full drift analysis passed. Implementation gate open.

---

## Objective

Implement the MCQ Exam configuration entity.

MCQ Exam represents a reusable, backoffice-defined assessment configuration.

It must support:

- Manual question selection
- Automatic question selection
- Delivery mode control (Relax, Chrono, Rush)
- Result visibility configuration
- Certificate integration
- Division scoping
- Workflow enforcement

MCQ Assessment (user-generated) is NOT stored as mcq_exams. MCQ Scheduled Exam is implemented in
scheduled engine stage.

---

## Core Table

mcq_exams

- id (uuid)
- subject_id (fk → subjects.id, required)
- division_id (fk → divisions.id, nullable)
- name (varchar, required)
- code (varchar, unique per tenant, required)
- description (text, nullable)
- language (varchar, required)
- total_questions (integer, required)
- duration_minutes (integer, nullable)
- pass_type (enum: PERCENTAGE | SCORE, required)
- pass_value (numeric, required)
- allow_multiple_attempts (boolean, default false)
- selection_mode (enum: MANUAL | AUTOMATIC, required)
- status (workflow-managed)
- created_at
- updated_at

Indexes:

- index(subject_id)
- index(division_id)
- index(status)
- unique(code)

Constraints:

- subject_id immutable after creation
- total_questions > 0
- pass_value > 0

---

## Delivery Configuration

mcq_exam_settings

- id (uuid)
- exam_id (fk → mcq_exams.id, unique)
- allow_relax_mode (boolean)
- allow_chrono_mode (boolean)
- allow_rush_mode (boolean)
- allow_review_answers (boolean)
- allow_review_hints (boolean)
- allow_result_effects (boolean)
- show_results_after_submit (boolean)
- show_correct_answers (boolean)
- show_explanations (boolean)
- enable_certificate (boolean)
- message_template_id (nullable fk)

Rules:

- At least one delivery mode must be enabled.
- If allow_chrono_mode = true → duration_minutes must not be null.
- Rush mode implies per-question timer enforcement at runtime.

---

## Manual Question Selection

mcq_exam_questions

- id (uuid)
- exam_id (fk → mcq_exams.id)
- question_id (fk → mcq_questions.id)
- order_index (integer)

Constraints:

- unique(exam_id, question_id)
- unique(exam_id, order_index)

Rules:

- Question subject must match exam subject.
- Question division must match exam division or default.
- Only ENABLED questions allowed.
- total_questions must equal count of linked questions.

---

## Automatic Question Selection

mcq_exam_auto_criteria

- id (uuid)
- exam_id (fk → mcq_exams.id)
- lesson_ids (array<uuid>, nullable)
- category_value_ids (array<uuid>, nullable)
- tag_ids (array<uuid>, nullable)
- basket_ids (array<uuid>, nullable)
- percentage (integer 0–100)

Rules:

- Sum of percentage across criteria must equal 100.
- Subject filter is implicit from exam.
- Division filter enforced automatically.
- Only ENABLED questions selectable.
- Criteria must be index-backed queries.

Selection result must be deterministic and snapshot at attempt start.

---

## Workflow Rules

Status progression:

COMPLETED → UNDER_REVIEW → APPROVED → ENABLED

Rules:

- Cannot ENABLE without valid configuration.
- Cannot ENABLE if manual count mismatch.
- Cannot ENABLE if automatic criteria sum != 100.
- Cannot modify selection logic after first attempt exists.
- Minor metadata edits allowed after attempts.

---

## Integrity & Restrictions

Deletion must be blocked if:

- Exam has attempts
- Exam referenced in scheduled exams

Soft disable via workflow recommended.

Subject cannot be changed after creation. Division change allowed only before ENABLED.

---

## Runtime Contract

At attempt start, system must snapshot:

- question_ids
- question_order
- delivery mode
- review flags
- pass criteria
- grading configuration

Exam configuration must never be read dynamically during attempt execution.

---

## Validation Criteria

Stage complete when:

- CRUD operational
- Delivery settings validated
- Manual selection validated
- Automatic selection validated
- Workflow enforced
- Snapshot contract respected
- Indexed queries verified
- Deletion guards enforced

---

Next: STAGE_37_TRADITIONAL_EXAM_CONFIG
