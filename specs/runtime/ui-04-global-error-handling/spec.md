# Feature Specification: Global Error Boundary & Normalization Layer

**Feature Branch**: `spec/ui-04-global-error-handling`
**Created**: 2026-04-06
**Status**: READY
**Phase**: 06_UI_APPLICATION_RUNTIME
**Stage**: STAGE_UI_04_GLOBAL_ERROR_HANDLING
**Stage File**: `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_04_GLOBAL_ERROR_HANDLING.md`
**Constitutional Compliance**: Zidney Constitution v1.2.0

---

## Feature Overview

This stage establishes the canonical error handling infrastructure across all three Zidney frontend
applications: **MMC** (Platform Admin), **Backoffice** (Tenant Admin), and **Frontoffice** (Student
Runtime).

It delivers:

- A canonical `AppError` interface consolidated from `packages/api-client/src/types.ts` as the
  single source of truth, replacing per-app `NormalizedError` local types
- A unified `error-normalizer` in each app's `core/errors/` layer that accepts `unknown` input and
  always returns a valid `AppError`
- An `ErrorBoundary.vue` component in each app that wraps the root layout and catches render-time
  and async component errors
- A `global-error-handler.ts` that registers `window.addEventListener("unhandledrejection", ...)` and
  `window.addEventListener("error", ...)` to catch all uncaught promise rejections and JS errors
- Production-safe error display: no stack traces, no tokens, no raw backend payloads exposed
- A `redact-error.ts` utility that strips sensitive fields before any error reaches the logger or UI

### What this stage does NOT deliver

- Business-specific error messages (exam, license, affiliate UI copy)
- Product-level error recovery flows (retry loops for business actions)
- Offline detection or service worker error handling
- Admin error reporting dashboards
- Any backend, database, or environment variable access

---

## Constitutional Compliance Declaration

| Constraint                                   | Status    | Detail                                                                |
| -------------------------------------------- | --------- | --------------------------------------------------------------------- |
| No cross-tenant access                       | CONFIRMED | Frontend-only; no DB imports                                          |
| No env vars in UI layer                      | CONFIRMED | No `import.meta.env` in error handlers; config injected via app setup |
| No business logic in error handler           | CONFIRMED | Normalizer maps HTTP status; no business state inference              |
| No stack traces in production                | CONFIRMED | `redact-error.ts` strips stack before logging/display                 |
| No silent error swallowing                   | CONFIRMED | All paths produce a visible AppError + logger call                    |
| No auto-retry for business errors            | CONFIRMED | Retryable flag only for transport-level errors                        |
| No JWT decoding or privilege inference       | CONFIRMED | Error handler never touches auth tokens                               |
| No raw backend message surfaced if sensitive | CONFIRMED | Redaction utility applied before any UI output                        |
| AppError interface shared across all 3 apps  | CONFIRMED | Canonical interface in `packages/api-client/src/types.ts`             |

> **Violation classification**: Any component that manually parses a raw HTTP response shape, reads
> `import.meta.env` in an error handler, or exposes a stack trace in production is an architectural
> violation and must be rejected in code review.

---

## Isolation Impact Analysis

- **Database accessed**: None (frontend-only stage)
- **Tenant resolution**: Not performed; error handler is tenant-neutral
- **Connection pool**: Not applicable
- **New tables introduced**: None
- **Backend changes required**: None — error codes are preserved as-is from backend

---

## Current State Analysis

### Problem: Divergent Error Types

Each app (`mmc`, `backoffice`, `frontoffice`) currently defines its own local `NormalizedError`
interface in `core/errors/types.ts`:

```ts
// apps/*/src/core/errors/types.ts (current — to be replaced)
export interface NormalizedError {
  code: string;
  message: string;
  httpStatus: number;
}
```

This type is **incomplete** compared to `packages/api-client`'s canonical `AppError`:

```ts
// packages/api-client/src/types.ts (canonical — source of truth)
export interface AppError {
  readonly code: string;
  readonly message: string;
  readonly httpStatus: number;
  readonly isNetworkError: boolean;
  readonly retryAfter?: number;
}
```

The local `NormalizedError` is missing `isNetworkError` and `retryAfter`, creating drift.

### Problem: No ErrorBoundary Components

No app has an `ErrorBoundary.vue` component. Render-time crashes result in blank screens.

### Problem: No Global Unhandled Rejection Handlers

No app registers `window.addEventListener("unhandledrejection")`, leaving async errors silent.

---

## User Stories

### US1 — Developer Receives a Typed AppError from Any Failure Source (Priority: P1)

**As a** developer catching an error from any async operation in any Zidney app, **I want** to
always receive a fully typed `AppError` object with `code`, `message`, `httpStatus`, and
`isNetworkError` fields, **So that** I never need to branch on raw error shapes in UI code.

**Acceptance Criteria**:

- AC1.1: `error-normalizer.ts` in each app accepts `unknown` input and always returns an `AppError`
- AC1.2: `AppError` is imported from `@zidney/api-client` (not a local type) in all app layers
- AC1.3: Local `NormalizedError` types are removed from all three apps
- AC1.4: Any thrown value (TypeError, plain object, string, null) is handled without throwing
- AC1.5: The normalizer never returns `undefined` or `null`
- AC1.6: The normalizer is a pure function with no side effects

---

### US2 — Network Failure Surfaces a Recognizable Error (Priority: P1)

**As a** user whose network drops during any operation, **I want** to see a clear connectivity
message and a manual retry option, **So that** I know the issue is network-related and can retry
when ready.

**Acceptance Criteria**:

- AC2.1: A `TypeError` ("Failed to fetch") or statusless failure normalizes to `AppError` with
  `isNetworkError: true`
- AC2.2: The UI displays a connectivity-loss message (not a generic error)
- AC2.3: A manual retry action is available in the UI
- AC2.4: No automatic retry loop is initiated

---

### US3 — 429 Rate Limit is Surfaced Accurately (Priority: P1)

**As a** user hitting a rate limit, **I want** to see a rate-limited message with optional retry
guidance, **So that** I understand I must wait before retrying.

**Acceptance Criteria**:

- AC3.1: A 429 response from the backend normalizes to `AppError` with `code: "RATE_LIMITED"` and
  `httpStatus: 429`
- AC3.2: If `Retry-After` header is present, `retryAfter` (seconds) is populated in `AppError`
- AC3.3: If `Retry-After` is absent, `retryAfter` is `undefined` — no fabricated value
- AC3.4: The rate-limit error is displayed using the toast display mode
- AC3.5: No automatic retry is performed

---

### US4 — Render Crash Displays Fallback UI (Priority: P1)

**As a** user whose page crashes due to a Vue render error, **I want** to see a fallback error page
instead of a blank screen, **So that** I can navigate away or refresh without being stranded.

**Acceptance Criteria**:

- AC4.1: Each app's root layout wraps `<RouterView>` with `<ErrorBoundary>`
- AC4.2: `ErrorBoundary` uses Vue's `onErrorCaptured` hook to catch render-time errors
- AC4.3: On error capture, a fallback slot or default fallback UI is rendered
- AC4.4: The fallback contains a "Go to home" / "Refresh" action
- AC4.5: Stack trace is NEVER shown in the fallback UI (production or development)
- AC4.6: The caught error is forwarded to the logger (post-redaction)

---

### US5 — Unhandled Promise Rejection is Caught Globally (Priority: P1)

**As a** developer, **I want** unhandled promise rejections to be intercepted globally and
converted to displayable AppErrors, **So that** no async error ever fails silently.

**Acceptance Criteria**:

- AC5.1: Each app registers `window.addEventListener("unhandledrejection", handler)` in main.ts
- AC5.2: Each app registers `window.addEventListener("error", handler)` for global JS errors
- AC5.3: All caught events are passed through the error normalizer and produce a valid `AppError`
- AC5.4: The normalized error is forwarded to the logger and optionally shown as a toast
- AC5.5: The handler does NOT swallow the event (it still propagates after logging)
- AC5.6: Handlers are registered before the Vue app is mounted

---

### US6 — Sensitive Data is Never Logged or Displayed (Priority: P1)

**As a** security-conscious platform, **I want** all errors to pass through a redaction step before
reaching the logger or UI, **So that** access tokens, refresh tokens, request payloads, and stack
traces are never exposed.

**Acceptance Criteria**:

- AC6.1: A `redact-error.ts` utility strips `Authorization` headers, token fields, and stack traces
  from any error before logging
- AC6.2: In production (`import.meta.env.PROD === true`), stack traces are omitted from all
  rendered output
- AC6.3: Raw backend error messages flagged as sensitive (e.g., containing token strings) are
  replaced with a generic safe message
- AC6.4: The redactor never modifies the original error object (returns a new object)
- AC6.5: Unit tests verify that token strings cannot appear in redactor output

---

### US7 — HTTP Status Errors Are Mapped Consistently (Priority: P2)

**As a** developer handling API responses, **I want** standard HTTP error statuses to produce
predictable `AppError` `code` values without custom branching in every component, **So that** HTTP
error handling is centralized and consistent.

**Acceptance Criteria**:

- AC7.1: `400` → `code: "VALIDATION_ERROR"`, `httpStatus: 400`, `isNetworkError: false`
- AC7.2: `403` → `code: "PERMISSION_DENIED"`, `httpStatus: 403`, `isNetworkError: false`
- AC7.3: `404` → `code: "NOT_FOUND"`, `httpStatus: 404`, `isNetworkError: false`
- AC7.4: `409` → `code: "CONFLICT"`, `httpStatus: 409`, `isNetworkError: false`
- AC7.5: `423` → `code: "LOCKED"`, `httpStatus: 423`, `isNetworkError: false`
- AC7.6: `426` → `code: "UPGRADE_REQUIRED"`, `httpStatus: 426`, `isNetworkError: false`
- AC7.7: `500+` → `code: "SERVER_ERROR"`, `httpStatus: <original>`, `isNetworkError: false`
- AC7.8: Backend-provided `code` field in `{ error: { code, message } }` is ALWAYS preserved
  (overrides the HTTP-status-derived code when present)
- AC7.9: No component ever manually parses HTTP status codes; all branching is in the normalizer

---

### US8 — Error Display Mode Matches Context (Priority: P2)

**As a** user encountering errors in different surfaces (form, toast, full page), **I want** error
messages to appear in the appropriate display mode, **So that** the feedback is contextually relevant
and minimally disruptive.

**Acceptance Criteria**:

- AC8.1: Three display modes are supported: `inline` (form error), `toast`, `full-page`
- AC8.2: Mode selection is the responsibility of the calling component/composable, NOT the
  normalizer
- AC8.3: The normalizer and boundary never force a specific display mode
- AC8.4: A `useErrorDisplay` composable provides helper methods for each mode
- AC8.5: Toast mode uses the shared `ui-system` toast primitive
- AC8.6: Full-page mode renders via the `ErrorBoundary` fallback slot

---

### US9 — All Three Apps Use the Same Error Infrastructure (Priority: P2)

**As a** developer maintaining any of the three apps, **I want** the error normalization logic,
`AppError` type, and `ErrorBoundary` behavior to be identical across all apps, **So that** I only
need to learn and debug one pattern.

**Acceptance Criteria**:

- AC9.1: All three apps import `AppError` from `@zidney/api-client` (no local copies)
- AC9.2: All three apps have a structurally identical `core/errors/` directory layout
- AC9.3: Apps may override `ErrorBoundary` fallback UI styling only (logic is identical)
- AC9.4: The `error-normalizer.ts` logic is extracted to a shared utility if it would otherwise
  be copy-pasted — OR documented as intentionally duplicated (each app's normalizer is a façade
  over the shared `@zidney/api-client` normalizer utilities)
- AC9.5: CI enforces that no app imports a local `NormalizedError` type

---

### US10 — Error Infrastructure is Fully Testable (Priority: P2)

**As a** QA engineer, **I want** the error handling infrastructure to support deterministic
simulation of all failure modes, **So that** every code path can be covered without mocking global
browser state.

**Acceptance Criteria**:

- AC10.1: `error-normalizer` is a pure function — no global state, no mocks needed beyond the input value
- AC10.2: `ErrorBoundary.vue` exposes a test-helper slot that allows injecting a forced render error
- AC10.3: `global-error-handler.ts` exports the handler function independently so it can be called
  directly in tests without firing `window` events
- AC10.4: `redact-error.ts` is a pure function — no global state
- AC10.5: All 9 HTTP status mapping cases have individual unit tests
- AC10.6: Network failure, 429, render crash, and async rejection are represented in the test suite

---

## Technical Requirements

### TR1 — AppError Interface (Canonical Source of Truth)

The canonical `AppError` interface **already exists** in `packages/api-client/src/types.ts`. No
changes to the interface are required. All apps must remove their local `NormalizedError` type and
import `AppError` from `@zidney/api-client`.

```ts
// packages/api-client/src/types.ts — DO NOT DUPLICATE
export interface AppError {
  readonly code: string;
  readonly message: string;
  readonly httpStatus: number;
  readonly isNetworkError: boolean;
  readonly retryAfter?: number;
}
```

### TR2 — error-normalizer.ts (Per App, Identical Logic)

Each app's `core/errors/error-normalizer.ts` must be updated to:

- Import `AppError` from `@zidney/api-client` (not local `NormalizedError`)
- Use `isAppError` and `createAppError` from `@zidney/api-client` where applicable
- Handle: `TypeError`, pre-normalized `AppError`, structured `{ error: { code, message } }`,
  HTTP-status-only errors, and unknown shapes
- Never return `undefined` or `null`
- Be a pure function (no side effects)

### TR3 — ErrorBoundary.vue (Per App)

Each app must have `core/errors/ErrorBoundary.vue`:

```vue
<!-- Responsibilities -->
<!-- 1. Register onErrorCaptured hook -->
<!-- 2. Normalize the caught error via error-normalizer -->
<!-- 3. Set reactive `hasError` and `currentError` state -->
<!-- 4. Render default slot in normal state -->
<!-- 5. Render `#fallback` slot (or default fallback template) in error state -->
<!-- 6. Log error via @zidney/logger (post-redaction) -->
<!-- 7. NEVER render stack trace in production -->
```

Fallback UI requirements:

- "Something went wrong" heading
- Error code displayed (safe to show)
- "Go to Home" button
- "Try again" button (resets `hasError`)
- No raw error message unless `import.meta.env.DEV`

### TR4 — global-error-handler.ts (Per App)

Each app must have `core/errors/global-error-handler.ts`:

```ts
// Exports:
export function registerGlobalErrorHandlers(options: GlobalErrorHandlerOptions): void;
export function unregisterGlobalErrorHandlers(): void;

// GlobalErrorHandlerOptions:
interface GlobalErrorHandlerOptions {
  onError: (error: AppError) => void;
  logger?: Logger;
}
```

`registerGlobalErrorHandlers` must:

1. Register `window.addEventListener("unhandledrejection", ...)`
2. Register `window.addEventListener("error", ...)`
3. Normalize caught values via `error-normalizer`
4. Call `options.onError(normalizedError)`
5. Log via `options.logger` if provided

### TR5 — redact-error.ts (Per App or Shared)

Each app must have `core/errors/redact-error.ts` (or import from a shared utility):

```ts
export function redactError(error: AppError): AppError;
```

Rules:

- Returns a new frozen `AppError` object
- Strips any string values matching token/secret patterns (Bearer token regex)
- In production: strips stack from the message field if embedded
- Never mutates the input
- Is a pure function

### TR6 — main.ts Integration (Per App)

Each app's `main.ts` must call `registerGlobalErrorHandlers` before `app.mount()`:

```ts
import { registerGlobalErrorHandlers } from "@/core/errors/global-error-handler";

registerGlobalErrorHandlers({ onError: (err) => useToast().add(toastFromError(err)) });

app.mount("#app");
```

### TR7 — ErrorCodes Registry

`error-normalizer.ts` must use only codes from the established `ErrorCodes` registry in
`packages/api-client/src/http-error.ts`. For HTTP-status-mapped codes not yet in the registry
(400, 403, 404, 409, 423, 426, 500+), the registry must be extended:

```ts
export const ErrorCodes = {
  NETWORK_ERROR: "NETWORK_ERROR",
  REQUEST_TIMEOUT: "REQUEST_TIMEOUT",
  REQUEST_CANCELLED: "REQUEST_CANCELLED",
  RATE_LIMITED: "RATE_LIMITED",
  AUTH_REFRESH_FAILED: "AUTH_REFRESH_FAILED",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  // New additions:
  VALIDATION_ERROR: "VALIDATION_ERROR",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  LOCKED: "LOCKED",
  UPGRADE_REQUIRED: "UPGRADE_REQUIRED",
  SERVER_ERROR: "SERVER_ERROR",
} as const;
```

---

## Implementation Path

### Affected Packages

| Package               | Change                                              |
| --------------------- | --------------------------------------------------- |
| `packages/api-client` | Extend `ErrorCodes` registry with HTTP-status codes |

### Affected Apps

| App                | Core Changes                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mmc`         | Replace `NormalizedError` → `AppError`; add `ErrorBoundary.vue`, `global-error-handler.ts`, `redact-error.ts`; update `main.ts` |
| `apps/backoffice`  | Same as MMC                                                                                                                     |
| `apps/frontoffice` | Same as MMC                                                                                                                     |

---

## File Structure

### packages/api-client/src/

```
http-error.ts         ← Extend ErrorCodes with 7 new status codes (VALIDATION_ERROR, etc.)
```

### apps/mmc/src/core/errors/

```
types.ts              ← DELETE (replaced by AppError from @zidney/api-client)
error-normalizer.ts   ← REPLACE (use AppError; full HTTP status mapping; pure function)
ErrorBoundary.vue     ← NEW (Vue SFC with onErrorCaptured, fallback slot, logging)
global-error-handler.ts  ← NEW (window unhandledrejection + error listeners)
redact-error.ts       ← NEW (pure function; strips tokens, stack traces)
```

### apps/backoffice/src/core/errors/

```
types.ts              ← DELETE
error-normalizer.ts   ← REPLACE
ErrorBoundary.vue     ← NEW
global-error-handler.ts  ← NEW
redact-error.ts       ← NEW
```

### apps/frontoffice/src/core/errors/

```
types.ts              ← DELETE
error-normalizer.ts   ← REPLACE
ErrorBoundary.vue     ← NEW
global-error-handler.ts  ← NEW
redact-error.ts       ← NEW
```

### Each App — Root Component

```
App.vue               ← MODIFY: wrap <RouterView /> with <ErrorBoundary>
main.ts               ← MODIFY: register global handlers before mount
```

---

## Testing Requirements

### Unit Tests

| File                      | Required Tests                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `error-normalizer.ts`     | TypeError → isNetworkError:true; pre-normalized passthrough; HTTP 400/403/404/409/423/426/429/500; unknown shape fallback; backend code override |
| `redact-error.ts`         | Token pattern stripped; production stack trace removed; dev stack preserved; input not mutated                                                   |
| `global-error-handler.ts` | Handler normalizes unhandledrejection; handler normalizes global error; onError called; unregister removes listeners                             |
| `ErrorBoundary.vue`       | Renders slot in normal state; renders fallback on error; fallback has home link; does not show stack in production; resets on retry              |

### Integration Tests (per app)

| Scenario                        | Verification                                          |
| ------------------------------- | ----------------------------------------------------- |
| Simulated 500 from API          | ErrorBoundary fallback renders                        |
| Simulated 429 from API          | Toast with rate-limit message shown                   |
| Simulated network drop          | Connectivity message with retry button                |
| Async rejection (unhandled)     | Global handler catches; toast shown; no blank screen  |
| Render crash in child component | ErrorBoundary catches; fallback renders; error logged |

### Test Coverage Requirement

- `error-normalizer.ts`: 100% statement coverage
- `redact-error.ts`: 100% statement coverage
- `global-error-handler.ts`: ≥ 90% statement coverage
- `ErrorBoundary.vue`: ≥ 80% branch coverage

---

## Completion Criteria

Stage is complete when ALL of the following are true:

- [ ] `AppError` is the single error type across all three apps (no local `NormalizedError` copies)
- [ ] `error-normalizer.ts` updated in MMC, Backoffice, Frontoffice — uses `AppError`, handles all HTTP codes
- [ ] `ErrorBoundary.vue` implemented in MMC, Backoffice, Frontoffice — wraps root layout
- [ ] `global-error-handler.ts` implemented and registered in `main.ts` for all three apps
- [ ] `redact-error.ts` implemented; tokens and stack traces stripped in production
- [ ] `ErrorCodes` registry in `packages/api-client` extended with 7 HTTP-status codes
- [ ] All unit tests pass with required coverage thresholds
- [ ] No blank screens for render crashes in any app
- [ ] 429 surfaces correctly (code + retryAfter) in all three apps
- [ ] Network failure surfaces correctly (isNetworkError:true + user message)
- [ ] No raw `NormalizedError` references remain in codebase
- [ ] Lint and TypeScript checks pass
- [ ] No TODO placeholders in error layer
- [ ] No stack traces rendered in production build

---

## Open Questions

_None at time of spec authoring. All architectural decisions resolved via stage file._

---

## Clarifications

### Session 2026-04-06

**Q1: `retryable: boolean` (STAGE file) vs. `retryAfter?: number` (canonical AppError) — which field conveys transport-level retryability?**

The STAGE file's `AppError` definition includes `retryable?: boolean`. The canonical implementation in `packages/api-client/src/types.ts` exports `retryAfter?: number` with no `retryable` boolean. These two representations conflict.

Clarification: The authoritative source is `packages/api-client/src/types.ts`. The `retryable` field in the STAGE file is a draft artifact that predates the final type. `retryAfter?: number` is the sole signal for transport-level retryability: its presence (with a valid number) indicates the client may retry after that many seconds; its absence means no retry guidance is available. No `retryable` boolean field exists or will be added to `AppError`. The `normalizeError` function must not set or check `retryable`.

Decision: RESOLVED — `retryAfter?: number` from `packages/api-client/src/types.ts` is authoritative. Ignore `retryable` in the STAGE file.

---

**Q2: Is `Logger` in `GlobalErrorHandlerOptions` the type from `@zidney/logger`, and is that package safe to instantiate in browser context given the "no env vars in UI" constitutional constraint?**

TR4 declares `logger?: Logger` in `GlobalErrorHandlerOptions` but does not name the source package. The `@zidney/logger` docs reference `LOG_LEVEL` and `LOG_FORMAT` environment variables, which at first read appears to violate the constitution's "no `import.meta.env` in error handlers" rule.

Clarification: `@zidney/logger` is already used in `apps/frontoffice` (auth.store.ts, role.guard.ts, token-manager.ts) and is Vite-compatible for browser builds. The constitutional rule prohibits reading `import.meta.env` **inside error handler modules** — it does not ban importing a logger that reads env vars at construction time. The correct pattern is: instantiate the logger once in `main.ts` with `createLogger(appName)` and inject it into `registerGlobalErrorHandlers({ ..., logger })`. The `global-error-handler.ts` module itself never calls `import.meta.env`. The `Logger` type in `GlobalErrorHandlerOptions` is `Logger` from `@zidney/logger`.

Decision: RESOLVED — Use `Logger` type from `@zidney/logger`. Create the instance in `main.ts` and inject via options. `global-error-handler.ts` never accesses `import.meta.env` directly.

---

**Q3: Is `toastFromError` in the TR6 main.ts example a deliverable of this stage, or is it illustrative pseudocode?**

TR6 shows:

```ts
registerGlobalErrorHandlers({ onError: (err) => useToast().add(toastFromError(err)) });
```

Neither `toastFromError` nor a `useToast` composable is declared as a deliverable anywhere in the spec. AC8.2 explicitly states "mode selection is the responsibility of the calling component/composable, NOT the normalizer."

Clarification: The TR6 snippet is illustrative pseudocode showing the intended injection pattern. `toastFromError` is NOT a deliverable of this stage. The `onError: (error: AppError) => void` callback signature is the only contract this stage defines; the callback body is app-specific and is the responsibility of the integration task. The stage only requires that `registerGlobalErrorHandlers` is wired in `main.ts` with a valid `onError` callback before `app.mount()`. The ui-system package uses `vue-sonner` (via `packages/ui-system/src/components/shadcn-vue/sonner/`) for toasting; a `toastFromError` helper may be built as part of a separate integration task.

Decision: RESOLVED — `toastFromError` is out of scope. TR6 is an integration guide pattern, not a literal deliverable spec.

---

**Q4: Where in the existing 9-step CL-01 `main.ts` bootstrap sequence should `registerGlobalErrorHandlers` be inserted?**

The existing `main.ts` for all three apps follows a strict 9-step CL-01 sequence (Pinia → Router → TokenManager → AuthService → AuthStore → RefreshManager → ApiClient → registerGuards → mount). AC5.6 requires handlers registered before `app.mount()`. The spec does not specify a step number.

Clarification: `registerGlobalErrorHandlers` must be inserted as new **Step 8.5** — after `registerGuards()` (Step 8) and before `app.mount('#app')` (Step 9). This placement ensures that all infrastructure (Pinia, router, stores, API client) is initialized when `window.addEventListener` handlers fire, so the injected `onError` callback can safely reference initialized composables and stores. Registering earlier (e.g., before Pinia at Step 0) is technically valid for capturing events but would prevent `onError` from accessing any app context. Step 8.5 is the correct position.

Decision: RESOLVED — Insert as Step 8.5 in `main.ts`, between `registerGuards` and `app.mount('#app')`. Update bootstrap step comments accordingly.

---

**Q5: Should the migrated `error-normalizer.ts` gracefully reconstruct `AppError` from legacy `NormalizedError` objects (which lack `isNetworkError`), or hard-reject them?**

All three apps' existing `error-normalizer.ts` uses a duck-typed passthrough: any `{ code: string, httpStatus: number }` object passes through unchanged. After migration, the new normalizer will use `isAppError()` from `@zidney/api-client`, which also requires `isNetworkError: boolean`. A legacy `NormalizedError` object (with `code`, `message`, `httpStatus` but no `isNetworkError`) will fail `isAppError()` and fall through to the unknown-shape fallback — losing its original `code` and becoming `UNKNOWN_ERROR`.

Clarification: The migrated normalizer must NOT let old `NormalizedError` objects fall to the `UNKNOWN_ERROR` fallback. Structural detection should use two sequential guards: first `isAppError()` (full AppError pass-through), then a secondary check for `{ code: string, httpStatus: number }` without `isNetworkError` — treating these as legacy shapes and reconstructing them as `AppError` with `isNetworkError: false`, `retryAfter: undefined`. This is safe because all existing `NormalizedError` objects originate from HTTP responses (not network failures), so `isNetworkError: false` is semantically correct. All throw sites emitting `NormalizedError` must be updated in the same implementation pass; the secondary guard is a safety net for any missed sites, not a permanent compatibility layer.

Decision: RESOLVED — Add a secondary structural guard in each `error-normalizer.ts` to reconstruct legacy `NormalizedError` shapes as `AppError` with `isNetworkError: false`. Remove the secondary guard once all throw sites are confirmed migrated.
