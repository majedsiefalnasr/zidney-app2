# Specify Report — STAGE_UI_04_GLOBAL_ERROR_HANDLING

**Step:** 1 — Specify
**Timestamp:** 2026-04-06T00:10:00.000Z
**Status:** COMPLETE

---

## Summary

Specification generated for the Global Error Boundary & Normalization Layer stage. The spec defines
a canonical `AppError` interface shared across all three Zidney frontend applications (MMC,
Backoffice, Frontoffice), consolidating divergent per-app `NormalizedError` types into a single
source of truth in `packages/api-client/src/types.ts`. The spec covers 10 user stories, 4 new
file archetypes per app, production safety contracts, and full testing requirements.

---

## Inputs Reviewed

- `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_04_GLOBAL_ERROR_HANDLING.md`
- `specs/runtime/ui-04-global-error-handling/spec.md`
- `specs/runtime/ui-04-global-error-handling/checklists/requirements.md`
- `apps/mmc/src/core/errors/` (current state analysis)
- `apps/backoffice/src/core/errors/` (current state analysis)
- `apps/frontoffice/src/core/errors/` (current state analysis)
- `packages/api-client/src/types.ts` (canonical AppError source)

---

## Key Decisions

| #   | Decision                                                             | Rationale                                                                 |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Canonical `AppError` lives in `packages/api-client/src/types.ts`     | Single source of truth; shared across all 3 apps without duplication      |
| 2   | Per-app `NormalizedError` types are deprecated and replaced          | Eliminates divergence; ensures uniform error surface across platform      |
| 3   | `redact-error.ts` is a pure function (no side effects)               | Testable in isolation; 100% coverage achievable                           |
| 4   | `ErrorBoundary.vue` placed in each app's `core/errors/`              | App-level customization of fallback UI while sharing the boundary logic   |
| 5   | `global-error-handler.ts` registered at app bootstrap (main.ts)      | Ensures all unhandled rejections are captured before any component mounts |
| 6   | `retryable` flag only for network-level errors (no business retries) | Constitutional constraint: no auto-retry for business actions             |

---

## Functional Requirements Captured

- AppError interface with `code`, `message`, `httpStatus`, `isNetworkError`, `retryAfter?` fields
- `error-normalizer.ts` — accepts `unknown`, always returns valid `AppError`
- HTTP status mapping: 400→ValidationError, 401→refresh trigger, 403→PermissionDenied, 404→NotFound, 409→Conflict, 423→Locked, 426→UpgradeRequired, 429→RateLimited, 500+→ServerError
- `redact-error.ts` — strips access token, refresh token, full payloads, stack traces in production
- `ErrorBoundary.vue` — wraps `<RouterView />`, catches render-time + async component errors
- `global-error-handler.ts` — registers `window.addEventListener("unhandledrejection")` + `window.addEventListener("error")`
- Three display modes: inline form error, toast notification, full-page fallback (context-determined)
- Full test coverage: 100% normalizer, 100% redactor, ≥90% handler, ≥80% boundary

---

## User Stories Summary

| ID   | Priority | Title                                               |
| ---- | -------- | --------------------------------------------------- |
| US1  | P1       | Typed error objects in all components               |
| US2  | P1       | Network failure visible to user                     |
| US3  | P1       | 429 rate-limit surfaced gracefully                  |
| US4  | P1       | Render crash caught by boundary                     |
| US5  | P1       | Global rejection handler captures uncaught promises |
| US6  | P1       | Sensitive data redacted in production               |
| US7  | P2       | HTTP status preserved and mapped                    |
| US8  | P2       | Three display modes available                       |
| US9  | P2       | Cross-app consistency enforced                      |
| US10 | P2       | Error scenarios testable without mocking globals    |

---

## Clarifications Required

None — all architectural decisions resolvable from stage file and existing codebase state.

---

## Architecture Governance Compliance

| Check                                              | Status | Notes                                                 |
| -------------------------------------------------- | ------ | ----------------------------------------------------- |
| No cross-tenant access introduced (ADR-0001)       | ✅     | Frontend-only; no DB imports                          |
| License middleware requirement captured            | ✅ N/A | Frontend UI layer — not applicable                    |
| Snapshot integrity requirement captured (ADR-0002) | ✅ N/A | No backend state — not applicable                     |
| Idempotency strategy defined                       | ✅ N/A | UI normalization layer — not applicable               |
| Transaction boundaries identified                  | ✅ N/A | No DB writes — not applicable                         |
| Server-authoritative time enforced (ADR-0006)      | ✅ N/A | No time logic in error handler                        |
| Trust chain respected                              | ✅     | Error handler is tenant-neutral; no auth inference    |
| Import boundaries respected                        | ✅     | `apps/*` → `packages/*` only; no cross-app imports    |
| No stack traces in production                      | ✅     | Enforced via `redact-error.ts`                        |
| No business logic in error handler                 | ✅     | HTTP-status mapping only; no business state inference |

**Overall:** COMPLIANT
