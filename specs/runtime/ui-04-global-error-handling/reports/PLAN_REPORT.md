# PLAN REPORT — STAGE_UI_04_GLOBAL_ERROR_HANDLING

**Stage**: STAGE_UI_04_GLOBAL_ERROR_HANDLING  
**Step**: plan  
**Agent**: speckit.plan  
**Generated**: 2026-04-06  
**Risk Level**: MEDIUM  
**Verdict**: PASS

---

## Summary

Technical plan generated for the Global Error Boundary & Normalization Layer stage.
The plan covers all three Zidney frontend applications (MMC, Backoffice, Frontoffice) and
one shared package change (`packages/api-client`).

All 5 clarifications from the Clarify step are encoded as architecture decisions.
No implementation gaps, blocked prerequisites, or ADR conflicts detected.

---

## Architecture Decisions

| ID   | Decision                                                                                                                                           | Rationale Summary                                                                                                            |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| AD-1 | `error-normalizer.ts` remains per-app, using shared `isAppError`/`createAppError`/`mapHttpStatusToCode` from `@zidney/api-client`                  | Import boundary satisfied; per-app facades allow future divergence; shared primitives prevent logic drift                    |
| AD-2 | `onErrorCaptured` in `ErrorBoundary.vue`; `app.config.errorHandler` NOT used                                                                       | `onErrorCaptured` controls fallback rendering; `app.config.errorHandler` fires after render — cannot intercept blank screen  |
| AD-3 | Logger instantiated once in `main.ts` via `createLogger(appName)`, injected into handlers via options / `app.provide()`                            | Constitutional constraint: no `import.meta.env` inside error handler modules; `@zidney/logger` construction stays in main.ts |
| AD-4 | `redactError(error, isProduction: boolean)` — pure function; `isProduction` injected by caller; `import.meta.env.PROD` evaluated in `main.ts` only | Pure function for testability; env var access stays in app-setup code, not in error handler modules                          |

---

## File Change Matrix

### packages/api-client

| File                                    | Action | Notes                                           |
| --------------------------------------- | ------ | ----------------------------------------------- |
| `packages/api-client/src/http-error.ts` | MODIFY | Add 7 ErrorCodes + `mapHttpStatusToCode` helper |

### apps/mmc

| File                                                              | Action | Notes                                                                           |
| ----------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `apps/mmc/src/core/errors/types.ts`                               | DELETE | Local NormalizedError removed                                                   |
| `apps/mmc/src/core/errors/error-normalizer.ts`                    | MODIFY | Full replacement — AppError from @zidney/api-client; HTTP mapping; legacy guard |
| `apps/mmc/src/core/errors/ErrorBoundary.vue`                      | CREATE | Vue SFC; onErrorCaptured; fallback slot                                         |
| `apps/mmc/src/core/errors/global-error-handler.ts`                | CREATE | window event listeners; injected logger                                         |
| `apps/mmc/src/core/errors/redact-error.ts`                        | CREATE | Pure function; strips tokens/stacks                                             |
| `apps/mmc/src/App.vue`                                            | MODIFY | Wrap RouterView with ErrorBoundary                                              |
| `apps/mmc/src/main.ts`                                            | MODIFY | Step 8.5 insertion before mount                                                 |
| `apps/mmc/src/core/errors/__tests__/error-normalizer.spec.ts`     | CREATE | 16 cases; 100% coverage                                                         |
| `apps/mmc/src/core/errors/__tests__/redact-error.spec.ts`         | CREATE | 6 cases; 100% coverage                                                          |
| `apps/mmc/src/core/errors/__tests__/global-error-handler.spec.ts` | CREATE | 6 cases; ≥90% coverage                                                          |
| `apps/mmc/src/core/errors/__tests__/ErrorBoundary.spec.ts`        | CREATE | 7 cases; ≥80% branch coverage                                                   |

### apps/backoffice

| File                                                                     | Action | Notes                         |
| ------------------------------------------------------------------------ | ------ | ----------------------------- |
| `apps/backoffice/src/core/errors/types.ts`                               | DELETE | Local NormalizedError removed |
| `apps/backoffice/src/core/errors/error-normalizer.ts`                    | MODIFY | Same as MMC                   |
| `apps/backoffice/src/core/errors/ErrorBoundary.vue`                      | CREATE | Same as MMC                   |
| `apps/backoffice/src/core/errors/global-error-handler.ts`                | CREATE | Same as MMC                   |
| `apps/backoffice/src/core/errors/redact-error.ts`                        | CREATE | Same as MMC                   |
| `apps/backoffice/src/App.vue`                                            | MODIFY | Same as MMC                   |
| `apps/backoffice/src/main.ts`                                            | MODIFY | Same as MMC                   |
| `apps/backoffice/src/core/errors/__tests__/error-normalizer.spec.ts`     | CREATE | Same as MMC                   |
| `apps/backoffice/src/core/errors/__tests__/redact-error.spec.ts`         | CREATE | Same as MMC                   |
| `apps/backoffice/src/core/errors/__tests__/global-error-handler.spec.ts` | CREATE | Same as MMC                   |
| `apps/backoffice/src/core/errors/__tests__/ErrorBoundary.spec.ts`        | CREATE | Same as MMC                   |

### apps/frontoffice

| File                                                                      | Action | Notes                         |
| ------------------------------------------------------------------------- | ------ | ----------------------------- |
| `apps/frontoffice/src/core/errors/types.ts`                               | DELETE | Local NormalizedError removed |
| `apps/frontoffice/src/core/errors/error-normalizer.ts`                    | MODIFY | Same as MMC                   |
| `apps/frontoffice/src/core/errors/ErrorBoundary.vue`                      | CREATE | Same as MMC                   |
| `apps/frontoffice/src/core/errors/global-error-handler.ts`                | CREATE | Same as MMC                   |
| `apps/frontoffice/src/core/errors/redact-error.ts`                        | CREATE | Same as MMC                   |
| `apps/frontoffice/src/App.vue`                                            | MODIFY | Same as MMC                   |
| `apps/frontoffice/src/main.ts`                                            | MODIFY | Same as MMC                   |
| `apps/frontoffice/src/core/errors/__tests__/error-normalizer.spec.ts`     | CREATE | Same as MMC                   |
| `apps/frontoffice/src/core/errors/__tests__/redact-error.spec.ts`         | CREATE | Same as MMC                   |
| `apps/frontoffice/src/core/errors/__tests__/global-error-handler.spec.ts` | CREATE | Same as MMC                   |
| `apps/frontoffice/src/core/errors/__tests__/ErrorBoundary.spec.ts`        | CREATE | Same as MMC                   |

**Total**: 37 files (1 MODIFY in packages; 12 per app × 3 apps = 36)

---

## Risk Assessment

**Risk Level**: MEDIUM

| Risk                                        | Level  | Mitigation                                                  |
| ------------------------------------------- | ------ | ----------------------------------------------------------- |
| Incomplete legacy NormalizedError migration | MEDIUM | Migration guard in normalizer + CI grep                     |
| Double event listener registration on HMR   | MEDIUM | unregisterGlobalErrorHandlers() + module-level ref tracking |
| Per-app normalizer logic drift              | LOW    | Shared primitives in @zidney/api-client constrain deviation |
| Layout shift from ErrorBoundary wrapping    | LOW    | Transparent slot passthrough when no error                  |

---

## Constraints Compliance Check

| Constraint                                    | Status                                                              |
| --------------------------------------------- | ------------------------------------------------------------------- |
| No `import.meta.env` in error handler modules | ✅ COMPLIANT — env vars in main.ts only; `isProduction` injected    |
| No stack traces in production                 | ✅ COMPLIANT — `redactError(err, isProduction: true)` strips stacks |
| No business logic in normalizer               | ✅ COMPLIANT — HTTP code mapping only; no business state inference  |
| Pure functions for normalizer and redactor    | ✅ COMPLIANT — no side effects; no global state reads               |
| Vue 3 Composition API only                    | ✅ COMPLIANT — `onErrorCaptured`, `ref`, `inject` only              |
| All imports `apps/* → packages/*`             | ✅ COMPLIANT — no cross-app imports; no `packages/* → apps/*`       |
| AppError from `@zidney/api-client` only       | ✅ COMPLIANT — no local copies; local `types.ts` deleted            |
| Logger instantiated in main.ts                | ✅ COMPLIANT — AD-3; never constructed inside handler modules       |

---

## Validation Gates

```bash
bun run ai:guard && bun run arch:audit && bun run lint && bun run typecheck && bun run test
```

Additional CI check required:

```bash
grep -r 'NormalizedError' apps/ | wc -l  # must be 0 after implementation
```

---

## Next Step

**→ speckit.tasks** — Generate atomic, dependency-ordered `tasks.md` from this plan.
