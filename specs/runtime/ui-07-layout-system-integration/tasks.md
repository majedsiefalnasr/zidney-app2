# Tasks: Layout System Integration

**Stage**: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
**Phase**: 06_UI_APPLICATION_RUNTIME
**Related Plan**: `specs/runtime/ui-07-layout-system-integration/plan.md`
**Related Spec**: `specs/runtime/ui-07-layout-system-integration/spec.md`
**Generated**: 2026-03-05

---

## Stage Context

| Field              | Value                                                                                |
| ------------------ | ------------------------------------------------------------------------------------ |
| Phase              | 06_UI_APPLICATION_RUNTIME                                                            |
| Stage              | STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION                                                |
| Layer              | Frontend only — no API, Worker, or DB changes                                        |
| ADR References     | AGENTS.md §Import Boundary Rules, §UI System Rules                                   |
| Stage Dependencies | STAGE_UI_01_AUTH_MODULE, STAGE_UI_03_ROUTER_AND_GUARDS, STAGE_UI_06_STATE_MANAGEMENT |

**Constitutional Compliance**: Frontend-only. No tenant DB access, no middleware bypass, no grading logic, no DB instantiation. Layout renders after all middleware has resolved.

---

## User Story Labels

| Label | User Story                                                | Priority |
| ----- | --------------------------------------------------------- | -------- |
| [US1] | Authenticated Shell Renders Consistently Across All Apps  | P1       |
| [US2] | Sidebar Collapses and Expands Correctly                   | P1       |
| [US3] | Navigation Items Reflect Active Route and Permitted Links | P1       |
| [US4] | Backoffice Header Reflects Workspace Context              | P2       |
| [US5] | Attempt Runtime Bypasses the Full Layout                  | P2       |
| [US6] | Layout Slots Allow Feature-Module Content Injection       | P3       |

> **Foundation tasks** (Phase 1–3) carry no [US] label — they are non-user-facing infrastructure prerequisites required by all user stories.

---

## Task Categories

This stage is **Frontend only**. All tasks are frontend implementation tasks.

| Category       | Applicable |
| -------------- | ---------- |
| Infrastructure | No         |
| API            | No         |
| Worker         | No         |
| Frontend       | ✅ Yes     |
| Observability  | No         |
| Testing        | ✅ Yes     |

---

## Phase 1 — Dependency and Store Foundation

**Goal**: Establish the package dependency for MMC, extend `ui.store` in all three apps with sidebar/mobile state, and extend `auth.store` in all three apps with `resolvedPermissions`.

**Dependency rule**: T001 must complete before T002. T002–T007 may execute in parallel after T001.

**Independent test**: Each store extension can be validated in isolation — import the store, call `toggleSidebar()` / `setMobile()` / check `resolvedPermissions` default value without mounting any component.

### Tasks

- [ ] T001 Add `"@zidney/ui-system": "workspace:*"` to dependencies in `apps/mmc/package.json`; also extend `apps/mmc/vite.config.ts` resolve aliases to map `@zidney/ui-system` to `../../packages/ui-system/src/index.ts` so that both dev and build resolve to source (prevents dual module identity with the existing `@zidney/ui` alias, which would cause identical components to be bundled twice and silently break Vue component instance comparisons)
- [ ] T002 [P] Extend `apps/mmc/src/core/state/ui.store.ts` — add `sidebarCollapsed: ref<boolean>(false)`, `isMobile: ref<boolean>(false)`, `toggleSidebar()`, `setMobile(val)` with atomic `sidebarCollapsed` reset, and include them in `return` and `$reset()`
- [ ] T003 [P] Extend `apps/backoffice/src/core/state/ui.store.ts` — add `sidebarCollapsed: ref<boolean>(false)`, `isMobile: ref<boolean>(false)`, `toggleSidebar()`, `setMobile(val)` with atomic `sidebarCollapsed` reset, and include them in `return` and `$reset()`
- [ ] T004 [P] Extend `apps/frontoffice/src/core/state/ui.store.ts` — add `sidebarCollapsed: ref<boolean>(false)`, `isMobile: ref<boolean>(false)`, `toggleSidebar()`, `setMobile(val)` with atomic `sidebarCollapsed` reset, and include them in `return` and `$reset()`
- [ ] T005 [P] Extend `apps/mmc/src/core/state/auth.store.ts` — add `resolvedPermissions: ref<Record<string, boolean>>({})`, `buildResolvedPermissions(profile)` pure helper (handles array-of-strings, passthrough Record, and null/undefined guard), populate in `setSession()` and `initSession()`, clear in `resetState()` AND in `expireSession()` (stale permissions must not persist between the expiry event and the reload/redirect)
- [ ] T006 [P] Extend `apps/backoffice/src/core/state/auth.store.ts` — add `resolvedPermissions: ref<Record<string, boolean>>({})`, `buildResolvedPermissions(profile)` pure helper (handles array-of-strings, passthrough Record, and null/undefined guard), populate in `setSession()` and `initSession()`, clear in `resetState()` AND in `expireSession()` (stale permissions must not persist between the expiry event and the reload/redirect)
- [ ] T007 [P] Extend `apps/frontoffice/src/core/state/auth.store.ts` — add `resolvedPermissions: ref<Record<string, boolean>>({})`, `buildResolvedPermissions(profile)` pure helper (handles array-of-strings, passthrough Record, and null/undefined guard), populate in `setSession()` and `initSession()`, clear in `resetState()` AND in `expireSession()` (stale permissions must not persist between the expiry event and the reload/redirect)

---

## Phase 2 — Types and Configuration

**Goal**: Add `standaloneLayout` and `hideSidebar` to `RouteMeta` in all three apps, and create `NavigationConfig` type definitions with starter navigation configs in all three apps.

**Dependency rule**: All Phase 2 tasks are independent of each other. All may execute in parallel. T008–T013 may begin concurrently with T002–T007.

**Independent test**: TypeScript compilation passes when a route object sets `meta: { standaloneLayout: true }`. Navigation config exports a non-empty array with at least one `NavigationGroup`.

### Tasks

- [ ] T008 [P] Add `standaloneLayout?: boolean` and `hideSidebar?: boolean` fields to the `RouteMeta` augmentation in `apps/mmc/src/core/router/types.ts`
- [ ] T009 [P] Add `standaloneLayout?: boolean` and `hideSidebar?: boolean` fields to the `RouteMeta` augmentation in `apps/backoffice/src/core/router/types.ts`
- [ ] T010 [P] Add `standaloneLayout?: boolean` and `hideSidebar?: boolean` fields to the `RouteMeta` augmentation in `apps/frontoffice/src/core/router/types.ts`
- [ ] T011 [P] Create `apps/mmc/src/core/navigation/index.ts` — export `NavigationItem`, `NavigationGroup`, `NavigationConfig` types and `navigationConfig: NavigationConfig` starter array with Platform group containing Dashboard and Workspaces items
- [ ] T012 [P] Create `apps/backoffice/src/core/navigation/index.ts` — export `NavigationItem`, `NavigationGroup`, `NavigationConfig` types and `navigationConfig: NavigationConfig` starter array with Management group containing Dashboard and Exams items
- [ ] T013 [P] Create `apps/frontoffice/src/core/navigation/index.ts` — export `NavigationItem`, `NavigationGroup`, `NavigationConfig` types and `navigationConfig: NavigationConfig` starter array with ungrouped Home and My Exams items

---

## Phase 3 — Composable Infrastructure

**Goal**: Create the `useBreakpoint` composable in all three apps using native `window.addEventListener('resize', ...)` wrapped in `onMounted`/`onUnmounted`. Calls `uiStore.setMobile(val)` when viewport crosses 768px threshold.

**Dependency rule**: Requires T002–T004 (ui.store extension) to be complete. All three composables are independent of each other and may execute in parallel.

**Independent test**: Composable can be tested by mocking `window.innerWidth` and calling `mount()` — verify `setMobile(true)` is called when width is below 768 and `setMobile(false)` when at or above 768.

### Tasks

- [ ] T014 [P] Create `apps/mmc/src/composables/useBreakpoint.ts` — breakpoint composable using `window.addEventListener('resize', checkBreakpoint)` in `onMounted`, removes listener in `onUnmounted`, calls `useMmcUiStore().setMobile()` at 768px threshold
- [ ] T015 [P] Create `apps/backoffice/src/composables/useBreakpoint.ts` — breakpoint composable using `window.addEventListener('resize', checkBreakpoint)` in `onMounted`, removes listener in `onUnmounted`, calls `useBackofficeUiStore().setMobile()` at 768px threshold
- [ ] T016 [P] Create `apps/frontoffice/src/composables/useBreakpoint.ts` — breakpoint composable using `window.addEventListener('resize', checkBreakpoint)` in `onMounted`, removes listener in `onUnmounted`, calls `useFrontofficeUiStore().setMobile()` at 768px threshold

---

## Phase 4a — AppHeader Components

**Goal**: Create app-specific `AppHeader.vue` in all three apps. Each header renders user avatar/initials, user name, and a logout dropdown using shadcn-vue components from `@zidney/ui-system`. Backoffice variant also shows workspace name.

**Dependency rule**: Requires Phase 1 (auth.store `resolvedPermissions`) and Phase 2 (types). All three are independent and may execute in parallel.

**Independent test (US1 + US4)**: Mount AppHeader with mocked auth store (user name = "Test User"). Verify: (a) initials "TU" appear in avatar, (b) logout click calls `authStore.logout()`, (c) Backoffice variant shows workspace name when `showWorkspace=true`, (d) null user renders without crash.

### Tasks

- [ ] T017 [P] [US1] Create `apps/mmc/src/components/layout/AppHeader.vue` — renders `TopBar` from `@zidney/ui-system`, user avatar with initials from `useMmcAuthStore().user`, logout `DropdownMenuItem` calling `handleLogout()` which wraps `await authStore.logout()` in try/catch (errors are handled inside the auth store; the component must not propagate uncaught promise rejections to the global error handler), exposes named slots `left` and `right`, `showWorkspace=false`
- [ ] T018 [P] [US4] Create `apps/backoffice/src/components/layout/AppHeader.vue` — renders `TopBar` from `@zidney/ui-system`, user avatar with initials from `useBackofficeAuthStore().user`, workspace name from `useBackofficeWorkspaceStore().workspace?.name` when `showWorkspace=true`, logout dropdown with `handleLogout()` wrapping `await authStore.logout()` in try/catch (errors handled in auth store; no uncaught promise rejections in component), exposes named slots `left` and `right`
- [ ] T019 [P] [US1] Create `apps/frontoffice/src/components/layout/AppHeader.vue` — renders `TopBar` from `@zidney/ui-system`, user avatar with initials from `useFrontofficeAuthStore().user`, logout dropdown with `handleLogout()` wrapping `await authStore.logout()` in try/catch (errors handled in auth store; no uncaught promise rejections in component), exposes named slots `left` and `right`, `showWorkspace=false`

---

## Phase 4b — AppSidebar Components

**Goal**: Create app-specific `AppSidebar.vue` in all three apps. Each sidebar accepts `navigationConfig: NavigationConfig` prop, filters items by `resolvedPermissions`, highlights the active route, drives collapse/overlay mode from `ui.store`, and exposes a `footer` slot.

**Dependency rule**: Requires T002–T007 (store extensions), T011–T013 (navigation config types), and T008–T010 (RouteMeta). All three AppSidebar components are independent of each other and may execute in parallel.

**Independent test (US2 + US3)**: Mount AppSidebar with mocked stores and `navigationConfig` containing items with and without `permission` field. Verify: (a) items with `permission='exam.list'` visible only when `resolvedPermissions['exam.list'] === true`, (b) active route item receives active CSS class, (c) clicking collapse control calls `toggleSidebar()`, (d) empty nav config renders without crash.

### Tasks

- [ ] T020 [P] [US3] [requires T055] Create `apps/mmc/src/components/layout/AppSidebar.vue` — **T055 must be complete first** (SidebarLayout.vue watch-synced prop required); accepts `navigationConfig: NavigationConfig` prop, filters items using `useMmcAuthStore().resolvedPermissions`, highlights active item using `useRoute().name`, renders `SidebarLayout` from `@zidney/ui-system`, passes `collapsed` prop from `sidebarCollapsed`, drives `isMobile` from `useMmcUiStore()`, calls `toggleSidebar()` on collapse control click, renders group label as a non-interactive visual separator row above each group when `NavigationGroup.label` is non-empty (FR-030), exposes `footer` slot
- [ ] T021 [P] [US3] [requires T055] Create `apps/backoffice/src/components/layout/AppSidebar.vue` — **T055 must be complete first** (SidebarLayout.vue watch-synced prop required); accepts `navigationConfig: NavigationConfig` prop, filters items using `useBackofficeAuthStore().resolvedPermissions`, highlights active item using `useRoute().name`, renders `SidebarLayout` from `@zidney/ui-system`, passes `collapsed` prop from `sidebarCollapsed`, drives `isMobile` from `useBackofficeUiStore()`, calls `toggleSidebar()` on collapse control click, renders group label as a non-interactive visual separator row above each group when `NavigationGroup.label` is non-empty (FR-030), exposes `footer` slot
- [ ] T022 [P] [US3] [requires T055] Create `apps/frontoffice/src/components/layout/AppSidebar.vue` — **T055 must be complete first** (SidebarLayout.vue watch-synced prop required); accepts `navigationConfig: NavigationConfig` prop, filters items using `useFrontofficeAuthStore().resolvedPermissions`, highlights active item using `useRoute().name`, renders `SidebarLayout` from `@zidney/ui-system`, passes `collapsed` prop from `sidebarCollapsed`, drives `isMobile` from `useFrontofficeUiStore()`, calls `toggleSidebar()` on collapse control click, renders group label as a non-interactive visual separator row above each group when `NavigationGroup.label` is non-empty (FR-030), exposes `footer` slot

---

## Phase 4c — AppLayout Components

**Goal**: Create app-specific `AppLayout.vue` in all three apps. Each composes `AppHeader` and `AppSidebar`, initializes `useBreakpoint()`, reads `sidebarCollapsed`/`isMobile` from `ui.store`, renders mobile backdrop, and exposes the five named slots: `header-left`, `header-right`, `sidebar-footer`, `content-top`, `content-bottom`.

**Dependency rule**: Requires T017–T019 (AppHeader), T020–T022 (AppSidebar), and T014–T016 (useBreakpoint). Per-app pairs are independent of each other and may execute in parallel.

**Independent test (US1 + US2 + US5 + US6)**: Mount AppLayout with mocked stores and `stubs: { RouterView: true }`. Verify: (a) AppSidebar and AppHeader both present in DOM, (b) `.app-layout--mobile` class present when `isMobile=true`, (c) AppSidebar absent when `hideSidebar=true`, (d) backdrop `div` renders on mobile with sidebar open and clicking it calls `toggleSidebar()`, (e) content injected into each of the 5 named slots appears in the correct DOM region.

### Tasks

- [ ] T023 [P] [US1] Create `apps/mmc/src/components/layout/AppLayout.vue` — composes `AppSidebar` and `AppHeader`, calls `useBreakpoint()`, reads `sidebarCollapsed`/`isMobile` from `useMmcUiStore()`, renders mobile backdrop overlay, `showWorkspaceInHeader=false`, exposes slots `header-left`, `header-right`, `sidebar-footer`, `content-top`, `content-bottom`, includes `<router-view />` in content area
- [ ] T024 [P] [US1] Create `apps/backoffice/src/components/layout/AppLayout.vue` — composes `AppSidebar` and `AppHeader`, calls `useBreakpoint()`, reads `sidebarCollapsed`/`isMobile` from `useBackofficeUiStore()`, renders mobile backdrop overlay, `showWorkspaceInHeader=true`, exposes slots `header-left`, `header-right`, `sidebar-footer`, `content-top`, `content-bottom`, includes `<router-view />` in content area
- [ ] T025 [P] [US5] Create `apps/frontoffice/src/components/layout/AppLayout.vue` — composes `AppSidebar` and `AppHeader`, calls `useBreakpoint()`, reads `sidebarCollapsed`/`isMobile` from `useFrontofficeUiStore()`, accepts `hideSidebar?: boolean` prop to conditionally render `AppSidebar`, renders mobile backdrop overlay, `showWorkspaceInHeader=false`, exposes slots `header-left`, `header-right`, `sidebar-footer`, `content-top`, `content-bottom`, includes `<router-view />` in content area

---

## Phase 5 — App Integration

**Goal**: Wire `AppLayout` into each app's `App.vue` with `standaloneLayout` bypass, declare `standaloneLayout: true` on existing auth/error routes, remove the deprecated `BackofficeLayout.vue`, and remove any remaining references to it.

**Dependency rule**: T026–T028 require T023–T025 (AppLayout created). T029–T031 require T008–T010 (RouteMeta extended). T032 requires T027 + T030 (Backoffice App.vue and routes updated). T033 requires T032.

**Independent test (US1 + US5)**: After App.vue update, mount App.vue with a mocked router. Verify: (a) AppLayout renders for a standard authenticated route, (b) AppLayout is absent for a route with `meta: { standaloneLayout: true }`, (c) no TypeScript errors.

### Tasks

- [ ] T026 [P] [US1] Update `apps/mmc/src/App.vue` — replace `<RouterView />` with conditional pattern: `<AppLayout v-else />` (self-closing — AppLayout contains `<router-view />` internally in its content area; do NOT pass `<router-view>` as slot content) for non-standalone routes, and bare `<router-view />` for `route.meta.standaloneLayout === true`; import `useRoute` and `AppLayout`
- [ ] T027 [P] [US1] Update `apps/backoffice/src/App.vue` — replace existing template with conditional pattern: `<AppLayout v-else />` (self-closing — AppLayout contains `<router-view />` internally in its content area; do NOT pass `<router-view>` as slot content) for non-standalone routes, and bare `<router-view />` for `route.meta.standaloneLayout === true`; import `useRoute` and `AppLayout`
- [ ] T028 [P] [US5] Update `apps/frontoffice/src/App.vue` — replace existing template with conditional pattern: `<AppLayout v-else :hideSidebar="route.meta.hideSidebar === true" />` (self-closing — AppLayout contains `<router-view />` internally; do NOT pass `<router-view>` as slot content) for non-standalone routes, and bare `<router-view />` for `route.meta.standaloneLayout === true`; import `useRoute` and `AppLayout`
- [ ] T029 [P] [US5] Declare `meta: { standaloneLayout: true }` on all auth routes (login, forgot-password, reset-password) and error/404 routes in `apps/mmc/src/core/router/index.ts`
- [ ] T030 [P] [US5] Declare `meta: { standaloneLayout: true }` on all auth routes (login, forgot-password, reset-password) and error/404 routes in `apps/backoffice/src/core/router/index.ts`
- [ ] T031 [P] [US5] Declare `meta: { standaloneLayout: true }` on all auth routes, error/404 routes, and attempt runtime routes in `apps/frontoffice/src/core/router/index.ts`; declare `meta: { hideSidebar: true }` on routes requiring sidebar suppression
- [ ] T032 [US1] Audit all Backoffice view and route files for imports of `apps/backoffice/src/layouts/BackofficeLayout.vue` — update or remove all usages, replacing any component-level layout wrapping with the new shell-via-App.vue pattern (AppLayout in App.vue handles wrapping automatically via its internal `<router-view />`)
- [ ] T033 [US1] Delete `apps/backoffice/src/layouts/BackofficeLayout.vue` only after T032 audit confirms zero remaining import references — confirm TypeScript compilation passes before deletion

---

## Phase 6 — Testing

**Goal**: Comprehensive unit tests for store extensions, composable, and all three layout components per app; plus integration tests per app verifying the full shell composition.

**Dependency rule**: Each test task requires its corresponding implementation task to be complete. All test tasks within a sub-phase are independent and may execute in parallel.

---

### Phase 6a — Store Extension Tests

**What to assert**: `toggleSidebar()` flips `sidebarCollapsed`; `setMobile(true)` sets `isMobile=true` AND `sidebarCollapsed=true` (CL-005); `setMobile(false)` resets both; `setMobile` is a no-op when value unchanged; `$reset()` returns both to `false`; `resolvedPermissions` defaults to `{}`; `buildResolvedPermissions` handles array-of-strings and Record formats; `resetState()` clears `resolvedPermissions`.

- [ ] T034 [P] Create `tests/unit/mmc/core/state/ui.store.layout.test.ts` — verify `toggleSidebar` flips `sidebarCollapsed`, `setMobile(true)` atomically sets `isMobile=true` and `sidebarCollapsed=true`, `setMobile(false)` resets both, `setMobile` no-op when value unchanged, `$reset()` clears both to `false`
- [ ] T035 [P] Create `tests/unit/backoffice/core/state/ui.store.layout.test.ts` — verify `toggleSidebar` flips `sidebarCollapsed`, `setMobile(true)` atomically sets `isMobile=true` and `sidebarCollapsed=true`, `setMobile(false)` resets both, `setMobile` no-op when value unchanged, `$reset()` clears both to `false`
- [ ] T036 [P] Create `tests/unit/frontoffice/core/state/ui.store.layout.test.ts` — verify `toggleSidebar` flips `sidebarCollapsed`, `setMobile(true)` atomically sets `isMobile=true` and `sidebarCollapsed=true`, `setMobile(false)` resets both, `setMobile` no-op when value unchanged, `$reset()` clears both to `false`
- [ ] T052 [P] Create `tests/unit/mmc/core/state/auth.store.permissions.test.ts` — verify `resolvedPermissions` defaults to `{}`, `buildResolvedPermissions` with array-of-strings input maps each string to `true`, with `Record<string, boolean>` input passes through unchanged, with null/undefined `profile.permissions` returns `{}` without throwing, `resetState()` clears `resolvedPermissions` to `{}`, `expireSession()` clears `resolvedPermissions` to `{}`
- [ ] T053 [P] Create `tests/unit/backoffice/core/state/auth.store.permissions.test.ts` — same assertions as T052
- [ ] T054 [P] Create `tests/unit/frontoffice/core/state/auth.store.permissions.test.ts` — same assertions as T052

---

### Phase 6b — useBreakpoint Composable Tests

**What to assert**: `setMobile(true)` called on mount when `window.innerWidth < 768`; `setMobile(false)` called when ≥ 768; `setMobile` called on simulated `resize` event crossing threshold; event listener removed on `onUnmounted` (no memory leak).

- [ ] T037 [P] Create `tests/unit/mmc/composables/useBreakpoint.test.ts` — verify `useMmcUiStore().setMobile(true)` called on mount when mocked `window.innerWidth=767`, `setMobile(false)` called when `window.innerWidth=768`, `setMobile` called on synthetic resize event, listener removed on unmount
- [ ] T038 [P] Create `tests/unit/backoffice/composables/useBreakpoint.test.ts` — verify `useBackofficeUiStore().setMobile(true)` called on mount when mocked `window.innerWidth=767`, `setMobile(false)` called when `window.innerWidth=768`, `setMobile` called on synthetic resize event, listener removed on unmount
- [ ] T039 [P] Create `tests/unit/frontoffice/composables/useBreakpoint.test.ts` — verify `useFrontofficeUiStore().setMobile(true)` called on mount when mocked `window.innerWidth=767`, `setMobile(false)` called when `window.innerWidth=768`, `setMobile` called on synthetic resize event, listener removed on unmount

---

### Phase 6c — AppHeader Unit Tests

**What to assert**: User name visible from store; initials computed correctly (e.g. "Test User" → "TU"); logout click calls `authStore.logout()`; Backoffice variant shows workspace name when `showWorkspace=true` and omits it when `false`; null user and null workspace render without crash; `left` and `right` slots render injected content.

- [ ] T040 [P] Create `tests/unit/mmc/components/AppHeader.test.ts` — verify user initials rendered from `user.name`, logout `DropdownMenuItem` click calls `authStore.logout()`, `left`/`right` slots render injected content, null `user` state renders without error
- [ ] T041 [P] Create `tests/unit/backoffice/components/AppHeader.test.ts` — verify workspace name rendered when `showWorkspace=true`, workspace name absent when `showWorkspace=false`, null workspace renders fallback placeholder without crash, user initials correct, logout calls `authStore.logout()`, `left`/`right` slots render injected content
- [ ] T042 [P] Create `tests/unit/frontoffice/components/AppHeader.test.ts` — verify user initials rendered from `user.name`, logout `DropdownMenuItem` click calls `authStore.logout()`, `left`/`right` slots render injected content, null `user` state renders without error

---

### Phase 6d — AppSidebar Unit Tests

**What to assert**: Only items with met permissions visible; items with missing permission key hidden; items with `resolvedPermissions[key] === false` hidden; items without a `permission` field always visible; active route item carries active CSS class; non-active items do not; collapse control click calls `toggleSidebar()`; `sidebar-footer` slot renders injected content; empty `navigationConfig` renders without crash or error; null `resolvedPermissions` defaults to empty record safely.

- [ ] T043 [P] Create `tests/unit/mmc/components/AppSidebar.test.ts` — verify permitted items visible, items with unmet permission absent, items without permission field always visible, active route item highlighted, collapse toggle calls `useMmcUiStore().toggleSidebar()`, `footer` slot renders content, empty config produces no error
- [ ] T044 [P] Create `tests/unit/backoffice/components/AppSidebar.test.ts` — verify permitted items visible, items with unmet permission absent, items without permission field always visible, active route item highlighted, collapse toggle calls `useBackofficeUiStore().toggleSidebar()`, `footer` slot renders content, empty config produces no error
- [ ] T045 [P] Create `tests/unit/frontoffice/components/AppSidebar.test.ts` — verify permitted items visible, items with unmet permission absent, items without permission field always visible, active route item highlighted, collapse toggle calls `useFrontofficeUiStore().toggleSidebar()`, `footer` slot renders content, empty config produces no error

---

### Phase 6e — AppLayout Unit Tests

**What to assert**: AppSidebar and AppHeader both present in DOM by default; AppSidebar absent when `hideSidebar=true`; `.app-layout--mobile` class present when `isMobile=true`; `.app-layout--collapsed` class present when `sidebarCollapsed=true`; mobile backdrop `div` renders when `isMobile=true && !sidebarCollapsed`; clicking backdrop calls `toggleSidebar()`; all five named slots (`header-left`, `header-right`, `sidebar-footer`, `content-top`, `content-bottom`) render injected content in correct DOM region; stable snapshots for default, collapsed, and mobile states.

- [ ] T046 [P] [US1] Create `tests/unit/mmc/components/AppLayout.test.ts` — verify AppSidebar and AppHeader in DOM, `.app-layout--mobile` on `isMobile=true`, backdrop renders on mobile open state and click calls `toggleSidebar()`, all 5 named slots render injected content correctly, snapshot tests for default/collapsed/mobile states
- [ ] T047 [P] [US1] Create `tests/unit/backoffice/components/AppLayout.test.ts` — verify AppSidebar and AppHeader in DOM, `.app-layout--mobile` on `isMobile=true`, backdrop renders on mobile open state and click calls `toggleSidebar()`, all 5 named slots render injected content correctly, snapshot tests for default/collapsed/mobile states
- [ ] T048 [P] [US5] Create `tests/unit/frontoffice/components/AppLayout.test.ts` — verify AppSidebar absent when `hideSidebar=true`, AppSidebar present when `hideSidebar=false`, all 5 named slots render injected content correctly, `.app-layout--mobile` on `isMobile=true`, snapshot tests for default/collapsed/mobile/hideSidebar states

---

### Phase 6f — Integration Tests

**What to assert**: Full shell composition (AppLayout + real AppSidebar + real AppHeader) mounts without error; sidebar toggle flows: toggle control click → `toggleSidebar()` store action → layout re-renders with correct CSS class; `standaloneLayout: true` on a route causes App.vue to bypass AppLayout entirely (AppSidebar and AppHeader absent from DOM).

- [ ] T049 [P] [US1] Create `tests/integration/mmc/app-layout.integration.test.ts` — mount AppLayout with real AppSidebar and AppHeader using `createTestingPinia`, verify full shell renders without error, sidebar toggle propagates from click through store to re-render, `hideSidebar` prop removes AppSidebar from DOM; ALSO mount App.vue with a mocked router where a route declares `meta: { standaloneLayout: true }` and assert AppLayout is absent from the DOM (bare `<router-view>` renders directly — `standaloneLayout` bypasses shell rendering and NOT router guard execution)
- [ ] T050 [P] [US1] Create `tests/integration/backoffice/app-layout.integration.test.ts` — mount AppLayout with real AppSidebar and AppHeader using `createTestingPinia`, verify full shell renders with workspace name in header, sidebar toggle propagates from click through store to re-render; ALSO mount App.vue with a mocked router where a route declares `meta: { standaloneLayout: true }` and assert AppLayout is absent from the DOM (bare `<router-view>` renders directly — `standaloneLayout` bypasses shell rendering and NOT router guard execution)
- [ ] T051 [P] [US5] Create `tests/integration/frontoffice/app-layout.integration.test.ts` — mount AppLayout with real AppSidebar and AppHeader using `createTestingPinia`, verify `standaloneLayout: true` route causes App.vue to mount `<router-view>` directly (AppSidebar and AppHeader absent from DOM), `hideSidebar: true` suppresses AppSidebar while AppHeader remains
- [ ] T055 Fix `packages/ui-system/src/components/Layout/SidebarLayout.vue` — replace one-time `ref(props.defaultCollapsed)` initialization with a watch-synced reactive pattern: rename prop from `defaultCollapsed` to `collapsed` (or keep `defaultCollapsed` and add `watch(() => props.defaultCollapsed, val => { isCollapsed.value = val })`) so that Pinia-driven state changes (e.g. `setMobile(true)` → `sidebarCollapsed=true` → AppSidebar binding update) immediately reflect in the sidebar DOM without requiring a user click to re-sync; verify fix with T037–T039 composable resize tests
- [ ] T056 Run `bun run lint` and `bun run type-check` across `apps/mmc`, `apps/backoffice`, `apps/frontoffice`, and `packages/ui-system` — all must exit with zero errors; collect full output and record pass/fail per app in `audits/VALIDATION_REPORT.md`; ESLint errors BLOCK merge; TypeScript errors BLOCK merge; warnings are allowed but must be documented

---

## Dependency Graph

```
T001 (package.json)
  └─ T002 [P] (mmc ui.store)

T003 [P] (bo ui.store)    ─┐
T004 [P] (fo ui.store)    ─┤ Phase 1 — independent
T005 [P] (mmc auth.store) ─┤ (can parallel with T002)
T006 [P] (bo auth.store)  ─┤
T007 [P] (fo auth.store)  ─┘

T008 [P] (mmc RouteMeta)  ─┐
T009 [P] (bo RouteMeta)   ─┤ Phase 2 — all independent
T010 [P] (fo RouteMeta)   ─┤ (can start with Phase 1)
T011 [P] (mmc navConfig)  ─┤
T012 [P] (bo navConfig)   ─┤
T013 [P] (fo navConfig)   ─┘

T002 → T014 [P] (mmc useBreakpoint)
T003 → T015 [P] (bo useBreakpoint)
T004 → T016 [P] (fo useBreakpoint)

T005, T011 → T017 [P] (mmc AppHeader)
T006, T012 → T018 [P] (bo AppHeader)
T007, T013 → T019 [P] (fo AppHeader)

T002, T005, T011 → T020 [P] (mmc AppSidebar)
T003, T006, T012 → T021 [P] (bo AppSidebar)
T004, T007, T013 → T022 [P] (fo AppSidebar)

T014, T017, T020 → T023 [P] (mmc AppLayout)
T015, T018, T021 → T024 [P] (bo AppLayout)
T016, T019, T022 → T025 [P] (fo AppLayout)

T023 → T026 [P] (mmc App.vue)
T024 → T027 [P] (bo App.vue)
T025 → T028 [P] (fo App.vue)

T008 → T029 [P] (mmc standalone routes)
T009 → T030 [P] (bo standalone routes)
T010 → T031 [P] (fo standalone routes)

T027, T030 → T032 (audit BackofficeLayout import refs)
T032 → T033 (delete BackofficeLayout.vue — only after T032 audit confirms zero imports)

Phase 6 tests depend on their respective implementation tasks.
```

---

## Parallel Execution Summary

| Parallel Group              | Tasks     | Can Start After              |
| --------------------------- | --------- | ---------------------------- |
| Store extensions (ui)       | T002–T004 | T001 complete                |
| Store extensions (auth)     | T005–T007 | T001 complete                |
| RouteMeta + NavConfig       | T008–T013 | Any time (Phase 1+2 overlap) |
| useBreakpoint composables   | T014–T016 | T002, T003, T004             |
| AppHeader components        | T017–T019 | T005–T007, T011–T013         |
| AppSidebar components       | T020–T022 | T002–T007, T011–T013         |
| AppLayout components        | T023–T025 | T014–T022                    |
| App.vue updates             | T026–T028 | T023–T025                    |
| Standalone route updates    | T029–T031 | T008–T010                    |
| Store unit tests (ui.store) | T034–T036 | T002–T007                    |
| Auth store permission tests | T052–T054 | T005–T007                    |
| Composable unit tests       | T037–T039 | T014–T016                    |
| AppHeader unit tests        | T040–T042 | T017–T019                    |
| AppSidebar unit tests       | T043–T045 | T020–T022                    |
| AppLayout unit tests        | T046–T048 | T023–T025                    |
| Integration tests           | T049–T051 | T026–T031                    |
| SidebarLayout fix           | T055      | Before T020–T022             |

---

## Implementation Strategy

### MVP Scope (Suggested minimum for US1 + US2 + US3 delivery)

Deliver Backoffice app only end-to-end first (T003, T006, T009, T012, T015, T018, T021, T024, T027, T030):

1. This validates the full pattern in one app before repeating for MMC and Frontoffice.
2. Replaces the deprecated `BackofficeLayout.vue` pattern immediately.
3. Allows feature developers to start using the new shell in parallel.

Then replicate to MMC (T001, T002, T005, T008, T011, T014, T017, T020, T023, T026, T029) and Frontoffice (T004, T007, T010, T013, T016, T019, T022, T025, T028, T031).

### Incremental Delivery Order

1. Phase 1–3 (Foundation) → unblocks all layout work, low risk
2. Backoffice full path (US1 MVP, replaces BackofficeLayout.vue)
3. MMC full path (no legacy cleanup required)
4. Frontoffice full path (US5 standalone bypass is a hard requirement before any Frontoffice layout ship)
5. Testing (Phase 6) — write tests alongside or immediately after each implementation phase; do not defer all testing to end

### Dependency Conflict Notes

1. **T001 must be first**: MMC has no `@zidney/ui-system` dependency. Without it, T002, T014, T017, T020, T023 cannot import from `@zidney/ui-system`. All MMC implementation tasks are blocked until T001 is complete and `bun install` is re-run.

2. **T032/T033 ordering**: `BackofficeLayout.vue` may not be deleted (T033) until T027 (Backoffice App.vue updated), T030 (standalone routes declared), and T032 (audit confirms zero remaining import references) are all complete. Deleting it before the audit confirms zero imports will break Backoffice entirely.

3. **RouteMeta before router updates**: T029–T031 (standalone route declarations) require T008–T010 to be complete; TypeScript will reject `meta: { standaloneLayout: true }` until the `RouteMeta` augmentation is in place.

4. **`router-view` inside AppLayout**: `AppLayout.vue` contains `<router-view />` directly in its template (not passed as a slot from App.vue). App.vue does NOT nest `<router-view />` inside `<AppLayout>` as a slot. This is the plan.md pattern — feature views rendered by the router automatically land in the AppLayout content area.

---

## Task Summary

| Phase | Description                     | Task Range | Count  |
| ----- | ------------------------------- | ---------- | ------ |
| 1     | Dependency and Store Foundation | T001–T007  | 7      |
| 2     | Types and Configuration         | T008–T013  | 6      |
| 3     | Composable Infrastructure       | T014–T016  | 3      |
| 4a    | AppHeader Components            | T017–T019  | 3      |
| 4b    | AppSidebar Components           | T020–T022  | 3      |
| 4c    | AppLayout Components            | T023–T025  | 3      |
| 5     | App Integration                 | T026–T033  | 8      |
| 6a    | Store Extension Tests           | T034–T036  | 3      |
| 6b    | useBreakpoint Composable Tests  | T037–T039  | 3      |
| 6c    | AppHeader Unit Tests            | T040–T042  | 3      |
| 6d    | AppSidebar Unit Tests           | T043–T045  | 3      |
| 6e    | AppLayout Unit Tests            | T046–T048  | 3      |
| 6f    | Integration Tests               | T049–T051  | 3      |
| 6a+   | Auth Store Permission Tests     | T052–T054  | 3      |
| 6f+   | SidebarLayout Controlled Prop   | T055       | 1      |
| CI    | Lint + Type-Check Validation    | T056       | 1      |
| **—** | **Total**                       | T001–T056  | **57** |
