# Specify Report — Semesters

**Step:** 1 — Specify  
**Timestamp:** 2026-03-20T00:05:00.000Z  
**Status:** COMPLETE

---

## Summary

Specification complete for the Semesters stage (STAGE_27). The spec defines Semester as an
academic time-segmentation entity within a workspace tenant. It covers the full CRUD lifecycle,
status behavior, soft delete with referential guards, student/subject nullable FK assignments,
and the division-first supremacy rule. All architectural decisions are captured. No
`[NEEDS CLARIFICATION]` markers remain. Spec is ready for clarification.

---

## Inputs Reviewed

- `specs/runtime/027-semesters/spec.md`
- `specs/runtime/027-semesters/checklists/requirements.md`
- `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_27_SEMESTERS.md`

---

## Key Decisions

| #   | Decision                                                | Rationale                                                                                           |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | Soft delete via `deleted_at` column                     | Hard delete forbidden while references exist; soft delete allows safe removal without FK violations |
| 2   | Partial unique index on `name WHERE deleted_at IS NULL` | Allows name reuse after soft deletion; enforces uniqueness only among active records                |
| 3   | Subjects FK deferred to STAGE_28_SUBJECTS               | Subjects table may not be fully defined here; adds column now, FK constraint added later            |
| 4   | Division-first supremacy enforced (FR-09)               | Semester filters always applied after division scope; semester cannot override division access      |
| 5   | Assignment via existing write paths                     | No dedicated assignment endpoint; `semester_id` validated in student/subject update handlers        |
| 6   | DISABLED status is a write guard only                   | Existing references remain valid; only blocks new assignments                                       |

---

## Functional Requirements Captured

- FR-01: Create semester with name (required, unique per workspace), description (optional), start_date/end_date (optional), status (required)
- FR-02: Unique name validation within workspace (excluding soft-deleted records)
- FR-03: Date validation — if both dates provided, end_date >= start_date
- FR-04: List semesters with status filter, name search, and pagination
- FR-05: Get semester detail by ID
- FR-06: Update semester fields (partial update — PATCH)
- FR-07: Soft delete with transactional referential guard (blocks if referenced by students, subjects, exams, or content)
- FR-08: Status ENABLED/DISABLED behavior — DISABLED blocks new assignments
- FR-09: Division-first supremacy — semester filters cannot override division-based access
- FR-10: Nullable semester_id FK on students table — optional one-semester-per-student assignment
- FR-11: Nullable semester_id FK on subjects table — optional semester-scoped subject grouping
- FR-12: Assignment validation — semester must be ENABLED for new assignments

---

## Clarifications Required

- None — all requirements are clearly defined in the stage file.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                                  |
| --------------------------------------- | ------ | ---------------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | All semester data in tenant DB only                                    |
| License middleware requirement captured | ✅     | Tenant resolver → license middleware mandatory for all semester routes |
| Snapshot integrity requirement captured | ✅     | Feature does not touch attempt snapshots                               |
| Idempotency strategy defined            | ✅     | PATCH is idempotent; DELETE guarded by soft-delete pattern             |
| Transaction boundaries identified       | ✅     | All writes transactional; deletion guard wrapped in transaction        |
| Server-authoritative time enforced      | ✅     | created_at/updated_at set server-side; date fields are calendar dates  |
| Division isolation preserved            | ✅     | Division-first filtering rule captured in FR-09                        |

**Overall:** COMPLIANT

---

## Open Risks

- **Subjects FK deferral:** The `semester_id` column is added to `subjects` here but the FK
  constraint is deferred to STAGE_28_SUBJECTS. Risk: if subjects table doesn't exist at migration
  time, the column add will fail. Mitigation: use `ADD COLUMN IF NOT EXISTS` or conditional logic.
- **Students FK dependency:** `students` table must exist at migration time. Assumed created in
  prior stage. Migration should verify.

---

## User Stories (7)

| #    | Story                               | Priority |
| ---- | ----------------------------------- | -------- |
| US-1 | Administrator Creates a Semester    | P1       |
| US-2 | Administrator Views Semester List   | P1       |
| US-3 | Administrator Reads Semester Detail | P2       |
| US-4 | Administrator Updates a Semester    | P2       |
| US-5 | Administrator Deletes a Semester    | P3       |
| US-6 | Assign a Student to a Semester      | P2       |
| US-7 | Associate a Subject with a Semester | P2       |

---

## API Surface

| Method | Path           | Description                        |
| ------ | -------------- | ---------------------------------- |
| GET    | /semesters     | List semesters (filter+paginate)   |
| POST   | /semesters     | Create semester                    |
| GET    | /semesters/:id | Get semester detail                |
| PATCH  | /semesters/:id | Partial update                     |
| DELETE | /semesters/:id | Soft delete with referential guard |
