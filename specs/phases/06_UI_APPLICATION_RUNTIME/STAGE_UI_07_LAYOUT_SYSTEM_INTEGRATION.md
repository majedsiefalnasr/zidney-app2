# STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION

## Stage Type

UI Foundation — Layout & Shell Integration

---

## Stage Status

Status: PRODUCTION READY
Closure Date: 2026-03-06
Risk Level: LOW
Last Updated: 2026-03-06T00:00:00Z

Implementation: COMPLETE
Tasks: 56 / 56 completed (zero deferrals)

Scope Delivered:

- UI store (sidebarCollapsed, isMobile, toggleSidebar, setMobile, $reset) — 3 apps ✅
- Auth store (resolvedPermissions, buildResolvedPermissions) — 3 apps ✅
- Router types update (standaloneLayout?, hideSidebar?) — 3 apps ✅
- Router index update (standaloneLayout on auth/error routes) — 3 apps ✅
- useBreakpoint composable — 3 apps ✅
- Navigation index (typed route records) — 3 apps ✅
- AppHeader, AppSidebar, AppLayout components — 3 apps ✅
- SidebarLayout in @zidney/ui-system (reactive collapsed prop) ✅
- App.vue conditional layout — 3 apps ✅
- BackofficeLayout.vue deleted (replaced by AppLayout) ✅
- 4 backoffice view files updated (BackofficeLayout wrapper removed) ✅
- 21 unit/composable/integration tests — 162 assertions all pass ✅

Deferred Scope:

- Feature page implementations (separate stages)
- Notification system (placeholder adequate for MVP)
- Global search (placeholder adequate for MVP)
- ESLint layout import restriction rule (INFRA governance stage)

Constitutional Compliance:

- ✅ ADR-0001 Database-per-tenant isolation preserved (UI-layer only)
- ✅ ADR-0002 Snapshot immutability N/A (attempt engine untouched)
- ✅ ADR-0006 Server-authoritative time preserved
- ✅ ADR-0007 Version compatibility enforced (no schema changes)
- ✅ ADR-0008 Semantic versioning respected (feature v0.x.0)
- ✅ No cross-tenant logic introduced
- ✅ No middleware bypass created
- ✅ No shared mutable global state
- ✅ All 9 drift analysis criteria passed

Validation:

- ✅ 162/162 test assertions passing (21 test files)
- ✅ 0 TypeScript errors (4 packages)
- ✅ 0 ESLint errors (stage-scoped)
- ✅ 9/9 drift criteria passed
- ✅ 9/9 Constitutional ADRs verified

Notes:

Stage is PRODUCTION READY. Unified layout architecture fully tested and compliant.  
All closure artifacts generated: CLOSURE_REPORT.md, guides/TESTING_GUIDE.md, PR_SUMMARY.md.  
No structural backend modifications allowed. Feature page implementations handled in subsequent UI stages.

---

## Purpose

Define the unified layout architecture across all Zidney frontend applications:

- MMC (Platform Admin)
- Backoffice (Tenant Admin)
- Frontoffice (Student Runtime)

This stage standardizes:

- Application shell structure
- Sidebar / navigation system
- Header behavior
- Workspace context injection
- Layout-slot strategy
- Integration with @zidney/ui-system

This stage does NOT implement feature pages.
It defines how pages live inside a consistent application shell.

---

## Constitutional Constraints

Layout system must:

- Never contain business logic
- Never fetch domain data directly
- Never bypass router guards
- Never enforce RBAC itself
- Never resolve tenant manually
- Never mutate store state directly

Layout orchestrates structure only.

Authorization & data decisions remain in:

- Router guards
- Stores
- Backend

---

## Layout Architecture Overview

All apps must follow this hierarchy:

```
App.vue
 └─ AppLayout.vue
     ├─ AppSidebar.vue
     ├─ AppHeader.vue
     └─ <router-view />
```

Feature views render inside `<router-view />`.

No feature view may render its own full-page layout unless explicitly declared as:

- Auth page
- Error page
- Standalone runtime page

---

## Layout Components

### AppLayout.vue

Responsibilities:

- Wrap entire authenticated UI
- Provide grid/flex layout
- Inject layout slots
- Handle responsive behavior
- Connect to ui.store for sidebar collapse state

Must NOT:

- Call APIs
- Contain feature logic

---

### AppSidebar.vue

Responsibilities:

- Render navigation items
- Support role-based visibility (using store-derived permissions)
- Highlight active route
- Collapse/expand behavior

Navigation items must be:

- Static config-driven
- Feature-module extensible
- Not hardcoded per view

Sidebar must not compute RBAC.
It reads computed permissions from store.

---

### AppHeader.vue

Responsibilities:

- Workspace name display
- User avatar / dropdown
- Logout action
- Global search placeholder
- Notification indicator (future integration)

Must not:

- Validate tokens
- Fetch user directly
- Manage auth state internally

---

## Multi-App Differences

### MMC

- Platform-level navigation
- No tenant-scoped data in shell
- No workspace slug in URL

### Backoffice

- Workspace-aware navigation
- Workspace slug visible in header
- Layout must react to workspace context change

### Frontoffice

- Minimal shell
- Sidebar may be optional
- Attempt runtime may bypass full layout

Shell components must be reusable across apps where possible.

---

## UI System Integration

Layout must consume:

```
@zidney/ui-system
```

Components:

- Sidebar primitives
- Dropdowns
- Avatars
- Buttons
- Navigation items

No inline Tailwind layout duplication allowed if UI system provides primitive.

All layout styling must follow:

- Design tokens
- Theme system
- Dark mode compatibility

---

## Layout Slot Strategy

AppLayout must expose slots:

- header-left
- header-right
- sidebar-footer
- content-top
- content-bottom

Feature modules may inject content via layout slots if needed.

Avoid layout prop drilling.

---

## Responsive Behavior

Breakpoints:

- Desktop: Sidebar expanded
- Tablet: Sidebar collapsible
- Mobile: Sidebar overlay mode

State must live in ui.store:

```
sidebarCollapsed: boolean
isMobile: boolean
```

No direct window usage without composable abstraction.

---

## Navigation Architecture

Routes must be defined in:

```
core/router/
```

Navigation config lives in:

```
core/navigation/
```

Navigation items must reference route names, not paths.

Active state derived from router.

---

## Testability Requirements

Layout must support:

- Snapshot testing
- Rendering without backend
- Mocked store injection
- Mocked router injection
- Sidebar toggle testing
- Responsive mode simulation

Layout must not fail if:

- API layer unavailable
- User permissions empty
- Workspace context null

---

## Explicit Non-Goals

This stage does NOT:

- Implement feature pages
- Implement product page layout logic
- Implement dashboard widgets
- Implement affiliate UI
- Implement role logic
- Define navigation items for every feature

Only layout architecture & shell integration.

---

## Completion Criteria

Stage considered complete when:

- AppLayout implemented in all apps
- Sidebar standardized
- Header standardized
- Router-view integrated properly
- Navigation config externalized
- UI system primitives used
- Responsive behavior verified
- No feature page duplicates layout
- CI passes lint + TypeScript
- No TODO placeholders in layout layer

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
