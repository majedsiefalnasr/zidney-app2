# Research: STAGE_UI_01_AUTH_MODULE

**Stage**: STAGE_UI_01_AUTH_MODULE  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Generated**: 2026-03-01  
**Status**: COMPLETE — All NEEDS CLARIFICATION resolved

---

## 1. Vue Router Guard Patterns

### Decision

Use the `beforeEach` global navigation guard pattern with a `sessionInitialized` ref gate, returned
as a `RouteLocationRaw | boolean` from the guard function. The guard **returns** redirect locations;
it never calls `router.push()` imperatively.

### Rationale

- `router.beforeEach` is the only lifecycle point that runs before any route component is rendered,
  preventing flash-of-unauthenticated-content.
- Returning a `RouteLocationRaw` object (e.g. `{ name: 'login' }`) from the guard is the canonical
  Vue Router 4.x redirect pattern. This is preferable to `router.push()` inside a guard because the
  router itself handles redirect deduplication and history management.
- The `sessionInitialized` ref gate (CL-01) is required because `beforeEach` fires on the very first
  navigation — before `onMounted` in any component. By setting `sessionInitialized = false` and
  resolving it only after `initSession()` completes inside `main.ts`, we guarantee that guards never
  run before auth state is known.
- Async guards are fully supported in Vue Router 4 — the router awaits the returned promise before
  proceeding.

### Implementation Pattern

```typescript
// main.ts — gate pattern
const sessionInitialized = ref(false)

router.beforeEach(async (_to, _from) => {
  if (!sessionInitialized.value) {
    await authStore.initSession()
    sessionInitialized.value = true
  }
  // Delegate to auth.guard evaluation
  return authGuard(...)
})
```

### Alternatives Considered

| Alternative                                 | Rejected Because                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `onMounted` in `App.vue`                    | Fires after first navigation — cannot gate beforeEach                   |
| Inline `await` in each guard                | Guards would each independently call initSession — N calls instead of 1 |
| Meta `requiresAuth` + redirect in component | Post-render, causes layout flash                                        |

---

## 2. Pinia Test Isolation Pattern

### Decision

Use `setActivePinia(createPinia())` before each test. Pass the pinia instance to `useStore(pinia)`
(option 2: explicit pinia argument). Mock `AuthService` via constructor/factory injection so the
store never makes real HTTP calls.

### Rationale

- `setActivePinia(createPinia())` creates a fresh Pinia instance per test, ensuring zero state bleed
  between tests.
- Pinia stores defined with the composition API (`defineStore(() => { ... })`) accept an explicit
  `pinia` argument to `useStore(pinia)` in test environments, providing full isolation.
- The `AuthService` injectable factory means tests can pass a mock service without importing the
  real HTTP client. The test double is created with Vitest's `vi.fn()`.
- Token manager must not be a Pinia store; it is a plain reactive module. In tests, its internal
  `ref` is directly manipulated by calling `setToken` / `clearToken`.

### Implementation Pattern

```typescript
// test setup
beforeEach(() => {
  setActivePinia(createPinia());
});

// in test
const mockAuthService: IAuthService = {
  login: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  refreshToken: vi.fn().mockResolvedValue({ accessToken: "test-token" }),
  fetchProfile: vi.fn().mockResolvedValue({
    id: "1",
    email: "a@b.com",
    name: "A",
    role: UserRole.ADMIN,
  }),
};
const store = useAuthStore();
// inject mock by calling store actions that delegate to injected service
```

### Alternatives Considered

| Alternative                                       | Rejected Because                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| `vi.mock('@/core/auth/auth.service')` module mock | Couples test to module path; harder to test multiple service configurations |
| `app.use(pinia)` in test                          | Requires creating full Vue app per test — heavy                             |

---

## 3. Axios Interceptor Patterns (not applicable — project uses fetch adapter)

### Decision

The project uses `@zidney/api-client` with a **fetch adapter** (`createFetchAdapter()`), not Axios.
The interceptor patterns are implemented by wiring callbacks into the api-client factory:
`getAccessToken`, `onRefreshToken`, `onAuthFailure`. This stage replaces the existing inline
implementations of those callbacks with the structured `token-manager` and `refresh-manager`.

### Token Injection Pattern

```typescript
// getAccessToken callback — called by api-client before each request
getAccessToken: () => tokenManager.getToken();
```

### 401 → Refresh → Retry Pattern

The `@zidney/api-client` package handles retry internally when `onRefreshToken` succeeds — the
interceptor contract is:

- `onRefreshToken()` → called on first 401 → must return new `accessToken`
- If `onRefreshToken()` throws → `onAuthFailure()` is called → logout triggered
- Retry after refresh is handled by the api-client internally; the consumer does not need to
  re-issue the request manually

### Implementation Scope (CL-03)

The existing `core/api/client.ts` in each app already has placeholder implementations of
`onRefreshToken` and `onAuthFailure`. This stage **replaces** those inline implementations with
proper delegation to `refresh-manager` and `token-manager`.

**Before (current stub):**

```typescript
getAccessToken: () => auth.getAccessToken(),
onRefreshToken: async () => {
  // inline fetch call with no single-flight protection
  const response = await fetch(...)
  auth.setAccessToken(data.data.accessToken)
  return data.data.accessToken
},
onAuthFailure: () => {
  auth.clearAccessToken()
  storeWithRouter.router?.push('/login')
}
```

**After (this stage):**

```typescript
getAccessToken: () => tokenManager.getToken(),
onRefreshToken: async () => {
  await refreshManager.refresh()        // single-flight protected
  return tokenManager.getToken()!
},
onAuthFailure: () => {
  // onLogout callback passed to createRefreshManager at bootstrap
  void authStore.logout()
}
```

### Alternatives Considered

| Alternative                            | Rejected Because                                               |
| -------------------------------------- | -------------------------------------------------------------- |
| Replace fetch adapter with Axios       | Breaking change to api-client; not in scope                    |
| Implement retry inside refresh-manager | api-client already owns retry after refresh; double-retry risk |

---

## 4. Single-Flight Lock Implementation in TypeScript

### Decision

Implement using a `Promise<void> | null` in-flight reference. The in-flight promise is set when the
first refresh starts and cleared (to `null`) in the `finally` block after completion (success or
failure). All callers that arrive while `inFlight !== null` receive the same promise — they do not
initiate new network requests.

### Rationale

- JavaScript's event loop means that a `null`-check + assignment before the first `await` is atomic
  in terms of current-task execution. No true concurrency exists — only cooperative concurrency via
  the microtask queue.
- The factory pattern (CL-02) ensures `onLogout` is injected at bootstrap time, eliminating
  compile-time circular imports between refresh-manager ↔ auth-store ↔ api-client.
- The `onLogout` callback is called inside the `catch` block of the refresh attempt, before clearing
  the in-flight lock, to guarantee logout fires exactly once per failed refresh cycle.

### Implementation Pattern

```typescript
export function createRefreshManager(
  refreshFn: () => Promise<string>,
  onLogout: () => void,
): IRefreshManager {
  let inFlight: Promise<void> | null = null;

  function refresh(): Promise<void> {
    if (inFlight !== null) return inFlight;

    inFlight = refreshFn()
      .then((newToken) => {
        tokenManager.setToken(newToken);
      })
      .catch((err) => {
        onLogout();
        return Promise.reject(err);
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  }

  function isRefreshing(): boolean {
    return inFlight !== null;
  }

  return { refresh, isRefreshing };
}
```

### Concurrency Guarantee

When N requests simultaneously call `refresh()`:

1. Call #1 arrives: `inFlight === null` → creates and assigns promise → issues HTTP
2. Calls #2–N arrive: `inFlight !== null` → return same promise → no new HTTP calls
3. HTTP resolves → all N callers' `refresh()` promises resolve
4. `finally` clears `inFlight = null`
5. Result: exactly 1 HTTP refresh request per burst cycle

### Alternatives Considered

| Alternative                               | Rejected Because                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| Mutex library (e.g. `async-mutex`)        | External dependency; overkill; not available in monorepo packages         |
| `isRefreshing` boolean + subscriber array | More complex; race condition between setting flag and attaching listeners |
| Abort controller per refresh              | Adds cancellation complexity without adding safety                        |

---

## 5. Factory Injection Pattern for Circular Dependency Resolution (CL-02)

### Decision

Use a **late-binding factory function** passed to `createRefreshManager()` at bootstrap. The refresh
manager module has zero imports from `auth.store`, `pinia`, or `vue-router`.

### Dependency Graph (Resolved)

```
main.ts
  └─ creates pinia + authStore
  └─ creates tokenManager (singleton)
  └─ creates refreshManager = createRefreshManager(
       refreshFn: () => apiClient.post('/auth/refresh'),
       onLogout: () => authStore.logout()
     )
  └─ creates apiClient = getApiClient(tokenManager, refreshManager)
  └─ authStore receives apiClient reference via authService
```

### Module-Level Import Graph (No Circular Refs)

```
auth.store.ts  imports  auth.service.ts
auth.service.ts  imports  api/client.ts (via factory getter)
api/client.ts  imports  token-manager.ts
api/client.ts  imports  refresh-manager.ts (receives instance at runtime)
refresh-manager.ts  imports  (nothing from auth layer — onLogout is injected callback)
token-manager.ts  imports  (nothing)
```

### Alternatives Considered

| Alternative                                              | Rejected Because                                |
| -------------------------------------------------------- | ----------------------------------------------- |
| Global singleton pattern (`export const refreshManager`) | Creates circular import at module load time     |
| Pinia plugin to inject refreshManager into auth store    | Hides wiring in plugin; harder to test          |
| Dynamic `import()` inside refresh-manager                | Module boundary violation; makes testing harder |

---

## 6. `UserRole` type in `packages/types`

### Finding

`packages/types` exports `MMCUserRole` (enum) from `master-db.ts` for MMC platform users. A generic
`UserRole` shared across all three apps does not yet exist as a single exported enum. The spec's
`AuthUser.role: UserRole` references a common type.

### Resolution

The `data-model.md` for this stage defines `UserRole` as a union string literal type
(`type UserRole = string`) to remain compatible with all three apps without requiring a
`packages/types` change in this stage. The spec (Section 7.1) uses `UserRole` from `packages/types`
— if MMC users use `MMCUserRole`, the `AuthUser.role` field in `auth.store.ts` will be typed as
`MMCUserRole` in the MMC app and as `string` (pending definition) in backoffice/frontoffice.

**Implementation approach**: Define a local `UserRole` string-union type in each app's
`core/auth/types.ts` for now. Mark as `TODO: replace with packages/types UserRole once defined`.

---

## 7. `packages/logger` Usage in Frontend

### Finding

`packages/logger` uses Pino targets (`json-stdout`, `json-file`) appropriate for Node.js runtime.
Browser environments do not support `pino-pretty` or file transports.

### Resolution

The auth module uses `createLogger` from `@zidney/logger` with `LOG_FORMAT=console`
(browser-compatible mode). The logger is instantiated per-module:

```typescript
import { createLogger } from "@zidney/logger";
const logger = createLogger("auth-store"); // 'auth-module' for shared core
```

Token values are never passed as context fields. Error logging passes only `{ code, message }` from
`AuthError`.

---

## Summary: All Unknowns Resolved

| Unknown                                   | Resolution                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Vue Router guard timing for `initSession` | `beforeEach` gate with `sessionInitialized` ref in `main.ts` (CL-01)                            |
| Pinia test isolation approach             | `setActivePinia(createPinia())` + factory-injectable `AuthService`                              |
| HTTP interceptor pattern                  | Callbacks in `@zidney/api-client` factory (`getAccessToken`, `onRefreshToken`, `onAuthFailure`) |
| Single-flight lock                        | `Promise<void> \| null` in-flight ref; factory injection breaks circular dep (CL-02)            |
| `UserRole` type source                    | Local `UserRole` type in `core/auth/types.ts` per app; reference `MMCUserRole` for MMC          |
| Logger compatibility in browser           | `LOG_FORMAT=console` mode from `@zidney/logger`                                                 |
| `client.ts` owned by this stage or prior  | Stubs exist from Stage 00; this stage fills in implementation (CL-03)                           |
