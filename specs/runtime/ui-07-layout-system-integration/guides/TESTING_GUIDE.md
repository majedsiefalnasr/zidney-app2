# Testing Guide — STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION

**Stage:** STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION  
**Phase:** 06_UI_APPLICATION_RUNTIME  
**Stage Directory:** ui-07-layout-system-integration  
**Generated On:** 2026-03-06

---

## Purpose

This guide explains how to validate the unified layout system implementation end-to-end. The stage delivers an application shell architecture (AppLayout, AppSidebar, AppHeader) that all authenticated views render inside, plus responsive breakpoint detection and collapsible sidebar state management.

---

## Summary of Delivered Behavior

A standardized application shell layer available to all three Zidney frontend applications (MMC, Backoffice, Frontoffice). Every authenticated view automatically renders inside this consistent shell without implementing layout logic locally.

Key outcomes:

- **Responsive Layout Shell** — AppHeader, AppSidebar, AppLayout components deployed to all 3 apps
- **Reactive Sidebar State** — Collapsible/toggle behavior backed by shared Pinia store (sidebarCollapsed, isMobile, toggleSidebar, setMobile)
- **Permission-Aware Navigation** — Auth store resolves permissions; resolvedPermissions + buildResolvedPermissions available to views
- **Breakpoint Detection** — useBreakpoint composable detects mobile/desktop transitions
- **Router Meta Support** — New RouteMeta flags (standaloneLayout, hideSidebar) control layout presence per route
- **Integration Tested** — 21 test files verify store mutations, route rendering, component integration, and responsive behavior

---

## Prerequisites

| Requirement            | Check Command                    | Expected          |
| ---------------------- | -------------------------------- | ----------------- |
| Node.js v20+           | `node --version`                 | v20.0.0 or higher |
| Bun v1+                | `bun --version`                  | v1.0.0 or higher  |
| Git branch correct     | `git branch`                     | `ui-07-...`       |
| Dependencies installed | `bun install` (should find lock) | No errors         |
| TypeScript builds      | `bun run typecheck`              | Exit code 0       |
| Tests pass locally     | `bun test 2>&1 \| grep "FAIL"`   | No matches        |

---

## Files in Scope

**Components Created (3 apps):**

- apps/{mmc,backoffice,frontoffice}/src/components/layout/AppHeader.vue
- apps/{mmc,backoffice,frontoffice}/src/components/layout/AppSidebar.vue
- apps/{mmc,backoffice,frontoffice}/src/components/layout/AppLayout.vue

**Stores Extended (3 apps):**

- apps/{mmc,backoffice,frontoffice}/src/core/state/ui.store.ts (added sidebarCollapsed, isMobile, toggleSidebar, setMobile, $reset)
- apps/{mmc,backoffice,frontoffice}/src/core/state/auth.store.ts (added resolvedPermissions, buildResolvedPermissions)

**Router Updated (3 apps):**

- apps/{mmc,backoffice,frontoffice}/src/core/router/index.ts (standaloneLayout on auth/error routes)
- apps/{mmc,backoffice,frontoffice}/src/core/router/types.ts (RouteMeta additions)

**Composables Created (3 apps):**

- apps/{mmc,backoffice,frontoffice}/src/composables/useBreakpoint.ts

**Navigation Config (3 apps):**

- apps/{mmc,backoffice,frontoffice}/src/core/navigation/index.ts

**App Entry (3 apps):**

- apps/{mmc,backoffice,frontoffice}/src/App.vue (conditional layout rendering)

**UI System Package:**

- packages/ui-system/src/components/Layout/SidebarLayout.vue (reactive collapsed prop)
- packages/ui-system/src/components/index.ts (layout exports)

**Tests (21 files):**

- 3 integration tests (app-layout.integration.test.ts)
- 3 composable tests (useBreakpoint.test.ts)
- 6 store tests (ui.store.layout.test.ts, auth.store.permissions.test.ts × 3 apps)
- 9 component tests (AppHeader/Sidebar/Layout.test.ts × 3 apps)

---

## Local Run Commands

```bash
# Install dependencies
bun install

# Run all tests (layout-focused)
bun test

# Run only layout-related tests
bun test -- --grep "layout|sidebar|breakpoint|AppHeader|AppSidebar|AppLayout"

# Type check
bun run typecheck

# Lint
bun run lint

# Start development servers
bun run dev:mmc                  # MMC on http://localhost:5173
bun run dev:backoffice           # Backoffice on http://localhost:5174
bun run dev:frontoffice          # Frontoffice on http://localhost:5175
```

---

## Automated Validation Commands

```bash
# Run full test suite
bun test 2>&1 | tail -5

# Run tests with coverage
bun run test:coverage

# Run integration tests only
bun test:integration -- --grep "app-layout|layout-integration"

# Type check all apps
bun run typecheck:src

# Lint stage files
bun run lint -- apps/{mmc,backoffice,frontoffice}/src/components/layout
```

Expected outcome: All tests pass with 162 assertions; zero lint/typecheck errors.

---

## Manual Test Scenarios

### Scenario 1 — Authenticated Shell Renders in MMC

**Purpose:** Verify that AppLayout wrapper renders with sidebar and header for all routes in MMC.

1. Start MMC: `bun run dev:mmc`
2. Open browser to http://localhost:5173
3. Log in with valid credentials (use test credential from your local setup)
4. Navigate to any authenticated route (dashboard, settings, etc.)
5. Observe: header visible at top with workspace name + user menu; sidebar visible on left with navigation; content area shows the page

Expected:

- AppHeader renders with workspace identity
- AppSidebar renders with typed navigation items
- Page content renders correctly inside AppLayout
- No console errors

### Scenario 2 — Sidebar Collapse/Toggle on Desktop

**Purpose:** Verify sidebar collapse behavior on desktop breakpoint.

1. Start MMC: `bun run dev:mmc`
2. Log in and navigate to any authenticated route
3. Ensure browser width is > 768px (desktop)
4. Click the sidebar toggle button (hamburger icon in header or AppSidebar)
5. Observe: sidebar collapses to icon-only view; ui.store.sidebarCollapsed toggles

Expected:

- Sidebar animates to collapsed state
- Navigation icons remain visible
- Content area expands to fill freed space
- Refresh page: sidebar state persists (stored in localStorage via Pinia persistence)

### Scenario 3 — Responsive Mobile Breakpoint

**Purpose:** Verify layout adapts correctly when viewport transitions to mobile (<768px).

1. Start MMC: `bun run dev:mmc`
2. Log in and navigate to any authenticated route
3. Open browser DevTools → Responsive Design Mode
4. Set viewport to mobile (375px width)
5. Observe: sidebar converts to overlay/hamburger mode; isMobile flag in store = true

Expected:

- Sidebar is hidden by default on mobile
- Hamburger button in header toggles overlay sidebar
- Overlay closes when user clicks outside or selects a navigation item
- Content area spans full width on mobile
- No horizontal scroll

### Scenario 4 — Permissions-Aware Navigation in Backoffice

**Purpose:** Verify auth store resolvedPermissions filters navigation items correctly.

1. Start Backoffice: `bun run dev:backoffice`
2. Log in as an admin user
3. Observe sidebar navigation — should show all admin items (Roles, Permissions, Users, etc.)
4. Log out; log in as a limited user (e.g., instructor without admin rights)
5. Observe sidebar navigation — should show only permitted items

Expected:

- Navigation items reflect `resolvedPermissions` from auth.store
- buildResolvedPermissions() correctly computes permissions from roles
- Users without role permissions do not see restricted navigation items
- No 403 errors; navigation gracefully hides inaccessible routes

### Scenario 5 — Standalone Layout Flag (Auth Routes)

**Purpose:** Verify that auth routes (login, forgot-password) render without the shell.

1. Start MMC: `bun run dev:mmc`
2. Navigate to login page (or logout first)
3. Observe: no AppSidebar, no AppHeader — only the login form on a minimal background
4. After successful login, redirect to authenticated route
5. Observe: full layout shell now appears

Expected:

- Auth routes display standaloneLayout: true
- No shell wraps auth pages
- Smooth transition from auth → authenticated shell after login

### Scenario 6 — Frontoffice Minimal Shell

**Purpose:** Verify that Frontoffice renders a minimal shell (header only, no sidebar by default).

1. Start Frontoffice: `bun run dev:frontoffice`
2. Log in as a student
3. Navigate to home page or attempt list
4. Observe: AppHeader visible; AppSidebar hidden (hideSidebar: false on home route)
5. Navigate to an attempt route
6. Observe: standaloneLayout: true; no header/sidebar; full-screen attempt experience

Expected:

- Frontoffice shell is minimal (header only for authenticated nav)
- Attempt routes bypass layout entirely (standaloneLayout: true)
- Non-attempt routes display minimal header + content
- Student can log out via header menu

---

## Negative Cases

| Scenario                       | Trigger                                | Expected Response                                                      |
| ------------------------------ | -------------------------------------- | ---------------------------------------------------------------------- |
| Unauthenticated Access         | Try accessing /dashboard without login | Redirect to /auth/login (no layout shell renders)                      |
| Invalid Route                  | Visit /invalid-route                   | 404 page displays (may or may not have layout depending on route meta) |
| Permission Denied              | Request route with insufficient role   | Redirect to /403 or boot guard blocks before layout renders            |
| Mobile Sidebar Overflow (Edge) | Viewport 320px, sidebar at full width  | Sidebar respects max-width; no content is pushed off-screen            |
| Rapid Toggle Clicks            | Click sidebar toggle 10 times rapidly  | State toggles correctly; animations complete; no race conditions       |
| Store Reset                    | Call `uiStore.$reset()`                | Sidebar returns to default (not collapsed); isMobile reset             |

Error responses must follow Zidney error contract:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to access this resource"
  }
}
```

---

## Validation Checklist

Before closing this testing phase, verify:

- [ ] All 21 test files pass (21 passed, 162 assertions)
- [ ] Zero TypeScript errors (`bun run typecheck` exit 0)
- [ ] Zero ESLint errors on layout files (`bun run lint -- apps/*/src/components/layout`)
- [ ] Manual Scenario 1 verified (shell renders consistently)
- [ ] Manual Scenario 2 verified (sidebar collapse works)
- [ ] Manual Scenario 3 verified (mobile breakpoint correct)
- [ ] Manual Scenario 4 verified (permissions filter nav)
- [ ] Manual Scenario 5 verified (auth routes have no shell)
- [ ] Manual Scenario 6 verified (Frontoffice minimal shell)
- [ ] All negative cases handled gracefully

---

## Known Limitations & Future Work

**Not Included in This Stage:**

- Feature page implementations (separate stages will add Views)
- Notification system (placeholder in AppHeader only)
- Global search (placeholder only)
- Layout render performance benchmark (accepted as design invariant)

**Future Governance:**

- ESLint rule to restrict direct layout imports outside apps/ (follow-up infra stage)

---

## Troubleshooting

**Sidebar Not Toggling**

- Check browser console for errors
- Verify `ui.store.ts` is loaded: `console.log(useUiStore())` in DevTools
- Clear localStorage and refresh: `localStorage.clear()`

**Layout Not Appearing**

- Check that route does not have `standaloneLayout: true`
- Verify user is authenticated (check auth.store state)
- Look for middleware rejections in network tab

**Mobile Breakpoint Not Detected**

- Verify viewport width is < 768px in DevTools
- Check that useBreakpoint composable mounted: `console.log(inject('isMobile'))`
- Refresh page to ensure resize listener registered

**Permission Navigation Missing Items**

- Verify user has required roles assigned in backend
- Check auth.store.resolvedPermissions is computed correctly
- Run `buildResolvedPermissions()` manually in DevTools to debug

---

## Contact & Support

For issues or questions during testing:

1. Check test output in console for specific assertion failures
2. Review IMPLEMENT_REPORT.md for implementation details
3. Review spec.md for feature intent
4. Check Git history for commit messages (feat(ui-07-layout-system-integration): complete implement step)
