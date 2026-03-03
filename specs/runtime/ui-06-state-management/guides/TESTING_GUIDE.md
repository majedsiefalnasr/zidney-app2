# Testing Guide — STAGE_UI_06_STATE_MANAGEMENT

**Stage:** STAGE_UI_06_STATE_MANAGEMENT  
**Branch:** `ui-06-state-management`  
**Phase:** 06_UI_APPLICATION_RUNTIME  
**For:** QA Engineers, Reviewing Engineers  
**Generated:** 2025-01-16

---

## What Was Delivered

This stage implemented a complete Pinia 2 state management layer for three Zidney applications: **MMC**, **Backoffice**, and **Frontoffice**. Key changes:

1. `pinia-plugin-persistedstate` registered in all three app bootstraps
2. Auth store IDs namespaced per app to prevent cross-app collision
3. New stores delivered: `app`, `ui`, `notification` in all apps; `workspace` in Backoffice only
4. ESLint import firewall for `@zidney/api-client` in frontend layers
5. Comprehensive test coverage: unit, integration, and global CI tests

---

## Running All Stage Tests

### Prerequisites

```bash
# From repo root
bun install
```

### Run All Stage-Scoped Tests (Recommended)

```bash
# Global CI tests (store IDs + no-console enforcement)
bunx vitest run tests/unit/store-id-uniqueness.test.ts tests/unit/no-console-in-stores.test.ts

# Per-app store unit tests
cd apps/mmc && bunx vitest run tests/unit/stores/
cd apps/backoffice && bunx vitest run tests/unit/stores/
cd apps/frontoffice && bunx vitest run tests/unit/stores/

# Per-app integration tests
cd apps/backoffice && bunx vitest run tests/integration/pinia-bootstrap.test.ts
cd apps/frontoffice && bunx vitest run tests/integration/pinia-bootstrap.test.ts
cd apps/mmc && bunx vitest run tests/integration/pinia-bootstrap.test.ts

# Store cycle detection
bun /path/to/scripts/check-store-cycles.ts
# Or from repo root: bun run check:store-cycles
```

### Expected Results

| Test Suite              | Location                                                     | Expected           |
| ----------------------- | ------------------------------------------------------------ | ------------------ |
| Store ID uniqueness     | `tests/unit/store-id-uniqueness.test.ts`                     | 3 / 3 pass         |
| No console in stores    | `tests/unit/no-console-in-stores.test.ts`                    | 5 / 5 pass         |
| MMC store unit          | `apps/mmc/tests/unit/stores/`                                | 27 / 27 pass       |
| Backoffice store unit   | `apps/backoffice/tests/unit/stores/`                         | 46 / 46 pass       |
| Frontoffice store unit  | `apps/frontoffice/tests/unit/stores/`                        | 36 / 36 pass       |
| MMC integration         | `apps/mmc/tests/integration/pinia-bootstrap.test.ts`         | 7 / 7 pass         |
| Backoffice integration  | `apps/backoffice/tests/integration/pinia-bootstrap.test.ts`  | 16 / 16 pass       |
| Frontoffice integration | `apps/frontoffice/tests/integration/pinia-bootstrap.test.ts` | 12 / 12 pass       |
| Store cycle detection   | `scripts/check-store-cycles.ts`                              | PASS (zero cycles) |

---

## Manual Test Scenarios

### Scenario 1 — Auth Store ID Namespacing

**Goal:** Verify that auth store IDs are unique per app and do not collide.

**Steps:**

1. In a browser with MMC running locally, open DevTools → Application → Local Storage
2. Observe there is no `auth` key (bare, un-namespaced)
3. The auth store for MMC is `mmc-auth`, for Backoffice `backoffice-auth`, for Frontoffice `frontoffice-auth`
4. Confirm no persistence key leaks auth tokens into localStorage (auth stores have `persist: false`)

**Expected:** Each app's auth store uses its own namespaced ID. No auth tokens stored in localStorage.

---

### Scenario 2 — App Store Persistence

**Goal:** Verify sidebarCollapsed, theme, and locale survive page reload.

**Steps (MMC):**

1. Open MMC in browser
2. Collapse the sidebar
3. Change theme to `dark` (if theme switcher is visible in this stage)
4. Reload the page
5. Confirm sidebar collapsed state is **preserved**
6. Open DevTools → Application → Local Storage → look for key `mmc-app`
7. Confirm the stored JSON contains `sidebarCollapsed: true` and `theme: "dark"` but **no user/token fields**

**Expected:** sidebarCollapsed, theme, locale persisted; auth data absent.

**Repeat for:** Backoffice (`backoffice-app` key) and Frontoffice (`frontoffice-app` key).

---

### Scenario 3 — UI Store Modal/Drawer Isolation

**Goal:** Verify modal and drawer state is not persisted and is fully reactive.

**Steps:**

1. Open a modal in the app
2. Reload the page
3. Confirm **no modals are open** after reload (state is not persisted)
4. Confirm `closeAll()` closes all open modals and drawers simultaneously when called

**Expected:** UI store is ephemeral (no `persist` config); fresh state on each page load.

---

### Scenario 4 — Notification Store Queue Operations

**Goal:** Verify notifications can be pushed and dismissed independently.

**Steps (Backoffice):**

1. Programmatically push 3 notifications (via `useBackofficeNotificationStore().push(...)` in dev console or through a UI trigger)
2. Confirm all 3 appear in the notification queue
3. Dismiss notification #2 by its UUID
4. Confirm notifications #1 and #3 remain; #2 is gone
5. Call `clearAll()` and confirm the queue is empty

**Expected:** Each notification has a stable UUID; dismiss is targeted; clearAll drains queue.

---

### Scenario 5 — Workspace Store (Backoffice Only)

**Goal:** Verify the workspace store sets `isLoading` correctly and handles errors.

**Steps:**

1. In a Backoffice browser session, observe the `useBackofficeWorkspaceStore()` state via Vue DevTools
2. Trigger `loadWorkspace()` — observe `isLoading: true` during the call, `isLoading: false` after
3. Simulate a failure (e.g., kill the API, reload) — confirm:
   - `isLoading` returns to `false`
   - `error` field is populated with an `AppError` object with `code: 'WORKSPACE_LOAD_FAILED'`
   - The user-visible error message is generic (not an internal error detail)
4. Check browser console — confirm **no** `console.log` or `console.error` calls from store files
5. Check server logs — confirm structured log entry with `error_code: 'WORKSPACE_LOAD_FAILED'` and `internal_message` (server-side only)

**Expected:** Loading state transitions correctly; errors are handled gracefully; no sensitive details reach the client.

---

### Scenario 6 — localStorage Quota Exceeded Resilience

**Goal:** Verify the app does not crash when localStorage is full.

**Steps:**

1. Open MMC in browser, open DevTools Console
2. Fill localStorage: `for(let i=0;i<1000;i++){try{localStorage.setItem('fill'+i, 'x'.repeat(10000))}catch(e){}}`
3. Trigger a store state change that would normally persist (e.g., collapse sidebar)
4. Confirm **no unhandled exceptions** in the console
5. Confirm the app continues to function normally

**Expected:** `pinia-plugin-persistedstate` handles the `QuotaExceededError` gracefully; app does not crash.

---

### Scenario 7 — No Cross-App State Leakage

**Goal:** Verify that store state from one app cannot affect another.

**Steps:**

1. Open MMC in one browser tab and Backoffice in another
2. Set `sidebarCollapsed: true` in MMC via localStorage injection
3. In Backoffice, reload the page
4. Observe that Backoffice sidebar state is unaffected (Backoffice uses its own `backoffice-app` key)

**Expected:** Each app has isolated localStorage keys. State from one app never bleeds into another.

---

## Lint and Type Check Verification

```bash
# From repo root
bun run lint
# Expected: 9 pre-existing errors (all in apps/api/); 0 new errors

bun run typecheck
# Expected: 2 pre-existing TypeScript errors (guards/index.ts — STAGE_UI_03 scope)
#           0 new type errors introduced by this stage
```

---

## Store Cycle Detection

```bash
bun scripts/check-store-cycles.ts
# Expected output:
# [check-store-cycles] ✓  mmc: no circular dependencies
# [check-store-cycles] ✓  backoffice: no circular dependencies
# [check-store-cycles] ✓  frontoffice: no circular dependencies
# [check-store-cycles] PASS: Zero circular dependencies in all store directories.
```

---

## Known Limitations

| Limitation                     | Detail                                                                                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspace.store.ts` is a stub | `loadWorkspace()` does not make a real API call; full implementation deferred to workspace integration stage                                                                                       |
| Notification display           | `notification.store.ts` manages the queue; UI component rendering notifications is deferred to a dedicated UI component stage                                                                      |
| Guards integration error       | `apps/frontoffice/src/main.ts:17` and `apps/mmc/src/main.ts:28` have a pre-existing TypeScript error (`guards/index.ts` not a module); this is a STAGE_UI_03 concern, not introduced by this stage |
| SSR                            | Pinia state is SPA-only; SSR serialization not in scope                                                                                                                                            |

---

## File Map

Key files touched by this stage (for quick navigation during review):

| File                                                | What Changed                                              |
| --------------------------------------------------- | --------------------------------------------------------- |
| `apps/*/src/main.ts`                                | `pinia.use(createPersistedState())` added                 |
| `apps/*/src/core/state/auth.store.ts`               | Store ID namespaced                                       |
| `apps/*/src/core/state/index.ts`                    | New store exports added                                   |
| `apps/*/src/core/state/app.store.ts`                | NEW — sidebarCollapsed, theme, locale with persistence    |
| `apps/*/src/core/state/ui.store.ts`                 | NEW — modals, drawers, overlay state                      |
| `apps/*/src/core/state/notification.store.ts`       | NEW — notification queue                                  |
| `apps/backoffice/src/core/state/workspace.store.ts` | NEW — workspace loading stub + logging                    |
| `eslint.config.mjs`                                 | `no-restricted-imports` firewall for `@zidney/api-client` |
| `package.json`                                      | `madge` dev dep; `check:store-cycles` script              |
| `scripts/check-store-cycles.ts`                     | NEW — circular dependency detector                        |
| `tests/unit/store-id-uniqueness.test.ts`            | NEW — all 13 store IDs unique at runtime                  |
| `tests/unit/no-console-in-stores.test.ts`           | NEW — CI-blocking console.log enforcement                 |
