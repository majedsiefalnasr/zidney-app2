# Plan Report — STAGE_UI_03_ROUTER_AND_GUARDS

**Step:** 3 — Plan **Timestamp:** 2026-03-02T00:00:00.000Z **Status:** COMPLETE

---

## Summary

Technical implementation plan is complete for the canonical routing system and guard pipeline across
MMC, Backoffice, and Frontoffice. The plan covers 15 new files (5 per app), 14 modifications, 4
deletions, and 3 renames. Architecture Guardian validation returned PASS with one medium finding
(corrected inline: `registerGuards` `router.onError` redirect must use `errorRouteName`, not
`unauthorizedRouteName` — fixed in plan before tasks generation).

---

## Inputs Reviewed

- `specs/runtime/ui-03-router-and-guards/spec.md`
- `specs/runtime/ui-03-router-and-guards/plan.md`
- Existing `apps/mmc/src/core/router/` and `apps/mmc/src/core/router/guards/` structure
- Existing `apps/backoffice/src/router/` structure (STAGE_17 inline license guard confirmed)
- Existing `apps/frontoffice/src/core/router/` and guard structures

---

## Architecture Layers Touched

| Layer                  | Planned Changes                                   |
| ---------------------- | ------------------------------------------------- |
| API                    | None                                              |
| Worker                 | None                                              |
| Frontend (MMC)         | 5 creates, 6 modifications, 1 deletion, 1 rename  |
| Frontend (Backoffice)  | 5 creates, 4 modifications, 2 deletions, 1 rename |
| Frontend (Frontoffice) | 5 creates, 4 modifications, 1 deletion, 1 rename  |
| DB Master              | None                                              |
| DB Tenant              | None                                              |

---

## Key Technical Decisions

| #   | Decision                                                           | Rationale                                                                                   |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 1   | `registerGuards()` barrel pattern for each app                     | Encapsulates guard pipeline order and `router.onError` handler; reduces main.ts complexity  |
| 2   | Guards accept callbacks, not direct store imports                  | Enables isolated unit testing without router/store coupling                                 |
| 3   | `createAppRouter(history?: RouterHistory)` factory                 | Allows test injection of `createMemoryHistory()` per CL-04                                  |
| 4   | Singleton router export removed from all 3 apps                    | Only `main.ts` calls `createAppRouter()`; prevents accidental double-instantiation          |
| 5   | `contextStore.loadContext()` moved to `main.ts` bootstrap          | Guards must not call APIs (constitutional constraint)                                       |
| 6   | WorkspaceGuard checks `contextStore.context !== null`              | Checks workspace **presence** only; avoids license/subscription check                       |
| 7   | FeatureFlagGuard is always-pass stub                               | Reserves pipeline position 4; harmless until future implementation                          |
| 8   | `router.onError()` redirects to `errorRouteName` (GlobalErrorView) | CL-01 resolution; import/chunk-load failures route to GlobalErrorView, not UnauthorizedView |

---

## Migration Impact

| Item                  | Value                      | Notes                                                            |
| --------------------- | -------------------------- | ---------------------------------------------------------------- |
| Migration required    | No                         | Frontend-only; no DB changes                                     |
| `schema_version` bump | No                         | N/A                                                              |
| Backward compatible   | Breaking (TypeScript only) | RouteMeta field renames caught at compile time by `tsc --noEmit` |

---

## Transaction Boundaries

- N/A — frontend-only stage; no write operations or DB transactions.

---

## Idempotency Strategy

- N/A — navigation guards are pure synchronous/async functions with no side effects that require
  idempotency.

---

## Guardian Validation Results

| Guardian                    | Verdict | Notes                                                                     |
| --------------------------- | ------- | ------------------------------------------------------------------------- |
| Zidney Architecture Checker | ✅ PASS | One medium finding (errorRouteName in registerGuards) — corrected in plan |
| Zidney API Designer         | ✅ N/A  | No API contracts modified in this stage                                   |

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                       |
| -------------------------------------- | ------ | ----------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | Frontend-only; no DB access                                 |
| All writes are transactional by design | ✅     | N/A — no write operations                                   |
| Server-authoritative time enforced     | ✅     | N/A for this stage                                          |
| License middleware enforced            | ✅     | Guards explicitly MUST NOT check license state              |
| Version compatibility enforced         | ✅     | N/A for this stage                                          |
| No architecture redesign without ADR   | ✅     | No new ADR required — plan aligns with STAGE_UI_01 patterns |
| No JWT decoding in guards              | ✅     | Guards read injected callbacks only                         |
| No API calls in guards                 | ✅     | contextStore.loadContext() relocated to main.ts bootstrap   |

**Overall:** COMPLIANT
