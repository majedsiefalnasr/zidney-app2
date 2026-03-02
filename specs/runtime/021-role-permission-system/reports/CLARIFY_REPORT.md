# Clarify Report — STAGE_21_ROLE_PERMISSION_SYSTEM

**Step:** 2 — Clarify
**Timestamp:** 2026-03-02T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

The clarify step identified and resolved 5 architectural ambiguities in the specification. The
spec was already well-structured; the clarifications closed edge cases in middleware binding,
cross-tenant security, mutation error contracts, transaction atomicity, and concurrent delete
serialization. All clarifications are now appended to `spec.md` under
`## Clarifications / ### Session 2026-03-02`. No items remain open. The spec is approved for
planning.

---

## Inputs Reviewed

- `specs/runtime/021-role-permission-system/spec.md` (including `## Clarifications`)
- `specs/phases/03_BACKOFFICE_CORE/01_FOUNDATION/STAGE_21_ROLE_PERMISSION_SYSTEM.md`

---

## Clarifications Resolved

| #   | Question                                                                                                               | Resolution                                                                                                                                        | Impact                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Q1  | How does the permission guard know which `(module, action)` to evaluate for a given route?                             | Central route permission registry (static map keyed by `[METHOD, path pattern]`); unregistered non-public routes fail closed → 403; FR-024 added  | New functional requirement FR-024; requires route registry implementation in plan |
| Q2  | Cross-tenant JWT replay: is `workspace_id` claim validated before DB access?                                           | JWT MUST embed `workspace_id`; Step 1 asserts `jwt.workspace_id === resolvedTenant.id`; mismatch → 403 + WARN log, no DB access; FR-007 updated   | Critical security closure; prevents cross-tenant token replay                     |
| Q3  | HTTP status codes for mutation validation failures (duplicate name, assigning disabled role, delete with active users) | 409 ROLE_NAME_CONFLICT / 422 ROLE_NOT_ASSIGNABLE / 409 ROLE_HAS_ACTIVE_USERS / 422 INVALID_MODULE                                                 | Specifies error contract for all mutation paths                                   |
| Q4  | Are create-role + initial permissions + audit log atomic in a single transaction?                                      | Yes — all three writes in one transaction; any failure rolls back all; applied to any endpoint combining role creation with permission assignment | Confirms transaction boundary; clarifies plan scope for atomic write              |
| Q5  | Concurrent delete-role TOCTOU: two admins could both pass the active-user check simultaneously                         | `SELECT id FROM roles WHERE id = $roleId FOR UPDATE` at transaction start serializes concurrent deletes; second request sees 404 or updated count | SELECT FOR UPDATE required in delete path; implementation detail for plan         |

---

## Open Items

None.

---

## Spec Updates Applied

- `## Clarifications / ### Session 2026-03-02` section appended to `spec.md` (lines 591–634)
- FR-024 added: route permission registry binding requirement
- FR-007 updated: JWT `workspace_id` cross-tenant validation sub-step added
- Transaction table clarified: create role + initial permissions = single atomic transaction
- Q5 resolution: `SELECT FOR UPDATE` added to delete-role operation description

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                                    |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------ |
| All material ambiguities resolved         | ✅     | 5 of 5 clarifications fully resolved                                     |
| Transaction strategy confirmed            | ✅     | Create role + initial permissions + audit = single atomic DB transaction |
| Idempotency strategy confirmed            | ✅     | DB unique constraints prevent duplicates; audit uses request_id          |
| Isolation boundaries confirmed            | ✅     | JWT workspace_id claim validated before any tenant DB access             |
| Version and license constraints confirmed | ✅     | License middleware prerequisite confirmed; schema_version bump required  |

**Overall:** COMPLIANT

---

## Open Risks

1. **Route permission registry** — FR-024 is a new requirement that requires a clean mapping
   of all Backoffice routes. Plan phase should account for this registry as a first-class
   deliverable (missing routes fail closed → 403, but incomplete registry is a shipping risk).
2. **JWT workspace_id claim** — requires the auth issuance layer (from a prior stage) to embed
   `workspace_id` in the JWT payload. Plan phase should confirm this claim is already emitted
   by the existing auth stage.
