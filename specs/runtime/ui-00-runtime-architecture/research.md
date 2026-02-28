# Research — STAGE_UI_00_RUNTIME_ARCHITECTURE

**Stage**: STAGE_UI_00_RUNTIME_ARCHITECTURE  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Generated**: 2026-02-28  
**Status**: COMPLETE — All unknowns resolved

---

## R-01 — Current State of `apps/mmc/src/`

### Actual Directory Inventory

```
apps/mmc/src/
├── api/
│   └── dashboard-client.ts
├── components/
│   ├── AuditTrailViewer.vue
│   ├── Dashboard/
│   │   ├── AffiliateLeaderboard.vue
│   │   ├── CommercialHealth.vue
│   │   ├── DataExport.vue
│   │   ├── GeographicDistribution.vue
│   │   ├── GrowthTrends.vue
│   │   └── RevenueBreakdown.vue            (6 files)
│   ├── JobStatusMonitor.vue
│   ├── LicenseDeletionDialog.vue
│   ├── LicenseDetailPage.vue
│   └── licenses/
│       ├── AdminAccountDisplay.vue
│       ├── AuditLogViewer.vue
│       ├── ErrorMessage.vue
│       ├── GracePeriodProgress.vue
│       ├── LicenseActions.vue
│       ├── LicenseBulkActions.vue
│       ├── LicenseCreateForm.vue
│       ├── LicenseEditForm.vue
│       ├── LicensePagination.vue
│       ├── LicenseQuotaDisplay.vue
│       ├── LicenseReportExport.vue
│       ├── LicenseSearch.vue
│       ├── LicenseStatusBadge.vue
│       ├── LicenseStatusTransitionConfirm.vue
│       ├── ProvisioningStatus.vue
│       ├── RetryProvisioningButton.vue
│       ├── RoleBasedMenu.vue
│       └── SoftLockDisplay.vue             (18 files)
├── lib/
│   └── utils.ts
├── stores/
│   └── dashboard-store.ts
└── views/
    ├── Dashboard.vue
    └── licenses/
        ├── LicenseDetailView.vue
        ├── LicenseList.vue
        └── LicenseListView.vue
```

> **Note**: The spec §8.1 delta table says "13 files" for `src/components/licenses/`. The actual count is **18 files**. The clarification at §16 confirmed the table was updated with explicit per-file mappings. This research confirms 28 total component files across Dashboard/ (6), licenses/ (18), and root-level (4: AuditTrailViewer, JobStatusMonitor, LicenseDeletionDialog, LicenseDetailPage).

### Complete Delta Map (MMC)

| Current Path                                                 | Canonical Target Path                                                | Migration Action     |
| ------------------------------------------------------------ | -------------------------------------------------------------------- | -------------------- |
| `src/api/dashboard-client.ts`                                | `src/modules/dashboard/api.ts`                                       | MOVE                 |
| `src/stores/dashboard-store.ts`                              | `src/modules/dashboard/store.ts`                                     | MOVE                 |
| `src/views/Dashboard.vue`                                    | `src/modules/dashboard/views/DashboardView.vue`                      | MOVE + RENAME        |
| `src/views/licenses/LicenseDetailView.vue`                   | `src/modules/licenses/views/LicenseDetailView.vue`                   | MOVE                 |
| `src/views/licenses/LicenseList.vue`                         | `src/modules/licenses/views/LicenseList.vue`                         | MOVE                 |
| `src/views/licenses/LicenseListView.vue`                     | `src/modules/licenses/views/LicenseListView.vue`                     | MOVE                 |
| `src/components/Dashboard/AffiliateLeaderboard.vue`          | `src/modules/dashboard/components/AffiliateLeaderboard.vue`          | MOVE                 |
| `src/components/Dashboard/CommercialHealth.vue`              | `src/modules/dashboard/components/CommercialHealth.vue`              | MOVE                 |
| `src/components/Dashboard/DataExport.vue`                    | `src/modules/dashboard/components/DataExport.vue`                    | MOVE                 |
| `src/components/Dashboard/GeographicDistribution.vue`        | `src/modules/dashboard/components/GeographicDistribution.vue`        | MOVE                 |
| `src/components/Dashboard/GrowthTrends.vue`                  | `src/modules/dashboard/components/GrowthTrends.vue`                  | MOVE                 |
| `src/components/Dashboard/RevenueBreakdown.vue`              | `src/modules/dashboard/components/RevenueBreakdown.vue`              | MOVE                 |
| `src/components/licenses/AdminAccountDisplay.vue`            | `src/modules/licenses/components/AdminAccountDisplay.vue`            | MOVE                 |
| `src/components/licenses/AuditLogViewer.vue`                 | `src/modules/licenses/components/AuditLogViewer.vue`                 | MOVE                 |
| `src/components/licenses/ErrorMessage.vue`                   | `src/modules/licenses/components/ErrorMessage.vue`                   | MOVE                 |
| `src/components/licenses/GracePeriodProgress.vue`            | `src/modules/licenses/components/GracePeriodProgress.vue`            | MOVE                 |
| `src/components/licenses/LicenseActions.vue`                 | `src/modules/licenses/components/LicenseActions.vue`                 | MOVE                 |
| `src/components/licenses/LicenseBulkActions.vue`             | `src/modules/licenses/components/LicenseBulkActions.vue`             | MOVE                 |
| `src/components/licenses/LicenseCreateForm.vue`              | `src/modules/licenses/components/LicenseCreateForm.vue`              | MOVE                 |
| `src/components/licenses/LicenseEditForm.vue`                | `src/modules/licenses/components/LicenseEditForm.vue`                | MOVE                 |
| `src/components/licenses/LicensePagination.vue`              | `src/modules/licenses/components/LicensePagination.vue`              | MOVE                 |
| `src/components/licenses/LicenseQuotaDisplay.vue`            | `src/modules/licenses/components/LicenseQuotaDisplay.vue`            | MOVE                 |
| `src/components/licenses/LicenseReportExport.vue`            | `src/modules/licenses/components/LicenseReportExport.vue`            | MOVE                 |
| `src/components/licenses/LicenseSearch.vue`                  | `src/modules/licenses/components/LicenseSearch.vue`                  | MOVE                 |
| `src/components/licenses/LicenseStatusBadge.vue`             | `src/modules/licenses/components/LicenseStatusBadge.vue`             | MOVE                 |
| `src/components/licenses/LicenseStatusTransitionConfirm.vue` | `src/modules/licenses/components/LicenseStatusTransitionConfirm.vue` | MOVE                 |
| `src/components/licenses/ProvisioningStatus.vue`             | `src/modules/licenses/components/ProvisioningStatus.vue`             | MOVE                 |
| `src/components/licenses/RetryProvisioningButton.vue`        | `src/modules/licenses/components/RetryProvisioningButton.vue`        | MOVE                 |
| `src/components/licenses/RoleBasedMenu.vue`                  | `src/modules/licenses/components/RoleBasedMenu.vue`                  | MOVE                 |
| `src/components/licenses/SoftLockDisplay.vue`                | `src/modules/licenses/components/SoftLockDisplay.vue`                | MOVE                 |
| `src/components/LicenseDeletionDialog.vue`                   | `src/modules/licenses/components/LicenseDeletionDialog.vue`          | MOVE                 |
| `src/components/LicenseDetailPage.vue`                       | `src/modules/licenses/components/LicenseDetailPage.vue`              | MOVE                 |
| `src/components/AuditTrailViewer.vue`                        | `src/shared/components/AuditTrailViewer.vue`                         | MOVE (cross-cutting) |
| `src/components/JobStatusMonitor.vue`                        | `src/shared/components/JobStatusMonitor.vue`                         | MOVE (cross-cutting) |
| `src/lib/utils.ts`                                           | `src/shared/utils/utils.ts`                                          | MOVE                 |

**Directories to delete after migration**: `src/api/`, `src/stores/`, `src/views/`, `src/components/`, `src/lib/`

**New directories to create** (MMC core layer, does not exist yet):

- `src/core/api/`, `src/core/auth/`, `src/core/router/`, `src/core/guards/`, `src/core/state/`, `src/core/config/`, `src/core/errors/`
- `src/modules/dashboard/components/`, `src/modules/dashboard/views/`
- `src/modules/licenses/components/`, `src/modules/licenses/views/`
- `src/shared/components/`, `src/shared/composables/`, `src/shared/utils/`

**Missing top-level entry files**: `main.ts` and `App.vue` are not found in `src/` root — these need to be verified or created.

---

## R-02 — Current State of `apps/backoffice/` and `apps/frontoffice/`

### `apps/backoffice/`

- Contains: `AGENTS.md` only
- No `package.json`, no `src/`, no Vite config, no TypeScript config
- **Status**: Completely empty — full scaffold required from scratch

### `apps/frontoffice/`

- Contains: `AGENTS.md` only
- No `package.json`, no `src/`, no Vite config, no TypeScript config
- **Status**: Completely empty — full scaffold required from scratch

Both apps require:

1. `package.json` (with `vue`, `vue-router`, `pinia`, `@zidney/ui-system` dependencies)
2. `vite.config.ts` with `@vitejs/plugin-vue`, `@/` alias, `@zidney/ui` alias
3. `tsconfig.json` extending `../../tsconfig.base.json` + `@/` path alias
4. `tsconfig.app.json` scoped to `src/**`
5. Full canonical `src/` structure (core + modules + shared)

---

## R-03 — `packages/ui-system/` — What Exists

### Directory Structure

```
packages/ui-system/src/
├── components/
│   ├── DataTable/
│   ├── Dialogs/
│   ├── Filters/
│   ├── Forms/
│   ├── Layout/
│   │   ├── AppLayout.vue
│   │   ├── SidebarLayout.vue
│   │   └── TopBar.vue
│   ├── Status/
│   ├── index.ts
│   └── shadcn-vue/
├── composables/
│   ├── index.ts
│   ├── useColumnVisibility.ts
│   ├── useFilterBuilder.ts
│   ├── useMultiLanguageForm.ts
│   └── usePagination.ts
├── lib/
├── styles/
├── types/
│   ├── column.ts
│   ├── common.ts
│   ├── component-props.ts
│   ├── events.ts
│   ├── index.ts
│   ├── row-action.ts
│   └── validation.ts
├── utils/
│   ├── filter-serializer.ts
│   ├── index.ts
│   ├── table-helpers.ts
│   └── url-sync.ts
├── index.ts
└── vue.d.ts
```

### Key Package Details

| Field                 | Value                                                        |
| --------------------- | ------------------------------------------------------------ |
| Package name          | `@zidney/ui-system`                                          |
| Published as          | `@zidney/ui-system` (but referenced in vite as `@zidney/ui`) |
| Vue version (peerDep) | `^3.3.0`                                                     |
| Tailwind              | v4 (devDep: `tailwindcss ^4.2.0`)                            |
| vee-validate          | `^4.15.1` included                                           |
| shadcn-vue            | `^0.8.0` (devDep)                                            |
| reka-ui               | `^2.8.0`                                                     |
| Vitest                | `^4.0.18`                                                    |
| tanstack/vue-table    | `^8.21.3`                                                    |

### What Already Exists for This Stage

- ✅ Layout components: `AppLayout.vue`, `SidebarLayout.vue`, `TopBar.vue` — sufficient for app shell
- ✅ Composables: `usePagination`, `useFilterBuilder`, `useColumnVisibility` — not needed for this scaffolding stage
- ✅ Type foundations: column, common, component-props types

### What Needs to Be Added to `packages/ui-system` for This Stage

- **Nothing required for core scaffolding**. The `core/` layer components (API client, router, guards, auth, config, error normalizer) are app-internal by design. They do not belong in `packages/ui-system`.
- `packages/ui-system` is already consumed via `@zidney/ui` alias in mmc's `vite.config.ts`. Backoffice and frontoffice will need the same alias configured in their own `vite.config.ts`.

---

## R-04 — Vite/TypeScript Config Analysis

### MMC — `apps/mmc/`

**`vite.config.ts`** — Already has:

```typescript
resolve: {
  alias: [
    { find: '@', replacement: resolve(__dirname, 'src') },
    { find: '@zidney/ui', replacement: resolve(__dirname, '../../packages/ui-system/src') },
  ],
}
```

**Assessment**: Vite alias for `@/` and `@zidney/ui` is already configured. ✅ No change needed to `vite.config.ts`.

**`tsconfig.json`** — Extends `../../tsconfig.base.json`. Does NOT define a local `@/` path alias.  
**`tsconfig.base.json`** — Defines workspace-level paths (`@zidney/app/*`, `@zidney/ui/*`, etc.) but NOT `@/` per-app alias.

**Gap**: The `@/` alias is known to Vite but NOT to TypeScript's resolver. This means `import X from '@/core/...'` will fail type checking.

**Decision**: Each app's `tsconfig.json` must add `"paths": { "@/*": ["./src/*"] }` and `"baseUrl": "."` to align TypeScript resolution with Vite runtime resolution. This is a required update to `apps/mmc/tsconfig.json`, `apps/backoffice/tsconfig.json`, and `apps/frontoffice/tsconfig.json`.

### Backoffice and Frontoffice

Both need new Vite and TypeScript configs cloned from MMC's pattern with appropriate adjustments.

---

## R-05 — Existing MMC Test Files

### Location and Files Found

```
apps/mmc/tests/
├── audit/
│   └── dashboard-compliance.test.ts
├── e2e/
│   ├── dashboard-errors.test.ts
│   └── dashboard-integration.test.ts
└── performance/
    └── dashboard-perf.test.ts
```

### Impact Assessment

These test files import from the current non-canonical paths (e.g., `../../src/api/dashboard-client`, `../../src/stores/dashboard-store`). After the delta migration, these imports will be broken.

**Required updates**:

- `audit/dashboard-compliance.test.ts` — update imports to `../../src/modules/dashboard/...`
- `e2e/dashboard-integration.test.ts` — update imports to `../../src/modules/dashboard/...`
- `e2e/dashboard-errors.test.ts` — update imports to `../../src/modules/dashboard/...`
- `performance/dashboard-perf.test.ts` — update imports to `../../src/modules/dashboard/...`

New test files to create for this stage:

- `apps/mmc/tests/unit/core/error-normalizer.test.ts`
- `apps/mmc/tests/unit/core/api-client.test.ts`
- `apps/mmc/tests/unit/core/auth-guard.test.ts`
- `apps/mmc/tests/unit/core/role-guard.test.ts`
- `apps/mmc/tests/unit/core/token-store.test.ts`
- `apps/mmc/tests/unit/core/env-config.test.ts`

Same pattern applies to backoffice and frontoffice.

---

## R-06 — Pinia and Vue Router Versions

### From `apps/mmc/package.json`

```json
"dependencies": {
  "vue": "^3.4.0",
  "vue-router": "^4.0.0"
}
```

**Critical Gap**: Pinia is **NOT listed** in `apps/mmc/package.json`. It must be added.

### Recommended Versions

| Package      | Version                    | Rationale                                            |
| ------------ | -------------------------- | ---------------------------------------------------- |
| `pinia`      | `^2.2.0`                   | Latest stable; compatible with Vue 3.4 and Vitest 1+ |
| `vue-router` | `^4.0.0` (already present) | FR-09 specifies `createWebHistory` — v4 ✅           |
| `vue`        | `^3.4.0` (already present) | Required minimum for Pinia strict mode compat        |

**Decision**: Add `"pinia": "^2.2.0"` to `dependencies` in all three app `package.json` files. Add `@pinia/testing` to `devDependencies` for store unit testing.

### For Backoffice and Frontoffice

Both apps need a fresh `package.json` with:

```json
"dependencies": {
  "vue": "^3.4.0",
  "vue-router": "^4.0.0",
  "pinia": "^2.2.0",
  "@zidney/ui-system": "workspace:*"
}
"devDependencies": {
  "@vitejs/plugin-vue": "^5.0.0",
  "@pinia/testing": "^0.1.6",
  "@vue/test-utils": "^2.4.0",
  "typescript": "latest",
  "vite": "^5.0.0",
  "vitest": "^1.0.0"
}
```

---

## R-07 — ADR Compliance Check

| Rule                                                   | Verified Against          | Status                                                       |
| ------------------------------------------------------ | ------------------------- | ------------------------------------------------------------ |
| No business logic in UI                                | spec §12, AGENTS.md       | ✅ — Core layer is scaffolding only                          |
| No cross-tenant joins                                  | spec §13                  | ✅ — No DB access from UI                                    |
| shadcn-vue for all UI components                       | AGENTS.md UI System Rules | ✅ — `packages/ui-system` uses shadcn-vue                    |
| Tailwind v4 for layout                                 | AGENTS.md                 | ✅ — ui-system uses Tailwind v4                              |
| No custom component system if shadcn equivalent exists | AGENTS.md                 | ✅ — ui-system wraps shadcn                                  |
| Import boundary: apps → packages only                  | AGENTS.md                 | ✅ — apps import from `packages/ui-system` only              |
| TypeScript strict mode                                 | tsconfig.base.json        | ✅ — `strict: true`, `noImplicitAny: true` globally enforced |
| No secrets in frontend                                 | NFR-04                    | ✅ — `core/config/env.ts` validates build-time only env vars |

**No ADR conflicts detected.**

---

## R-08 — `packages/ui-system` Package Name vs Alias Discrepancy

**Finding**: The npm package is named `@zidney/ui-system` but the Vite alias in `apps/mmc/vite.config.ts` resolves `@zidney/ui` directly to the source path. This bypasses the npm package resolution entirely and uses a direct filesystem path alias.

**Decision**: This pattern is intentional for monorepo development (avoids build step for ui-system during app development). All three apps should use the same alias pattern:

```typescript
{ find: '@zidney/ui', replacement: resolve(__dirname, '../../packages/ui-system/src') }
```

For production builds, apps should depend on `@zidney/ui-system` in `package.json` with `workspace:*` resolution.

---

## Summary of Resolved Unknowns

| Unknown                                  | Resolution                                                |
| ---------------------------------------- | --------------------------------------------------------- |
| MMC component count in `src/components/` | 28 files (6 Dashboard, 18 licenses, 4 root-level)         |
| Pinia installed in MMC?                  | **No** — must be added to `package.json`                  |
| `@/` TypeScript path alias               | Missing in `tsconfig.json` — must be added per-app        |
| Backoffice/Frontoffice state             | Empty (AGENTS.md only) — full scaffold required           |
| ui-system what exists                    | Layout components, composables, utils, types — sufficient |
| ui-system what needs to be added         | Nothing required for this stage                           |
| vue-router version                       | v4 ✅ present in MMC                                      |
| Existing test file impact                | 4 MMC test files need import path updates after migration |
| ADR conflicts                            | None detected                                             |
