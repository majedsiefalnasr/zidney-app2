# STAGE 37 – Traditional Exam Configuration

Phase: 03_BACKOFFICE_CORE  
Domain: 04_EXAM_ENGINE_CORE  
Database: Tenant DB

---

## Stage Status

Status: DRAFT
Step: tasks
Risk Level: HIGH
Last Updated: 2026-04-02T00:35:00Z

Tasks Generated:

- Total: 45 atomic tasks across 14 phases
- Infrastructure: 6 (migration + schemas)
- Domain-core: 14 (types, errors, validators, dep-registry, repository, service, barrel)
- Validation: 1 (13 Zod schemas)
- Routes: 18 (helpers + 16 handlers + router factory)
- Registration: 1 (app.ts)
- Governance: 3 (typecheck, lint, arch guard)

Deferred Scope:

- Template CRUD (separate stage)
- Attempt/delivery engine
- Student-facing views
- Certificate generation
- Bulk question assignment

Architecture Governance Compliance:

- Task set compliant — drift analysis required before implementation

Notes:
Atomic task set generated. Drift analysis gate pending.

---

## Objective

Implement the Traditional Exam configuration system.

Supports:

- Topics (core module)
- Exercises (module-flag variation of Topics)
- Scheduled Traditional Exams (time window handled in scheduling stage)

Traditional exam is structured paper-style delivery.

---

## Core Table

### Table: traditional_exams

Columns:

- id (uuid, primary key)
- subject_id (uuid, required)
- division_id (uuid, nullable → fallback to default division)
- semester_id (uuid, nullable)
- name (varchar, required)
- code (varchar, unique per tenant)
- description (text, nullable)
- duration_minutes (integer, nullable if Relax mode allowed)
- pass_percentage (numeric, required)
- module_type (ENUM: TOPIC | EXERCISE)
- workflow_status (ENUM: DRAFT | UNDER_REVIEW | APPROVED | ENABLED | DISABLED)
- template_id (uuid, required)
- created_at (timestamp)
- updated_at (timestamp)
- created_by (uuid)
- updated_by (uuid)

Indexes:

- idx_traditional_exams_subject
- idx_traditional_exams_division
- idx_traditional_exams_workflow
- idx_traditional_exams_module

---

## Template Reference

Each traditional_exam must reference a predefined template.

Templates define:

- Sections
- Subsections
- Structural layout only
- No actual questions

Rules:

- Template is immutable after exam creation.
- Template cannot be changed once exam has attempts.
- Template integrity must be validated before ENABLED status.

---

## Delivery Configuration

### Table: traditional_exam_settings

Columns:

- id (uuid, primary key)
- exam_id (uuid, FK → traditional_exams.id, unique)
- allow_relax_mode (boolean)
- allow_chrono_mode (boolean)
- allow_review_answers (boolean)
- allow_review_hints (boolean)
- allow_result_effects (boolean)
- show_results_after_submit (boolean)
- show_correct_answers (boolean)
- show_explanations (boolean)
- enable_certificate (boolean)
- message_template_id (uuid, nullable)
- created_at (timestamp)
- updated_at (timestamp)

Constraints:

- At least one mode must be enabled.
- Rush mode is NOT supported for Traditional exams.
- Chrono mode requires duration_minutes defined.

---

## Exam Content Structure

Traditional exams must mirror the selected template structure.

### Table: traditional_exam_sections

- id (uuid)
- exam_id (uuid)
- template_section_id (uuid)
- header_content (text)
- order_index (integer)

---

### Table: traditional_exam_subsections

- id (uuid)
- section_id (uuid)
- template_subsection_id (uuid)
- header_content (text)
- order_index (integer)

---

### Table: traditional_exam_questions

- id (uuid)
- subsection_id (uuid)
- question_id (uuid → traditional_questions.id)
- score (numeric, copied snapshot from question)
- order_index (integer)

Indexes:

- idx_traditional_exam_questions_subsection
- unique(subsection_id, question_id)

---

## Structural Rules

- Exam subject must match question subject.
- Question must be ENABLED.
- Question workflow_status must allow usage.
- Score snapshot copied at assignment time.
- Modifying question later does NOT affect existing exams.
- Cannot ENABLE exam unless:
  - All template sections present
  - All subsections present
  - At least one question assigned per subsection
  - pass_percentage defined
  - Total score > 0

---

## Workflow Integration

workflow_status transitions must follow:

DRAFT → UNDER_REVIEW → APPROVED → ENABLED  
ENABLED → DISABLED

Rules:

- Only APPROVED exam can be ENABLED.
- Cannot ENABLE if structural validation fails.
- Cannot revert to DRAFT after ENABLED.
- DISABLED prevents new attempts.

---

## Isolation Guarantees

- Division scoping enforced at query layer.
- Staff can only manage exams inside assigned divisions.
- No cross-tenant references allowed.
- All DB access via resolver context only.

---

## Attempt Compatibility

When attempt starts:

System must snapshot:

- Exam structure
- Section ordering
- Subsection ordering
- Question order
- Score per question
- Mode configuration
- Result visibility flags
- Duration settings

Exam edits after attempt creation must not affect existing attempts.

---

## Validation Criteria

Stage is complete when:

- Traditional exam CRUD works.
- Template integrity enforced.
- Structural validation blocks invalid ENABLE.
- Mode rules validated.
- Workflow enforced.
- Division scoping enforced.
- Snapshot compatibility verified.
- Isolation validated.

---

## Not Allowed

- Changing template after attempts exist.
- Mixing questions from different subjects.
- Enabling exam without structure.
- Supporting Rush mode.
- Cross-tenant references.

---

Next stage: STAGE_38_SCHEDULED_ENGINE
