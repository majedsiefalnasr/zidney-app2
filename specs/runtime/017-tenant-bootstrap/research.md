# Research — STAGE_17: Tenant Bootstrap

**Date:** 2026-02-28  
**Stage:** STAGE_17_TENANT_BOOTSTRAP  
**Phase:** 03 – Backoffice Core / 01 – Foundation  
**Status:** Resolved — all NEEDS CLARIFICATION eliminated

---

## 1. Existing Codebase Inventory

### 1.1 `apps/api/src/` — Middleware, Routes, DB Patterns

**Middleware files confirmed present (`apps/api/src/middleware/`):**

| File                                                      | Purpose                                                                       | Relevant to STAGE_17                     |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------- |
| `correlation-id-hono.ts` / `correlationIdMiddleware.ts`   | Correlation ID injection (position 1 in chain)                                | Reference pattern                        |
| `tenant-resolver-stage06.ts`                              | Tenant resolver — extracts slug, builds `TenantContextStage06`, attaches pool | **Direct dependency**                    |
| `license-enforcement.ts` / `license.middleware.ts`        | License state validation, returns 423/403/404 per status                      | **Direct dependency**                    |
| `schema-version.middleware.ts`                            | Schema version compatibility (returns 426 on mismatch)                        | **Direct dependency**                    |
| `rbac-stage06.ts`                                         | RBAC middleware for Attempt Engine (stage-specific, not reusable as-is)       | **Pattern reference**                    |
| `mmc-auth.middleware.ts` / `mmc-permission.middleware.ts` | MMC-layer auth/permission guards                                              | Pattern reference only — MMC is separate |
| `rate-limit.middleware.ts` / `rateLimitMiddleware.ts`     | Rate limiting                                                                 | Apply per-workspace rate limit           |

**Existing `TenantContextStage06` shape** (from `tenant-resolver-stage06.ts`):

```typescript
interface TenantContextStage06 {
  id: string // workspace_id
  slug: string // workspace_slug
  database_name: string
  schema_version: number
  license_id: string
  organization_id: string
  pool: any
}
```

STAGE_17 middleware context must extend this with `license_status`, `enabled_modules`, `student_limit`, `staff_limit`, `product_version`.

**Existing Backoffice routes (`apps/api/src/routes/backoffice/`):**

| File       | Routes                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| `users.ts` | `POST /api/backoffice/users` — creates staff user with limit enforcement |

Runtime context endpoint (`GET /api/backoffice/context`) does **not yet exist** — new in STAGE_17.

**Route registration pattern** confirmed in `users.ts`:

```typescript
export const backofficeUsersRouter = new Hono()
backofficeUsersRouter.post('/backoffice/users', async (ctx: Context) => { ... })
// Context access: ctx.get('correlation_id'), ctx.get('tenant_db'), etc.
```

**Existing response helpers confirmed:**

- `apps/api/src/responses/license-error-handler.ts` — `toLicenseError()` provides structured license error responses
- Structured error format: `{ success: false, data: null, error: { code: string, message: string } }`

### 1.2 `apps/backoffice/src/` — Current State

**Status:** Not yet scaffolded. The `apps/backoffice/` directory contains only `AGENTS.md`. STAGE_17 is the **first** Backoffice implementation stage.

**Required deliverables (new scaffolding):**

- `apps/backoffice/src/main.ts` — Vue app entry point
- `apps/backoffice/src/App.vue` — root component with router-view
- `apps/backoffice/src/router/index.ts` — Vue Router with license + module guards
- `apps/backoffice/src/stores/context.ts` — Pinia runtime context store
- `apps/backoffice/src/layouts/BackofficeLayout.vue` — composes ui-system AppLayout
- `apps/backoffice/src/views/WorkspaceUnavailable.vue` — license block screen
- `apps/backoffice/src/views/Dashboard.vue` — placeholder landing
- `apps/backoffice/package.json` — Vue 3 + Vite + vue-router + pinia project

### 1.3 `packages/ui-system/` — Available Components

**Layout components (confirmed in `packages/ui-system/src/components/Layout/`):**

| Component       | File                | Description                                                                                                             |
| --------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `AppLayout`     | `AppLayout.vue`     | Shell: topbar slot, sidebar slot, main slot, footer slot. Props: `appName`, `logoUrl`, `subtitle`                       |
| `SidebarLayout` | `SidebarLayout.vue` | Collapsible sidebar. Props: `items`, `activeItem`, `collapsible`. Supports `show`, `disabled`, `badge`, `icon` per item |
| `TopBar`        | `TopBar.vue`        | Top header bar. Props: `appName`, `logoUrl`, `subtitle`. Right slot for actions                                         |

**Note:** `ContentArea` is NOT a separate component — content goes into the default `<slot />` of `AppLayout`. STAGE_17 does not need to create a new `ContentArea` component.

**STAGE_17 UI decision:** Backoffice will compose these three existing components via `BackofficeLayout.vue`, injecting `enabled_modules` from the Pinia context store to drive `SidebarLayout` `items`. No new component system needed.

**Other component categories available in `packages/ui-system/src/components/`:**

- `DataTable/` — table primitives
- `Dialogs/` — modal dialogs
- `Filters/` — filter controls
- `Forms/` — form components
- `Status/` — status indicators
- `shadcn-vue/` — shadcn primitives

### 1.4 `packages/types/` — Shared Types

**`ModuleEnum` confirmed** (`packages/types/src/enums/Module.ts`):

```typescript
export enum Module {
  MCQ = 'MCQ',
  TRADITIONAL_EXAMS = 'TRADITIONAL_EXAMS',
  EXERCISES = 'EXERCISES',
  LIBRARY = 'LIBRARY',
  LIVES = 'LIVES',
  FORUM = 'FORUM',
}
```

Already exported; re-use directly. No changes required for STAGE_17.

**`rbac.ts` confirmed** (`packages/types/src/rbac.ts`): Contains `MasterDBPermission` and `RolePermissions` for **MMC** layer only. These are master_db RBAC types. STAGE_17 must add **separate** tenant-RBAC types (`ActionEnum`, `BackofficeContext`, `TenantRBACPermission`) without modifying the MMC types.

**`packages/types/src/index.ts`** currently does not export `Module` enum — it exports from `./enums/` indirectly through sub-modules but not via wildcard. STAGE_17 must verify `Module` is reachable via `@zidney/types`.

**Required additions to `packages/types`:**

- `src/tenant-rbac.ts` — `ActionEnum`, `TenantRBACPermission`, `BackofficeContext` type
- Update `src/index.ts` to export `tenant-rbac.ts`

### 1.5 `apps/api/src/db/tenant/migrations/` — Latest Migration Number

**All confirmed tenant migration files:**

| File                                  | Convention      | Stage    |
| ------------------------------------- | --------------- | -------- |
| `001_schema_version.sql`              | Numbered SQL    | Baseline |
| `0008_add_idempotent_submission.ts`   | 4-digit numeric | STAGE_06 |
| `0009_add_idempotent_indexes.ts`      | 4-digit numeric | STAGE_06 |
| `0010_add_audit_indexes.ts`           | 4-digit numeric | STAGE_06 |
| `20260217_001_add_auth_to_users.ts`   | Date-prefix TS  | STAGE_03 |
| `20260217_002_create_audit_logs.ts`   | Date-prefix TS  | STAGE_03 |
| `baseline_001_schema_versions.sql`    | Baseline SQL    | Baseline |
| `baseline_002_roles.sql`              | Baseline SQL    | Baseline |
| `baseline_003_permissions.sql`        | Baseline SQL    | Baseline |
| `baseline_004_workspace_settings.sql` | Baseline SQL    | Baseline |
| `baseline_005_divisions.sql`          | Baseline SQL    | Baseline |
| `baseline_006_init_admin_user.sql`    | Baseline SQL    | Baseline |

**Convention decision:** The project uses both numeric and date-prefix naming. The date-prefix TypeScript pattern (`YYYYMMDD_NNN_<description>.ts`) is the **newer, preferred** convention per most recent migrations. STAGE_17 must follow this pattern.

**Next migration file name:**

```
20260228_001_tenant_rbac_skeleton.ts
```

Full path: `apps/api/src/db/tenant/migrations/20260228_001_tenant_rbac_skeleton.ts`

### 1.6 `apps/api/src/db/tenant/` — Existing Schema

**Confirmed structure:**

- `pool-manager.ts` — tenant pool management (already exists)
- `migrations/` — directory listing above
- No `schema.ts` Drizzle schema file found at `apps/api/src/db/tenant/schema.ts`

**Investigation:** The existing tenant migrations are raw SQL (`.sql`) and raw PoolClient TS (`.ts` using `client.query()`). No Drizzle ORM schema file exists at the tenant layer. The project uses raw `pg` PoolClient for migrations, not Drizzle migrations.

**Decision:** STAGE_17 tenant migration will follow the same `PoolClient` pattern used in `20260217_001_add_auth_to_users.ts` and `20260217_002_create_audit_logs.ts` — using `export async function up(client: PoolClient)` with raw SQL inside a DDL transaction.

---

## 2. Technology Decisions

### 2.1 Hono Middleware Pattern for RBAC Permission Guard

**Decision:** Separate `MiddlewareHandler` factory function, registered after Authentication middleware.

**Pattern** (from `rbac-stage06.ts`):

```typescript
import { Logger } from '@zidney/logger'
import { Context, MiddlewareHandler } from 'hono'

export function createBackofficeRBACGuard(
  logger: Logger,
  requiredModule: Module,
  requiredAction: ActionEnum
): MiddlewareHandler {
  return async (c: Context, next) => {
    const user = c.get('staff_user')
    const workspace_id = c.get('tenant')?.id
    const correlation_id = c.get('correlationId') || 'unknown'
    // Permission lookup via tenant DB
    // Return 403 on permission denied with structured error
    // Call next() on success
  }
}
```

**Registration pattern** (per-route via `.use()` before `.get()/.post()` etc.):

```typescript
app.get(
  '/api/backoffice/some-resource',
  createBackofficeRBACGuard(logger, Module.MCQ, ActionEnum.VIEW),
  handlerFn
)
```

**Rationale:** Per FR-05.8 and spec clarification, RBAC guard is independently registered middleware — not embedded in authentication. This allows per-route opt-in to specific module+action combinations.

### 2.2 Raw SQL (PoolClient) Pattern for RBAC Migration

**Decision:** Use `PoolClient.query()` with explicit `BEGIN`/`COMMIT`/`ROLLBACK` DDL transaction. Matches the existing migration convention.

**Pattern** (from `20260217_002_create_audit_logs.ts`):

```typescript
import { PoolClient } from 'pg'

export const description = 'Create RBAC skeleton tables for STAGE_17'

export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS roles ( ... )`)
    await client.query(`CREATE TABLE IF NOT EXISTS role_permissions ( ... )`)
    await client.query(`CREATE TABLE IF NOT EXISTS staff_users ( ... )`)
    await client.query(`CREATE TABLE IF NOT EXISTS staff_user_roles ( ... )`)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

export async function down(client: PoolClient): Promise<void> {
  // Forward-only; down() is reserved for documentation only
  throw new Error(
    'STAGE_17 migration is forward-only. Rollback via snapshot restore.'
  )
}
```

### 2.3 Vue 3 + vue-router Patterns for Module-Aware Routing

**Decision:** Route meta fields with `requiredModule` + router guard using Pinia context store.

```typescript
// router/index.ts
const routes: RouteRecordRaw[] = [
  {
    path: '/mcq',
    component: () => import('../views/MCQView.vue'),
    meta: { requiredModule: Module.MCQ, requiresAuth: true },
  },
]

router.beforeEach(async (to, _from, next) => {
  const contextStore = useContextStore()
  // License check first
  if (contextStore.licenseStatus !== 'ACTIVE') {
    return next({
      name: 'workspace-unavailable',
      query: { code: contextStore.licenseErrorCode },
    })
  }
  // Module check
  const requiredModule = to.meta.requiredModule as Module | undefined
  if (requiredModule && !contextStore.enabledModules.includes(requiredModule)) {
    return next({ name: 'module-unavailable' })
  }
  next()
})
```

**Navigation sidebar** driven by `useContextStore().enabledModules` mapped through `MODULE_LABELS` from `packages/types`.

### 2.4 Hono WebSocket + License Polling Pattern

**Decision:** Bun native WebSocket upgrade via Hono, polling `license_status` from tenant DB at `WS_LICENSE_POLL_INTERVAL_MS` interval.

```typescript
// routes/backoffice/ws.ts
app.get(
  '/ws/backoffice',
  upgradeWebSocket((c) => {
    let pollInterval: ReturnType<typeof setInterval>
    return {
      onOpen(evt, ws) {
        // Validate workspace_id + license_status + auth token
        const correlation_id = c.get('correlationId')
        pollInterval = setInterval(
          async () => {
            const status = await getTenantLicenseStatus(tenantDb, workspace_id)
            if (status !== 'ACTIVE') {
              ws.close(1008, 'WORKSPACE_SUSPENDED')
            }
          },
          parseInt(process.env.WS_LICENSE_POLL_INTERVAL_MS ?? '30000')
        )
      },
      onClose() {
        clearInterval(pollInterval)
      },
    }
  })
)
```

**Environment variable:** `WS_LICENSE_POLL_INTERVAL_MS` (default 30000, valid range 5000–120000).

### 2.5 `packages/logger` Pattern (Pino-based Structured Logging)

**Pattern confirmed** from `rbac-stage06.ts` and `backoffice/users.ts`:

```typescript
import { Logger } from '@zidney/logger'
// or
import { createLogger } from '@zidney/logger'

const logger = createLogger('backoffice-context')

logger.warn('RBAC check failed', {
  workspace_slug: 'my-workspace',
  workspace_id: 'uuid-here',
  request_id: 'corr-id',
  route_name: 'GET /api/backoffice/context',
  user_id: 'user-uuid',
})
```

**Mandatory fields per FR-09.1:**

- `workspace_slug`, `workspace_id`, `request_id`, `route_name`
- Plus `user_id` for authenticated requests
- No `console.log` — structured logger only

---

## 3. Migration Strategy

### 3.1 Latest Migration Number

```
Latest TypeScript tenant migration: 20260217_002_create_audit_logs.ts
Current date: 2026-02-28
```

### 3.2 Next Migration File

```
File: 20260228_001_tenant_rbac_skeleton.ts
Full path: apps/api/src/db/tenant/migrations/20260228_001_tenant_rbac_skeleton.ts
```

### 3.3 Migration Scope

- Creates 4 new tables in the **tenant DB only**: `roles`, `role_permissions`, `staff_users`, `staff_user_roles`
- All 4 `CREATE TABLE` statements wrapped in a single `BEGIN`/`COMMIT` DDL transaction
- Uses `IF NOT EXISTS` on tables → idempotent on re-run
- Increments `schema_version` for the tenant DB (STAGE_17-specific increment)
- Existing tenants must have this migration applied by the provisioning worker at next startup
- No master_db migration required

### 3.4 `schema_version` Increment

- STAGE_05 established the baseline tenant schema_version (e.g., 1.0.0)
- STAGE_17 migration increments tenant schema_version to indicate RBAC tables present
- The exact prior version is determined by the provisioning worker at runtime; STAGE_17 migration must record its own version entry

---

## 4. Dependency Check

### 4.1 STAGE_05 — Tenant DB Schema

**Status:** CONFIRMED dependency.

STAGE_05 (Tenant Provisioning Service) bootstraps the core tenant DB. The baseline SQL migrations confirm this:

- `baseline_001_schema_versions.sql` — schema version table
- `baseline_002_roles.sql` — legacy baseline roles (NOTE: these may be draft SQL; STAGE_17 RBAC tables are separate)
- `004-create-core-application-tables.sql` — core tenant tables

STAGE_17 migration runs **after** STAGE_05 provisioning — it extends the tenant schema. Per the spec clarification, STAGE_17 RBAC tables are distinct from the STAGE_05 baseline. The presence of `baseline_002_roles.sql` / `baseline_003_permissions.sql` must be investigated before implementation to confirm they are not already defining `roles` and `role_permissions` tables (to avoid DDL conflicts). The `IF NOT EXISTS` guard in STAGE_17 migration provides safety.

### 4.2 STAGE_03 — Workspace-Scoped JWT

**Status:** CONFIRMED dependency.

`20260217_001_add_auth_to_users.ts` confirms `token_version` field is added to the users table. The `staffUsers` table in STAGE_17 mirrors this pattern (`token_version INTEGER NOT NULL DEFAULT 0`). Workspace-scoped JWT must carry `workspace_id`, `role`, and `permissions` claims — this is established by STAGE_03 auth endpoints. STAGE_17 validation middleware consumes these claims.

### 4.3 STAGE_04 — License State

**Status:** CONFIRMED dependency.

`license-enforcement.ts` confirms `LicenseStatus` is imported from `@zidney/domain-core/license`. The middleware validates `ACTIVE`, `SOFT_LOCKED`, `ARCHIVED` states and returns 423/403/404 respectively. The BackofficeContext type (`enabled_modules`, `student_limit`, `staff_limit`, `license_status`) must be hydrated from the license record resolved by STAGE_04's license engine and injected into Hono context by this middleware.

### 4.4 STAGE_16 — Shared UI System

**Status:** CONFIRMED — `AppLayout.vue`, `SidebarLayout.vue`, `TopBar.vue` are present in `packages/ui-system/src/components/Layout/`.

**Gap:** `ContentArea` is not a separate component. The AppLayout's default `<slot />` serves as the content area. STAGE_17 will use `AppLayout` default slot for content — no new component needed.

**Additional gap:** `AppLayout.vue` current `SidebarLayout` integration is slot-based, not prop-driven for module injection. `BackofficeLayout.vue` in `apps/backoffice/src/layouts/` will compose these components and map `enabledModules` from the Pinia store to `SidebarLayout` `items` prop. This is Backoffice-level composition, not a ui-system change.

---

## 5. Resolved Clarifications (from spec)

| Question                                                             | Resolution                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Are RBAC tables in STAGE_05 baseline or separate STAGE_17 migration? | Separate STAGE_17 migration per "one migration per feature" rule                |
| License polling vs event-push for WebSocket?                         | Polling at `WS_LICENSE_POLL_INTERVAL_MS` (default 30000ms); event-push deferred |
| Structured JSON body on 423/403/404?                                 | Yes — standard `{ success, data, error: { code, message } }` contract           |
| Single DDL transaction for all 4 tables?                             | Yes — `BEGIN`/`COMMIT` wraps all 4 `CREATE TABLE` statements                    |
| RBAC guard separate from auth middleware?                            | Yes — independently registered `MiddlewareHandler` after Authentication         |

---

## 6. Open Assumptions (for team review)

1. `baseline_002_roles.sql` / `baseline_003_permissions.sql` in tenant migrations may define placeholder role/permission tables. Must confirm they do NOT conflict with STAGE_17's `roles` and `role_permissions` DDL before implementation. `IF NOT EXISTS` guard is a safety net but schema consistency must be manually validated.

2. The Backoffice Vue app (`apps/backoffice/`) has no `package.json` or Vite config yet — STAGE_17 will scaffold this from scratch. Confirm project tooling (Vite, vue-router, pinia versions) aligns with MMC app (`apps/mmc/`) for monorepo consistency.

3. Confirm `Module` enum from `packages/types/src/enums/Module.ts` is accessible via `import { Module } from '@zidney/types'`. The current `index.ts` does not explicitly list this re-export (it was in a sub-module); verify the build resolves it.
