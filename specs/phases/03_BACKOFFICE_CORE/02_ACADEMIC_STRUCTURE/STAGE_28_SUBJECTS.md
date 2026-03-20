# STAGE 28 – Subjects

Phase: 03_BACKOFFICE_CORE  
Domain: 02_ACADEMIC_STRUCTURE  
Database: Tenant DB only  
Status: Critical

---

## Stage Status

Status: DRAFT
Step: tasks
Risk Level: HIGH
Last Updated: 2026-03-20T00:45:00.000Z

Tasks Generated:

- Total: 27 atomic tasks across 10 phases (A–J)
- Migration (1): T001
- Schema (1): T002
- Domain core types/errors/registry (3): T003–T005 (parallel group B)
- Repository (1): T006
- Service layer (7): T007–T013
- Validation schemas (1): T014
- Route helpers (1): T015
- Route handlers (7): T016–T022 (parallel group G)
- Router assembly + app registration (2): T023–T024
- Tests + validation gate (3): T025–T027

Deferred Scope:

- Subject-count license limits (downstream limits stage)
- Frontoffice direct subject CRUD (not in scope; frontoffice inherits via enrolled exam)
- Downstream content FK dependencies (registered additively by downstream stages into the subjects dependency registry)

Constitutional Compliance:

- Task set compliant with Zidney Constitution v1.2.0 — drift analysis required before implementation
- All write paths covered by transactional tasks (T008, T010, T011, T012)
- Idempotency represented in T001 (IF NOT EXISTS), T011 (CAS), T012 (deleted_at guard)
- State machine fully covered by T011, T025, T026

Notes:
27 atomic tasks generated. Drift analysis gate pending. Critical ordering: GET /subjects/runtime (T018/T023) must be registered before GET /subjects/:id to prevent Hono path param collision.

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
