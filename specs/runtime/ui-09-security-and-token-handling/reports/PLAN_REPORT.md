# Plan Report — STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING

**Step:** 3 — Plan
**Timestamp:** 2026-03-01T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Technical plan for STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING is complete and guardian-validated. Research confirmed that STAGE_UI_01 already established the compliant auth foundation (in-memory token manager, centralised Bearer injection, Pinia auth store, auth guard). This stage closes 6 specific gaps: authenticated-session-scoped 401 handling, app-level isHandling401 guard, 423/426 response handling, token redaction utility, redirect preservation on guard redirect, and `expireSession()` action. No new npm packages. No database changes. No ADR required. Both guardian validators (Architecture Checker + API Designer) returned VERDICT: PASS.

---

## Inputs Reviewed

- `specs/runtime/ui-09-security-and-token-handling/spec.md`
- `specs/runtime/ui-09-security-and-token-handling/plan.md`
- `specs/runtime/ui-09-security-and-token-handling/research.md`

---

## Architecture Layers Touched

| Layer                  | Planned Changes               |
| ---------------------- | ----------------------------- |
| Frontend (MMC)         | 2 new files, 4 modified files |
| Frontend (Backoffice)  | 2 new files, 4 modified files |
| Frontend (Frontoffice) | 2 new files, 4 modified files |
| API                    | None                          |
| Worker                 | None                          |
| DB Master              | None                          |
| DB Tenant              | None                          |

---

## Key Technical Decisions

| #   | Decision                                                                   | Rationale                                                                    |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | No auth.store.ts restructure — keep core/state/auth.store.ts               | STAGE_UI_01 wiring; renaming breaks existing bootstrap                       |
| 2   | `isHandling401` guard at app-level `core/api/client.ts`                    | Avoids modifying shared package (consumed by backend tooling)                |
| 3   | `error.interceptor.ts` placed in `core/api/interceptors/` not `core/auth/` | API transport concern; proximity to client.ts reduces coupling               |
| 4   | 423/426 via `onLicenseError` callback pattern                              | Consistent with existing `onAuthFailure` pattern; no package change          |
| 5   | `expireSession()` intentionally omits `authService.logout()`               | Server already invalidated session (it returned 401); no backend call needed |
| 6   | `authError` set post-navigation in `expireSession()` only                  | Prevents double-assignment; single source of truth after navigation resolves |
| 7   | `token-redact.ts` as pure function with zero imports                       | Enables test-only import without framework setup                             |
| 8   | `redirect` query param in auth guard                                       | Standard Vue Router pattern; no extra store needed                           |

---

## Files Planned

### New Files (6 implementation + 9 test = 15 total)

**Implementation:**

- `apps/mmc/src/core/auth/token-redact.ts`
- `apps/mmc/src/core/api/interceptors/error.interceptor.ts`
- `apps/backoffice/src/core/auth/token-redact.ts`
- `apps/backoffice/src/core/api/interceptors/error.interceptor.ts`
- `apps/frontoffice/src/core/auth/token-redact.ts`
- `apps/frontoffice/src/core/api/interceptors/error.interceptor.ts`

**Tests:**

- `tests/unit/mmc/core/auth/token-redact.test.ts`
- `tests/unit/mmc/core/api/interceptors/error.interceptor.test.ts`
- `tests/unit/mmc/core/router/guards/auth.guard.redirect.test.ts`
- (same pattern × backoffice and frontoffice)

### Modified Files (12 total)

- `apps/*/src/core/state/auth.store.ts` (add `expireSession()` action)
- `apps/*/src/core/api/client.ts` (extend factory + isAuthenticated guard)
- `apps/*/src/core/auth/index.ts` (export token-redact.ts)
- `apps/*/src/core/router/guards/auth.guard.ts` (add redirect preservation)

---

## Migration Impact

| Item                  | Value | Notes                                                |
| --------------------- | ----- | ---------------------------------------------------- |
| Migration required    | No    | Pure frontend changes                                |
| `schema_version` bump | No    | No DB schema changes                                 |
| Backward compatible   | Yes   | Additive factory extensions; no breaking API changes |

---

## Transaction Boundaries

- No database writes — N/A. Auth state mutations are in-memory Pinia stores only.
- Logout is synchronous in-memory clear; fire-and-forget backend call is non-blocking.

---

## Idempotency Strategy

| Operation                        | Idempotency Approach                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| 401 handling (`expireSession()`) | `isAuthenticated` guard prevents re-entrant execution                                 |
| Parallel 401 storm               | `_isHandling401` boolean in `createErrorInterceptor` closure; subsequent 401s dropped |
| Logout                           | `isLoading` + `isAuthenticated` guards in existing `logout()` action                  |

---

## Constitutional Compliance

| Check                                  | Status | Notes                                              |
| -------------------------------------- | ------ | -------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | UI stage; zero DB access                           |
| All writes are transactional by design | ✅     | N/A — in-memory state only                         |
| Server-authoritative time enforced     | ✅     | No client-side expiry timers planned               |
| License middleware enforced            | ✅     | 423/426 handled without retry or override          |
| Version compatibility enforced         | ✅     | N/A — no schema/product version changes            |
| No architecture redesign without ADR   | ✅     | No ADR required; confirmed by architecture checker |

**Overall:** COMPLIANT

---

## Guardian Verdicts

| Guardian                    | Verdict | Notes                                                    |
| --------------------------- | ------- | -------------------------------------------------------- |
| Zidney Architecture Checker | ✅ PASS | 4 plan-quality issues identified and resolved pre-commit |
| Zidney API Designer         | ✅ PASS | All 6 API integration checks passed                      |

---

## Open Risks

None.

---

## Next Step

Proceed to Step 4 — Tasks.
