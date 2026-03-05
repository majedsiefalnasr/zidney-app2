# Feature Specification: Layout System Integration

**Feature Branch**: `ui-07-layout-system-integration`
**Phase**: 06_UI_APPLICATION_RUNTIME
**Stage**: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
**Stage File**: `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION.md`
**Created**: 2026-03-05
**Status**: Draft

---

## Feature Overview

This specification defines the **unified layout architecture** for all three Zidney frontend applications:

- **MMC** — Platform control panel (Zidney administrators)
- **Backoffice** — Tenant/institution admin panel
- **Frontoffice** — Student-facing runtime

### What Is Being Built

A standardized application shell layer that every authenticated view in each app renders inside. The shell consists of three coordinated components:

- `AppLayout.vue` — top-level shell wrapper that provides the full-page structure
- `AppSidebar.vue` — navigation sidebar with collapsible/overlay behaviors
- `AppHeader.vue` — top bar with workspace identity, user menu, and global actions

This stage establishes **how pages live inside a consistent shell**. It does not implement any feature pages.

### What This Affects

| Concern               | Affected | Notes                                           |
| --------------------- | -------- | ----------------------------------------------- |
| Tenant Isolation      | No       | Layout reads resolved context; never resolves   |
| License Enforcement   | No       | Middleware handles enforcement before rendering |
| Attempt Engine        | No       | Frontoffice attempt runtime may bypass layout   |
| Worker                | No       | Background layer unaffected                     |
| Runtime (Frontoffice) | Yes      | Minimal shell, attempt bypass declared          |
| Frontoffice shell     | Yes      | Student view wrapping                           |

---

## Constitutional Compliance Declaration

This stage complies with Zidney Constitution v1.2.0.

| Constraint                             | Status    | Notes                                            |
| -------------------------------------- | --------- | ------------------------------------------------ |
| No cross-tenant access                 | Compliant | Layout does not touch tenant DB                  |
| No middleware bypass                   | Compliant | Layout renders after all middleware has resolved |
| No grading outside Worker              | Compliant | Not applicable to layout layer                   |
| No direct DB instantiation             | Compliant | Layout reads from already-resolved store context |
| No weakening of snapshot integrity     | Compliant | Not applicable to layout layer                   |
| No weakening of transaction boundaries | Compliant | Not applicable to layout layer                   |
| No weakening of version enforcement    | Compliant | Version is enforced before the view mounts       |

Layout orchestrates structure only. Authorization, data decisions, and business rules remain in Router guards, Stores, and the Backend.

---

## User Scenarios & Testing

> User stories here represent the perspective of **feature-page developers** consuming the layout system and **end-users navigating within it**.

---

### User Story 1 — Authenticated Shell Renders Consistently Across All Apps (Priority: P1)

As a **feature developer**, I need to drop a new page component into the router and have it automatically render inside a fully formed application shell — without implementing layout logic in my view.

**Why this priority**: This is the foundational prerequisite for all feature development in each app. Without a standard shell, every page must manage its own layout, creating duplication and drift.

**Independent Test**: Create a minimal stub view and register it in the router. Verify that the stub automatically renders inside AppLayout with sidebar and header present — without any layout logic in the stub itself.

**Acceptance Scenarios**:

1. **Given** an authenticated user is on any route in MMC, **When** the route view renders, **Then** AppSidebar, AppHeader, and the view content all appear in their designated layout regions.
2. **Given** an authenticated user is on any route in Backoffice, **When** the route view renders, **Then** the shell is displayed with workspace identity visible in the header.
3. **Given** a student accesses Frontoffice, **When** a non-attempt route renders, **Then** the minimal Frontoffice shell wraps the content.
4. **Given** a new feature page is registered in the router, **When** a developer has not added any layout code to the view, **Then** the page still renders correctly inside the shell with full navigation.

---

### User Story 2 — Sidebar Collapses and Expands Correctly (Priority: P1)

As a **user navigating the admin panel**, I need to collapse the sidebar to gain screen space without losing navigation access.

**Why this priority**: Sidebar state is a core usability requirement for all admin-facing apps (MMC and Backoffice) with dense navigation structures.

**Independent Test**: Render AppLayout in isolation with a mocked `ui.store`. Toggle `sidebarCollapsed` and verify layout reacts correctly across desktop, tablet, and mobile breakpoints.

**Acceptance Scenarios**:

1. **Given** a desktop user is on MMC, **When** they click the collapse control, **Then** the sidebar collapses to icon-only mode and the content area expands.
2. **Given** a tablet user, **When** the viewport enters tablet range, **Then** the sidebar renders as collapsible by default.
3. **Given** a mobile user, **When** the viewport enters mobile range, **Then** the sidebar renders in overlay mode (hidden by default, shown on toggle).
4. **Given** a user toggles the sidebar, **When** they navigate to a new route, **Then** the sidebar state persists (derives from `ui.store`).
5. **Given** the sidebar is in collapsed state, **When** the active route changes, **Then** the active navigation item is still visually indicated.

---

### User Story 3 — Navigation Items Reflect Active Route and Permitted Links Only (Priority: P1)

As a **user**, I need the sidebar navigation to highlight my current location and only show links I have access to.

**Why this priority**: Correct active route highlighting and permission-filtered navigation are critical for usability and perceived correctness. The sidebar must not show inaccessible links.

**Independent Test**: Mount AppSidebar with a mocked router and a mocked store with predefined `resolvedPermissions`. Verify only permitted items are rendered and the item matching the active route is highlighted.

**Acceptance Scenarios**:

1. **Given** a navigation config with mixed items, **When** the store exposes a subset of permissions, **Then** only permitted navigation items appear in the sidebar.
2. **Given** the router is on route `exam.list`, **When** AppSidebar renders, **Then** the "Exams" navigation item is visually marked active.
3. **Given** a route changes, **When** the sidebar re-renders, **Then** the previously active item loses its active state and the newly active one is highlighted.
4. **Given** the store returns empty permissions, **When** the sidebar renders, **Then** only public or unrestricted navigation items are shown (no blank sidebar or error).

---

### User Story 4 — Backoffice Header Reflects Workspace Context (Priority: P2)

As a **tenant admin**, I need the header to show my current workspace name so I always know which tenant context I am operating in.

**Why this priority**: Multi-workspace support means admins can switch contexts. The header is the primary identity anchor.

**Independent Test**: Mount AppHeader in Backoffice context with a mocked store containing `workspace.name` and `workspace.slug`. Verify the correct name renders in the header.

**Acceptance Scenarios**:

1. **Given** a Backoffice user is authenticated with workspace "Acme Corp", **When** any authenticated page loads, **Then** "Acme Corp" appears in the AppHeader.
2. **Given** the workspace context changes (e.g., administrative switch), **When** the header re-renders, **Then** it displays the updated workspace name.
3. **Given** the workspace context is null (loading or error state), **When** the header renders, **Then** the workspace area shows a neutral placeholder — no crash, no empty layout.

---

### User Story 5 — Attempt Runtime Bypasses the Full Layout (Priority: P2)

As a **student taking an exam**, I need the exam runtime page to have a distraction-free full-screen view that is **not wrapped** in the standard sidebar/header shell.

**Why this priority**: Attempt runtime is a special-case page that must declare itself as a standalone layout. The standard shell would introduce unneeded UI chrome and navigation that could disrupt the exam experience.

**Independent Test**: Register an attempt route with `meta: { standaloneLayout: true }`. Verify that `AppLayout` does not render for this route and the view is mounted directly inside `App.vue`.

**Acceptance Scenarios**:

1. **Given** a student navigates to an active attempt, **When** the attempt route renders, **Then** neither AppSidebar nor AppHeader are present in the DOM.
2. **Given** a standalone-declared page is active, **When** the user completes the attempt and is redirected to the results page, **Then** the standard shell resumes rendering.
3. **Given** a developer creates a new auth page or error page, **When** they declare it as standalone in the route meta, **Then** `AppLayout` is bypassed.

---

### User Story 6 — Layout Slots Allow Feature-Module Content Injection (Priority: P3)

As a **feature developer**, I need to inject contextual action buttons or secondary content into designated layout regions without modifying the layout component itself.

**Why this priority**: Enables composability for feature modules (e.g., breadcrumb injection, secondary header actions) without coupling feature logic into the layout layer.

**Independent Test**: Create a view that fills the `header-right` and `content-top` layout slots. Verify that the injected content appears in the correct layout region.

**Acceptance Scenarios**:

1. **Given** a feature view injects content into `header-right`, **When** the view renders, **Then** the content appears in the header's right region.
2. **Given** no feature view provides a slot, **When** the layout renders, **Then** all slot regions are either empty or show default content — no crashes.
3. **Given** a feature injects into `sidebar-footer`, **When** the layout renders, **Then** the content appears at the bottom of the sidebar region.

---

### Edge Cases

- What happens when the user navigates to a route with no matching navigation config entry? The sidebar renders but no item is highlighted.
- What happens if `ui.store` is not initialized before `AppLayout` mounts? Layout must fall back to default state (sidebar expanded, non-mobile) without error.
- What happens if `AppSidebar` receives an empty navigation config? Sidebar renders with an empty list — no error, no crash, no placeholder items.
- What happens on a viewport resize that crosses a breakpoint while the user is on a page? `ui.store.isMobile` updates reactively and the sidebar transitions to the appropriate mode.
- What happens if `AppHeader` cannot resolve workspace name from the store? A safe placeholder is shown; no runtime error is thrown.
- What happens when a navigation item references a route that does not exist in the router? The item renders but navigation is disabled or silently fails — no console errors unless debug mode is active.
- What happens if a feature page accidentally includes its own full-page layout wrapper? No enforced prevention at the layout layer (enforcement is a linting/review convention). The layout will double-wrap.

---

## Requirements

### Functional Requirements — Cross-App (Common)

- **FR-001**: All three apps (MMC, Backoffice, Frontoffice) MUST render authenticated views inside `AppLayout.vue`.
- **FR-002**: `AppLayout.vue` MUST compose `AppSidebar.vue` and `AppHeader.vue` within its template.
- **FR-003**: All feature views MUST render via `<router-view />` inside `AppLayout.vue`.
- **FR-004**: `AppLayout.vue` MUST NOT call any API or contain feature-specific business logic.
- **FR-005**: `AppLayout.vue` MUST NOT fetch domain data directly.
- **FR-006**: `AppLayout.vue` MUST NOT bypass or duplicate router guard logic.
- **FR-007**: `AppLayout.vue` MUST NOT enforce RBAC directly.
- **FR-008**: `AppLayout.vue` MUST NOT resolve tenant context manually.
- **FR-009**: `AppLayout.vue` MUST NOT mutate store state directly (may read only).
- **FR-010**: Layout MUST consume components exclusively from `@zidney/ui-system`; no parallel custom component system permitted.
- **FR-011**: Layout MUST use Tailwind v4 utility classes for all structural composition.
- **FR-012**: Layout MUST NOT use hardcoded brand colors; all color values MUST derive from design tokens.
- **FR-013**: White-label customization of layout MUST be limited to visual tokens (logo, brand colors, favicon) only.
- **FR-014**: `AppLayout.vue` MUST expose named slots: `header-left`, `header-right`, `sidebar-footer`, `content-top`, `content-bottom`.
- **FR-015**: Layout MUST support three responsive states: Desktop (sidebar expanded), Tablet (sidebar collapsible), Mobile (sidebar overlay).
- **FR-016**: Sidebar collapsed/expanded state MUST be managed via `ui.store.sidebarCollapsed`.
- **FR-017**: Mobile mode detection MUST be managed via `ui.store.isMobile`.
- **FR-018**: Breakpoint detection MUST use a composable abstraction — no direct `window.innerWidth` usage inside layout components.
- **FR-019**: Routes declaring `meta.standaloneLayout: true` MUST bypass `AppLayout` and render directly in `App.vue`.
- **FR-020**: Auth pages, error pages, and attempt runtime pages MUST declare themselves as standalone via route meta.
- **FR-021**: All layout components MUST support rendering without a live backend (API unavailable).
- **FR-022**: All layout components MUST support rendering with null/empty user permissions without throwing runtime errors.
- **FR-023**: Navigation config MUST live in `core/navigation/` — not hardcoded inside layout components.
- **FR-024**: Navigation items MUST reference route names (not paths) for active state derivation and link resolution.
- **FR-025**: Active navigation state MUST be derived from the Vue Router current route — not from store state.

---

### Functional Requirements — AppSidebar.vue

- **FR-026**: `AppSidebar.vue` MUST render navigation items from a static, config-driven navigation structure.
- **FR-027**: `AppSidebar.vue` MUST filter navigation items based on computed permissions exposed by the store — it MUST NOT compute permissions itself.
- **FR-028**: `AppSidebar.vue` MUST highlight the currently active route item.
- **FR-029**: `AppSidebar.vue` MUST support collapse/expand behavior driven by `ui.store.sidebarCollapsed`.
- **FR-030**: `AppSidebar.vue` MUST support navigation grouping (sections with optional group labels).
- **FR-031**: `AppSidebar.vue` MUST support icon-only mode when collapsed.
- **FR-032**: Navigation items MUST be extensible by feature modules via configuration — not by direct sidebar modification.

---

### Functional Requirements — AppHeader.vue

- **FR-033**: `AppHeader.vue` MUST display the authenticated user's name or avatar.
- **FR-034**: `AppHeader.vue` MUST provide a user dropdown with at minimum: logout action.
- **FR-035**: `AppHeader.vue` MUST NOT validate authentication tokens directly.
- **FR-036**: `AppHeader.vue` MUST NOT fetch user identity directly from the API.
- **FR-037**: `AppHeader.vue` MUST NOT manage auth state internally.
- **FR-038**: `AppHeader.vue` MUST include a global search placeholder (non-functional at this stage; reserved slot only).
- **FR-039**: `AppHeader.vue` MUST include a notification indicator area (non-functional at this stage; reserved slot only).

---

### Functional Requirements — MMC App

- **FR-040**: MMC `AppSidebar.vue` MUST display platform-level navigation items only.
- **FR-041**: MMC `AppHeader.vue` MUST NOT display workspace slug or tenant-scoped identity.
- **FR-042**: MMC layout MUST NOT include workspace context injection in the shell.

---

### Functional Requirements — Backoffice App

- **FR-043**: Backoffice `AppHeader.vue` MUST display the current workspace name derived from the store.
- **FR-044**: Backoffice `AppHeader.vue` MUST reactively update the displayed workspace name if workspace context changes.
- **FR-045**: Backoffice shell MUST handle null workspace context gracefully (placeholder, no crash).
- **FR-046**: Backoffice navigation MUST be workspace-aware (navigation items may differ per workspace role/context).

---

### Functional Requirements — Frontoffice App

- **FR-047**: Frontoffice shell MUST be minimal compared to MMC/Backoffice.
- **FR-048**: Frontoffice sidebar MUST be optional (may be hidden on certain routes via route meta).
- **FR-049**: Frontoffice attempt runtime routes MUST declare `meta.standaloneLayout: true` to bypass the shell entirely.
- **FR-050**: Frontoffice layout MUST support graceful degradation if student permissions or course context are not yet loaded.

---

### Non-Functional Requirements

- **NFR-001 (Performance)**: All three layout components MUST render initial HTML in under 100ms in a local development environment with mocked stores.
- **NFR-002 (Testability)**: Layout components MUST support rendering in isolation via Vitest + Vue Test Utils with mocked store injection.
- **NFR-003 (Testability)**: Layout components MUST support mocked router injection for snapshot and behavior testing.
- **NFR-004 (Testability)**: `AppSidebar.vue` MUST support sidebar toggle unit testing in isolation.
- **NFR-005 (Testability)**: Responsive behavior MUST be testable by simulating viewport changes through composable mocks (no real DOM resize needed).
- **NFR-006 (Maintainability)**: Navigation config MUST be co-located with the app's routing module and version-controlled alongside route definitions.
- **NFR-007 (Maintainability)**: No feature view MUST be permitted to import layout components directly — layout is injected automatically by router.
- **NFR-008 (Resilience)**: Layout components MUST NOT fail if the API layer is unavailable.
- **NFR-009 (Resilience)**: Layout components MUST NOT fail if user permissions are null, undefined, or empty array.
- **NFR-010 (Resilience)**: Layout components MUST NOT fail if workspace context is null or unresolved.
- **NFR-011 (TypeScript)**: All layout components MUST pass TypeScript strict mode checks.
- **NFR-012 (Linting)**: All layout components MUST pass ESLint with zero warnings in CI.
- **NFR-013 (Dark Mode)**: Layout styling MUST support dark mode via the theme system — no hardcoded light/dark colors.

---

## Technical Constraints

### Strict Boundaries

| Constraint                                                | Enforcement                                  |
| --------------------------------------------------------- | -------------------------------------------- |
| No API calls in layout                                    | Linting rule + code review gate              |
| No RBAC computation in layout                             | Permissions read-only from store             |
| No tenant resolution in layout                            | Tenant context read from store only          |
| No token validation in layout                             | Router guards handle auth before view mounts |
| No direct `window` usage                                  | Composable abstraction required              |
| No shadcn-vue replacement with custom components          | PR review gate                               |
| No hardcoded colors                                       | Tailwind token-only, design system enforced  |
| No cross-app imports between MMC, Backoffice, Frontoffice | Import boundary rules enforced               |
| Layout components import only from `@zidney/ui-system`    | No `apps/` → other `apps/` imports           |

### Dependency Rules

```
apps/mmc         → packages/@zidney/ui-system   ✓
apps/backoffice  → packages/@zidney/ui-system   ✓
apps/frontoffice → packages/@zidney/ui-system   ✓
apps/mmc         → apps/backoffice               ✗ FORBIDDEN
apps/backoffice  → apps/mmc                      ✗ FORBIDDEN
```

---

## Component Interface Definitions

### AppLayout.vue

**Purpose**: Top-level authenticated page shell.

**Props**:

| Prop          | Type      | Default | Description                                  |
| ------------- | --------- | ------- | -------------------------------------------- |
| `hideSidebar` | `boolean` | `false` | Hides sidebar (Frontoffice optional sidebar) |

**Slots**:

| Slot Name        | Purpose                                               |
| ---------------- | ----------------------------------------------------- |
| `header-left`    | Left region of the header (e.g., breadcrumb, title)   |
| `header-right`   | Right region of the header (e.g., contextual actions) |
| `sidebar-footer` | Bottom of sidebar (e.g., upgrade notice, version)     |
| `content-top`    | Above the `<router-view />` region                    |
| `content-bottom` | Below the `<router-view />` region                    |

**Store Dependencies** (read-only):

- `ui.store.sidebarCollapsed` — controls sidebar visual state
- `ui.store.isMobile` — controls responsive layout mode

**Emits**: None (state is delegated to `ui.store` through `AppSidebar`)

**Template Structure**:

```
<div class="app-layout">
  <AppSidebar />
  <div class="app-layout__main">
    <AppHeader>
      <template #left><slot name="header-left" /></template>
      <template #right><slot name="header-right" /></template>
    </AppHeader>
    <slot name="content-top" />
    <main><router-view /></main>
    <slot name="content-bottom" />
  </div>
</div>
```

---

### AppSidebar.vue

**Purpose**: Navigation sidebar with collapse behavior and permission-filtered items.

**Props**:

| Prop               | Type               | Required | Description                                                                |
| ------------------ | ------------------ | -------- | -------------------------------------------------------------------------- |
| `navigationConfig` | `NavigationConfig` | Yes      | Navigation group definitions (`NavigationGroup[]`) — see CL-003 correction |

**NavigationConfig Shape**:

```ts
interface NavigationItem {
  routeName: string // refers to named route only
  label: string // i18n key or display string
  icon?: string // icon identifier (from ui-system icon set)
  permission?: string // permission key checked against store
  children?: NavigationItem[]
}

interface NavigationGroup {
  label?: string // optional group heading
  items: NavigationItem[]
}

type NavigationConfig = NavigationGroup[]
```

**Store Dependencies** (read-only):

- `ui.store.sidebarCollapsed` — drives collapsed visual state
- `auth.store.resolvedPermissions` — filters visible navigation items

**Behavior**:

- Active item derived from `router.currentRoute.value.name`
- Items with unmet `permission` keys are hidden (not disabled)
- Collapsed mode: icons only, group labels hidden
- Overlay mode (mobile): rendered as drawer over content

---

### AppHeader.vue

**Purpose**: Top bar with workspace identity, user menu, and reserved global action areas.

**Props**:

| Prop            | Type      | Required | Description                                     |
| --------------- | --------- | -------- | ----------------------------------------------- |
| `showWorkspace` | `boolean` | No       | Show workspace name region (Backoffice: `true`) |

**Slots**:

| Slot Name | Purpose                                               |
| --------- | ----------------------------------------------------- |
| `left`    | Left header region (passed through from `AppLayout`)  |
| `right`   | Right header region (passed through from `AppLayout`) |

**Store Dependencies** (read-only):

- `auth.store.currentUser` — user name/avatar for display
- `workspace.store.currentWorkspace.name` — workspace display name (Backoffice only)
- `auth.store.logout()` — called on logout action (dispatches store action)

**Behavior**:

- Logout is dispatched to `auth.store.logout()` — no token deletion in component
- Global search area is a reserved placeholder (non-interactive at this stage)
- Notification indicator is a reserved placeholder (non-interactive at this stage)

---

### Navigation Config Files

Navigation configs are located in each app's `core/navigation/` directory:

```
apps/mmc/src/core/navigation/index.ts
apps/backoffice/src/core/navigation/index.ts
apps/frontoffice/src/core/navigation/index.ts
```

Each file exports a typed `NavigationConfig` array. Route names used in config MUST exist in the corresponding app's router.

---

## Integration Points

### @zidney/ui-system

All layout components consume UI primitives from `@zidney/ui-system` only:

| Primitive Used          | Component                         |
| ----------------------- | --------------------------------- |
| Navigation item         | `AppSidebar.vue`                  |
| Dropdown menu           | `AppHeader.vue` (user menu)       |
| Avatar                  | `AppHeader.vue`                   |
| Button (toggle)         | `AppSidebar.vue`, `AppHeader.vue` |
| Icon                    | `AppSidebar.vue`, `AppHeader.vue` |
| Tooltip (collapsed nav) | `AppSidebar.vue`                  |

No duplication of these primitives in layout code is permitted.

---

### ui.store

The `ui.store` (Pinia) is the exclusive state manager for layout-related UI state:

| State Key          | Type      | Purpose                                        |
| ------------------ | --------- | ---------------------------------------------- |
| `sidebarCollapsed` | `boolean` | Whether sidebar is in collapsed mode           |
| `isMobile`         | `boolean` | Whether viewport is in mobile breakpoint range |

Layout components MUST NOT write to `ui.store` directly from template event handlers. Toggle actions dispatch through defined store actions only.

---

### Vue Router

- `App.vue` uses a conditional wrapper: renders `AppLayout` for non-standalone routes, bare `<router-view />` for standalone routes.
- Standalone detection: `route.meta.standaloneLayout === true`
- Active navigation item detection: `router.currentRoute.value.name`
- Navigation items use `<RouterLink :to="{ name: item.routeName }" />` only.

---

### Auth Store

`AppHeader.vue` and `AppSidebar.vue` read from `auth.store` (Pinia):

- `auth.store.currentUser` — user display data (name, avatar URL)
- `auth.store.resolvedPermissions` — pre-computed permission set (sidebar filtering)
- `auth.store.logout()` — asynchronous action invoked by header logout button

No auth logic is computed in layout components. They are read-only consumers.

---

## Key Entities

- **NavigationConfig**: Typed configuration structure defining navigation groups and items per app, stored in `core/navigation/`. The source of truth for sidebar content.
- **ui.store**: Pinia store managing sidebar state and viewport mode. The exclusive layout-visible state layer.
- **AppLayout.vue**: Single instance per authenticated route tree. The structural parent of all authenticated views.
- **Standalone Route**: Any route with `meta.standaloneLayout: true`. Bypasses `AppLayout`. Required for auth pages, error pages, and attempt runtime.

---

## Assumptions

1. **`ui.store` already exists** from a prior stage (`ui-06-state-management`). This stage consumes it; it does not create it.
2. **`auth.store.resolvedPermissions`** is a pre-computed set populated by the auth module. AppSidebar does not trigger permission reloads.
3. **`workspace.store.currentWorkspace`** exists in Backoffice and provides `name` and `slug`. Frontoffice and MMC do not depend on this.
4. **Breakpoints** follow Tailwind v4 default breakpoints unless overridden by the theme system (`sm`, `md`, `lg`). Mobile = below `md`. Tablet = `md`. Desktop = `lg`+.
5. **Icon identifiers** in navigation config reference icons available in `@zidney/ui-system`'s icon set. No external icon libraries are introduced.
6. **i18n** for navigation labels is handled at the feature layer, not hard-enforced in the navigation config shape at this stage.
7. **Notification indicator** and **global search** are reserved placeholders only — no functional implementation in this stage.
8. **AppLayout is per-app** — MMC, Backoffice, and Frontoffice each have their own `AppLayout.vue` derived from the shared pattern, not a single cross-app shared component.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A developer can register a new page in the router and have it render inside the standard shell with zero layout code in the view — validated by adding a stub view with no layout imports.
- **SC-002**: All three apps produce zero layout-related TypeScript errors and zero ESLint warnings in CI.
- **SC-003**: Sidebar state (collapsed/expanded) persists correctly across in-app route changes without any re-initialization of AppLayout.
- **SC-004**: Layout components render successfully in test environments with mocked stores and mocked router — no live API calls required.
- **SC-005**: Responsive layout transitions between all three modes (desktop, tablet, mobile) are validated through composable mocks — no layout component breaks at any breakpoint.
- **SC-006**: Attempt runtime pages render without AppSidebar or AppHeader present in the DOM — verified via component snapshot tests.
- **SC-007**: All navigation items respect `resolvedPermissions` filtering — items with unmet permissions are absent from the rendered sidebar, confirmed by unit tests.
- **SC-008**: Workspace name renders correctly in Backoffice AppHeader when `workspace.store.currentWorkspace.name` is populated and reactively updates when it changes.
- **SC-009**: Layout slot injection works for all five declared slots (`header-left`, `header-right`, `sidebar-footer`, `content-top`, `content-bottom`) — verified in isolation tests.
- **SC-010**: No feature page in any app imports or directly instantiates `AppLayout.vue`, `AppSidebar.vue`, or `AppHeader.vue` — enforced by code review and optional lint rule.

---

## Exclusions & Non-Goals

This stage explicitly does NOT cover:

| Excluded Concern                             | Reason                                                |
| -------------------------------------------- | ----------------------------------------------------- |
| Feature page implementation                  | Out of scope — layout shell only                      |
| Dashboard widget implementation              | Dashboard is a separate feature stage                 |
| Affiliate UI                                 | Separate feature stage                                |
| Role definition and RBAC logic               | Handled in auth + role-permission-system stage        |
| Navigation item definitions for all features | Feature modules define their own config entries       |
| Global search functionality                  | Reserved placeholder only at this stage               |
| Notification system                          | Reserved placeholder only at this stage               |
| Product page layout                          | Product page layout is feature-specific               |
| Attempt runtime UI                           | Attempt runtime stage handles its own layout          |
| Theme customization UI                       | Workspace settings stage handles theme management     |
| Deep linking / breadcrumb logic              | Not layout responsibility; feature-injected via slots |
| Transitions / animations between routes      | Optional enhancement, not core layout requirement     |
| Server-side rendering (SSR)                  | Not applicable to this SPA platform                   |
| Footer component                             | Not part of standard admin shell                      |

---

## Test Strategy

### Required Test Types

| Test Type              | Scope                                               | Required    |
| ---------------------- | --------------------------------------------------- | ----------- |
| Unit (Vue Test Utils)  | Each layout component in isolation                  | Yes         |
| Snapshot               | AppLayout, AppSidebar, AppHeader for all apps       | Yes         |
| Integration            | AppLayout + AppSidebar + AppHeader mounted together | Yes         |
| Responsive simulation  | Composable mock for breakpoint transitions          | Yes         |
| Permission filtering   | AppSidebar with varied permission sets              | Yes         |
| Standalone bypass      | App.vue routing to standalone layout                | Yes         |
| Slot injection         | All five named slots with content                   | Yes         |
| Null/empty store state | All components with null user, null workspace       | Yes         |
| Accessibility (basic)  | Keyboard nav, ARIA roles on sidebar/header          | Recommended |

### Anti-Patterns to Test For

- Layout component that makes API calls — must fail
- Layout component that mutates store directly — must fail
- Layout component that imports business logic — must fail
- Navigation item without a valid route name — must render safely (no crash)

---

Compliant with Zidney Constitution v1.2.0 — No violations detected.

---

## Clarifications

### Session 2026-03-05

#### CL-001 — `ui.store` Action Interface Contract

**Question:** What exact actions does `ui.store` expose that layout components must use for all sidebar and viewport-state mutation?

**Resolution:** `ui.store` exposes exactly two actions:

- `toggleSidebar()` — flips the boolean value of `sidebarCollapsed`. Called by `AppSidebar` when the collapse control is activated.
- `setMobile(val: boolean)` — sets `isMobile`. Called exclusively by the breakpoint composable (e.g., `useBreakpoint`) when the viewport crosses the mobile breakpoint threshold.

No layout component mutates `sidebarCollapsed` or `isMobile` through any other path. Direct property assignment is forbidden (FR-009). All test mocks for `ui.store` must expose both of these actions.

**Impact on plan:** `AppSidebar` collapse control emits are wired to `uiStore.toggleSidebar()`. The breakpoint composable calls `uiStore.setMobile(val)`. Unit tests mock both named actions. No other mutation surface needs to be planned.

---

#### CL-002 — `auth.store.resolvedPermissions` Type Shape

**Question:** What is the exact TypeScript type of `auth.store.resolvedPermissions`, and how does `AppSidebar` evaluate whether a NavigationItem's `permission` key is satisfied?

**Resolution:** `resolvedPermissions` is typed as `Record<string, boolean>`. `NavigationItem.permission` is a `string` key that is looked up in this record. The filter predicate applied in `AppSidebar` is:

```ts
items.filter(
  (item) => !item.permission || resolvedPermissions[item.permission] === true
)
```

A missing key evaluates as `false` — the item is hidden. This type is consistent with Pinia store state serialization (no `Map` usage). `auth.store` (defined in `ui-01-auth-module`) must export `resolvedPermissions: Record<string, boolean>`.

**Impact on plan:** `AppSidebar` filter logic uses `resolvedPermissions[key] === true`. Test fixtures for permission filtering use `Record<string, boolean>` shape. The `auth.store` interface contract in `ui-01-auth-module` must be confirmed to match this type before integration tests are written.

---

#### CL-003 — NavigationConfig Type Alias Correction

**Question:** `NavigationConfig` is defined as `type NavigationConfig = NavigationGroup[]`, but `AppSidebar.vue` props list the type as `NavigationConfig[]`. Which is the canonical correct form?

**Resolution:** The `AppSidebar.vue` prop is corrected to:

```ts
navigationConfig: NavigationConfig // i.e., NavigationGroup[]
```

`NavigationConfig[]` in the original props definition was a spec typo — it would incorrectly type the prop as `NavigationGroup[][]` (an array of arrays). The canonical definition `type NavigationConfig = NavigationGroup[]` is correct and final. All three `core/navigation/index.ts` files export a single `NavigationConfig` value (i.e., `NavigationGroup[]`), not a nested array.

**Impact on plan:** The `AppSidebar.vue` prop signature must use `navigationConfig: NavigationConfig`, not `navigationConfig: NavigationConfig[]`. NFR-011 (TypeScript strict mode) will catch this at compile time if the wrong form is used. Test fixtures pass a `NavigationGroup[]` directly as the prop value.

---

#### CL-004 — Frontoffice Sidebar Optionality Mechanism

**Question:** In Frontoffice, what is the exact mechanism that drives hiding the optional sidebar on certain routes — route meta, a `ui.store` property, or the `hideSidebar` prop on `AppLayout`?

**Resolution:** Frontoffice `App.vue` reads `route.meta.hideSidebar === true` and passes it as the `hideSidebar` prop to `AppLayout`:

```vue
<AppLayout :hideSidebar="route.meta.hideSidebar === true" />
```

This keeps `AppLayout` declarative (props-driven) and consistent with the `standaloneLayout` detection pattern — both sidebar visibility and layout bypass are controlled at the `App.vue` routing level, not inside `AppLayout` itself. `ui.store` is not used for sidebar visibility — `ui.store` controls only collapse state (`sidebarCollapsed`). Frontoffice routes that should hide the sidebar declare `meta: { hideSidebar: true }` in their route definition.

**Impact on plan:** The distinction between `hideSidebar` (prop, hides sidebar component) and `sidebarCollapsed` (store state, collapses sidebar to icon-only) must be clearly represented in implementation and tests. `App.vue` in Frontoffice requires a route meta check for `hideSidebar`. The `AppLayout.vue` prop table and template structure reflect this: `hideSidebar` suppresses `<AppSidebar />` rendering entirely.

---

#### CL-005 — Cross-Breakpoint Sidebar State Persistence

**Question:** When a user resizes from mobile (sidebar hidden/overlay) to desktop, does `sidebarCollapsed` reset to `false` (expanded) or retain its collapsed value?

**Resolution:** Breakpoint transition behavior is defined as follows:

- **Mobile → Desktop** (`isMobile` transitions `true → false`): `sidebarCollapsed` is reset to `false` (sidebar expanded). Mobile overlay-hidden state is not semantically equivalent to desktop collapsed state. The breakpoint composable calls `uiStore.setMobile(false)` AND resets `sidebarCollapsed` to `false` atomically.
- **Desktop → Mobile** (`isMobile` transitions `false → true`): `sidebarCollapsed` is set to `true`. The sidebar defaults to hidden/overlay mode on mobile.

The breakpoint composable (e.g., `useBreakpoint`) owns this reset logic via a `watch` on the computed mobile breakpoint. Layout components do not implement this logic directly — they react to store state only.

**Impact on plan:** The `useBreakpoint` composable implementation plan must include a `watch` that calls both `setMobile` and resets `sidebarCollapsed` on breakpoint crossings. NFR-005 (testability via composable mocks) applies: the composable must be testable with simulated breakpoint transitions that verify both state fields are updated correctly. Two snapshot states are needed in tests: mobile entry (collapsed true) and desktop re-entry (collapsed false).
