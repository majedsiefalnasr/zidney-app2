# STAGE 27 – Semesters

Phase: 03_BACKOFFICE_CORE  
Domain: 02_ACADEMIC_STRUCTURE  
Database: Tenant DB only

---

## Stage Status

Status: DRAFT
Step: tasks
Risk Level: HIGH
Last Updated: 2026-03-20T00:25:00.000Z

Tasks Generated:

- Total: 27 atomic tasks across 9 groups
- 🔴 HIGH risk: T001 (migration), T007 (create TX), T010 (update TX), T011 (delete TX with FOR UPDATE lock)
- 🟡 MEDIUM risk: T002, T003, T006, T013, T018–T025, T026, T027
- 🟢 LOW risk: T004, T005, T008, T009, T012, T014–T017

Deferred Scope:

- subjects.semester_id column and FK (STAGE_28_SUBJECTS)
- subjects guard in deleteSemester (STAGE_28)
- Exam / content semester filtering (future modules)
- Frontoffice semester display

Constitutional Compliance:

- Task set compliant — drift analysis required before implementation
- Migration naming, schema_version, TX boundaries, logging all planned

Notes:
Atomic task set generated. 27 tasks. Drift analysis gate pending.

Scope Defined:

- Semester CRUD (create, list, read, update, soft delete)
- Soft delete with referential guard (students, subjects, exams, content)
- Unique name per workspace (partial unique index, excludes soft-deleted)
- Date validation (end_date >= start_date when both provided)
- Status ENABLED/DISABLED with assignment guard
- Nullable semester_id FK on students table
- Nullable semester_id FK on subjects table (FK deferred to STAGE_28)
- Division-first supremacy rule (FR-09)
- 5 API endpoints (GET list, POST, GET detail, PATCH, DELETE)

Deferred Scope:

- Subjects FK constraint deferred to STAGE_28_SUBJECTS
- Exam / content semester filtering (future modules)
- Frontoffice semester display

Constitutional Compliance:

- Specification drafted — constitutional audit pending

Notes:
Specification complete. Clarification step pending.

---

## Objective

Implement Semester as an academic time-segmentation entity within a workspace.

Semester is used for:

- Academic period grouping
- Subject scoping
- Exam scoping
- Reporting segmentation
- Student enrollment classification

Semester is not a division substitute. Division remains the primary academic isolation boundary.

---

## Data Model

Table: semesters

Columns:

- id (UUID, primary key)
- name (varchar, required)
- description (text, nullable)
- start_date (date, nullable)
- end_date (date, nullable)
- status (enum: ENABLED | DISABLED)
- created_at (timestamp)
- updated_at (timestamp)

Constraints:

- name must be unique within workspace
- If both start_date and end_date exist → end_date must be >= start_date
- status required

Indexes:

- unique(name)
- index(status)
- index(start_date)

---

## Relationship Rules

### Student Assignment

Student may belong to 0 or 1 semester.

students table must include:

- semester_id (nullable FK → semesters.id)

Rules:

- semester_id nullable
- If assigned, semester must be ENABLED
- Assignment validation enforced in backend

---

### Subject Relationship

Subject may optionally belong to a semester.

subjects table must include:

- semester_id (nullable FK → semesters.id)

Rules:

- Semester filtering must respect division boundary first
- Subject-semester relationship cannot override division

---

### Exam & Content Scope

Future modules (MCQ, Traditional Exams, Library, Lives) may optionally filter by semester.

Filtering contract:

WHERE ( content.semester_id IS NULL OR content.semester_id = student.semester_id )

Division filtering must always execute before semester filtering.

---

## Status Behavior

ENABLED:

- Available for assignment
- Visible in dropdowns

DISABLED:

- Cannot assign to new students or subjects
- Existing references remain valid
- Cannot be deleted while referenced

---

## Deletion Rules

Semester cannot be deleted if referenced by:

- students
- subjects
- exams
- content entities

Deletion must:

- Be validated transactionally
- Enforce referential integrity

Soft delete recommended over hard delete.

---

## Isolation Guarantees

- Semesters exist per tenant DB
- No cross-tenant reference allowed
- Semester must not override division-based access rules

Division boundary is always enforced first.

---

## Validation Criteria

Stage complete when:

- Semester CRUD works
- Unique name enforced
- Student optional assignment works
- Subject optional assignment works
- Date validation enforced
- Disabled semester not assignable
- Safe deletion restrictions enforced
- Visibility filtering verified

---

## Not Allowed

- Semester replacing division
- Cross-division visibility via semester
- Assignment to DISABLED semester
- Hard delete while referenced
- UI-only enforcement without backend validation

---

Next: STAGE_28_SUBJECTS
