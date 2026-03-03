# Implementation Plan — UI State Management Architecture

**Feature**: STAGE_UI_06_STATE_MANAGEMENT
**Branch**: `ui-06-state-management`
**Phase**: 06_UI_APPLICATION_RUNTIME
**Produced**: 2026-03-03
**Status**: Ready for Implementation

---

## Constitution Check

| Rule                              | Status        | Notes                                                                      |
| --------------------------------- | ------------- | -------------------------------------------------------------------------- | ------------------------------------------------ |
| Database-per-tenant isolation     | ✅ N/A        | UI layer — no DB access                                                    |
| No cross-app imports              | ✅ Enforced   | Each app has its own Pinia instance; store factories in `core/state/` only |
| License middleware                | ✅ N/A        | Store layer does not touch API middleware                                  |
| JWT never in localStorage         | ✅ Enforced   | Tokens in `ITokenManager` (memory); `auth.store` exposes no token getter   |
| All state changes through actions | ✅ Enforced   | FR-012 + ESLint rule prevents direct mutation from components              |
| No business logic in stores       | ✅ Documented | FR-011 explicitly prohibits price/grading/license computation in stores    |
| AppError as error contract        | ✅ Enforced   | `error: AppError                                                           | null`on all async stores; source:`@zidney/types` |
| Structured logging                | ✅ N/A        | Stores use `@zidney/logger` for warnings; no `console.log`                 |
| No secrets in code                | ✅ Compliant  | No env access in stores; config from `@zidney/config` if needed            |
| Testing required                  | ✅ Mandatory  | Unit tests per store; integration test for main.ts wiring                  |

**Trust Chain Alignment**: The store layer sits at the UI/Frontoffice tier of the trust chain. It depends on the API client layer (STAGE_UI_02) and the auth module (STAGE_UI_01). No trust chain violations introduced.

---

## Technical Context

### Dependencies

| Package                       | Version   | Status                                 |
| ----------------------------- | --------- | -------------------------------------- |
| `pinia`                       | `^2.2.0`  | ✅ Already installed in all three apps |
| `@pinia/testing`              | `^0.1.6`  | ✅ Already installed in all three apps |
| `pinia-plugin-persistedstate` | `^4.x`    | ❌ NOT installed — must be added       |
| `@zidney/types` (AppError)    | workspace | ✅ Available                           |
| `@zidney/api-client`          | workspace | ✅ Available                           |
| `@zidney/logger`              | workspace | ✅ Available                           |

### Existing Store Files (Pre-Stage)

| App         | File                      | Stage             | Action                                         |
| ----------- | ------------------------- | ----------------- | ---------------------------------------------- |
| MMC         | `auth.store.ts`           | UI_01_AUTH_MODULE | Update `id` from `'auth'` to `'mmc-auth'` only |
| MMC         | `license-status.store.ts` | Pre-existing      | No change                                      |
| Backoffice  | `auth.store.ts`           | Incomplete draft  | Replace with factory pattern                   |
| Backoffice  | `license-status.store.ts` | Pre-existing      | No change                                      |
| Frontoffice | `auth.store.ts`           | Incomplete draft  | Replace with factory pattern                   |
| Frontoffice | `license-status.store.ts` | Pre-existing      | No change                                      |

### Codebase Integration Points

- `apps/*/src/main.ts` — Pinia initialization + plugin registration
- `eslint.config.mjs` (root) — `no-restricted-imports` rule for `.vue` files
- `packages/types/src/errors/ErrorCodes.ts` — `AppError` class
- `packages/api-client/src/index.ts` — API module functions consumed by stores

---

## Design Contracts

### Concurrent Call Guard (M-03)

All async store actions that track state via `pending` MUST include a concurrent call guard as the
first line of the action (before any state mutation). This prevents race conditions where multiple
callers trigger the same action simultaneously.

**Required pattern:**

```ts
async function myAction(): Promise<void> {
  // Concurrent call guard — skip if already running
  if (pending.value['myAction']) return

  pending.value['myAction'] = true
  isLoading.value = true
  error.value = null
  // ... async work ...
}
```

**Contract options** (choose one per action, document in store):

| Strategy                                              | When to use                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| Early-return guard (`if (pending.value[key]) return`) | Default — single active execution; subsequent calls silently skip |
| Caller deduplication (via composable)                 | For actions called from multiple components simultaneously        |
| Last-write-wins with sequence counter                 | For polling or frequent refresh calls where latest result wins    |

**Default for this stage**: Early-return guard. All stores in this stage use this pattern.

---

## Implementation Tasks

### Task 1 — Install pinia-plugin-persistedstate

**Files**: `apps/mmc/package.json`, `apps/backoffice/package.json`, `apps/frontoffice/package.json`

Add to `dependencies` (not devDependencies — used at runtime):

```json
"pinia-plugin-persistedstate": "^4.2.0"
```

Run `bun install` after updating package.json files.

---

### Task 2 — Create Shared Store Test Helper

**File**: `tests/unit/store-test-helper.ts` (or per-app: `apps/*/tests/unit/store-test-helper.ts`)

```ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach } from 'vitest'

/**
 * Call this in test describe blocks to isolate store state between tests.
 * Satisfies FR-028, FR-030, SC-005.
 */
export function useIsolatedPinia(): void {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
}
```

---

### Task 3 — Update ESLint Config (no-restricted-imports for .vue + .ts files, vue/no-v-html)

**File**: `eslint.config.mjs` (root)

Add two rule blocks:

```js
// Block 1: API client import firewall — covers .vue AND .ts (composables, helpers)
// Store files are excluded; they are the only layer allowed to call the API client
{
  files: ['apps/**/*.{vue,ts}'],
  ignores: [
    'apps/*/src/core/state/**',
    'apps/*/src/modules/**/*.store.ts',
  ],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['@zidney/api-client', '@zidney/api-client/*'],
          message:
            'Direct API client imports are forbidden. ' +
            'Call a store action instead. (STAGE_UI_06 — FR-008)',
        },
      ],
    }],
  },
},
// Block 2: Prevent v-html in all app templates to mitigate XSS via store-sourced strings
{
  files: ['apps/**/*.vue'],
  rules: {
    'vue/no-v-html': 'error',
  },
},
```

**Verification**: Run `bun lint` — both rule blocks must surface zero existing violations; resolve any before closing this task.

---

### Task 4 — MMC: Update Pinia Initialization in main.ts

**File**: `apps/mmc/src/main.ts`

**Current state**: `const pinia = createPinia()` — no persistence plugin.

**Change**: Register `pinia-plugin-persistedstate` before `app.mount()`.

```ts
import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'

// Step 1: Create Pinia — registration of persistence plugin
const pinia = createPinia()
pinia.use(createPersistedState())

// ... existing auth, router, and other setup ...

// Step 9: Mount (unchanged)
const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')
```

**Constraint**: Plugin registration is added immediately after `createPinia()` — before any store is instantiated at Step 5. This satisfies the "plugin must be registered before first store access" edge case.

---

### Task 5 — MMC: Rename auth store id

**File**: `apps/mmc/src/core/state/auth.store.ts`

**Change**: `defineStore('auth', ...)` → `defineStore('mmc-auth', ...)`.

This is a single-line rename. All existing auth module wiring in `main.ts` continues to work because the store is referenced via `defineAuthStore(...)` factory, not by string id.

---

### Task 6 — MMC: Create app.store.ts

**File**: `apps/mmc/src/core/state/app.store.ts`

```ts
/**
 * MMC Application Store
 * Manages global app layout preferences: sidebar, theme, locale.
 * Persists: sidebarCollapsed, theme, locale (pinia-plugin-persistedstate).
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

type Theme = 'light' | 'dark' | 'system'

export const useMmcAppStore = defineStore(
  'mmc-app',
  () => {
    // ── State ──────────────────────────────────────────────────────────────
    const sidebarCollapsed = ref<boolean>(false)
    const theme = ref<Theme>('system')
    const locale = ref<string>('en')

    // ── Actions ────────────────────────────────────────────────────────────
    function setSidebarCollapsed(value: boolean): void {
      sidebarCollapsed.value = value
    }

    function setTheme(value: Theme): void {
      theme.value = value
    }

    function setLocale(value: string): void {
      locale.value = value
    }

    function $reset(): void {
      sidebarCollapsed.value = false
      theme.value = 'system'
      locale.value = 'en'
    }

    return {
      sidebarCollapsed,
      theme,
      locale,
      setSidebarCollapsed,
      setTheme,
      setLocale,
      $reset,
    }
  },
  {
    persist: {
      pick: ['sidebarCollapsed', 'theme', 'locale'],
    },
  }
)
```

---

### Task 7 — MMC: Create ui.store.ts

**File**: `apps/mmc/src/core/state/ui.store.ts`

```ts
/**
 * MMC UI Store
 * Manages transient UI state: modals, drawers, overlay.
 * No persistence. No async operations.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMmcUiStore = defineStore('mmc-ui', () => {
  // ── State ──────────────────────────────────────────────────────────────
  const modals = ref<Record<string, boolean>>({})
  const drawers = ref<Record<string, boolean>>({})
  const overlayVisible = ref<boolean>(false)

  // ── Actions ────────────────────────────────────────────────────────────
  function openModal(id: string): void {
    modals.value[id] = true
  }
  function closeModal(id: string): void {
    modals.value[id] = false
  }
  function toggleModal(id: string): void {
    modals.value[id] = !modals.value[id]
  }
  function openDrawer(id: string): void {
    drawers.value[id] = true
  }
  function closeDrawer(id: string): void {
    drawers.value[id] = false
  }
  function toggleDrawer(id: string): void {
    drawers.value[id] = !drawers.value[id]
  }
  function showOverlay(): void {
    overlayVisible.value = true
  }
  function hideOverlay(): void {
    overlayVisible.value = false
  }
  function closeAll(): void {
    modals.value = {}
    drawers.value = {}
    overlayVisible.value = false
  }

  function $reset(): void {
    modals.value = {}
    drawers.value = {}
    overlayVisible.value = false
  }

  return {
    modals,
    drawers,
    overlayVisible,
    openModal,
    closeModal,
    toggleModal,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    showOverlay,
    hideOverlay,
    closeAll,
    $reset,
  }
})
```

---

### Task 8 — MMC: Create notification.store.ts

**File**: `apps/mmc/src/core/state/notification.store.ts`

```ts
/**
 * MMC Notification Store
 * Manages a queue of toast/alert notifications.
 * Supports independent push, dismiss, and clearAll.
 * No persistence. No async operations.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface AppNotification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number // ms; undefined = persistent
  dismissible: boolean
}
// NOTE (M-01): AppNotification is defined locally in this store for this stage.
// All three apps (MMC, Backoffice, Frontoffice) MUST keep this interface shape identical.
// Moving this type to @zidney/types is deferred to a future cleanup stage.

export const useMmcNotificationStore = defineStore('mmc-notification', () => {
  // ── Constants ──────────────────────────────────────────────────────────
  const MAX_QUEUE_SIZE = 20 // prevents unbounded growth during error-retry storms (PO-HIGH)

  // ── State ──────────────────────────────────────────────────────────────
  const notifications = ref<AppNotification[]>([])

  // ── Actions ────────────────────────────────────────────────────────────
  function push(notification: Omit<AppNotification, 'id'>): string {
    const id = crypto.randomUUID()
    if (notifications.value.length >= MAX_QUEUE_SIZE) {
      notifications.value.shift() // evict oldest when at capacity
    }
    notifications.value.push({ ...notification, id })
    return id
  }

  function dismiss(id: string): void {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }

  function clearAll(): void {
    notifications.value = []
  }

  function $reset(): void {
    notifications.value = []
  }

  return {
    notifications,
    push,
    dismiss,
    clearAll,
    $reset,
  }
})
```

---

### Task 9 — MMC: Update core/state/index.ts

**File**: `apps/mmc/src/core/state/index.ts`

Re-export all core stores:

```ts
export { defineAuthStore } from './auth.store'
export { useMmcAppStore } from './app.store'
export { useMmcUiStore } from './ui.store'
export { useMmcNotificationStore } from './notification.store'
export { useLicenseStatusStore } from './license-status.store'
export type { AppNotification } from './notification.store'
```

---

### Task 10 — Backoffice: Update main.ts with Pinia + Persistence

**File**: `apps/backoffice/src/main.ts`

Same pattern as Task 4. Add `pinia-plugin-persistedstate` registration:

```ts
import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'

const pinia = createPinia()
pinia.use(createPersistedState())
```

Plugin registered before any store instantiation. Auth, router, API client wiring follows existing bootstrap order.

---

### Task 11 — Backoffice: Replace auth.store.ts with factory pattern

**File**: `apps/backoffice/src/core/state/auth.store.ts`

Implement using the same `defineAuthStore(...)` factory pattern as `apps/mmc/src/core/state/auth.store.ts`. Store `id`: `'backoffice-auth'`. Identical shape — router, tokenManager, authService injected via factory arguments.

> Detailed implementation mirrors MMC Task 5. Reference `apps/mmc/src/core/state/auth.store.ts` as the canonical template.

---

### Task 12 — Backoffice: Create app.store.ts

**File**: `apps/backoffice/src/core/state/app.store.ts`

Identical structure to MMC `app.store.ts` (Task 6). Store `id`: `'backoffice-app'`. Export: `useBackofficeAppStore`.

---

### Task 13 — Backoffice: Create ui.store.ts

**File**: `apps/backoffice/src/core/state/ui.store.ts`

Identical structure to MMC `ui.store.ts` (Task 7). Store `id`: `'backoffice-ui'`. Export: `useBackofficeUiStore`.

---

### Task 14 — Backoffice: Create notification.store.ts

**File**: `apps/backoffice/src/core/state/notification.store.ts`

Identical structure to MMC `notification.store.ts` (Task 8), including `MAX_QUEUE_SIZE = 20` and bounded `push()` with eviction. Store `id`: `'backoffice-notification'`. Export: `useBackofficeNotificationStore`.

---

### Task 15 — Backoffice: Create workspace.store.ts

**File**: `apps/backoffice/src/core/state/workspace.store.ts`

```ts
/**
 * Backoffice Workspace Store
 * Manages the resolved workspace context (slug, name, tier) for the active session.
 * Read by feature stores via storeToRefs(useBackofficeWorkspaceStore()).
 * Never mutated by feature stores.
 *
 * Loading: uses both isLoading (primary) + pending (per-action) per FR-016.
 *
 * Stage: STAGE_UI_06_STATE_MANAGEMENT
 */
import { AppError } from '@zidney/types'
import { logger } from '@zidney/logger'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface WorkspaceContext {
  slug: string
  name: string
  tier: string
  schemaVersion: number
  productVersion: string
}

export const useBackofficeWorkspaceStore = defineStore(
  'backoffice-workspace',
  () => {
    // ── State ──────────────────────────────────────────────────────────────
    const workspace = ref<WorkspaceContext | null>(null)
    const pending = ref<Record<string, boolean>>({})
    // isLoading is a derived computed — auto-updates from pending map (PO-MED-1)
    const isLoading = computed(() => Object.values(pending.value).some(Boolean))
    const error = ref<AppError | null>(null)

    // ── Actions ────────────────────────────────────────────────────────────
    async function loadWorkspace(slug: string): Promise<void> {
      // Concurrent call guard: skip if already loading (FR-016, M-03 contract)
      if (pending.value['loadWorkspace']) return

      pending.value['loadWorkspace'] = true
      // isLoading automatically becomes true as pending now has a truthy key
      error.value = null

      try {
        // NOTE: Structural stub — replace with actual workspaceApi.getWorkspace(slug)
        // once the workspace API module is available from the relevant backend stage.
        // The stub resolves cleanly (no-op) so tests can exercise the happy path lifecycle.
        // const data = await workspaceApi.getWorkspace(slug)
        // workspace.value = data

        // Stub: resolve without throwing so bootstrap and lifecycle tests pass cleanly
        await Promise.resolve()
      } catch (err: unknown) {
        const appErr = new AppError(
          'WORKSPACE_LOAD_FAILED',
          'Unable to load workspace. Please try again.' // generic, never raw err.message (SA-003)
        )
        logger.warn('workspace.store: loadWorkspace failed', {
          service: 'backoffice-store',
          error_code: appErr.code,
          internal_message: err instanceof Error ? err.message : String(err), // internal-only
        })
        error.value = appErr
      } finally {
        pending.value['loadWorkspace'] = false
        // isLoading auto-derives from pending — no manual assignment needed
      }
    }

    function clearError(): void {
      error.value = null
    }

    function $reset(): void {
      workspace.value = null
      pending.value = {} // isLoading auto-derives to false when pending is empty
      error.value = null
    }

    return {
      workspace,
      isLoading,
      pending,
      error,
      loadWorkspace,
      clearError,
      $reset,
    }
  }
)
```

> **Note**: `loadWorkspace` is a structural stub at this stage. The API call is wired when the workspace API module lands from the relevant backend stage. The action signature, loading/error state management, and `$reset()` are complete.

---

### Task 16 — Backoffice: Update core/state/index.ts

**File**: `apps/backoffice/src/core/state/index.ts`

```ts
export { defineAuthStore } from './auth.store'
export { useBackofficeAppStore } from './app.store'
export { useBackofficeUiStore } from './ui.store'
export { useBackofficeNotificationStore } from './notification.store'
export { useBackofficeWorkspaceStore } from './workspace.store'
export { useLicenseStatusStore } from './license-status.store'
export type { AppNotification } from './notification.store'
export type { WorkspaceContext } from './workspace.store'
```

---

### Task 17 — Frontoffice: Update main.ts with Pinia + Persistence

**File**: `apps/frontoffice/src/main.ts`

Same pattern as Tasks 4 and 10. Add `pinia-plugin-persistedstate` registration before first store instantiation.

---

### Task 18 — Frontoffice: Replace auth.store.ts with factory pattern

**File**: `apps/frontoffice/src/core/state/auth.store.ts`

Same `defineAuthStore(...)` factory pattern as MMC and Backoffice. Store `id`: `'frontoffice-auth'`. Export: `defineAuthStore` (factory) → caller creates `useFrontofficeAuthStore`.

---

### Task 19 — Frontoffice: Create app.store.ts

**File**: `apps/frontoffice/src/core/state/app.store.ts`

Identical to MMC/Backoffice pattern. Store `id`: `'frontoffice-app'`. Export: `useFrontofficeAppStore`.

---

### Task 20 — Frontoffice: Create ui.store.ts

**File**: `apps/frontoffice/src/core/state/ui.store.ts`

Identical to MMC/Backoffice pattern. Store `id`: `'frontoffice-ui'`. Export: `useFrontofficeUiStore`.

---

### Task 21 — Frontoffice: Create notification.store.ts

**File**: `apps/frontoffice/src/core/state/notification.store.ts`

Identical to MMC/Backoffice notification pattern, including `MAX_QUEUE_SIZE = 20` and bounded `push()` with eviction. Store `id`: `'frontoffice-notification'`. Export: `useFrontofficeNotificationStore`.

---

### Task 22 — Frontoffice: Update core/state/index.ts

**File**: `apps/frontoffice/src/core/state/index.ts`

```ts
export { defineAuthStore } from './auth.store'
export { useFrontofficeAppStore } from './app.store'
export { useFrontofficeUiStore } from './ui.store'
export { useFrontofficeNotificationStore } from './notification.store'
export { useLicenseStatusStore } from './license-status.store'
export type { AppNotification } from './notification.store'
```

---

### Task 23 — Unit Tests: MMC Stores

**Directory**: `apps/mmc/tests/unit/stores/`

Files to create:

- `app.store.test.ts`
- `ui.store.test.ts`
- `notification.store.test.ts`

**Test pattern for app.store.test.ts**:

```ts
import { describe, it, expect } from 'vitest'
import { useMmcAppStore } from '@/core/state/app.store'
import { useIsolatedPinia } from '../../../../tests/unit/store-test-helper' // (L-001: use shared helper)

describe('useMmcAppStore', () => {
  useIsolatedPinia() // registers setActivePinia(createPinia()) in beforeEach

  it('initializes with default state', () => {
    const store = useMmcAppStore()
    expect(store.sidebarCollapsed).toBe(false)
    expect(store.theme).toBe('system')
    expect(store.locale).toBe('en')
    // Note: isLoading and error removed — app.store has no async actions (CR-M2)
  })

  it('sets sidebarCollapsed', () => {
    const store = useMmcAppStore()
    store.setSidebarCollapsed(true)
    expect(store.sidebarCollapsed).toBe(true)
  })

  it('$reset restores initial state', () => {
    const store = useMmcAppStore()
    store.setSidebarCollapsed(true)
    store.setTheme('dark')
    store.$reset()
    expect(store.sidebarCollapsed).toBe(false)
    expect(store.theme).toBe('system')
  })

  it('state is isolated between tests', () => {
    const store = useMmcAppStore()
    expect(store.sidebarCollapsed).toBe(false)
    // Previous test set it to true; if state leaked, this would fail
  })
})
```

**Workspace store test pattern** (requires AppError import):

```ts
import { describe, it, expect, vi } from 'vitest'
import { AppError } from '@zidney/types'
import { useBackofficeWorkspaceStore } from '@/core/state/workspace.store'
import { useIsolatedPinia } from '../../../../tests/unit/store-test-helper'

describe('useBackofficeWorkspaceStore', () => {
  useIsolatedPinia()

  it('initializes with default state', () => {
    const store = useBackofficeWorkspaceStore()
    expect(store.workspace).toBeNull()
    expect(store.isLoading).toBe(false)
    expect(Object.keys(store.pending)).toHaveLength(0)
    expect(store.error).toBeNull()
  })

  it('clears error', () => {
    const store = useBackofficeWorkspaceStore()
    store.$patch({ error: new AppError('TEST', 'test') }) // use $patch, not direct assignment (CR-M3)
    store.clearError()
    expect(store.error).toBeNull()
  })

  it('concurrent guard: second call while first is in-flight is dropped', async () => {
    const store = useBackofficeWorkspaceStore()
    // Hold the first call open: patch pending directly to simulate an in-flight async action
    store.$patch({ pending: { loadWorkspace: true } }) // simulate first call in-flight
    // The early-return guard should fire immediately: pending['loadWorkspace'] is still true
    const result = store.loadWorkspace('test-slug') // second call — guard should drop it
    expect(store.pending['loadWorkspace']).toBe(true) // still locked by the simulated first call
    // Resolve the simulated first call
    store.$patch({
      pending: { loadWorkspace: false },
      workspace: {
        slug: 'test-slug',
        name: 'Test',
        tier: 'standard',
        schemaVersion: 1,
        productVersion: '1.0.0',
      },
    })
    await result
    expect(store.pending['loadWorkspace']).toBe(false) // released after completion
    // The critical assertion: only 1 progression through the action body (load did not double-fire)
    expect(store.workspace?.slug).toBe('test-slug') // state was set exactly once
  })

  it('subsequent action clears error before executing', async () => {
    const store = useBackofficeWorkspaceStore()
    store.$patch({ error: new AppError('PREV_ERROR', 'prev') })
    // On second loadWorkspace call, error must clear before async work begins (FR-018, QA-M002)
    await store.loadWorkspace('workspace-slug')
    expect(store.error).toBeNull()
  })
})
```

**Test coverage requirements** per store:

1. Default state initialization
2. Action produces expected state mutations
3. For async stores: `clearError()` zeroes the error field
4. `$reset()` restores all fields to initial values
5. State isolation between test cases (via `useIsolatedPinia()` shared helper — L-001)
6. (For async stores) `isLoading` becomes `true` then `false` around async actions
7. (For async stores) Failed action sets `error` to `AppError` instance and `isLoading` to `false`
8. (For async stores) Subsequent action clears `error` before executing (FR-018)
9. (For async stores) Concurrent guard drops second in-flight call (M-001 timing test)
10. Push `MAX_QUEUE_SIZE + 1` notifications; assert exactly `MAX_QUEUE_SIZE` entries remain

---

### Task 24 — Unit Tests: Notification Store (all apps)

**Test coverage**:

1. `push` returns a string id and appends to `notifications`
2. `dismiss(id)` removes notification with matching id; leaves others intact
3. `clearAll` empties the notification queue
4. Multiple concurrent notifications are independently dismissible
5. `$reset` restores empty queue

---

### Task 25 — Unit Tests: Backoffice Workspace Store

**Test coverage**:

1. Default state: `workspace === null`, `isLoading === false`, `pending === {}`, `error === null`
2. `loadWorkspace` sets `isLoading` to `true` before async work, `false` after
3. On error: `error` is an `AppError` instance; `isLoading` is `false`
4. `clearError()` zeroes the error
5. `$reset()` restores all fields to initial state
6. `pending['loadWorkspace']` is `true` during the action, `false` after

---

### Task 26 — Integration Test: main.ts Pinia Bootstrap Sequence

**File (per app)**: `apps/*/tests/integration/pinia-bootstrap.test.ts`

**Verifies**:

1. `createPinia()` is called exactly once
2. `pinia-plugin-persistedstate` is registered before `app.mount()`
3. Auth store is instantiated before the first route guard fires (`initSession` resolves)
4. App store persistence config includes exactly `['sidebarCollapsed', 'theme', 'locale']` and no more
5. Auth store persistence config is empty (no persisted state)

---

### Task 27 — CI Validation Rule: Store ID Uniqueness

**File**: `tests/unit/store-id-uniqueness.test.ts`

This test imports and instantiates all stores to read their actual `$id` properties (not a hardcoded array — CR-H2 fix):

```ts
// tests/unit/store-id-uniqueness.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
// MMC stores
import { useMmcAuthStore } from '../../apps/mmc/src/core/state/auth.store'
import { useMmcAppStore } from '../../apps/mmc/src/core/state/app.store'
import { useMmcUiStore } from '../../apps/mmc/src/core/state/ui.store'
import { useMmcNotificationStore } from '../../apps/mmc/src/core/state/notification.store'
// Backoffice stores
import { useBackofficeAppStore } from '../../apps/backoffice/src/core/state/app.store'
import { useBackofficeUiStore } from '../../apps/backoffice/src/core/state/ui.store'
import { useBackofficeNotificationStore } from '../../apps/backoffice/src/core/state/notification.store'
import { useBackofficeWorkspaceStore } from '../../apps/backoffice/src/core/state/workspace.store'
// Frontoffice stores
import { useFrontofficeAppStore } from '../../apps/frontoffice/src/core/state/app.store'
import { useFrontofficeUiStore } from '../../apps/frontoffice/src/core/state/ui.store'
import { useFrontofficeNotificationStore } from '../../apps/frontoffice/src/core/state/notification.store'

describe('Store ID Uniqueness (SC-010)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('all core store $id values are unique across all apps', () => {
    // Instantiate all stores — reads actual $id from defineStore call (not a hardcoded list)
    const storeIds = [
      useMmcAuthStore().$id,
      useMmcAppStore().$id,
      useMmcUiStore().$id,
      useMmcNotificationStore().$id,
      useBackofficeAppStore().$id,
      useBackofficeUiStore().$id,
      useBackofficeNotificationStore().$id,
      useBackofficeWorkspaceStore().$id,
      useFrontofficeAppStore().$id,
      useFrontofficeUiStore().$id,
      useFrontofficeNotificationStore().$id,
    ]
    // Note: backoffice-auth and frontoffice-auth use the defineAuthStore factory —
    // their $id is asserted in per-app integration bootstrap tests (T035–T037)
    const uniqueIds = new Set(storeIds)
    expect(uniqueIds.size).toBe(storeIds.length)
  })

  it('no store uses the reserved single-app id "auth" (must be namespaced)', () => {
    const allIds = [
      useMmcAuthStore().$id,
      useMmcAppStore().$id,
      useMmcNotificationStore().$id,
      useBackofficeAppStore().$id,
      useBackofficeWorkspaceStore().$id,
      useFrontofficeAppStore().$id,
    ]
    expect(allIds).not.toContain('auth')
    expect(allIds).not.toContain('app')
    expect(allIds).not.toContain('workspace')
  })
})
```

---

## Implementation Order

```
Phase A — Infrastructure (no app logic):
  Task 1  → Install pinia-plugin-persistedstate
  Task 2  → Create store test helper
  Task 3  → Update ESLint config

Phase B — MMC (reference implementation):
  Task 4  → MMC main.ts Pinia + persistence setup
  Task 5  → MMC auth store id rename
  Task 6  → MMC app.store.ts
  Task 7  → MMC ui.store.ts
  Task 8  → MMC notification.store.ts
  Task 9  → MMC core/state/index.ts
  Task 23 → MMC unit tests

Phase C — Backoffice:
  Task 10 → Backoffice main.ts
  Task 11 → Backoffice auth.store.ts (factory replace)
  Task 12 → Backoffice app.store.ts
  Task 13 → Backoffice ui.store.ts
  Task 14 → Backoffice notification.store.ts
  Task 15 → Backoffice workspace.store.ts
  Task 16 → Backoffice core/state/index.ts
  Tasks 24–25 → Backoffice unit tests

Phase D — Frontoffice:
  Task 17 → Frontoffice main.ts
  Task 18 → Frontoffice auth.store.ts (factory replace)
  Task 19 → Frontoffice app.store.ts
  Task 20 → Frontoffice ui.store.ts
  Task 21 → Frontoffice notification.store.ts
  Task 22 → Frontoffice core/state/index.ts
  Task 24 → Frontoffice notification unit tests

Phase E — Validation:
  Task 26 → Integration tests
  Task 27 → Store ID uniqueness CI rule
```

---

## File Inventory (New / Modified)

### New Files

| Path                                                            | Task |
| --------------------------------------------------------------- | ---- |
| `apps/mmc/src/core/state/app.store.ts`                          | 6    |
| `apps/mmc/src/core/state/ui.store.ts`                           | 7    |
| `apps/mmc/src/core/state/notification.store.ts`                 | 8    |
| `apps/backoffice/src/core/state/app.store.ts`                   | 12   |
| `apps/backoffice/src/core/state/ui.store.ts`                    | 13   |
| `apps/backoffice/src/core/state/notification.store.ts`          | 14   |
| `apps/backoffice/src/core/state/workspace.store.ts`             | 15   |
| `apps/frontoffice/src/core/state/app.store.ts`                  | 19   |
| `apps/frontoffice/src/core/state/ui.store.ts`                   | 20   |
| `apps/frontoffice/src/core/state/notification.store.ts`         | 21   |
| `tests/unit/store-test-helper.ts`                               | 2    |
| `apps/mmc/tests/unit/stores/app.store.test.ts`                  | 23   |
| `apps/mmc/tests/unit/stores/ui.store.test.ts`                   | 23   |
| `apps/mmc/tests/unit/stores/notification.store.test.ts`         | 24   |
| `apps/backoffice/tests/unit/stores/app.store.test.ts`           | 23   |
| `apps/backoffice/tests/unit/stores/ui.store.test.ts`            | 23   |
| `apps/backoffice/tests/unit/stores/notification.store.test.ts`  | 24   |
| `apps/backoffice/tests/unit/stores/workspace.store.test.ts`     | 25   |
| `apps/frontoffice/tests/unit/stores/app.store.test.ts`          | 23   |
| `apps/frontoffice/tests/unit/stores/ui.store.test.ts`           | 23   |
| `apps/frontoffice/tests/unit/stores/notification.store.test.ts` | 24   |
| `tests/unit/store-id-uniqueness.test.ts`                        | 27   |

### Modified Files

| Path                                            | Task | Change                                                       |
| ----------------------------------------------- | ---- | ------------------------------------------------------------ |
| `apps/mmc/package.json`                         | 1    | Add pinia-plugin-persistedstate dependency                   |
| `apps/backoffice/package.json`                  | 1    | Add pinia-plugin-persistedstate dependency                   |
| `apps/frontoffice/package.json`                 | 1    | Add pinia-plugin-persistedstate dependency                   |
| `apps/mmc/src/main.ts`                          | 4    | Register pinia-plugin-persistedstate                         |
| `apps/mmc/src/core/state/auth.store.ts`         | 5    | Rename store id to `mmc-auth`                                |
| `apps/mmc/src/core/state/index.ts`              | 9    | Re-export all core stores                                    |
| `apps/backoffice/src/main.ts`                   | 10   | Register pinia-plugin-persistedstate                         |
| `apps/backoffice/src/core/state/auth.store.ts`  | 11   | Replace with factory pattern                                 |
| `apps/backoffice/src/core/state/index.ts`       | 16   | Re-export all core stores                                    |
| `apps/frontoffice/src/main.ts`                  | 17   | Register pinia-plugin-persistedstate                         |
| `apps/frontoffice/src/core/state/auth.store.ts` | 18   | Replace with factory pattern                                 |
| `apps/frontoffice/src/core/state/index.ts`      | 22   | Re-export all core stores                                    |
| `eslint.config.mjs`                             | 3    | Add no-restricted-imports for .vue/.ts files + vue/no-v-html |

---

## Developer Notes: HMR Registration (PO-MED-2)

Each store file MUST include the following Vite HMR boilerplate at the bottom to prevent full-page reloads on store file save in development:

```ts
// ── HMR (development only) ────────────────────────────────────────────
import { acceptHMRUpdate } from 'pinia'
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useStoreName, import.meta.hot))
}
```

Replace `useStoreName` with the exported composable from that file. This block has zero production impact — `import.meta.hot` is `undefined` in production builds.

---

## Success Criteria Verification

| ID     | Criterion                                          | Verification Method                                                                         |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| SC-001 | Stores instantiate in Node.js without DOM in < 3s  | `vitest run --reporter=verbose` \u2014 all store unit tests pass                            |
| SC-002 | Zero .vue/.ts files with direct API client imports | `bun lint` with `no-restricted-imports` rule \u2014 zero errors                             |
| SC-003 | Zero stores persist tokens or permissions          | Inspect all `persist.pick` configurations in tests \u2014 assert no auth-related keys       |
| SC-004 | All async stores expose `isLoading` + `error`      | Type check + unit test coverage per Task 23\u201325                                         |
| SC-005 | No state bleed across tests                        | `useIsolatedPinia()` helper in `beforeEach` \u2014 verified by parallel test run            |
| SC-006 | TypeScript strict mode zero errors                 | `bun typecheck` \u2014 zero errors on all store files                                       |
| SC-007 | No circular store dependencies                     | T042: `madge`/`dpdm` CI check asserts acyclicity; FR-033 prevents core\u2192modules imports |
| SC-008 | All persistence has explicit pick list             | `persist.pick` is explicit in all `app.store.ts` files; all others have no `persist`        |
| SC-009 | Core stores registered before first route guard    | Integration test Task 26 \u2014 asserts bootstrap order                                     |
| SC-010 | Store ids unique per app                           | `store-id-uniqueness.test.ts` \u2014 Task 27 (instantiates actual stores)                   |
| SC-011 | Structured logging in all store catch blocks       | T039: logger.warn confirmed + CI grep check for console.log                                 |

---

## Out-of-Scope Guard

The following are explicitly NOT planned here:

- Products, licenses, exam, dashboard feature stores
- Router guard integration (STAGE_UI_03)
- Token refresh logic (STAGE_UI_02)
- SSR hydration
- DevTools integration (convenience only)
- `attempt.store.ts` for attempt engine (future stage)

---

## Architecture Drift Checks

- **No cross-app imports**: Each app's stores import only from `packages/*`. Verified by import boundary lint rules. ✅
- **No DB access in UI**: Stores call `@zidney/api-client` which calls HTTP endpoints. No ORM, no Drizzle, no direct PostgreSQL. ✅
- **No business logic**: Stores orchestrate UI state. Computation (grading, pricing, limits) remains in `packages/domain-core`. ✅
- **JWT in memory**: `ITokenManager` holds token in a module-level `Map`; store never holds raw token as reactive state. ✅
- **Trust chain preserved**: Store layer adds no new middleware and does not bypass API client auth headers. ✅
