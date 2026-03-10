# Tasks — UI State Management Architecture

**Feature**: STAGE_UI_06_STATE_MANAGEMENT **Branch**: `ui-06-state-management` **Phase**:
06_UI_APPLICATION_RUNTIME **Produced**: 2026-03-03 **Status**: Ready for Implementation

---

## Overview

Tasks are organized into five phases matching the implementation order from plan.md:

- **Phase A — Infrastructure**: Dependency installation, shared test helper, ESLint enforcement
- **Phase B — MMC Stores**: Reference implementation (establishes the pattern)
- **Phase C — Backoffice Stores**: Full workspace-scoped store set
- **Phase D — Frontoffice Stores**: Student runtime store set
- **Phase E — Validation**: Unit tests, integration tests, CI uniqueness check

User story mapping:

| User Story | Priority | Description                                                  |
| ---------- | -------- | ------------------------------------------------------------ |
| US1        | P1       | Developer Creates a Core Runtime Store                       |
| US2        | P1       | Component Reads and Triggers Store Actions                   |
| US3        | P2       | Developer Reads from Another Store Without Direct Mutation   |
| US4        | P2       | Permitted UI Preferences Are Persisted Across Sessions       |
| US5        | P2       | Store Fails Gracefully with Structured Loading & Error State |

---

## Phase A — Infrastructure

> No user story label. Blocking prerequisites for all phases. Independent test: `bun install`
> resolves; `bun lint` exits 0; `tests/unit/store-test-helper.ts` imports cleanly in any test file.

- [x] T001 Install `pinia-plugin-persistedstate@^4.2.0` in `apps/mmc/package.json` (add to
      `dependencies`, run `bun install`)
- [x] T002 [P] Install `pinia-plugin-persistedstate@^4.2.0` in `apps/backoffice/package.json` (add
      to `dependencies`, run `bun install`)
- [x] T003 [P] Install `pinia-plugin-persistedstate@^4.2.0` in `apps/frontoffice/package.json` (add
      to `dependencies`, run `bun install`)
- [x] T004 Create shared store test helper at `tests/unit/store-test-helper.ts` (exports
      `useIsolatedPinia()` wrapping `setActivePinia(createPinia())` in `beforeEach`)
- [x] T005 Update root ESLint config at `eslint.config.mjs`

---

## Phase B — MMC Stores (Reference Implementation)

> Story coverage: US1, US2, US4, US5 Independent test: All MMC stores can be instantiated with
> `setActivePinia(createPinia())` in a Node-only environment; `useMmcAppStore` persists only
> `sidebarCollapsed`, `theme`, `locale`.

### B1 — Bootstrap

- [x] T006 [US1] Update `apps/mmc/src/main.ts` — import `createPersistedState` from
      `pinia-plugin-persistedstate`, call `pinia.use(createPersistedState())` immediately after
      `createPinia()` and before any store instantiation (FR-021, FR-034)

### B2 — Store Files

- [x] T007 [P] [US1] Update `apps/mmc/src/core/state/auth.store.ts` — rename `defineStore` id from
      `'auth'` to `'mmc-auth'` (FR-032); no other structural change
- [x] T008 [P] [US1] [US4] Create `apps/mmc/src/core/state/app.store.ts`
- [x] T009 [P] [US1] [US2] Create `apps/mmc/src/core/state/ui.store.ts`
- [x] T010 [P] [US1] [US2] [US5] Create `apps/mmc/src/core/state/notification.store.ts`
- [x] T011 [US1] Update `apps/mmc/src/core/state/index.ts`

---

## Phase C — Backoffice Stores

> Story coverage: US1, US2, US3, US4, US5 Independent test: All Backoffice stores instantiate in
> isolation; `useBackofficeWorkspaceStore.loadWorkspace` resolves from stub without error;
> `pending['loadWorkspace']` transitions correctly; no auth keys appear in `persist.pick`.

### C1 — Bootstrap

- [x] T012 [US1] Update `apps/backoffice/src/main.ts` — register `pinia-plugin-persistedstate`
      plugin via `pinia.use(createPersistedState())` immediately after `createPinia()` (same pattern
      as T006; FR-021, FR-034)

### C2 — Store Files

- [x] T013 [P] [US1] Update `apps/backoffice/src/core/state/auth.store.ts`
- [x] T014 [P] [US1] [US4] Create `apps/backoffice/src/core/state/app.store.ts`
- [x] T015 [P] [US1] [US2] Create `apps/backoffice/src/core/state/ui.store.ts`
- [x] T016 [P] [US1] [US2] [US5] Create `apps/backoffice/src/core/state/notification.store.ts`
- [x] T017 [US1] [US3] [US5] Create `apps/backoffice/src/core/state/workspace.store.ts`
- [x] T018 [US1] Update `apps/backoffice/src/core/state/index.ts`

---

## Phase D — Frontoffice Stores

> Story coverage: US1, US2, US4, US5 Independent test: All Frontoffice stores instantiate in
> isolation; `useFrontofficeAppStore` persists only `sidebarCollapsed`, `theme`, `locale`; no token
> or permission keys appear in any `persist.pick`.

### D1 — Bootstrap

- [x] T019 [US1] Update `apps/frontoffice/src/main.ts` — register `pinia-plugin-persistedstate`
      plugin via `pinia.use(createPersistedState())` immediately after `createPinia()` (same pattern
      as T006 and T012; FR-021, FR-034)

### D2 — Store Files

- [x] T020 [P] [US1] Update `apps/frontoffice/src/core/state/auth.store.ts`
- [x] T021 [P] [US1] [US4] Create `apps/frontoffice/src/core/state/app.store.ts`
- [x] T022 [P] [US1] [US2] Create `apps/frontoffice/src/core/state/ui.store.ts`
- [x] T023 [P] [US1] [US2] [US5] Create `apps/frontoffice/src/core/state/notification.store.ts`
- [x] T024 [US1] Update `apps/frontoffice/src/core/state/index.ts`

---

## Phase E — Validation

> Story coverage: US1–US5 (full coverage verification) Independent test: All unit tests pass in a
> Node-only environment; integration tests verify bootstrap order; uniqueness test confirms no
> duplicate store ids.

### E1 — MMC Unit Tests

- [x] T025 [P] [US1] [US4] Create `apps/mmc/tests/unit/stores/app.store.test.ts` — test coverage:
      default state init; `setSidebarCollapsed`, `setTheme`, `setLocale` mutations; `$reset()`
      restores all fields to initial values; assert `persist.pick` contains exactly
      `['sidebarCollapsed', 'theme', 'locale']` and no auth-related keys; state isolation via
      `setActivePinia(createPinia())` in `beforeEach` (FR-028, FR-030, SC-001, SC-003); **do NOT
      test `clearError` or `error` state — this store is synchronous with no async actions (CR-M2)**
- [x] T026 [P] [US1] [US2] Create `apps/mmc/tests/unit/stores/ui.store.test.ts` — test coverage:
      default state init; `openModal`/`closeModal`/`toggleModal`;
      `openDrawer`/`closeDrawer`/`toggleDrawer`; `showOverlay`/`hideOverlay`; `closeAll` clears all
      registries; `$reset()` restores initial state; state isolation
- [x] T027 [P] [US1] [US2] [US5] Create `apps/mmc/tests/unit/stores/notification.store.test.ts` —
      test coverage: `push` returns uuid and appends to queue; `dismiss(id)` removes only matching
      notification; `clearAll` empties queue; multiple concurrent notifications are independently
      dismissible; `$reset` restores empty queue

### E2 — Backoffice Unit Tests

- [x] T028 [P] [US1] [US5] Create `apps/backoffice/tests/unit/stores/app.store.test.ts` — same
      coverage requirements as T025; assert `persist.pick` contains exactly
      `['sidebarCollapsed', 'theme', 'locale']` and no auth-related keys (SC-003, FR-023)
- [x] T029 [P] [US1] [US2] Create `apps/backoffice/tests/unit/stores/ui.store.test.ts` — same
      coverage requirements as T026
- [x] T030 [P] [US1] [US2] [US5] Create
      `apps/backoffice/tests/unit/stores/notification.store.test.ts` — same coverage requirements as
      T027
- [x] T031 [P] [US1] [US3] [US5] Create `apps/backoffice/tests/unit/stores/workspace.store.test.ts`
      — test coverage: default state (`workspace === null`, `isLoading === false`, `pending === {}`,
      `error === null`); `loadWorkspace` sets `pending['loadWorkspace']` to `true` during action and
      `false` after; `isLoading` transitions correctly; concurrent guard prevents duplicate
      execution; on simulated error sets `error` as `AppError` instance and `isLoading` to `false`;
      `clearError()` zeroes error; `$reset()` restores all fields

### E3 — Frontoffice Unit Tests

- [x] T032 [P] [US1] [US5] Create `apps/frontoffice/tests/unit/stores/app.store.test.ts` — same
      coverage requirements as T025 and T028 (including persistence key assertion)
- [x] T033 [P] [US1] [US2] Create `apps/frontoffice/tests/unit/stores/ui.store.test.ts` — same
      coverage requirements as T026
- [x] T034 [P] [US1] [US2] [US5] Create
      `apps/frontoffice/tests/unit/stores/notification.store.test.ts` — same coverage requirements
      as T027

### E4 — Integration & CI Tests

- [x] T035 [US1] [US4] Create `apps/mmc/tests/integration/pinia-bootstrap.test.ts` — verify:
      `createPinia()` called exactly once; `pinia-plugin-persistedstate` registered before
      `app.mount()`; auth store instantiated before first route guard fires; `useMmcAppStore`
      persist config includes exactly `['sidebarCollapsed', 'theme', 'locale']`; auth store has no
      persisted keys; **also add test asserting app initializes without throwing when
      `localStorage.setItem` throws `DOMException` — mock `localStorage.setItem` to throw
      `new DOMException('QuotaExceededError')` and assert store mounts cleanly (FR-025, QA-H002)**
      (SC-009, FR-034)
- [x] T036 [P] [US1] [US4] Create `apps/backoffice/tests/integration/pinia-bootstrap.test.ts` — same
      bootstrap verification as T035 for Backoffice app; assert `useBackofficeWorkspaceStore` is
      available post-init; auth store has no persisted keys (SC-009)
- [x] T037 [P] [US1] [US4] Create `apps/frontoffice/tests/integration/pinia-bootstrap.test.ts` —
      same bootstrap verification as T035 for Frontoffice app; assert auth store has no persisted
      keys (SC-009)
- [x] T038 Create `tests/unit/store-id-uniqueness.test.ts` — **imports and instantiates all stores**
      via `setActivePinia(createPinia())` and reads their actual `$id` property at runtime; NOTE:
      the two factory-pattern auth stores (`backoffice-auth`, `frontoffice-auth`) use
      `defineAuthStore()` and must be instantiated with stub injections (router, tokenManager,
      authService); all 13 `$id` values are collected and asserted
      `new Set(ids).size === ids.length` (unique); asserts no two apps share an id; do NOT hardcode
      the expected id strings — derive them from instantiated stores so the test catches real
      renames (FR-032, SC-010, CR-H2)
- [x] T039 [P] Add structured logging to `apps/backoffice/src/core/state/workspace.store.ts` catch
      block — import `logger` from `@zidney/logger`; normalize caught error to `appErr` (AppError);
      call
      `logger.warn('workspace.store: loadWorkspace failed', { service: 'backoffice-store', error_code: appErr.code, internal_message: err instanceof Error ? err.message : String(err) })`
      (internal detail logged only, never exposed); assign
      `error.value = new AppError('WORKSPACE_LOAD_FAILED', 'Unable to load workspace. Please try again.')`
      so user-facing message is always generic (SA-003); add **both** a grep-based CI check
      (`grep -rn 'console\.log' apps/*/src/core/state/`) **and** a Vitest assertion in a CI-blocking
      test asserting zero `console.log` occurrences in `apps/*/src/core/state/*.store.ts` — both are
      mandatory (FR-010, AGENTS.md logging rule, SC-006, SC-011)
- [x] T040 [P] [US1] Create `apps/backoffice/tests/unit/stores/auth.store.test.ts` — unit tests for
      the `defineAuthStore` factory implementation: default state (`isAuthenticated: false`,
      `user: null`, `isLoading: false`, `authError: null`); `isAuthenticated` computed reactivity;
      logout clears state; `storeToRefs()` output has no token field; `authError` is
      `AppError | null`; use `useIsolatedPinia()` from shared helper (QA-H001, FR-026, FR-027,
      SC-003)
- [x] T041 [P] [US1] Create `apps/frontoffice/tests/unit/stores/auth.store.test.ts` — same coverage
      as T040 for Frontoffice `defineAuthStore` factory implementation (QA-H001, FR-026)
- [x] T042 Add `madge` as dev dependency in root `package.json` (`bun add -D madge`); create
      `scripts/check-store-cycles.ts` that runs `madge` on each app's `src/core/state/` directory
      and asserts zero circular dependencies detected — script must exit with non-zero code on any
      cycle; add invocation to CI lint/check step (SC-007, QA-H003, FR-033)

---

## Dependencies

```
T001, T002, T003  (parallel — independent apps)
T004              (after T001/T002/T003 complete — shared helper used by tests)
T005              (parallel with T004 — independent)

T006              (after T001)
T007, T008, T009, T010  (parallel — after T006)
T011              (after T007, T008, T009, T010)

T012              (after T002)
T013, T014, T015, T016, T017  (parallel — after T012)
T018              (after T013, T014, T015, T016, T017)

T019              (after T003)
T020, T021, T022, T023  (parallel — after T019)
T024              (after T020, T021, T022, T023)

T025, T026, T027  (parallel — after T011)
T028, T029, T030, T031  (parallel — after T018)
T032, T033, T034  (parallel — after T024)
T035              (after T011 + T025–T027)
T036              (after T018 + T028–T031)
T037              (after T024 + T032–T034)
T038              (after T011, T018, T024 — all stores exist)
T039              (after T017 — workspace.store.ts exists)
T040              (after T013 — backoffice auth.store.ts exists)
T041              (after T020 — frontoffice auth.store.ts exists)
T042              (after T011, T018, T024 — all state directories exist)
```

---

## Parallel Execution Examples

**Phase A** (run together):

```
T001 + T002 + T003  →  bun install in all 3 apps simultaneously
T004 + T005         →  shared helper + ESLint rule (independent files)
```

**Phase B** (after T006):

```
T007 + T008 + T009 + T010  →  4 MMC store files in parallel
```

**Phase C** (after T012):

```
T013 + T014 + T015 + T016 + T017  →  5 Backoffice store files in parallel
```

**Phase D** (after T019):

```
T020 + T021 + T022 + T023  →  4 Frontoffice store files in parallel
```

**Phase E** (after stores complete):

```
T025 + T026 + T027          →  MMC unit tests in parallel
T028 + T029 + T030 + T031   →  Backoffice unit tests in parallel
T032 + T033 + T034          →  Frontoffice unit tests in parallel
T035 + T036 + T037          →  Integration bootstrap tests in parallel
T038 + T039 + T040 + T041 + T042  →  Uniqueness check, logging assertion, auth unit tests, cycle check (parallel)
```

---

## Implementation Strategy

**MVP Scope** (User Story 1 minimum viable deliverable): Complete Phase A → Phase B (T001–T011) →
T025–T027 → T035

This delivers the reference MMC store set: all core runtime stores scaffolded, persistence
registered, ESLint enforcement active, and unit + integration tests passing. Backoffice and
Frontoffice can be parallelized against this baselines.

**Incremental delivery order**:

1. Phase A (infrastructure) — unblocks all phases
2. Phase B (MMC) — establishes canonical pattern
3. Phases C + D in parallel — consume established pattern
4. Phase E — validates all phases

---

## Success Criteria Coverage

| SC     | Criterion                                       | Covered By                                            |
| ------ | ----------------------------------------------- | ----------------------------------------------------- |
| SC-001 | Stores instantiate in Node.js without DOM < 3s  | T025–T034                                             |
| SC-002 | Zero .vue files with direct API client imports  | T005 (ESLint rule)                                    |
| SC-003 | Zero stores persist tokens or permissions       | T028, T032 (assert pick)                              |
| SC-004 | All async stores expose `isLoading` + `error`   | T007, T013, T017, T020 (auth + workspace stores only) |
| SC-005 | No state bleed across tests                     | T004 + T025–T034                                      |
| SC-006 | TypeScript strict mode zero errors              | `bun typecheck` on all                                |
| SC-007 | No circular store dependencies                  | T042 (`madge` CI check)                               |
| SC-008 | All persistence has explicit pick list          | T008, T014, T021                                      |
| SC-009 | Core stores registered before first route guard | T035, T036, T037                                      |
| SC-010 | Store ids unique per app                        | T038 (instantiates actual stores)                     |
| SC-011 | Structured logging in all store catch blocks    | T039                                                  |
