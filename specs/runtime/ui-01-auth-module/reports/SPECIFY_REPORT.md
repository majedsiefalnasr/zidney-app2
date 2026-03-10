# Specify Report — STAGE_UI_01_AUTH_MODULE

**Step:** 1 — Specify  
**Timestamp:** 2026-03-01T00:10:00Z  
**Status:** COMPLETE

---

## Summary

The specification for the UI Authentication Runtime Module is complete. The spec defines the
frontend auth engine shared across all three Zidney applications (MMC, Backoffice, Frontoffice). It
covers 40 functional requirements, 8 non-functional requirements, 7 architectural stories, and 7
typed interface definitions. All constitutional constraints are compliant. No
`[NEEDS CLARIFICATION]` markers remain — 4 pre-emptive decisions were made and documented.

---

## Inputs Reviewed

- `specs/runtime/ui-01-auth-module/spec.md` (667 lines)
- `specs/runtime/ui-01-auth-module/checklists/requirements.md`
- `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_01_AUTH_MODULE.md`
- `specs/phases/06_UI_APPLICATION_RUNTIME/PHASE_6_IMPLEMENTATION.md`

---

## Key Decisions

| #   | Decision                                                                   | Rationale                                                                                             |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | AttemptGuard deferred to feature stage                                     | Auth guard only handles unauthenticated redirect; attempt gating is server-side and out of scope here |
| 2   | `initSession()` called at app bootstrap in `main.ts`                       | Ensures auth state is restored before any route guard runs, preventing race conditions on first load  |
| 3   | Logout backend call is fire-and-forget (frontend state cleared regardless) | Guarantees no stuck session state if network fails during logout                                      |
| 4   | Guard injects loginRouteName via route meta or composable parameter        | Preserves app-agnosticism — no hardcoded route names inside `core/auth/`                              |

---

## Functional Requirements Captured

- FR-AU-01 to FR-AU-09: Pinia auth store (state, getters, actions, initialization)
- FR-TM-01 to FR-TM-05: Token manager (set, get, clear, memory-only, no browser storage)
- FR-RM-01 to FR-RM-07: Refresh manager (single-flight lock, queue, retry, force-logout on failure)
- FR-AC-01 to FR-AC-04: API client integration (interceptor injects token, 401 triggers refresh)
- FR-AG-01 to FR-AG-06: Auth guard (requiresAuth, guestOnly, no JWT decode, redirect contract)
- FR-AS-01 to FR-AS-04: Auth service composable (login, logout, initSession, getMe)
- FR-SI-01 to FR-SI-03: Session initialization (page reload, unauthenticated fallback, no browser
  storage)
- FR-LO-01 to FR-LO-04: Logout (backend call, memory clear, state reset, redirect)
- FR-EH-01 to FR-EH-03: Error handling (auth error typed, refresh failure → logout, network error
  distinction)

---

## Clarifications Required

None — all 4 potential ambiguities were resolved pre-emptively during specification.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                                             |
| --------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | Auth module reads workspace_slug from route only; never constructs tenant queries |
| License middleware requirement captured | ✅ N/A | UI layer — license enforcement is server-side middleware only                     |
| Snapshot integrity requirement captured | ✅ N/A | Attempt engine not in scope for this stage                                        |
| Idempotency strategy defined            | ✅     | Single-flight refresh lock prevents duplicate token refresh calls                 |
| Transaction boundaries identified       | ✅ N/A | No backend transactions involved in UI auth module                                |
| Server-authoritative time enforced      | ✅     | Token expiry detected via 401 response only — no client-side `exp` claim parsing  |
| No token in localStorage/sessionStorage | ✅     | Token held in Pinia reactive memory only                                          |
| No JWT decoding for permissions         | ✅     | User profile from `/me` endpoint; JWT payload never decoded by frontend           |

**Overall:** COMPLIANT

---

## Open Risks

- Refresh flow correctness under high-concurrency (concurrent 401 burst) — mitigated by required
  integration test scenario FR-RM-05
- `initSession()` call timing across three apps must be consistent — mitigated by documenting call
  site in spec and requiring app bootstrap test

---

## Next Step

Proceed to Step 2 — Clarify.
