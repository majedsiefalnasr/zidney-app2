# Clarify Report — STAGE_UI_03_ROUTER_AND_GUARDS

**Step:** 2 — Clarify
**Timestamp:** 2026-03-02T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Ambiguity scan of `spec.md` identified 6 clarifications that removed implementation gaps around scope completeness, guard error-safety contracts, cross-app naming consistency, testability mechanics, and migration breaking-change scope. All clarifications were resolved using the stage file, existing app router code, and Zidney AGENTS.md. No open items remain. Stage is fully plannable.

---

## Inputs Reviewed

- `specs/runtime/ui-03-router-and-guards/spec.md` (including `## Clarifications`)
- `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_03_ROUTER_AND_GUARDS.md`
- `apps/mmc/src/` — existing router and auth guard code
- `apps/backoffice/src/` — existing router with inline license guard
- `apps/frontoffice/src/` — existing router and route definitions

---

## Clarifications Resolved

| #     | Question                                           | Resolution                                                                                                                                            | Impact                        |
| ----- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| CL-01 | Is `GlobalErrorView` in scope for all 3 apps?      | Yes — added to In Scope; `router.onError()` handler required per app; `<app>-error` route required                                                    | Completion Criteria, FR-08    |
| CL-02 | Must guard factories handle thrown exceptions?     | Yes — all guard factories wrap in try/catch; on catch: log at `error` level, return `true` (allow navigation safely)                                  | FR-03.3, testability contract |
| CL-03 | What are the canonical 404/error route names?      | 404: `mmc-not-found`, `bo-not-found`, `fo-not-found`; error: `mmc-error`, `bo-error`, `fo-error`                                                      | US5, cross-app naming         |
| CL-04 | How should tests instantiate the router?           | Guard unit tests call `NavigationGuard` directly; integration tests use `createMemoryHistory()`; `createAppRouter(history?)` accepts optional history | US10, testability             |
| CL-05 | Must legacy singleton router export be removed?    | Yes — `export const router = createAppRouter()` must be removed from MMC and Frontoffice; only `main.ts` calls `createAppRouter()`                    | FR-01.3, migration scope      |
| CL-06 | What about Backoffice `requiredModule` meta field? | Strip it — not in canonical RouteMeta schema (FR-02.1); removed from `types.ts` and all route definitions                                             | FR-10.2, migration scope      |

---

## Open Items

None.

---

## Spec Updates Applied

- Added `GlobalErrorView` to in-scope section (CL-01)
- Added `router.onError()` handler requirement to guard pipeline section (CL-02)
- Added canonical route name table for 404/error routes per app (CL-03)
- Added test router factory pattern `createAppRouter(history?)` (CL-04)
- Added singleton export removal as explicit migration task (CL-05)
- Added `requiredModule` field removal to Backoffice migration scope (CL-06)

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                |
| ----------------------------------------- | ------ | ---------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 6 clarifications added, 0 open                       |
| Transaction strategy confirmed            | ✅     | N/A — frontend-only, no write operations             |
| Idempotency strategy confirmed            | ✅     | N/A — navigation guards are stateless                |
| Isolation boundaries confirmed            | ✅     | Guards read store state only; no cross-tenant access |
| Version and license constraints confirmed | ✅     | Guards explicitly MUST NOT check license or version  |
