# STAGE 35 – Traditional Question Model

Phase: 03_BACKOFFICE_CORE Domain: 04_EXAM_ENGINE_CORE Database: Tenant DB

---

## Stage Status

Status: DRAFT
Step: specify
Risk Level: UNKNOWN
Last Updated: 2026-03-31T12:45:00Z

Scope Defined:

- traditional_questions table with 3 question types (TRUE_FALSE, FILL_BLANK, SHORT_ANSWER)
- traditional_question_categories and traditional_question_tags join tables
- Full CRUD API with 10 endpoints
- Workflow integration (DRAFT → COMPLETED → UNDER_REVIEW → APPROVED → ENABLED)
- Academic boundary and structural hierarchy enforcement
- Type-specific correct answer validation (JSONB)
- Self-correction model v1 (data contract only)
- Deletion guard (soft delete primary, hard delete restricted)

Deferred Scope:

- Attempt engine runtime (future stage)
- AI grading integration (future enhancement)
- Bulk question import/export

Architecture Governance Compliance:

- Specification drafted — governance audit pending

Notes:
Specification complete. Clarification step pending.

---

## Objective

Implement a normalized Traditional (paper-style) question model.

Traditional questions are structurally different from MCQ and must remain a separate engine.

Supported types (v1):

- TRUE_FALSE
- FILL_BLANK
- SHORT_ANSWER

Design must:

- Enforce academic boundaries (subject, division, lesson)
- Attach to exam template subsection structure
- Support classification (categories, tags)
- Integrate with workflow engine
- Support self-correction (v1)
- Be extensible for AI grading (future)

---

## Structural Hierarchy

Traditional questions belong to an exam template structure:

Exam Template └── Sections └── Subsections └── Questions

Rules:

1. Question must belong to exactly one subsection.
2. Subsection belongs to a section.
3. Section belongs to a template.
4. Template defines total structure.

Question cannot exist outside subsection.

---

## Core Table Structure

traditional_questions

- id (uuid)
- subject_id (required, fk → subjects.id)
- division_id (nullable, fk → divisions.id)
- lesson_id (nullable, fk → lessons.id)
- subsection_id (required, fk → traditional_exam_subsections.id)
- question_type (enum: TRUE_FALSE | FILL_BLANK | SHORT_ANSWER)
- content (rich text, required)
- correct_answer (json/text, nullable)
- correction_criteria (json/text, nullable)
- score (numeric, required)
- language (varchar)
- status (workflow-managed)
- created_at
- updated_at

Indexes:

- index(subject_id)
- index(division_id)
- index(lesson_id)
- index(subsection_id)
- index(question_type)
- index(status)

Constraints:

- subject_id required
- subsection_id required
- score > 0
- lesson must belong to subject
- division must belong to workspace scope

---

## Classification Tables

traditional_question_categories

- id (uuid)
- question_id (fk → traditional_questions.id)
- category_value_id (fk → category_values.id)

Constraints:

- unique(question_id, category_value_id)

Indexes:

- index(question_id)
- index(category_value_id)

---

traditional_question_tags

- id (uuid)
- question_id (fk → traditional_questions.id)
- tag_id (fk → tags.id)

Constraints:

- unique(question_id, tag_id)

Indexes:

- index(question_id)
- index(tag_id)

---

## Question Type Rules

TRUE_FALSE

- Must have correct_answer defined
- Auto-gradable

FILL_BLANK

- correct_answer required
- May support multiple accepted values (json array)
- Auto-gradable

SHORT_ANSWER

- correct_answer optional
- correction_criteria optional
- Self-corrected in v1
- AI grading extensible in future

Validation must occur before status transition to ENABLED.

---

## Academic Boundary Rules

1. Question must belong to exactly one subject.
2. Question may belong to one division (nullable → default division applies).
3. Question may belong to one lesson (nullable).
4. Lesson must belong to same subject.
5. Subsection must belong to template bound to same subject.

Cross-subject or cross-division assignment is forbidden.

---

## Workflow Integration

Status progression (via shared workflow engine):

COMPLETED → UNDER_REVIEW → APPROVED → ENABLED

Rules:

- Question cannot be ENABLED if score missing.
- Question cannot be ENABLED if structure invalid.
- Only ENABLED questions usable in Topics or Exercises.

---

## Grading Model (v1)

For SHORT_ANSWER:

System must store at attempt time:

- raw_answer (text)
- self_marked_correct (boolean)
- awarded_score (numeric)
- max_score_snapshot

Design must allow:

- Later teacher override
- Future AI scoring injection

No grading logic embedded in question model itself.

---

## Deletion Rules

Deletion must be blocked if question referenced in:

- Topic exams
- Exercises
- Scheduled exams
- Active attempts

Soft delete via status recommended.

---

## Integrity Guarantees

System must prevent:

- Question without subsection
- Question without score
- Cross-template reference
- Cross-tenant reference
- Using non-enabled question in exam

All relations must enforce foreign keys.

---

## Validation Criteria

Stage complete when:

- CRUD operations functional
- Subsection FK enforced
- Score validation enforced
- Type-specific validation enforced
- Workflow enforced
- Classification linking works
- Indexed queries verified
- Deletion guard validated

---

## Architectural Notes

Traditional engine must remain separate from MCQ engine.

No shared option tables. No polymorphic question table.

Separation ensures:

- Clear module boundaries
- Clean runtime grading logic
- Independent module activation in MMC

Traditional question model must align with Attempt snapshot design in runtime phase.
