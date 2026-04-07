# PR Summary — STAGE_UI_04_GLOBAL_ERROR_HANDLING

## Global Error Boundary & Normalization Layer

**Branch:** `spec/ui-04-global-error-handling` → `develop`  
**Phase:** 06_UI_APPLICATION_RUNTIME  
**Stage:** STAGE_UI_04_GLOBAL_ERROR_HANDLING  
**Tasks:** 32 / 32 completed  
**Tests:** 894 passing, 0 failures (105 files)

---

## What This PR Does

Introduces a unified, type-safe error handling system across the three frontend apps (MMC, Backoffice, Frontoffice) that:

1. **Replaces** the legacy `NormalizedError` / per-app `types.ts` approach with a single `AppError` type in `packages/api-client`
2. **Normalizes** all error shapes (API responses, network failures, TypeErrors, unknown values) into one consistent structure
3. **Redacts** sensitive credentials (Bearer tokens, passwords, secrets) before errors reach logs
4. **Catches** Vue render errors via `ErrorBoundary.vue` and displays a fallback UI instead of white-screening
5. **Catches** unhandled promise rejections and window errors via `global-error-handler.ts`
6. **Wires** the error boundary into `App.vue` in all three apps and registers `appLogger` / `isProduction` providers

---

## Key Changes

### `packages/api-client`

- **`http-error.ts`** — New: `AppError`, `ErrorCodes`, `createAppError`, `isAppError`, `mapHttpStatusToCode`, `normalizeError`, `normalizeResponseError`
- **`index.ts`** — Re-exports all error utilities (organizeImports fixed)

### All Three Apps (`apps/mmc`, `apps/backoffice`, `apps/frontoffice`)

| File                                      | Change                                              |
| ----------------------------------------- | --------------------------------------------------- |
| `src/core/errors/types.ts`                | **Deleted** — `NormalizedError` removed             |
| `src/core/errors/error-normalizer.ts`     | Updated to use `AppError` from `@zidney/api-client` |
| `src/core/errors/ErrorBoundary.vue`       | **New** — Vue SFC error boundary                    |
| `src/core/errors/redact-error.ts`         | **New** — Credential redaction utility              |
| `src/core/errors/global-error-handler.ts` | **New** — Window event listeners                    |
| `src/App.vue`                             | Updated — ErrorBoundary wraps root router-view      |
| `src/main.ts`                             | Updated — registers `appLogger` and `isProduction`  |

### Tests (12 new + 6 updated)

- `src/core/errors/__tests__/error-normalizer.spec.ts` (×3 apps) — **New**
- `src/core/errors/__tests__/redact-error.spec.ts` (×3 apps) — **New**
- `src/core/errors/__tests__/global-error-handler.spec.ts` (×3 apps) — **New**
- `src/core/errors/__tests__/ErrorBoundary.spec.ts` (×3 apps) — **New**
- `tests/unit/core/error-normalizer.test.ts` (×3 apps) — Updated for AppError shape
- `tests/integration/app-layout.integration.test.ts` (×3 apps) — Added `useRouter` mock

---

## Why These Changes

- **Single error type:** `AppError` from `packages/api-client` eliminates the per-app `NormalizedError` duplication and divergence
- **Comprehensive normalization:** `normalizeError()` handles every real-world error shape (server errors, network failures, legacy responses, unknown values) without throwing
- **Security:** `redactError()` ensures credentials never surface in logs or error UIs
- **Resilience:** `ErrorBoundary.vue` prevents white-screen-of-death on any Vue render error
- **Observability:** `global-error-handler.ts` ensures no unhandled error is silently swallowed

---

## Architecture Compliance

- ✅ Import boundaries: `apps/* → packages/*` only — verified by AI Guard (1830/1830)
- ✅ Architecture score: 100/100 — zero violations
- ✅ Governance gate: 8/8 guards passed
- ✅ No DB imports / no env vars in UI error modules
- ✅ Logger injected via `app.provide` (not direct import from UI)

---

## Testing

```bash
# Full test suite
npx vitest run --project=mmc --project=backoffice --project=frontoffice
# Expected: 105 files, 894 tests, 0 failures

# Lint
npx biome check apps/ packages/
# Expected: Checked 1973 files, 0 errors

# Type check
bun run typecheck
# Expected: No errors
```

See `specs/runtime/ui-04-global-error-handling/guides/TESTING_GUIDE.md` for manual test scenarios.

---

## Reviewers

- [ ] Verify `AppError` shape in `packages/api-client/src/http-error.ts`
- [ ] Verify `ErrorBoundary.vue` fallback slot renders correctly
- [ ] Verify `biome-ignore` suppressions are justified (template bindings)
- [ ] Verify legacy tests updated correctly (no `NormalizedError` references remain)
- [ ] Verify `main.ts` providers registered in all 3 apps
