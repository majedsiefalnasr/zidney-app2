# Technical Plan: Global Error Boundary & Normalization Layer

**Stage**: STAGE_UI_04_GLOBAL_ERROR_HANDLING  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Plan Date**: 2026-04-06  
**Status**: READY FOR IMPLEMENTATION  
**Risk Level**: MEDIUM  
**Spec Ref**: `specs/runtime/ui-04-global-error-handling/spec.md`

---

## Overview

This plan delivers the canonical error handling infrastructure across all three Zidney frontend
applications: **MMC**, **Backoffice**, and **Frontoffice**. It upgrades the existing per-app
`NormalizedError` drift pattern to a unified `AppError` contract sourced from
`@zidney/api-client`, adds Vue 3 error boundary components, registers global window event
handlers, and enforces production-safe redaction.

**Deliverables:**

1. `packages/api-client/src/http-error.ts` — 7 new `ErrorCodes` entries (HTTP-status codes)
2. Per-app (×3): replacement `error-normalizer.ts`, new `ErrorBoundary.vue`,
   new `global-error-handler.ts`, new `redact-error.ts`
3. Per-app (×3): deletion of local `types.ts` (`NormalizedError`)
4. Per-app (×3): `App.vue` wrapped with `<ErrorBoundary>`, `main.ts` with Step 8.5 hook
5. Per-app (×3): unit test suites for all four new/replaced error modules

---

## Current State

### Canonical Type — Already Correct

`packages/api-client/src/types.ts` exports the authoritative `AppError` interface:

```ts
export interface AppError {
  readonly code: string;
  readonly message: string;
  readonly httpStatus: number;
  readonly isNetworkError: boolean;
  readonly retryAfter?: number;
}
```

`packages/api-client/src/http-error.ts` exports:

- `isAppError(error: unknown): error is AppError` — type guard
- `createAppError(fields): AppError` — frozen factory
- `normalizeResponseError(response: AdapterResponse): AppError` — handles 429 + structured body

**No changes needed to `AppError` itself.** All existing usage is correct.

### Existing ErrorCodes (packages/api-client/src/http-error.ts)

```ts
export const ErrorCodes = {
  NETWORK_ERROR,
  REQUEST_TIMEOUT,
  REQUEST_CANCELLED,
  RATE_LIMITED,
  AUTH_REFRESH_FAILED,
  INVALID_RESPONSE,
  UNKNOWN_ERROR,
} as const;
```

**Missing**: `VALIDATION_ERROR`, `PERMISSION_DENIED`, `NOT_FOUND`, `CONFLICT`,
`LOCKED`, `UPGRADE_REQUIRED`, `SERVER_ERROR` — required for HTTP-status mapping in normalizers.

### Per-App Error State (MMC, Backoffice, Frontoffice — identical)

| File                                  | Current State                                                      | Gap                                                               |
| ------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `core/errors/types.ts`                | Exports `NormalizedError { code, message, httpStatus }`            | Missing `isNetworkError`, `retryAfter`; local copy, not canonical |
| `core/errors/error-normalizer.ts`     | Returns `NormalizedError`; duck-typed passthrough; no HTTP mapping | Does not set `isNetworkError`; no status-to-code mapping          |
| `core/errors/ErrorBoundary.vue`       | **Does not exist**                                                 | Render crashes → blank screen                                     |
| `core/errors/global-error-handler.ts` | **Does not exist**                                                 | Async rejections → silent                                         |
| `core/errors/redact-error.ts`         | **Does not exist**                                                 | No production token/stack redaction                               |

### main.ts Bootstrap (all 3 apps)

Current: 9-step CL-01 sequence (Pinia → … → registerGuards → mount).  
Required: Insert Step 8.5 (`registerGlobalErrorHandlers`) between Step 8 and Step 9.  
Logger instance exists: `@zidney/logger` is already imported and compatible with browser builds.

---

## Architecture Decisions

### AD-1: error-normalizer Location — Per-App Facade over Shared Primitives

**Decision**: `error-normalizer.ts` remains per-app (one in each `apps/*/src/core/errors/`).  
It is **not** promoted to a shared package.

**Rationale**:

- `packages/api-client/src/http-error.ts` already exports `isAppError`, `createAppError`, and
  `normalizeResponseError` — these are the shared primitives. Per-app normalizers compose them.
- Import boundary rule `apps/* → packages/*` is satisfied; a new shared package would create
  a `packages/* → packages/*` chain with no benefit.
- Per-app normalizers serve as integration façades: they add the legacy `NormalizedError`
  migration guard (Clarification Q5) and future app-specific fallback messages.
- If logic becomes copy-paste drift across all three apps, promote to `packages/api-client`
  in a future refactor stage — not in this stage.

**Implementation contract**: Each normalizer imports `isAppError`, `createAppError` from
`@zidney/api-client` and delegates to `normalizeResponseError` for structured responses.

---

### AD-2: Vue 3 Error Boundary API — `onErrorCaptured` in Component, Not `app.config.errorHandler`

**Decision**: `ErrorBoundary.vue` uses Vue 3's `onErrorCaptured` composable hook.
`app.config.errorHandler` is **not** used for the boundary.

**Rationale**:

- `onErrorCaptured` fires in-tree and allows the boundary component to control whether it
  **renders a fallback slot** — the primary UX requirement (AC4.3). `app.config.errorHandler`
  fires after the tree has already processed the error and does not intercept rendering.
- `app.config.errorHandler` is a global handler that fires for **all** errors, including
  those already handled by `onErrorCaptured`. Using both would double-log errors.
- The separation of concerns is cleaner: `ErrorBoundary.vue` handles **component-tree render
  errors** via `onErrorCaptured`; `global-error-handler.ts` handles **window-level events**
  (unhandledrejection, error).

**Component contract**:

```
onErrorCaptured((err, _instance, _info) => {
  currentError.value = normalizeError(err)
  hasError.value = true
  logger?.error('render error captured', { code: currentError.value.code })
  return false  // stop propagation — boundary has handled it
})
```

---

### AD-3: Logger Injection Pattern — Instance Created in `main.ts`, Injected via Options

**Decision**: `createLogger(appName)` is called **once in `main.ts`** and the resulting `Logger`
instance is injected into both `registerGlobalErrorHandlers({ logger })` and provided to
`ErrorBoundary.vue` via Vue's `provide/inject` pattern (or prop).

**Rationale**:

- Constitutional constraint: no `import.meta.env` inside error handler modules
  (Clarification Q2). `@zidney/logger` reads `LOG_LEVEL`/`LOG_FORMAT` at construction time —
  not inside the error handler modules themselves.
- `global-error-handler.ts` accepts `logger?: Logger` in its options interface; it never
  calls `createLogger()` directly.
- `redact-error.ts` does not receive the logger — it is a pure function with no I/O.
- `ErrorBoundary.vue` receives the logger via `inject('appLogger')` (provided by `main.ts`
  before `app.mount()`), or via an optional prop with a default no-op logger.

**Type source**: `Logger` from `@zidney/logger`.

---

### AD-4: `redact-error.ts` Production Guard Mechanism — Pure Function with `isProduction` Parameter

**Decision**: `redactError` signature is:

```ts
export function redactError(error: AppError, isProduction: boolean): AppError;
```

The `isProduction` boolean is evaluated once in `main.ts` as `import.meta.env.PROD` and passed
to the wiring that calls `redactError`. The `redact-error.ts` module itself **never reads
`import.meta.env`**.

**Rationale**:

- Satisfies "pure function" requirement (AC10.4): no global state reads inside the function.
- Satisfies constitutional constraint: `import.meta.env` stays in `main.ts`/app-setup modules.
- Makes `redactError` deterministically testable: pass `isProduction: true` or `false` in tests
  without mocking build-time globals.
- `import.meta.env.PROD` is a Vite constant folded at build time — reading it in `main.ts`
  is architecturally correct (app setup code, not an error handler module).

**Caller pattern (main.ts)**:

```ts
const IS_PROD = import.meta.env.PROD;
registerGlobalErrorHandlers({
  onError: (err) => {
    /* use redactError(err, IS_PROD) before logging */
  },
  logger,
});
```

---

## Implementation Phases

### Phase 1 — Shared Package: Extend ErrorCodes (packages/api-client)

**Scope**: One file change. No interface changes. Backward-compatible.

**Task 1.1** — Extend `packages/api-client/src/http-error.ts` and update `packages/api-client/src/index.ts`

Add 7 new entries to `ErrorCodes` const:

```ts
VALIDATION_ERROR: 'VALIDATION_ERROR',
PERMISSION_DENIED: 'PERMISSION_DENIED',
NOT_FOUND: 'NOT_FOUND',
CONFLICT: 'CONFLICT',
LOCKED: 'LOCKED',
UPGRADE_REQUIRED: 'UPGRADE_REQUIRED',
SERVER_ERROR: 'SERVER_ERROR',
```

Also add HTTP-status-to-code mapping helper for use by per-app normalizers:

```ts
export function mapHttpStatusToCode(status: number): string;
```

Mapping table:
| HTTP Status | ErrorCode |
|-------------|-----------|
| 400 | `VALIDATION_ERROR` |
| 401 | _(handled by API client interceptor — not mapped here)_ |
| 403 | `PERMISSION_DENIED` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 423 | `LOCKED` |
| 426 | `UPGRADE_REQUIRED` |
| 429 | `RATE_LIMITED` _(already handled in normalizeResponseError)_ |
| 500+ | `SERVER_ERROR` |
| default | `UNKNOWN_ERROR` |

Also update `packages/api-client/src/index.ts` to export the two new public helpers:

```ts
// Before (line 10):
export { createAppError, ErrorCodes, isAppError } from "./http-error";

// After:
export {
  createAppError,
  ErrorCodes,
  isAppError,
  mapHttpStatusToCode,
  normalizeResponseError,
} from "./http-error";
```

Without this change, per-app normalizers (`import { mapHttpStatusToCode } from '@zidney/api-client'`) will fail at typecheck.

**Acceptance gate**: `bun run typecheck` passes; existing `@zidney/api-client` tests pass.

---

### Phase 2 — Per-App Error Infrastructure (MMC, Backoffice, Frontoffice — Parallel)

Each app receives identical structural changes. Apps may be implemented in parallel by separate
implementer instances. Each sub-task below applies to all three apps (suffix `[app]`).

---

#### Task 2.1 — Delete `core/errors/types.ts` [app]

Remove the local `NormalizedError` and `ApiErrorResponse` interfaces from each app. All consumers
in the app must be updated to import `AppError` from `@zidney/api-client` instead.

**Pre-condition**: `error-normalizer.ts` replacement (Task 2.2) must exist before deletion to
avoid broken imports. Delete file AFTER normalizer is replaced in the same commit.

---

#### Task 2.2 — Replace `core/errors/error-normalizer.ts` [app]

Full replacement. New contract:

```ts
import { isAppError, createAppError, mapHttpStatusToCode } from "@zidney/api-client";
import type { AppError } from "@zidney/api-client";

export function normalizeError(raw: unknown): AppError;
```

Normalization priority chain (evaluated top-to-bottom, first match wins):

1. **TypeError** → `{ code: 'NETWORK_ERROR', isNetworkError: true, httpStatus: 0 }`
2. **isAppError(raw)** → return `raw` as-is (already normalized)
3. **Legacy NormalizedError** — structural guard for `{ code: string, httpStatus: number }`
   without `isNetworkError` → reconstruct as `AppError` with `isNetworkError: false`
   _(migration safety net per Clarification Q5)_
4. **Structured API body** — `{ success: false, error: { code, message } }` → use backend code,
   map httpStatus via `mapHttpStatusToCode`
5. **AdapterResponse with known status** → delegate to `normalizeResponseError` from
   `@zidney/api-client`
6. **Fallback** → `{ code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred',
httpStatus: -1, isNetworkError: false }`

**Constraint**: Pure function, no side effects, never returns `undefined`/`null`.

---

#### Task 2.3 — Create `core/errors/ErrorBoundary.vue` [app]

Vue 3 SFC. Uses `onErrorCaptured` hook.

```
Props: { logger?: Logger }
Slots: default (normal render), fallback (error state — receives { error: AppError, reset: () })
State: hasError: Ref<boolean>, currentError: Ref<AppError | null>
```

Behavior:

- Renders `<slot />` when `hasError === false`
- Renders `<slot name="fallback" :error="currentError" :reset="resetError" />` when `hasError === true`
- Default fallback UI: "Something went wrong" heading, error code display, "Go to Home" link,
  "Try again" button (calls `resetError`)
- **Stack trace**: NEVER rendered (even in dev — stack is logged not displayed)
- `onErrorCaptured` calls `normalizeError`, then `redactError` with `isProduction` injected,
  then `logger?.error(...)`, then sets `hasError = true`, returns `false` to stop propagation

**Inject**: `const logger = inject<Logger>('appLogger', noopLogger)`  
**Inject**: `const isProduction = inject<boolean>('isProduction', false)` — provided in `main.ts` as `app.provide('isProduction', import.meta.env.PROD)` before `app.mount()`  
**Import boundary**: Only imports from `@zidney/api-client`, `@zidney/logger`, vue, local
`error-normalizer.ts`, `redact-error.ts`.

---

#### Task 2.4 — Create `core/errors/global-error-handler.ts` [app]

Pure module (no default class). Exports:

```ts
export interface GlobalErrorHandlerOptions {
  onError: (error: AppError) => void;
  logger?: Logger;
  isProduction?: boolean;
}

export function registerGlobalErrorHandlers(options: GlobalErrorHandlerOptions): void;
export function unregisterGlobalErrorHandlers(): void;
```

Implementation:

- Stores handler references in module-level variables for deregistration
- `window.addEventListener('unhandledrejection', handler)` — normalizes `event.reason`
- `window.addEventListener('error', handler)` — normalizes `event.error ?? event.message`
- Each handler: normalize → redact (if `isProduction`) → `options.onError(error)` →
  `options.logger?.error(...)` → does NOT call `event.preventDefault()` (AC5.5)
- Handlers registered **before** `app.mount()`; deregistration available for cleanup

---

#### Task 2.5 — Create `core/errors/redact-error.ts` [app]

Pure function module.

```ts
export function redactError(error: AppError, isProduction: boolean): AppError;
```

Rules:

- Returns a **new frozen** `AppError` object (never mutates input)
- Strips Bearer/token patterns from `message` (regex: `/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g`)
- Strips any substring matching credential patterns (`password=`, `token=`, `secret=`)
- In production (`isProduction === true`): removes stack trace frames embedded in `message`
  (pattern: `\s+at\s+[^\n]+` multiline)
- In development: preserves all content (no stripping of dev-useful context from message)
- Returns `Object.freeze({ ...redacted })`

---

#### Task 2.6 — Modify `App.vue` [app]

Wrap `<RouterView />` inside `<ErrorBoundary>` in the root template:

```vue
<template>
  <ErrorBoundary>
    <RouterView />
  </ErrorBoundary>
</template>
```

Import `ErrorBoundary` from `@/core/errors/ErrorBoundary.vue`.

---

#### Task 2.7 — Modify `main.ts` [app]

Insert **Step 8.5** between `registerGuards` (Step 8) and `app.mount` (Step 9):

```ts
// ── Step 8.5: Register global error handlers ───────────────────────────
import { registerGlobalErrorHandlers } from "@/core/errors/global-error-handler";

const appLogger = createLogger("[app-name]"); // defined once in main.ts
app.provide("appLogger", appLogger);

const IS_PROD = import.meta.env.PROD;
app.provide("isProduction", IS_PROD); // consumed by ErrorBoundary.vue

registerGlobalErrorHandlers({
  onError: (err) => {
    appLogger.error("unhandled error", { code: err.code, httpStatus: err.httpStatus });
    // toast integration wired in separate consumer task (out of scope)
  },
  logger: appLogger,
  isProduction: IS_PROD,
});
```

Update bootstrap step comment block to reflect Step 8.5 addition.

---

### Phase 3 — Test Coverage (per app)

Each app must deliver unit tests for all four error modules. Tests are colocated at
`core/errors/__tests__/`.

#### Task 3.1 — `error-normalizer.spec.ts` [app]

Required test cases (100% statement coverage target):

| Case                                       | Input                                                                     | Expected Output                                 |
| ------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------- |
| TypeError (network)                        | `new TypeError('Failed to fetch')`                                        | `isNetworkError: true`, `code: 'NETWORK_ERROR'` |
| Pre-normalized AppError pass-through       | Valid `AppError` object                                                   | returned as-is                                  |
| Legacy NormalizedError (no isNetworkError) | `{ code: 'X', message: 'y', httpStatus: 403 }`                            | `AppError` with `isNetworkError: false`         |
| Structured API body                        | `{ success: false, error: { code: 'VALIDATION_ERROR', message: '...' } }` | backend code preserved                          |
| HTTP 400                                   | Response with status 400                                                  | `code: 'VALIDATION_ERROR'`                      |
| HTTP 403                                   | Response with status 403                                                  | `code: 'PERMISSION_DENIED'`                     |
| HTTP 404                                   | Response with status 404                                                  | `code: 'NOT_FOUND'`                             |
| HTTP 409                                   | Response with status 409                                                  | `code: 'CONFLICT'`                              |
| HTTP 423                                   | Response with status 423                                                  | `code: 'LOCKED'`                                |
| HTTP 426                                   | Response with status 426                                                  | `code: 'UPGRADE_REQUIRED'`                      |
| HTTP 429 + Retry-After                     | Response with status 429, header present                                  | `retryAfter` populated                          |
| HTTP 429 no header                         | Response with status 429, no header                                       | `retryAfter: undefined`                         |
| HTTP 500                                   | Response with status 500                                                  | `code: 'SERVER_ERROR'`                          |
| Unknown shape                              | Plain string                                                              | `code: 'UNKNOWN_ERROR'`                         |
| Null input                                 | `null`                                                                    | `code: 'UNKNOWN_ERROR'`                         |
| Backend code override                      | HTTP 500 with `error.code: 'CUSTOM_CODE'`                                 | `code: 'CUSTOM_CODE'` (AC7.8)                   |

#### Task 3.2 — `redact-error.spec.ts` [app]

Required test cases (100% statement coverage target):

| Case                             | `isProduction` | Expectation                        |
| -------------------------------- | -------------- | ---------------------------------- |
| Token in message stripped        | `true`         | Bearer token not present in output |
| Token in message stripped        | `false`        | Bearer token not present in output |
| Stack trace in message stripped  | `true`         | `at ` frames removed               |
| Stack trace in message preserved | `false`        | `at ` frames kept                  |
| Input not mutated                | either         | original object unchanged          |
| Returns frozen object            | either         | `Object.isFrozen(result) === true` |

#### Task 3.3 — `global-error-handler.spec.ts` [app]

Required test cases (≥90% statement coverage target):

| Case                                                              | Expectation                               |
| ----------------------------------------------------------------- | ----------------------------------------- |
| `unhandledrejection` event fires; `onError` called                | normalized `AppError` passed to `onError` |
| `error` event fires; `onError` called                             | normalized `AppError` passed to `onError` |
| Logger receives error if provided                                 | `logger.error` called once per event      |
| Event NOT prevented (propagates)                                  | `event.preventDefault` not called         |
| `unregisterGlobalErrorHandlers` removes listeners                 | subsequent events do not call `onError`   |
| Handler exported independently — callable without `window` events | `onError` fires directly                  |

#### Task 3.4 — `ErrorBoundary.spec.ts` [app]

Required test cases (≥80% branch coverage target):

| Case                                         | Expectation                                 |
| -------------------------------------------- | ------------------------------------------- |
| Renders `<slot>` when no error               | default slot content visible                |
| Captures render error; renders fallback      | fallback slot rendered, default slot hidden |
| Fallback has "Go to Home" link               | link present                                |
| Fallback "Try again" resets boundary         | default slot re-renders                     |
| Stack trace NOT in fallback in prod          | no `at ` stack frames in fallback DOM       |
| Logger called once on error capture          | `logger.error` mock called                  |
| Custom fallback slot renders with error prop | custom slot receives `AppError`             |

---

## File Change Matrix

| File                                                                      | Action | App / Package       | Notes                                                      |
| ------------------------------------------------------------------------- | ------ | ------------------- | ---------------------------------------------------------- |
| `packages/api-client/src/http-error.ts`                                   | MODIFY | packages/api-client | Add 7 ErrorCodes + `mapHttpStatusToCode` helper            |
| `packages/api-client/src/index.ts`                                        | MODIFY | packages/api-client | Export `mapHttpStatusToCode`, `normalizeResponseError`     |
| `apps/mmc/src/core/errors/types.ts`                                       | DELETE | apps/mmc            | Local NormalizedError removed                              |
| `apps/mmc/src/core/errors/error-normalizer.ts`                            | MODIFY | apps/mmc            | Full replacement; imports AppError from @zidney/api-client |
| `apps/mmc/src/core/errors/ErrorBoundary.vue`                              | CREATE | apps/mmc            | onErrorCaptured; fallback slot; no stack in prod           |
| `apps/mmc/src/core/errors/global-error-handler.ts`                        | CREATE | apps/mmc            | window event listeners; inject logger                      |
| `apps/mmc/src/core/errors/redact-error.ts`                                | CREATE | apps/mmc            | Pure function; isProduction param                          |
| `apps/mmc/src/App.vue`                                                    | MODIFY | apps/mmc            | Wrap RouterView with ErrorBoundary                         |
| `apps/mmc/src/main.ts`                                                    | MODIFY | apps/mmc            | Step 8.5 insertion; provide appLogger                      |
| `apps/mmc/src/core/errors/__tests__/error-normalizer.spec.ts`             | CREATE | apps/mmc            | 16 test cases; 100% coverage                               |
| `apps/mmc/src/core/errors/__tests__/redact-error.spec.ts`                 | CREATE | apps/mmc            | 6 test cases; 100% coverage                                |
| `apps/mmc/src/core/errors/__tests__/global-error-handler.spec.ts`         | CREATE | apps/mmc            | 6 test cases; ≥90% coverage                                |
| `apps/mmc/src/core/errors/__tests__/ErrorBoundary.spec.ts`                | CREATE | apps/mmc            | 7 test cases; ≥80% branch coverage                         |
| `apps/backoffice/src/core/errors/types.ts`                                | DELETE | apps/backoffice     | Same as MMC                                                |
| `apps/backoffice/src/core/errors/error-normalizer.ts`                     | MODIFY | apps/backoffice     | Same as MMC                                                |
| `apps/backoffice/src/core/errors/ErrorBoundary.vue`                       | CREATE | apps/backoffice     | Same as MMC                                                |
| `apps/backoffice/src/core/errors/global-error-handler.ts`                 | CREATE | apps/backoffice     | Same as MMC                                                |
| `apps/backoffice/src/core/errors/redact-error.ts`                         | CREATE | apps/backoffice     | Same as MMC                                                |
| `apps/backoffice/src/App.vue`                                             | MODIFY | apps/backoffice     | Same as MMC                                                |
| `apps/backoffice/src/main.ts`                                             | MODIFY | apps/backoffice     | Same as MMC                                                |
| `apps/backoffice/src/core/errors/__tests__/error-normalizer.spec.ts`      | CREATE | apps/backoffice     | Same as MMC                                                |
| `apps/backoffice/src/core/errors/__tests__/redact-error.spec.ts`          | CREATE | apps/backoffice     | Same as MMC                                                |
| `apps/backoffice/src/core/errors/__tests__/global-error-handler.spec.ts`  | CREATE | apps/backoffice     | Same as MMC                                                |
| `apps/backoffice/src/core/errors/__tests__/ErrorBoundary.spec.ts`         | CREATE | apps/backoffice     | Same as MMC                                                |
| `apps/frontoffice/src/core/errors/types.ts`                               | DELETE | apps/frontoffice    | Same as MMC                                                |
| `apps/frontoffice/src/core/errors/error-normalizer.ts`                    | MODIFY | apps/frontoffice    | Same as MMC                                                |
| `apps/frontoffice/src/core/errors/ErrorBoundary.vue`                      | CREATE | apps/frontoffice    | Same as MMC                                                |
| `apps/frontoffice/src/core/errors/global-error-handler.ts`                | CREATE | apps/frontoffice    | Same as MMC                                                |
| `apps/frontoffice/src/core/errors/redact-error.ts`                        | CREATE | apps/frontoffice    | Same as MMC                                                |
| `apps/frontoffice/src/App.vue`                                            | MODIFY | apps/frontoffice    | Same as MMC                                                |
| `apps/frontoffice/src/main.ts`                                            | MODIFY | apps/frontoffice    | Same as MMC                                                |
| `apps/frontoffice/src/core/errors/__tests__/error-normalizer.spec.ts`     | CREATE | apps/frontoffice    | Same as MMC                                                |
| `apps/frontoffice/src/core/errors/__tests__/redact-error.spec.ts`         | CREATE | apps/frontoffice    | Same as MMC                                                |
| `apps/frontoffice/src/core/errors/__tests__/global-error-handler.spec.ts` | CREATE | apps/frontoffice    | Same as MMC                                                |
| `apps/frontoffice/src/core/errors/__tests__/ErrorBoundary.spec.ts`        | CREATE | apps/frontoffice    | Same as MMC                                                |

**Total files changed**: 38 (2 modify in packages, 36 across 3 apps)

---

## Transaction Boundaries

**N/A — UI stage.** No database writes, no migration files, no connection pool operations.
All changes are browser-side; there are no server-side transaction semantics to enforce.

---

## Idempotency Strategy

**N/A — UI stage.** No API calls are made by the error handling infrastructure itself.
`global-error-handler.ts` implements safe re-registration: `unregisterGlobalErrorHandlers()`
cleanly removes prior listeners before any re-registration, preventing duplicate event handlers
if the module is hot-reloaded during development.

---

## Import Boundary Compliance

All imports in this plan conform to the Zidney import boundary rules:

| Import Direction                              | Rule                                            | Compliance                                        |
| --------------------------------------------- | ----------------------------------------------- | ------------------------------------------------- |
| `apps/mmc` → `packages/api-client`            | ✅ `apps/* → packages/*` allowed                | COMPLIANT                                         |
| `apps/mmc` → `packages/logger`                | ✅ `apps/* → packages/*` allowed                | COMPLIANT                                         |
| `apps/mmc` → `packages/ui-system`             | ✅ `apps/* → packages/*` allowed                | COMPLIANT                                         |
| `packages/api-client` → other packages        | ✅ `packages/* → packages/*` with no upward dep | COMPLIANT                                         |
| `apps/mmc` → `apps/backoffice`                | ❌ **FORBIDDEN** — not present in this plan     | N/A                                               |
| UI components → DB schemas                    | ❌ **FORBIDDEN** — not present in this plan     | N/A                                               |
| `error-normalizer.ts` → `import.meta.env`     | ❌ **FORBIDDEN**                                | Not present — env vars stay in main.ts            |
| `redact-error.ts` → `import.meta.env`         | ❌ **FORBIDDEN**                                | Not present — `isProduction` injected as param    |
| `global-error-handler.ts` → `import.meta.env` | ❌ **FORBIDDEN**                                | Not present — `isProduction` injected via options |

**Verdict**: All import paths in this plan are boundary-compliant.

---

## Pre-Mortem Risk Analysis

| Risk                                                                                      | Likelihood | Impact | Mitigation                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Legacy `NormalizedError` objects not fully migrated                                       | MEDIUM     | HIGH   | Legacy migration guard in normalizer (Q5 resolution) + CI `grep` on `NormalizedError` imports                                       |
| `ErrorBoundary.vue` wrapping causes layout shift in existing root                         | LOW        | MEDIUM | `ErrorBoundary` renders `<slot>` transparently when no error — zero layout impact                                                   |
| `window.addEventListener` double-registration on HMR reload                               | MEDIUM     | LOW    | `unregisterGlobalErrorHandlers()` called before re-registration; module-level ref tracking                                          |
| Per-app normalizer logic diverges over time                                               | LOW        | MEDIUM | Shared primitives (`isAppError`, `createAppError`, `mapHttpStatusToCode`) in `@zidney/api-client` constrain deviation               |
| `app.provide('appLogger')` fires after computed component tree → inject returns undefined | LOW        | HIGH   | `app.provide()` called before `app.use(pinia)` / `app.use(router)` / `app.mount()` — Vue guarantees provide available at mount time |
| `redactError` performance overhead on high-frequency errors                               | LOW        | LOW    | Pure function with simple regex — negligible; no I/O                                                                                |

---

## Validation Gates

After implementation, these checks must pass before the stage is CLOSED:

```bash
bun run ai:guard       # architecture boundary compliance
bun run arch:audit     # module registry
bun run lint           # biome formatting
bun run typecheck      # TS strict mode
bun run test           # all unit tests including new error module tests
```

CI enforcement: `grep -r 'NormalizedError' apps/` must return **zero** matches.

---

## Implementation Order (Dependency Graph)

```
Phase 1 (Task 1.1)
    └── Phase 2 [all 3 apps — parallel]
            ├── Task 2.2 (error-normalizer) — depends on Task 1.1 (ErrorCodes)
            ├── Task 2.3 (ErrorBoundary.vue) — depends on Task 2.2
            ├── Task 2.4 (global-error-handler) — depends on Task 2.2
            ├── Task 2.5 (redact-error) — no shared dep
            ├── Task 2.6 (App.vue) — depends on Task 2.3
            ├── Task 2.7 (main.ts Step 8.5) — depends on 2.4, 2.5
            └── Task 2.1 (DELETE types.ts) — last step after all importers updated
    └── Phase 3 [tests — parallel with Phase 2 per app]
            ├── Task 3.1 (error-normalizer.spec.ts) — depends on Task 2.2
            ├── Task 3.2 (redact-error.spec.ts) — depends on Task 2.5
            ├── Task 3.3 (global-error-handler.spec.ts) — depends on Task 2.4
            └── Task 3.4 (ErrorBoundary.spec.ts) — depends on Task 2.3
```

Wave 1: Task 1.1  
Wave 2: Task 2.5 (redact-error — no shared dep, can start after Wave 1 completes)  
Wave 3: Task 2.2 (normalizer — needs ErrorCodes from Wave 1)  
Wave 4: Tasks 2.3, 2.4, 3.2 (ErrorBoundary, global-error-handler, redact tests — need normalizer)  
Wave 5: Tasks 2.6, 2.7, 3.1, 3.3, 3.4 (App.vue, main.ts, remaining tests)  
Wave 6: Task 2.1 (DELETE types.ts — safest last after all consumers migrated)
