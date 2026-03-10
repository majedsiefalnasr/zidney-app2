# Clarify Report — STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING

**Step:** 2 — Clarify **Timestamp:** 2026-03-01T00:00:00.000Z **Status:** COMPLETE

---

## Summary

Clarification scan on `spec.md` produced 5 targeted questions across 7 audit domains (idempotency,
concurrency, security validation, error contract, version enforcement). All 5 were auto-resolved
from the spec, the Zidney Constitution, and standard security best practices. Zero unresolved items.
Two functional requirements (FR-SEC-07, FR-SEC-08) and one Success Criteria row were amended for
precision. Safe to proceed to planning.

---

## Inputs Reviewed

- `specs/runtime/ui-09-security-and-token-handling/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                                                                                        | Resolution                                                                                                            | Impact                                                  |
| --- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | How is the single-execution guarantee for concurrent 401s implemented?                          | `isHandling401` boolean guard flag in interceptor; first qualifying 401 sets flag; subsequent 401s dropped silently   | FR-SEC-08 updated to encode this mechanism              |
| 2   | After first 401 triggers logout (no-refresh mode), what happens to other in-flight 401s?        | Interceptor immediately rejects them as cancelled promises — no retry, no second redirect                             | Corollary of FR-SEC-08; no spec change needed beyond Q1 |
| 3   | Does FR-SEC-03 token-opacity prohibition include truncated representations (e.g. last 4 chars)? | Zero-tolerance per constitutional token-opacity rule; only safe log form is `"[REDACTED]"`                            | Confirmed; no spec text change needed                   |
| 4   | Does FR-SEC-07 "Any 401" include login-endpoint 401 for wrong credentials?                      | No — login-failure 401s must pass through normally; expiry flow fires only when `auth.store.isAuthenticated === true` | FR-SEC-07 rewritten; Success Criteria row corrected     |
| 5   | Are 423/426 responses differentiated per app (MMC/Backoffice/Frontoffice)?                      | Uniform behaviour across all three apps; mid-exam interruption on Frontoffice is a separate stage concern             | No spec change needed                                   |

---

## Open Items

None.

---

## Spec Updates Applied

- FR-SEC-07 rewritten: scoped to authenticated sessions only (`auth.store.isAuthenticated === true`)
- FR-SEC-08 updated: `isHandling401` guard mechanism documented as implementation strategy
- Success Criteria "Consistent 401 behaviour" row corrected to reflect authenticated-session scope
- `## Clarifications / Session 2026-03-01` section appended to `spec.md`

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                          |
| ----------------------------------------- | ------ | -------------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5/5 questions resolved                                         |
| Transaction strategy confirmed            | ✅     | No DB writes; logout state clear is synchronous in-memory      |
| Idempotency strategy confirmed            | ✅     | `isHandling401` flag ensures 401 handling is idempotent        |
| Isolation boundaries confirmed            | ✅     | No cross-tenant logic; security layer is per-user session only |
| Version and license constraints confirmed | ✅     | 423/426 behaviour uniform across all apps                      |

**Overall:** COMPLIANT

---

## Open Risks

None.

---

## Next Step

Proceed to Step 3 — Plan.
