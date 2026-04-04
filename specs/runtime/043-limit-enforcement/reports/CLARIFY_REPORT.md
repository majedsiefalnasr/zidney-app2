# CLARIFY_REPORT — Stage 43: License Limit Enforcement

**Step:** 2 — Clarify  
**Date:** 2026-04-04  
**Spec:** `specs/runtime/043-limit-enforcement/spec.md → ## Clarifications`

---

## Summary

6 clarifications were resolved through code research. All ambiguities from the stage specification
are now addressed. No blocking issues identified.

---

## Resolved Clarifications

### Q1 — HTTP Status for `LICENSE_LIMIT_REACHED`

**Ambiguity:** Stage spec says "No generic 500 errors allowed" but does not specify 422 vs 403.

**Resolution:** Preserve existing HTTP maps from domain error classes:

- `STUDENT_LIMIT_EXCEEDED` → HTTP **422** (Unprocessable Entity)
- `STAFF_LIMIT_EXCEEDED` → HTTP **403** (Forbidden)

Rationale: Aligns with existing test expectations. The public-facing code is `LICENSE_LIMIT_REACHED`
(in the `error.code` field); the HTTP status follows domain conventions to avoid breaking changes.

### Q2 — Error Metadata Strategy

**Ambiguity:** Where to carry `limit_value` and `current_value` — extend error class or read from context?

**Resolution:** Extend `StudentError` and `StaffError` with optional `limit_value?: number` and
`current_value?: number` fields. Domain functions pass these when throwing. Route helpers read them
from the error instance when building the `LICENSE_LIMIT_REACHED` response.

Rationale: Cleanest chain, no second DB query at the HTTP layer, keeps helpers stateless.

### Q3 — `c.get('license')` Undeclared Context Key

**Ambiguity:** `create-student.ts` and `create-staff.ts` call `c.get('license')` which is not in
`BackofficeVariables` and is never set by the middleware.

**Resolution:** Stage 43 does NOT refactor the license-status guard in create routes. That is an
orthogonal concern. Stage 43 fixes only the limit-value chain:
`middleware sets number|null → c.get('student_limit') / c.get('staff_limit') typed correctly`.

The `c.get('license')` calls in create routes are out of scope and documented as pre-existing
tech debt.

### Q4 — SERIALIZABLE vs Advisory Locks

**Ambiguity:** Stage spec suggests both SERIALIZABLE and advisory locks as options.

**Resolution:** Use SERIALIZABLE (matches existing `createStudent`/`createStaff` pattern). No
retry at API layer on serialization failure — return `LICENSE_LIMIT_REACHED` immediately.

Advisory locks deferred to v2 if SERIALIZABLE proves too restrictive under load.

### Q5 — Staff Bulk Import Route

**Ambiguity:** Route path and version not specified in stage file.

**Resolution:** `POST /backoffice/:workspace_slug/v1/staff/bulk-import`  
Consistent with student bulk import: `POST /backoffice/:workspace_slug/v1/students/bulk-import`.

### Q6 — `correlation_id` vs `correlationId` Key Naming

**Ambiguity:** `BackofficeVariables` uses `correlationId` (camelCase) while some middleware uses
`correlation_id` (snake_case).

**Resolution:** Stage 43 uses whatever key is already set per-file without renaming. No rename
in this stage. Implementation checks per file to use the correct key.

---

## Audit Focus Areas

| Area                       | Risk     | Confirmed Resolved                        |
| -------------------------- | -------- | ----------------------------------------- |
| Concurrent insert races    | HIGH     | SERIALIZABLE isolation — confirmed        |
| null limit propagation     | HIGH     | Explicit `null` check in all paths        |
| Reactivation missing check | CRITICAL | G1+G2: enableStudent/enableStaff          |
| Staff bulk import missing  | MEDIUM   | G11: new feature scoped                   |
| Type inconsistency         | MEDIUM   | G12+G13: BackofficeVariables + middleware |
| Error shape mapping        | MEDIUM   | G10: helpers.ts for both entities         |

---

## Open Questions

None. All ambiguities resolved.
