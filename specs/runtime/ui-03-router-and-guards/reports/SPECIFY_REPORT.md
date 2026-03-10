# Specify Report — STAGE_UI_03_ROUTER_AND_GUARDS

**Step:** 1 — Specify **Timestamp:** 2026-03-02T00:00:00.000Z **Status:** COMPLETE

---

## Summary

Specification for the canonical routing system and guard pipeline across all three Zidney frontend
applications (MMC, Backoffice, Frontoffice) is complete. The spec defines 10 user stories covering
the full guard pipeline, RouteMeta schema standardization, WorkspaceGuard (Backoffice-only),
RoleGuard (UI-hint only), navigation fallback views, redirect strategy, and router testability. All
ambiguities were resolved without any `[NEEDS CLARIFICATION]` markers remaining.

---

## Inputs Reviewed

- `specs/runtime/ui-03-router-and-guards/spec.md`
- `specs/runtime/ui-03-router-and-guards/checklists/requirements.md`
- `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_03_ROUTER_AND_GUARDS.md`
- Existing app router files in `apps/mmc/src/`, `apps/backoffice/src/`, `apps/frontoffice/src/`

---

## Key Decisions

| #   | Decision                                                                                    | Rationale                                                                                         |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Guard pipeline registered in `main.ts` via `router.beforeEach()`, not in `router/index.ts`  | Preserves CL-01 bootstrap contract from STAGE_UI_01; router remains a pure configuration artifact |
| 2   | Backoffice inline license guard (`isActive` check in `beforeEach`) must be removed as FR-10 | Direct constitutional violation — license enforcement is backend-only                             |
| 3   | RouteMeta migrated from `guestOnly`/`requiredRole` (STAGE_UI_01) to `public`/`roles[]`      | Canonical schema standardization across all three apps                                            |
| 4   | Guards are pure injectable factories — no store imported directly                           | Enables isolated unit testing without router/store coupling                                       |
| 5   | FeatureFlagGuard is a reserved stub (always returns `true`)                                 | Holds pipeline position 4 for future implementation without blocking this stage                   |
| 6   | WorkspaceGuard is read-only at router level — no API calls, no data loading                 | Spec constraint: any data load happens in `main.ts` bootstrap, not in guards                      |
| 7   | `contextStore.loadContext()` moves to `main.ts` bootstrap (from STAGE_17 router)            | Ensures no API calls occur inside navigation guards                                               |
| 8   | Backoffice router migrated from `src/router/` to `src/core/router/index.ts`                 | Aligns all three apps to the same canonical path structure                                        |

---

## Functional Requirements Captured

- FR-01: AuthGuard — unauthenticated user on protected route → redirect to login with `?redirect`
  query param
- FR-02: AuthGuard — authenticated user on public/guest-only route → redirect to dashboard
- FR-03: AuthGuard MUST NOT decode JWT or inspect JWT payload
- FR-04: WorkspaceGuard (Backoffice only) — missing workspace context → redirect to workspace
  selector
- FR-05: WorkspaceGuard MUST NOT validate license, subscription, or make any API calls
- FR-06: RoleGuard — `route.meta.roles` defined, user.role not in list → redirect to unauthorized
  page
- FR-07: RoleGuard is UI-level hint only; backend remains the authoritative RBAC enforcer
- FR-08: 404 fallback — unmatched route → `NotFoundView`
- FR-09: Unauthorized fallback — RoleGuard redirect target → `UnauthorizedView`
- FR-10: Backoffice license guard removal — all license-state navigation logic must be stripped
- FR-11: RouteMeta `public: true` must be explicit — no implicit public assumption
- FR-12: Redirect save/restore — intended route saved before redirect to login; restored after
  successful auth

---

## Clarifications Required

None. All ambiguities resolved by cross-referencing stage file, existing router code, AGENTS.md, and
Project Context Primer.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                            |
| --------------------------------------- | ------ | ---------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | Frontend-only; no DB access anywhere in router layer             |
| License middleware requirement captured | ✅     | Router explicitly MUST NOT enforce license — backend handles it  |
| Snapshot integrity requirement captured | ✅     | N/A for this stage (no attempt engine interaction)               |
| Idempotency strategy defined            | ✅     | N/A (no write operations)                                        |
| Transaction boundaries identified       | ✅     | N/A (no data mutations)                                          |
| Server-authoritative time enforced      | ✅     | N/A for this stage                                               |
| No JWT decoding in guards               | ✅     | Guards read `AuthStore.isAuthenticated` only — explicit in FR-03 |
| No backend RBAC duplication             | ✅     | RoleGuard is UI-hint only — explicit in FR-07                    |
| No hardcoded workspace identifiers      | ✅     | Workspace context from WorkspaceStore/context only               |

**Overall:** COMPLIANT

---

## Open Risks

- **Risk 1 (Medium):** Backoffice STAGE_17 migration (FR-10) modifies existing functional router
  code. Regression testing for Backoffice navigation is critical. Existing E2E or smoke tests for
  Backoffice login/workspace flows must be re-validated after migration.
- **Risk 2 (Low):** RouteMeta schema change (`guestOnly` → `public`, `requiredRole` → `roles[]`)
  requires touching all existing route definitions in MMC and Frontoffice. Risk is limited to
  compile-time TypeScript errors caught by `tsc --noEmit`.

---

## Next Step

Proceed to Step 2 — Clarify.
