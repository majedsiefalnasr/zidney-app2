# Plan Report — STAGE_UI_06_STATE_MANAGEMENT

**Step:** 3 — Plan **Timestamp:** 2026-03-03T00:00:00.000Z **Status:** COMPLETE

---

## Summary

Comprehensive technical implementation plan produced for the UI State Management Architecture stage.
The plan covers all three Zidney frontend apps (MMC, Backoffice, Frontoffice), defining 27
implementation tasks across 5 phases (A: Infrastructure, B: MMC, C: Backoffice, D: Frontoffice, E:
Validation). The plan was reviewed by two guardians (Architecture Checker + API Designer). Initial
API Designer BLOCKED verdict required remediation of 2 HIGH and 3 MEDIUM findings. All 5 findings
were resolved; both guardians returned VERDICT: PASS on re-review.

**Plan artifacts:**

- `plan.md` — 27 tasks, 5 phases, Design Contracts section, File Inventory, Success Criteria mapping
- `data-model.md` — TypeScript interfaces for 13 core stores across 3 apps
- `research.md` — 13 research decisions resolving all unknowns

---

## Inputs Reviewed

- `specs/runtime/ui-06-state-management/spec.md`
- `specs/runtime/ui-06-state-management/plan.md`
- `specs/runtime/ui-06-state-management/research.md`
- `specs/runtime/ui-06-state-management/data-model.md`

---

## Architecture Layers Touched

| Layer                  | Planned Changes                                                      |
| ---------------------- | -------------------------------------------------------------------- |
| API                    | None — UI only stage                                                 |
| Worker                 | None                                                                 |
| Frontend (MMC)         | 4 new core stores + id rename on auth.store + main.ts + unit tests   |
| Frontend (Backoffice)  | 5 new core stores (incl. workspace.store) + main.ts + unit tests     |
| Frontend (Frontoffice) | 4 new core stores + main.ts + unit tests                             |
| DB Master              | None                                                                 |
| DB Tenant              | None                                                                 |
| Packages               | No new packages; pinia-plugin-persistedstate added as app dependency |
| Shared Config          | eslint.config.mjs — `no-restricted-imports` rule for .vue files      |

---

## Key Technical Decisions

| #   | Decision                                                                       | Rationale                                                                                                                                    |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | All stores use `import { AppError } from '@zidney/types'` (value import)       | Allows `instanceof` type narrowing in catch blocks; `import type` is erased at runtime                                                       |
| 2   | Auth stores expose `authError: AppError                                        | null` at public boundary                                                                                                                     | Cross-store type safety; components can read `store.authError` uniformly regardless of auth subtype |
| 3   | Concurrent call guard: early-return pattern (`if (pending.value[key]) return`) | Default guard for all async actions to prevent race conditions on simultaneous calls                                                         |
| 4   | workspace.store stub: `await Promise.resolve()` (no-op, no throw)              | Allows lifecycle tests to pass cleanly before workspace API module is available                                                              |
| 5   | `AppNotification` defined locally in each app's notification.store.ts          | Moving to packages/types deferred; all three apps must keep shape identical                                                                  |
| 6   | `pinia-plugin-persistedstate ^4.x` — `pick` API (not `paths`)                  | v4 changed the persistedstate config key; using `pick` is the correct v4 API                                                                 |
| 7   | `isLoading` as computed from `pending` (L-01 recommendation)                   | `workspace.store.ts` uses `isLoading.value = Object.values(pending.value).some(Boolean)` in `finally` — self-consistent with the pending map |
| 8   | ESLint glob `apps/**/*.vue` for `no-restricted-imports`                        | Restricts direct API client imports to app-level .vue files only; preserves legitimate access in packages                                    |

---

## Migration Impact

| Item                  | Value | Notes                               |
| --------------------- | ----- | ----------------------------------- |
| Migration required    | No    | UI-only stage; no DB schema changes |
| `schema_version` bump | No    | N/A                                 |
| Backward compatible   | N/A   | No backend changes                  |

---

## Transaction Boundaries

- N/A — UI layer has no database transactions
- Store actions are idempotent by design (error reset + concurrent guard)
- `loadWorkspace` uses early-return guard as serialization mechanism

---

## File Inventory Summary

### New Files — 21 total

| App         | File                                                    | Purpose                           |
| ----------- | ------------------------------------------------------- | --------------------------------- |
| Shared      | `tests/unit/store-test-helper.ts`                       | Isolated Pinia test setup utility |
| MMC         | `apps/mmc/src/core/state/app.store.ts`                  | Global app layout state           |
| MMC         | `apps/mmc/src/core/state/ui.store.ts`                   | Transient overlay/modal state     |
| MMC         | `apps/mmc/src/core/state/notification.store.ts`         | Notification queue                |
| Backoffice  | `apps/backoffice/src/core/state/app.store.ts`           | Global app layout state           |
| Backoffice  | `apps/backoffice/src/core/state/ui.store.ts`            | Transient overlay/modal state     |
| Backoffice  | `apps/backoffice/src/core/state/notification.store.ts`  | Notification queue                |
| Backoffice  | `apps/backoffice/src/core/state/workspace.store.ts`     | Workspace context (stub)          |
| Frontoffice | `apps/frontoffice/src/core/state/app.store.ts`          | Global app layout state           |
| Frontoffice | `apps/frontoffice/src/core/state/ui.store.ts`           | Transient overlay/modal state     |
| Frontoffice | `apps/frontoffice/src/core/state/notification.store.ts` | Notification queue                |
| All tests   | Per-app unit test files (Tasks 21–25)                   | Store unit tests                  |

### Modified Files — 13 total

| File                                            | Change                                        |
| ----------------------------------------------- | --------------------------------------------- |
| `apps/mmc/src/main.ts`                          | Add Pinia + persistedstate initialization     |
| `apps/mmc/src/core/state/auth.store.ts`         | Rename id `'auth'` → `'mmc-auth'`             |
| `apps/mmc/src/core/state/index.ts`              | Re-export all stores + AppNotification type   |
| `apps/backoffice/src/main.ts`                   | Add Pinia + persistedstate initialization     |
| `apps/backoffice/src/core/state/auth.store.ts`  | Replace with factory pattern                  |
| `apps/backoffice/src/core/state/index.ts`       | Re-export all stores                          |
| `apps/frontoffice/src/main.ts`                  | Add Pinia + persistedstate initialization     |
| `apps/frontoffice/src/core/state/auth.store.ts` | Replace with factory pattern                  |
| `apps/frontoffice/src/core/state/index.ts`      | Re-export all stores                          |
| `eslint.config.mjs`                             | Add no-restricted-imports rule for .vue files |
| `package.json` (×3)                             | Add pinia-plugin-persistedstate ^4.x          |

---

## Constitutional Compliance

| Check                            | Status | Notes                                                                     |
| -------------------------------- | ------ | ------------------------------------------------------------------------- | -------------------------------------------------- | ----- |
| Multi-tenant isolation preserved | ✅     | Workspace store reads from API; no hardcoded slugs                        |
| No cross-app imports             | ✅     | Each app has its own Pinia instance; no cross-app store references        |
| License middleware not bypassed  | ✅ N/A | UI stores do not enforce license limits (FR-011)                          |
| No business logic in stores      | ✅     | FR-011 enforced; stores are UI state orchestrators only                   |
| JWT not in localStorage          | ✅     | Token in ITokenManager (memory); auth persistence matrix explicitly NEVER |
| Idempotency enforced             | ✅     | Concurrent call guard + error auto-reset at each action start             |
| Server-authoritative time        | ✅ N/A | No time computation in UI stores                                          |
| AppError as error contract       | ✅     | All async stores use `error: AppError                                     | null`; all auth stores expose `authError: AppError | null` |
| Structured logging               | ✅     | @zidney/logger referenced; no console.log                                 |
| Testing required                 | ✅     | Tasks 21–27 cover all stores with unit + integration tests                |

**Overall:** COMPLIANT — Both guardians returned VERDICT: PASS. Task generation authorized.

---

## Guardian Verdicts

| Guardian                    | Initial Verdict       | Re-review Verdict         | Notes                                                  |
| --------------------------- | --------------------- | ------------------------- | ------------------------------------------------------ |
| Zidney Architecture Checker | PASS (1 High finding) | PASS (confirmed resolved) | High: import type AppError → instanceof; resolved      |
| Zidney API Designer         | BLOCKED (2H + 3M)     | PASS (all resolved)       | H-01 auth error fields; H-02 dynamic import; M-01–M-03 |

---

## Open Risks

| Risk                                                                    | Status    | Mitigation                                                                   |
| ----------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------- |
| `AppNotification` locally defined in 3 apps                             | Accepted  | All three must stay identical; tracked as deferred to packages/types cleanup |
| workspace.store is a stub                                               | Accepted  | Structural contract complete; implementation blocked on workspace API module |
| pinia-plugin-persistedstate v4.x API (`pick`) differs from v3 (`paths`) | Mitigated | plan.md uses `pick` (v4 API); confirmed in research.md R-003                 |
