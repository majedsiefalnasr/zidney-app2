# Technical Implementation Plan: Layout System Integration

**Stage**: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION **Phase**: 06_UI_APPLICATION_RUNTIME **Related
Spec**: `specs/runtime/ui-07-layout-system-integration/spec.md` **Related ADR**: None specific —
aligns with import boundary rules and UI system rules in AGENTS.md **Branch**:
`ui-07-layout-system-integration` **Plan Date**: 2026-03-05

---

## Stage Alignment

| Field          | Value                                                                                |
| -------------- | ------------------------------------------------------------------------------------ |
| Phase          | 06_UI_APPLICATION_RUNTIME                                                            |
| Stage          | STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION                                                |
| Spec File      | `specs/runtime/ui-07-layout-system-integration/spec.md`                              |
| ADR References | AGENTS.md §Import Boundary Rules, §UI System Rules                                   |
| Dependencies   | STAGE_UI_01_AUTH_MODULE, STAGE_UI_03_ROUTER_AND_GUARDS, STAGE_UI_06_STATE_MANAGEMENT |

---

## Architectural Scope Confirmation

| Constraint                          | Status       | Justification                                                                 |
| ----------------------------------- | ------------ | ----------------------------------------------------------------------------- |
| No cross-tenant data access         | ✅ Confirmed | Layout reads from already-resolved store state; no tenant DB access           |
| No middleware bypass                | ✅ Confirmed | `standaloneLayout` bypasses shell rendering only, never router guards         |
| No direct DB instantiation          | ✅ Confirmed | Frontend-only stage; zero DB interaction                                      |
| No grading logic outside Worker     | ✅ Confirmed | Not applicable                                                                |
| No weakening of snapshot integrity  | ✅ Confirmed | Not applicable                                                                |
| No weakening of version enforcement | ✅ Confirmed | Not applicable                                                                |
| No layer boundary violation         | ✅ Confirmed | All layout components import only from `@zidney/ui-system` and own-app stores |

---

## Implementation Layers

### Frontend Layer

This stage is **frontend-only**. No API routes, Worker jobs, or database changes are introduced.

**Apps affected**:

- `apps/mmc` — MMC platform control panel
- `apps/backoffice` — Tenant admin panel
- `apps/frontoffice` — Student-facing runtime

**Layer principles enforced**:

- No business logic in layout components
- No API calls in layout components
- No direct DB assumptions
- All state reads from pre-initialized Pinia stores only

### API Layer

**No changes.** No new routes, middleware, or validation changes.

### Worker Layer

**No changes.** Not applicable to this stage.

---

## Database Impact

### Master DB

- **Tables touched**: None
- **Migration required**: No
- **Version bump**: No

### Tenant DB

- **Tables touched**: None
- **Migration required**: No
- **schema_version change**: No
- **product_version compatibility impact**: None

---

## Transaction Design

Not applicable. Frontend-only stage with no mutating operations against any database.

---

## Idempotency Plan

Not applicable. No API mutations, no attempt workflows, no state-critical external operations.

---

## Version Enforcement Strategy

Not applicable. Version compatibility is enforced by backend middleware before views mount. Layout
layer operates downstream of all version checks.

---

## Authoritative Time Handling

Not applicable. Layout layer does not involve time-sensitive operations.

---

## Prerequisite Gap Resolution

Before implementing any layout component, the following prerequisite gaps identified in research
must be resolved first:

### Gap 1 — Add @zidney/ui-system to MMC

MMC's `apps/mmc/package.json` does not include `@zidney/ui-system`. Add it.

```json
// apps/mmc/package.json — add to dependencies:
"@zidney/ui-system": "workspace:*"
```

### Gap 2 — Extend ui.store in All Three Apps

Add `sidebarCollapsed`, `isMobile`, `toggleSidebar()`, `setMobile()` to each app's existing
`ui.store.ts`. Preserve existing modal/drawer state unchanged.

### Gap 3 — Add resolvedPermissions to auth.store in All Three Apps

Add `resolvedPermissions: ref<Record<string, boolean>>({})` to each auth store's state. Populate
during `setSession()` and `initSession()` from the user profile's permissions data. Clear in
`resetState()`.

### Gap 4 — Extend RouteMeta in All Three Apps

Add `standaloneLayout?: boolean` and `hideSidebar?: boolean` to each app's `core/router/types.ts`.

---

## Detailed Implementation: ui.store Extension

**Target files**:

- `apps/mmc/src/core/state/ui.store.ts`
- `apps/backoffice/src/core/state/ui.store.ts`
- `apps/frontoffice/src/core/state/ui.store.ts`

### New State (to add alongside existing modals/drawers):

```ts
// Add to each ui.store.ts — preserve all existing state unchanged
const sidebarCollapsed = ref<boolean>(false);
const isMobile = ref<boolean>(false);
```

### New Actions (to add alongside existing actions):

```ts
function toggleSidebar(): void {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

function setMobile(val: boolean): void {
  if (isMobile.value === val) return; // no-op if unchanged
  isMobile.value = val;
  // CL-005: atomic reset of sidebarCollapsed on breakpoint transition
  if (val) {
    // Desktop → Mobile: hide sidebar by default
    sidebarCollapsed.value = true;
  } else {
    // Mobile → Desktop: expand sidebar
    sidebarCollapsed.value = false;
  }
}
```

### Updated returns (add to existing return object):

```ts
return {
  // ... existing returns ...
  sidebarCollapsed,
  isMobile,
  toggleSidebar,
  setMobile,
};
```

### Updated $reset (extend existing):

```ts
function $reset(): void {
  // ... existing resets ...
  sidebarCollapsed.value = false;
  isMobile.value = false;
}
```

**Store ID contracts (unchanged)**:

- MMC: `'mmc-ui'` → accessed via `useMmcUiStore()`
- Backoffice: `'backoffice-ui'` → accessed via `useBackofficeUiStore()`
- Frontoffice: `'frontoffice-ui'` → accessed via `useFrontofficeUiStore()`

---

## Detailed Implementation: auth.store Extension

**Target files**:

- `apps/mmc/src/core/state/auth.store.ts`
- `apps/backoffice/src/core/state/auth.store.ts`
- `apps/frontoffice/src/core/state/auth.store.ts`

### New State:

```ts
// Add inside defineStore factory, alongside existing state refs
const resolvedPermissions = ref<Record<string, boolean>>({});
```

### Integration with existing actions:

```ts
// Inside setSession():
function setSession(accessToken: string, profile: AuthUser): void {
  tokenManager.setToken(accessToken);
  user.value = profile;
  isAuthenticated.value = true;
  isLoading.value = false;
  authError.value = null;
  // Populate resolved permissions from profile
  resolvedPermissions.value = buildResolvedPermissions(profile);
  logger.info("Session established", { userId: profile.id });
}

// Inside resetState() helper:
function resetState(): void {
  isAuthenticated.value = false;
  user.value = null;
  authError.value = null;
  resolvedPermissions.value = {}; // ← clear on logout/expire
}
```

### resolvedPermissions builder helper:

```ts
// Pure function — no side effects
function buildResolvedPermissions(profile: AuthUser): Record<string, boolean> {
  // If AuthUser has a permissions array or record, transform it here.
  // Implementation depends on AuthUser.permissions field shape.
  // Safe default: empty record if profile has no permissions field.
  if (!profile.permissions) return {};
  if (Array.isArray(profile.permissions)) {
    return Object.fromEntries(profile.permissions.map((p: string) => [p, true]));
  }
  // If already a Record<string, boolean>, return as-is
  return profile.permissions as Record<string, boolean>;
}
```

### Updated return:

```ts
return {
  // ... existing returns ...
  resolvedPermissions,
};
```

> **Note**: The exact `AuthUser.permissions` shape must be verified against
> `apps/mmc/src/core/auth/types.ts` during implementation. The builder function handles both
> array-of-strings and record formats safely.

---

## Detailed Implementation: RouteMeta Extension

**Target files**:

- `apps/mmc/src/core/router/types.ts`
- `apps/backoffice/src/core/router/types.ts`
- `apps/frontoffice/src/core/router/types.ts`

### New fields to add to both the `declare module 'vue-router'` block AND the `RouteMeta` interface:

```ts
/** Layout bypass: route renders directly without AppLayout shell */
standaloneLayout?: boolean
/** Frontoffice only: hides AppSidebar for this route (AppLayout still renders) */
hideSidebar?: boolean
```

### Example (MMC types.ts after change):

```ts
declare module "vue-router" {
  interface RouteMeta {
    requiresAuth?: boolean;
    public?: boolean;
    roles?: string[];
    requiresWorkspace?: boolean;
    standaloneLayout?: boolean; // ← new
    hideSidebar?: boolean; // ← new (Frontoffice only, but defined in all for type safety)
  }
}

export interface RouteMeta extends VueRouteMeta {
  requiresAuth?: boolean;
  public?: boolean;
  roles?: string[];
  requiresWorkspace?: boolean;
  standaloneLayout?: boolean; // ← new
  hideSidebar?: boolean; // ← new
}
```

---

## Detailed Implementation: NavigationConfig Types

**Location**: Each app's `core/navigation/` directory (new):

- `apps/mmc/src/core/navigation/index.ts`
- `apps/backoffice/src/core/navigation/index.ts`
- `apps/frontoffice/src/core/navigation/index.ts`

### Type Definitions (identical across all apps — do not share via package to preserve per-app independence):

```ts
// apps/<app>/src/core/navigation/index.ts

/**
 * A single navigation item referencing a named route.
 * Items with unmet permissions are hidden (not disabled).
 */
export interface NavigationItem {
  /** Named route (must exist in this app's router) */
  routeName: string;
  /** Display label (may be i18n key or raw string) */
  label: string;
  /** Lucide icon name from @zidney/ui-system icon set */
  icon?: string;
  /** Permission key — looked up in auth.store.resolvedPermissions */
  permission?: string;
  /** Nested items (max 1 level deep) */
  children?: NavigationItem[];
}

/**
 * A group of navigation items with an optional section heading.
 */
export interface NavigationGroup {
  /** Optional group section label */
  label?: string;
  items: NavigationItem[];
}

/**
 * Full navigation configuration for the app.
 * Type alias: array of NavigationGroup entries.
 */
export type NavigationConfig = NavigationGroup[];
```

### MMC Navigation Config (starter — platform-level items only):

```ts
// apps/mmc/src/core/navigation/index.ts

export const navigationConfig: NavigationConfig = [
  {
    label: "Platform",
    items: [
      {
        routeName: "mmc.dashboard",
        label: "Dashboard",
        icon: "LayoutDashboard",
        permission: "platform.view",
      },
      {
        routeName: "mmc.workspaces",
        label: "Workspaces",
        icon: "Building2",
        permission: "workspace.list",
      },
    ],
  },
];
```

### Backoffice Navigation Config (starter — workspace-level items):

```ts
// apps/backoffice/src/core/navigation/index.ts

export const navigationConfig: NavigationConfig = [
  {
    label: "Management",
    items: [
      {
        routeName: "bo.dashboard",
        label: "Dashboard",
        icon: "LayoutDashboard",
      },
      {
        routeName: "bo.exams",
        label: "Exams",
        icon: "FileText",
        permission: "exam.list",
      },
    ],
  },
];
```

### Frontoffice Navigation Config (starter — minimal student items):

```ts
// apps/frontoffice/src/core/navigation/index.ts

export const navigationConfig: NavigationConfig = [
  {
    items: [
      {
        routeName: "fo.home",
        label: "Home",
        icon: "Home",
      },
      {
        routeName: "fo.exams",
        label: "My Exams",
        icon: "ClipboardList",
      },
    ],
  },
];
```

> **Note**: Actual route names must be verified against each app's router before final
> implementation. These are starter configs — feature teams will add their entries in their
> respective stages.

---

## Detailed Implementation: useBreakpoint Composable

**Files to create**:

- `apps/mmc/src/composables/useBreakpoint.ts`
- `apps/backoffice/src/composables/useBreakpoint.ts`
- `apps/frontoffice/src/composables/useBreakpoint.ts`

### Implementation Pattern (identical across all three apps):

```ts
// apps/<app>/src/composables/useBreakpoint.ts

/**
 * Breakpoint detection composable.
 * Watches window.innerWidth for viewport changes.
 * Calls uiStore.setMobile(val) on breakpoint crossing.
 * Mobile boundary: below 768px (Tailwind 'md' breakpoint).
 *
 * CL-005: setMobile atomically resets sidebarCollapsed on transition.
 * NFR-005: Testable via mocked store — no real DOM resize needed.
 *
 * Stage: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
 */
import { onMounted, onUnmounted } from 'vue'
import { use<App>UiStore } from '../core/state/ui.store'

/** Mobile breakpoint: below Tailwind 'md' (768px) */
const MOBILE_BREAKPOINT = 768

export function useBreakpoint(): void {
  const uiStore = use<App>UiStore()

  function checkBreakpoint(): void {
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT
    uiStore.setMobile(isMobile)
  }

  onMounted(() => {
    // Initial check on mount
    checkBreakpoint()
    window.addEventListener('resize', checkBreakpoint)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', checkBreakpoint)
  })
}
```

> **Note**: Replace `use<App>UiStore` with the app-specific store import:
>
> - MMC: `useMmcUiStore` from `'../core/state/ui.store'`
> - Backoffice: `useBackofficeUiStore` from `'../core/state/ui.store'`
> - Frontoffice: `useFrontofficeUiStore` from `'../core/state/ui.store'`

**Breakpoint thresholds** (Tailwind v4 defaults):

- Mobile: `< 768px` (below `md`)
- Tablet: `768px – 1023px` (md range)
- Desktop: `≥ 1024px` (lg+)

The composable uses a single `MOBILE_BREAKPOINT` threshold (768px) to toggle the `isMobile` flag.
Desktop/tablet distinction is handled via CSS Tailwind classes responding to `isMobile` store state.

---

## Detailed Implementation: AppHeader.vue

**Files to create** (one per app):

- `apps/mmc/src/components/AppHeader.vue`
- `apps/backoffice/src/components/AppHeader.vue`
- `apps/frontoffice/src/components/AppHeader.vue`

### Props Interface:

```ts
interface AppHeaderProps {
  /** Show workspace name region (Backoffice: true; MMC + Frontoffice: false) */
  showWorkspace?: boolean;
}
```

### Slots:

| Slot    | Purpose                                                      |
| ------- | ------------------------------------------------------------ |
| `left`  | Left header region — passed from AppLayout's `header-left`   |
| `right` | Right header region — passed from AppLayout's `header-right` |

### Store Dependencies (read-only):

- **All apps**: `auth.store.currentUser` (user name/avatar display), `auth.store.logout()` (header
  logout action)
- **Backoffice only**: `workspace.store.workspace?.name` (workspace display name)

### Template Structure (MMC/Frontoffice variant):

```vue
<template>
  <TopBar :appName="appTitle">
    <template #default>
      <slot name="left" />
      <!-- Global search placeholder (non-functional, FR-038) -->
      <div class="app-header__search-placeholder" aria-hidden="true" />
      <!-- Notification placeholder (non-functional, FR-039) -->
      <div class="app-header__notification-placeholder" aria-hidden="true" />
      <slot name="right" />
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Avatar>
            <AvatarFallback>{{ userInitials }}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>{{ userName }}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="handleLogout">Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </template>
  </TopBar>
</template>
```

### Script Setup (MMC variant):

```ts
<script setup lang="ts">
import { computed } from 'vue'
import { TopBar } from '@zidney/ui-system'
import {
  Avatar, AvatarFallback,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator
} from '@zidney/ui-system'
import { storeToRefs } from 'pinia'
import { useMmcAuthStore } from '../core/state/auth.store'

interface AppHeaderProps {
  showWorkspace?: boolean
}

withDefaults(defineProps<AppHeaderProps>(), {
  showWorkspace: false,
})

defineSlots<{
  left(): void
  right(): void
}>()

const authStore = useMmcAuthStore()
const { user } = storeToRefs(authStore)

const userName = computed(() => user.value?.name ?? '')
const userInitials = computed(() => {
  const name = user.value?.name ?? ''
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
})

const appTitle = 'Zidney Platform' // MMC-specific title

async function handleLogout(): Promise<void> {
  await authStore.logout()
}
</script>
```

### Backoffice Variant Delta:

- Import `useBackofficeAuthStore` instead of `useMmcAuthStore`
- Import `useBackofficeWorkspaceStore`
- Add: `const workspaceStore = useBackofficeWorkspaceStore()`
- Add: `const { workspace } = storeToRefs(workspaceStore)`
- Add: `const workspaceName = computed(() => workspace.value?.name ?? '')`
- When `showWorkspace === true`, render workspace name in TopBar title or sub-heading
- `appTitle` becomes `workspaceName.value || 'Backoffice'`

### Frontoffice Variant Delta:

- Import `useFrontofficeAuthStore`
- No workspace name
- `appTitle` is empty string or brand name

### Null-Safety Rules:

- `user.value` may be `null` — all derived computeds default to `''`
- `workspace.value` may be `null` — workspace name defaults to `''`
- No component-level error throw on null state (NFR-009, NFR-010)

---

## Detailed Implementation: AppSidebar.vue

**Files to create**:

- `apps/mmc/src/components/AppSidebar.vue`
- `apps/backoffice/src/components/AppSidebar.vue`
- `apps/frontoffice/src/components/AppSidebar.vue`

### Props Interface:

```ts
// CL-003 correction applied: NavigationConfig (not NavigationConfig[])
import type { NavigationConfig } from "../core/navigation";

interface AppSidebarProps {
  navigationConfig: NavigationConfig; // NavigationGroup[]
}
```

### Emits: None (state delegated to ui.store via store action)

### Slots:

| Slot     | Purpose                                                          |
| -------- | ---------------------------------------------------------------- |
| `footer` | Sidebar footer region — passed from AppLayout's `sidebar-footer` |

### Store Dependencies (read-only):

- `ui.store.sidebarCollapsed` — drives collapsed/expanded visual state
- `ui.store.isMobile` — drives overlay vs. inline mode
- `ui.store.toggleSidebar()` — called by collapse control click
- `auth.store.resolvedPermissions` — filters navigation items

### Permission Filter Logic (from CL-002):

```ts
// Applied per NavigationGroup:
function filterItems(items: NavigationItem[]): NavigationItem[] {
  return items.filter(
    (item) => !item.permission || resolvedPermissions.value[item.permission] === true,
  );
}
```

### Active Route Detection:

```ts
import { useRoute } from "vue-router";
const route = useRoute();
const activeRouteName = computed(() => route.name as string | undefined);
```

### Template Structure:

```vue
<template>
  <SidebarLayout
    :items="processedNavItems"
    :collapsible="true"
    :defaultCollapsed="sidebarCollapsed"
    :activeItem="activeRouteName ?? ''"
    @collapse-toggled="handleCollapseToggle"
  >
    <template #footer>
      <slot name="footer" />
    </template>
  </SidebarLayout>
</template>
```

### Collapse Toggle Handler:

```ts
function handleCollapseToggle(_collapsed: boolean): void {
  // Delegate to store — no direct property mutation (FR-009)
  uiStore.toggleSidebar();
}
```

### Mobile Overlay Mode:

When `isMobile === true`, the sidebar renders as an overlay drawer (positioned fixed over content).
When `isMobile === false`, sidebar is inline.

```ts
const sidebarClass = computed(() => ({
  "app-sidebar--overlay": isMobile.value,
  "app-sidebar--inline": !isMobile.value,
  "app-sidebar--collapsed": sidebarCollapsed.value,
}));
```

### Processed Navigation Items:

The component transforms `NavigationConfig` into the `NavItem[]` shape expected by `SidebarLayout`,
applying permission filtering:

```ts
const processedNavItems = computed(() => {
  return props.navigationConfig.flatMap((group) =>
    filterItems(group.items).map((item) => ({
      id: item.routeName,
      label: item.label,
      icon: item.icon,
      show: true,
    })),
  );
});
```

> **Note**: Group labels are rendered separately using the `SidebarLayout`'s structure. Investigate
> `SidebarLayout`'s actual API — if it does not natively support group headings, they may need to be
> rendered as non-interactive dividers inside the items array or via custom slot content.

---

## Detailed Implementation: AppLayout.vue

**Files to create**:

- `apps/mmc/src/components/AppLayout.vue`
- `apps/backoffice/src/components/AppLayout.vue`
- `apps/frontoffice/src/components/AppLayout.vue`

### Props Interface:

```ts
interface AppLayoutProps {
  /** Hides AppSidebar entirely (Frontoffice route-meta-driven, CL-004) */
  hideSidebar?: boolean;
}
```

### Emits: None

### Slots:

| Slot Name        | Purpose                   |
| ---------------- | ------------------------- |
| `header-left`    | Left region of AppHeader  |
| `header-right`   | Right region of AppHeader |
| `sidebar-footer` | Bottom of AppSidebar      |
| `content-top`    | Above `<router-view />`   |
| `content-bottom` | Below `<router-view />`   |

### Store Dependencies (read-only):

- `ui.store.sidebarCollapsed` — CSS class binding for layout mode
- `ui.store.isMobile` — overlay mode switching

### Component Dependencies:

- `AppHeader.vue` (own-app component)
- `AppSidebar.vue` (own-app component)
- `navigationConfig` from `'../core/navigation'`

### Template Structure:

```vue
<template>
  <div
    :class="[
      'app-layout flex h-screen overflow-hidden',
      {
        'app-layout--mobile': isMobile,
        'app-layout--collapsed': sidebarCollapsed,
      },
    ]"
  >
    <!-- Sidebar (conditionally rendered) -->
    <AppSidebar v-if="!hideSidebar" :navigationConfig="navigationConfig">
      <template #footer>
        <slot name="sidebar-footer" />
      </template>
    </AppSidebar>

    <!-- Main area -->
    <div class="app-layout__main flex flex-col flex-1 overflow-hidden">
      <!-- Header -->
      <AppHeader :showWorkspace="showWorkspaceInHeader">
        <template #left>
          <slot name="header-left" />
        </template>
        <template #right>
          <slot name="header-right" />
        </template>
      </AppHeader>

      <!-- Content area -->
      <main class="app-layout__content flex-1 overflow-y-auto">
        <slot name="content-top" />
        <router-view />
        <slot name="content-bottom" />
      </main>
    </div>

    <!-- Mobile overlay backdrop -->
    <div
      v-if="isMobile && !sidebarCollapsed"
      class="app-layout__overlay fixed inset-0 bg-black/50 z-10"
      @click="uiStore.toggleSidebar()"
    />
  </div>
</template>
```

### Script Setup (MMC variant):

```ts
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useMmcUiStore } from '../core/state/ui.store'
import { useBreakpoint } from '../composables/useBreakpoint'
import { navigationConfig } from '../core/navigation'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'

interface AppLayoutProps {
  hideSidebar?: boolean
}

withDefaults(defineProps<AppLayoutProps>(), {
  hideSidebar: false,
})

defineSlots<{
  'header-left'(): void
  'header-right'(): void
  'sidebar-footer'(): void
  'content-top'(): void
  'content-bottom'(): void
}>()

const uiStore = useMmcUiStore()
const { sidebarCollapsed, isMobile } = storeToRefs(uiStore)

// Initialize breakpoint watcher — call composable at layout root
useBreakpoint()

// MMC: never show workspace in header
const showWorkspaceInHeader = false
</script>
```

### Per-App Deltas:

- **Backoffice**: `showWorkspaceInHeader = true`; import `useBackofficeUiStore` and
  `useBackofficeAuthStore`
- **Frontoffice**: `showWorkspaceInHeader = false`; import `useFrontofficeUiStore`

---

## Detailed Implementation: App.vue Update

**Files to update**:

- `apps/mmc/src/App.vue`
- `apps/backoffice/src/App.vue`
- `apps/frontoffice/src/App.vue`

### Pattern (identical for MMC and Backoffice):

```vue
<template>
  <template v-if="route.meta.standaloneLayout">
    <router-view />
  </template>
  <AppLayout v-else>
    <router-view />
  </AppLayout>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";
import AppLayout from "./components/AppLayout.vue";

const route = useRoute();
</script>
```

### Frontoffice Variant (adds hideSidebar support per CL-004):

```vue
<template>
  <template v-if="route.meta.standaloneLayout">
    <router-view />
  </template>
  <AppLayout v-else :hideSidebar="route.meta.hideSidebar === true">
    <router-view />
  </AppLayout>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";
import AppLayout from "./components/AppLayout.vue";

const route = useRoute();
</script>
```

> **Note on router-view inside AppLayout**: The `<router-view />` inside `<AppLayout>` renders into
> the AppLayout's default/content slot (or is placed in the main content area by AppLayout's
> template structure, not via slot). The AppLayout's template directly contains `<router-view />` —
> feature views do not need to pass themselves as slots. The AppLayout's `content-top` and
> `content-bottom` slots are optionally filled by feature views using Vue's
> `<template v-slot:content-top>` syntax from their own templates.

---

## Standalone Route Declarations

Existing routes that must declare `meta: { standaloneLayout: true }`:

- All auth routes (login, forgot password, reset password) in all three apps
- All error/404 routes in all three apps
- Frontoffice: attempt runtime routes must declare `meta: { standaloneLayout: true }`
- Frontoffice: routes where sidebar is hidden declare `meta: { hideSidebar: true }`

> **Implementation note**: Identify and update all such existing route definitions in each app's
> router. This is a cross-cutting concern that touches the existing route files in
> `apps/<app>/src/core/router/index.ts`.

---

## Testing Architecture

### Test File Locations

```
tests/unit/
├── mmc/
│   ├── components/
│   │   ├── AppLayout.test.ts
│   │   ├── AppSidebar.test.ts
│   │   └── AppHeader.test.ts
│   └── composables/
│       └── useBreakpoint.test.ts
├── backoffice/
│   ├── components/
│   │   ├── AppLayout.test.ts
│   │   ├── AppSidebar.test.ts
│   │   └── AppHeader.test.ts
│   └── composables/
│       └── useBreakpoint.test.ts
└── frontoffice/
    ├── components/
    │   ├── AppLayout.test.ts
    │   ├── AppSidebar.test.ts
    │   └── AppHeader.test.ts
    └── composables/
        └── useBreakpoint.test.ts
```

Additionally:

```
tests/unit/mmc/core/state/ui.store.layout.test.ts
tests/unit/backoffice/core/state/ui.store.layout.test.ts
tests/unit/frontoffice/core/state/ui.store.layout.test.ts
```

### Mock Store Pattern (Vitest + @pinia/testing):

```ts
// Pattern for all component tests
import { createTestingPinia } from "@pinia/testing";
import { mount } from "@vue/test-utils";
import { vi } from "vitest";

const mockUiStore = {
  sidebarCollapsed: false,
  isMobile: false,
  toggleSidebar: vi.fn(),
  setMobile: vi.fn(),
};

const mockAuthStore = {
  user: { id: "1", name: "Test User", email: "test@example.com" },
  resolvedPermissions: { "exam.list": true, "platform.view": true },
  logout: vi.fn(),
};

const wrapper = mount(AppLayout, {
  global: {
    plugins: [
      createTestingPinia({
        createSpy: vi.fn,
        initialState: {
          "mmc-ui": mockUiStore,
          "mmc-auth": mockAuthStore,
        },
      }),
    ],
    stubs: { RouterView: true },
  },
});
```

### Test Plan per Component:

#### AppLayout.vue tests:

| Test                                                 | What to verify                                |
| ---------------------------------------------------- | --------------------------------------------- |
| Renders AppSidebar and AppHeader when not standalone | Both sub-components present in DOM            |
| Hides AppSidebar when `hideSidebar=true`             | AppSidebar absent from DOM                    |
| Applies mobile CSS class when store `isMobile=true`  | `.app-layout--mobile` class present           |
| Renders overlay backdrop on mobile when sidebar open | Backdrop div renders                          |
| Clicking overlay backdrop calls `toggleSidebar()`    | Store action called                           |
| All 5 named slots render injected content            | Each slot's content appears in correct region |
| Snapshot test (default state)                        | Stable structure snapshot                     |
| Snapshot test (collapsed sidebar)                    | Stable collapsed structure snapshot           |
| Snapshot test (mobile mode)                          | Stable mobile structure snapshot              |

#### AppSidebar.vue tests:

| Test                                          | What to verify                                                      |
| --------------------------------------------- | ------------------------------------------------------------------- |
| Renders only items with met permissions       | Items with `permission='exam.list'` visible when permission granted |
| Hides items whose permission key is absent    | Item hidden when permission key not in `resolvedPermissions`        |
| Hides items whose permission key is `false`   | Item hidden when `resolvedPermissions[key] === false`               |
| Empty navigation config renders without error | No crash, empty list                                                |
| Active route item is visually indicated       | Active class on matching item                                       |
| Collapse control calls `toggleSidebar()`      | Store action called on toggle click                                 |
| Collapsed mode shows icons only               | Labels absent in collapsed state                                    |
| `sidebar-footer` slot renders content         | Footer slot content appears at bottom                               |
| Null resolvedPermissions renders public items | Items without `permission` field still render                       |

#### AppHeader.vue tests:

| Test                                             | What to verify                      |
| ------------------------------------------------ | ----------------------------------- |
| Renders user name from store                     | `user.value.name` appears in header |
| Renders user initials in avatar                  | Correct initials from name          |
| Logout button calls `authStore.logout()`         | Store action called on click        |
| Workspace name renders when `showWorkspace=true` | Workspace name visible              |
| Workspace name absent when `showWorkspace=false` | No workspace text                   |
| Null user renders without crash                  | No error, placeholder shown         |
| Null workspace renders without crash             | No error, placeholder shown         |
| `left` and `right` slots render content          | Both slots receive injected content |

#### useBreakpoint composable tests:

| Test                                                   | What to verify                          |
| ------------------------------------------------------ | --------------------------------------- |
| Calls `setMobile(true)` on mount when width < 768      | Store action called with `true`         |
| Calls `setMobile(false)` on mount when width ≥ 768     | Store action called with `false`        |
| Calls `setMobile` when window resize crosses threshold | Store action called on simulated resize |
| Removes event listener on unmount                      | No memory leaks                         |

**Responsive testing methodology** (NFR-005): Mock `window.innerWidth` by setting
`Object.defineProperty(window, 'innerWidth', { value: 767, writable: true })` before mount, then
dispatch a synthetic `resize` event.

#### ui.store layout extension tests:

| Test                                                                  | What to verify                           |
| --------------------------------------------------------------------- | ---------------------------------------- |
| `toggleSidebar()` flips `sidebarCollapsed`                            | `false → true → false`                   |
| `setMobile(true)` sets `isMobile=true` and `sidebarCollapsed=true`    | Both fields updated (CL-005)             |
| `setMobile(false)` sets `isMobile=false` and `sidebarCollapsed=false` | Both fields updated (CL-005)             |
| `setMobile` is a no-op when value unchanged                           | No state mutation when same value passed |
| `$reset()` clears `sidebarCollapsed` and `isMobile`                   | Both return to `false`                   |

### Integration Test (AppLayout + AppSidebar + AppHeader together):

```
tests/integration/mmc/app-layout.integration.test.ts
tests/integration/backoffice/app-layout.integration.test.ts
tests/integration/frontoffice/app-layout.integration.test.ts
```

Each integration test:

1. Mounts `AppLayout` with real child components (AppSidebar + AppHeader)
2. Uses `createTestingPinia` with initial state
3. Verifies that sidebar toggle flows from header/sidebar toggle through store to layout re-render
4. Verifies that standalone route bypass omits AppLayout entirely (App.vue level)

### Standalone Bypass Test:

```
tests/unit/mmc/App.test.ts
```

- Mount `App.vue` with a route that has `meta.standaloneLayout = true`
- Verify AppLayout is NOT rendered
- Mount with regular route, verify AppLayout IS rendered

### Slot Injection Test (all 5 slots):

```ts
const wrapper = mount(AppLayout, {
  slots: {
    "header-left": '<div data-testid="header-left-injection">Title</div>',
    "header-right": '<div data-testid="header-right-injection">Actions</div>',
    "sidebar-footer": '<div data-testid="sidebar-footer-injection">v1.0</div>',
    "content-top": '<div data-testid="content-top-injection">Breadcrumb</div>',
    "content-bottom": '<div data-testid="content-bottom-injection">Footer</div>',
  },
  // ... store mocks
});

expect(wrapper.find('[data-testid="header-left-injection"]').exists()).toBe(true);
// etc.
```

---

## Implementation Order (Dependency-Ordered)

| Step | Task                                                         | Files                                                | Dependency       |
| ---- | ------------------------------------------------------------ | ---------------------------------------------------- | ---------------- |
| 1    | Add `@zidney/ui-system` to MMC dependencies                  | `apps/mmc/package.json`                              | None             |
| 2    | Extend ui.store with sidebar/mobile state (all 3 apps)       | `apps/*/src/core/state/ui.store.ts`                  | None             |
| 3    | Add resolvedPermissions to auth.store (all 3 apps)           | `apps/*/src/core/state/auth.store.ts`                | None             |
| 4    | Extend RouteMeta types (all 3 apps)                          | `apps/*/src/core/router/types.ts`                    | None             |
| 5    | Create NavigationConfig types + starter configs (all 3 apps) | `apps/*/src/core/navigation/index.ts`                | Step 4           |
| 6    | Create useBreakpoint composable (all 3 apps)                 | `apps/*/src/composables/useBreakpoint.ts`            | Step 2           |
| 7    | Create AppHeader.vue (all 3 apps)                            | `apps/*/src/components/AppHeader.vue`                | Steps 1, 3       |
| 8    | Create AppSidebar.vue (all 3 apps)                           | `apps/*/src/components/AppSidebar.vue`               | Steps 1, 2, 3, 5 |
| 9    | Create AppLayout.vue (all 3 apps)                            | `apps/*/src/components/AppLayout.vue`                | Steps 2, 6, 7, 8 |
| 10   | Update App.vue (all 3 apps)                                  | `apps/*/src/App.vue`                                 | Step 9           |
| 11   | Update standalone route meta in existing routes (all 3 apps) | `apps/*/src/core/router/index.ts`                    | Step 4           |
| 12   | Remove/deprecate BackofficeLayout.vue                        | `apps/backoffice/src/layouts/BackofficeLayout.vue`   | Step 10          |
| 13   | Write unit tests for ui.store extensions (all 3 apps)        | `tests/unit/*/core/state/ui.store.layout.test.ts`    | Step 2           |
| 14   | Write unit tests for useBreakpoint (all 3 apps)              | `tests/unit/*/composables/useBreakpoint.test.ts`     | Step 6           |
| 15   | Write unit tests for AppHeader (all 3 apps)                  | `tests/unit/*/components/AppHeader.test.ts`          | Step 7           |
| 16   | Write unit tests for AppSidebar (all 3 apps)                 | `tests/unit/*/components/AppSidebar.test.ts`         | Step 8           |
| 17   | Write unit tests + snapshots for AppLayout (all 3 apps)      | `tests/unit/*/components/AppLayout.test.ts`          | Step 9           |
| 18   | Write integration tests (all 3 apps)                         | `tests/integration/*/app-layout.integration.test.ts` | Steps 15–17      |
| 19   | Write App.vue standalone bypass tests (all 3 apps)           | `tests/unit/*/App.test.ts`                           | Step 10          |
| 20   | Run lint + type-check across all apps                        | CI validation                                        | All above        |

**Total estimated tasks**: ~60 discrete tasks (20 steps × 3 apps average, with some steps
app-specific)

---

## Risk Assessment

### Risk 1 — ui.store Extension Regression (HIGH)

**Risk**: Adding `sidebarCollapsed`/`isMobile` to existing ui.store may conflict with existing
modal/drawer usage or break existing tests that assert on store state shape. **Mitigation**: Add new
state in a separate section of the store file. Ensure `$reset()` extension does not interfere with
existing reset behavior. Run existing ui.store tests after the extension.

### Risk 2 — auth.store resolvedPermissions Population Timing (HIGH)

**Risk**: `resolvedPermissions` may be `{}` during initial render if `setSession()` hasn't been
called yet (e.g., during session restore via `initSession()`). Sidebar will render with all
permission-gated items hidden until permissions populate. **Mitigation**: AppSidebar's `filterItems`
must handle the empty-record case gracefully (items with `permission` are hidden until permissions
load). This is expected behavior per spec edge cases. Ensure `initSession()` also populates
`resolvedPermissions` from the fetched profile.

### Risk 3 — BackofficeLayout.vue Migration (MEDIUM)

**Risk**: Existing routes that render inside `BackofficeLayout.vue` use it as a layout wrapper
component placed in the router (not App.vue). Migrating to the App.vue shell approach may break
existing route tree structures. **Mitigation**: Audit all Backoffice routes that currently use
`BackofficeLayout.vue`. Remove it from route definitions and replace with the canonical
`meta: { requiresAuth: true }` approach after App.vue wraps with AppLayout. Ensure no feature views
directly import BackofficeLayout.

### Risk 4 — MMC Missing @zidney/ui-system (MEDIUM)

**Risk**: After adding `@zidney/ui-system` to MMC, the package bundle size increases significantly.
**Mitigation**: Tree-shaking via Vite's ESM build will limit the impact. Only imported components
are included. Monitor bundle size in CI.

### Risk 5 — SidebarLayout Group Headings (LOW)

**Risk**: `SidebarLayout.vue` in ui-system does not natively support group labels — it only renders
`NavItem[]` flat. The `NavigationGroup.label` field cannot be rendered without ui-system
modification or a custom rendering approach. **Mitigation**: In Phase 1 implementation, render group
labels as non-interactive separator items in the processed nav items array (with a special
`disabled: true` + no `icon` shape), or handle groups entirely in `AppSidebar.vue`'s template
alongside the `SidebarLayout`. If this is a blocker, an enhancement to `SidebarLayout` in
`@zidney/ui-system` may be needed.

### Risk 6 — AuthUser.permissions Type Shape (LOW)

**Risk**: `AuthUser` type (in `apps/*/src/core/auth/types.ts`) may not include a `permissions`
field, requiring the `buildResolvedPermissions` helper to return `{}` always until the auth module
adds it. **Mitigation**: Verify `AuthUser` type at implementation time. If no permissions field
exists yet, `resolvedPermissions` defaults to `{}` and the sidebar shows only `permission`-free
items. Document this as a prerequisite for `ui-01-auth-module` extension.

### Risk 7 — BackofficeLayout.vue Import Dependencies (LOW)

**Risk**: Other files may import from `BackofficeLayout.vue` directly (violating FR-007 but
potentially existing already). **Mitigation**: Search all Backoffice source files for imports of
`BackofficeLayout` before deprecating. Clean up any found imports.

---

## Constitutional Compliance Recheck (Post-Design)

| Rule                      | Compliance | Evidence                                                                     |
| ------------------------- | ---------- | ---------------------------------------------------------------------------- |
| No cross-tenant access    | ✅         | Layout reads from pre-resolved store state only                              |
| No middleware bypass      | ✅         | `standaloneLayout` skips shell only; router guards run first                 |
| No DB instantiation       | ✅         | Frontend-only stage                                                          |
| No grading outside Worker | ✅         | Not applicable                                                               |
| Snapshot integrity        | ✅         | Not applicable                                                               |
| Version enforcement       | ✅         | Not applicable                                                               |
| Import boundaries         | ✅         | Each app imports from own stores + `@zidney/ui-system` only                  |
| UI system first           | ✅         | SidebarLayout, TopBar, Button, Avatar, DropdownMenu from `@zidney/ui-system` |
| No hardcoded brand colors | ✅         | All colors from Tailwind tokens and design system                            |
| White-label = visual only | ✅         | Logo/brand token slots provided; no structural divergence                    |
| No business logic in UI   | ✅         | Layout reads store state; no RBAC, no permission computation, no API calls   |

---

## File Creation Summary

### New Files (34 total):

```
apps/mmc/src/core/navigation/index.ts
apps/mmc/src/composables/useBreakpoint.ts
apps/mmc/src/components/AppHeader.vue
apps/mmc/src/components/AppSidebar.vue
apps/mmc/src/components/AppLayout.vue

apps/backoffice/src/core/navigation/index.ts
apps/backoffice/src/composables/useBreakpoint.ts
apps/backoffice/src/components/AppHeader.vue
apps/backoffice/src/components/AppSidebar.vue
apps/backoffice/src/components/AppLayout.vue

apps/frontoffice/src/core/navigation/index.ts
apps/frontoffice/src/composables/useBreakpoint.ts
apps/frontoffice/src/components/AppHeader.vue
apps/frontoffice/src/components/AppSidebar.vue
apps/frontoffice/src/components/AppLayout.vue

tests/unit/mmc/components/AppLayout.test.ts
tests/unit/mmc/components/AppSidebar.test.ts
tests/unit/mmc/components/AppHeader.test.ts
tests/unit/mmc/composables/useBreakpoint.test.ts
tests/unit/mmc/core/state/ui.store.layout.test.ts
tests/unit/mmc/App.test.ts

tests/unit/backoffice/components/AppLayout.test.ts
tests/unit/backoffice/components/AppSidebar.test.ts
tests/unit/backoffice/components/AppHeader.test.ts
tests/unit/backoffice/composables/useBreakpoint.test.ts
tests/unit/backoffice/core/state/ui.store.layout.test.ts

tests/unit/frontoffice/components/AppLayout.test.ts
tests/unit/frontoffice/components/AppSidebar.test.ts
tests/unit/frontoffice/components/AppHeader.test.ts
tests/unit/frontoffice/composables/useBreakpoint.test.ts
tests/unit/frontoffice/core/state/ui.store.layout.test.ts

tests/integration/mmc/app-layout.integration.test.ts
tests/integration/backoffice/app-layout.integration.test.ts
tests/integration/frontoffice/app-layout.integration.test.ts
```

### Modified Files (14 total):

```
apps/mmc/package.json                              ← add @zidney/ui-system
apps/mmc/src/core/state/ui.store.ts                ← add sidebar/mobile state
apps/mmc/src/core/state/auth.store.ts              ← add resolvedPermissions
apps/mmc/src/core/router/types.ts                  ← add standaloneLayout, hideSidebar
apps/mmc/src/App.vue                               ← wrap with AppLayout

apps/backoffice/src/core/state/ui.store.ts         ← add sidebar/mobile state
apps/backoffice/src/core/state/auth.store.ts       ← add resolvedPermissions
apps/backoffice/src/core/router/types.ts           ← add standaloneLayout, hideSidebar
apps/backoffice/src/App.vue                        ← wrap with AppLayout

apps/frontoffice/src/core/state/ui.store.ts        ← add sidebar/mobile state
apps/frontoffice/src/core/state/auth.store.ts      ← add resolvedPermissions
apps/frontoffice/src/core/router/types.ts          ← add standaloneLayout, hideSidebar
apps/frontoffice/src/App.vue                       ← wrap with AppLayout + hideSidebar prop

apps/backoffice/src/layouts/BackofficeLayout.vue   ← deprecate/remove
```

### Router files to audit for standalone meta:

```
apps/mmc/src/core/router/index.ts                  ← add standaloneLayout to auth/error routes
apps/backoffice/src/core/router/index.ts           ← add standaloneLayout to auth/error routes
apps/frontoffice/src/core/router/index.ts          ← add standaloneLayout to auth/error/attempt routes
                                                      add hideSidebar to relevant fo routes
```
