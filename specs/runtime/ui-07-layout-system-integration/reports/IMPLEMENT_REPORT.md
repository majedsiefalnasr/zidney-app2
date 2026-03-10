# IMPLEMENT REPORT — STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION

**Stage**: STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION **Phase**: 06_UI_APPLICATION_RUNTIME **Branch**:
`ui-07-layout-system-integration` **Completed**: 2026-03-06

---

## Implementation Summary

| Metric             | Value              |
| ------------------ | ------------------ |
| Tasks completed    | 56 / 56            |
| Formally deferred  | 0                  |
| Test files created | 21                 |
| Test assertions    | 162 (0 failures)   |
| TypeScript errors  | 0 (all 4 packages) |
| ESLint errors      | 0 (stage-scoped)   |
| Files created      | 24                 |
| Files modified     | 28                 |
| Files deleted      | 1                  |

---

## Task Completion

All 56 tasks marked `[X]` in `tasks.md`.

### Phase 1 — Store Foundation (T001–T009)

All 9 store tasks completed. `ui.store.ts` augmented with `sidebarCollapsed`, `isMobile`,
`toggleSidebar`, `setMobile`, `$reset` in all 3 apps. `auth.store.ts` augmented with
`resolvedPermissions`, `buildResolvedPermissions` in all 3 apps.

### Phase 2 — Router Meta Types (T010–T012)

`RouteMeta` extended with `standaloneLayout?: boolean` and `hideSidebar?: boolean` in all 3 apps.

### Phase 3 — Navigation Configs (T013–T015)

`apps/mmc/src/core/navigation/index.ts`, `apps/backoffice/src/core/navigation/index.ts`,
`apps/frontoffice/src/core/navigation/index.ts` created with typed `NavigationConfig[]` and
`NavigationGroup` exports.

### Phase 4 — Composables (T016)

`useBreakpoint.ts` created in all 3 apps. Registers resize listener, calls `setMobile()` on boot and
on resize, removes listener on `onUnmounted`.

### Phase 5 — App Shell (T017–T031)

`AppHeader.vue`, `AppSidebar.vue`, `AppLayout.vue` created in all 3 apps. `App.vue` updated in all 3
apps to use conditional layout shell. `standaloneLayout: true` set on auth/error routes in all 3
routers. Frontoffice hideSidebar support implemented.

### Phase 6a — BackofficeLayout Removal (T032–T033)

`apps/backoffice/src/layouts/BackofficeLayout.vue` deleted. Wrapper import removed from 4 backoffice
view files (Dashboard, CreateRolePage, RoleDetailPage, RolesListPage).

### Phase 6b — SidebarLayout Reactive Prop Fix (T055)

`packages/ui-system/src/components/Layout/SidebarLayout.vue` updated: `collapsed` prop now uses
`watch` to sync into internal `isCollapsed` ref rather than one-time `ref(props.defaultCollapsed)`.
Badge/Button imports corrected to relative paths (post-implementation fix).

### Phase 7 — Unit Tests (T034–T048, T052–T054)

21 test files created:

- `ui.store.layout.test.ts` × 3 apps
- `auth.store.permissions.test.ts` × 3 apps
- `useBreakpoint.test.ts` × 3 apps
- `AppHeader.test.ts` × 3 apps
- `AppSidebar.test.ts` × 3 apps
- `AppLayout.test.ts` × 3 apps

### Phase 8 — Integration Tests (T049–T051)

`app-layout.integration.test.ts` created in all 3 apps. Tests: App.vue shell mounting,
standaloneLayout bypass, backdrop toggle, Frontoffice hideSidebar behavior.

### Phase 9 — CI Validation (T056)

Lint and type-check verified on stage-scoped files. All gates pass.

---

## Post-Implementation Fixes

Four issues found during validation and resolved before commit:

1. **SidebarLayout relative imports** — `@shadcn-vue/ui/badge` and `@shadcn-vue/ui/button` changed
   to `'../shadcn-vue/badge'` and `'../shadcn-vue/button'`.
2. **`@shadcn-vue/ui` alias** — Added to `apps/{mmc,backoffice,frontoffice}/vitest.config.ts`
   pointing to `packages/ui-system/src/components/shadcn-vue`.
3. **`lib/utils.ts`** — Created in `apps/backoffice/src/lib/` and `apps/frontoffice/src/lib/`
   (matches existing `apps/mmc/src/lib/utils.ts`).
4. **`AppSidebar` test stub** — `sidebarLayoutStub.template` updated in all 3 `AppSidebar.test.ts`
   files to include `<slot name="footer" />`.

---

## Implementation Files

### Created (24 files)

| File                                                                                 | Description                          |
| ------------------------------------------------------------------------------------ | ------------------------------------ |
| `apps/mmc/src/core/navigation/index.ts`                                              | MMC navigation config                |
| `apps/backoffice/src/core/navigation/index.ts`                                       | Backoffice navigation config         |
| `apps/frontoffice/src/core/navigation/index.ts`                                      | Frontoffice navigation config        |
| `apps/mmc/src/composables/useBreakpoint.ts`                                          | Responsive breakpoint composable     |
| `apps/backoffice/src/composables/useBreakpoint.ts`                                   | Responsive breakpoint composable     |
| `apps/frontoffice/src/composables/useBreakpoint.ts`                                  | Responsive breakpoint composable     |
| `apps/mmc/src/components/layout/AppHeader.vue`                                       | MMC app header                       |
| `apps/backoffice/src/components/layout/AppHeader.vue`                                | Backoffice app header                |
| `apps/frontoffice/src/components/layout/AppHeader.vue`                               | Frontoffice app header               |
| `apps/mmc/src/components/layout/AppSidebar.vue`                                      | MMC sidebar                          |
| `apps/backoffice/src/components/layout/AppSidebar.vue`                               | Backoffice sidebar                   |
| `apps/frontoffice/src/components/layout/AppSidebar.vue`                              | Frontoffice sidebar                  |
| `apps/mmc/src/components/layout/AppLayout.vue`                                       | MMC full shell                       |
| `apps/backoffice/src/components/layout/AppLayout.vue`                                | Backoffice full shell                |
| `apps/frontoffice/src/components/layout/AppLayout.vue`                               | Frontoffice full shell (hideSidebar) |
| `apps/backoffice/src/lib/utils.ts`                                                   | `cn()` utility (post-impl fix)       |
| `apps/frontoffice/src/lib/utils.ts`                                                  | `cn()` utility (post-impl fix)       |
| `apps/{mmc,backoffice,frontoffice}/tests/unit/stores/ui.store.layout.test.ts`        | Store unit tests (×3)                |
| `apps/{mmc,backoffice,frontoffice}/tests/unit/stores/auth.store.permissions.test.ts` | Auth store tests (×3)                |
| `apps/{mmc,backoffice,frontoffice}/tests/unit/composables/useBreakpoint.test.ts`     | Composable tests (×3)                |
| `apps/{mmc,backoffice,frontoffice}/tests/unit/components/AppHeader.test.ts`          | Component tests (×3)                 |
| `apps/{mmc,backoffice,frontoffice}/tests/unit/components/AppSidebar.test.ts`         | Component tests (×3)                 |
| `apps/{mmc,backoffice,frontoffice}/tests/unit/components/AppLayout.test.ts`          | Component tests (×3)                 |
| `apps/{mmc,backoffice,frontoffice}/tests/integration/app-layout.integration.test.ts` | Integration tests (×3)               |

### Modified (28 files)

| File                                                         | Change                                            |
| ------------------------------------------------------------ | ------------------------------------------------- |
| `apps/mmc/src/core/state/ui.store.ts`                        | Added layout state                                |
| `apps/backoffice/src/core/state/ui.store.ts`                 | Added layout state                                |
| `apps/frontoffice/src/core/state/ui.store.ts`                | Added layout state                                |
| `apps/mmc/src/core/state/auth.store.ts`                      | Added resolvedPermissions                         |
| `apps/backoffice/src/core/state/auth.store.ts`               | Added resolvedPermissions                         |
| `apps/frontoffice/src/core/state/auth.store.ts`              | Added resolvedPermissions                         |
| `apps/mmc/src/core/router/types.ts`                          | Extended RouteMeta                                |
| `apps/backoffice/src/core/router/types.ts`                   | Extended RouteMeta                                |
| `apps/frontoffice/src/core/router/types.ts`                  | Extended RouteMeta                                |
| `apps/mmc/src/core/router/index.ts`                          | standaloneLayout on auth/error routes             |
| `apps/backoffice/src/core/router/index.ts`                   | standaloneLayout on auth/error routes             |
| `apps/frontoffice/src/core/router/index.ts`                  | standaloneLayout + hideSidebar on attempt routes  |
| `apps/mmc/src/App.vue`                                       | Conditional shell                                 |
| `apps/backoffice/src/App.vue`                                | Conditional shell                                 |
| `apps/frontoffice/src/App.vue`                               | Conditional shell                                 |
| `apps/backoffice/src/views/Dashboard.vue`                    | Removed BackofficeLayout wrapper                  |
| `apps/backoffice/src/pages/roles/CreateRolePage.vue`         | Removed BackofficeLayout wrapper                  |
| `apps/backoffice/src/pages/roles/RoleDetailPage.vue`         | Removed BackofficeLayout wrapper                  |
| `apps/backoffice/src/pages/roles/RolesListPage.vue`          | Removed BackofficeLayout wrapper                  |
| `apps/mmc/vitest.config.ts`                                  | Added @shadcn-vue/ui alias (post-impl fix)        |
| `apps/backoffice/vitest.config.ts`                           | Added @shadcn-vue/ui alias (post-impl fix)        |
| `apps/frontoffice/vitest.config.ts`                          | Added @shadcn-vue/ui alias (post-impl fix)        |
| `packages/ui-system/src/components/Layout/SidebarLayout.vue` | Reactive collapsed prop + import fix              |
| `packages/ui-system/src/components/index.ts`                 | Added Avatar, DropdownMenu, Button, Badge exports |
| `apps/mmc/tests/unit/components/AppSidebar.test.ts`          | Footer slot stub fix (post-impl)                  |
| `apps/backoffice/tests/unit/components/AppSidebar.test.ts`   | Footer slot stub fix (post-impl)                  |
| `apps/frontoffice/tests/unit/components/AppSidebar.test.ts`  | Footer slot stub fix (post-impl)                  |

### Deleted (1 file)

| File                                               | Reason                                        |
| -------------------------------------------------- | --------------------------------------------- |
| `apps/backoffice/src/layouts/BackofficeLayout.vue` | Replaced by App.vue → AppLayout shell pattern |

---

## Validation Evidence

Full evidence in `audits/VALIDATION_REPORT.md`.

```
TypeScript: 4/4 packages → exit 0
ESLint:     0 errors, 10 warnings (all HMR boilerplate, non-blocking)
Tests:      21 files, 162 assertions, 0 failures
```

---

## Deferred Tasks

None. All 56 tasks completed.
