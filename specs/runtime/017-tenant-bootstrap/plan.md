# Implementation Plan — STAGE_17: Tenant Bootstrap

**Date:** 2026-02-28  
**Stage:** STAGE_17_TENANT_BOOTSTRAP  
**Phase:** 03 – Backoffice Core / 01 – Foundation  
**Status:** Ready for implementation  
**Prerequisites:** research.md ✓, data-model.md ✓

---

## Middleware Chain (Canonical Order)

All Backoffice API routes must traverse this chain in this exact order:

```
1. Correlation ID         → sets correlationId in context
2. Tenant Resolver        → resolves workspace_slug, attaches tenant pool
3. License Enforcement    → validates license_status; blocks 423/403/404 on non-ACTIVE
4. Schema Version         → validates tenant schema_version compatibility; blocks 426 on mismatch
5. Authentication         → validates workspace-scoped JWT; sets staff_user context
6. RBAC Permission Guard  → checks role+permission for the specific route
7. Route Handler          → executes business logic
```

**Hard rule:** No Backoffice route handler may execute before steps 1–6 complete successfully. Each middleware must call `next()` only on success, or return the appropriate structured error response.

**WebSocket chain:**

```
1. Correlation ID → 2. Tenant Resolver → 3. License Enforcement → 4. Authentication → WebSocket Upgrade
```

---

## API Layer (`apps/api/src/`)

### API-01: Tenant DB Migration

**File:** `apps/api/src/db/tenant/migrations/20260228_001_tenant_rbac_skeleton.ts`

- Creates `roles`, `role_permissions`, `staff_users`, `staff_user_roles` in one DDL transaction
- Full source in `data-model.md`
- `up()` uses `BEGIN`/`COMMIT`; `down()` throws (forward-only)
- Idempotent via `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`

**Validation test:** After migration on a fresh tenant DB, all 4 tables and all 6 indexes must be present. Run `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'` to confirm.

---

### API-02: New Route — `GET /api/v1/backoffice/context`

**File:** `apps/api/src/routes/backoffice/context.ts`

**Purpose:** Returns the runtime `BackofficeContext` object to the Backoffice SPA for initializing the Pinia store on mount. This is the only endpoint that exposes middleware-injected context as a serialized response.

**Auth requirement:** Requires valid workspace-scoped JWT delivered via **HttpOnly SameSite=Strict cookie** set by the STAGE_03 authentication API. The middleware reads the JWT from the cookie; the SPA sends `credentials: 'include'` — no `Authorization` header.

**Middleware chain:** Full chain (Correlation ID → Tenant Resolver → License Enforcement → Schema Version → Authentication). No RBAC guard on this route — reading context is available to any authenticated staff user.

**Request:** `GET /api/v1/backoffice/context`
**Auth transport:** HttpOnly cookie (`backoffice_token`)
**Headers:** No explicit `Authorization` header — cookie sent automatically via `credentials: 'include'`

**Success response (200):**

```json
{
  "success": true,
  "data": {
    "workspace_id": "uuid",
    "workspace_slug": "my-workspace",
    "license_status": "ACTIVE",
    "enabled_modules": ["MCQ", "LIBRARY"],
    "student_limit": 500,
    "staff_limit": 10,
    "product_version": "2.1.0",
    "schema_version": 17,
    "request_id": "corr-id-uuid"
  },
  "error": null
}
```

**Error responses:**

- 401 — Missing or invalid JWT
- 423 — `LICENSE_SOFT_LOCKED`
- 403 — `LICENSE_ARCHIVED`
- 404 — `WORKSPACE_NOT_FOUND`

**Implementation:**

```typescript
// apps/api/src/routes/backoffice/context.ts
import { createLogger } from '@zidney/logger'
import { Context, Hono } from 'hono'

const logger = createLogger('backoffice-context')

export const backofficeContextRouter = new Hono()

backofficeContextRouter.get('/backoffice/context', async (c: Context) => {
  const correlation_id = c.get('correlationId') || 'unknown'
  const tenant = c.get('tenant')
  const staff_user = c.get('staff_user')

  logger.info('Backoffice context requested', {
    workspace_slug: tenant.slug,
    workspace_id: tenant.id,
    correlation_id,
    route_name: 'GET /api/v1/backoffice/context',
    user_id: staff_user.user_id,
  })

  return c.json(
    {
      success: true,
      data: {
        workspace_id: tenant.id,
        workspace_slug: tenant.slug,
        license_status: c.get('license_status'),
        enabled_modules: c.get('enabled_modules'),
        student_limit: c.get('student_limit'),
        staff_limit: c.get('staff_limit'),
        product_version: c.get('product_version'),
        schema_version: tenant.schema_version,
        request_id: correlation_id,
      },
      error: null,
    },
    200
  )
})
```

---

### API-03: RBAC Permission Guard Middleware

**File:** `apps/api/src/middleware/backoffice-rbac-guard.ts`

**Purpose:** Per-route RBAC enforcement. Validates that the authenticated staff user holds the required `module` + `action` permission in the tenant DB.

**Registration:** Added as the 6th middleware step, registered per-route before the route handler:

```typescript
app.post(
  '/api/backoffice/some-resource',
  createBackofficeRBACGuard(logger, Module.MCQ, ActionEnum.CREATE), // logger is first param
  someResourceHandler
)
```

**Implementation:**

```typescript
// apps/api/src/middleware/backoffice-rbac-guard.ts
import { createLogger } from '@zidney/logger'
import { Module } from '@zidney/types'
import { ActionEnum } from '@zidney/types'
import { Context, MiddlewareHandler } from 'hono'

const logger = createLogger('backoffice-rbac-guard')

/**
 * Creates an RBAC Permission Guard middleware for a specific module + action.
 *
 * Usage:
 *   app.get('/api/v1/backoffice/mcq', createBackofficeRBACGuard(logger, Module.MCQ, ActionEnum.VIEW), handler)
 *
 * Chain position: After Authentication (step 5), before Route Handler (step 7).
 */
export function createBackofficeRBACGuard(
  logger: ReturnType<typeof createLogger>,
  requiredModule: Module,
  requiredAction: ActionEnum
): MiddlewareHandler {
  return async (c: Context, next) => {
    const correlation_id = c.get('correlationId') || 'unknown'
    const staff_user = c.get('staff_user')
    const tenant = c.get('tenant')

    if (!staff_user) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Staff user context not found',
            correlationId: correlation_id,
          },
        },
        401
      )
    }

    // Check enabled_modules first (fast client-side gate before DB query)
    const enabled_modules: string[] = c.get('enabled_modules') ?? []
    if (!enabled_modules.includes(requiredModule)) {
      logger.warn('Module not licensed', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id,
        route_name: c.req.routePath,
        user_id: staff_user.user_id,
        module: requiredModule,
      })
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'MODULE_NOT_LICENSED',
            message: `Module ${requiredModule} is not enabled for this workspace`,
            correlationId: correlation_id,
          },
        },
        403
      )
    }

    // Query tenant DB for permission
    const tenantDb = tenant.pool
    const result = await tenantDb.query<{ has_permission: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1
        FROM   staff_user_roles sur
        JOIN   role_permissions rp ON rp.role_id = sur.role_id
        WHERE  sur.staff_user_id = $1
        AND    rp.module         = $2
        AND    rp.action         = $3
      ) AS has_permission
    `,
      [staff_user.user_id, requiredModule, requiredAction]
    )

    const hasPermission = result.rows[0]?.has_permission ?? false

    if (!hasPermission) {
      logger.warn('RBAC permission denied', {
        workspace_slug: tenant.slug,
        workspace_id: tenant.id,
        correlation_id,
        route_name: c.req.routePath,
        user_id: staff_user.user_id,
        module: requiredModule,
        action: requiredAction,
      })
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'RBAC_PERMISSION_DENIED',
            message: 'Insufficient permissions',
            correlationId: correlation_id,
          },
        },
        403
      )
    }

    await next()
  }
}
```

---

### API-04: License Gate Middleware — Backoffice-Specific Responses

**File:** `apps/api/src/middleware/license-enforcement.ts` (**UPDATE existing file** — add `correlationId` to all non-ACTIVE error responses)

**V-06 implementation note:** The existing `license-enforcement.ts` returns `{ code, message }` in error objects without `correlationId`. As part of this stage's API-04 task, the `toLicenseError()` helper (or the middleware's response builder) must be updated to include `correlationId: c.get('correlationId') ?? 'unknown'` in every non-ACTIVE error response. This is a mandatory change in the existing file, not a new file.

**Requirement:** All non-ACTIVE responses must use the standard error contract with typed codes:

| License Status      | HTTP | Error Code            |
| ------------------- | ---- | --------------------- |
| `SOFT_LOCKED`       | 423  | `LICENSE_SOFT_LOCKED` |
| `ARCHIVED`          | 403  | `LICENSE_ARCHIVED`    |
| Workspace not found | 404  | `WORKSPACE_NOT_FOUND` |

The existing `license-enforcement.ts` uses `toLicenseError()` helper — confirm this helper produces the above codes. If not, add the missing codes to the helper.

**Structured response (all non-ACTIVE):**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "LICENSE_SOFT_LOCKED",
    "message": "This workspace is currently suspended.",
    "correlationId": "<correlation-id-from-context>"
  }
}
```

---

### API-05: Module Guard Middleware

**File:** `apps/api/src/middleware/backoffice-module-guard.ts`

**Purpose:** Blocks API endpoints scoped to a disabled module before the RBAC check. This is a lightweight guard that checks `c.get('enabled_modules')` without a DB query.

```typescript
// apps/api/src/middleware/backoffice-module-guard.ts
import { Module } from '@zidney/types'
import { Context, MiddlewareHandler } from 'hono'

export function createModuleGuard(requiredModule: Module): MiddlewareHandler {
  return async (c: Context, next) => {
    const enabled_modules: string[] = c.get('enabled_modules') ?? []
    if (!enabled_modules.includes(requiredModule)) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'MODULE_NOT_LICENSED',
            message: `Module ${requiredModule} is not available for this workspace`,
            correlationId: c.get('correlationId') ?? 'unknown',
          },
        },
        403
      )
    }
    await next()
  }
}
```

**Note:** The RBAC guard (API-03) also performs the module check as a fast pre-step. The standalone `ModuleGuard` is used on routes that need module enforcement without RBAC (e.g., read-only public module pages where no role check is needed).

---

### API-06: WebSocket Endpoint — `/ws/backoffice`

**File:** `apps/api/src/routes/backoffice/ws.ts`

**Purpose:** Establishes a WebSocket connection for Backoffice. Validates workspace, license, and auth on handshake. Polls license status every `WS_LICENSE_POLL_INTERVAL_MS` ms during the session.

**Handshake requirements:**

1. `workspace_id` validated (from resolved tenant context)
2. `license_status = ACTIVE` (from license middleware)
3. JWT validated (from auth middleware)
4. `correlation_id` attached (from correlation ID middleware)
5. One connection per authenticated user enforced (reject if duplicate detected)

**License polling:**

- Default: 30 000 ms (`WS_LICENSE_POLL_INTERVAL_MS` env var)
- Valid range: 5 000–120 000 ms
- On non-ACTIVE status during session → close with code 1008

**Implementation skeleton:**

```typescript
// apps/api/src/routes/backoffice/ws.ts
import { createLogger } from '@zidney/logger'
import { upgradeWebSocket } from 'hono/bun'

const logger = createLogger('backoffice-ws')

const WS_POLL_MS = Math.min(
  Math.max(parseInt(process.env.WS_LICENSE_POLL_INTERVAL_MS ?? '30000'), 5000),
  120000
)

// Redis-backed connection registry: key = ws:backoffice:{workspace_id}:{user_id}, TTL = WS_POLL_MS * 3
// Enforces single-connection-per-user across all nodes
// Uses @zidney/redis-utils createRedisClient() — same infrastructure as license middleware

export function createBackofficeWsRoute() {
  return upgradeWebSocket((c) => {
    const tenant = c.get('tenant')
    const staff_user = c.get('staff_user')
    const correlation_id = c.get('correlationId') || 'unknown'
    const connKey = `${tenant.id}:${staff_user.user_id}`
    // WS-02 FIX: Hoist Redis client + key to outer closure so onOpen/onClose/onError all share the same scope
    const wsKey = `ws:backoffice:${tenant.id}:${staff_user.user_id}`
    const wsRedis = createRedisClient() // @zidney/redis-utils
    let pollInterval: ReturnType<typeof setInterval>

    return {
      async onOpen(_, ws) {
        // Reject duplicate connections — Redis enforced (node-safe)
        const existing = await wsRedis.get(wsKey)
        if (existing) {
          logger.warn('Duplicate WS connection rejected', {
            workspace_id: tenant.id,
            workspace_slug: tenant.slug,
            correlation_id,
            user_id: staff_user.user_id,
            route_name: 'WS /ws/backoffice',
          })
          ws.close(1008, 'DUPLICATE_CONNECTION')
          return
        }
        // Register connection with TTL (refreshed on each poll cycle)
        await wsRedis.setex(wsKey, Math.ceil((WS_POLL_MS * 3) / 1000), '1')
        logger.info('Backoffice WS connected', {
          workspace_id: tenant.id,
          workspace_slug: tenant.slug,
          correlation_id,
          user_id: staff_user.user_id,
          route_name: 'WS /ws/backoffice',
        })

        pollInterval = setInterval(async () => {
          try {
            // V-04 FIX: Reuse outer-scope wsRedis client — no new Redis client per tick
            const status = await wsRedis.get(`license:status:${tenant.id}`)
            // Refresh the connection presence TTL on each successful poll
            await wsRedis.setex(wsKey, Math.ceil((WS_POLL_MS * 3) / 1000), '1')
            if (status !== 'ACTIVE') {
              logger.warn('WS license became non-ACTIVE; closing connection', {
                workspace_id: tenant.id,
                workspace_slug: tenant.slug,
                correlation_id,
                user_id: staff_user.user_id,
                license_status: status ?? 'UNKNOWN',
                route_name: 'WS /ws/backoffice',
              })
              ws.close(1008, 'WORKSPACE_SUSPENDED')
            }
          } catch (err) {
            logger.error('WS license poll failed', {
              workspace_id: tenant.id,
              workspace_slug: tenant.slug,
              correlation_id,
              user_id: staff_user.user_id,
              route_name: 'WS /ws/backoffice',
            })
          }
        }, WS_POLL_MS)
      },

      onClose() {
        clearInterval(pollInterval)
        void wsRedis.del(wsKey) // Remove Redis connection registry entry
        logger.info('Backoffice WS disconnected', {
          workspace_id: tenant.id,
          workspace_slug: tenant.slug,
          correlation_id,
          user_id: staff_user.user_id,
          route_name: 'WS /ws/backoffice',
        })
      },

      onError(evt) {
        clearInterval(pollInterval)
        void wsRedis.del(wsKey) // Remove Redis connection registry entry
        logger.error('Backoffice WS error', {
          workspace_id: tenant.id,
          workspace_slug: tenant.slug,
          correlation_id,
          user_id: staff_user.user_id,
          route_name: 'WS /ws/backoffice',
        })
      },
    }
  })
}
```

---

### API-07: Route Registration

**File:** `apps/api/src/app.ts` (or wherever Backoffice routes are mounted)

Backoffice routes must be mounted under a workspace-scoped prefix with the full middleware chain applied:

```typescript
// Mount backoffice context route with full middleware chain + rate limiting
app.use(
  '/api/v1/backoffice/*',
  correlationIdMiddleware,
  createTenantResolverMiddleware(logger, poolManager),
  licenseEnforcementMiddleware,
  schemaVersionMiddleware,
  createRateLimitMiddleware({
    windowMs: 60_000,
    max: 60,
    keyPrefix: 'backoffice',
  }), // V-05: @zidney/rate-limit.middleware
  createAuthenticationMiddleware(logger) // validates workspace-scoped JWT from HttpOnly cookie
)

// V-01 FIX: WebSocket endpoint needs its own explicit middleware chain (outside /api/v1/* scope)
app.use(
  '/ws/backoffice',
  correlationIdMiddleware,
  createTenantResolverMiddleware(logger, poolManager),
  licenseEnforcementMiddleware,
  createAuthenticationMiddleware(logger)
)

// Context endpoint (no RBAC guard — available to all authenticated staff)
app.route('/api/v1', backofficeContextRouter)

// WebSocket endpoint (no RBAC guard)
app.get('/ws/backoffice', createBackofficeWsRoute())

// Example module-gated route (MCQ) — logger must be declared at module scope
const routeLogger = createLogger('backoffice-routes')
app.get(
  '/api/v1/backoffice/mcq',
  createBackofficeRBACGuard(routeLogger, Module.MCQ, ActionEnum.VIEW),
  mcqListHandler
)
```

---

## Frontend Layer (`apps/backoffice/src/`)

### FE-01: Project Scaffold

**Status:** New project — `apps/backoffice/` contains only `AGENTS.md`.

**Required files to create:**

```
apps/backoffice/
├── package.json                    ← Vue 3 + Vite project (match apps/mmc/ versions)
├── vite.config.ts                  ← Vite config (path aliases: @/ → src/)
├── tsconfig.json                   ← TS config (extends workspace tsconfig.base.json)
├── index.html                      ← SPA entry HTML
└── src/
    ├── main.ts                     ← createApp + router + pinia mount
    ├── App.vue                     ← root component (<RouterView />)
    ├── router/
    │   └── index.ts                ← Vue Router v4 with license + module guards
    ├── stores/
    │   └── context.ts              ← Pinia: BackofficeContext store
    ├── layouts/
    │   └── BackofficeLayout.vue    ← composes ui-system AppLayout + SidebarLayout + TopBar
    └── views/
        ├── WorkspaceUnavailable.vue ← license block screen (423/403/404 variants)
        └── Dashboard.vue           ← placeholder landing page
```

---

### FE-02: Runtime Context Store (Pinia)

**File:** `apps/backoffice/src/stores/context.ts`

**Purpose:** Fetches and stores the `BackofficeContext` from `GET /api/backoffice/context`. Initialized once on app mount. All components and route guards consume this store — no additional API calls needed.

```typescript
// apps/backoffice/src/stores/context.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { BackofficeContext } from '@zidney/types'
import { Module } from '@zidney/types'

export const useContextStore = defineStore('backoffice-context', () => {
  const context = ref<BackofficeContext | null>(null)
  const loading = ref(false)
  const error = ref<{ code: string; message: string } | null>(null)

  const isActive = computed(() => context.value?.license_status === 'ACTIVE')
  const enabledModules = computed(() => context.value?.enabled_modules ?? [])
  const licenseStatus = computed(() => context.value?.license_status ?? null)
  const licenseErrorCode = computed(() => error.value?.code ?? null)

  function hasModule(module: Module): boolean {
    return enabledModules.value.includes(module)
  }

  async function loadContext(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await fetch('/api/v1/backoffice/context', {
        // FE-01 FIX: HttpOnly SameSite=Strict cookie set by STAGE_03 auth API is sent automatically.
        // No Authorization header; no token read from JS-accessible storage.
        credentials: 'include',
      })
      const json = await response.json()
      if (!json.success) {
        error.value = json.error
        context.value = null
        return
      }
      context.value = json.data as BackofficeContext
    } catch (e) {
      error.value = {
        code: 'NETWORK_ERROR',
        message: 'Failed to load workspace context',
      }
    } finally {
      loading.value = false
    }
  }

  return {
    context,
    loading,
    error,
    isActive,
    enabledModules,
    licenseStatus,
    licenseErrorCode,
    hasModule,
    loadContext,
  }
})
```

---

### FE-03: Vue Router with License + Module Guards

**File:** `apps/backoffice/src/router/index.ts`

**Key behaviors:**

1. On every navigation: check `isActive` from context store
2. If not active → redirect to `workspace-unavailable` with `code` query param
3. If route has `meta.requiredModule` → check `hasModule()` from context store
4. If module not enabled → redirect to `module-unavailable` (or dashboard)

```typescript
// apps/backoffice/src/router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { Module } from '@zidney/types'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/unavailable',
    name: 'workspace-unavailable',
    component: () => import('../views/WorkspaceUnavailable.vue'),
    meta: { requiresAuth: false },
  },
  // Future module routes — registered here with requiredModule meta:
  // { path: '/mcq', name: 'mcq', component: ..., meta: { requiresAuth: true, requiredModule: Module.MCQ } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  // Lazy import to avoid circular dep
  const { useContextStore } = await import('../stores/context')
  const contextStore = useContextStore()

  // Load context if not loaded
  if (!contextStore.context && !contextStore.loading) {
    await contextStore.loadContext()
  }

  // License gate — redirect on non-ACTIVE
  if (to.meta.requiresAuth !== false && !contextStore.isActive) {
    return next({
      name: 'workspace-unavailable',
      query: { code: contextStore.licenseErrorCode ?? 'UNKNOWN' },
    })
  }

  // Module gate — redirect if module not enabled
  const requiredModule = to.meta.requiredModule as Module | undefined
  if (requiredModule && !contextStore.hasModule(requiredModule)) {
    return next({ name: 'dashboard' }) // or a module-unavailable route
  }

  next()
})

export default router
```

---

### FE-04: AppLayout Composition (`BackofficeLayout.vue`)

**File:** `apps/backoffice/src/layouts/BackofficeLayout.vue`

**Purpose:** Composes `AppLayout`, `SidebarLayout`, `TopBar` from `packages/ui-system`. Maps `enabledModules` from the Pinia context store into `SidebarLayout` `items` using `MODULE_LABELS` from `@zidney/types`. No hardcoded navigation items.

```vue
<!-- apps/backoffice/src/layouts/BackofficeLayout.vue -->
<template>
  <AppLayout :appName="workspaceName">
    <template #topbar>
      <TopBar :appName="workspaceName" />
    </template>

    <template #sidebar>
      <SidebarLayout
        :items="navItems"
        :activeItem="activeNavItem"
        :collapsible="true"
        @item-click="handleNavClick"
      />
    </template>

    <!-- Default slot = ContentArea -->
    <slot />
  </AppLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { AppLayout, SidebarLayout, TopBar } from '@zidney/ui-system'
import { MODULE_LABELS } from '@zidney/types'
import { useContextStore } from '../stores/context'

const contextStore = useContextStore()
const router = useRouter()
const route = useRoute()

const workspaceName = computed(
  () => contextStore.context?.workspace_slug ?? 'Backoffice'
)

// Build nav items from enabled_modules — NO hardcoded module list
const navItems = computed(() =>
  contextStore.enabledModules.map((mod) => ({
    id: mod,
    label: MODULE_LABELS[mod]?.en ?? mod,
    show: true,
  }))
)

const activeNavItem = computed(
  () => (route.meta.requiredModule as string) ?? ''
)

function handleNavClick(item: { id: string }) {
  router.push({ name: item.id.toLowerCase() })
}
</script>
```

---

### FE-05: Workspace Unavailable Screen

**File:** `apps/backoffice/src/views/WorkspaceUnavailable.vue`

**Purpose:** Renders a neutral "Workspace unavailable" screen. Reads `code` from route query params to select the appropriate variant. Never branches on HTTP status code alone (per FR-02.8).

```vue
<!-- apps/backoffice/src/views/WorkspaceUnavailable.vue -->
<template>
  <div
    class="flex flex-col items-center justify-center min-h-screen text-center p-8"
  >
    <h1 class="text-2xl font-semibold text-gray-900 mb-2">{{ heading }}</h1>
    <p class="text-gray-500">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const code = computed(() => (route.query.code as string) ?? '')

const heading = computed(() => {
  switch (code.value) {
    case 'LICENSE_SOFT_LOCKED':
      return 'Workspace Suspended'
    case 'LICENSE_ARCHIVED':
      return 'Workspace Archived'
    case 'WORKSPACE_NOT_FOUND':
      return 'Workspace Not Found'
    default:
      return 'Workspace Unavailable'
  }
})

const message = computed(() => {
  switch (code.value) {
    case 'LICENSE_SOFT_LOCKED':
      return 'This workspace has been temporarily suspended. Please contact support.'
    case 'LICENSE_ARCHIVED':
      return 'This workspace has been permanently archived.'
    case 'WORKSPACE_NOT_FOUND':
      return 'The workspace you are looking for does not exist.'
    default:
      return 'This workspace is currently unavailable.'
  }
})
</script>
```

---

## Packages Layer

### PKG-01: `packages/types` — New Tenant RBAC Types

**New file:** `packages/types/src/tenant-rbac.ts`  
**Content:** Full definition in `data-model.md` (section "Type Definitions").

**Summary of additions:**

- `ActionEnum` — `view | create | edit | delete`
- `TenantRBACPermission` — `{ module: Module, action: ActionEnum }`
- `BackofficeContext` — runtime context shape
- `StaffUserContext` — JWT-derived staff user shape set in Hono context

**Update `packages/types/src/index.ts`:**

```typescript
export * from './tenant-rbac'
```

### PKG-02: `packages/ui-system` — No New Components Required

`AppLayout.vue`, `SidebarLayout.vue`, and `TopBar.vue` already exist with the required API. No new components needed for STAGE_17. `ContentArea` is served by `AppLayout`'s default slot.

If STAGE_16 is incomplete and these components are missing, STAGE_17 UI work must be blocked pending that dependency.

---

## Error Code Registry

| Code                          | HTTP | Trigger                                             |
| ----------------------------- | ---- | --------------------------------------------------- |
| `LICENSE_SOFT_LOCKED`         | 423  | Workspace license is SOFT_LOCKED                    |
| `LICENSE_ARCHIVED`            | 403  | Workspace license is ARCHIVED                       |
| `WORKSPACE_NOT_FOUND`         | 404  | Workspace slug cannot be resolved                   |
| `MODULE_NOT_LICENSED`         | 403  | Module not in `enabled_modules`                     |
| `RBAC_PERMISSION_DENIED`      | 403  | Staff user lacks required role+action               |
| `UNAUTHORIZED`                | 401  | Missing or invalid JWT                              |
| `TOKEN_VERSION_MISMATCH`      | 401  | JWT `token_version` does not match DB value         |
| `WORKSPACE_MISMATCH`          | 401  | JWT `workspace_id` ≠ resolved tenant `workspace_id` |
| `SCHEMA_VERSION_INCOMPATIBLE` | 426  | Tenant schema_version incompatible with API         |

All responses use the standard error contract:

```json
{
  "success": false,
  "data": null,
  "error": { "code": "ERROR_CODE", "message": "Human-readable message" }
}
```

---

## Structured Logging Specification

**Mandatory fields on every Backoffice log entry:**

| Field            | Type                  | Source                                                   |
| ---------------- | --------------------- | -------------------------------------------------------- |
| `workspace_slug` | string                | Tenant context                                           |
| `workspace_id`   | string                | Tenant context                                           |
| `correlation_id` | string                | Correlation ID middleware                                |
| `route_name`     | string                | Route descriptor (e.g. `GET /api/v1/backoffice/context`) |
| `level`          | `info`/`warn`/`error` | Logger                                                   |
| `timestamp`      | ISO 8601              | Logger (server time)                                     |
| `service`        | `"backoffice"`        | Logger constructor                                       |

**Additional field on authenticated requests:**

| Field     | Type   | Source                                                |
| --------- | ------ | ----------------------------------------------------- |
| `user_id` | string | `staff_user` context set by Authentication middleware |

**Forbidden:** `console.log`, `console.error`, `console.warn`. All logging through `@zidney/logger`.

---

## Transaction Boundaries

| Operation                        | Transaction             | Idempotent                             | Failure Behavior                                 |
| -------------------------------- | ----------------------- | -------------------------------------- | ------------------------------------------------ |
| RBAC migration                   | `BEGIN`/`COMMIT` DDL    | Yes (IF NOT EXISTS)                    | `ROLLBACK`; worker retries 3×; DLQ on exhaustion |
| `GET /api/v1/backoffice/context` | No transaction          | N/A                                    | Stateless read; no state mutation                |
| WebSocket handshake              | No transaction          | Yes (one-connection-per-user enforced) | Refuse duplicate; log and close                  |
| RBAC permission check            | No transaction (SELECT) | N/A                                    | Read-only; 403 on denied                         |
| Module guard check               | No transaction          | N/A                                    | 403 on disabled module                           |

---

## Testing Strategy

### Unit Tests

**File locations:** `tests/unit/backoffice/`

| Test                                                   | File                    | Coverage        |
| ------------------------------------------------------ | ----------------------- | --------------- |
| License gate: all 4 status values → correct HTTP codes | `license-gate.test.ts`  | FR-02.1–FR-02.4 |
| Module visibility filter: disabled modules removed     | `module-guard.test.ts`  | FR-03.1–FR-03.5 |
| RBAC permission check: role+action → 403/200           | `rbac-guard.test.ts`    | FR-05.4–FR-05.5 |
| Token workspace_id mismatch → 401                      | `auth-boundary.test.ts` | FR-06.3, US-04  |
| Token version mismatch → 401                           | `auth-boundary.test.ts` | FR-06.5, US-04  |
| BackofficeContext type: all required fields present    | `context-types.test.ts` | FR-01.1         |

### Integration Tests

**File locations:** `tests/integration/backoffice/`

| Test                                                                                       | Coverage         |
| ------------------------------------------------------------------------------------------ | ---------------- |
| Full chain: ACTIVE license → GET /api/v1/backoffice/context → 200                          | FR-01, FR-02.1   |
| Full chain: SOFT_LOCKED license → 423 with `LICENSE_SOFT_LOCKED` code                      | FR-02.2, FR-02.7 |
| Full chain: ARCHIVED license → 403 with `LICENSE_ARCHIVED` code                            | FR-02.3, FR-02.7 |
| Unknown workspace slug → 404 with `WORKSPACE_NOT_FOUND` code                               | FR-02.4          |
| Token from workspace A presented to workspace B → 401                                      | FR-06.3, AC-08   |
| Request to disabled module endpoint → 403 with `MODULE_NOT_LICENSED`                       | FR-03.3, AC-02   |
| Authenticated request → log contains workspace_slug, workspace_id, correlation_id, user_id | FR-09.1, FR-09.2 |
| WebSocket handshake: ACTIVE license → connection accepted                                  | FR-08.1–FR-08.3  |
| WebSocket handshake: SOFT_LOCKED license → connection refused                              | FR-08.2, AC-10   |
| Staff user missing permission → POST returns 403 with `RBAC_PERMISSION_DENIED`             | FR-05.5, AC-03   |
| Staff user with permission → POST returns 200                                              | FR-05.5, AC-03   |

### Migration Tests

**File locations:** `tests/unit/migrations/`

| Test                                                                        | Coverage                       |
| --------------------------------------------------------------------------- | ------------------------------ |
| All 4 RBAC tables created after migration run                               | AC-09                          |
| All 6 indexes present after migration run                                   | data-model.md — index strategy |
| Unique constraints enforced on `role_permissions.(role_id, module, action)` | Data model                     |
| Unique constraints enforced on `staff_user_roles.(staff_user_id, role_id)`  | Data model                     |
| Migration idempotent (safe to run twice)                                    | FR-05.7                        |

### Isolation Tests

**File locations:** `tests/integration/isolation/`

| Test                                              | Coverage       |
| ------------------------------------------------- | -------------- |
| No Backoffice handler imports `master_db` pool    | AC-05, FR-10.1 |
| No cross-tenant DB query from Backoffice handlers | FR-10.2        |

---

## File Delivery Checklist

### API (`apps/api/src/`)

| File                                                        | Action     | Description                                                   |
| ----------------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| `db/tenant/migrations/20260228_001_tenant_rbac_skeleton.ts` | **CREATE** | RBAC DDL migration (4 tables + 6 indexes, single transaction) |
| `routes/backoffice/context.ts`                              | **CREATE** | `GET /api/v1/backoffice/context` handler                      |
| `routes/backoffice/ws.ts`                                   | **CREATE** | `GET /ws/backoffice` WebSocket handler                        |
| `middleware/backoffice-rbac-guard.ts`                       | **CREATE** | Per-route RBAC permission guard middleware                    |
| `middleware/backoffice-module-guard.ts`                     | **CREATE** | Module-enabled gate middleware                                |
| `app.ts`                                                    | **EXTEND** | Mount backoffice routes + middleware chain                    |

### Frontend (`apps/backoffice/src/`)

| File                                 | Action     | Description                             |
| ------------------------------------ | ---------- | --------------------------------------- |
| `package.json`                       | **CREATE** | Vue 3 + Vite project configuration      |
| `vite.config.ts`                     | **CREATE** | Vite build config                       |
| `src/main.ts`                        | **CREATE** | App entry point                         |
| `src/App.vue`                        | **CREATE** | Root component                          |
| `src/router/index.ts`                | **CREATE** | Vue Router with license + module guards |
| `src/stores/context.ts`              | **CREATE** | Pinia BackofficeContext store           |
| `src/layouts/BackofficeLayout.vue`   | **CREATE** | ui-system composition layer             |
| `src/views/WorkspaceUnavailable.vue` | **CREATE** | License block screen                    |
| `src/views/Dashboard.vue`            | **CREATE** | Placeholder landing page                |

### Packages

| File                                | Action     | Description                                                                   |
| ----------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| `packages/types/src/tenant-rbac.ts` | **CREATE** | `ActionEnum`, `TenantRBACPermission`, `BackofficeContext`, `StaffUserContext` |
| `packages/types/src/index.ts`       | **EXTEND** | Add `export * from './tenant-rbac'`                                           |

---

## Constraints Enforcement (Hard Rules)

| Rule                                        | Enforcement                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| NO master_db access in Backoffice           | Static analysis + isolation integration test                                         |
| NO hardcoded module lists                   | Code review: no string literals for module names in layout or router                 |
| NO business logic in bootstrap              | Scope limited to middleware, context injection, layout shell                         |
| All DB writes transactional                 | Migration: `BEGIN`/`COMMIT`; no standalone INSERT/UPDATE in this stage               |
| Database-per-tenant preserved               | All Backoffice queries use `tenant.pool`; no global DB singleton                     |
| License middleware before any route handler | Middleware registration order enforced in `app.ts`                                   |
| Server-authoritative time only              | All `created_at`/`updated_at` use `DEFAULT NOW()` in SQL; client timestamps rejected |
| Structured logging only                     | `@zidney/logger` everywhere; no `console.*`                                          |
| `packages/ui-system` components only        | No new parallel component implementations in `apps/backoffice/`                      |

---

## Architecture Decisions Summary

| Decision                                | Choice                                                                          | Rationale                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| RBAC middleware registration            | Separate `MiddlewareHandler` factory, registered per-route after Authentication | Per spec FR-05.8; allows per-route opt-in to specific module+action                          |
| License polling for WebSocket           | `setInterval` at `WS_LICENSE_POLL_INTERVAL_MS`                                  | Event-bus push deferred per spec clarification; polling is simpler and sufficient            |
| Migration pattern                       | Raw `PoolClient` with `BEGIN`/`COMMIT` SQL                                      | Matches existing `20260217_*` migrations; no Drizzle ORM at tenant layer                     |
| Module navigation                       | `SidebarLayout` items built from `enabledModules` via `MODULE_LABELS`           | No hardcoded nav entries; adding a module to license automatically adds it                   |
| Context initialization                  | Single `GET /api/v1/backoffice/context` on app mount                            | Eliminates multiple API calls on initial load; context is authoritative for session          |
| Content area                            | `AppLayout` default slot used as content area                                   | No new `ContentArea` component needed; `SidebarLayout` already provides this via `AppLayout` |
| `staff_users.password_hash` column name | `password_hash` (matches `20260217_001` pattern)                                | Consistency with existing tenant auth migration naming                                       |
| Backoffice SPA error branching          | Branch on `error.code` field, not HTTP status code                              | Per FR-02.8; typed codes provide unambiguous UI routing                                      |
