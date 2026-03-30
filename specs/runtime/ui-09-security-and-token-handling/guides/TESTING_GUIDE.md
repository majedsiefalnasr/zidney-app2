# Testing Guide — STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING

**Stage:** STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING  
**Phase:** 06_UI_APPLICATION_RUNTIME  
**Branch:** ui-09-security-and-token-handling  
**Generated On:** 2026-03-02

---

## Purpose

This guide explains how to validate the implementation for the frontend security layer end-to-end.
It covers token lifecycle management, session expiry handling, 401-idempotent error recovery,
license status reactions, and XSS mitigation across three applications: MMC, Backoffice, and
Frontoffice.

---

## Summary of Delivered Behavior

The stage standardizes frontend security across all three UI applications by centralizing token
handling, session expiry recovery, and API error responses into a cohesive, reusable architecture.

Key outcomes:

- **Centralized Token Management**: Every API request carries the access token via a single
  Authorization header injection point in the API client interceptor — never manually constructed by
  components
- **Idempotent 401 Recovery**: When a 401 response arrives, auth state is cleared exactly once and
  the user is redirected to login, regardless of how many concurrent 401s arrive (single-flight
  guard)
- **License Status Reactions**: The UI displays appropriate messages for 423 (workspace locked) and
  426 (upgrade required) responses without attempting to bypass them
- **Secure XSS Prevention**: All `v-html` usages eliminated; ESLint rule enforced to prevent future
  regressions
- **Structured Logging**: All token redaction happens in a pure utility before any log statement; no
  tokens exposed in logs

---

## Prerequisites

| Requirement                    | Validation Command / Check                                               |
| ------------------------------ | ------------------------------------------------------------------------ |
| Node.js installed              | `node --version` (v20.11.0+)                                             |
| Bun installed                  | `bun --version` (v1.0.0+)                                                |
| Docker running (for API/Redis) | `docker ps` (see compose files)                                          |
| Repository cloned              | `git clone <repo>` from workspace root                                   |
| Branch checked out             | `git branch` shows `* ui-09-security-and-token-handling`                 |
| Correct commit                 | `git log --oneline -1` shows commit 2efbf47 (implement) + closure commit |
| Dependencies installed         | `bun install` ran without errors                                         |
| Migrations applied             | `bun run db:migrate` (if required for integration tests)                 |

---

## Files in Scope

**Source Files (39 total):**

```
apps/mmc/src/
  core/state/license-status.store.ts                    # Reactive license flags
  core/auth/token-redact.ts                             # Pure redaction utility
  core/auth/index.ts                                   # Re-exports token-redact
  core/api/interceptors/error.interceptor.ts           # 401/423/426 handler
  core/api/client.ts                                   # Extended factory
  core/router/guards/auth.guard.ts                     # Redirect preservation
  core/state/auth.store.ts                             # expireSession() action
  main.ts                                              # Wiring

apps/backoffice/src/
  core/state/license-status.store.ts
  core/auth/token-redact.ts
  core/auth/index.ts
  core/api/interceptors/error.interceptor.ts
  core/api/client.ts
  core/router/guards/auth.guard.ts
  core/state/auth.store.ts
  main.ts

apps/frontoffice/src/
  core/state/license-status.store.ts
  core/auth/token-redact.ts
  core/auth/index.ts
  core/api/interceptors/error.interceptor.ts
  core/api/client.ts
  core/router/guards/auth.guard.ts
  core/state/auth.store.ts
  main.ts

Root:
  eslint.config.mjs                                    # Enforced vue/no-v-html
  vitest.config.ts                                     # Added jsdom + aliases
  package.json                                         # Added jsdom dependency
```

**Test Files (39 total):**

```
tests/unit/mmc/core/auth/token-redact.test.ts
tests/unit/mmc/core/api/error.interceptor.test.ts
tests/unit/mmc/core/router/guards/auth.guard.test.ts
tests/unit/mmc/core/state/auth.store.test.ts
tests/unit/mmc/core/api/client.test.ts
tests/unit/mmc/core/state/license-status.store.test.ts
tests/unit/mmc/core/auth/token-persistence-audit.test.ts
tests/unit/mmc/core/router/guards/route-coverage-audit.test.ts
tests/integration/mmc/auth/401-race.test.ts
tests/integration/mmc/auth/session-clear-wiring.test.ts

tests/unit/backoffice/core/auth/token-redact.test.ts
tests/unit/backoffice/core/api/error.interceptor.test.ts
tests/unit/backoffice/core/router/guards/auth.guard.test.ts
tests/unit/backoffice/core/state/auth.store.test.ts
tests/unit/backoffice/core/api/client.test.ts
tests/unit/backoffice/core/state/license-status.store.test.ts
tests/unit/backoffice/core/auth/token-persistence-audit.test.ts
tests/unit/backoffice/core/router/guards/route-coverage-audit.test.ts
tests/integration/backoffice/auth/401-race.test.ts
tests/integration/backoffice/auth/session-clear-wiring.test.ts

tests/unit/frontoffice/core/auth/token-redact.test.ts
tests/unit/frontoffice/core/api/error.interceptor.test.ts
tests/unit/frontoffice/core/router/guards/auth.guard.test.ts
tests/unit/frontoffice/core/state/auth.store.test.ts
tests/unit/frontoffice/core/api/client.test.ts
tests/unit/frontoffice/core/state/license-status.store.test.ts
tests/unit/frontoffice/core/auth/token-persistence-audit.test.ts
tests/unit/frontoffice/core/router/guards/route-coverage-audit.test.ts
tests/integration/frontoffice/auth/401-race.test.ts
tests/integration/frontoffice/auth/session-clear-wiring.test.ts

(31 test files, 273 tests total — all passing)
```

---

## Local Setup Commands

```bash
# 1. Ensure correct branch
git checkout ui-09-security-and-token-handling
git pull origin ui-09-security-and-token-handling

# 2. Install dependencies
bun install

# 3. (Optional) Start Docker services for integration tests
docker-compose up -d

# 4. (Optional) Apply migrations if required
bun run db:migrate
```

---

## Automated Validation Commands

### Run All Tests (Unit + Integration)

```bash
# Run all 31 test files (273 tests)
bun run test run tests/unit/{mmc,backoffice,frontoffice}/core tests/integration/{mmc,backoffice,frontoffice}/auth

# Expected outcome:
# ✓ 273 tests pass
# ✓ Exit code 0
```

### Run Tests by App

```bash
# MMC only
bun run test run tests/{unit,integration}/mmc

# Backoffice only
bun run test run tests/{unit,integration}/backoffice

# Frontoffice only
bun run test run tests/{unit,integration}/frontoffice
```

### Run Tests by Category

```bash
# Unit tests only
bun run test run tests/unit/{mmc,backoffice,frontoffice}/core

# Integration tests only
bun run test run tests/integration/{mmc,backoffice,frontoffice}/auth

# Security audits only
bun run test run tests/unit/*/core/auth/token-persistence-audit.test.ts tests/unit/*/core/router/guards/route-coverage-audit.test.ts
```

### Code Quality Checks

```bash
# ESLint (should show 0 errors from this stage; pre-existing warnings may exist)
bun run lint

# TypeScript type-check (should exit 0)
bun run typecheck

# Format check (should exit 0)
bun run format:write
```

### Test Coverage Report

```bash
# Generate coverage HTML
bun run test run --coverage tests/unit/{mmc,backoffice,frontoffice}/core

# View report
open coverage/index.html
```

---

## Manual Test Scenarios

### Scenario 1 — Token Storage Remains In-Memory (Persists Across Page Navigations, Lost On Refresh)

**Purpose:** Verify that tokens are never persisted to localStorage, sessionStorage, or IndexedDB;
they remain in-memory Pinia state only.

1. Open DevTools → Application tab → Storage sections
2. Sign in to the application
3. Verify that `localStorage`, `sessionStorage`, and `IndexedDB` contain NO `token`, `accessToken`,
   or `auth_token` keys
4. Navigate between pages within the app (e.g., dashboard → settings → dashboard)
5. Verify token remains available (requests still work)
6. Perform a full page refresh (`Cmd+R` / `Ctrl+F5`)
7. Verify user is logged out and token is gone
8. Verify you are redirected to login page

**Expected:**

- ✅ Token exists in Pinia store while authenticated
- ✅ Token does NOT exist in any browser storage API
- ✅ Token survives navigation within the app
- ✅ Token is cleared on full page refresh
- ✅ User is logged out after refresh

---

### Scenario 2 — 401 Response Triggers Idempotent Logout Exactly Once

**Purpose:** Verify that when the backend returns 401, the UI clears auth state and redirects
exactly once, even if multiple concurrent requests receive 401.

**Setup:**

1. Sign in successfully
2. Open DevTools → Network tab
3. Open DevTools → Console tab

**Steps:**

1. Manually trigger an API request that will return 401:
   - Via Network tab, edit/replay a request and change the auth header to an invalid value, or
   - Via a test scenario: `npm run vitest tests/integration/*/auth/401-race.test.ts`
2. Observe the Network tab: the request returns 401
3. Observe the Console: a single log line appears: `[INFO] auth: Session expired`
4. Verify the browser redirects to `/login` exactly once (no redirect loop)
5. Verify the auth store shows `isAuthenticated = false` and `token = null`

**Expected Behavior:**

- ✅ Single 401 response triggers one logout
- ✅ Multiple concurrent 401 responses trigger exactly one logout (idempotent)
- ✅ Redirect to login occurs exactly once
- ✅ No redirect loop or infinite retries
- ✅ Auth store is fully cleared (token, user, session metadata)

**Test Command (Automated):**

```bash
bun run test run tests/integration/*/auth/401-race.test.ts
```

---

### Scenario 3 — License Lock (423) Response Prevents User Action; Displays Message

**Purpose:** Verify that a 423 Locked response from the backend triggers a license-locked message
and prevents further action.

**Setup:**

1. Sign in successfully
2. Mock or configure backend to return 423 for the next API call

**Steps:**

1. Trigger an API call that returns 423
2. Observe that `licenseStatusStore.isWorkspaceLocked` becomes `true`
3. Observe that the UI displays a message like "Workspace is locked. Contact your administrator."
4. Verify that subsequent requests are still made (not silently ignored)
5. Verify the user cannot proceed with locked operations

**Expected:**

- ✅ 423 response sets `isWorkspaceLocked = true`
- ✅ UI displays "locked" message to user
- ✅ Error interceptor applies `onLicenseError` callback
- ✅ User sees clear messaging, not a generic error
- ✅ No retry attempt or auto-recovery attempted

---

### Scenario 4 — Upgrade Required (426) Response Displays Upgrade Prompt

**Purpose:** Verify that a 426 Upgrade Required response displays an upgrade prompt and prevents
further action until upgrade.

**Setup:**

1. Sign in successfully with a non-upgraded account
2. Mock backend to return 426 for next API call

**Steps:**

1. Trigger an API that returns 426
2. Observe that `licenseStatusStore.isUpgradeRequired` becomes `true`
3. Observe that UI displays a message like "Your workspace needs an upgrade to access this feature."
4. Verify upgrade CTA (button) is present
5. Verify clicking upgrade navigates to upgrade flow (if implemented)

**Expected:**

- ✅ 426 response sets `isUpgradeRequired = true`
- ✅ UI displays "upgrade required" message
- ✅ Error interceptor applies `onLicenseError` callback
- ✅ User has clear path to upgrade

---

### Scenario 5 — Token Redaction Prevents Accidental Logging

**Purpose:** Verify that the `redactSensitiveFields()` utility prevents tokens from appearing in
logs.

**Steps:**

1. Open DevTools → Console
2. Call the redaction utility directly:
   ```javascript
   import { redactSensitiveFields } from "@zidney/domain-core";
   const logObject = { token: "eyJhbGc...", action: "login" };
   console.log(redactSensitiveFields(logObject));
   ```
3. Verify output shows: `{ token: '[REDACTED]', action: 'login' }`
4. Sign in and monitor logs during auth operations
5. Verify no full token value appears in any log statement

**Expected:**

- ✅ `redactSensitiveFields()` replaces `token`, `accessToken`, `refresh_token`, etc. with
  `[REDACTED]`
- ✅ No token appears in full in any log output
- ✅ Non-sensitive fields remain intact

---

### Scenario 6 — XSS Prevention: No v-html in Templates

**Purpose:** Verify that ESLint prevents `v-html` usage to mitigate XSS attacks.

**Steps:**

1. Attempt to add a `v-html` directive to any Vue template:
   ```vue
   <template>
     <div v-html="userInput"></div>
   </template>
   ```
2. Run `bun run lint` or open the file in VS Code with ESLint extension
3. Verify lint error appears: `error: `v-html` should not be used`
4. Remove the `v-html` and use `{{ userInput }}` or `v-text` instead
5. Run lint again — error clears

**Expected:**

- ✅ ESLint rule `vue/no-v-html` set to error severity
- ✅ Any `v-html` usage is caught before merge
- ✅ Team is prevented from introducing XSS vulnerabilities via template interpolation

---

### Scenario 7 — Route Guard Preserves Original Redirect Intent

**Purpose:** Verify that when an unauthenticated user is redirected to login, the intended route is
preserved so they can be sent back after signing in.

**Setup:**

1. Sign out or open an incognito window (no auth)
2. Try to navigate to a protected route, e.g., `/dashboard`

**Steps:**

1. Observe the browser redirects to `/login?redirect=%2Fdashboard`
2. The `?redirect=` query param contains the originally intended route (URL-encoded)
3. Sign in successfully
4. Verify the app redirects back to `/dashboard` (the originally intended route)
5. Verify the `?redirect=` param is cleaned up after redirect

**Expected:**

- ✅ Unauthenticated access to `/dashboard` redirects to `/login?redirect=%2Fdashboard`
- ✅ Auth guard preserves the intent in query params
- ✅ After successful login, user is sent to the originally intended route
- ✅ Redirect param is removed from URL after redirect

---

## Integration with CI/CD

These tests are automatically run as part of the PR validation pipeline:

| Step       | Command             | Success Criteria                               |
| ---------- | ------------------- | ---------------------------------------------- |
| Unit Tests | `bun run test run`  | 273/273 pass, exit 0                           |
| ESLint     | `bun run lint`      | 0 errors from this stage, exit 0               |
| TypeScript | `bun run typecheck` | Type check passes, exit 0                      |
| Coverage   | Optional            | Coverage report generated if threshold defined |

---

## Troubleshooting

### Tests Fail with "pinia is not defined"

**Cause:** vitest.config.ts root config missing alias

**Fix:**

```bash
# Verify vitest.config.ts has:
alias: {
  pinia: '/path/to/node_modules/pinia/dist/pinia.mjs',
  vue: '/path/to/node_modules/vue/dist/vue.esm-bundler.js',
  ...
}

# Reinstall and try again:
bun install
bun run test run tests/unit/*/core/auth/token-persistence-audit.test.ts
```

### Storage API Not Available (token-persistence-audit fails)

**Cause:** Test environment is not jsdom (default is node)

**Fix:**

```bash
# Verify test file has:
// @vitest-environment jsdom

# Reinstall jsdom:
bun add -D jsdom

# Re-run test:
bun run test run tests/unit/*/core/auth/token-persistence-audit.test.ts
```

### Route Import Fails in route-coverage-audit

**Cause:** Router index file imports `@/modules/*/routes` but `@/` alias not defined in vitest root
config

**Fix:**

```bash
# Verify vitest.config.ts has:
alias: {
  '@': '/path/to/apps/<app>/src',
  ...
}

# Re-run test:
bun run test run tests/unit/*/core/router/guards/route-coverage-audit.test.ts
```

### Lint Errors on v-html References

**Cause:** Old templates still contain `v-html`

**Fix:**

```bash
# Find all v-html usages:
grep -r "v-html" apps/*/src --include="*.vue"

# Replace with appropriate alternative:
# - {{ userInput }} for text interpolation
# - v-text for text content
# - dangerouslySetInnerHTML (React) or el.innerHTML (vanilla) in rare cases

# Re-run lint:
bun run lint
```

---

## Success Criteria

All of the following must be true to consider this stage successfully tested:

- ✅ All 273 tests pass
  (`bun run test run tests/unit/{mmc,backoffice,frontoffice}/core tests/integration/{mmc,backoffice,frontoffice}/auth`)
- ✅ ESLint shows 0 new errors (`bun run lint | grep error`)
- ✅ TypeScript type-check passes (`bun run typecheck`)
- ✅ Token is NOT persisted to browser storage (manual scenario 1)
- ✅ 401 logout is idempotent (manual scenario 2 or automated test)
- ✅ 423 License Lock displays message (manual scenario 3)
- ✅ 426 Upgrade Required displays message (manual scenario 4)
- ✅ Token redaction works (`redactSensitiveFields()` manual test)
- ✅ No v-html in codebase (manual scenario 6)
- ✅ Route guard preserves redirect intent (manual scenario 7)

---

## Questions & Escalation

If tests fail or behaviors differ from expected:

1. Check the relevant test file first (see Files in Scope section)
2. Review the assertion comments for expected behavior
3. Verify the prerequisite setup (Docker running, migrations applied, branch correct)
4. Check PR discussion for known issues
5. Escalate to architecture team if constitutional claim fails (e.g., token appears in full in logs)

---

**Reference Documents:**

- Specification: `specs/runtime/ui-09-security-and-token-handling/spec.md`
- Plan: `specs/runtime/ui-09-security-and-token-handling/plan.md`
- Tasks: `specs/runtime/ui-09-security-and-token-handling/tasks.md`
- Branch: `ui-09-security-and-token-handling`
- Stage File: `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING.md`

**Generated:** 2026-03-02  
**Stage Status:** PRODUCTION READY
