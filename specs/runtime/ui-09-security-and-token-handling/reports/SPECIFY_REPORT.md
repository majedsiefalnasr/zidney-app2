# Specify Report — STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING

**Step:** 1 — Specify **Timestamp:** 2026-03-01T00:00:00.000Z **Status:** COMPLETE

---

## Summary

Specification for STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING is complete. The spec defines the frontend
security architecture across all three UI applications (MMC, Backoffice, Frontoffice), covering
token storage policy, authorization header injection, session expiry handling, secure logout, route
protection, XSS/CSRF mitigation, and license-locked response handling. All constitutional
constraints are satisfied with zero clarification markers remaining. The requirements checklist
passed all 41 items across five validation categories.

---

## Inputs Reviewed

- `specs/runtime/ui-09-security-and-token-handling/spec.md`
- `specs/runtime/ui-09-security-and-token-handling/checklists/requirements.md`
- `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING.md`

---

## Key Decisions

| #   | Decision                                                                | Rationale                                                                                |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Token stored in Pinia auth store (in-memory) only                       | localStorage/sessionStorage are XSS-vulnerable; HttpOnly cookies are a backend concern   |
| 2   | Authorization header injected centrally via API client interceptor      | Prevents per-component duplication; single enforcement point                             |
| 3   | 401 response triggers: clear state → redirect → notify → preserve route | Standardised flow prevents redirect loops and ensures consistent UX                      |
| 4   | Refresh strategy disabled by default                                    | Simplifies initial implementation; can be enabled via `core/auth/refresh.ts` when needed |
| 5   | Logout is fire-and-forget for backend endpoint                          | UI must clear state immediately; backend call failure must not block logout              |
| 6   | Router guards check `isAuthenticated` only — no JWT decoding            | Token validity is backend responsibility; guards only gate navigation                    |
| 7   | `v-html` prohibited without sanitization                                | Eliminates primary XSS vector in Vue applications                                        |
| 8   | 423/426 responses respected as-is — no UI override                      | License and workspace decisions belong to the backend                                    |
| 9   | All security logic bounded to `core/auth/`                              | Enforces architectural layer separation; prevents business logic in components           |

---

## Functional Requirements Captured

FR-SEC-01 through FR-SEC-22 captured across domains:

- **Token Storage**: In-memory only, no persistent browser storage (FR-SEC-01 to FR-SEC-04)
- **Header Injection**: Centralised interceptor, omit when no token (FR-SEC-05 to FR-SEC-06)
- **401 Handling**: Idempotent, standardised 4-step flow, concurrent 401 coalescing (FR-SEC-07 to
  FR-SEC-09)
- **Refresh**: Single-flight with queuing, failure triggers full logout (FR-SEC-10 to FR-SEC-12)
- **Logout**: Full state clear, redirect, optional backend call (FR-SEC-13 to FR-SEC-14)
- **Route Guards**: Authentication gate only, no business rules (FR-SEC-15 to FR-SEC-16)
- **XSS**: No raw HTML injection, Vue template escaping (FR-SEC-17 to FR-SEC-18)
- **Sensitive Data**: No persistence, redact in logs (FR-SEC-19 to FR-SEC-20)
- **License Responses**: 423 locked display, 426 upgrade display, no override (FR-SEC-21 to
  FR-SEC-22)

---

## Clarifications Required

None — all decisions resolved using stage source constraints, constitution, and documented
reasonable defaults.

---

## Constitutional Compliance

| Check                                          | Status | Notes                                                              |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------ |
| No cross-tenant access introduced              | ✅     | UI stage; no database access whatsoever                            |
| License middleware requirement captured        | ✅     | 423 and 426 responses handled without override                     |
| Snapshot integrity requirement captured        | ✅     | N/A — not an attempt-related stage                                 |
| Idempotency strategy defined                   | ✅     | 401 handling and logout are idempotent by design                   |
| Transaction boundaries identified              | ✅     | N/A — no DB writes from UI layer                                   |
| Server-authoritative time enforced             | ✅     | No client-side token expiry logic; server 401 is authoritative     |
| No JWT decoding for business decisions         | ✅     | Tokens treated as opaque strings throughout                        |
| No RBAC logic in UI                            | ✅     | Guards check authentication only; authorization is backend concern |
| No hardcoded brand colors or design violations | ✅     | Security layer has no UI rendering scope                           |
| Import boundaries respected                    | ✅     | All logic scoped to `core/auth/`; no backend imports               |

**Overall:** COMPLIANT

---

## Open Risks

None.

---

## Next Step

Proceed to Step 2 — Clarify.
