# STAGE 27 – Semesters

Phase: 03_BACKOFFICE_CORE  
Domain: 02_ACADEMIC_STRUCTURE  
Database: Tenant DB only

---

## Stage Status

Status: PRODUCTION READY
Step: stage_production_ready
Risk Level: MEDIUM
Closure Date: 2026-03-20

Scope Delivered:

- ✅ Semester CRUD (create, list, read, update, soft delete) — 5 endpoints
- ✅ Soft delete with referential guard (students enrolled check via SELECT FOR UPDATE)
- ✅ Unique name per workspace (partial functional unique index on LOWER(name) WHERE deleted_at IS NULL)
- ✅ Date validation (end_date >= start_date when both provided, server-side)
- ✅ Status ENABLED/DISABLED (VARCHAR(20) + CHECK constraint)
- ✅ Nullable semester_id FK on students table (ON DELETE RESTRICT)
- ✅ 5 REST endpoints under /api/v1/backoffice/workspace
- ✅ 27/27 atomic tasks completed
- ✅ 15 unit tests + 13 integration tests passing

Deferred Scope:

- subjects.semester_id column and FK (STAGE_28_SUBJECTS)
- subjects guard in deleteSemester (STAGE_28) — countSubjectsForSemester stub returns 0
- Exam / content semester filtering (future modules)
- Frontoffice semester display

Constitutional Compliance:

- ADR-0001 Database-per-tenant isolation enforced — all DB via tenant resolver context
- ADR-0006 Server-authoritative time enforced — NOW() in SQL, no client timestamps
- ADR-0007 Version compatibility enforced — schema_version bumped 1.10.0 → 1.11.0
- ADR-0008 Semantic versioning enforced — minor bump for additive schema change
- All 4 guardian audits: PASS (security, performance, QA, code review)
- TypeScript: clean (zero errors)
- Lint: clean (zero errors)

Audit Results:

- security_auditor: PASS
- performance_optimizer: PASS
- qa_engineer: PASS
- code_reviewer: PASS
- drift_analysis: PASSED (all criteria)

Notes:
Stage is production ready. No structural backend modifications allowed.
Modifications require a new migration stage.

- Architecture layer boundaries: PASS
- Tenant isolation: PASS
- License middleware: PASS
- Transaction boundaries: PASS

Notes:
Full drift analysis passed. Implementation gate open. 27 tasks ready for execution.

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
