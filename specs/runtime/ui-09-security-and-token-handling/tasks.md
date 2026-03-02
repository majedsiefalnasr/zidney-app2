# STAGE_UI_09 — Tasks

**Stage**: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Generated**: 2026-03-02  
**Status**: READY FOR EXECUTION  
**Depends on**: STAGE_UI_01_AUTH_MODULE (complete in all three apps)

---

## Stage Context

- **Phase**: 06_UI_APPLICATION_RUNTIME
- **Stage**: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
- **Related Plan**: specs/runtime/ui-09-security-and-token-handling/plan.md
- **Related Spec**: specs/runtime/ui-09-security-and-token-handling/spec.md
- **Related ADR**: None (no new ADR required — purely additive changes)

---

## Constitution Alignment (Pre-Task Gate)

Before executing any task, confirm:

- [x] Token storage is in-memory only — `token-manager.ts` already compliant (FR-SEC-01/02)
- [x] Authorization header injection is single-location in `packages/api-client` (FR-SEC-04/05/06)
- [x] No cross-package structural changes — all changes are app-local factories
- [x] Single-flight 401 guard already exists in `packages/api-client/src/client.ts`
- [x] No new npm packages required
- [x] Stage status: IN PROGRESS — tasks updated to include security & QA audit-required coverage (post-analyze review)

---

## Task Groups Summary

| Group | Description                                         | Apps | Dependencies |
| ----- | --------------------------------------------------- | ---- | ------------ |
| A     | `token-redact.ts` — new pure utility                | ×3   | None         |
| B     | `error.interceptor.ts` — new 401/423/426 handler    | ×3   | A            |
| C     | `auth.store.ts` — add `expireSession()` action      | ×3   | None         |
| D     | `client.ts` — extend `createAppApiClient`           | ×3   | C, B         |
| E     | `auth/index.ts` — re-export token-redact            | ×3   | A            |
| F     | `auth.guard.ts` — redirect preservation             | ×3   | D            |
| G     | Unit tests (9 files T026-T037 + 12 files T040-T057) | ×21  | A,B,C,D,E,F  |
| H     | Lint + TypeScript type check validation             | root | G            |

---

## Phase 1 — Foundation: License Status Store

> Prerequisite state stores required before main.ts wiring in US4. No user story dependency — creates the reactive flags consumed by `onLicenseError` callbacks.

- [X] T001 Create license status store in apps/mmc/src/core/state/license-status.store.ts with `isWorkspaceLocked`, `isUpgradeRequired` reactive refs and `setWorkspaceLocked()`, `setUpgradeRequired()`, `clearLicenseStatus()` actions
- [X] T002 [P] Create license status store in apps/backoffice/src/core/state/license-status.store.ts with identical shape as T001
- [X] T003 [P] Create license status store in apps/frontoffice/src/core/state/license-status.store.ts with identical shape as T001

---

## Phase 2 — US1: Token Redaction Utility (Group A + E)

**Story goal**: Provide a reusable pure function that scrubs sensitive field names from log objects before any structured log call, satisfying FR-SEC-03's zero-tolerance token exposure policy.

**Independent test criteria**: After this phase, `redactSensitiveFields({ token: 'eyJ...' })` returns `{ token: '[REDACTED]' }` and is importable with no framework bootstrap.

- [X] T004 [US1] Create token redaction utility in apps/mmc/src/core/auth/token-redact.ts implementing `redactSensitiveFields<T>()` and `looksLikeToken()` pure functions (FR-SEC-03)
- [X] T005 [P] [US1] Create token redaction utility in apps/backoffice/src/core/auth/token-redact.ts with identical implementation as T004
- [X] T006 [P] [US1] Create token redaction utility in apps/frontoffice/src/core/auth/token-redact.ts with identical implementation as T004
- [X] T007 [US1] Add `export { redactSensitiveFields, looksLikeToken } from './token-redact'` to apps/mmc/src/core/auth/index.ts (Group E)
- [X] T008 [P] [US1] Add `export { redactSensitiveFields, looksLikeToken } from './token-redact'` to apps/backoffice/src/core/auth/index.ts
- [X] T009 [P] [US1] Add `export { redactSensitiveFields, looksLikeToken } from './token-redact'` to apps/frontoffice/src/core/auth/index.ts

---

## Phase 3 — US2: Session Expiry & 401 Handling (Groups C → B → D)

**Story goal**: A 401 during an authenticated session clears auth state, notifies the user via `authError.code: 'AUTH_SESSION_EXPIRED'`, and redirects to login exactly once — regardless of how many concurrent 401s arrive (FR-SEC-07, FR-SEC-08).

**Independent test criteria**: After this phase, calling `authStore.expireSession()` when authenticated navigates to login and sets `authError.code === 'AUTH_SESSION_EXPIRED'`; calling it when unauthenticated is a no-op; `createErrorInterceptor().handleAuthFailure()` calls `onSessionExpired` only when `isAuthenticated` is true and only once per expiry cycle.

### Group C — Add `expireSession()` to auth store

- [X] T010 [US2] Add `expireSession()` action to apps/mmc/src/core/state/auth.store.ts: clears token via `tokenManager.clearToken()`, sets `isAuthenticated = false`, sets `user = null`, navigates to `loginRouteName`, and sets `authError.value = { code: 'AUTH_SESSION_EXPIRED', message: 'Session expired. Please sign in again.' }` after navigation; includes `isAuthenticated` idempotency guard
- [X] T011 [P] [US2] Add `expireSession()` action to apps/backoffice/src/core/state/auth.store.ts with identical implementation as T010
- [X] T012 [P] [US2] Add `expireSession()` action to apps/frontoffice/src/core/state/auth.store.ts with identical implementation as T010

### Group B — Create error interceptor (depends on Group A: T004/T005/T006)

- [X] T013 [US2] Create error interceptor in apps/mmc/src/core/api/interceptors/error.interceptor.ts implementing `IErrorInterceptor` interface with `handleAuthFailure()` (isAuthenticated guard + `_isHandling401` flag), `handleLicenseError(423|426)`, and `createErrorInterceptor()` factory using `@zidney/logger`
- [X] T014 [P] [US2] Create error interceptor in apps/backoffice/src/core/api/interceptors/error.interceptor.ts with identical interface and factory as T013
- [X] T015 [P] [US2] Create error interceptor in apps/frontoffice/src/core/api/interceptors/error.interceptor.ts with identical interface and factory as T013

### Group D — Extend API client factory (depends on Group C: T010–T012 and Group B: T013–T015)

- [X] T016 [US2] Extend `createAppApiClient()` in apps/mmc/src/core/api/client.ts to accept `IErrorInterceptor` as third parameter; wire `onAuthFailure` callback to `errorInterceptor.handleAuthFailure()`; add `onLicenseError?: (status: 423 | 426) => void` callback
- [X] T017 [P] [US2] Extend `createAppApiClient()` in apps/backoffice/src/core/api/client.ts with identical signature extension as T016
- [X] T018 [P] [US2] Extend `createAppApiClient()` in apps/frontoffice/src/core/api/client.ts with identical signature extension as T016

---

## Phase 4 — US3: Route Guard Redirect Preservation (Group F, depends on Group D: T016–T018)

**Story goal**: When an unauthenticated user accesses a protected route, the login redirect preserves the intended destination as `?redirect=<fullPath>` so the login page can return the user after successful authentication (FR-SEC-09, FR-SEC-16).

**Independent test criteria**: After this phase, navigating to `/protected/page` while unauthenticated produces a redirect to `{ name: loginRouteName, query: { redirect: '/protected/page' } }`; setting `preserveRedirect: false` omits the query param.

- [X] T019 [US3] Extend `createAuthGuard()` in apps/mmc/src/core/router/guards/auth.guard.ts: change unauthenticated redirect from `{ name: options.loginRouteName }` to `{ name: options.loginRouteName, query: { redirect: to.fullPath } }`; add `preserveRedirect?: boolean` field to `AuthGuardOptions` interface (defaults to `true`)
- [X] T020 [P] [US3] Extend `createAuthGuard()` in apps/backoffice/src/core/router/guards/auth.guard.ts with identical change as T019
- [X] T021 [P] [US3] Extend `createAuthGuard()` in apps/frontoffice/src/core/router/guards/auth.guard.ts with identical change as T019

---

## Phase 5 — US4: License Response Handling & Main.ts Wiring (depends on T001–T003, T013–T018)

**Story goal**: 423 and 426 responses from the API set reactive flags in `licenseStatusStore`, enabling `App.vue` to render a `WorkspaceLocked` or `UpgradeRequired` full-page message without retrying or caching the response (FR-SEC-20, FR-SEC-21).

**Independent test criteria**: After this phase, `main.ts` wires `createErrorInterceptor` with `onLicenseError` that sets the correct store flag; `isWorkspaceLocked` becomes `true` on a 423; `isUpgradeRequired` becomes `true` on a 426.

- [X] T022 [US4] Update apps/mmc/src/main.ts: instantiate `createErrorInterceptor` after `authStore` is created wiring `getIsAuthenticated`, `onSessionExpired: () => authStore.expireSession()`, and `onLicenseError` → `licenseStatusStore`; pass `errorInterceptor` to `createAppApiClient`; define `clearUserSpecificStores()` helper stub with `// Feature stores registered here as stages land` comment
- [X] T023 [P] [US4] Update apps/backoffice/src/main.ts with identical wiring as T022
- [X] T024 [P] [US4] Update apps/frontoffice/src/main.ts with identical wiring as T022

---

## Phase 6 — US5: XSS Mitigation — ESLint Enforcement (depends on none)

**Story goal**: The `vue/no-v-html` ESLint rule is enabled across all Vue apps, encoding the constitutional requirement that `v-html` usage requires sanitization (FR-SEC-17).

**Independent test criteria**: After this phase, ESLint reports an **error** (not `warn`) on any `v-html` directive. All existing `v-html` usages are sanitized or eliminated. Zero lint violations in all three apps.

- [X] T025 [US5] Enforce `vue/no-v-html` as `'error'` (not `'warn'`) in eslint.config.mjs: (a) audit all existing `v-html` usages in apps/mmc, apps/backoffice, apps/frontoffice; (b) eliminate or sanitize any unsanitized usages; (c) set `'vue/no-v-html': 'error'` in the Vue-files rule block — advisory `'warn'` is constitutionally insufficient per AGENTS.md and plan.md Section 7 (FR-SEC-03, FR-SEC-17)

---

## Phase 7 — Tests (Group G)

> All test tasks within this phase are [P] since each targets a distinct file. Run after all implementation phases (T004–T025) are complete.

### Token Redact Tests (3 files)

- [X] T026 [P] [US1] Create unit test file tests/unit/mmc/core/auth/token-redact.test.ts covering: `redactSensitiveFields` with `token`, `accessToken`, `access_token`, `refreshToken`, `refresh_token`, `authorization`, `Authorization`, `password`, `credential`, `csrfToken`, `csrf_token`, `x-csrf-token`, `X-CSRF-Token` fields (all 13 SENSITIVE_KEYS); safe-field pass-through; `looksLikeToken` returns true for long base64url string; returns false for short string; returns false for non-string; `assertNoTokenInLogArgs` helper verifies no token-like value exists at any nesting depth in log call arguments
- [X] T027 [P] [US1] Create unit test file tests/unit/backoffice/core/auth/token-redact.test.ts with identical test cases as T026
- [X] T028 [P] [US1] Create unit test file tests/unit/frontoffice/core/auth/token-redact.test.ts with identical test cases as T026

### Error Interceptor Tests (3 files)

- [X] T029 [P] [US2] Create unit test file tests/unit/mmc/core/api/interceptors/error.interceptor.test.ts covering: `handleAuthFailure()` calls `onSessionExpired` when `isAuthenticated=true`; does NOT call `onSessionExpired` when `isAuthenticated=false`; `isHandling401` guard fires `onSessionExpired` exactly once on concurrent calls; `isHandling401` resets to false after `onSessionExpired` resolves so a subsequent call can re-trigger; `handleLicenseError(423)` calls `onLicenseError` with `423`; `handleLicenseError(426)` calls `onLicenseError` with `426`
- [X] T030 [P] [US2] Create unit test file tests/unit/backoffice/core/api/interceptors/error.interceptor.test.ts with identical test cases as T029
- [X] T031 [P] [US2] Create unit test file tests/unit/frontoffice/core/api/interceptors/error.interceptor.test.ts with identical test cases as T029

### Auth Guard Redirect Tests (3 files)

- [X] T032 [P] [US3] Create unit test file tests/unit/mmc/core/router/guards/auth.guard.redirect.test.ts covering: unauthenticated access to protected route → redirect includes `query.redirect === to.fullPath`; `preserveRedirect: false` option → redirect has no query param; authenticated access to protected route → navigation passes through without redirect; accessing the login route directly while unauthenticated → passes through without redirect loop (PF-03: `to.name === loginRouteName` early-exit guard); `preserveRedirect` option omitted (default) → behaves identically to `preserveRedirect: true`
- [X] T033 [P] [US3] Create unit test file tests/unit/backoffice/core/router/guards/auth.guard.redirect.test.ts with identical test cases as T032
- [X] T034 [P] [US3] Create unit test file tests/unit/frontoffice/core/router/guards/auth.guard.redirect.test.ts with identical test cases as T032

### Auth Store `expireSession` Test Extensions (3 existing files modified)

- [X] T035 [P] [US2] Extend tests/unit/mmc/core/state/auth.store.test.ts with `expireSession()` test cases: authenticated → clears token, sets `authError.code === 'AUTH_SESSION_EXPIRED'`, navigates to login; not authenticated → no-op, no navigation, no authError; called twice concurrently → executes once (idempotency via `isAuthenticated` guard)
- [X] T036 [P] [US2] Extend tests/unit/backoffice/core/state/auth.store.test.ts with identical `expireSession()` test cases as T035
- [X] T037 [P] [US2] Extend tests/unit/frontoffice/core/state/auth.store.test.ts with identical `expireSession()` test cases as T035

---

## Phase 9 — Security Audit: Token Persistence + Header Injection + 401 Race

> Required by Security Auditor and QA Engineer guardian verdicts. These tests provide constitutional audit evidence for token-in-memory-only policy (FR-SEC-01/02), single-header injection policy (FR-SEC-04/05/06), and 401 idempotency guarantee (FR-SEC-07/08).

### Token Persistence Audit Tests (3 files) — QA-C1

- [X] T040 [P] Create unit test file tests/unit/mmc/core/auth/token-persistence-audit.test.ts: spy on `localStorage.setItem` and `sessionStorage.setItem`; call `authStore.setSession({ token })`, `authStore.expireSession()`, and `authStore.logout()`; assert `setItem` is NEVER called with a value matching `looksLikeToken()` across all three operations (FR-SEC-01/02 zero-persistence guarantee)
- [X] T041 [P] Create unit test file tests/unit/backoffice/core/auth/token-persistence-audit.test.ts with identical test cases as T040
- [X] T042 [P] Create unit test file tests/unit/frontoffice/core/auth/token-persistence-audit.test.ts with identical test cases as T040

### Auth Header Injection Tests (3 files) — QA-C2

- [X] T043 [P] Create unit test file tests/unit/mmc/core/api/client.test.ts (or extend existing): assert that when `getAccessToken()` returns a token string, outbound requests carry `Authorization: Bearer <token>` header; assert that when `getAccessToken()` returns `null`, no `Authorization` header is present (FR-SEC-04/05/06 single-point injection)
- [X] T044 [P] Create unit test file tests/unit/backoffice/core/api/client.test.ts with identical test cases as T043
- [X] T045 [P] Create unit test file tests/unit/frontoffice/core/api/client.test.ts with identical test cases as T043

### Integration 401 Race Tests (3 files) — QA-C3

- [X] T046 [P] Create integration test file tests/integration/mmc/auth/401-race.test.ts: fire 3 concurrent 401 responses during an authenticated session; assert `authStore.expireSession()` and `onSessionExpired` callback each fires exactly once; assert `isHandling401` resets afterward; separately assert that a 401 originating from the login endpoint (unauthenticated context) does NOT trigger expiry flow (FR-SEC-07/08 idempotency)
- [X] T047 [P] Create integration test file tests/integration/backoffice/auth/401-race.test.ts with identical test cases as T046
- [X] T048 [P] Create integration test file tests/integration/frontoffice/auth/401-race.test.ts with identical test cases as T046

---

## Phase 10 — Store + Route Coverage Audit Tests

> Required by QA Engineer guardian verdict. These tests provide spec coverage for license-status store actions, `clearUserSpecificStores()` call contract, and route-guard completeness.

### License-Status Store Unit Tests (3 files) — QA-H1

- [X] T049 [P] Create unit test file tests/unit/mmc/core/state/license-status.store.test.ts: test `setWorkspaceLocked(true)` sets `isWorkspaceLocked === true`; `setUpgradeRequired(true)` sets `isUpgradeRequired === true`; `clearLicenseStatus()` resets both to false; assert that `error.interceptor.ts` wires `onLicenseError(423)` to `setWorkspaceLocked` and `onLicenseError(426)` to `setUpgradeRequired`
- [X] T050 [P] Create unit test file tests/unit/backoffice/core/state/license-status.store.test.ts with identical test cases as T049
- [X] T051 [P] Create unit test file tests/unit/frontoffice/core/state/license-status.store.test.ts with identical test cases as T049

### Route Guard Coverage Audit (3 tests per app) — QA-H2

- [X] T052 [P] Create unit test file tests/unit/mmc/core/router/guards/route-coverage-audit.test.ts: iterate all routes defined in the MMC router; assert every route that lacks `meta.public === true` has `auth.guard.ts` applied as a navigation guard; assert the set of guarded routes matches the expected list (fail if new unguarded non-public routes appear)
- [X] T053 [P] Create unit test file tests/unit/backoffice/core/router/guards/route-coverage-audit.test.ts with identical pattern as T052 applied to Backoffice router
- [X] T054 [P] Create unit test file tests/unit/frontoffice/core/router/guards/route-coverage-audit.test.ts with identical pattern as T052 applied to Frontoffice router

### clearUserSpecificStores() Call Contract Tests (3 files) — QA-H3

> **Note (C2/PF-02 architectural decision)**: `clearUserSpecificStores()` is called from the `main.ts` `onSessionExpired` callback AFTER `authStore.expireSession()` resolves. It is NOT called from inside `expireSession()` itself. Tests T055–T057 verify the callback integration at the `main.ts` wiring level.

- [X] T055 [P] Create integration test file tests/integration/mmc/auth/session-clear-wiring.test.ts: spy on `clearUserSpecificStores`; simulate a 401 response through the full `errorInterceptor.handleAuthFailure()` → `onSessionExpired` callback chain; assert `clearUserSpecificStores()` is called exactly once after `expireSession()` resolves; assert it is NOT called when 401 arrives on unauthenticated context (guard blocks before `onSessionExpired`)
- [X] T056 [P] Create integration test file tests/integration/backoffice/auth/session-clear-wiring.test.ts with identical wiring integration test cases as T055
- [X] T057 [P] Create integration test file tests/integration/frontoffice/auth/session-clear-wiring.test.ts with identical wiring integration test cases as T055

---

## Phase 11 — Polish: Lint & TypeCheck (Group H)

> Run after all implementation and test tasks complete. Validates constitutional enforcement rules at toolchain level.

- [X] T038 Run ESLint across all three apps (`eslint apps/mmc/src apps/backoffice/src apps/frontoffice/src`) and resolve any violations introduced by this stage (zero auth-related ESLint violations required for merge)
- [X] T039 Run TypeScript type check across all three apps (`tsc -p apps/mmc/tsconfig.app.json --noEmit && tsc -p apps/backoffice/tsconfig.app.json --noEmit && tsc -p apps/frontoffice/tsconfig.app.json --noEmit`) and resolve all type errors before merge

---

## Dependency Graph

```
T001─T003 (license-status.store) ──────────────────────────┐
                                                            │
T004─T006 (token-redact.ts) ──── T007─T009 (index.ts re-export)
         │
         └──────────────────────────────────────────────────┐
                                                            │
T010─T012 (auth.store expireSession) ─────┐                 │
                                          ▼                 ▼
                                   T013─T015 (error.interceptor.ts)
                                          │
                                          ▼
                                   T016─T018 (client.ts factory)
                                          │
                           ┌─────────────┴──────────────┐
                           ▼                             ▼
                    T019─T021 (auth.guard.ts)     T022─T024 (main.ts wiring)
                                                  (also needs T001─T003)
                           │
                           ▼
                       T025 (ESLint vue/no-v-html)
                           │
                           ▼
                    T026─T037 (Group G tests — all parallel)
                           │
                           ▼
                    T038─T039 (Group H lint + typecheck)
```

### Story completion order (MVP first)

1. **US1 complete** when T004–T009 pass (token redact + re-export, 3 apps)
2. **US2 complete** when T010–T018 pass (expireSession + interceptor + client, 3 apps)
3. **US3 complete** when T019–T021 pass (guard redirect, 3 apps)
4. **US4 complete** when T001–T003 + T022–T024 pass (license store + main.ts wiring, 3 apps)
5. **US5 complete** when T025 passes (ESLint check)
6. **Stage complete** when T026–T057 + T038–T039 pass (tests + lint + typecheck)

---

## Parallel Execution Examples

### Batch 1 — Fully independent (run simultaneously)

```
T001 Create license-status.store.ts (MMC)
T002 Create license-status.store.ts (Backoffice)
T003 Create license-status.store.ts (Frontoffice)
T004 Create token-redact.ts (MMC)
T005 Create token-redact.ts (Backoffice)
T006 Create token-redact.ts (Frontoffice)
T010 Add expireSession() (MMC)
T011 Add expireSession() (Backoffice)
T012 Add expireSession() (Frontoffice)
```

### Batch 2 — After Batch 1 completes

```
T007 Re-export from auth/index.ts (MMC)
T008 Re-export from auth/index.ts (Backoffice)
T009 Re-export from auth/index.ts (Frontoffice)
T013 Create error.interceptor.ts (MMC)
T014 Create error.interceptor.ts (Backoffice)
T015 Create error.interceptor.ts (Frontoffice)
```

### Batch 3 — After Batch 2 completes

```
T016 Extend client.ts (MMC)
T017 Extend client.ts (Backoffice)
T018 Extend client.ts (Frontoffice)
```

### Batch 4 — After Batch 3 completes

```
T019 Extend auth.guard.ts (MMC)
T020 Extend auth.guard.ts (Backoffice)
T021 Extend auth.guard.ts (Frontoffice)
T022 Update main.ts wiring (MMC)
T023 Update main.ts wiring (Backoffice)
T024 Update main.ts wiring (Frontoffice)
T025 Enforce ESLint vue/no-v-html as 'error'
```

### Batch 5 — All tests in parallel (after Batch 4)

```
T026–T037 (unit + store test tasks)
T040–T054 (security audit, header injection, 401 race, license store, route coverage — all parallel)
T055–T057 (clearUserSpecificStores spy extensions — parallel)
```

### Batch 6 — After Batch 5

```
T038 ESLint validation
T039 TypeScript type check
```

---

## Implementation Strategy

**MVP scope**: US2 (session expiry) is the highest-risk gap identified in research. Prioritise T010–T018 first as they close the authenticated-401 / unauthenticated-401 distinction bug.

**Incremental delivery order**:

1. U2 (T010–T018) — closes the critical 401 isAuthenticated gap
2. US1 (T004–T009) — adds token redaction safety (no production risk, pure utility)
3. US3 (T019–T021) — improves UX (pre-expiry redirect preservation)
4. US4 (T001–T003, T022–T024) — wires license 423/426 UI state
5. US5 (T025) — ESLint compliance
6. G + H — tests and validation

Each app (MMC → Backoffice → Frontoffice) can proceed in sequence or in parallel depending on team capacity. All factory signatures are identical across apps.

---

## Files Created by This Stage

| File                                                                   | Task | Status |
| ---------------------------------------------------------------------- | ---- | ------ |
| apps/mmc/src/core/auth/token-redact.ts                                 | T004 | NEW    |
| apps/backoffice/src/core/auth/token-redact.ts                          | T005 | NEW    |
| apps/frontoffice/src/core/auth/token-redact.ts                         | T006 | NEW    |
| apps/mmc/src/core/api/interceptors/error.interceptor.ts                | T013 | NEW    |
| apps/backoffice/src/core/api/interceptors/error.interceptor.ts         | T014 | NEW    |
| apps/frontoffice/src/core/api/interceptors/error.interceptor.ts        | T015 | NEW    |
| apps/mmc/src/core/state/license-status.store.ts                        | T001 | NEW    |
| apps/backoffice/src/core/state/license-status.store.ts                 | T002 | NEW    |
| apps/frontoffice/src/core/state/license-status.store.ts                | T003 | NEW    |
| tests/unit/mmc/core/auth/token-redact.test.ts                          | T026 | NEW    |
| tests/unit/backoffice/core/auth/token-redact.test.ts                   | T027 | NEW    |
| tests/unit/frontoffice/core/auth/token-redact.test.ts                  | T028 | NEW    |
| tests/unit/mmc/core/api/interceptors/error.interceptor.test.ts         | T029 | NEW    |
| tests/unit/backoffice/core/api/interceptors/error.interceptor.test.ts  | T030 | NEW    |
| tests/unit/frontoffice/core/api/interceptors/error.interceptor.test.ts | T031 | NEW    |
| tests/unit/mmc/core/state/license-status.store.test.ts                 | T049 | NEW    |
| tests/unit/backoffice/core/state/license-status.store.test.ts          | T050 | NEW    |
| tests/unit/frontoffice/core/state/license-status.store.test.ts         | T051 | NEW    |
| tests/unit/mmc/core/auth/token-persistence-audit.test.ts               | T040 | NEW    |
| tests/unit/backoffice/core/auth/token-persistence-audit.test.ts        | T041 | NEW    |
| tests/unit/frontoffice/core/auth/token-persistence-audit.test.ts       | T042 | NEW    |
| tests/unit/mmc/core/api/client.test.ts                                 | T043 | NEW    |
| tests/unit/backoffice/core/api/client.test.ts                          | T044 | NEW    |
| tests/unit/frontoffice/core/api/client.test.ts                         | T045 | NEW    |
| tests/integration/mmc/auth/401-race.test.ts                            | T046 | NEW    |
| tests/integration/backoffice/auth/401-race.test.ts                     | T047 | NEW    |
| tests/integration/frontoffice/auth/401-race.test.ts                    | T048 | NEW    |
| tests/unit/mmc/core/router/guards/route-coverage-audit.test.ts         | T052 | NEW    |
| tests/unit/backoffice/core/router/guards/route-coverage-audit.test.ts  | T053 | NEW    |
| tests/unit/frontoffice/core/router/guards/route-coverage-audit.test.ts | T054 | NEW    |
| tests/unit/mmc/core/router/guards/auth.guard.redirect.test.ts          | T032 | NEW    |
| tests/unit/backoffice/core/router/guards/auth.guard.redirect.test.ts   | T033 | NEW    |
| tests/unit/frontoffice/core/router/guards/auth.guard.redirect.test.ts  | T034 | NEW    |
| tests/integration/mmc/auth/session-clear-wiring.test.ts                | T055 | NEW    |
| tests/integration/backoffice/auth/session-clear-wiring.test.ts         | T056 | NEW    |
| tests/integration/frontoffice/auth/session-clear-wiring.test.ts        | T057 | NEW    |

## Files Modified by This Stage

| File                                                  | Task | Change                                                |
| ----------------------------------------------------- | ---- | ----------------------------------------------------- |
| apps/mmc/src/core/auth/index.ts                       | T007 | Add token-redact re-exports                           |
| apps/backoffice/src/core/auth/index.ts                | T008 | Add token-redact re-exports                           |
| apps/frontoffice/src/core/auth/index.ts               | T009 | Add token-redact re-exports                           |
| apps/mmc/src/core/state/auth.store.ts                 | T010 | Add expireSession() action                            |
| apps/backoffice/src/core/state/auth.store.ts          | T011 | Add expireSession() action                            |
| apps/frontoffice/src/core/state/auth.store.ts         | T012 | Add expireSession() action                            |
| apps/mmc/src/core/api/client.ts                       | T016 | Add IErrorInterceptor param                           |
| apps/backoffice/src/core/api/client.ts                | T017 | Add IErrorInterceptor param                           |
| apps/frontoffice/src/core/api/client.ts               | T018 | Add IErrorInterceptor param                           |
| apps/mmc/src/core/router/guards/auth.guard.ts         | T019 | Add redirect preservation                             |
| apps/backoffice/src/core/router/guards/auth.guard.ts  | T020 | Add redirect preservation                             |
| apps/frontoffice/src/core/router/guards/auth.guard.ts | T021 | Add redirect preservation                             |
| apps/mmc/src/main.ts                                  | T022 | Wire errorInterceptor + clearUserSpecificStores       |
| apps/backoffice/src/main.ts                           | T023 | Wire errorInterceptor + clearUserSpecificStores       |
| apps/frontoffice/src/main.ts                          | T024 | Wire errorInterceptor + clearUserSpecificStores       |
| eslint.config.mjs                                     | T025 | Enable vue/no-v-html 'error' (audit + sanitize first) |
| tests/unit/mmc/core/state/auth.store.test.ts          | T035 | Extend with expireSession() cases                     |
| tests/unit/backoffice/core/state/auth.store.test.ts   | T036 | Extend with expireSession() cases                     |
| tests/unit/frontoffice/core/state/auth.store.test.ts  | T037 | Extend with expireSession() cases                     |
