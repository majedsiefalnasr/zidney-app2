# Research: Layout System Integration

**Stage**: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION **Researched**: 2026-03-05 **Purpose**: Resolve all
NEEDS CLARIFICATION items before planning. Document codebase findings about existing structure,
gaps, and integration points.

---

## Summary of Findings

All spec clarifications (CL-001 through CL-005) are pre-resolved in the spec. This research focuses
on codebase reality vs. spec assumptions.

---

## Finding 1 — ui.store Gap (CRITICAL)

**Decision**: The existing `ui.store` in all three apps MUST be extended. It does not currently
expose `sidebarCollapsed` or `isMobile`.

**Current state** (identical across MMC, Backoffice, Frontoffice):

```
apps/mmc/src/core/state/ui.store.ts       → useMmcUiStore('mmc-ui')
apps/backoffice/src/core/state/ui.store.ts → useBackofficeUiStore('backoffice-ui')
apps/frontoffice/src/core/state/ui.store.ts → useFrontofficeUiStore('frontoffice-ui')
```

All three stores expose: `modals`, `drawers`, `overlayVisible`, `openModal`, `closeModal`,
`toggleModal`, `openDrawer`, `closeDrawer`, `toggleDrawer`, `showOverlay`, `hideOverlay`,
`closeAll`, `$reset`.

**Missing** (required by this stage):

- `sidebarCollapsed: ref<boolean>(false)` — sidebar collapse state
- `isMobile: ref<boolean>(false)` — viewport mobile flag
- `toggleSidebar(): void` — flips `sidebarCollapsed`
- `setMobile(val: boolean): void` — sets `isMobile`; also resets `sidebarCollapsed` per CL-005

**Rationale**: The spec (Assumption 1) states "ui.store already exists from a prior stage
(ui-06-state-management). This stage consumes it; it does not create it." However, the ui-06 stage
created only modal/drawer state. The layout-specific state was not in scope for ui-06. This stage
must ADD the sidebar/mobile state to the existing stores without modifying their existing interface.

**Alternatives considered**: Creating a separate `layout.store.ts` per app. Rejected — the spec
explicitly names `ui.store` as the exclusive layout state manager and the plan must extend the same
store.

---

## Finding 2 — auth.store Gap (CRITICAL)

**Decision**: `resolvedPermissions: Record<string, boolean>` must be ADDED to each app's auth store
return value.

**Current auth.store exports** (from MMC; identical pattern in Backoffice/Frontoffice):

- `isAuthenticated`, `user`, `isLoading`, `authError`
- `initSession`, `setSession`, `refresh`, `logout`, `clearAuthError`, `expireSession`

**AuthUser type** (from `apps/mmc/src/core/auth/types.ts`) — needs verification, but the store's
`user` ref is `AuthUser | null`. The spec assumes `resolvedPermissions` is a pre-computed Record.
Since no `permissions` field is confirmed on `AuthUser`, the safest implementation is to add
`resolvedPermissions` as a separate `ref<Record<string, boolean>>({})` that is populated during
`setSession` or `initSession` from the user profile data.

**Rationale**: Spec CL-002 confirms the type is `Record<string, boolean>`. The filter predicate is
`resolvedPermissions[key] === true`. Must be a separate named export from the store —
`AppSidebar.vue` reads it directly.

**Alternatives considered**: Computing permissions inside `AppSidebar.vue` from the user's raw
roles/permissions arrays. Rejected — FR-027 forbids AppSidebar from computing permissions itself.

---

## Finding 3 — RouteMeta Gap

**Decision**: Both `standaloneLayout?: boolean` and `hideSidebar?: boolean` must be ADDED to each
app's `RouteMeta` augmentation.

**Current RouteMeta fields** (identical in all three apps):

- `requiresAuth?: boolean`
- `public?: boolean`
- `roles?: string[]`
- `requiresWorkspace?: boolean`

**Missing** (required by this stage):

- `standaloneLayout?: boolean` — bypasses AppLayout in App.vue
- `hideSidebar?: boolean` — Frontoffice-specific sidebar hide via AppLayout prop

**File locations**:

- `apps/mmc/src/core/router/types.ts`
- `apps/backoffice/src/core/router/types.ts`
- `apps/frontoffice/src/core/router/types.ts`

---

## Finding 4 — Existing @zidney/ui-system Layout Primitives

**Decision**: Use `SidebarLayout.vue` and `TopBar.vue` from `@zidney/ui-system` as building blocks
where appropriate. The app-level `AppSidebar.vue` and `AppHeader.vue` will compose or adapt these.

**What exists in `packages/ui-system/src/components/Layout/`**:

| File                | Purpose                 | Slots                        |
| ------------------- | ----------------------- | ---------------------------- |
| `AppLayout.vue`     | Generic full-page shell | `topbar`, `sidebar`, default |
| `SidebarLayout.vue` | Collapsible nav sidebar | `footer`, default            |
| `TopBar.vue`        | Header bar              | default (right)              |

**Key difference from spec**: The ui-system `AppLayout.vue` uses `topbar` and `sidebar` slots — this
is the OLD pattern used in `BackofficeLayout.vue`. The NEW spec pattern requires named slots
`header-left`, `header-right`, `sidebar-footer`, `content-top`, `content-bottom` on the app-level
`AppLayout.vue`. The app-level `AppLayout.vue` DOES NOT delegate to the ui-system `AppLayout.vue`
directly — it composes `AppSidebar` and `AppHeader` (also app-level components) and exposes the
spec-defined named slots.

**Rationale**: The ui-system `AppLayout.vue` is a lower-level primitive. Each app's `AppLayout.vue`
builds the specific shell contract defined in the spec, consuming ui-system primitives like
`SidebarLayout` and `TopBar` internally within `AppSidebar.vue` and `AppHeader.vue` sub-components,
or using shadcn-vue primitives directly.

---

## Finding 5 — Existing BackofficeLayout.vue (SUPERSEDED)

**Decision**: `apps/backoffice/src/layouts/BackofficeLayout.vue` is the legacy layout from
STAGE_17_TENANT_BOOTSTRAP. It uses the OLD ui-system AppLayout + SidebarLayout + TopBar pattern with
module-driven navigation. This file will be REPLACED by the new `AppLayout.vue` component as part of
this stage.

**Current behavior**: Reads `enabledModules` from context store and generates nav items from
`MODULE_LABELS`. Uses `AppLayout` from ui-system with `topbar` and `sidebar` slots.

**Migration impact**: Any route that currently renders inside `BackofficeLayout.vue` must be
migrated to render inside the new `AppLayout.vue` via the App.vue wrapper approach (standaloneLayout
meta detection).

---

## Finding 6 — No @vueuse/core in App Packages (MMC)

**Decision**: The `useBreakpoint` composable MUST use native browser APIs (not VueUse) for
consistency across all three apps.

**Dependency audit**:

- `apps/mmc/package.json` — does NOT include `@vueuse/core` or `@zidney/ui-system`
- `apps/backoffice/package.json` — includes `@zidney/ui-system` (which re-exports VueUse)
- `apps/frontoffice/package.json` — includes `@zidney/ui-system` (which re-exports VueUse)

To maintain consistency (same composable pattern across all three apps with no special-casing), all
three `useBreakpoint` composables will use `window.addEventListener('resize', handler)` wrapped in
Vue's `onMounted`/`onUnmounted` lifecycle hooks. This is the minimal, framework-native approach.

**Rationale**: Using VueUse's `useEventListener` for Backoffice/Frontoffice but not MMC would create
inconsistent patterns. Native approach works correctly in all three and is equally testable via mock
`window.innerWidth` injection.

---

## Finding 7 — Composables Directory Existence

**Decision**: Need to create `src/composables/` directory for MMC and Frontoffice.

| App         | Composables dir                    | Status                                  |
| ----------- | ---------------------------------- | --------------------------------------- |
| MMC         | `apps/mmc/src/`                    | No `composables/` visible — must CREATE |
| Backoffice  | `apps/backoffice/src/composables/` | EXISTS                                  |
| Frontoffice | `apps/frontoffice/src/`            | No `composables/` visible — must CREATE |

---

## Finding 8 — No Existing Navigation Configs

**Decision**: `core/navigation/index.ts` must be created from scratch in all three apps.

No existing navigation configuration files found under any `core/navigation/` path. This is a new
file for each app.

File locations to create:

- `apps/mmc/src/core/navigation/index.ts`
- `apps/backoffice/src/core/navigation/index.ts`
- `apps/frontoffice/src/core/navigation/index.ts`

---

## Finding 9 — App.vue Baseline

**Decision**: All three `App.vue` files currently just render `<RouterView />`. They need to be
updated to conditionally wrap with `AppLayout`.

Current `App.vue` (all three apps):

```vue
<template>
  <RouterView />
</template>
```

Required pattern:

```vue
<template>
  <AppLayout v-if="!route.meta.standaloneLayout" :hideSidebar="route.meta.hideSidebar === true">
    <router-view />
  </AppLayout>
  <router-view v-else />
</template>
```

However — the `<router-view />` for content goes inside `AppLayout`. The slot-based approach means
the router-view renders in the `default` / `content` slot. See plan for exact structure.

---

## Finding 10 — Workspace Store in Backoffice

**Decision**: `useBackofficeWorkspaceStore` exposes `workspace: WorkspaceContext | null` with fields
`slug`, `name`, `tier`, `schemaVersion`, `productVersion`. `AppHeader.vue` in Backoffice reads
`workspace?.name ?? null` from this store.

**WorkspaceContext interface** (confirmed):

```ts
interface WorkspaceContext {
  slug: string;
  name: string;
  tier: string;
  schemaVersion: number;
  productVersion: string;
}
```

The store is at `apps/backoffice/src/core/state/workspace.store.ts`. Exported as
`useBackofficeWorkspaceStore`.

---

## Finding 11 — MMC Missing @zidney/ui-system Dependency

**Decision**: MMC does NOT currently depend on `@zidney/ui-system`. Since FR-010 requires all layout
components to use `@zidney/ui-system` primitives exclusively, the `@zidney/ui-system` dependency
must be ADDED to `apps/mmc/package.json`.

**Current MMC dependencies**: `@zidney/api-client`, `axios`, `lucide-vue-next`, `pinia`,
`pinia-plugin-persistedstate`, `vue`, `vue-router`.

**Rationale**: MMC is the platform control panel. Layout primitives (Button, Icon, Avatar, Dropdown,
Tooltip) all come from `@zidney/ui-system`. Without this dependency, MMC layout cannot consume
shadcn-vue components.

---

## Finding 12 — shadcn-vue Component Availability

**Decision**: Use existing shadcn-vue components available in `@zidney/ui-system` for layout
primitives: `Button`, `Avatar`, `DropdownMenu`, `Tooltip`, `Badge`.

**What's in ui-system**: The `packages/ui-system/src/components/shadcn-vue/` directory contains
shadcn-vue components. These are re-exported via the barrel at
`packages/ui-system/src/components/index.ts`.

---

## Resolved Spec Assumptions Verification

| Assumption                                       | Status                                                          | Notes                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `ui.store` exists from ui-06                     | ✅ Exists but incomplete                                        | Must add `sidebarCollapsed`, `isMobile`, `toggleSidebar`, `setMobile` |
| `auth.store.resolvedPermissions` exists          | ❌ Not found                                                    | Must add `resolvedPermissions: ref<Record<string, boolean>>({})`      |
| `workspace.store.currentWorkspace` in Backoffice | ✅ Exists as `workspace.value` in `useBackofficeWorkspaceStore` | Access via `workspaceStore.workspace?.name`                           |
| Breakpoints follow Tailwind v4 defaults          | ✅ No custom breakpoints found                                  | Mobile = below 768px (md), Desktop = 1024px+ (lg)                     |
| Icon identifiers from ui-system icon set         | ✅ `lucide-vue-next` in both MMC and ui-system                  | Icon names are Lucide icon names                                      |
| AppLayout is per-app                             | ✅ Confirmed                                                    | Each app owns its own layout components                               |
