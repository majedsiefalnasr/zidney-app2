# Specify Report — Groups

**Step:** 1 — Specify
**Timestamp:** 2026-03-19T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Specification for STAGE_24_GROUPS has been produced. Groups are an optional logical clustering
layer for students and staff within a Zidney tenant workspace. The spec covers a new `groups`
table, a `staff_groups` join table, a `group_id` FK column on `students`, 10 API endpoints,
transactional `max_members` enforcement via `SELECT FOR UPDATE`, division boundary enforcement,
deletion guards, and status behaviours. All 30 functional requirements are captured, 8 user stories
written, and 11 error codes defined. The requirements checklist is 100% complete.

---

## Inputs Reviewed

- `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_24_GROUPS.md`
- `specs/runtime/024-groups/spec.md`
- `specs/runtime/024-groups/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                                                        | Rationale                                                                                |
| --- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Groups are flat logical clusters, NOT part of the Division→Department hierarchy | Prevents accidental structural coupling; maintains hierarchy integrity from prior stages |
| 2   | Student single-group constraint enforced at application layer (not DB UNIQUE)   | Enables graceful error messages with GROUP_ALREADY_IN_GROUP error code per spec          |
| 3   | `max_members` uses `SELECT FOR UPDATE` inside transaction                       | Prevents race conditions in concurrent assignment — no reliance on cached counts         |
| 4   | Staff assignments do NOT count toward `max_members`                             | `max_members` is a student capacity limit only, not a total headcount                    |
| 5   | Soft delete (not hard delete) required for groups                               | Preserves referential integrity for audit trails and targeting history                   |
| 6   | DISABLED groups retain existing assignments but block new ones                  | Supports academic period transitions without data loss                                   |
| 7   | Division boundary enforcement via `department_id` → `department.division_id`    | No cross-division group access; checked at query layer                                   |
| 8   | Content visibility filter applied in backend only                               | Prevents client-side bypass of group scoping rules                                       |

---

## Functional Requirements Captured

- FR-001 to FR-030 (30 total) documented in spec.md
- Group CRUD: Create, List (filterable), Read, Update, soft-Delete
- Student assignment: single-group constraint, max_members SELECT FOR UPDATE, DISABLED block
- Staff assignment: many-to-many via staff_groups join table, DISABLED block
- Division boundary: cross-division group access blocked when department_id set
- Deletion guards: active student/staff assignments, exam targeting, ads targeting
- Visibility contract: group-scoped content filtering (student single, staff multi)
- Status transitions: ENABLED ↔ DISABLED with full backward compatibility

---

## Clarifications Required

None — all specification areas are fully resolved. No `[NEEDS CLARIFICATION]` markers remain.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                                     |
| --------------------------------------- | ------ | ------------------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | All tables in tenant DB; tenant resolver mandatory before every route     |
| License middleware requirement captured | ✅     | ACTIVE-only; SOFT_LOCKED → 423; ARCHIVED → 403; NOT_FOUND → 404           |
| Snapshot integrity requirement captured | ✅     | Feature does not touch attempt snapshots or grading                       |
| Transactional integrity documented      | ✅     | 7 transactional boundaries documented; max_members uses SELECT FOR UPDATE |
| Server-authoritative time only          | ✅     | All created_at/updated_at set by server                                   |
| No console.log                          | ✅     | Structured logging with correlation_id, workspace_slug, user_id mandatory |
| No hardcoded tenant IDs                 | ✅     | All DB access via tenant resolver context                                 |
| Version compatibility required          | ✅     | schema_version bump required; forward-only migration                      |
| Division boundary preserved             | ✅     | Cross-division group access blocked when department_id set on group       |
| Import boundary compliance              | ✅     | No UI→DB, no apps→apps cross-imports anticipated                          |

---

## Checklist Summary

All 60+ items in `specs/runtime/024-groups/checklists/requirements.md` are marked `[x]` PASSED.
Spec is ready for clarification step.
