# Testing Guide — STAGE_UI_03_ROUTER_AND_GUARDS

**Stage:** STAGE_UI_03_ROUTER_AND_GUARDS  
**Phase:** 06_UI_APPLICATION_RUNTIME  
**Branch:** ui-03-router-and-guards  
**Generated On:** 2025-07-07

---

## Purpose

This guide explains how to validate the router refactor and guard pipeline implementation across the
three Zidney frontend applications (MMC, Backoffice, Frontoffice).

---

## Summary of Delivered Behavior

The router and guard system has been unified across all three apps using a canonical pattern:

- **Router Factory:** `createAppRouter(history?)` replaces singleton exports for testability
- **Guard Pipeline:** Sequential execution of AuthGuard → WorkspaceGuard (BO only) → RoleGuard →
  FeatureFlagGuard
- **Route Naming:** All routes now follow app-specific prefixes (`mmc-*`, `bo-*`, `fo-*`)
- **RouteMeta Schema:** New canonical fields (`public`, `roles?`, `requiresWorkspace?`) replace
  legacy meta fields
- **Fallback Views:** Consistent unauthorized/error pages across all apps
- **Backoffice Migration:** Legacy router file deleted; all routes migrated to
  `core/router/index.ts`

Key outcomes:

- All 3 apps use identical guard architecture patterns
- Guard pipeline is fully testable without navigating actual routes
- Type-safe route definitions with strict RouteMeta validation
- Session-init gate ensures no guards run before auth initialization
- Error routes (`/error`, `/unauthorized`) render safe fallback pages

---

## Prerequisites

| Requirement            | Validation Command / Check                                      |
| ---------------------- | --------------------------------------------------------------- |
| Node.js installed      | `node --version` (v20+)                                         |
| Bun installed          | `bun --version` (v1+)                                           |
| Correct branch         | `git branch` should show `ui-03-router-and-guards`              |
| Working tree clean     | `git status` should show clean or only build artifacts          |
| Monorepo intact        | `ls apps/mmc apps/backoffice apps/frontoffice` (all exist)      |
| Dependencies installed | `bun install` (run if `bun.lock` is newer than `node_modules/`) |

---

## Files in Scope

**Guard implementations (new):**

- `apps/mmc/src/core/guards/auth.guard.ts`
- `apps/mmc/src/core/guards/role.guard.ts`
- `apps/mmc/src/core/guards/feature-flag.guard.ts`
- `apps/mmc/src/core/guards/index.ts` (registerGuards)
- `apps/backoffice/src/core/guards/*` (same as above) + `workspace.guard.ts`
- `apps/frontoffice/src/core/guards/*` (same as above)

**Router refactors (modified):**

- `apps/mmc/src/core/router/index.ts`
- `apps/mmc/src/core/router/types.ts`
- `apps/backoffice/src/core/router/index.ts`
- `apps/backoffice/src/core/router/types.ts`
- `apps/frontoffice/src/core/router/index.ts`
- `apps/frontoffice/src/core/router/types.ts`

**Bootstrap integration (modified):**

- `apps/mmc/src/main.ts`
- `apps/backoffice/src/main.ts`
- `apps/frontoffice/src/main.ts`

**Fallback views (new):**

- `apps/mmc/src/shared/views/NotFoundView.vue` (renamed)
- `apps/mmc/src/shared/views/UnauthorizedView.vue` (new)
- `apps/mmc/src/shared/views/GlobalErrorView.vue` (new)
- Same for `apps/backoffice/` and `apps/frontoffice/`

**Tests (new):**

- `apps/mmc/src/core/guards/__tests__/*.spec.ts` (4 files)
- `apps/backoffice/src/core/guards/__tests__/*.spec.ts` (4 files + workspace.guard.spec.ts)
- `apps/frontoffice/src/core/guards/__tests__/*.spec.ts` (4 files)
- `apps/mmc/tests/integration/core/router/router.test.ts`
- `apps/backoffice/tests/integration/core/router/router.test.ts`
- `apps/frontoffice/tests/integration/core/router/router.test.ts`

**Legacy cleanup (deleted):**

- `apps/backoffice/src/router/index.ts` (STAGE_17 legacy)
- `apps/mmc/src/core/router/guards/auth.guard.ts` (superseded)
- `apps/backoffice/src/core/router/guards/auth.guard.ts` (superseded)
- `apps/frontoffice/src/core/router/guards/auth.guard.ts` (superseded)

---

## Automated Test Commands

```bash
# Unit tests — MMC
bun --cwd apps/mmc run test

# Unit tests — Backoffice
bun --cwd apps/backoffice run test

# Unit tests — Frontoffice
bun --cwd apps/frontoffice run test

# Integration tests (all apps)
bun --cwd apps/mmc run test:integration
bun --cwd apps/backoffice run test:integration
bun --cwd apps/frontoffice run test:integration

# Type check (root)
bun run typecheck

# Lint (root)
bun run lint

# Coverage (specific app)
bun --cwd apps/mmc run test:coverage
```

**Expected outcome:** All tests pass (baseline 169 MMC, 34 BO new-code, 26 FO new-code).

---

## Manual Test Scenarios

### Scenario 1 — Unauthenticated User Accesses Protected Route

**Purpose:** Verify that unauthenticated users are redirected to the login page when accessing
protected routes, and that the redirect parameter is preserved for post-login navigation.

**Setup:**

1. Clear browser local storage: `localStorage.clear()`
2. Open DevTools (F12)
3. Navigate to MMC: `http://localhost:5173` (or configured dev port)

**Steps:**

1. Ensure no valid auth token exists in localStorage
2. Try to access `/dashboard` (or any route with `requiresAuth: true`)
3. Observe the redirect to `/login?redirect=/dashboard`
4. Verify in DevTools Network tab: guard logged no errors

**Expected:**

- User redirected to login page
- URL shows `?redirect=/dashboard` or similar
- No JavaScript errors in console
- Guard decision logged (if logging enabled): "AuthGuard: requiresAuth but not authenticated"

**Troubleshooting:**

- If redirect doesn't include `?redirect` param: check that `isSafeRedirect()` in auth.guard.ts is
  called
- If user not redirected: verify guard is registered in `registerGuards()` call in `main.ts`
- If errors in console: grep for `console.log` in guard files (should use `@zidney/logger` instead)

---

### Scenario 2 — Authenticated User Accesses Public Route

**Purpose:** Verify that authenticated users cannot bypass the dashboard by accessing login/public
routes; they are redirected to the dashboard instead.

**Setup:**

1. Log in as an admin user on MMC
2. Verify auth token exists in localStorage

**Steps:**

1. Navigate directly to `/login` while authenticated
2. Observe immediate redirect to `/dashboard` (or appropriate dashboard route)
3. Verify no loop occurs (page doesn't redirect infinitely)
4. Check DevTools: guard short-circuit logged (if enabled)

**Expected:**

- Redirect from public route to dashboard when already authenticated
- No infinite redirect loop
- Guard prevents the "already logged in but on login page" confusion

**Troubleshooting:**

- If loop occurs: check for `to.name === loginRouteName` short-circuit in auth.guard.ts
- If not redirected: verify `public: true` meta field is NOT set on the dashboard route

---

### Scenario 3 — WorkspaceGuard Redirects to Workspace Selector (Backoffice only)

**Purpose:** Verify that Backoffice routes requiring a workspace redirect to workspace selector if
workspace is not resolved.

**Setup:**

1. Log into Backoffice as an authenticated user
2. Clear the context store or simulate `contextStore.context === null`

**Steps:**

1. Try to access a workspace-dependent route (e.g., `/dashboard` if it has
   `requiresWorkspace: true`)
2. Observe redirect to `/select-workspace` (bo-workspace-selector route)
3. Verify in browser: URL should show `/select-workspace`
4. If workspace selection is mocked in tests, verify mock was called

**Expected:**

- User redirected to workspace selector when workspace not resolved
- WorkspaceGuard does NOT make any API calls (only checks injected callback)
- No error pages displayed

**Troubleshooting:**

- If user not redirected: verify `isWorkspaceResolved: () => contextStore.context !== null` is
  passed to `registerGuards()`
- If error occurs: check that WorkspaceGuard only calls `isWorkspaceResolved()` and does NOT import
  API client

---

### Scenario 4 — UnauthorizedView Renders When User Lacks Required Role

**Purpose:** Verify that users without required roles see the unauthorized page instead of
blank/broken pages.

**Setup:**

1. Log in as a user with `role: 'viewer'`
2. Identify a route that requires `roles: ['admin']`

**Steps:**

1. Navigate to the admin-only route
2. Observe page shows "You don't have permission to access this page"
3. Click the "Return to Dashboard" link
4. Verify navigation to dashboard works

**Expected:**

- Unauthorized page displays (not 404 or blank)
- Message is user-friendly (no technical jargon)
- Back link points to correct dashboard route per app

**Troubleshooting:**

- If blank page: verify UnauthorizedView.vue component is imported correctly
- If wrong route name in link: check that link uses
  `name: property of dashboard route per app (e.g., `mmc-dashboard`, `bo-dashboard`, `fo-home`)

---

### Scenario 5 — Error Recovery Page Renders on Guard Exception

**Purpose:** Verify that if a guard throws an error, the router redirects to a safe error page
instead of breaking the app.

**Setup:**

1. Create a debug breakpoint in a guard file that forces an exception
2. Or manually trigger by mocking `getIsAuthenticated()` to throw

**Steps:**

1. Trigger the exception condition (e.g., auth callback throws)
2. Observe DevTools: error is logged via `@zidney/logger`
3. Observe browser: redirected to `/error` page
4. Page displays "Something went wrong" with dashboard link

**Expected:**

- Guard catches exception with try/catch
- Error is logged (not silently swallowed)
- User sees safe error page (not crash)
- No stack trace exposed to user

**Troubleshooting:**

- If exception not caught: verify wrap-in-try-catch exists in guard
- If no log: check `@zidney/logger` is imported
- If wrong route name: verify `errorRouteName` passed to `registerGuards()`

---

### Scenario 6 — Route Names Are Consistent Across Modules

**Purpose:** Verify that all module routes follow the naming convention (`mmc-*`, `bo-*`, `fo-*`)
and no old names like `'dashboard'` or `'login'` are used.

**Steps:**

1. Grep for hardcoded old route names:
   ```bash
   grep -r "push.*name.*dashboard\|push.*name.*login\|push.*name.*'not-found'" apps/mmc/src apps/backoffice/src apps/frontoffice/src
   ```
2. Verify result is empty (no old names)
3. Check that all `router.push({ name: '...' })` calls use new names:
   ```bash
   grep -r "push.*name.*mmc-\|push.*name.*bo-\|push.*name.*fo-" apps/mmc/src apps/backoffice/src apps/frontoffice/src | head -10
   ```
4. Verify at least some calls use new prefixed names

**Expected:**

- 0 results for old route names
- Multiple results for new prefixed names
- No mixing of naming styles

**Troubleshooting:**

- If old names found: manually update each `router.push()` call to use new names
- If grep shows nothing: verify apps have component files that use `router.push()`

---

### Scenario 7 — TypeScript Compilation and Type Safety

**Purpose:** Verify no type errors and that RouteMeta augmentations are recognized by TypeScript.

**Steps:**

1. Run full TypeScript check:
   ```bash
   bun run typecheck
   ```
2. Verify exit code is 0 and output shows "0 errors"
3. Open a router types file (e.g., `apps/mmc/src/core/router/types.ts`)
4. Hover over `AppRouteMeta` type: verify IntelliSense shows all new fields (`public`, `roles`,
   `requiresWorkspace`)

**Expected:**

- TypeScript compilation: 0 errors
- IDE IntelliSense recognizes new RouteMeta fields
- No `@ts-ignore` comments in guard files (except where absolutely necessary)

**Troubleshooting:**

- If TypeScript errors: check that `tsconfig.json` includes all app-specific tsconfigs
- If IntelliSense not working: restart TypeScript language server (Ctrl+Shift+P → "TypeScript:
  Restart TS Server")

---

### Scenario 8 — Lint Passes and No Log Statements

**Purpose:** Verify code quality: no console.log, proper imports, no `any` types in guards.

**Steps:**

1. Run lint across all apps:
   ```bash
   bun run lint
   ```
2. Verify exit code is 0
3. Manually check a guard file for:
   - No `console.log` (use `@zidney/logger` instead)
   - All types specified (no implicit `any`)
   - All imports from correct boundaries

**Expected:**

- Lint output: 0 errors (pre-existing issues in other files are acceptable)
- No `console.log` in `src/core/guards/` directory
- No TypeScript `any` types in guard files

**Troubleshooting:**

- If lint errors in guards: fix per ESLint rules (no `any`, proper imports, etc.)
- If `console.log` found: replace with `logger.error()` or appropriate log level

---

### Scenario 9 — No Singleton Router Export (Verify Cleanup)

**Purpose:** Verify legacy singleton router patterns have been removed.

**Steps:**

1. Grep for legacy exports:
   ```bash
   grep -r "export const router" apps/mmc/src/core/router apps/backoffice/src/core/router apps/frontoffice/src/core/router
   grep -r "export default router" apps/mmc/src/core/router apps/backoffice/src/core/router apps/frontoffice/src/core/router
   ```
2. Verify result is empty (0 matches)
3. Verify `main.ts` files use factory pattern:
   ```bash
   grep -r "const router = createAppRouter()" apps/mmc/src/main.ts apps/backoffice/src/main.ts apps/frontoffice/src/main.ts
   ```
4. Verify at least 3 matches (one per app)

**Expected:**

- 0 singleton exports found
- 3+ factory instantiations found in main.ts files

**Troubleshooting:**

- If singleton exports found: manually remove `export const router` and `export default` lines
- If factory not used: ensure `src/main.ts` has appropriate code

---

### Scenario 10 — Live App Navigation (Manual End-to-End)

**Purpose:** Verify the router and guards work in a running application without crashing.

**Setup:**

1. Start dev server for one app:
   ```bash
   bun --cwd apps/mmc run dev
   ```
2. Open browser to `http://localhost:5173` (or configured port)

**Steps:**

1. Without logging in, try to navigate to protected pages (browser address bar)
2. Observe redirects to login
3. Log in with test credentials
4. Navigate between pages
5. Check DevTools: Console should not show exceptions
6. Check Network tab: requests are successful (no 5XX errors from guard logic)

**Expected:**

- Navigation works smoothly
- No crashing or blank screens
- Console clean (no guard-related errors)
- All requests complete successfully

**Troubleshooting:**

- If blank screen: check browser console for errors (likely import or component render issue)
- If navigation hangs: check that guards don't have infinite loops or missing `next()` calls
- If API errors: verify API server is running and reachable

---

## Validation Checklist

Before marking this stage as validated, verify:

- [ ] All automated tests pass (`bun test`, `bun test:integration`)
- [ ] TypeScript compilation passes (`bun run typecheck`)
- [ ] Lint passes (`bun run lint`)
- [ ] No `console.log` in guard files (grep confirms 0 results)
- [ ] No old route names in codebase (grep confirms 0 results)
- [ ] No singleton router exports (grep confirms 0 results)
- [ ] Manual scenarios 1–5 work as expected
- [ ] DevTools shows no exceptions
- [ ] Live app navigation is smooth (scenario 10)
- [ ] `PR_SUMMARY.md` is ready to copy into GitHub

---

## Known Limitations

- **Feature flags:** `createFeatureFlagGuard()` is a stub (always returns `true`). Real feature flag
  support requires a separate stage.
- **jsdom integration tests:** JavaScript navigation (`router.push()`) times out in jsdom. Tests use
  direct guard factory invocation instead (bypasses routing queue but validates guard logic
  completely).
- **Workspace resolution:** Backoffice WorkspaceGuard only checks the injected callback; it does NOT
  make API calls. Workspace loading is handled in `main.ts` before `registerGuards()`.

---

## Support & Questions

If issues arise during testing:

1. Check [IMPLEMENT_REPORT.md](../reports/IMPLEMENT_REPORT.md) for task-level details
2. Check [ANALYZE_REPORT.md](../audits/ANALYZE_REPORT.md) for architectural compliance
3. Refer to guard file JSDoc comments for expected behavior per app
4. Check git log for recent changes: `git log --oneline ui-03-router-and-guards | head -20`
