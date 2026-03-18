# Spec Quality Checklist: Groups (STAGE_24)

**Stage**: `STAGE_24_GROUPS`  
**Spec file**: `specs/runtime/024-groups/spec.md`  
**Phase**: `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE`  
**Checklist created**: 2026-03-19

---

## Instructions

All items below MUST be verified before marking this stage ready for implementation.
Check each item once confirmed. Unresolved items MUST be escalated before implementation begins.

---

## 1. API Endpoints

- [x] `GET /api/v1/backoffice/workspace/groups` — list with filters and pagination defined
- [x] `POST /api/v1/backoffice/workspace/groups` — create endpoint defined
- [x] `GET /api/v1/backoffice/workspace/groups/:id` — read by ID defined
- [x] `PUT /api/v1/backoffice/workspace/groups/:id` — update endpoint defined
- [x] `DELETE /api/v1/backoffice/workspace/groups/:id` — soft-delete endpoint defined
- [x] `PUT /api/v1/backoffice/workspace/students/:student_id/group` — student group assignment defined
- [x] `DELETE /api/v1/backoffice/workspace/students/:student_id/group` — student group removal defined
- [x] `GET /api/v1/backoffice/workspace/staff/:staff_id/groups` — staff group list defined
- [x] `POST /api/v1/backoffice/workspace/staff/:staff_id/groups` — staff assignment defined
- [x] `DELETE /api/v1/backoffice/workspace/staff/:staff_id/groups/:group_id` — staff removal defined
- [x] All endpoints have authentication requirements defined (tenant resolver + license middleware + JWT + RBAC)
- [x] All endpoints have response shape defined (including 4xx/5xx)
- [x] All query parameters documented for list endpoint
- [x] Soft-delete behavior on `DELETE` endpoint explicitly stated (deleted_at set, not hard delete)

---

## 2. Data Model

- [x] `groups` table defined with all columns
- [x] Column types specified (`UUID`, `VARCHAR`, `TEXT`, `INTEGER`, `TIMESTAMPTZ`)
- [x] Nullable / NOT NULL constraints defined for every column
- [x] Default values defined for every column
- [x] `CHECK` constraints defined (`status`, `max_members > 0`)
- [x] `PRIMARY KEY` defined
- [x] `deleted_at` soft-delete column defined
- [x] `department_id` FK (`→ departments.id`) defined with `ON DELETE RESTRICT`
- [x] `staff_groups` join table defined with all columns
- [x] Composite PK on `staff_groups (staff_id, group_id)` defined
- [x] `staff_groups` FK to `users` with `ON DELETE CASCADE` defined
- [x] `staff_groups` FK to `groups` with `ON DELETE CASCADE` defined
- [x] `students.group_id` nullable FK column addition defined with `ON DELETE SET NULL`
- [x] All required indexes defined:
  - [x] `idx_groups_department_id`
  - [x] `idx_groups_status`
  - [x] `idx_groups_deleted_at`
  - [x] `idx_groups_created_at_id` (pagination composite)
  - [x] `idx_staff_groups_group_id`
  - [x] `idx_students_group_id`
- [x] Workspace-scoped case-insensitive name uniqueness index defined

---

## 3. Business Rules

- [x] Name uniqueness scoped to workspace (case-insensitive, tenant-scoped)
- [x] Groups are flat — no hierarchy, no `parent_id`
- [x] Student may belong to 0 or 1 group only (single-group constraint)
- [x] Single-group constraint enforced by UPDATE (not INSERT) on `student.group_id`
- [x] Staff may belong to multiple groups (many-to-many via `staff_groups`)
- [x] `status = DISABLED` blocks new student assignments
- [x] `status = DISABLED` blocks new staff assignments
- [x] `status = DISABLED` preserves existing assignments (no cascade delete)
- [x] `status = DISABLED` hides group from assignment selection lists
- [x] `max_members` enforcement is transactional (SELECT FOR UPDATE on `groups` row)
- [x] `max_members = null` means unlimited students
- [x] Staff assignment does NOT count toward `max_members`
- [x] Staff assignment idempotency (duplicate POST = success)
- [x] Division boundary check via department_id → department.division_id (indirect)
- [x] Group with `department_id = null` is workspace-wide (no division boundary)
- [x] Cross-division student assignment rejected (GROUP_DIVISION_MISMATCH)
- [x] Cross-division staff assignment rejected (GROUP_DIVISION_MISMATCH)
- [x] Deletion blocked if students assigned (GROUP_HAS_ASSIGNMENTS)
- [x] Deletion blocked if staff assigned (GROUP_HAS_ASSIGNMENTS)
- [x] Deletion blocked if active exam targeting reference (GROUP_REFERENCED_BY_EXAM)
- [x] Deletion blocked if active ads targeting reference (GROUP_REFERENCED_BY_ADS)
- [x] Deletion is soft-delete only (deleted_at timestamp); hard delete is NOT allowed
- [x] All deletion reference checks run inside a single transaction
- [x] Reducing `max_members` below current count silently allowed (forward-only cap)
- [x] Server-authoritative time for all timestamps

---

## 4. Error Codes

- [x] `GROUP_NOT_FOUND` (404) — defined
- [x] `GROUP_STUDENT_ASSIGNMENT_NOT_FOUND` (404) — defined
- [x] `GROUP_STAFF_ASSIGNMENT_NOT_FOUND` (404) — defined
- [x] `GROUP_NAME_DUPLICATE` (409) — defined
- [x] `GROUP_DIVISION_MISMATCH` (422) — defined
- [x] `GROUP_HAS_ASSIGNMENTS` (422) — defined
- [x] `GROUP_REFERENCED_BY_EXAM` (422) — defined
- [x] `GROUP_REFERENCED_BY_ADS` (422) — defined
- [x] `GROUP_MAX_MEMBERS_EXCEEDED` (422) — defined
- [x] `GROUP_DISABLED` (422) — defined
- [x] `VALIDATION_ERROR` (422) — defined
- [x] All error codes listed in the Error Codes Reference table
- [x] All error responses conform to platform contract `{ success, data, error }`

---

## 5. Migration Dependencies

- [x] Migration depends on `departments` table (STAGE_23) being present — stated
- [x] Migration depends on `users` table being present — stated
- [x] Migration depends on `students` table being present — stated
- [x] Migration must run before exam/ads targeting stages that reference groups — stated
- [x] Migration is forward-only — stated
- [x] Schema version bump required — stated
- [x] Migration steps are ordered and complete (6 steps)
- [x] No destructive rollback described; restore-from-snapshot policy stated
- [x] Migration file location specified (`apps/api/src/db/tenant/migrations/`)
- [x] Assumption about exam/ads reference tables noted (guard passes with zero rows until those tables exist)

---

## 6. Validation Rules

- [x] `name` max length (255 chars) defined
- [x] `name` not blank validation defined
- [x] `name` no control characters defined
- [x] `status` enum validation (`ENABLED | DISABLED`)
- [x] `department_id` valid UUID check defined
- [x] `max_members` positive integer check defined (zero rejected)
- [x] `group_id` on assignment endpoints validated as existing, non-deleted group in tenant DB
- [x] All UUID FK references validated against tenant DB

---

## 7. Out-of-Scope Items

- [x] Content visibility filtering by group — data model contract defined; implementation deferred
- [x] Exam group targeting implementation — deletion guard only; assignment flow deferred
- [x] Ads group targeting implementation — deletion guard only; assignment flow deferred
- [x] Notification targeting by group — use case noted; implementation deferred
- [x] Group nesting or hierarchy — explicitly excluded (groups are flat)
- [x] Bulk group operations — explicitly excluded
- [x] Group-level reporting/analytics views — deferred
- [x] max_members for staff — explicitly excluded by design
- [x] Group import/export — explicitly excluded
- [x] Student self-service group selection — Backoffice-only in this stage

---

## 8. Non-Functional Requirements

- [x] All writes transactional — stated
- [x] Structured logging with required fields — stated
- [x] Rate limiting on write endpoints — stated (Backoffice rate limits, STAGE_08)
- [x] Server-authoritative time — stated
- [x] Tenant isolation enforced — stated
- [x] Idempotency for staff group assignment — stated
- [x] Concurrency safety for max_members — stated (SELECT FOR UPDATE on groups row)
- [x] Soft delete enforced — stated (deleted_at; hard delete forbidden)
- [x] Single-group constraint for students — stated
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

- [x] Unit tests required — listed (max_members logic, division check, name uniqueness)
- [x] Integration tests required — listed (all endpoints, all error codes)
- [x] Student single-group constraint test — listed
- [x] Max members concurrency test — listed
- [x] Idempotency test — listed
- [x] Isolation test — listed
- [x] Deletion guard tests (assignments, exam ref, ads ref) — listed
- [x] Soft-delete verification test — listed
- [x] Division mismatch tests (student and staff) — listed
- [x] Status enforcement test — listed
- [x] Disabled group hidden from selection test — listed
- [x] max_members = null (unlimited) test — listed
- [x] max_members reduce below count test — listed
- [x] Audit log test — listed
- [x] License enforcement test — listed
- [x] RBAC enforcement test — listed
- [x] Schema version test — listed

---

## 11. Transaction Safety Documentation

- [x] `SELECT FOR UPDATE` lock target is explicitly identified (`groups` row — not a count result)
- [x] Canonical transaction sequence for student group assignment is documented in spec
- [x] Application-layer count caching explicitly forbidden — stated
- [x] Optimistic concurrency explicitly rejected — stated
- [x] Student reassignment atomicity stated (old group_id replaced in same transaction)

---

## 12. Unresolved Markers

- [x] No `[NEEDS CLARIFICATION]` markers in spec.md
- [x] No `[TBD]` markers in spec.md
- [x] No `[TODO]` markers in spec.md

---

## Validation Result

**Status**: PASSED — All checklist items resolved.  
**Ready for**: `/speckit.clarify` or `/speckit.plan`
