# Clarify Report — STAGE_UI_04_GLOBAL_ERROR_HANDLING

**Step:** 2 — Clarify
**Timestamp:** 2026-04-06T00:20:00.000Z
**Status:** COMPLETE — All clarifications resolved

---

## Summary

Five implementation-impacting ambiguities discovered and resolved in `spec.md`. All resolutions are
based on authoritative codebase inspection (`packages/api-client/src/types.ts`, existing app
bootstraps, current `NormalizedError` usage) and constitutional constraints. The spec.md has been
updated in-place with a `## Clarifications / ### Session 2026-04-06` section.

---

## Clarifications Resolved

### Q1 — `retryable` vs `retryAfter` field conflict

**Status:** RESOLVED
**Decision:** `retryAfter?: number` from `packages/api-client/src/types.ts` is authoritative. The
stage file's `retryable?: boolean` was a draft artifact only. No boolean `retryable` field will be
added to `AppError`. Normalizer sets `retryAfter` from `Retry-After` HTTP header when status is 429.

### Q2 — Logger injection pattern for `global-error-handler.ts`

**Status:** RESOLVED
**Decision:** `Logger` type is from `@zidney/logger`. Constitutional constraint forbids
`import.meta.env` **inside error handler modules** — not logger imports. Pattern: instantiate
`createLogger(appName)` in `main.ts` and inject via `GlobalErrorHandlerOptions.logger`. The
`global-error-handler.ts` itself never reads env vars.

### Q3 — `toastFromError` in TR6 pseudocode

**Status:** RESOLVED
**Decision:** `toastFromError` is out-of-scope illustrative pseudocode in TR6. The only spec
deliverable is the `onError: (error: AppError) => void` callback contract. Implementation of
the toast call body is the integration consumer's responsibility (future stage).

### Q4 — `registerGlobalErrorHandlers` bootstrap insertion point

**Status:** RESOLVED
**Decision:** Insert as new **Step 8.5** in `main.ts` — after `registerGuards()` (Step 8), before
`app.mount('#app')` (Step 9). This ensures router, stores, and guards are initialized before
the global error handler's `onError` callback can fire.

### Q5 — `NormalizedError` migration backward compatibility guard

**Status:** RESOLVED
**Decision:** Updated normalizers must add a secondary structural guard for legacy
`{ code, httpStatus }` objects lacking `isNetworkError`. Reconstruct as `AppError` with
`isNetworkError: false` (semantically correct — all existing `NormalizedError` values are HTTP
responses). This guard is a migration safety net to be removed after all throw sites are confirmed
migrated.

---

## Updated Scope (Post-Clarification)

The following implementation details are now locked:

- `AppError` interface: `readonly code`, `readonly message`, `readonly httpStatus`, `readonly isNetworkError`, `readonly retryAfter?` (NO boolean `retryable`)
- Logger: injected as `@zidney/logger` `Logger` instance from `main.ts` via options object
- Bootstrap: `registerGlobalErrorHandlers()` called at Step 8.5 of app bootstrap
- Migration guard: secondary structural check for legacy `NormalizedError` shapes in normalizer

---

## Architecture Governance Compliance

All clarifications align with:

- ADR-0001 (database-per-tenant isolation) — not applicable, UI-only
- Frontend layer rule (no env vars in error handler modules) — ✅ CONFIRMED
- Import boundaries (`apps/*` → `packages/*` only) — ✅ CONFIRMED
- No business logic in error handler — ✅ CONFIRMED (HTTP-status mapping only)

**Overall:** COMPLIANT — Ready for technical planning
