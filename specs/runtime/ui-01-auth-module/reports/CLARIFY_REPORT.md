# Clarify Report — STAGE_UI_01_AUTH_MODULE

**Step:** 2 — Clarify  
**Stage:** STAGE_UI_01_AUTH_MODULE  
**Phase:** 06_UI_APPLICATION_RUNTIME  
**Session:** 2026-03-01  
**Outcome:** All clarifications resolved — planning authorized

---

## Summary

Three implementation-critical ambiguities were identified in the specification during the ambiguity
scan. All three were resolved in this session. No `[NEEDS CLARIFICATION]` markers remain in
`spec.md`. Planning is authorized.

---

## Clarification Log

### CL-01 — `initSession()` Call Site

**Risk level:** HIGH — Timing race could cause login-flash or unauthenticated route access  
**Affects:** FR-32, FR-34, AS-05 (Route Protection), NFR-05

**Ambiguity:**  
FR-32 offered two call sites — `main.ts` or `App.vue` `onMounted`. These are architecturally
different. The `onMounted` pattern introduces a timing race: Vue Router's `beforeEach` fires during
initial navigation, which precedes `onMounted` execution. If `initSession()` is called in
`onMounted`, the first `beforeEach` evaluation occurs before auth state is resolved, causing a
redirect to the login page for authenticated users (login flash).

**Resolution:**  
`initSession()` is called in `main.ts` before `app.mount()`. A `sessionInitialized` reactive ref
gates all `router.beforeEach` execution until `initSession()` resolves. This guarantees auth state
is established before any navigation guard runs.

**Impact on implementation:**

- `main.ts` in all three apps bootstraps auth before mounting
- Auth guard reads `sessionInitialized` flag as a precondition
- No `initSession()` call in any component lifecycle hook

---

### CL-02 — Circular Dependency: Auth Store ↔ API Client ↔ Refresh Manager

**Risk level:** HIGH — Module-level circular import causes runtime errors and breaks testability  
**Affects:** FR-13–FR-17, FR-19, AS-03

**Ambiguity:**  
The spec described a refresh flow where the API client calls `refresh-manager.refresh()` on 401, and
on failure the refresh manager calls `authStore.logout()`. This creates a module-level circular
dependency: `authStore → API client → refreshManager → authStore`. Left unresolved, this results in
either a runtime circular import error or requires `authStore` to be a late-resolved singleton,
making unit testing difficult.

**Resolution:**  
Factory injection pattern. The refresh manager is created via
`createRefreshManager(httpClient, onLogout)`, where `onLogout` is a callback passed at bootstrap
time from `main.ts`. This breaks the compile-time circular import entirely. The refresh manager has
zero import-time dependency on Pinia or the auth store.

**Impact on implementation:**

- `refresh-manager.ts` exports a factory function, not a singleton
- `createRefreshManager(apiClient, () => authStore.logout())` is called in `main.ts`
- In tests: `createRefreshManager(mockHttpClient, vi.fn())` — full isolation
- No Pinia import inside `core/auth/refresh-manager.ts`

---

### CL-03 — API Client Interceptor Ownership

**Risk level:** MEDIUM — Determines whether `core/api/client.ts` is created or modified in this
stage  
**Affects:** FR-18, FR-19, FR-20, FR-21

**Ambiguity:**  
The spec referenced `core/api/client.ts` as established in STAGE_UI_00, but it was unclear whether
the 401 handling and token injection interceptors were already implemented or left as
stubs/extension points.

**Resolution:**  
STAGE_UI_00 created the API client skeleton (base URL, instance factory, interceptor hooks as empty
extension points). This stage wires in the implementations: the request interceptor injects the
`Authorization` header using `tokenManager.getToken()`, and the response interceptor handles 401 via
`refreshManager.refresh()` with single-retry logic.

**Impact on implementation:**

- `core/api/client.ts` is **modified** (not created) in all three apps
- Token injection wired via request interceptor hook
- 401 → refresh → retry wired via response interceptor hook
- No new API client file created — Stage 00's scaffold is extended

---

## Ambiguity Scan Results

| Area                         | Ambiguity Found | Resolution                    | Status    |
| ---------------------------- | --------------- | ----------------------------- | --------- |
| `initSession()` timing       | YES             | `main.ts` factory pattern     | ✅ CLOSED |
| Circular dep: store ↔ client | YES             | `onLogout` callback injection | ✅ CLOSED |
| API interceptor ownership    | YES             | Stage 00 skeleton extended    | ✅ CLOSED |
| Token storage mechanism      | No              | —                             | ✅ CLEAR  |
| Refresh single-flight lock   | No              | —                             | ✅ CLEAR  |
| Logout idempotency           | No              | —                             | ✅ CLEAR  |
| Auth guard redirect strategy | No              | —                             | ✅ CLEAR  |
| Test isolation mechanism     | No              | —                             | ✅ CLEAR  |
| Per-app guard config         | No              | —                             | ✅ CLEAR  |

---

## Post-Clarification Spec State

`spec.md` updated in-place with `## 16. Clarifications / ### Session 2026-03-01` block containing
CL-01, CL-02, and CL-03 with full rationale and implementation contracts.

**Unresolved markers remaining:** None  
**Planning authorization:** GRANTED
