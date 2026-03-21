# Requirements Checklist — Lessons

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-03-21
**Feature**: [spec.md](../spec.md)
**Stage**: STAGE_29_LESSONS
**Phase**: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE

---

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) in user stories or business rules
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders (user stories section)
- [x] All mandatory sections completed

---

## Functional Requirements

- [ ] CRUD endpoints implemented (list, create, get, update, soft-delete)
- [ ] `subject_id` FK constraint enforced (`ON DELETE RESTRICT` → subjects.id)
- [ ] `unique(subject_id, name)` constraint enforced at DB and service layer
- [ ] Soft delete only — `DELETE /lessons/:id` sets `status = DISABLED`, no SQL DELETE issued
- [ ] Hard delete blocked at DB level when referenced by questions, auto-selection, or exam configs
- [ ] Status lifecycle enforced: `ENABLED | DISABLED` only (CHECK constraint + service validation)
- [ ] `subject_id` is immutable after creation (forbidden in PATCH schema)
- [ ] DISABLED lessons are read-only for field edits (only `status` update allowed)
- [ ] Lesson names are unique within the same subject; two subjects may share a lesson name
- [ ] Initial `status` on creation is `ENABLED`
- [ ] `created_by` set once at creation; `updated_by` updated on every mutation
- [ ] `ON DELETE SET NULL` on `created_by` and `updated_by` FKs

---

## Access Control

- [ ] `question_manage` OR `subject_manage` permission required for all write operations
- [ ] Read endpoints accessible to any authenticated Backoffice user (standard session check)
- [ ] Division-level scoping inherited transitively via Subject FK (no direct `division_id`)
- [ ] Tenant isolation enforced — all queries use tenant-scoped DB client via `c.get('tenant').pool`
- [ ] No cross-tenant access possible (tenant resolved from slug before any handler)
- [ ] 403 returned (not 404) when a user lacks write permission on an existing resource
- [ ] 404 returned (not 403) when a resource from another tenant is requested (no info leakage)

---

## Data Integrity

- [ ] All writes (create, update, soft-delete) wrapped in explicit `BEGIN / COMMIT / ROLLBACK`
- [ ] Repository functions do not open transactions (service layer owns transaction boundaries)
- [ ] `unique(subject_id, name)` enforced at service layer before insert/update (not reliant solely on DB exception)
- [ ] `LESSON_NAME_DUPLICATE` (409) raised before hitting DB constraint on duplicate create
- [ ] Indexes created: `idx_lessons_subject_id`, `idx_lessons_status`, `lessons_subject_name_key`
- [ ] All FK columns covered by an index

---

## Infrastructure

- [ ] Tenant DB migration `20260321_007_lessons.ts` created (forward-only, no down migration)
- [ ] All DDL statements idempotent (`IF NOT EXISTS` guards on table, FKs, indexes)
- [ ] Schema version incremented: `1.12.0 → 1.13.0`
- [ ] License middleware applied to all lesson routes (before any handler executes)
- [ ] Requests to tenants below `MIN_SCHEMA_VERSION` rejected with `SCHEMA_VERSION_MISMATCH` (409)
- [ ] Route registered in `apps/api/src/app.ts` under the Backoffice namespace
- [ ] Structured logging with `correlation_id` and `workspace_id` on every handler
- [ ] Error contract enforced: `{ success: false, data: null, error: { code, message } }`
- [ ] Stack traces never returned in API responses

---

## Testing

- [ ] Unit tests for domain service logic (`packages/domain-core/src/lessons/__tests__/`)
  - [ ] `createLesson` — success path, name duplicate, subject not found
  - [ ] `updateLesson` — success path, name duplicate, disabled lesson guard
  - [ ] `deleteLesson` (soft) — success path, already-disabled guard
  - [ ] Status lifecycle transitions (ENABLED → DISABLED → ENABLED)
- [ ] Integration tests for API endpoints (`apps/api/src/routes/backoffice/lessons/__tests__/`)
  - [ ] `GET /lessons` — with and without filters
  - [ ] `POST /lessons` — success, duplicate, missing subject, validation failure, permission denied
  - [ ] `GET /lessons/:id` — found, not found, cross-tenant 404
  - [ ] `PATCH /lessons/:id` — success, duplicate name, disabled-lesson guard, permission denied
  - [ ] `DELETE /lessons/:id` — success, already disabled, permission denied
- [ ] Tenant isolation tests — confirm no cross-tenant data leakage
- [ ] Permission tests — `question_manage` grants access; `subject_manage` grants access; neither returns 403
- [ ] License middleware tests — `SOFT_LOCKED` returns 423; `ARCHIVED` returns 403
- [ ] Validation schema tests for all five Zod schemas (list query, create body, update body, params)

---

## Requirement Completeness

- [x] No `[NEEDS CLARIFICATION]` markers remain in the spec
- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows (create, list, get, update, soft-delete, re-enable)
- [x] Edge cases identified (cross-tenant 404, disabled-lesson write guard, already-disabled guard)
- [x] Scope is clearly bounded (Out of Scope section present)
- [x] Dependencies and assumptions identified (subjects must exist; license middleware prerequisite)
- [x] Success criteria are measurable and technology-agnostic
- [x] No implementation details leak into user stories

---

## Notes

- All items in the **Functional Requirements**, **Access Control**, **Data Integrity**, **Infrastructure**, and **Testing** sections must be checked before `/speckit.plan` is run.
- Items marked `[ ]` represent work still to be validated during implementation.
- Items marked `[x]` represent decisions already resolved at specification time and verified against the spec document.
