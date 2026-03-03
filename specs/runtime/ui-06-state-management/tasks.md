# Tasks — UI State Management Architecture

**Feature**: STAGE_UI_06_STATE_MANAGEMENT
**Branch**: `ui-06-state-management`
**Phase**: 06_UI_APPLICATION_RUNTIME
**Produced**: 2026-03-03
**Status**: Ready for Implementation

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

> No user story label. Blocking prerequisites for all phases.
> Independent test: `bun install` resolves; `bun lint` exits 0; `tests/unit/store-test-helper.ts` imports cleanly in any test file.

- [ ] T001 Install `pinia-plugin-persistedstate@^4.2.0` in `apps/mmc/package.json` (add to `dependencies`, run `bun install`)
- [ ] T002 [P] Install `pinia-plugin-persistedstate@^4.2.0` in `apps/backoffice/package.json` (add to `dependencies`, run `bun install`)
- [ ] T003 [P] Install `pinia-plugin-persistedstate@^4.2.0` in `apps/frontoffice/package.json` (add to `dependencies`, run `bun install`)
- [ ] T004 Create shared store test helper at `tests/unit/store-test-helper.ts` (exports `useIsolatedPinia()` wrapping `setActivePinia(createPinia())` in `beforeEach`)
- [ ] T005 Update root ESLint config at `eslint.config.mjs` — add `no-restricted-imports` rule block forbidding `@zidney/api-client` imports in `apps/**/*.vue` files (FR-008, SC-002)

---

## Phase B — MMC Stores (Reference Implementation)

> Story coverage: US1, US2, US4, US5
> Independent test: All MMC stores can be instantiated with `setActivePinia(createPinia())` in a Node-only environment; `useMmcAppStore` persists only `sidebarCollapsed`, `theme`, `locale`.

### B1 — Bootstrap

- [ ] T006 [US1] Update `apps/mmc/src/main.ts` — import `createPersistedState` from `pinia-plugin-persistedstate`, call `pinia.use(createPersistedState())` immediately after `createPinia()` and before any store instantiation (FR-021, FR-034)

### B2 — Store Files

- [ ] T007 [P] [US1] Update `apps/mmc/src/core/state/auth.store.ts` — rename `defineStore` id from `'auth'` to `'mmc-auth'` (FR-032); no other structural change
- [ ] T008 [P] [US1] [US4] [US5] Create `apps/mmc/src/core/state/app.store.ts` — store id `'mmc-app'`, export `useMmcAppStore`; state: `sidebarCollapsed`, `theme`, `locale`, `isLoading`, `error`; actions: `setSidebarCollapsed`, `setTheme`, `setLocale`, `clearError`, `$reset`; persist `pick: ['sidebarCollapsed', 'theme', 'locale']` (FR-022, FR-024)
- [ ] T009 [P] [US1] [US2] Create `apps/mmc/src/core/state/ui.store.ts` — store id `'mmc-ui'`, export `useMmcUiStore`; state: `modals`, `drawers`, `overlayVisible`; actions: `openModal`, `closeModal`, `toggleModal`, `openDrawer`, `closeDrawer`, `toggleDrawer`, `showOverlay`, `hideOverlay`, `closeAll`, `$reset`; no persistence (FR-020)
- [ ] T010 [P] [US1] [US2] [US5] Create `apps/mmc/src/core/state/notification.store.ts` — store id `'mmc-notification'`, export `useMmcNotificationStore`; state: `notifications: AppNotification[]`; actions: `push` (returns generated uuid), `dismiss`, `clearAll`, `$reset`; define `AppNotification` interface locally; no persistence (FR-020)
- [ ] T011 [US1] Update `apps/mmc/src/core/state/index.ts` — re-export `defineAuthStore`, `useMmcAppStore`, `useMmcUiStore`, `useMmcNotificationStore`, `useLicenseStatusStore`, and `type AppNotification`

---

## Phase C — Backoffice Stores

> Story coverage: US1, US2, US3, US4, US5
> Independent test: All Backoffice stores instantiate in isolation; `useBackofficeWorkspaceStore.loadWorkspace` resolves from stub without error; `pending['loadWorkspace']` transitions correctly; no auth keys appear in `persist.pick`.

### C1 — Bootstrap

- [ ] T012 [US1] Update `apps/backoffice/src/main.ts` — register `pinia-plugin-persistedstate` plugin via `pinia.use(createPersistedState())` immediately after `createPinia()` (same pattern as T006; FR-021, FR-034)

### C2 — Store Files

- [ ] T013 [P] [US1] Update `apps/backoffice/src/core/state/auth.store.ts` — replace incomplete draft with `defineAuthStore(...)` factory pattern; store id `'backoffice-auth'`; identical state shape to MMC auth store (`isAuthenticated`, `user`, `isLoading`, `authError`); inject router, tokenManager, authService via factory args; no persistence (FR-026, FR-027)
- [ ] T014 [P] [US1] [US4] [US5] Create `apps/backoffice/src/core/state/app.store.ts` — store id `'backoffice-app'`, export `useBackofficeAppStore`; identical structure to `apps/mmc/src/core/state/app.store.ts`; persist `pick: ['sidebarCollapsed', 'theme', 'locale']` (FR-022, FR-024)
- [ ] T015 [P] [US1] [US2] Create `apps/backoffice/src/core/state/ui.store.ts` — store id `'backoffice-ui'`, export `useBackofficeUiStore`; identical structure to `apps/mmc/src/core/state/ui.store.ts`; no persistence (FR-020)
- [ ] T016 [P] [US1] [US2] [US5] Create `apps/backoffice/src/core/state/notification.store.ts` — store id `'backoffice-notification'`, export `useBackofficeNotificationStore`; identical structure to `apps/mmc/src/core/state/notification.store.ts`; no persistence (FR-020)
- [ ] T017 [US1] [US3] [US5] Create `apps/backoffice/src/core/state/workspace.store.ts` — store id `'backoffice-workspace'`, export `useBackofficeWorkspaceStore`; state: `workspace: WorkspaceContext | null`, `isLoading`, `pending: Record<string, boolean>`, `error: AppError | null`; define `WorkspaceContext` interface; implement `loadWorkspace(slug)` as structural stub with early-return concurrent call guard (`if (pending.value['loadWorkspace']) return`; FR-016 M-03 contract); actions: `clearError`, `$reset`; no persistence (FR-020)
- [ ] T018 [US1] Update `apps/backoffice/src/core/state/index.ts` — re-export `defineAuthStore`, `useBackofficeAppStore`, `useBackofficeUiStore`, `useBackofficeNotificationStore`, `useBackofficeWorkspaceStore`, `useLicenseStatusStore`, and types `AppNotification`, `WorkspaceContext`

---

## Phase D — Frontoffice Stores

> Story coverage: US1, US2, US4, US5
> Independent test: All Frontoffice stores instantiate in isolation; `useFrontofficeAppStore` persists only `sidebarCollapsed`, `theme`, `locale`; no token or permission keys appear in any `persist.pick`.

### D1 — Bootstrap

- [ ] T019 [US1] Update `apps/frontoffice/src/main.ts` — register `pinia-plugin-persistedstate` plugin via `pinia.use(createPersistedState())` immediately after `createPinia()` (same pattern as T006 and T012; FR-021, FR-034)

### D2 — Store Files

- [ ] T020 [P] [US1] Update `apps/frontoffice/src/core/state/auth.store.ts` — replace incomplete draft with `defineAuthStore(...)` factory pattern; store id `'frontoffice-auth'`; identical state shape to Backoffice auth store; no persistence (FR-026, FR-027)
- [ ] T021 [P] [US1] [US4] [US5] Create `apps/frontoffice/src/core/state/app.store.ts` — store id `'frontoffice-app'`, export `useFrontofficeAppStore`; identical structure to MMC/Backoffice app store; persist `pick: ['sidebarCollapsed', 'theme', 'locale']` (FR-022, FR-024)
- [ ] T022 [P] [US1] [US2] Create `apps/frontoffice/src/core/state/ui.store.ts` — store id `'frontoffice-ui'`, export `useFrontofficeUiStore`; identical structure to MMC/Backoffice ui store; no persistence (FR-020)
- [ ] T023 [P] [US1] [US2] [US5] Create `apps/frontoffice/src/core/state/notification.store.ts` — store id `'frontoffice-notification'`, export `useFrontofficeNotificationStore`; identical structure to MMC/Backoffice notification store; no persistence (FR-020)
- [ ] T024 [US1] Update `apps/frontoffice/src/core/state/index.ts` — re-export `defineAuthStore`, `useFrontofficeAppStore`, `useFrontofficeUiStore`, `useFrontofficeNotificationStore`, `useLicenseStatusStore`, and `type AppNotification`

---

## Phase E — Validation

> Story coverage: US1–US5 (full coverage verification)
> Independent test: All unit tests pass in a Node-only environment; integration tests verify bootstrap order; uniqueness test confirms no duplicate store ids.

### E1 — MMC Unit Tests

- [ ] T025 [P] [US1] [US5] Create `apps/mmc/tests/unit/stores/app.store.test.ts` — test coverage: default state init; `setSidebarCollapsed`, `setTheme`, `setLocale` mutations; `clearError()` zeroes error; `$reset()` restores all fields; state isolation via `setActivePinia(createPinia())` in `beforeEach` (FR-028, FR-030, SC-001)
- [ ] T026 [P] [US1] [US2] Create `apps/mmc/tests/unit/stores/ui.store.test.ts` — test coverage: default state init; `openModal`/`closeModal`/`toggleModal`; `openDrawer`/`closeDrawer`/`toggleDrawer`; `showOverlay`/`hideOverlay`; `closeAll` clears all registries; `$reset()` restores initial state; state isolation
- [ ] T027 [P] [US1] [US2] [US5] Create `apps/mmc/tests/unit/stores/notification.store.test.ts` — test coverage: `push` returns uuid and appends to queue; `dismiss(id)` removes only matching notification; `clearAll` empties queue; multiple concurrent notifications are independently dismissible; `$reset` restores empty queue

### E2 — Backoffice Unit Tests

- [ ] T028 [P] [US1] [US5] Create `apps/backoffice/tests/unit/stores/app.store.test.ts` — same coverage requirements as T025; assert `persist.pick` contains exactly `['sidebarCollapsed', 'theme', 'locale']` and no auth-related keys (SC-003, FR-023)
- [ ] T029 [P] [US1] [US2] Create `apps/backoffice/tests/unit/stores/ui.store.test.ts` — same coverage requirements as T026
- [ ] T030 [P] [US1] [US2] [US5] Create `apps/backoffice/tests/unit/stores/notification.store.test.ts` — same coverage requirements as T027
- [ ] T031 [P] [US1] [US3] [US5] Create `apps/backoffice/tests/unit/stores/workspace.store.test.ts` — test coverage: default state (`workspace === null`, `isLoading === false`, `pending === {}`, `error === null`); `loadWorkspace` sets `pending['loadWorkspace']` to `true` during action and `false` after; `isLoading` transitions correctly; concurrent guard prevents duplicate execution; on simulated error sets `error` as `AppError` instance and `isLoading` to `false`; `clearError()` zeroes error; `$reset()` restores all fields

### E3 — Frontoffice Unit Tests

- [ ] T032 [P] [US1] [US5] Create `apps/frontoffice/tests/unit/stores/app.store.test.ts` — same coverage requirements as T025 and T028 (including persistence key assertion)
- [ ] T033 [P] [US1] [US2] Create `apps/frontoffice/tests/unit/stores/ui.store.test.ts` — same coverage requirements as T026
- [ ] T034 [P] [US1] [US2] [US5] Create `apps/frontoffice/tests/unit/stores/notification.store.test.ts` — same coverage requirements as T027

### E4 — Integration & CI Tests

- [ ] T035 [US1] [US4] Create `apps/mmc/tests/integration/pinia-bootstrap.test.ts` — verify: `createPinia()` called exactly once; `pinia-plugin-persistedstate` registered before `app.mount()`; auth store instantiated before first route guard fires; `useMmcAppStore` persist config includes exactly `['sidebarCollapsed', 'theme', 'locale']`; auth store has no persisted keys (SC-009, FR-034)
- [ ] T036 [P] [US1] [US4] Create `apps/backoffice/tests/integration/pinia-bootstrap.test.ts` — same bootstrap verification as T035 for Backoffice app; assert `useBackofficeWorkspaceStore` is available post-init; auth store has no persisted keys (SC-009)
- [ ] T037 [P] [US1] [US4] Create `apps/frontoffice/tests/integration/pinia-bootstrap.test.ts` — same bootstrap verification as T035 for Frontoffice app; assert auth store has no persisted keys (SC-009)
- [ ] T038 Create `tests/unit/store-id-uniqueness.test.ts` — assert all 13 store ids (`mmc-auth`, `mmc-app`, `mmc-ui`, `mmc-notification`, `backoffice-auth`, `backoffice-app`, `backoffice-ui`, `backoffice-notification`, `backoffice-workspace`, `frontoffice-auth`, `frontoffice-app`, `frontoffice-ui`, `frontoffice-notification`) are unique (Set.size === array.length); no two apps share an id (FR-032, SC-010)

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
```

---

## Implementation Strategy

**MVP Scope** (User Story 1 minimum viable deliverable):
Complete Phase A → Phase B (T001–T011) → T025–T027 → T035

This delivers the reference MMC store set: all core runtime stores scaffolded, persistence registered, ESLint enforcement active, and unit + integration tests passing. Backoffice and Frontoffice can be parallelized against this baselines.

**Incremental delivery order**:

1. Phase A (infrastructure) — unblocks all phases
2. Phase B (MMC) — establishes canonical pattern
3. Phases C + D in parallel — consume established pattern
4. Phase E — validates all phases

---

## Success Criteria Coverage

| SC     | Criterion                                       | Covered By               |
| ------ | ----------------------------------------------- | ------------------------ |
| SC-001 | Stores instantiate in Node.js without DOM < 3s  | T025–T034                |
| SC-002 | Zero .vue files with direct API client imports  | T005 (ESLint rule)       |
| SC-003 | Zero stores persist tokens or permissions       | T028, T032 (assert pick) |
| SC-004 | All async stores expose `isLoading` + `error`   | T008, T017, T021         |
| SC-005 | No state bleed across tests                     | T004 + T025–T034         |
| SC-006 | TypeScript strict mode zero errors              | `bun typecheck` on all   |
| SC-007 | No circular store dependencies                  | FR-033 + T038            |
| SC-008 | All persistence has explicit pick list          | T008, T014, T021         |
| SC-009 | Core stores registered before first route guard | T035, T036, T037         |
| SC-010 | Store ids unique per app                        | T038                     |
