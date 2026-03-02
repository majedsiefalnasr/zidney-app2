# Specify Report — STAGE_21_ROLE_PERMISSION_SYSTEM

**Step:** 1 — Specify
**Timestamp:** 2026-03-02T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Specification for the Role & Permission System (Backoffice) has been generated from stage file
`STAGE_21_ROLE_PERMISSION_SYSTEM.md`. The spec covers the full tenant-isolated RBAC model for
Backoffice staff users, including the database schema, middleware enforcement chain, permission
evaluation model, caching rules, audit requirements, disabled-role behavior, and extensibility
contract. All 23 functional requirements have been defined with testable acceptance criteria. No
`[NEEDS CLARIFICATION]` markers remain in the generated spec.

The specification produced two artifacts:

- `specs/runtime/021-role-permission-system/spec.md` (29 KB, 587 lines)
- `specs/runtime/021-role-permission-system/checklists/requirements.md` (4.9 KB, 123 lines)

---

## Inputs Reviewed

- `specs/phases/03_BACKOFFICE_CORE/01_FOUNDATION/STAGE_21_ROLE_PERMISSION_SYSTEM.md`
- `specs/runtime/021-role-permission-system/spec.md`
- `specs/runtime/021-role-permission-system/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                                       | Rationale                                                                                                                       |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `role_id` on `staff_users` is **nullable**                     | Enables additive migration without touching existing rows; null role = no access, consistent with deny-by-default rule          |
| 2   | Audit log stored **in tenant DB**                              | Preserves per-tenant isolation per Constitution; avoids cross-tenant audit table                                                |
| 3   | Audit written **in the same transaction** as the mutation      | Constitution Operational Integrity rule: all state mutations within DB transactions; audit must be atomic with triggering write |
| 4   | Role deletion **rejected if active users exist** (not cascade) | Prevents accidental mass lockout; operator must explicitly reassign before deleting                                             |
| 5   | Missing `role_permissions` row treated as **full denial**      | Secure default (least privilege); explicit grant always required                                                                |
| 6   | Module keys stored as **varchar** (not DB enum)                | Allows new modules by row-insertion without schema migration; validated at application layer                                    |
| 7   | Per-request in-memory cache as **default** caching strategy    | Zero invalidation complexity; immediately consistent on next request                                                            |
| 8   | 10-step evaluation chain (extended from stage's 7 steps)       | Added null `role_id` check and missing permission-row branch to close edge cases                                                |

---

## Functional Requirements Captured

- FR-001 — One staff user may be assigned exactly one role at a time
- FR-002 — Role has name (unique per tenant), status (ACTIVE | DISABLED), timestamps
- FR-003 — Role has module-scoped permissions: `can_view`, `can_create`, `can_edit`, `can_delete`
- FR-004 — Permission row is unique per (role_id, module)
- FR-005 — Role assignment is write-transactional; partial state forbidden
- FR-006 — DISABLED role cannot be assigned to new users
- FR-007 — Deleted role assignment rejected if active users are present
- FR-008 — user.status != ACTIVE → 403 before permission evaluation
- FR-009 — role.status != ACTIVE → 403 immediately after role load
- FR-010 — Missing permission row treated as full denial
- FR-011 — Specific permission flag false → 403 for that action
- FR-012 — Permission lookup may be cached per-request; invalidated on role/permission mutation
- FR-013 — Destructive operations (create/update/delete) write audit log entry
- FR-014 — Audit log entry includes: user_id, role_id, module, action, timestamp, request_id
- FR-015 — Audit log entries are immutable (no update or delete)
- FR-016 — DISABLED role causes 403 on next API request (no session restart required)
- FR-017 — Permission update takes effect on next request (no restart required)
- FR-018 — Null role_id on staff user → treated as no access (403)
- FR-019 — Schema must support future permission flags without redesign
- FR-020 — RBAC is tenant-scoped only; no cross-tenant role sharing
- FR-021 — No hardcoded admin bypass; all roles require DB entry
- FR-022 — No frontend-only permission enforcement
- FR-023 — All RBAC tables reside in tenant DB exclusively

---

## Clarifications Required

None. All `[NEEDS CLARIFICATION]` markers were resolved during specification. Three items are
noted for human review (non-blocking):

1. **`staff_users` migration history** — plan phase should confirm no prior migration already added `role_id` with different semantics.
2. **Audit log long-term strategy** — audit placed in tenant DB for isolation; centralized audit ADR may require a follow-up mapping stage.
3. **Cache implementation choice** — per-request vs. short-lived process cache deferred to plan phase; only observable behavior (immediate next-request effect) is specified.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                               |
| --------------------------------------- | ------ | ------------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | All RBAC tables in tenant DB only                                   |
| License middleware requirement captured | ✅     | License middleware listed as prerequisite for all routes            |
| Snapshot integrity requirement captured | ✅     | Feature does not touch attempt snapshots                            |
| Idempotency strategy defined            | ✅     | Audit log writes idempotent via request_id; no duplicate processing |
| Transaction boundaries identified       | ✅     | Role mutations and audit writes are co-transactional                |
| Server-authoritative time enforced      | ✅     | All timestamps set server-side; no client timestamp accepted        |

**Overall:** COMPLIANT

---

## Open Risks

1. **`staff_users` schema extension** — nullable `role_id` column must be additive; plan phase must verify no prior migration conflict.
2. **Permission hot-path latency** — 10-step evaluation on every API call; caching strategy needs latency budget in plan phase.
3. **Audit log growth** — no retention policy defined in this spec; a future maintenance stage may be needed.

---

## Next Step

Proceed to Step 2 — Clarify.
