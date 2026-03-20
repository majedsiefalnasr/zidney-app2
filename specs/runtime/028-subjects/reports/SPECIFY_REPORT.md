# Specify Report — Subjects

**Step:** 1 — Specify
**Timestamp:** 2026-03-20T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Feature specification for **Stage 28 — Subjects** completed successfully. Subject is the primary academic container within a Zidney workspace — the root entity that all downstream academic content (MCQ questions, traditional questions, exams, exercises, scheduled exams, library items, live sessions, and categories) depends on. The specification covers all CRUD operations, workflow transitions, division/semester boundary enforcement, multi-language support, soft-delete with dependency guard, and runtime visibility enforcement. All 16 checklist items passed on the first iteration with zero [NEEDS CLARIFICATION] markers.

---

## Inputs Reviewed

- `specs/runtime/028-subjects/spec.md` (704 lines)
- `specs/runtime/028-subjects/checklists/requirements.md`
- `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_28_SUBJECTS.md`

---

## Key Decisions

| #   | Decision                                            | Rationale                                                             |
| --- | --------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | subjects table in tenant DB only                    | Tenant isolation — no shared subject data across workspaces           |
| 2   | Soft delete only (hard delete prohibited)           | Historical integrity for downstream content snapshots                 |
| 3   | Deletion blocked if dependent records exist         | Guard prevents orphan academic content                                |
| 4   | Division auto-assign when divisions disabled        | FK integrity preserved; workspace must always have a default division |
| 5   | Semester must belong to same division               | Cross-division semester-subject mismatch returns 422                  |
| 6   | ARCHIVED is a terminal state                        | Prevents accidental reactivation of archived academic content         |
| 7   | Runtime queries enforce status = ACTIVE server-side | No visibility logic delegated to frontend                             |
| 8   | Cross-tenant resource returns 404 (not 403)         | Avoids information leakage about other tenants                        |
| 9   | schema_version enforcement via middleware           | Migration increments version; API enforces minimum schema version     |

---

## Functional Requirements Captured

**21 total requirements across 9 user stories:**

- US1 — Create Subject: uniqueness (name + code), division/semester validation, auto-assign, permission gate
- US2 — List Subjects: multi-filter (status/division/semester/search), pagination, soft-delete exclusion
- US3 — Read Subject Detail: cross-tenant 404 pattern, full field set
- US4 — Update Subject: field-level validation, ARCHIVED immutability, permission gate
- US5 — Workflow Transitions: DRAFT → ACTIVE → ARCHIVED; ARCHIVED is terminal; only allowed next states
- US6 — Delete Subject: dependency guard, soft delete only, 409 on dependent records
- US7 — Multi-language Registration: translation coverage for all workspace languages, fallback to default_language
- US8 — Runtime Visibility Enforcement: server-enforced ACTIVE-only filter in frontoffice/runtime consumers
- US9 — Division-Disabled Auto-Assignment: FK integrity, toggle is transactional

---

## Clarifications Required

None — all 16 spec checklist items passed. Assumptions documented in spec.md:

1. Translation infrastructure assumed stable (from a prior stage)
2. Workspace default division assumed present (from provisioning stage)
3. `status_workflow_engine` package assumed available
4. Downstream content tables (MCQ, exams, etc.) will be covered in subsequent stages
5. Code field is case-insensitive unique within workspace

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                                   |
| --------------------------------------- | ------ | ----------------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | subjects table in tenant DB only; no shared data                        |
| License middleware requirement captured | ✅     | Mandatory before all workspace subject routes                           |
| Snapshot integrity requirement captured | ✅     | Subject FK in downstream snapshots is immutable                         |
| Idempotency strategy defined            | ✅     | Create uses unique constraints; delete is idempotent (soft delete)      |
| Transaction boundaries identified       | ✅     | All writes (create, update, transition, delete guard) are transactional |
| Server-authoritative time enforced      | ✅     | created_at, updated_at, deleted_at set by server only                   |

**Overall:** COMPLIANT

---

## Open Risks

- **Dependency on STAGE_27_SEMESTERS**: Semesters table and its FK must be fully migrated before this stage's migration runs. Verification needed during Analyze step.
- **Default division requirement**: `divisions_disabled` mode requires a workspace default division to exist. Provisioning must guarantee this.
- **Multi-language test coverage**: Translation infrastructure must be present for full US7 test coverage. If not available, those tests should be skipped with documented skip reason.
