# Spec Quality Checklist: Departments (STAGE_23)

**Stage**: `STAGE_23_DEPARTMENTS`  
**Spec file**: `specs/runtime/023-departments/spec.md`  
**Phase**: `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE`  
**Checklist created**: 2026-03-17

---

## Instructions

All items below MUST be verified before marking this stage ready for implementation.
Check each item once confirmed. Unresolved items MUST be escalated before implementation begins.

---

## 1. API Endpoints

- [x] `GET /api/v1/backoffice/workspace/departments` — list with filters and pagination defined
- [x] `POST /api/v1/backoffice/workspace/departments` — create endpoint defined
- [x] `GET /api/v1/backoffice/workspace/departments/:id` — read by ID defined
- [x] `PUT /api/v1/backoffice/workspace/departments/:id` — update endpoint defined
- [x] `DELETE /api/v1/backoffice/workspace/departments/:id` — delete endpoint defined
- [x] `GET /api/v1/backoffice/workspace/departments/:id/children` — direct children endpoint defined
- [x] `GET /api/v1/backoffice/workspace/departments/tree` — full hierarchy tree endpoint defined
- [x] `GET /api/v1/backoffice/workspace/staff/:staff_id/departments` — staff department list defined
- [x] `POST /api/v1/backoffice/workspace/staff/:staff_id/departments` — staff assignment defined
- [x] `DELETE /api/v1/backoffice/workspace/staff/:staff_id/departments/:department_id` — staff removal defined
- [x] All endpoints have authentication requirements defined (tenant resolver + license middleware + JWT + RBAC)
- [x] All endpoints have response shape defined (including 4xx/5xx)
- [x] All query parameters documented for list endpoint

---

## 2. Data Model

- [x] `departments` table defined with all columns
- [x] Column types specified (`UUID`, `VARCHAR`, `TEXT`, `INTEGER`, `TIMESTAMPTZ`)
- [x] Nullable / NOT NULL constraints defined for every column
- [x] Default values defined for every column
- [x] `CHECK` constraints defined (`type`, `status`, `max_users > 0`)
- [x] `PRIMARY KEY` defined
- [x] Self-referencing FK (`parent_id → departments.id`) defined with `ON DELETE RESTRICT`
- [x] `division_id` FK (`→ divisions.id`) defined with `ON DELETE RESTRICT`
- [x] `staff_departments` join table defined with all columns
- [x] Composite PK on `staff_departments (staff_id, department_id)` defined
- [x] `staff_departments` FK to `backoffice_staff_users` with `ON DELETE CASCADE` defined
- [x] `staff_departments` FK to `departments` with `ON DELETE CASCADE` defined
- [x] `students.department_id` nullable FK column addition defined with `ON DELETE SET NULL`
- [x] All required indexes defined:
  - [x] `idx_departments_parent_id`
  - [x] `idx_departments_division_id`
  - [x] `idx_departments_status`
  - [x] `idx_departments_type`
  - [x] `idx_departments_created_at_id` (pagination composite)
  - [x] `idx_staff_departments_department_id`
  - [x] `idx_students_department_id`
- [x] Name uniqueness index (functional, within parent scope) defined

---

## 3. Business Rules

- [x] Name uniqueness scoped to same `parent_id` (including `null` as root scope)
- [x] Unlimited hierarchy depth permitted
- [x] Cycle detection enforced at API layer on every create/update that sets `parent_id`
- [x] Parent-child division_id consistency validated (FR-004)
- [x] Parent deletion blocked if children exist (FK ON DELETE RESTRICT + API guard)
- [x] Department deletion blocked if active student assignments exist
- [x] Department deletion blocked if active staff assignments exist
- [x] `status = DISABLED` blocks new student assignments
- [x] `status = DISABLED` blocks new staff assignments
- [x] `status = DISABLED` preserves existing assignments (no cascade delete)
- [x] `max_users` enforcement is transactional (SELECT FOR UPDATE)
- [x] `max_users = null` means unlimited
- [x] Staff assignment idempotency (duplicate POST = success)
- [x] Staff-department division mismatch check (FR-019)
- [x] Student-department division mismatch check (FR-018)
- [x] Server-authoritative time for all timestamps

---

## 4. Error Codes

- [x] `DEPARTMENT_NOT_FOUND` (404) — defined
- [x] `DEPT_STAFF_ASSIGNMENT_NOT_FOUND` (404) — defined
- [x] `DEPARTMENT_NAME_DUPLICATE` (409) — defined
- [x] `DEPARTMENT_CIRCULAR_REFERENCE` (422) — defined
- [x] `DEPARTMENT_DIVISION_MISMATCH` (422) — defined
- [x] `DEPARTMENT_HAS_CHILDREN` (422) — defined
- [x] `DEPARTMENT_HAS_ASSIGNMENTS` (422) — defined
- [x] `DEPARTMENT_MAX_USERS_EXCEEDED` (422) — defined
- [x] `DEPARTMENT_DISABLED` (422) — defined
- [x] `VALIDATION_ERROR` (422) — defined
- [x] All error codes listed in the Error Codes Reference table
- [x] All error responses conform to platform contract `{ success, data, error }`

---

## 5. Migration Dependencies

- [x] Migration depends on `divisions` table (STAGE_22) being present — stated
- [x] Migration depends on `backoffice_staff_users` table being present — stated
- [x] Migration depends on `students` table being present — stated
- [x] Migration must run before STAGE_24_GROUPS — stated
- [x] Migration must run before student/staff management stages — stated
- [x] Migration is forward-only — stated
- [x] Schema version bump required — stated
- [x] Migration steps are ordered and complete (6 steps)
- [x] No destructive rollback described; restore-from-snapshot policy stated
- [x] Migration file location specified (`apps/api/src/db/tenant/migrations/`)

---

## 6. Validation Rules

- [x] `name` max length (255 chars) defined
- [x] `name` not blank validation defined
- [x] `name` no control characters defined
- [x] `type` enum validation (`MAIN | SUB | SIMPLE`)
- [x] `status` enum validation (`ENABLED | DISABLED`)
- [x] `parent_id` valid UUID check defined
- [x] `division_id` valid UUID check defined
- [x] `max_users` positive integer check defined
- [x] All UUID FK references validated against tenant DB
- [x] Cycle detection is part of validation on parent_id change

---

## 7. Out-of-Scope Items

- [x] Content visibility filtering by department — explicitly excluded
- [x] Tagging system — explicitly excluded
- [x] Commercial structure — explicitly excluded
- [x] Department-level exam scheduling — explicitly excluded
- [x] Advertisements targeting — explicitly excluded
- [x] Staff counted toward max_users — explicitly excluded (future stage)
- [x] Soft delete — explicitly excluded (hard delete only)
- [x] Bulk operations — explicitly excluded
- [x] Workspace-level department locking — explicitly excluded

---

## 8. Non-Functional Requirements

- [x] All writes transactional — stated
- [x] Structured logging with required fields — stated
- [x] Rate limiting on write endpoints — stated (Backoffice rate limits, STAGE_08)
- [x] Server-authoritative time — stated
- [x] Tenant isolation enforced — stated
- [x] Idempotency for staff assignment — stated
- [x] Concurrency safety for max_users — stated (SELECT FOR UPDATE)
- [x] No console.log — stated
- [x] No secrets in code — stated
- [x] Correlation ID propagated — stated

---

## 9. Constitutional Compliance

- [x] No cross-tenant access — confirmed
- [x] No middleware bypass — confirmed
- [x] No grading outside worker — N/A (not touching attempt engine)
- [x] No direct DB instantiation — confirmed
- [x] No weakening of snapshot integrity — confirmed
- [x] No weakening of transaction boundaries — confirmed
- [x] Schema version enforcement — confirmed
- [x] Server-authoritative time — confirmed
- [x] No console.log — confirmed
- [x] Division boundary preserved — confirmed

---

## 10. Testing Coverage

- [x] Unit tests required — listed (cycle detection, division consistency, max_users logic)
- [x] Integration tests required — listed (all endpoints, all error codes)
- [x] Hierarchy traversal test — listed
- [x] Cycle detection test — listed
- [x] Max users concurrency test — listed
- [x] Idempotency test — listed
- [x] Isolation test — listed
- [x] FK constraint test — listed
- [x] Division mismatch test — listed
- [x] Status enforcement test — listed
- [x] Deletion guard test — listed
- [x] Audit log test — listed
- [x] License enforcement test — listed
- [x] RBAC enforcement test — listed
- [x] Schema version test — listed

---

## 11. Unresolved Markers

- [x] No `[NEEDS CLARIFICATION]` markers in spec.md
- [x] No `[TBD]` markers in spec.md
- [x] No `[TODO]` markers in spec.md

---

## 12. Final Gate

- [ ] Spec reviewed by technical lead
- [ ] No open clarification items
- [ ] Spec approved for implementation phase
- [ ] Stage file status updated from DRAFT to IN PROGRESS
- [ ] Feature branch `spec/023-departments` created from `develop`

---

## Clarification Log

| #   | Item                                                                                            | Resolution                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Name uniqueness scope: global or per-parent?                                                    | Resolved — unique within same `parent_id` scope (including null as a scope), matching stage file constraint.                                                                                                                                                                |
| 2   | `staff_departments` ON DELETE CASCADE vs RESTRICT on `department_id`?                           | Resolved — CASCADE on `department_id` (removing department removes staff assignments). This is consistent with the stage file's intent that department deletion requires explicit validation at API layer; the API guard provides the safe gate before FK cascades execute. |
| 3   | Does removing a staff member from a department have a minimum-one enforcement (like divisions)? | Resolved — No minimum-one enforcement for departments. Staff may have zero department assignments. This differs from the divisions model. Stage file does not require minimum-one for departments.                                                                          |
| 4   | `max_users` scope: students only or also staff?                                                 | Resolved — students only for this stage. Stage file notes staff count is configurable in future. `max_users` enforcement is limited to student assignments.                                                                                                                 |
