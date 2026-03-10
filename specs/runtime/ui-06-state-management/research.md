# Research Notes — UI State Management Architecture

**Feature**: STAGE_UI_06_STATE_MANAGEMENT **Branch**: `ui-06-state-management` **Produced**:
2026-03-03 **Status**: Complete — all NEEDS CLARIFICATION resolved

---

## R-001: AppError Type Location & Shape

**Decision**: Use `AppError` exported from `@zidney/types`
(`packages/types/src/errors/ErrorCodes.ts`).

**Shape** (confirmed from source):

```ts
class AppError extends Error {
  constructor(
    public code: string,
    message?: string,
    public details?: Record<string, unknown>
  )
}
```

**Rationale**: `AppError` is already the platform-wide error contract. Using it directly avoids a
secondary error type, and it carries `code`, `message`, and optional `details` — sufficient for all
store error state.

**Alternatives considered**: Defining a plain `StoreError` interface — rejected to avoid divergence
from the shared error contract.

---

## R-002: Pinia Version Target

**Decision**: Pinia `^2.2.0` — already declared in `apps/mmc/package.json` (and mirrors
Backoffice/Frontoffice).

**Rationale**: Pinia 2.x is the stable Vue 3–compatible line. All composition API features used
(setup-syntax `defineStore`, `storeToRefs`, `$reset`) are fully supported. No Pinia 3 alpha risk.

**Alternatives considered**: Pinia 3 — explicitly out of scope per spec Assumption A1.

---

## R-003: pinia-plugin-persistedstate Version & API

**Decision**: `pinia-plugin-persistedstate` `^4.x` — pinPocket the latest stable v4 release.

**v4 API used**:

```ts
import { createPersistedState } from "pinia-plugin-persistedstate";

const pinia = createPinia();
pinia.use(createPersistedState());
```

Per-store opt-in via `persist` option:

```ts
defineStore('my-store', () => { ... }, {
  persist: {
    pick: ['sidebarCollapsed', 'theme', 'locale'],
    storage: localStorage,
  },
})
```

**Installation status**: Not yet present in apps (grep confirms no existing usage). Must be added to
`apps/mmc/package.json`, `apps/backoffice/package.json`, `apps/frontoffice/package.json`.

**localStorage unavailability fallback**: v4 plugin catches storage errors and silently falls back
to in-memory when `localStorage` is unavailable (private browsing, stricter CSP). This satisfies
FR-025.

**Rationale**: v4 is the current stable release line. v3 had different plugin registration API. v4
`pick` replaces v3 `paths` — use `pick` in implementation.

---

## R-004: @pinia/testing Status

**Decision**: `@pinia/testing` `^0.1.6` — already declared in `apps/mmc/package.json`.

**Usage pattern confirmed**:

```ts
import { setActivePinia, createPinia } from "pinia";

beforeEach(() => {
  setActivePinia(createPinia());
});
```

`@pinia/testing` provides `createTestingPinia` for full mock-store scenarios; raw
`setActivePinia(createPinia())` is sufficient for isolated unit tests per FR-028.

---

## R-005: API Client Import Path

**Decision**: Stores import feature API module functions from `@zidney/api-client` (the shared
`packages/api-client` workspace package).

**Confirmed package name**: `@zidney/api-client` (`packages/api-client/package.json` →
`"name": "@zidney/api-client"`).

**Import chain enforced**:

```
Component → Store action → Feature API module (e.g. authApi.login()) → HTTP client
```

Stores MUST NOT call the raw HTTP client (`client.ts`) directly. Store unit tests mock the feature
API module at the module boundary.

**ESLint enforcement**: A custom ESLint rule (or `no-restricted-imports` config entry) prevents
`.vue` files from importing `@zidney/api-client` directly.

---

## R-006: $reset() Implementation with Composition API Setup Syntax

**Decision**: Implement `$reset()` manually when using `defineStore` with setup syntax.

Pinia's Options API syntax provides `$reset()` automatically. The setup syntax does not — `$reset()`
must be an explicitly returned function that reassigns all reactive refs to their initial values.

**Pattern**:

```ts
export const useExampleStore = defineStore("app-example", () => {
  const isLoading = ref(false);
  const error = ref<AppError | null>(null);

  const initialState = {
    isLoading: false,
    error: null,
  };

  function $reset(): void {
    isLoading.value = initialState.isLoading;
    error.value = initialState.error;
  }

  return { isLoading, error, $reset };
});
```

**Rationale**: Pinia maintainers recommend this explicit pattern for setup stores. It is required
per FR-030. Capturing initial values as a const prevents drift.

---

## R-007: Cross-Store Read Pattern (storeToRefs)

**Decision**: Use `storeToRefs(useOtherStore())` inside actions for reactive reads. Direct
assignment to another store's state is forbidden (FR-012).

**Pattern**:

```ts
// Inside a store action:
const { slug } = storeToRefs(useWorkspaceStore());
const result = await workspaceApi.fetchData(slug.value);
```

**Circular dependency prevention**: Store dependency graph must be acyclic (FR-015). Dependency
direction is: feature stores → core stores only; core stores → no other stores (FR-033).

---

## R-008: Pending Map for Multi-Action Stores

**Decision**: Stores with multiple independent concurrent async concerns expose both
`isLoading: Ref<boolean>` (primary signal) AND `pending: Ref<Record<string, boolean>>` (per-action
granularity).

**Pattern**:

```ts
const isLoading = ref(false);
const pending = ref<Record<string, boolean>>({});

async function fetchWorkspaceList(): Promise<void> {
  pending.value["fetchWorkspaceList"] = true;
  isLoading.value = true;
  // ...
  pending.value["fetchWorkspaceList"] = false;
  isLoading.value = Object.values(pending.value).some(Boolean);
}
```

**Stores requiring pending map** (identified from spec):

- `workspace.store.ts` (Backoffice): may need to concurrently load workspace summary + members
- `notification.store.ts`: queue management is synchronous — `isLoading` only

---

## R-009: Store ID Uniqueness Convention

**Decision**: Store `id` follows `<app>-<domain>` kebab-case pattern per FR-032.

| App         | Store              | id                         |
| ----------- | ------------------ | -------------------------- |
| MMC         | auth.store         | `mmc-auth`                 |
| MMC         | app.store          | `mmc-app`                  |
| MMC         | ui.store           | `mmc-ui`                   |
| MMC         | notification.store | `mmc-notification`         |
| Backoffice  | auth.store         | `backoffice-auth`          |
| Backoffice  | app.store          | `backoffice-app`           |
| Backoffice  | ui.store           | `backoffice-ui`            |
| Backoffice  | notification.store | `backoffice-notification`  |
| Backoffice  | workspace.store    | `backoffice-workspace`     |
| Frontoffice | auth.store         | `frontoffice-auth`         |
| Frontoffice | app.store          | `frontoffice-app`          |
| Frontoffice | ui.store           | `frontoffice-ui`           |
| Frontoffice | notification.store | `frontoffice-notification` |

**Note**: The existing `auth.store.ts` in MMC uses `id: 'auth'` (pre-this-stage). This stage will
introduce aligned naming. Migration of existing stores is in-scope for this stage.

---

## R-010: ESLint Rule for Preventing Direct API Client Imports in .vue Files

**Decision**: Use `no-restricted-imports` rule in ESLint config, applied to `apps/**/*.vue` file
glob.

**Config entry** (in `eslint.config.mjs`):

```js
{
  files: ['apps/**/*.vue'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['@zidney/api-client', '@zidney/api-client/*'],
        message: 'API client must not be imported directly in .vue files. Call a store action instead.',
      }],
    }],
  },
}
```

**Rationale**: This is a zero-overhead enforcement mechanism — no custom plugin required. It
satisfies SC-002 during CI lint pass.

---

## R-011: Notification Queue Shape

**Decision**: `notification.store.ts` holds an array queue (`notifications: AppNotification[]`), not
a single value.

Each notification has: `id` (uuid), `type`, `title`, `message?`, `duration?`, `dismissible`.
Actions: `push`, `dismiss(id)`, `clearAll`.

---

## R-012: JWT / Token Handling Alignment with ui-09

**Decision**: `auth.store.ts` in all three apps does NOT hold the raw token as an exposed reactive
ref. Token is held by an injected `ITokenManager` (in-memory map), consistent with the existing MMC
auth store pattern and the `ui-09-security-and-token-handling` spec.

The store exposes `isAuthenticated: Ref<boolean>` and `user: Ref<AuthUser | null>`. No `token`
getter.

**Rationale**: Aligns with FR-026, FR-027, and existing `apps/mmc/src/core/state/auth.store.ts`
implementation. The new core stores in Backoffice and Frontoffice will follow the same factory
pattern (`defineAuthStore(...)`) already established in MMC.

---

## R-013: Existing auth.store.ts in MMC

**Finding**: An `auth.store.ts` already exists in MMC as part of `STAGE_UI_01_AUTH_MODULE`. It uses
`id: 'auth'` instead of `mmc-auth`. This stage should update the id to `mmc-auth` for consistency OR
document that the existing file satisfies FR-007 and FR-032 via an amendment.

**Decision**: Document the existing file as compliant with FR-001 through FR-031; update only the
store `id` from `'auth'` to `'mmc-auth'` as a non-breaking rename during this stage implementation.
All other patterns (factory injection, no token exposure, `clearAuthError`, `$reset`-equivalent via
`resetState`) already satisfy the requirements of this spec. Backoffice and Frontoffice auth stores
will be created fresh following the same factory pattern.

---

## Summary of Unresolved Items

None. All NEEDS CLARIFICATION items from the spec's Technical Context have been resolved above.
