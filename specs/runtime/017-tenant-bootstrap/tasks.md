# Tasks: STAGE_17 — Tenant Bootstrap

**Stage:** STAGE_17_TENANT_BOOTSTRAP  
**Phase:** 03 – Backoffice Core / 01 – Foundation  
**Input:** `spec.md`, `plan.md`, `data-model.md`, `research.md`  
**Date:** 2026-02-28  
**Status:** Ready for execution

---

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Parallel-safe — can run concurrently with other [P] tasks in the same phase
- **[USn]**: User story label — maps to US-01 through US-08 in `spec.md`
- Setup/foundational tasks carry no story label
- Every task description includes the exact file path being created or modified

---

## Phase 0: Packages & Types (Foundational — No Story)

**Purpose:** Add shared tenant-RBAC types to `packages/types` before any middleware, route, or
frontend code that imports them. This phase must complete before Phases 2–5.

**Independent test:**
`import { ActionEnum, BackofficeContext, StaffUserContext } from '@zidney/types'` resolves without
error; TypeScript compile passes.

- [x] T001 Create new type file `packages/types/src/tenant-rbac.ts` exporting `ActionEnum`,
      `TenantRBACPermission`, `BackofficeContext`, and `StaffUserContext`
- [x] T002 Update `packages/types/src/index.ts` to add `export * from './tenant-rbac'`

> **Checkpoint:** `@zidney/types` now exports all STAGE_17 tenant-RBAC types. Middleware and
> frontend code can import them.

---

## Phase 1: API — DB Migration (US-07: WebSocket Lifecycle Safety)

**Goal:** Establish the four RBAC tables (`roles`, `role_permissions`, `staff_users`,
`staff_user_roles`) and six indexes in the tenant DB via a single forward-only, idempotent DDL
migration. These tables underpin staff authentication and RBAC enforcement at every layer.

**Independent test:** After running the migration on a fresh tenant DB, all four tables and all six
indexes are present; re-running the migration is a no-op (idempotent via `IF NOT EXISTS`).

- [x] T003 [US-07] Create tenant DB migration
      `apps/api/src/db/tenant/migrations/20260228_001_tenant_rbac_skeleton.ts` — single DDL
      transaction creating `roles`, `role_permissions`, `staff_users`, `staff_user_roles` with all
      constraints and 6 indexes; `down()` throws (forward-only)

> **Checkpoint:** Tenant DB migration file is ready and independently testable.

---

## Phase 2: API — Middleware (US-01: License Gate · US-04: Workspace-Scoped Auth)

**Goal:** Enforce license state on every Backoffice request with structured, correlation-ID-bearing
error responses (US-01); add a per-route RBAC permission guard (US-04); add a lightweight
module-enable guard (US-01).

**Independent test:**

- US-01: License middleware returns 423/403/404 with `correlationId` field in every non-ACTIVE error
  body.
- US-04: RBAC guard returns 403 with `RBAC_PERMISSION_DENIED` when permission is absent; calls
  `next()` when present.
- US-01: Module guard returns 403 with `MODULE_NOT_LICENSED` for disabled modules; calls `next()`
  for enabled ones.

All three tasks are parallel-safe (distinct files, no inter-dependency).

- [x] T004 [P] [US-01] Update `apps/api/src/middleware/license-enforcement.ts` — add
      `correlationId: c.get('correlationId') ?? 'unknown'` to all non-ACTIVE error response bodies
      (SOFT_LOCKED 423, ARCHIVED 403, WORKSPACE_NOT_FOUND 404)
- [x] T005 [P] [US-04] Create `apps/api/src/middleware/backoffice-rbac-guard.ts` —
      `createBackofficeRBACGuard(logger, requiredModule, requiredAction): MiddlewareHandler`
      factory; F-02: check Redis cache key `rbac:{workspace_id}:{user_id}:{module}:{action}` (TTL 30
      s) before DB query; on cache miss queries `role_permissions` via tenant pool; caches result;
      returns 403 `RBAC_PERMISSION_DENIED` with `correlationId` on denial; calls `next()` on success
- [x] T006 [P] [US-01] Create `apps/api/src/middleware/backoffice-module-guard.ts` —
      `createModuleGuard(logger, requiredModule): MiddlewareHandler` factory (M-02: logger is
      mandatory parameter); checks `c.get('enabled_modules')`; emits `logger.warn` with
      workspace/correlation/user fields on every denial; returns 403 `MODULE_NOT_LICENSED` with
      `correlationId` if module absent; calls `next()` if present

> **Checkpoint:** All three middleware functions compile and pass unit tests independently.

---

## Phase 3: API — Routes (US-02: Module-Aware Navigation · US-05: Limit Awareness · US-06: Observability)

**Goal:** Expose the `BackofficeContext` via `GET /api/v1/backoffice/context` (US-02, US-05) and
establish the WebSocket endpoint with license polling and Redis-backed single-connection enforcement
(US-05, US-06).

**Independent test:**

- US-02: `GET /api/v1/backoffice/context` returns 200 with all `BackofficeContext` fields;
  unauthenticated returns 401.
- US-05/US-06: WebSocket handshake accepted for ACTIVE workspace; rejected (1008) for SOFT_LOCKED;
  structured log entry produced with all required fields on every event.

Both tasks are parallel-safe (distinct files).

- [x] T007 [P] [US-02] Create `apps/api/src/routes/backoffice/types.ts` — exports
      `StaffUserContext`, `BackofficeVariables`, and `BackofficeEnv` (Hono `Variables` type map) so
      all `c.get()` calls are fully typed with no `unknown` inferences. Then create
      `apps/api/src/routes/backoffice/context.ts` — exports `backofficeContextRouter` typed as
      `new Hono<BackofficeEnv>()`; handles `GET /backoffice/context`; reads tenant+license context
      from Hono context; returns `BackofficeContext` response; structured logging with
      `workspace_slug`, `workspace_id`, `correlation_id`, `route_name`, `user_id`
- [x] T008 [P] [US-05][US-06] Create `apps/api/src/routes/backoffice/ws.ts` — exports
      `createBackofficeWsRoute()`; F-01: declare `moduleWsRedis = createRedisClient()` at module
      scope (not per-connection); Hono Bun WebSocket upgrade at `/ws/backoffice`; H-02: atomic
      `SET wsKey '1' NX EX ttl` (replaces non-atomic GET+SETEX — prevents TOCTOU race); Redis-backed
      connection registry (`ws:backoffice:{workspace_id}:{user_id}`, TTL = `WS_POLL_MS * 3`);
      license polling every `WS_LICENSE_POLL_INTERVAL_MS` (default 30 000 ms, clamp 5 000–120 000);
      M-01: fail-closed `ws.close(1011)` after `WS_MAX_POLL_FAILURES` (default 3) consecutive poll
      failures; closes with 1008 on non-ACTIVE; structured logging on open/close/error/poll-failure

> **Checkpoint:** Context endpoint and WebSocket route are independently functional.

---

## Phase 4: API — App Wiring (US-01 · US-04)

**Goal:** Register the full Backoffice middleware chain in `app.ts` and mount all new routes. This
is a blocking sequential step — all Phase 2–3 files must exist before this wiring task.

**Independent test:** `GET /api/v1/backoffice/context` traverses the full chain (correlationId →
tenantResolver → licenseEnforcement → schemaVersion → rateLimit → authentication) and responds
correctly; `POST /ws/backoffice` handshake traverses the WebSocket chain (correlationId →
tenantResolver → licenseEnforcement → authentication).

- [x] T009 [US-01][US-04] Update `apps/api/src/app.ts` — mount `/api/v1/backoffice/*` middleware
      chain (correlationId → tenantResolver → licenseEnforcement → schemaVersion → rateLimit(max:60)
      → authentication); mount separate `/ws/backoffice` chain including H-01 fix:
      `createRateLimitMiddleware({max:10, keyPrefix:'backoffice-ws'})` before authentication;
      register `backofficeContextRouter` under `/api/v1`; register `createBackofficeWsRoute()`

> **Checkpoint:** Full Backoffice API is wired. All middleware and routes are reachable.

---

## Phase 5: Frontend Scaffold (US-02: Module-Aware Navigation · US-03: RBAC · US-08: Layout)

**Goal:** Bootstrap the `apps/backoffice` Vue 3 SPA from scratch (no prior source files), including
project config, context store, RBAC-aware router, module-driven layout, and license-gate views.

### Phase 5a — Project Configuration

**Independent test:** `bun install` succeeds; `bun run dev` starts the Vite dev server without
TypeScript errors.

- [x] T010 [US-02][US-03] Create `apps/backoffice/package.json` — Vue 3 + Vite + TypeScript project
      config; versions aligned with `apps/mmc/package.json`; dependencies: `vue`, `vue-router`,
      `pinia`, `@zidney/types`, `@zidney/ui-system`; dev dependencies: `vite`, `@vitejs/plugin-vue`,
      `typescript`
- [x] T011 [P] [US-02][US-03] Create `apps/backoffice/vite.config.ts` — Vite config with
      `@vitejs/plugin-vue`; path alias `@/ → src/`; `/api` proxy to API server; `@zidney/*` resolved
      from `packages/`
- [x] T012 [P] [US-02][US-03] Create `apps/backoffice/tsconfig.json` — TypeScript config extending
      workspace `tsconfig.base.json`; references `tsconfig.app.json`
- [x] T013 [P] [US-02][US-03] Create `apps/backoffice/tsconfig.app.json` — app-specific TypeScript
      config; `include: ["src/**/*"]`; strict mode enabled
- [x] T014 [P] [US-02][US-03] Create `apps/backoffice/index.html` — SPA entry HTML; mounts `#app`;
      imports `src/main.ts`

> **Checkpoint:** Project config is complete; scaffolding tasks can proceed.

### Phase 5b — Core Vue Layer

**Independent test:** `useBackofficeContext()` composable returns reactive `BackofficeContext` or
`null`; `useContextStore()` exposes `loadContext()`, `enabledModules`, `licenseStatus`,
`hasModule()`.

- [x] T015 [P] [US-02] Create `apps/backoffice/src/App.vue` — root component; contains
      `<RouterView />`; no business logic
- [x] T016 [P] [US-02] Create `apps/backoffice/src/composables/useBackofficeContext.ts` — fetches
      `GET /api/v1/backoffice/context` with `credentials: 'include'`; returns reactive
      `BackofficeContext | null`; uses `@zidney/types` `BackofficeContext` type
- [x] T017 [US-02] Create `apps/backoffice/src/stores/context.ts` — Pinia store `useContextStore`;
      state: `context`, `loading`, `error`; computed: `isActive`, `enabledModules`, `licenseStatus`,
      `licenseErrorCode`; actions: `loadContext()` (delegates to composable), `clearContext()`;
      exports `hasModule(module: Module): boolean`

> **Checkpoint:** Context store is functional; router and layout can consume it.

### Phase 5c — Router & Layout

**Independent test:**

- Router redirects to `/unavailable?code=LICENSE_SOFT_LOCKED` when `isActive` is false.
- Router redirects to dashboard when route's `meta.requiredModule` is absent from `enabledModules`.
- `BackofficeLayout.vue` renders only nav items for modules in `enabledModules`; no hardcoded module
  names in source.

- [x] T018 [P] [US-03][US-08] Create `apps/backoffice/src/router/index.ts` — Vue Router v4 with
      `createWebHistory()`; routes: `dashboard` (`/`), `workspace-unavailable` (`/unavailable`);
      navigation guard: load context if absent → license gate (`isActive` false → redirect to
      `/unavailable?code=…`) → module gate (`meta.requiredModule` not in `enabledModules` → redirect
      dashboard)
- [x] T019 [P] [US-03] Create `apps/backoffice/src/layouts/BackofficeLayout.vue` — composes
      `AppLayout`, `SidebarLayout`, `TopBar` from `@zidney/ui-system`; maps
      `useContextStore().enabledModules` to `SidebarLayout` items using `MODULE_LABELS` from
      `@zidney/types`; no hardcoded module names; Tailwind v4 utilities; no hardcoded brand colors
- [x] T020 [US-03] Create `apps/backoffice/src/components/Sidebar.vue` — sidebar component filtered
      by `enabledModules` and RBAC permissions from `useContextStore()`; wraps `SidebarLayout` from
      `@zidney/ui-system`; collapsible; data-driven nav items only

> **Checkpoint:** Router and layout are functional; views can be dropped in independently.

### Phase 5d — Views

**Independent test:** Each view renders correct heading and message copy for its error code variant
without additional API calls.

- [x] T021 [P] [US-08] Create `apps/backoffice/src/views/WorkspaceLocked.vue` — 423
      `LICENSE_SOFT_LOCKED` workspace-suspended screen; uses shadcn-vue components; Tailwind v4; no
      hardcoded brand colors
- [x] T022 [P] [US-08] Create `apps/backoffice/src/views/WorkspaceForbidden.vue` — 403
      `LICENSE_ARCHIVED` workspace-archived screen; uses shadcn-vue components; Tailwind v4; no
      hardcoded brand colors
- [x] T023 [P] [US-02] Create `apps/backoffice/src/views/Dashboard.vue` — placeholder landing page
      rendered on `/`; reads `workspace_slug` from `useContextStore()` for display; no hardcoded
      workspace identity

> **Checkpoint:** All views render their target state independently.

### Phase 5e — App Entry Point

**Independent test:** `bun run build` produces no TypeScript errors; `main.ts` wires app, pinia, and
router correctly.

- [x] T024 [US-02] Create `apps/backoffice/src/main.ts` — Vue 3 app entry point; calls
      `createApp(App)`; installs `createPinia()` and `router`; mounts to `#app`; calls
      `contextStore.loadContext()` before first render via `beforeEach` guard (or router.isReady)

> **Checkpoint:** Frontend SPA is fully scaffolded and bootable.

---

## Phase 6: Tests (US-01 · US-02 · US-07)

**Goal:** Validate all new and modified middleware, the context API endpoint, and the RBAC
migration. All test tasks are independent and parallel-safe.

**Tests explicitly specified in stage summary — all are mandatory for this stage.**

- [x] T025 [P] [US-01] Create `tests/unit/middleware/backoffice-rbac-guard.test.ts` — unit tests:
      (a) 403 + `RBAC_PERMISSION_DENIED` when user lacks permission; (b) `next()` on valid role; (c)
      `correlationId` in all 403 bodies; (d) Redis cache hit returning `'1'` calls `next()` without
      DB query; (e) cache hit returning `'0'` returns 403 without DB query; (f) cache miss executes
      DB query and stores result in Redis; (g) stale role (role deleted mid-session, DB returns no
      rows) returns 403
- [x] T026 [P] [US-01] Create `tests/unit/middleware/backoffice-module-guard.test.ts` — unit tests:
      (a) 403 + `MODULE_NOT_LICENSED` when module absent; (b) `next()` called when module present;
      (c) `correlationId` in error body; (d) `logger.warn` emitted with correct fields (`module`,
      `workspace_id`, `workspace_slug`, `correlation_id`, `user_id`, `route_name`) on every denial
      (M-02 verification)
- [x] T027 [P] [US-01] Update `tests/unit/middleware/license-enforcement.test.ts` — add assertions
      verifying `correlationId` field is present in all non-ACTIVE error responses (SOFT_LOCKED 423,
      ARCHIVED 403, WORKSPACE_NOT_FOUND 404)
- [x] T028 [P] [US-02] Create `tests/integration/api/backoffice/context.test.ts` — integration
      tests: (a) 200 with all 9 BackofficeContext fields for ACTIVE workspace + valid JWT; (b) 401
      when no JWT; (c) 403 `RBAC_PERMISSION_DENIED` when RBAC guard blocks; (d) 403
      `MODULE_NOT_LICENSED` when module disabled (discriminated from RBAC deny); (e) 423
      `LICENSE_SOFT_LOCKED` for soft-locked workspace; (f) 403 `LICENSE_ARCHIVED` for archived
      workspace; (g) 404 `WORKSPACE_NOT_FOUND` for nonexistent workspace; (h) 426
      `SCHEMA_VERSION_INCOMPATIBLE` response when schema version mismatch; (i) cross-workspace JWT
      (AC-08): JWT scoped to workspace-A presented to workspace-B → 401; (j) incremented
      `token_version` JWT (AC-12) → 401
- [x] T029 [P] [US-07] Create `tests/unit/db/migrations/tenant-rbac-skeleton.test.ts` — migration
      tests: all 4 tables created after `up()`; all 6 indexes present; unique constraints enforced
      on `role_permissions.(role_id, module, action)` and
      `staff_user_roles.(staff_user_id, role_id)`; migration is idempotent (safe to run twice);
      `down()` throws
- [x] T030 [P] [US-05][US-06][US-07] Create `tests/integration/api/backoffice/ws.test.ts` —
      WebSocket lifecycle tests: (a) ACTIVE workspace + valid JWT → handshake accepted, structured
      log emitted; (b) SOFT_LOCKED workspace → refused (close 1008); (c) invalid JWT → refused; (d)
      duplicate connection (same user) → rejected 1008 `DUPLICATE_CONNECTION` (atomic SET NX
      verification); (e) license transitions SOFT_LOCKED mid-session → existing connection closed
      1008; (f) poll failure accumulation (`MAX_POLL_FAILURES` threshold) → fail-closed 1011 (M-01
      verification); (g) WS disconnect → Redis wsKey deleted (`onClose` cleanup)
- [x] T031 [P] Create `tests/integration/isolation/backoffice-isolation.test.ts` — tenant isolation
      tests: (a) no Backoffice handler imports or references `master_db` pool (static analysis or
      integration assert; AC-05, FR-10.1); (b) RBAC query scoped to tenant DB only — no cross-tenant
      join possible (FR-10.2); (c) context endpoint returns data from correct tenant DB when
      multiple tenants exist

> **Checkpoint:** All tests pass; lint and type-check pass. Stage STAGE_17 is complete.

---

## Dependencies & Execution Order

### Phase Dependency Graph

```
Phase 0 (T001→T002)
    ↓ (types available)
Phase 1 (T003) ──────────────── independent of Phase 0 (no type imports in migration)
    │
Phase 2 (T004, T005, T006)
    │   └─ T004 independent; T005+T006 require Phase 0
    ↓
Phase 3 (T007, T008)
    │   └─ both require Phase 0; T008 also requires Phase 1 (staff_users via auth context)
    ↓
Phase 4 (T009) ─ requires all of Phase 2 + Phase 3
    │
Phase 5a (T010→T011/T012/T013/T014)
Phase 5b (T015, T016 → T017) ─ T016 requires Phase 0 types
Phase 5c (T018, T019 → T020) ─ requires T017
Phase 5d (T021, T022, T023)  ─ requires T010 only
Phase 5e (T024) ─ requires T015 + T017 + T018
    │
Phase 6 (T025–T029) ─ each test phase requires its corresponding impl task
```

### Non-Obvious Ordering Decisions

1. **T003 (migration) before T008 (ws.ts)**: The WebSocket handler depends on `staff_user` context
   being available from authentication middleware, which reads from `staff_users` table. The
   migration must exist (and be registered in the migration runner) before the WebSocket route is
   wired in `app.ts`. T003 is therefore ordered before T008 even though no direct TypeScript import
   relationship exists.

2. **T004 (license-enforcement UPDATE) parallel with T005/T006**: Although T005 and T006 technically
   depend on T001+T002 (type imports), T004 modifies an existing file with no new type imports — it
   can run concurrently with T001 and T003 in the same first working batch.

3. **T009 (app.ts) is a hard sequential gate**: All middleware (T004–T006) and all route files
   (T007–T008) must be created before `app.ts` is updated. Attempting app wiring with a missing file
   causes a TypeScript import error that blocks the entire API build.

4. **T010 (package.json) before T011–T014**: Vite config, tsconfig files, and `index.html` all
   reference package identifiers or scripts defined in `package.json`. T011–T014 can run in parallel
   with each other but only after T010.

5. **T016 (composable) before T017 (store)**: The Pinia store (`backofficeContext.ts`) delegates the
   fetch concern to `useBackofficeContext` composable. T017 must come after T016. T015 (App.vue) and
   T016 are parallel-safe.

6. **T018 (router) and T019 (layout) parallel after T017**: Both consume `useContextStore()` and
   `@zidney/types` but have no dependency on each other. T020 (Sidebar) waits for T019
   (BackofficeLayout) to define the layout slot contract.

7. **T024 (main.ts) is the final frontend integration task**: It wires `App.vue` (T015), the Pinia
   store (T017), and the router (T018) together. It must be last in the frontend sequence.

8. **T025–T029 are all parallel in Phase 6**: Each test file targets a distinct implementation file
   in earlier phases. All five can be developed concurrently once their respective implementation
   dependencies are complete.

---

## Parallel Execution Examples

### First Working Batch (no prerequisites)

```bash
# Run simultaneously:
T001  # packages/types/src/tenant-rbac.ts
T003  # DB migration
T004  # license-enforcement.ts update
T010  # apps/backoffice/package.json
```

### After T001 + T002 Complete

```bash
# Run simultaneously:
T005  # backoffice-rbac-guard.ts
T006  # backoffice-module-guard.ts
T007  # context.ts route
T016  # useBackofficeContext.ts composable
```

### After T005 + T006 + T007 + T008 Complete

```bash
T009  # app.ts wiring (sequential — must follow all above)
```

### Phase 6 Test Batch (after all impl phases)

```bash
# Run simultaneously:
T025  # rbac-guard.test.ts
T026  # module-guard.test.ts
T027  # license-enforcement.test.ts (update)
T028  # context.test.ts (integration)
T029  # tenant-rbac-skeleton.test.ts (migration)
```

---

## Implementation Strategy

**MVP Scope (suggested minimum shippable unit):** Phases 0–4 (T001–T009) — delivers a functioning
Backoffice API with license enforcement, module guarding, RBAC middleware, and the runtime context
endpoint. The frontend scaffold (Phase 5) can follow independently.

**Incremental delivery order:**

1. Phase 0 → unblocks everything
2. Phase 1 + Phase 2 (parallel) → unblocks Phase 3
3. Phase 3 (parallel) → unblocks Phase 4
4. Phase 4 → API layer complete
5. Phase 5 (a → b → c → d → e) → frontend complete
6. Phase 6 (all parallel) → full test coverage

---

## Story Coverage Summary

| User Story                | Phase(s)        | Tasks                                          | Independent Test                                                        |
| ------------------------- | --------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| US-01 License Gate        | 2, 4, 6         | T004, T006, T009, T025, T026, T027             | License middleware returns 423/403/404 with `correlationId`             |
| US-02 Module Navigation   | 3, 4, 5b, 5e, 6 | T007, T009, T015, T016, T017, T023, T024, T028 | Context endpoint returns `enabled_modules`; store exposes `hasModule()` |
| US-03 RBAC                | 2, 4, 5c        | T005, T009, T018, T019, T020                   | 403 on denied permission; `next()` on granted                           |
| US-04 Workspace Auth      | 2, 4            | T005, T009                                     | Cross-workspace JWT rejected; valid JWT proceeds                        |
| US-05 Limit Awareness     | 3               | T008                                           | `student_limit` and `staff_limit` in context response                   |
| US-06 Observability       | 3               | T008                                           | All log entries contain required structured fields                      |
| US-07 WebSocket Lifecycle | 1, 3, 6         | T003, T008, T029                               | WS rejected on non-ACTIVE; polling terminates suspended session         |
| US-08 Module-Aware Layout | 5c, 5d          | T018, T019, T021, T022                         | Sidebar renders only licensed modules; no hardcoded names               |
