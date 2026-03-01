# Tasks Report — STAGE_UI_01_AUTH_MODULE

**Step:** 4 — Tasks  
**Stage:** STAGE_UI_01_AUTH_MODULE  
**Phase:** 06_UI_APPLICATION_RUNTIME  
**Generated:** 2026-03-01  
**Outcome:** 67 atomic tasks generated — drift analysis gate pending

---

## Task Count Summary

| Phase     | Description                      | Tasks     | Count  | Parallelizable |
| --------- | -------------------------------- | --------- | ------ | -------------- |
| A         | Types (foundational, per app)    | T001–T003 | 3      | All 3 parallel |
| B         | Token Manager (per app)          | T004–T006 | 3      | All 3 parallel |
| C         | Refresh Manager (per app)        | T007–T009 | 3      | All 3 parallel |
| D         | Auth Service (per app)           | T010–T012 | 3      | All 3 parallel |
| E         | Auth Store (per app)             | T013–T015 | 3      | All 3 parallel |
| F         | Auth Guard + RouteMeta (per app) | T016–T021 | 6      | 6 parallel     |
| G         | API Client wiring + index.ts     | T022–T030 | 9      | 6 parallel     |
| H         | main.ts + router bootstrap       | T031–T036 | 6      | 6 parallel     |
| I         | Unit Tests (per module)          | T037–T048 | 12     | Most parallel  |
| J         | Integration Tests                | T049–T054 | 6      | 3 parallel     |
| K         | Cleanup (delete token-store.ts)  | T055–T057 | 3      | 3 parallel     |
| L         | Verification (typecheck/lint)    | T058–T067 | 10     | 9 parallel     |
| **Total** |                                  |           | **67** |                |

---

## Dependency Chain

```
Phase A (types) → Phase B + D (token-manager, auth-service can run in parallel)
Phase B → Phase C (refresh-manager needs tokenManager interface)
Phase B + D → Phase E (auth-store needs tokenManager + authService injected)
Phase E → Phase F + G (guard + API client need authStore.isAuthenticated + authStore.logout)
Phase F + G → Phase H (main.ts bootstrap wires all pieces together)
Phase H → Phase I (unit tests exercise the fully composed modules)
Phase H → Phase J (integration tests require full bootstrap to be exercisable)
Phase I + J → Phase K (cleanup safe after tests pass)
Phase K → Phase L (verification runs on clean codebase)
```

---

## Critical Implementation Notes

### Task Phases A–C: Foundational Infrastructure

**T001–T003** (Types): Zero runtime imports — pure TypeScript type files. Must produce no `any` in public interfaces. `AuthErrorCode` is a string literal union.

**T004–T006** (Token Manager): `createTokenManager()` returns an `ITokenManager` instance. The token is held in a `let token: string | null = null` closure variable (NOT a Vue ref — ref is not needed here; the store is the reactive layer). Must verify: no `localStorage.setItem`, no `sessionStorage.setItem`, no `document.cookie` write.

**T007–T009** (Refresh Manager): `createRefreshManager(refreshFn, onLogout, tokenManager)` — three-argument factory. The `inFlight: Promise<void> | null` lock is set synchronously before the first `await` to guarantee atomicity in JavaScript's cooperative concurrency model.

### Task Phases D–E: Application Layer

**T010–T012** (Auth Service): Uses API client via injected `{ post, get }` functions (not by direct import). `logout()` always resolves — errors are caught and swallowed (FR-30). `fetchProfile()` returns typed `AuthUser`.

**T013–T015** (Auth Store): `defineAuthStore(authService, tokenManager, router, loginRouteName, getRefreshManager)`. The `refresh()` action delegates to `getRefreshManager()?.refresh()` — the lazy accessor is `null` during the brief window between store creation and refresh manager creation in Steps 5–6 of bootstrap. This is safe because no 401 can occur before `app.mount()`.

### Task Phase H: Bootstrap Wiring (Critical Ordering)

**T031–T036** (main.ts): Must follow the 9-step bootstrap sequence. The `sessionInitialized` ref is used as a one-time gate in the first `router.beforeEach` invocation. **The `let apiClient` forward declaration pattern** (defined after authService but initialized after refreshManager) must be preserved to avoid circular import errors.

### Task Phase I: Unit Tests

All unit tests use:

- `setActivePinia(createPinia())` (called in `beforeEach`)
- `createMemoryHistory()` for router (no real browser navigation)
- Factory injection for AuthService mock (pass `vi.fn()` implementations)

Token leak test: verify token value never appears in `logger.info(...)` call arguments using `toHaveBeenCalledWith` assertions that exclude the token string.

### Task Phase K: Cleanup

**T055–T057** (Delete token-store.ts): Must occur AFTER index.ts re-exports are updated and unit tests pass. Deleting before re-exports are updated will break TypeScript compilation.

---

## Risk Register

| Risk                                                          | Severity | Mitigation                                                               |
| ------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| Token value leaked to logger                                  | HIGH     | T064 grep verification; logger calls must use metadata only              |
| Multiple refresh calls under concurrent 401s                  | HIGH     | T040 concurrency test; inFlight lock is atomic pre-await                 |
| Token written to browser storage                              | HIGH     | T037 unit test; localStorage/sessionStorage spies                        |
| sessionInitialized race (initSession called twice)            | MEDIUM   | T050 integration test; one-time gate ref                                 |
| `token-store.ts` deletion causes TypeScript error             | MEDIUM   | Delete only after T025-T027 re-export updates confirmed                  |
| `defineAuthStore` getRefreshManager returns null on first 401 | LOW      | Not possible — 401s only occur post-mount, by which point Step 6 has run |

---

## File Inventory

### Files to Create (18 new files)

- `apps/mmc/src/core/auth/types.ts`
- `apps/mmc/src/core/auth/token-manager.ts`
- `apps/mmc/src/core/auth/refresh-manager.ts`
- `apps/mmc/src/core/auth/auth.service.ts`
- `apps/mmc/src/core/state/auth.store.ts`
- `apps/mmc/src/core/router/guards/auth.guard.ts`
- _(same 6 for backoffice)_
- _(same 6 for frontoffice)_

### Files to Modify (12 modified files)

- `apps/{mmc,backoffice,frontoffice}/src/core/api/client.ts` (wire interceptor stubs)
- `apps/{mmc,backoffice,frontoffice}/src/core/auth/index.ts` (update re-exports)
- `apps/{mmc,backoffice,frontoffice}/src/core/router/index.ts` (add guard + sessionInitialized)
- `apps/{mmc,backoffice,frontoffice}/src/main.ts` (add bootstrap sequence)

### Files to Delete (3 files)

- `apps/{mmc,backoffice,frontoffice}/src/core/auth/token-store.ts`

### Test Files to Create

- Tests per module per app in `tests/unit/` or `src/core/auth/__tests__/`
- Integration tests in `tests/integration/`

---

**Tasks Total:** 67  
**Drift Analysis:** PENDING  
**Implementation:** BLOCKED pending drift gate pass
