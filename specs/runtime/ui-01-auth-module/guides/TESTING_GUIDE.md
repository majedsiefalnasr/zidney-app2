# Testing Guide — STAGE_UI_01_AUTH_MODULE

**Stage:** STAGE_UI_01_AUTH_MODULE  
**Phase:** 06_UI_APPLICATION_RUNTIME  
**Stage Directory:** `ui-01-auth-module`  
**Generated On:** 2026-03-01

---

## Purpose

This guide explains how to validate the auth module implementation end-to-end. It is intended for
developers reviewing the PR or QA engineers validating behavior before merge.

---

## Summary of Delivered Behavior

The auth module wires session lifecycle (login, refresh, logout) across all three front-end apps —
MMC, Backoffice, and Frontoffice — using a factory-based architecture that keeps app-level routing
isolated from core auth logic.

Key outcomes:

- Access tokens live in memory only — no cookies, no localStorage, no sessionStorage writes
- A single concurrent 401 triggers exactly one refresh call; all other in-flight requests wait on it
  (single-flight lock)
- Route guards block unauthenticated access and redirect authenticated users away from guest-only
  pages
- Logout unconditionally clears state even if the backend call fails
- Session is initialized at app bootstrap (`main.ts`) before any route navigation resolves

---

## Prerequisites

| Requirement                | Validation Command / Check                        |
| -------------------------- | ------------------------------------------------- |
| Bun installed              | `bun --version` (v1+)                             |
| Correct branch checked out | `git branch --show-current` → `ui-01-auth-module` |
| Dependencies installed     | `cd apps/mmc && bun install`                      |

No database migrations or Docker services required — this stage is UI-only.

---

## Files in Scope

```text
apps/mmc/src/core/auth/types.ts
apps/mmc/src/core/auth/token-manager.ts
apps/mmc/src/core/auth/refresh-manager.ts
apps/mmc/src/core/auth/auth.service.ts
apps/mmc/src/core/auth/index.ts
apps/mmc/src/core/state/auth.store.ts
apps/mmc/src/core/router/guards/auth.guard.ts
apps/mmc/src/core/router/types.ts
apps/mmc/src/core/api/client.ts        (modified — interceptor wiring)
apps/mmc/src/main.ts                   (modified — 9-step bootstrap)
apps/mmc/src/core/router/index.ts      (modified — guard registration)

apps/backoffice/src/core/auth/           (same structure as MMC)
apps/backoffice/src/core/state/auth.store.ts
apps/backoffice/src/core/router/guards/auth.guard.ts
apps/backoffice/src/core/api/client.ts
apps/backoffice/src/main.ts

apps/frontoffice/src/core/auth/          (same structure as MMC)
apps/frontoffice/src/core/state/auth.store.ts
apps/frontoffice/src/core/router/guards/auth.guard.ts
apps/frontoffice/src/core/api/client.ts
apps/frontoffice/src/main.ts

DELETED:
apps/mmc/src/core/auth/token-store.ts
apps/backoffice/src/core/auth/token-store.ts
apps/frontoffice/src/core/auth/token-store.ts
apps/mmc/src/core/guards/auth.guard.ts
apps/backoffice/src/core/guards/auth.guard.ts
apps/frontoffice/src/core/guards/auth.guard.ts
```

---

## Automated Test Suite

### Run all MMC auth tests

```bash
cd apps/mmc
bunx vitest run --config vitest.config.ts
```

Expected output:

```
 Test Files  12 passed (12)
      Tests  143 passed (143)
```

### Individual test files and what they cover

| Test File                                           | Tests | Covers                                               |
| --------------------------------------------------- | ----- | ---------------------------------------------------- |
| `tests/unit/auth/token-manager.test.ts`             | 11    | In-memory storage, no localStorage/sessionStorage    |
| `tests/unit/auth/refresh-manager.test.ts`           | 10    | Single-flight guarantee, onLogout called once        |
| `tests/unit/auth/auth.store.test.ts`                | 27    | Store state, MEDIUM-02 logout ordering, idempotency  |
| `tests/unit/auth/auth.guard.test.ts`                | 9     | requiresAuth / guestOnly routing decisions           |
| `tests/unit/auth/auth.service.test.ts`              | 13    | login response, logout fire-and-forget, typed errors |
| `tests/integration/auth/concurrent-refresh.test.ts` | 5     | 5 concurrent calls → refreshFn called exactly once   |
| `tests/integration/auth/session-init.test.ts`       | 10    | Bootstrap guard blocking and unblocking              |
| `tests/integration/auth/logout-flow.test.ts`        | 13    | State cleared unconditionally, double-logout guard   |

---

## TypeScript Check

```bash
# MMC
bunx tsc --noEmit -p apps/mmc/tsconfig.json

# Backoffice
bunx tsc --noEmit -p apps/backoffice/tsconfig.json

# Frontoffice
bunx tsc --noEmit -p apps/frontoffice/tsconfig.json
```

All three must exit with code 0 and zero errors.

---

## Lint Check

```bash
# Run from repo root
bunx eslint apps/mmc/src/core/auth apps/mmc/src/core/state/auth.store.ts apps/mmc/src/core/router/guards --no-warn-ignored

# For backoffice + frontoffice
find apps/backoffice/src/core/auth apps/frontoffice/src/core/auth -name "*.ts" | xargs bunx eslint --no-warn-ignored
```

Expected: exit 0, no errors.

---

## Security Verification Commands

Run these to confirm constitutional constraints:

```bash
# No tokens or sensitive data in logs
grep -rn "accessToken\|refreshToken\|password\|Authorization" apps/mmc/src/core/auth/ apps/backoffice/src/core/auth/ apps/frontoffice/src/core/auth/
# Expected: only in type definitions/interface declarations, NOT in log calls

# No browser storage writes
grep -rn "localStorage\|sessionStorage\|document\.cookie" apps/mmc/src/core/ apps/backoffice/src/core/ apps/frontoffice/src/core/
# Expected: 0 matches (exit 1)

# No console.* calls
grep -rn "console\." apps/mmc/src/core/auth/ apps/backoffice/src/core/auth/ apps/frontoffice/src/core/auth/
# Expected: 0 matches (exit 1)

# token-store.ts deleted
find apps/ -name "token-store.ts"
# Expected: no output
```

---

## Manual Test Scenarios

### Scenario 1 — Successful Login (MMC)

**Setup:** MMC app running (`bun run dev:mmc`), valid credentials available.

**Steps:**

1. Navigate to `/mmc/login` (or the MMC login route)
2. Enter valid credentials and submit
3. Observe redirect to the authenticated dashboard
4. Open DevTools → Application tab → confirm no new entries in localStorage or sessionStorage
5. Open DevTools → Network tab → confirm subsequent API requests include
   `Authorization: Bearer <token>` header

**Expected:** User is authenticated, token is carried in request headers, zero persistent storage
writes.

---

### Scenario 2 — Unauthenticated Access Redirects to Login

**Setup:** No active session (fresh browser / cleared session).

**Steps:**

1. Navigate directly to a protected route (e.g., `/mmc/dashboard`)
2. Observe redirect to login page
3. After login, confirm redirect back to originally requested route

**Expected:** Guard blocks access and redirects. Login route is accessible without authentication.

---

### Scenario 3 — Authenticated User Cannot Access Guest-Only Routes

**Setup:** Active authenticated session.

**Steps:**

1. Navigate directly to `/mmc/login` while authenticated
2. Observe redirect away from login to the default authenticated route

**Expected:** `guestOnly: true` meta tag causes guard to redirect authenticated users away.

---

### Scenario 4 — Token Refresh on 401

**Setup:** Active session where the access token has been invalidated on the server.

**Steps:**

1. Invalidate the access token on the server (or wait for natural expiry)
2. Trigger an API call from the authenticated UI (e.g., refresh the dashboard)
3. Observe the API client automatically retrying with a new token
4. Confirm the user is not logged out and the action succeeds

**Expected:** Single transparent refresh; user sees no interruption. Only one refresh call even if
multiple concurrent requests hit 401 simultaneously.

---

### Scenario 5 — Refresh Failure Forces Logout

**Setup:** Active session. Backend is configured to reject refresh attempts.

**Steps:**

1. Invalidate the access token
2. Ensure the refresh endpoint returns 401 or 403
3. Trigger any API call from the authenticated UI

**Expected:** Auth fails → `onAuthFailure` fires → `authStore.logout()` called → state cleared →
user redirected to login.

---

### Scenario 6 — Logout Clears State Unconditionally

**Setup:** Active session.

**Steps:**

1. Click logout
2. Confirm redirect to login page
3. Open DevTools → Application → confirm no tokens in any storage
4. Press browser back button — confirm protected routes redirect to login

**Expected:** State fully cleared even if backend call fails. No stale tokens remain anywhere.

---

### Scenario 7 — Double Logout is Safe (Idempotency)

**Setup:** Active session.

**Steps:**

1. Call logout programmatically twice in rapid succession (can be tested via browser console:
   `window.__auth?.logout(); window.__auth?.logout()`)
2. Observe only one navigation event and one backend call

**Expected:** Second logout call is a no-op (`isLoading` guard). No double navigation. No errors.

---

### Scenario 8 — Bootstrap Does Not Flash Login Page

**Setup:** User has a valid session (refresh token in HttpOnly cookie).

**Steps:**

1. Reload the app (hard refresh `Cmd+Shift+R`)
2. Observe the page load behavior

**Expected:** `initSession()` in `main.ts` restores the session before router guards run. No flash
of the login page for an already-authenticated user.

---

## Known Limitations

| Limitation                                        | Notes                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| Backoffice + Frontoffice tests deferred           | No vitest.config in those apps. MMC tests cover shared auth patterns. |
| Manual token invalidation required for Scenario 4 | Requires backend cooperation or a test helper endpoint                |

---

## Files to Review for Code Quality

| File                                        | What to focus on                                            |
| ------------------------------------------- | ----------------------------------------------------------- |
| `apps/mmc/src/core/auth/refresh-manager.ts` | Single-flight lock implementation; `inFlight` pattern       |
| `apps/mmc/src/core/state/auth.store.ts`     | `logout()` MEDIUM-02 compliance; lazy `getRefreshManager`   |
| `apps/mmc/src/main.ts`                      | Bootstrap order: pinia → store → refreshManager → lazy wire |
| `apps/mmc/src/core/api/client.ts`           | Interceptor callbacks; no token logged                      |
