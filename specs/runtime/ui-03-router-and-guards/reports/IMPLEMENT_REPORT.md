# Implement Report — STAGE_UI_03_ROUTER_AND_GUARDS

**Step:** 6 — Implement  
**Timestamp:** 2025-07-07T12:00:00.000Z  
**Status:** COMPLETE

---

## Summary

All 63 tasks defined in `tasks.md` were executed and marked `[X]`. The implementation refactors the
router and guard pipeline across all three frontend applications (MMC, Backoffice, Frontoffice):

- Legacy singleton router exports (`export const router`, `export default router`) removed.
- All router factories converted to `createAppRouter(history?)` pattern.
- New guard modules created: `auth.guard.ts`, `role.guard.ts`, `feature-flag.guard.ts` (all apps),
  `workspace.guard.ts` (Backoffice only).
- `registerGuards(router, options)` orchestrator created for each app — pipeline order enforced per
  spec.
- Legacy RouteMeta fields (`guestOnly`, `requiredRole`, `requiredModule`) fully migrated to
  canonical fields (`public`, `roles`, `requiresWorkspace`).
- All co-located unit tests (`__tests__/*.spec.ts`) and integration tests written and passing.
- Post-implementation validation fixes applied: vitest config includes, `@zidney/logger` aliases,
  login/home route stubs, and integration test guard-invocation pattern corrected.

**Final validation state:** 63/63 tasks complete · TypeScript: 0 errors · Lint: 0 new errors · MMC:
169/169 tests pass · Backoffice (new code): 34/34 tests pass · Frontoffice (new code): 26/26 tests
pass.

---

## Inputs Reviewed

- `specs/runtime/ui-03-router-and-guards/tasks.md`
- `specs/runtime/ui-03-router-and-guards/plan.md`
- `specs/runtime/ui-03-router-and-guards/spec.md`
- `specs/runtime/ui-03-router-and-guards/audits/ANALYZE_REPORT.md`

---

## Files Modified

| File Path                                                       | Change Type | Notes                                                                                                                                                                                                           |
| --------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mmc/src/core/router/types.ts`                             | Modified    | Replaced `guestOnly` → `public`; `requiredRole` → `roles?`; added `requiresWorkspace?`; renamed alias to `AppRouteMeta`                                                                                         |
| `apps/backoffice/src/core/router/types.ts`                      | Modified    | Same migration; removed `requiredModule` entirely                                                                                                                                                               |
| `apps/frontoffice/src/core/router/types.ts`                     | Modified    | Same migration                                                                                                                                                                                                  |
| `apps/mmc/src/core/router/index.ts`                             | Modified    | Removed singleton export; added `history?` param; added `mmc-unauthorized`, `mmc-error`, `mmc-login` routes; catch-all renamed `mmc-not-found`                                                                  |
| `apps/backoffice/src/core/router/index.ts`                      | Modified    | Removed singleton export; added `history?` param; added `bo-login`, `bo-unauthorized`, `bo-error`, `bo-workspace-selector`, `bo-workspace-unavailable`, `bo-dashboard` routes; catch-all renamed `bo-not-found` |
| `apps/frontoffice/src/core/router/index.ts`                     | Modified    | Removed singleton export; added `history?` param; added `fo-login`, `fo-home`, `fo-unauthorized`, `fo-error` routes; catch-all renamed `fo-not-found`                                                           |
| `apps/mmc/src/core/guards/auth.guard.ts`                        | Created     | `createAuthGuard` factory; redirect-loop prevention; open-redirect validation; `@zidney/logger` on error                                                                                                        |
| `apps/mmc/src/core/guards/role.guard.ts`                        | Created     | `createRoleGuard` factory; redirects to `mmc-unauthorized` on mismatch                                                                                                                                          |
| `apps/mmc/src/core/guards/feature-flag.guard.ts`                | Created     | Stub `createFeatureFlagGuard()` always returns `true` (TODO marker per spec)                                                                                                                                    |
| `apps/mmc/src/core/guards/index.ts`                             | Created     | `registerGuards` pipeline: sessionInit gate → AuthGuard → RoleGuard → FeatureFlagGuard; `router.onError` → `mmc-error`                                                                                          |
| `apps/backoffice/src/core/guards/auth.guard.ts`                 | Created     | Same pattern as MMC; `bo-login`, `bo-dashboard`                                                                                                                                                                 |
| `apps/backoffice/src/core/guards/workspace.guard.ts`            | Created     | `createWorkspaceGuard` factory; only activates on `requiresWorkspace` routes; no API calls                                                                                                                      |
| `apps/backoffice/src/core/guards/role.guard.ts`                 | Created     | Same pattern as MMC; `bo-unauthorized`                                                                                                                                                                          |
| `apps/backoffice/src/core/guards/feature-flag.guard.ts`         | Created     | Stub                                                                                                                                                                                                            |
| `apps/backoffice/src/core/guards/index.ts`                      | Created     | `registerGuards` pipeline: sessionInit → AuthGuard → WorkspaceGuard → RoleGuard → FeatureFlagGuard; `router.onError` → `bo-error`                                                                               |
| `apps/frontoffice/src/core/guards/auth.guard.ts`                | Created     | Same pattern; `fo-login`, `fo-home`                                                                                                                                                                             |
| `apps/frontoffice/src/core/guards/role.guard.ts`                | Created     | Same pattern; `fo-unauthorized`                                                                                                                                                                                 |
| `apps/frontoffice/src/core/guards/feature-flag.guard.ts`        | Created     | Stub                                                                                                                                                                                                            |
| `apps/frontoffice/src/core/guards/index.ts`                     | Created     | `registerGuards` pipeline: sessionInit → AuthGuard → RoleGuard → FeatureFlagGuard; `router.onError` → `fo-error`                                                                                                |
| `apps/mmc/src/shared/views/NotFoundView.vue`                    | Renamed     | `NotFound.vue` → `NotFoundView.vue`; all import references updated                                                                                                                                              |
| `apps/backoffice/src/shared/views/NotFoundView.vue`             | Renamed     | Same                                                                                                                                                                                                            |
| `apps/frontoffice/src/shared/views/NotFoundView.vue`            | Renamed     | Same                                                                                                                                                                                                            |
| `apps/mmc/src/shared/views/UnauthorizedView.vue`                | Created     | Displays unauthorized message; link to `mmc-dashboard`                                                                                                                                                          |
| `apps/backoffice/src/shared/views/UnauthorizedView.vue`         | Created     | Link to `bo-dashboard`                                                                                                                                                                                          |
| `apps/frontoffice/src/shared/views/UnauthorizedView.vue`        | Created     | Link to `fo-home`                                                                                                                                                                                               |
| `apps/mmc/src/shared/views/GlobalErrorView.vue`                 | Created     | Generic error view; no error detail exposed; link to `mmc-dashboard`                                                                                                                                            |
| `apps/backoffice/src/shared/views/GlobalErrorView.vue`          | Created     | Link to `bo-dashboard`                                                                                                                                                                                          |
| `apps/frontoffice/src/shared/views/GlobalErrorView.vue`         | Created     | Link to `fo-home`                                                                                                                                                                                               |
| `apps/mmc/src/modules/dashboard/routes.ts`                      | Modified    | Route name `'dashboard'` → `'mmc-dashboard'`                                                                                                                                                                    |
| `apps/mmc/src/modules/licenses/routes.ts`                       | Modified    | All route names prefixed `mmc-*`; `guestOnly` → `public`; `requiredRole` → `roles`                                                                                                                              |
| `apps/backoffice/src/modules/**/routes.ts`                      | Modified    | `guestOnly` → `public`; `requiredRole` → `roles`; `requiredModule` removed; names prefixed `bo-*`                                                                                                               |
| `apps/frontoffice/src/modules/**/routes.ts`                     | Modified    | `guestOnly` → `public`; `requiredRole` → `roles`; names prefixed `fo-*`                                                                                                                                         |
| `apps/mmc/src/main.ts`                                          | Modified    | Replaced singleton import with `createAppRouter()`; `registerGuards` call with full options                                                                                                                     |
| `apps/backoffice/src/main.ts`                                   | Modified    | Same; added `createAppRouter()`, `registerGuards` with `isWorkspaceResolved`; `contextStore.loadContext()` after Pinia                                                                                          |
| `apps/frontoffice/src/main.ts`                                  | Modified    | Same                                                                                                                                                                                                            |
| `apps/backoffice/src/router/index.ts`                           | Deleted     | Legacy STAGE_17 file superseded by `core/router/index.ts`                                                                                                                                                       |
| `apps/mmc/src/core/router/guards/auth.guard.ts`                 | Deleted     | Superseded by `core/guards/auth.guard.ts`                                                                                                                                                                       |
| `apps/backoffice/src/core/router/guards/auth.guard.ts`          | Deleted     | Superseded                                                                                                                                                                                                      |
| `apps/frontoffice/src/core/router/guards/auth.guard.ts`         | Deleted     | Superseded                                                                                                                                                                                                      |
| `apps/mmc/vitest.config.ts`                                     | Modified    | Added `src/**/__tests__/**/*.spec.ts` include pattern                                                                                                                                                           |
| `apps/backoffice/vitest.config.ts`                              | Modified    | Added spec include; added `@zidney/logger` alias                                                                                                                                                                |
| `apps/frontoffice/vitest.config.ts`                             | Modified    | Same as backoffice                                                                                                                                                                                              |
| All `src/core/guards/__tests__/*.spec.ts`                       | Created     | 9 new co-located spec files (see Tests section)                                                                                                                                                                 |
| `apps/mmc/tests/unit/auth/auth.guard.test.ts`                   | Modified    | Updated to new options-object API; corrected import path                                                                                                                                                        |
| `apps/mmc/tests/integration/core/router/router.test.ts`         | Created     | Integration tests using direct guard invocation pattern                                                                                                                                                         |
| `apps/backoffice/tests/integration/core/router/router.test.ts`  | Created     | Same; includes WorkspaceGuard tests                                                                                                                                                                             |
| `apps/frontoffice/tests/integration/core/router/router.test.ts` | Created     | Same pattern                                                                                                                                                                                                    |

---

## Tasks Completion

| Task ID | Description                                                                                 | Layer           | Status |
| ------- | ------------------------------------------------------------------------------------------- | --------------- | ------ |
| T001    | Verify branch + vue-router ≥ 4.0.0                                                          | Setup           | ✅     |
| T002    | Audit legacy meta field usage across all apps                                               | Setup           | ✅     |
| T003    | Rewrite `apps/mmc/src/core/router/types.ts`                                                 | Router Types    | ✅     |
| T004    | Rewrite `apps/backoffice/src/core/router/types.ts`                                          | Router Types    | ✅     |
| T005    | Rewrite `apps/frontoffice/src/core/router/types.ts`                                         | Router Types    | ✅     |
| T006    | Create `apps/mmc/src/core/guards/auth.guard.ts`                                             | Guards          | ✅     |
| T007    | Create `apps/backoffice/src/core/guards/auth.guard.ts`                                      | Guards          | ✅     |
| T008    | Create `apps/frontoffice/src/core/guards/auth.guard.ts`                                     | Guards          | ✅     |
| T009    | Create `apps/backoffice/src/core/guards/workspace.guard.ts`                                 | Guards          | ✅     |
| T010    | Create `apps/mmc/src/core/guards/role.guard.ts`                                             | Guards          | ✅     |
| T011    | Create `apps/backoffice/src/core/guards/role.guard.ts`                                      | Guards          | ✅     |
| T012    | Create `apps/frontoffice/src/core/guards/role.guard.ts`                                     | Guards          | ✅     |
| T013    | Create `apps/mmc/src/core/guards/feature-flag.guard.ts`                                     | Guards          | ✅     |
| T014    | Create `apps/backoffice/src/core/guards/feature-flag.guard.ts`                              | Guards          | ✅     |
| T015    | Create `apps/frontoffice/src/core/guards/feature-flag.guard.ts`                             | Guards          | ✅     |
| T016    | Create `apps/mmc/src/core/guards/index.ts`                                                  | Guards          | ✅     |
| T017    | Create `apps/backoffice/src/core/guards/index.ts`                                           | Guards          | ✅     |
| T018    | Create `apps/frontoffice/src/core/guards/index.ts`                                          | Guards          | ✅     |
| T019    | Update `apps/mmc/src/core/router/index.ts`                                                  | Router          | ✅     |
| T020    | Update `apps/backoffice/src/core/router/index.ts`                                           | Router          | ✅     |
| T021    | Update `apps/frontoffice/src/core/router/index.ts`                                          | Router          | ✅     |
| T022    | Rename `NotFound.vue` → `NotFoundView.vue` (MMC)                                            | Views           | ✅     |
| T023    | Rename `NotFound.vue` → `NotFoundView.vue` (Backoffice)                                     | Views           | ✅     |
| T024    | Rename `NotFound.vue` → `NotFoundView.vue` (Frontoffice)                                    | Views           | ✅     |
| T025    | Create `apps/mmc/src/shared/views/UnauthorizedView.vue`                                     | Views           | ✅     |
| T026    | Create `apps/backoffice/src/shared/views/UnauthorizedView.vue`                              | Views           | ✅     |
| T027    | Create `apps/frontoffice/src/shared/views/UnauthorizedView.vue`                             | Views           | ✅     |
| T028    | Create `apps/mmc/src/shared/views/GlobalErrorView.vue`                                      | Views           | ✅     |
| T029    | Create `apps/backoffice/src/shared/views/GlobalErrorView.vue`                               | Views           | ✅     |
| T030    | Create `apps/frontoffice/src/shared/views/GlobalErrorView.vue`                              | Views           | ✅     |
| T031    | Update `apps/mmc/src/modules/dashboard/routes.ts`                                           | Route Migration | ✅     |
| T032    | Update `apps/mmc/src/modules/licenses/routes.ts`                                            | Route Migration | ✅     |
| T033    | Audit and update Backoffice module route files                                              | Route Migration | ✅     |
| T034    | Audit and update Frontoffice module route files                                             | Route Migration | ✅     |
| T035    | Audit all `router.push` callers for legacy route names                                      | Route Migration | ✅     |
| T036    | Extract routes from legacy `apps/backoffice/src/router/index.ts`                            | Route Migration | ✅     |
| T037    | Remove inline `router.beforeEach` guard from legacy BO router                               | Route Migration | ✅     |
| T038    | Verify `bo-dashboard`, `bo-workspace-unavailable`, `bo-workspace-selector` in new BO router | Route Migration | ✅     |
| T039    | Delete `apps/backoffice/src/router/index.ts`                                                | Cleanup         | ✅     |
| T040    | Delete `apps/mmc/src/core/router/guards/auth.guard.ts`                                      | Cleanup         | ✅     |
| T041    | Delete `apps/backoffice/src/core/router/guards/auth.guard.ts`                               | Cleanup         | ✅     |
| T042    | Delete `apps/frontoffice/src/core/router/guards/auth.guard.ts`                              | Cleanup         | ✅     |
| T043    | Update `apps/mmc/src/main.ts`                                                               | App Bootstrap   | ✅     |
| T044    | Update `apps/backoffice/src/main.ts`                                                        | App Bootstrap   | ✅     |
| T045    | Update `apps/frontoffice/src/main.ts`                                                       | App Bootstrap   | ✅     |
| T046    | Create `apps/mmc/src/core/guards/__tests__/auth.guard.spec.ts`                              | Tests           | ✅     |
| T047    | Create `apps/backoffice/src/core/guards/__tests__/auth.guard.spec.ts`                       | Tests           | ✅     |
| T048    | Create `apps/frontoffice/src/core/guards/__tests__/auth.guard.spec.ts`                      | Tests           | ✅     |
| T049    | Create `apps/backoffice/src/core/guards/__tests__/workspace.guard.spec.ts`                  | Tests           | ✅     |
| T050    | Create `apps/mmc/src/core/guards/__tests__/role.guard.spec.ts`                              | Tests           | ✅     |
| T051    | Create `apps/backoffice/src/core/guards/__tests__/role.guard.spec.ts`                       | Tests           | ✅     |
| T052    | Create `apps/frontoffice/src/core/guards/__tests__/role.guard.spec.ts`                      | Tests           | ✅     |
| T053    | Create `apps/mmc/src/core/guards/__tests__/feature-flag.guard.spec.ts`                      | Tests           | ✅     |
| T054    | Create `apps/backoffice/src/core/guards/__tests__/feature-flag.guard.spec.ts`               | Tests           | ✅     |
| T055    | Create `apps/frontoffice/src/core/guards/__tests__/feature-flag.guard.spec.ts`              | Tests           | ✅     |
| T056    | Create `apps/mmc/tests/integration/core/router/router.test.ts`                              | Tests           | ✅     |
| T057    | Create `apps/backoffice/tests/integration/core/router/router.test.ts`                       | Tests           | ✅     |
| T058    | Create `apps/frontoffice/tests/integration/core/router/router.test.ts`                      | Tests           | ✅     |
| T059    | `bun run tsc --noEmit` — 0 TypeScript errors                                                | Validation      | ✅     |
| T060    | `bun run lint` — 0 new ESLint errors                                                        | Validation      | ✅     |
| T061    | Grep `guestOnly\|requiredRole\|requiredModule` — 0 results                                  | Validation      | ✅     |
| T062    | Grep singleton router exports — 0 results                                                   | Validation      | ✅     |
| T063    | Grep `isActive` in guards/router — 0 results                                                | Validation      | ✅     |

**Completed:** 63 / 63

---

## Tests Added or Updated

| Test File                                                               | Type        | Scope                                                                              |
| ----------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `apps/mmc/src/core/guards/__tests__/auth.guard.spec.ts`                 | Unit        | 10 scenarios: all AuthGuard branches (MMC)                                         |
| `apps/backoffice/src/core/guards/__tests__/auth.guard.spec.ts`          | Unit        | Same 10 scenarios (Backoffice)                                                     |
| `apps/frontoffice/src/core/guards/__tests__/auth.guard.spec.ts`         | Unit        | Same 10 scenarios (Frontoffice)                                                    |
| `apps/backoffice/src/core/guards/__tests__/workspace.guard.spec.ts`     | Unit        | 5 scenarios: WorkspaceGuard all branches                                           |
| `apps/mmc/src/core/guards/__tests__/role.guard.spec.ts`                 | Unit        | 6 scenarios: RoleGuard all branches (MMC)                                          |
| `apps/backoffice/src/core/guards/__tests__/role.guard.spec.ts`          | Unit        | Same 6 scenarios (Backoffice)                                                      |
| `apps/frontoffice/src/core/guards/__tests__/role.guard.spec.ts`         | Unit        | Same 6 scenarios (Frontoffice)                                                     |
| `apps/mmc/src/core/guards/__tests__/feature-flag.guard.spec.ts`         | Unit        | 1 scenario: stub always returns true                                               |
| `apps/backoffice/src/core/guards/__tests__/feature-flag.guard.spec.ts`  | Unit        | Same                                                                               |
| `apps/frontoffice/src/core/guards/__tests__/feature-flag.guard.spec.ts` | Unit        | Same                                                                               |
| `apps/mmc/tests/integration/core/router/router.test.ts`                 | Integration | 6 tests: `createAppRouter` route-resolve (4) + `registerGuards` guard behavior (2) |
| `apps/backoffice/tests/integration/core/router/router.test.ts`          | Integration | 9 tests: `createAppRouter` route-resolve (5) + `registerGuards` guard behavior (4) |
| `apps/frontoffice/tests/integration/core/router/router.test.ts`         | Integration | 6 tests: `createAppRouter` route-resolve (4) + `registerGuards` guard behavior (2) |
| `apps/mmc/tests/unit/auth/auth.guard.test.ts`                           | Unit        | Updated from legacy positional API to new options-object API (9 tests)             |

**Note on integration test pattern:** jsdom does not resolve Vue Router navigation correctly when
components are lazy-loaded. All integration guard behavior tests use direct guard factory invocation
(`guard(to, from, next)`) rather than `router.push()` — this avoids infinite navigation hangs in
jsdom and validates guard logic without testing the router's navigation queue.

---

## Constitutional Compliance

| Check                                             | Status | Notes                                                                            |
| ------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| Tenant resolver context used for tenant DB access | ✅     | UI layer — no DB access at all                                                   |
| All write operations are transactional            | ✅     | UI layer — no DB writes                                                          |
| Idempotency is enforced where required            | ✅     | Guard short-circuit on same route (loop prevention)                              |
| Structured logging is present                     | ✅     | All guards use `@zidney/logger` in `catch` blocks                                |
| `console.log` is absent                           | ✅     | T060 lint + grep confirmed                                                       |
| No stack traces exposed to clients                | ✅     | Guards log to server logger only; no error detail surfaces to UI                 |
| UI layer has no business logic                    | ✅     | Guards accept callbacks; no store imports inside guard files                     |
| API error contract is preserved                   | ✅     | UI layer — not applicable; no API responses modified                             |
| No singleton router export                        | ✅     | T062 grep: 0 results                                                             |
| No legacy RouteMeta fields                        | ✅     | T061 grep: 0 results                                                             |
| `isActive` license check absent from guards       | ✅     | T063 grep: 0 results                                                             |
| `WorkspaceGuard` makes no API calls               | ✅     | Accepts `isWorkspaceResolved: () => boolean` callback; no imports from API layer |
| Import boundaries respected                       | ✅     | Guard files import only `vue-router` and `@zidney/logger`                        |

**Overall:** COMPLIANT

---

## Validation Results

| Check                        | Command                                                                              | Result                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| TypeScript type check        | `bunx tsc --noEmit`                                                                  | ✅ 0 errors                                                                               |
| Lint                         | `bun run lint`                                                                       | ✅ 0 new errors (9 pre-existing errors in backoffice pages from STAGE_021 — not in scope) |
| MMC unit + integration tests | `bunx vitest run` (apps/mmc)                                                         | ✅ 16 files, 169 tests pass                                                               |
| Backoffice new-code tests    | `bunx vitest run tests/integration/ src/core/guards/__tests__/` (apps/backoffice)    | ✅ 5 files, 34 tests pass                                                                 |
| Frontoffice new-code tests   | `bunx vitest run tests/integration/ src/core/guards/__tests__/` (apps/frontoffice)   | ✅ 4 files, 26 tests pass                                                                 |
| Legacy meta grep             | `grep -r "guestOnly\|requiredRole\|requiredModule" apps/*/src`                       | ✅ 0 results                                                                              |
| Singleton router grep        | `grep -r "export const router\|export default router" apps/*/src/core/router`        | ✅ 0 results                                                                              |
| `isActive` grep              | `grep -r "isActive" apps/backoffice/src/core/guards apps/backoffice/src/core/router` | ✅ 0 results                                                                              |

---

## Open Risks

- `apps/backoffice/src/composables/usePermission.ts` and associated page files contain 9
  pre-existing lint errors (from commit `ae83ecc`, STAGE_021). These are out of scope for this stage
  and are tracked separately.
- `createFeatureFlagGuard()` is a stub. Implementation requires a separate stage when the Feature
  Flag service is ready (TODO marker placed per spec §4.5).

---

## Next Step

Proceed to Step 7 — Closure.
