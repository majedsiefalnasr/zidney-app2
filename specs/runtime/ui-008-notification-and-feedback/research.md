# Research Report: Unified Notification and Feedback System

**Stage**: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Date**: 2026-04-07  
**Author**: speckit.plan (automated research pass)

---

## 1. Notification Store — Current State (all 3 apps)

All three apps have identical notification store implementations at the confirmed path
`apps/{mmc,backoffice,frontoffice}/src/core/state/notification.store.ts`,
introduced in STAGE_UI_06_STATE_MANAGEMENT.

### What exists

| Capability                  | MMC | Backoffice | Frontoffice |
| --------------------------- | --- | ---------- | ----------- |
| `AppNotification` interface | ✅  | ✅         | ✅          |
| `push(notification)`        | ✅  | ✅         | ✅          |
| `dismiss(id)`               | ✅  | ✅         | ✅          |
| `clearAll()`                | ✅  | ✅         | ✅          |
| `$reset()`                  | ✅  | ✅         | ✅          |
| `MAX_QUEUE_SIZE = 20`       | ✅  | ✅         | ✅          |
| HMR (`acceptHMRUpdate`)     | ✅  | ✅         | ✅          |

### What is MISSING (gaps this stage must close)

| Gap                                           | MMC | Backoffice | Frontoffice |
| --------------------------------------------- | --- | ---------- | ----------- |
| Deduplication window (2s by key)              | ❌  | ❌         | ❌          |
| `lastPushed: Map<string, number>`             | ❌  | ❌         | ❌          |
| `visibleNotifications` computed (≤5)          | ❌  | ❌         | ❌          |
| Unit test file (`notification.store.spec.ts`) | ❌  | ❌         | ❌          |

### Interface parity

`AppNotification` is **identical** across all three stores. The NOTE (M-01) comment
is consistent — type migration to `@zidney/types` is deferred to a future stage.

---

## 2. Error Normalizer — Current State (all 3 apps)

All three apps have identical `normalizeError()` implementations at
`apps/{mmc,backoffice,frontoffice}/src/core/errors/error-normalizer.ts`,
introduced in STAGE_UI_04_GLOBAL_ERROR_HANDLING.

### What exists

| Capability                           | Status          |
| ------------------------------------ | --------------- |
| Case 1 — TypeError → NETWORK_ERROR   | ✅              |
| Case 2 — AppError passthrough        | ✅              |
| Case 3 — Legacy NormalizedError      | ✅              |
| Case 4 — Structured API body         | ✅              |
| Case 5 — AdapterResponse delegation  | ✅              |
| Case 6 — Raw HTTP object with status | ✅              |
| Case 7 — Unknown fallback            | ✅              |
| All 3 apps IDENTICAL                 | ✅              |
| Test file `error-normalizer.spec.ts` | ✅ (all 3 apps) |

### What is MISSING

- **Nothing** — error normalizer is complete. No changes required to its logic.
- The existing tests cover all 7 cases.

---

## 3. Global Error Handler — Current State (all 3 apps)

`apps/{mmc,backoffice,frontoffice}/src/core/errors/global-error-handler.ts` exists
and correctly uses `normalizeError()` + `redactError()` before calling `onError()`.

### Bootstrap wiring (main.ts)

The `registerGlobalErrorHandlers()` call in all three `main.ts` files wires the
`onError` callback — however, currently the callback **only logs** via `appLogger`.
It does **not** push to the notification store.

Gap: `onError` must also call `notificationStore.push(...)` with an `'error'`
notification for unhandled global rejections (excluding network errors, which are
handled by the offline banner).

---

## 4. Composables — Current State

| Composable                | MMC            | Backoffice          | Frontoffice    |
| ------------------------- | -------------- | ------------------- | -------------- |
| `useBreakpoint.ts`        | ✅ exists      | ✅ exists           | ✅ exists      |
| `useBackofficeContext.ts` | —              | ✅ exists (BO only) | —              |
| `usePermission.ts`        | —              | ✅ exists (BO only) | —              |
| `useNotify.ts`            | ❌ **MISSING** | ❌ **MISSING**      | ❌ **MISSING** |
| `useOfflineBanner.ts`     | ❌ **MISSING** | ❌ **MISSING**      | ❌ **MISSING** |

All 6 composable files must be **created** in this stage.

---

## 5. App Shell — Toaster and OfflineBanner Mounting

All three `App.vue` files share the same structure:

```html
<template>
  <ErrorBoundary>
    <RouterView v-if="_route.meta.standaloneLayout === true" />
    <AppLayout v-else />
  </ErrorBoundary>
</template>
```

- **No `<Toaster>` is mounted** in any app. The `Toaster` must be added to `App.vue`
  for all three apps (it is a DOM portal — no layout impact).
- **No `<OfflineBanner>` is mounted** in any app. The `OfflineBanner` component must
  be created per-app and mounted inside `AppLayout.vue` (layout-flow position).
- Three `OfflineBanner.vue` component files must be **created**.
- All three `AppLayout.vue` files must be **modified** to mount `<OfflineBanner>`.

---

## 6. Toaster Component in @zidney/ui-system

| Path                                                             | Status               |
| ---------------------------------------------------------------- | -------------------- |
| `packages/ui-system/src/components/shadcn-vue/sonner/Sonner.vue` | ✅ exists            |
| `packages/ui-system/src/components/shadcn-vue/sonner/index.ts`   | ✅ exports `Toaster` |
| Exported from `packages/ui-system/src/components/index.ts`       | ❌ **MISSING**       |
| Exported from `packages/ui-system/src/index.ts` (via barrel)     | ❌ (inherits miss)   |

**Gap**: `Toaster` is not reachable via `import { Toaster } from '@zidney/ui-system'`.
Apps would fail at import time. The components barrel must be updated.

Similarly, the `FormMessage` shadcn-vue primitive exists at
`packages/ui-system/src/components/shadcn-vue/form/index.ts` but is **not**
re-exported from the main components barrel. All form primitives (`Form`,
`FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`, `FormDescription`)
need barrel export.

---

## 7. AppError Interface — Discrepancy Note

The clarification spec states `AppError` should have `correlationId?: string`.
The **actual** `packages/api-client/src/types.ts` interface is:

```typescript
export interface AppError {
  readonly code: string;
  readonly message: string;
  readonly httpStatus: number;
  readonly isNetworkError: boolean;
  readonly retryAfter?: number;
}
```

`correlationId` is **absent**. The plan treats the actual code as authoritative.
Toast display of correlation IDs (FR-016) must be conditional on receiving
a `correlationId` embedded in the normalized `message` field itself (i.e., the
API already includes it in the `error.message` string), not from a separate field.
This does not require an `AppError` interface change in this stage.

---

## 8. Attempt Store — Frontoffice Dependency

**FR-030** requires `useAttemptStore().isExamActive` in Frontoffice's `useNotify.ts`.
No attempt store exists anywhere in `apps/frontoffice/src/`. This is a **unmet
upstream dependency** — `isExamActive` comes from an exam engine stage not yet
implemented.

**Resolution**: The Frontoffice `useNotify.ts` will conditionally import `useAttemptStore`
with a guard. A minimal stub `attempt.store.ts` that exposes only `isExamActive: false`
will be created alongside `useNotify.ts` in this stage to satisfy the import contract.
The real attempt store will replace this stub in the exam engine stage.

---

## 9. Identified Alignment Gaps — Summary

| Gap                                                       | App(s)      | Action                     |
| --------------------------------------------------------- | ----------- | -------------------------- |
| Notification store missing deduplication                  | All 3       | MODIFY store               |
| Notification store missing `visibleNotifications`         | All 3       | MODIFY store               |
| `useNotify.ts` composable missing                         | All 3       | CREATE                     |
| `useOfflineBanner.ts` composable missing                  | All 3       | CREATE                     |
| `OfflineBanner.vue` component missing                     | All 3       | CREATE                     |
| `<Toaster>` not mounted in App.vue                        | All 3       | MODIFY App.vue             |
| `<OfflineBanner>` not in AppLayout                        | All 3       | MODIFY AppLayout.vue       |
| Global error handler not wired to notification store      | All 3       | MODIFY main.ts             |
| `Toaster` not in ui-system barrel                         | ui-system   | MODIFY components/index.ts |
| `FormMessage` and form primitives not in ui-system barrel | ui-system   | MODIFY components/index.ts |
| `notification.store.spec.ts` missing                      | All 3       | CREATE                     |
| `notification-flow.spec.ts` integration test missing      | All 3       | CREATE                     |
| `attempt.store.ts` stub missing (Frontoffice)             | Frontoffice | CREATE stub                |

---

## 10. No New Dependencies Required

- `@vueuse/core` — already installed in all apps (`useOnline` is available)
- `vue-sonner` — already installed (used by the Sonner.vue component)
- `pinia` — already installed
- `@zidney/api-client` — already installed, `AppError` + `ErrorCodes` available
- `vee-validate` + `@vee-validate/zod` — already installed (form validation)

No `package.json` changes are required. NFR-006 is satisfied.
