# STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION

## Stage Type

UI Foundation — Layout & Shell Integration

---

## Stage Status

Status: IN PROGRESS
Step: analyze
Risk Level: MEDIUM
Last Updated: 2026-03-05T00:00:00Z

Drift Analysis: PASSED (9/9 criteria)
Implementation: AUTHORIZED

Tasks Finalized:

- Total: 57 atomic tasks (T001–T056 + T052–T055 remediated additions)
- 7 dependency/store foundation tasks
- 6 types/configuration tasks
- 3 composable tasks
- 9 layout component tasks (3 per app)
- 8 app integration tasks
- 21 test tasks (18 original + T052–T054 auth.store permissions + T055 SidebarLayout fix)
- 1 CI lint/typecheck task (T056)

Deferred Scope:

- Feature page implementations
- Notification system (placeholder only)
- Global search (placeholder only)
- NFR-001 render benchmark test (accepted as design invariant)
- ESLint layout import restriction rule (governance follow-up stage)

Constitutional Compliance:

- All 9 drift criteria passed — implementation authorized
- ADR alignment verified — no architectural modifications
- Zidney Constitution v1.2.0 compliant

Notes:
Analyze gate passed on second pass after targeted remediation. Eight remediations applied.
Four medium, three low residual findings documented in audits/ANALYZE_REPORT.md — none block implementation.

Notes:
Atomic task set generated. Drift analysis gate pending.

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
