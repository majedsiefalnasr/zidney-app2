# Clarify Report — Groups

**Step:** 2 — Clarify
**Timestamp:** 2026-03-19T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

All 5 targeted clarification questions were resolved from spec context and Zidney Constitution
v1.2.0 rules. No open items remain. One correctness fix was applied: the `SELECT COUNT(*)` in the
canonical `max_members` SQL was missing `AND id != $student_id`, which would have produced a
spurious `GROUP_MAX_MEMBERS_EXCEEDED` on idempotent re-assignment when the group is at full
capacity. This is now corrected in the spec. The spec is safe to progress to technical planning.

---

## Inputs Reviewed

- `specs/runtime/024-groups/spec.md` (including `## Clarifications / ### Session 2026-03-19`)

---

## Clarifications Resolved

| #   | Question                                                                                   | Resolution                                                                                                                                                                                                                                                                | Impact                                  |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | Is idempotent re-assignment to the same group allowed, and how does max_members interact?  | Yes — if a student is already in group X and `PUT /students/:id/group` requests group X again, the operation must succeed with no data mutation. The `SELECT COUNT(*)` must exclude the requesting student (`AND id != $student_id`) to prevent spurious EXCEEDED errors. | **Correctness fix applied to spec SQL** |
| 2   | What is the lock scope and isolation level for the SELECT FOR UPDATE max_members check?    | Lock scope is the **single `groups` row** (not the student row). Isolation level is READ COMMITTED (PostgreSQL default) — sufficient since the FOR UPDATE row lock prevents concurrent over-assignment within a single group.                                             | Confirmed in Transaction Safety section |
| 3   | What roles are permitted to manage groups and perform student/staff assignment operations? | `WORKSPACE_ADMIN` and `STAFF` roles with explicit `group:manage` permission. Read-only group list is accessible to any authenticated Backoffice user. Enforcement is at the middleware/RBAC layer, not the domain layer.                                                  | Documented in Security section of spec  |
| 4   | Is staff division scope a single-value FK or a multi-value list?                           | Single `division_id` FK on staff (per STAGE_21 / STAGE_22). Staff with `division_id = null` are workspace-global and bypass division boundary checks. Division boundary check at group assignment time compares staff.division_id === group.department.division_id.       | FR-022 updated for correctness          |
| 5   | What is the schema_version bump strategy for this migration?                               | Monotonic integer +1 from the last registered migration in the tenant migrations table. The runtime check uses `>=` (minimum compatible version), so a bump of +1 is sufficient. No semantic version lookup needed for this stage.                                        | Migration step 6 in spec clarified      |

---

## Open Items

None.

---

## Spec Updates Applied

- **Transaction Safety section**: Fixed canonical `SELECT COUNT(*)` SQL — added `AND id != $student_id` to prevent false-positive GROUP_MAX_MEMBERS_EXCEEDED on idempotent re-assignment.
- **FR-022**: Clarified staff division scope (single division_id FK, null = workspace-global bypass).
- **Migration Requirements (step 6)**: Specified monotonic integer +1 schema_version bump strategy.
- **Error Codes Reference**: Added `STUDENT_NOT_FOUND` (404) and `STAFF_NOT_FOUND` (404).
- **API error responses**: Added STUDENT_NOT_FOUND to `PUT /students/:id/group` and `DELETE /students/:id/group`; added STAFF_NOT_FOUND to `POST /staff/:id/groups` and `DELETE /staff/:id/groups/:group_id`.
- **`## Clarifications / ### Session 2026-03-19`**: Appended to spec.md with all 5 Q→A resolutions.

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                                        |
| ----------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5/5 questions resolved; no open items remain                                 |
| Transaction strategy confirmed            | ✅     | SELECT FOR UPDATE on groups row; READ COMMITTED; idempotent re-assign fixed  |
| Idempotency strategy confirmed            | ✅     | PUT student assignment is idempotent; same-group re-assign succeeds silently |
| Isolation boundaries confirmed            | ✅     | All tables in tenant DB; no cross-tenant risk identified                     |
| Version and license constraints confirmed | ✅     | schema_version +1 monotonic; ACTIVE license only; schema_version >= check    |
| RBAC / security model confirmed           | ✅     | WORKSPACE_ADMIN + STAFF with group:manage; read list open to all backoffice  |
| Error contract fully defined              | ✅     | 13 error codes defined (2 added in this session)                             |
