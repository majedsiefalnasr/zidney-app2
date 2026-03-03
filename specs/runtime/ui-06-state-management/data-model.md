# Data Model — UI State Management Architecture

**Feature**: STAGE_UI_06_STATE_MANAGEMENT
**Branch**: `ui-06-state-management`
**Produced**: 2026-03-03
**Status**: Complete

---

## Overview

This file defines the TypeScript state shape for every core runtime store across all three Zidney frontend applications. These are the canonical interfaces that store implementations MUST conform to. Feature stores (products, exams, etc.) are out of scope for this stage.

All types reference `@zidney/types` for shared contracts. No business logic is encoded here — shapes represent UI-layer reactive state only.

---

## Shared Types

```ts
// Source: @zidney/types → packages/types/src/errors/ErrorCodes.ts
import type { AppError } from '@zidney/types'

// NOTE: AppNotification is defined locally in each app's notification.store.ts for this stage.
// A shared @zidney/types export is deferred to a future cleanup stage.
// All three apps MUST keep this interface shape identical.
// Source: local to each app's notification.store.ts
export interface AppNotification {
  id: string // uuid v4 — generated at push time
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number // ms; undefined = persistent until manually dismissed
  dismissible: boolean // default: true
}

// Authenticated user identity — unified across all three apps
export interface AuthUser {
  id: string
  email: string
  name: string
  role: string // app-specific role string (e.g. 'super_admin', 'instructor')
  avatarUrl?: string
}
```

---

## MMC Stores

### `mmc-auth` — `apps/mmc/src/core/state/auth.store.ts`

```ts
interface MmcAuthState {
  isAuthenticated: boolean // Whether a valid session is active
  user: AuthUser | null // Authenticated user identity; null when unauthenticated
  isLoading: boolean // True during initSession / login / logout / refresh
  authError: AppError | null // Error from last auth operation; null when none
  // NOTE: token is NOT a store state field.
  // It resides in an injected ITokenManager (in-memory only, not reactive).
  // The underlying STAGE_UI_01_AUTH_MODULE uses an AuthError subtype internally;
  // the public reactive field is typed as AppError | null for cross-store type safety.
}

interface MmcAuthActions {
  initSession(): Promise<void>
  /** @internal — MUST be called only from initSession() or refresh() auth flows. Never call from components or composables directly. (SA-006) */
  setSession(accessToken: string, profile: AuthUser): void
  refresh(): Promise<boolean>
  logout(): Promise<void>
  clearAuthError(): void
  expireSession(): Promise<void>
  $reset(): void
}
```

> **Note**: `auth.store.ts` in MMC is already implemented (STAGE_UI_01_AUTH_MODULE). This stage updates only its store `id` from `'auth'` → `'mmc-auth'` and documents compliance. No structural change to state shape.

---

### `mmc-app` — `apps/mmc/src/core/state/app.store.ts`

```ts
interface MmcAppState {
  sidebarCollapsed: boolean // Sidebar collapsed preference (PERSISTED)
  theme: 'light' | 'dark' | 'system' // Active UI theme (PERSISTED)
  locale: string // Active locale code, e.g. 'en', 'ar' (PERSISTED)
  // NOTE: No isLoading or error — this store has only synchronous actions (CR-M2)
}

interface MmcAppActions {
  setSidebarCollapsed(value: boolean): void
  setTheme(theme: MmcAppState['theme']): void
  setLocale(locale: string): void
  $reset(): void
}

// Persistence configuration:
// pick: ['sidebarCollapsed', 'theme', 'locale']
// storage: localStorage
```

---

### `mmc-ui` — `apps/mmc/src/core/state/ui.store.ts`

```ts
interface MmcUiState {
  // Modal registry: keyed by modal id string → open boolean
  modals: Record<string, boolean>
  // Drawer registry: keyed by drawer id string → open boolean
  drawers: Record<string, boolean>
  // Global overlay (e.g. full-screen loading shield)
  overlayVisible: boolean
}

interface MmcUiActions {
  openModal(id: string): void
  closeModal(id: string): void
  toggleModal(id: string): void
  openDrawer(id: string): void
  closeDrawer(id: string): void
  toggleDrawer(id: string): void
  showOverlay(): void
  hideOverlay(): void
  closeAll(): void // Close all modals + drawers; hide overlay
  $reset(): void
}

// No persistence. No isLoading/error (no async operations).
```

---

### `mmc-notification` — `apps/mmc/src/core/state/notification.store.ts`

```ts
interface MmcNotificationState {
  notifications: AppNotification[] // FIFO queue; all active notifications
}

interface MmcNotificationActions {
  push(notification: Omit<AppNotification, 'id'>): string // returns generated id
  dismiss(id: string): void
  clearAll(): void
  $reset(): void
}

// No persistence. No isLoading/error (all operations are synchronous).
```

---

## Backoffice Stores

### `backoffice-auth` — `apps/backoffice/src/core/state/auth.store.ts`

```ts
interface BackofficeAuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  isLoading: boolean
  // token in ITokenManager — not a store state field
  // authError is typed as AppError | null at the public state boundary.
  // The underlying auth module may use a subtype (AuthError extends AppError),
  // but the reactive state field is always AppError | null for cross-store safety.
  authError: AppError | null
}

interface BackofficeAuthActions {
  initSession(): Promise<void>
  /** @internal — MUST be called only from initSession() or refresh() auth flows. Never call from components or composables directly. (SA-006) */
  setSession(accessToken: string, profile: AuthUser): void
  refresh(): Promise<boolean>
  logout(): Promise<void>
  clearAuthError(): void
  expireSession(): Promise<void>
  $reset(): void
}
```

> Same factory pattern as MMC auth store (`defineAuthStore(...)`). Store `id`: `'backoffice-auth'`.

---

### `backoffice-app` — `apps/backoffice/src/core/state/app.store.ts`

```ts
interface BackofficeAppState {
  sidebarCollapsed: boolean // PERSISTED
  theme: 'light' | 'dark' | 'system' // PERSISTED
  locale: string // PERSISTED
  // NOTE: No isLoading or error — this store has only synchronous actions (CR-M2)
}

interface BackofficeAppActions {
  setSidebarCollapsed(value: boolean): void
  setTheme(theme: BackofficeAppState['theme']): void
  setLocale(locale: string): void
  $reset(): void
}

// pick: ['sidebarCollapsed', 'theme', 'locale']
```

---

### `backoffice-ui` — `apps/backoffice/src/core/state/ui.store.ts`

Same shape as `mmc-ui` above, store `id`: `'backoffice-ui'`.

```ts
interface BackofficeUiState {
  modals: Record<string, boolean>
  drawers: Record<string, boolean>
  overlayVisible: boolean
}

interface BackofficeUiActions {
  openModal(id: string): void
  closeModal(id: string): void
  toggleModal(id: string): void
  openDrawer(id: string): void
  closeDrawer(id: string): void
  toggleDrawer(id: string): void
  showOverlay(): void
  hideOverlay(): void
  closeAll(): void
  $reset(): void
}
```

---

### `backoffice-notification` — `apps/backoffice/src/core/state/notification.store.ts`

Same shape as `mmc-notification`, store `id`: `'backoffice-notification'`.

```ts
interface BackofficeNotificationState {
  notifications: AppNotification[]
}

interface BackofficeNotificationActions {
  push(notification: Omit<AppNotification, 'id'>): string
  dismiss(id: string): void
  clearAll(): void
  $reset(): void
}
```

---

### `backoffice-workspace` — `apps/backoffice/src/core/state/workspace.store.ts`

```ts
interface WorkspaceContext {
  slug: string // Immutable workspace identifier
  name: string // Display name
  tier: string // License tier/plan label
  schemaVersion: number // Active DB schema version
  productVersion: string // Active product version string
}

interface BackofficeWorkspaceState {
  workspace: WorkspaceContext | null // null until workspace is resolved
  // isLoading is a derived ComputedRef — computed(() => Object.values(pending.value).some(Boolean))
  // It is NOT a manually-managed ref. Components read it as a boolean via storeToRefs().
  isLoading: ComputedRef<boolean> // import type { ComputedRef } from 'vue'
  // pending map: workspace store independently tracks concurrent async operations
  pending: Record<string, boolean>
  error: AppError | null
}

interface BackofficeWorkspaceActions {
  loadWorkspace(slug: string): Promise<void>
  clearError(): void
  $reset(): void
}

// No persistence. Workspace context is resolved fresh on every session.
// Feature stores read slug via: const { workspace } = storeToRefs(useWorkspaceStore())
```

---

## Frontoffice Stores

### `frontoffice-auth` — `apps/frontoffice/src/core/state/auth.store.ts`

```ts
interface FrontofficeAuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  isLoading: boolean
  // token in ITokenManager — not a store state field
  // authError is typed as AppError | null at the public state boundary.
  authError: AppError | null
}

interface FrontofficeAuthActions {
  initSession(): Promise<void>
  /** @internal — MUST be called only from initSession() or refresh() auth flows. Never call from components or composables directly. (SA-006) */
  setSession(accessToken: string, profile: AuthUser): void
  refresh(): Promise<boolean>
  logout(): Promise<void>
  clearAuthError(): void
  expireSession(): Promise<void>
  $reset(): void
}
```

> Same factory pattern. Store `id`: `'frontoffice-auth'`.

---

### `frontoffice-app` — `apps/frontoffice/src/core/state/app.store.ts`

```ts
interface FrontofficeAppState {
  sidebarCollapsed: boolean // PERSISTED
  theme: 'light' | 'dark' | 'system' // PERSISTED
  locale: string // PERSISTED
  // NOTE: No isLoading or error — this store has only synchronous actions (CR-M2)
}

interface FrontofficeAppActions {
  setSidebarCollapsed(value: boolean): void
  setTheme(theme: FrontofficeAppState['theme']): void
  setLocale(locale: string): void
  $reset(): void
}

// pick: ['sidebarCollapsed', 'theme', 'locale']
```

---

### `frontoffice-ui` — `apps/frontoffice/src/core/state/ui.store.ts`

Same shape as MMC/Backoffice ui stores. Store `id`: `'frontoffice-ui'`.

```ts
interface FrontofficeUiState {
  modals: Record<string, boolean>
  drawers: Record<string, boolean>
  overlayVisible: boolean
}

interface FrontofficeUiActions {
  openModal(id: string): void
  closeModal(id: string): void
  toggleModal(id: string): void
  openDrawer(id: string): void
  closeDrawer(id: string): void
  toggleDrawer(id: string): void
  showOverlay(): void
  hideOverlay(): void
  closeAll(): void
  $reset(): void
}
```

---

### `frontoffice-notification` — `apps/frontoffice/src/core/state/notification.store.ts`

Same shape as MMC/Backoffice notification stores. Store `id`: `'frontoffice-notification'`.

```ts
interface FrontofficeNotificationState {
  notifications: AppNotification[]
}

interface FrontofficeNotificationActions {
  push(notification: Omit<AppNotification, 'id'>): string
  dismiss(id: string): void
  clearAll(): void
  $reset(): void
}
```

---

## Loading State Shapes by Store

| Store                    | `isLoading` | `pending` map |
| ------------------------ | :---------: | :-----------: |
| auth.store (all apps)    |      ✓      |       ✗       |
| app.store (all apps)     |      ✗      |       ✗       |
| ui.store (all apps)      |      ✗      |       ✗       |
| notification.store (all) |      ✗      |       ✗       |
| workspace.store (BO)     |      ✓      |       ✓       |

**Legend**: `ui.store` and `notification.store` have no async operations → no loading/error state required.

---

## Persistence Matrix

| Store                    | Persisted | Allowed Keys                          |
| ------------------------ | :-------: | ------------------------------------- |
| auth.store (all apps)    |  ✗ NEVER  | —                                     |
| app.store (all apps)     |     ✓     | `sidebarCollapsed`, `theme`, `locale` |
| ui.store (all apps)      |     ✗     | —                                     |
| notification.store (all) |     ✗     | —                                     |
| workspace.store (BO)     |     ✗     | —                                     |

---

## Store Dependency Graph (Acyclic — FR-015)

```
notification.store ──────────────────────┐
ui.store         ────────────────────────┤
app.store        ────────────────────────┤──→ (no dependencies on other stores)
auth.store       ────────────────────────┘

workspace.store (Backoffice only):
  → reads: [no cross-store reads at core level]
  → called by: feature stores (read-only, via storeToRefs)

Feature stores (future):
  → may read: workspace.store (slug), auth.store (user)
  → may call actions on: notification.store (push)
  → MUST NOT: mutate core store state directly
```

No circular dependencies permitted. The graph above is the enforcement target.
