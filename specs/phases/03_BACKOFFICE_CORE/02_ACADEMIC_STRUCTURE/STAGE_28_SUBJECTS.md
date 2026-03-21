# STAGE 28 – Subjects

Phase: 03_BACKOFFICE_CORE  
Domain: 02_ACADEMIC_STRUCTURE  
Database: Tenant DB only  
Status: Critical

---

## Stage Status

Status: BACKEND CLOSED
Step: implement
Risk Level: HIGH
Last Updated: 2025-07-23T00:00:00.000Z

Implementation: COMPLETE
Tasks: 27 / 27 completed

Scope Closed:

- Tenant DB migration: subjects table, 9 indexes, FK constraints, schema_version 1.11.0→1.12.0
- Domain package: packages/domain-core/src/subjects/ (types, errors, dependency-registry, repository, service, index)
- Validation schemas: packages/validation/src/backoffice/subjects.schemas.ts (5 schemas)
- Route handlers: apps/api/src/routes/backoffice/subjects/ (7 handlers + helpers + index)
- Route registration: apps/api/src/app.ts
- Unit tests (19 tests passing) + integration tests (17 tests passing)
- All 27 tasks completed — 0 deferred

Deferred Scope:

- Subject-count license limits (downstream limits stage)
- translation_coverage field (P3, STAGE_19 translation infrastructure)
- Downstream content FK dependencies (registered additively by downstream stages)
- semesterBelongsToDivision full implementation (forward-compatibility stub — semesters table has no division_id at STAGE_27)

Constitutional Compliance:

- ADR alignment verified
- Implementation compliant with Zidney Constitution v1.2.0
- Tenant isolation enforced via getDb(c) in all handlers
- All write operations transactional (createSubject, updateSubject, deleteSubject)
- Idempotency via CAS on updated_at (transitionSubjectStatus) + IF NOT EXISTS in migration
- No cross-tenant access; no stack traces exposed to clients; structured logging throughout

Notes:
Backend implementation complete. No structural backend modifications allowed.
Modifications require a new migration stage.

---

## Objective

Implement Subject as the primary academic container within a workspace.

Subject is the root academic entity required for:

- Lessons
- MCQ Questions
- Traditional Questions
- Exams
- Exercises
- Scheduled Exams
- Library Items
- Live Sessions
- Categories & Classification

No academic content may exist without a subject.

---

## Architectural Role

Subject defines the academic boundary for:

- Content ownership
- Filtering logic
- Visibility rules
- Auto-selection engines
- Reporting & analytics

Subjects are tenant-isolated and never shared across workspaces.

---

## Table Structure

subjects:

- id (uuid / pk)
- name (string, required)
- code (string, optional but unique if present)
- division_id (nullable, auto-assigned if divisions disabled)
- semester_id (nullable)
- is_multilanguage (boolean, default false)
- default_language (string, required)
- description (text, nullable)
- status (workflow-managed)
- created_at
- updated_at
- deleted_at (nullable, soft delete)

Indexes required:

- division_id
- semester_id
- status
- code (unique where not null)

---

## Relationship Rules

1. Division Boundary

- Subject may belong to a division.
- If divisions are disabled:
  - Subject must auto-link to default division.
- Cross-division linking is prohibited.

2. Semester Boundary

- Subject may optionally belong to a semester.
- Semester must belong to same division (if divisions enabled).

3. Content Dependency

Subject is mandatory before creating:

- MCQ questions
- Traditional questions
- Exams
- Exercises
- Library items
- Live sessions
- Categories (if subject-scoped)

Deletion of subject must be blocked if dependent records exist.

---

## Workflow Integration

Subject uses the global Status Workflow Engine.

Typical states:

- DRAFT
- ACTIVE
- ARCHIVED

Rules:

- Only ACTIVE subjects can be used in runtime.
- DRAFT subjects not visible in frontoffice.
- ARCHIVED subjects hidden but preserved for historical integrity.

Workflow transitions require permission.

---

## Multi-language Enforcement

If is_multilanguage = true:

- Translation entries required for supported languages.
- default_language must exist in workspace language settings.
- Fallback must resolve to default_language.

If false:

- Subject name stored only in default_language.
- Translation table entries optional.

Translation coverage must be tracked.

---

## Division Disabled Mode

If workspace disables divisions:

- All subjects must belong to default division.
- Disabling divisions must not break FK constraints.
- Historical data must remain intact.

Division toggle must be transactional.

---

## Visibility Enforcement Contract

All queries must filter by:

- division_id (if divisions enabled)
- semester_id (if semester filtering enabled)
- status = ACTIVE (for runtime)

Backend must enforce filtering.

Frontend must never control subject visibility logic.

---

## Deletion Policy

Hard delete prohibited.

Soft delete only if:

- No dependent records
- OR explicit cascade policy defined

Deleted subjects must not appear in selection lists.

---

## Validation Criteria

Stage complete when:

- Subject CRUD fully functional
- Division boundary enforced
- Semester linking validated
- Workflow transitions validated
- Translation fallback validated
- Visibility filtering enforced at API layer
- Soft delete rules enforced
- Cross-tenant isolation verified

---

## Not Allowed

- Subject without default_language
- Subject without workflow state
- Cross-division subject linking
- Hard deletion with dependent records
- Frontend-based filtering logic
- Direct references to master_db

Subject is a structural academic root entity.

Downstream engines rely on its integrity.
