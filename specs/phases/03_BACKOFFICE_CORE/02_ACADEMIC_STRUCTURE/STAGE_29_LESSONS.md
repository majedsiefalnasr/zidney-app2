# STAGE 29 – Lessons

Phase: 03_BACKOFFICE_CORE  
Domain: 02_ACADEMIC_STRUCTURE  
Database: Tenant DB

---

## Stage Status

Status: DRAFT
Step: clarify
Risk Level: HIGH
Last Updated: 2026-03-21T00:02:00.000Z

Scope Defined:

- Lesson CRUD (list, create, get, update, soft-delete)
- Tenant DB migration: lessons table with subject_id FK (20260321_007_lessons.ts)
- Status lifecycle: ENABLED | DISABLED
- Permission gate: question_manage OR subject_manage
- Division scoping via Subject FK (transitive)
- Hard delete blocked when referenced by questions/auto-selection/exam configs
- MIN_SCHEMA_VERSION = 1.13.0
- PATCH guard ordering contract established

Deferred Scope:

- Frontoffice lesson views (not in this stage)
- MCQ/Traditional question tagging (downstream stage dependency)
- Auto-selection filter integration (downstream)

Constitutional Compliance:

- Clarifications resolved — planning authorized

Notes:
All specification ambiguities resolved. Risk Level: HIGH. Ready for technical planning.

---

## Objective

Implement Lesson as the smallest structured academic unit under Subject.

A Lesson:

- Must belong to exactly one Subject.
- Cannot exist without a Subject.
- Does not directly belong to Division, Department, Group, or Semester.
- Inherits access scoping from Subject.

Lessons are classification units used for:

- MCQ questions
- Traditional questions
- Auto-selection filtering
- Analytics breakdown

---

## Data Model

Table: lessons

Columns:

- id (uuid, primary key)
- subject_id (uuid, required, FK → subjects.id, ON DELETE RESTRICT)
- name (varchar, required)
- code (varchar, optional)
- description (text, nullable)
- status (ENUM: ENABLED | DISABLED)
- created_at (timestamp)
- updated_at (timestamp)
- created_by (uuid, FK → users.id, nullable)
- updated_by (uuid, FK → users.id, nullable)

Indexes:

- idx_lessons_subject_id
- idx_lessons_status
- unique(subject_id, name)

---

## Structural Rules

1. A Lesson must always reference an existing Subject.
2. A Subject cannot be deleted if Lessons exist.
3. Lessons must not reference Division directly.
4. Subject division rules automatically apply to Lesson.
5. Lesson names must be unique within the same Subject.

---

## Lifecycle Rules

Status = ENABLED:

- Can be used in question creation.
- Can be used in auto-selection filters.
- Visible in Backoffice UI.

Status = DISABLED:

- Cannot be selected in new content.
- Existing questions remain valid.
- Historical attempts unaffected.

Hard delete of Lesson is NOT allowed if referenced by:

- MCQ questions
- Traditional questions
- Auto-selection configurations
- Exam configurations

Soft delete via status change only.

---

## Access Control

Creation, update, deletion must require:

- question_manage permission OR
- subject_manage permission

Division-level access enforced through Subject.

---

## Performance Requirements

Lesson queries must support:

- Filtering by subject
- Filtering by status
- Sorting by name

All foreign keys must be indexed.

---

## Validation Criteria

Stage is complete when:

- Lesson CRUD works.
- Subject foreign key enforced.
- Unique constraint enforced per subject.
- Deletion restricted if referenced.
- Division scoping inherited from Subject.
- No cross-tenant access possible.

---

## Not Allowed

- Lesson without subject_id.
- Direct division reference in lesson table.
- Hard deletion when referenced.
- Cross-subject lesson reuse.

---

Next stage: STAGE_30_CATEGORIES
