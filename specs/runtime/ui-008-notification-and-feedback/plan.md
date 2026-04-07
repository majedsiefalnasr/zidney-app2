# Implementation Plan: Unified Notification and Feedback System

**Stage**: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Branch**: `spec/ui-008-notification-and-feedback`  
**Date**: 2026-04-07  
**Apps in Scope**: MMC, Backoffice, Frontoffice  
**Spec**: `specs/runtime/ui-008-notification-and-feedback/spec.md`  
**Research**: `specs/runtime/ui-008-notification-and-feedback/research.md`

---

## Phase 0 — Research Summary

See `research.md` for full details. Key findings:

| Finding                                                                       | Impact              |
| ----------------------------------------------------------------------------- | ------------------- |
| All 3 notification stores exist but lack deduplication + visible cap          | MODIFY stores       |
| Error normalizers are complete and identical — no changes needed              | None                |
| No `useNotify` or `useOfflineBanner` composable exists in any app             | CREATE 6 files      |
| `<Toaster>` not mounted in any App.vue                                        | MODIFY 3 App.vue    |
| No `OfflineBanner.vue` component in any app                                   | CREATE 3 components |
| `Toaster` + form primitives not in `@zidney/ui-system` barrel                 | MODIFY 1 barrel     |
| Global error handler `onError` is wired to logger only — never notifies store | MODIFY 3 main.ts    |
| `useAttemptStore` (Frontoffice FR-030) doesn't exist yet                      | CREATE stub         |

---

## Phase 1 — Design

### 1.1 AppNotification Interface (unchanged from current stores)

```typescript
// apps/{mmc,backoffice,frontoffice}/src/core/state/notification.store.ts
export interface AppNotification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number; // ms; undefined = persistent (error default)
  dismissible: boolean;
}
```

This interface is **identical** across all three apps. No changes to the shape.  
The type stays locally defined until a future cleanup stage moves it to `@zidney/types`
(per existing NOTE M-01 in all stores).

---

### 1.2 Notification Store Additions (MODIFY all 3)

Two capabilities must be added to each store:

#### 1.2.1 Deduplication (FR-004)

A private `Map<string, number>` tracks recent notification keys ("type:title:message")
and the timestamp they were last pushed. If a duplicate arrives within 2 seconds, it
is suppressed and `push()` returns `""` (empty string sentinel = suppressed).

```typescript
// Private — not exported
const DEDUP_WINDOW_MS = 2_000;
const lastPushed = new Map<string, number>();

function push(notification: Omit<AppNotification, "id">): string {
  // Deduplication check
  const key = `${notification.type}:${notification.title}:${notification.message ?? ""}`;
  const now = Date.now();
  const last = lastPushed.get(key);
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) return ""; // suppressed

  lastPushed.set(key, now);

  // Capacity enforcement
  if (notifications.value.length >= MAX_QUEUE_SIZE) {
    notifications.value.shift(); // evict oldest
  }

  const id = crypto.randomUUID();
  notifications.value.push({ ...notification, id });
  return id;
}
```

`$reset()` must clear `lastPushed` to ensure clean state after logout:

```typescript
function $reset(): void {
  notifications.value = [];
  lastPushed.clear();
}
```

#### 1.2.2 Visible Cap — `visibleNotifications` Computed (FR-002)

```typescript
import { computed, ref } from "vue";

const VISIBLE_CAP = 5;

const visibleNotifications = computed(() => notifications.value.slice(-VISIBLE_CAP));
```

This computed is **exported** from the store. UI components bind to
`visibleNotifications`, not `notifications`. The internal queue may contain up to
20 entries but only the 5 most recent are ever rendered.

---

### 1.3 `useNotify()` Composable API

Location: `apps/{mmc,backoffice,frontoffice}/src/composables/useNotify.ts`

Public interface:

```typescript
export function useNotify(): {
  success(title: string, message?: string): string;
  error(title: string, message?: string): string;
  warning(title: string, message?: string): string;
  info(title: string, message?: string): string;
};
```

Default duration values applied by this layer (matching spec FR-007):

| Type      | `duration`               | `dismissible` |
| --------- | ------------------------ | ------------- |
| `success` | 4 000 ms                 | `true`        |
| `error`   | `undefined` (persistent) | `true`        |
| `warning` | 7 000 ms                 | `true`        |
| `info`    | 5 000 ms                 | `true`        |

**Frontoffice-specific behaviour (FR-030)**:  
The Frontoffice `useNotify` composable checks `useAttemptStore().isExamActive`.
If `isExamActive` is `true`, `success()` and `info()` calls are silently dropped
(return `""` without pushing to the store). `error()` and `warning()` always push
regardless of exam mode.

All other apps (`useNotify` in MMC and Backoffice) have no exam-mode logic.

---

### 1.4 `useOfflineBanner()` Composable API

Location: `apps/{mmc,backoffice,frontoffice}/src/composables/useOfflineBanner.ts`

```typescript
import { useOnline } from "@vueuse/core";
import { computed } from "vue";

export function useOfflineBanner() {
  const isOnline = useOnline();
  const showBanner = computed(() => !isOnline.value);
  return { showBanner };
}
```

Identical across all three apps. Returns a single reactive boolean. No state.

---

### 1.5 `OfflineBanner.vue` Component

Location: `apps/{mmc,backoffice,frontoffice}/src/components/OfflineBanner.vue`

Behaviour:

- `v-if="showBanner"` — renders only when offline.
- Full-width, mounted at the top of `AppLayout` (inside layout flow, NOT fixed overlay).
- Background: `bg-destructive text-destructive-foreground`.
- Text: `"Connection lost — working offline. Some features may be unavailable."`
- Icon: `WifiOff` from Lucide (via `@zidney/ui-system`).
- `role="status"` ARIA attribute on the root element.
- No dismiss button.

---

### 1.6 Toast Display Token Mapping

The `Toaster` from `@zidney/ui-system` (vue-sonner based) uses its own toast
function from `vue-sonner`. The notification store drives which notifications exist;
a root-level watcher in each `App.vue` calls `toast[type]()` when new items
appear in `visibleNotifications`.

| `AppNotification.type` | Sonner call       | Default duration | Accent  |
| ---------------------- | ----------------- | ---------------- | ------- |
| `success`              | `toast.success()` | 4 000 ms         | Green   |
| `error`                | `toast.error()`   | `Infinity`       | Red     |
| `warning`              | `toast.warning()` | 7 000 ms         | Amber   |
| `info`                 | `toast.info()`    | 5 000 ms         | Neutral |

The Toaster component is mounted once and stateless. Toast calls come from watching
the notification store's `visibleNotifications` for newly pushed items.

**Architecture decision**: Each `App.vue` will `watch` the notification store for
new IDs using a dedicated `useToastBridge()` logic block directly in `App.vue`
(not a separate composable — it is a render concern, not business logic).

---

### 1.7 Error-to-Notification Routing Table

| HTTP Status                      | `AppError.code`       | UI Action                          |
| -------------------------------- | --------------------- | ---------------------------------- |
| 400                              | `VALIDATION_ERROR`    | Inline `<FormMessage>` (not toast) |
| 401                              | `AUTH_REFRESH_FAILED` | Redirect to login; no toast        |
| 403                              | `PERMISSION_DENIED`   | `warning` toast                    |
| 409                              | `CONFLICT`            | `error` toast with API message     |
| 422                              | `VALIDATION_ERROR`    | `error` toast with API message     |
| 5xx                              | `SERVER_ERROR`        | `error` toast with generic message |
| network (`isNetworkError: true`) | `NETWORK_ERROR`       | Offline banner only; no toast      |
| unknown                          | `UNKNOWN_ERROR`       | `error` toast with generic message |

The routing logic lives in individual store actions and in the global error handler
wiring. The notification store itself has no routing knowledge.

---

### 1.8 Form Field Error Binding Pattern

Using `vee-validate` + `@vee-validate/zod` + `<FormMessage>` from `@zidney/ui-system`:

```vue
<FormField v-slot="{ componentField, errorMessage }" name="email">
  <FormItem>
    <FormLabel>Email</FormLabel>
    <FormControl>
      <Input v-bind="componentField" type="email" />
    </FormControl>
    <FormMessage />  <!-- renders errorMessage automatically -->
  </FormItem>
</FormField>
```

400 validation errors from the API flow:

1. API returns `{ success: false, error: { code: "VALIDATION_ERROR", message: "..." } }`
2. Store catches → `normalizeError()` produces `AppError`
3. If inside a form context, `setErrors()` from `useForm()` populates field-level errors
4. `<FormMessage>` renders them inline — no global toast fires

For non-field validation errors (server returns no field name), the `AppError.message`
is displayed as a form-level error above the submit button using a `<p class="text-destructive text-sm">` block.

---

### 1.9 Attempt Store Stub (Frontoffice only)

`apps/frontoffice/src/core/state/attempt.store.ts` — **STUB** to be replaced by
exam engine stage.

```typescript
// STUB — replaced by exam engine stage
export const useAttemptStore = defineStore("frontoffice-attempt", () => {
  const isExamActive = ref(false);
  return { isExamActive };
});
```

This stub satisfies the `useNotify.ts` import contract. It defaults to
`isExamActive: false` (exam mode off). No side effects.

---

## Phase 2 — Implementation Sequencing

### Execution Order

```
Wave 1 (sequential): ui-system barrel fix
Wave 2 (parallel): MODIFY all 3 notification stores
Wave 3 (parallel): CREATE all 6 composables + attempt store stub
Wave 4 (parallel): CREATE all 3 OfflineBanner.vue components
Wave 5 (parallel): MODIFY all 3 AppLayout.vue, MODIFY all 3 App.vue
Wave 6 (parallel): MODIFY all 3 main.ts
Wave 7 (parallel): EXPAND 3 store test files + CREATE 9 test files (useNotify x3, OfflineBanner x3, integration x3)
Wave 8 (parallel): CREATE 3 useFormSubmit composables (FR-024)
```

---

### Wave 1 — packages/ui-system

| #   | File                                         | Action | Reason                                                                                                                                                                                                                          |
| --- | -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `packages/ui-system/src/components/index.ts` | MODIFY | Add `export { Toaster } from './shadcn-vue/sonner'` and all form primitives (`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`) so apps can `import { Toaster, FormMessage } from '@zidney/ui-system'` |

---

### Wave 2 — Notification Stores (all 3 apps)

| #   | File                                                    | Action | Reason                                                                                                                                                                                |
| --- | ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2   | `apps/mmc/src/core/state/notification.store.ts`         | MODIFY | Add `lastPushed` map, dedup logic in `push()`, `DEDUP_WINDOW_MS` const, `VISIBLE_CAP` const, `visibleNotifications` computed, clear map in `$reset()`. Export `visibleNotifications`. |
| 3   | `apps/backoffice/src/core/state/notification.store.ts`  | MODIFY | Same as MMC                                                                                                                                                                           |
| 4   | `apps/frontoffice/src/core/state/notification.store.ts` | MODIFY | Same as MMC                                                                                                                                                                           |

---

### Wave 3 — Composables (all 3 apps)

| #   | File                                                   | Action | Reason                                                                                                                        |
| --- | ------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 5   | `apps/mmc/src/composables/useNotify.ts`                | CREATE | Wraps `useMmcNotificationStore` with typed convenience methods and default durations. No exam-mode logic.                     |
| 6   | `apps/mmc/src/composables/useOfflineBanner.ts`         | CREATE | Wraps `useOnline()` from `@vueuse/core`. Returns `{ showBanner }`.                                                            |
| 7   | `apps/backoffice/src/composables/useNotify.ts`         | CREATE | Same pattern as MMC, wraps `useBackofficeNotificationStore`.                                                                  |
| 8   | `apps/backoffice/src/composables/useOfflineBanner.ts`  | CREATE | Same as MMC.                                                                                                                  |
| 9   | `apps/frontoffice/src/composables/useNotify.ts`        | CREATE | Same base pattern + exam-mode guard using `useAttemptStore().isExamActive`. Suppresses `success` and `info` when active exam. |
| 10  | `apps/frontoffice/src/composables/useOfflineBanner.ts` | CREATE | Same as MMC.                                                                                                                  |
| 11  | `apps/frontoffice/src/core/state/attempt.store.ts`     | CREATE | Stub with `isExamActive: ref(false)`. Required by `useNotify.ts`.                                                             |

---

### Wave 4 — OfflineBanner Components (all 3 apps)

| #   | File                                                | Action | Reason                                                                                         |
| --- | --------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| 12  | `apps/mmc/src/components/OfflineBanner.vue`         | CREATE | Vue SFC with `useOfflineBanner()`. Full-width destructive banner, no dismiss, `role="status"`. |
| 13  | `apps/backoffice/src/components/OfflineBanner.vue`  | CREATE | Same.                                                                                          |
| 14  | `apps/frontoffice/src/components/OfflineBanner.vue` | CREATE | Same.                                                                                          |

---

### Wave 5 — App Shell Mounting (all 3 apps)

| #   | File                                                   | Action | Reason                                                                                                                                                                                                              |
| --- | ------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15  | `apps/mmc/src/App.vue`                                 | MODIFY | Add `<Toaster>` import and mount inside `<ErrorBoundary>`. Add watch-based toast bridge: watches notification store for new `visibleNotifications` entries and calls the appropriate `toast.*()` from `vue-sonner`. |
| 16  | `apps/backoffice/src/App.vue`                          | MODIFY | Same.                                                                                                                                                                                                               |
| 17  | `apps/frontoffice/src/App.vue`                         | MODIFY | Same.                                                                                                                                                                                                               |
| 18  | `apps/mmc/src/components/layout/AppLayout.vue`         | MODIFY | Mount `<OfflineBanner>` as the first child inside the root `<div class="app-layout">`, above the sidebar.                                                                                                           |
| 19  | `apps/backoffice/src/components/layout/AppLayout.vue`  | MODIFY | Same.                                                                                                                                                                                                               |
| 20  | `apps/frontoffice/src/components/layout/AppLayout.vue` | MODIFY | Same.                                                                                                                                                                                                               |

---

### Wave 6 — Bootstrap Wiring (all 3 apps)

| #   | File                           | Action | Reason                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 21  | `apps/mmc/src/main.ts`         | MODIFY | In `registerGlobalErrorHandlers({ onError })`: after existing `appLogger.error(...)` call, add `if (!err.isNetworkError) { useMmcNotificationStore().push({ type: 'error', title: 'Unexpected error', message: err.message, dismissible: true }) }`. Network errors are handled by the offline banner. |
| 22  | `apps/backoffice/src/main.ts`  | MODIFY | Same, using `useBackofficeNotificationStore()`.                                                                                                                                                                                                                                                        |
| 23  | `apps/frontoffice/src/main.ts` | MODIFY | Same, using `useFrontofficeNotificationStore()`.                                                                                                                                                                                                                                                       |

---

### Wave 7 — Tests

| #   | File                                                            | Action | Reason                                                                                                                                                                                                |
| --- | --------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 24  | `apps/mmc/tests/unit/stores/notification.store.test.ts`         | EXPAND | Expand existing UI-06 tests: add dedup within 2s, dedup expiry, visibleNotifications cap at 5, $reset clears lastPushed.                                                                              |
| 25  | `apps/backoffice/tests/unit/stores/notification.store.test.ts`  | EXPAND | Same.                                                                                                                                                                                                 |
| 26  | `apps/frontoffice/tests/unit/stores/notification.store.test.ts` | EXPAND | Same.                                                                                                                                                                                                 |
| 27  | `apps/mmc/tests/unit/composables/useNotify.test.ts`             | CREATE | useNotify unit tests: success/error/warning/info default durations; dismissible:true always.                                                                                                          |
| 28  | `apps/backoffice/tests/unit/composables/useNotify.test.ts`      | CREATE | Same.                                                                                                                                                                                                 |
| 29  | `apps/frontoffice/tests/unit/composables/useNotify.test.ts`     | CREATE | Same + exam-mode guard: success/info suppressed when isExamActive=true; error/warning always fire.                                                                                                    |
| 30  | `apps/mmc/tests/unit/components/OfflineBanner.test.ts`          | CREATE | Component tests: show offline, hide online, no dismiss button, role="status".                                                                                                                         |
| 31  | `apps/backoffice/tests/unit/components/OfflineBanner.test.ts`   | CREATE | Same.                                                                                                                                                                                                 |
| 32  | `apps/frontoffice/tests/unit/components/OfflineBanner.test.ts`  | CREATE | Same.                                                                                                                                                                                                 |
| 33  | `apps/mmc/tests/integration/notification-flow.test.ts`          | CREATE | Integration: 400→no toast (field errors); 401→redirect+no toast (FR-013); 403→warning; 409→error toast; 422→error toast; 500→generic error; network→no toast; loading lifecycle; double-submit guard. |
| 34  | `apps/backoffice/tests/integration/notification-flow.test.ts`   | CREATE | Same + workspace_slug in error context from workspace Pinia store.                                                                                                                                    |
| 35  | `apps/frontoffice/tests/integration/notification-flow.test.ts`  | CREATE | Same + exam-mode suppression: info/success suppressed when isExamActive=true; error still fires.                                                                                                      |

### Wave 8 — Form Submit Pattern (FR-024)

| #   | File                                                | Action | Reason                                                                                                                             |
| --- | --------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 36  | `apps/mmc/src/composables/useFormSubmit.ts`         | CREATE | Composable encapsulating submit button `disabled` + loading state for async actions (FR-024). Tracks `isSubmitting: Ref<boolean>`. |
| 37  | `apps/backoffice/src/composables/useFormSubmit.ts`  | CREATE | Same.                                                                                                                              |
| 38  | `apps/frontoffice/src/composables/useFormSubmit.ts` | CREATE | Same.                                                                                                                              |

---

## Test Plan

### Unit Tests — Notification Store

**Files**: `apps/*/tests/unit/stores/notification.store.test.ts` (3 files — EXPAND existing from UI-06)  
**Runner**: Vitest  
**Mocks**: `crypto.randomUUID` (return deterministic IDs); `Date.now` (control dedup timing via `vi.setSystemTime`)

| Test Case                                                | Assertion                                                |
| -------------------------------------------------------- | -------------------------------------------------------- |
| `push()` returns an ID string                            | `expect(id).toBeTypeOf('string')`                        |
| Pushed notification appears in `notifications.value`     | `expect(store.notifications).toHaveLength(1)`            |
| Duplicate `type+title+message` within 2s is suppressed   | Second `push()` returns `""`, queue length stays 1       |
| Duplicate after 2s window is allowed                     | Advance time by 2001ms; second push succeeds             |
| Queue evicts oldest when > 20                            | Push 21 items; `notifications.value.length === 20`       |
| `visibleNotifications` returns at most 5                 | Push 10; `visibleNotifications.value.length === 5`       |
| `dismiss(id)` removes only that item                     | Queue has 2; dismiss first → length 1                    |
| `clearAll()` empties queue                               | `expect(store.notifications).toHaveLength(0)`            |
| `$reset()` empties queue AND clears dedup map            | Push, reset, same key pushes again immediately           |
| Error `duration: undefined` is preserved                 | `push({ type: 'error', ... })` → `duration` is undefined |
| Success `duration: 4000` default applied (via useNotify) | Tested in composable tests                               |

### Unit Tests — `useNotify` Composable

**Files**: `apps/*/tests/unit/composables/useNotify.test.ts` (3 files)  
**Mocks**: Pinia testutils (`createPinia`, `setActivePinia`); Frontoffice: mock `useAttemptStore`

| Test Case                                                      | Assertion                                       |
| -------------------------------------------------------------- | ----------------------------------------------- |
| `success()` pushes `type: 'success'` with `duration: 4000`     | Store has 1 notification, correct type/duration |
| `error()` pushes `type: 'error'` with `duration: undefined`    | Persistent by default                           |
| `warning()` pushes `type: 'warning'` with `duration: 7000`     |                                                 |
| `info()` pushes `type: 'info'` with `duration: 5000`           |                                                 |
| [Frontoffice] `success()` suppressed when `isExamActive: true` | Queue length stays 0                            |
| [Frontoffice] `error()` fires even when `isExamActive: true`   | Queue length = 1                                |

### Unit Tests — `useOfflineBanner` Composable

**Approach**: Mock `useOnline` from `@vueuse/core` to return a ref;
toggle its value. Assert `showBanner.value` changes correctly.

### Integration Tests — Notification Flow

**Files**: `apps/*/tests/integration/notification-flow.test.ts` (3 files)  
**Mocks**: Mock `apiClient`; use real `normalizeError()` and real notification store

| Test Case                                                            | Assertion                                         |
| -------------------------------------------------------------------- | ------------------------------------------------- |
| Store action catches 400 (VALIDATION_ERROR) → does NOT push toast    | Queue empty; field errors routed to form          |
| Store action catches 401 → router redirect, zero toasts (FR-013)     | `router.push('/login')` called; queue stays empty |
| Store action catches 403 → pushes `warning` toast                    | Queue has 1 warning notification                  |
| Store action catches 409 (CONFLICT) → pushes `error` toast           | Queue has 1 error notification with `err.message` |
| Store action catches 422 (Unprocessable) → pushes `error` toast      | Queue has 1 error notification with `err.message` |
| Store action catches 500 → pushes `error` toast with generic message | `message: 'Something went wrong'` or equivalent   |
| `isNetworkError: true` → does NOT push toast                         | Queue stays empty                                 |
| Loading state set/cleared correctly                                  | `isLoading === false` in finally                  |
| Double-submit prevention                                             | Second call returns early while first in-flight   |

### Offline Banner Tests

**Files**: `apps/*/tests/unit/components/OfflineBanner.test.ts` (3 files)  
**Mocks**: Mock `useOnline` from `@vueuse/core`

| Test Case                                               | Assertion                              |
| ------------------------------------------------------- | -------------------------------------- |
| Banner renders when offline (`isOnline.value = false`)  | Component is visible                   |
| Banner auto-hides when online (`isOnline.value = true`) | Component absent                       |
| No dismiss button exists                                | No element with `aria-label="dismiss"` |
| Has `role="status"`                                     | ARIA is accessible                     |

---

## Cross-Cutting Implementation Notes

### Toast Bridge in App.vue

The bridge between the Pinia notification store and the Sonner toast renderer
is implemented as a `watchEffect` (or `watch`) in `App.vue`'s `<script setup>`.
It tracks pushed IDs and calls `toast.success/error/warning/info()` accordingly:

```typescript
// In App.vue <script setup>
import { toast } from 'vue-sonner'
import { watch } from 'vue'

const notifStore = use{App}NotificationStore()
const { visibleNotifications } = storeToRefs(notifStore)
const seen = new Set<string>()

// Use getter function or storeToRefs — direct property access from reactive()
// auto-unwraps ComputedRef to a plain array, losing reactivity tracking.
watch(visibleNotifications, (notifications) => {
  for (const n of notifications) {
    if (seen.has(n.id)) continue
    seen.add(n.id)
    const opts = { description: n.message, duration: n.duration }
    if (n.type === 'success') toast.success(n.title, opts)
    else if (n.type === 'error') toast.error(n.title, opts)
    else if (n.type === 'warning') toast.warning(n.title, opts)
    else toast.info(n.title, opts)
  }
})
```

The `seen` set is scoped to the component instance (cleared on unmount if needed).

### OfflineBanner in AppLayout

The offline banner is the **first** child in each `AppLayout.vue`, inside the
existing root wrapper but before the sidebar. This ensures layout flow pushes
the rest of the content down:

```html
<template>
  <div class="app-layout" ...>
    <!-- NEW: Offline banner — first child, affects layout flow -->
    <OfflineBanner />

    <!-- Sidebar - existing -->
    <AppSidebar ...>...</AppSidebar>
    ...
  </div>
</template>
```

### FR-030 — Backoffice Workspace Slug in Errors

Backoffice `useNotify.ts` may be extended with an overloaded error method:

```typescript
error(title: string, message?: string, workspaceContext?: string): string
```

If `workspaceContext` is provided (sourced from `useBackofficeContext().workspaceSlug`),
it appends `[workspace: ${workspaceContext}]` to the message only in development mode.
In production, the slug is suppressed (SEC-004). This is optional for MVP.

---

## File Inventory — By App

### MMC — 9 files total

| File                                                           | Action |
| -------------------------------------------------------------- | ------ |
| `apps/mmc/src/core/state/notification.store.ts`                | MODIFY |
| `apps/mmc/src/composables/useNotify.ts`                        | CREATE |
| `apps/mmc/src/composables/useOfflineBanner.ts`                 | CREATE |
| `apps/mmc/src/components/OfflineBanner.vue`                    | CREATE |
| `apps/mmc/src/App.vue`                                         | MODIFY |
| `apps/mmc/src/components/layout/AppLayout.vue`                 | MODIFY |
| `apps/mmc/src/main.ts`                                         | MODIFY |
| `apps/mmc/src/core/state/__tests__/notification.store.spec.ts` | CREATE |
| `apps/mmc/src/core/__tests__/notification-flow.spec.ts`        | CREATE |

### Backoffice — 9 files total

| File                                                                  | Action |
| --------------------------------------------------------------------- | ------ |
| `apps/backoffice/src/core/state/notification.store.ts`                | MODIFY |
| `apps/backoffice/src/composables/useNotify.ts`                        | CREATE |
| `apps/backoffice/src/composables/useOfflineBanner.ts`                 | CREATE |
| `apps/backoffice/src/components/OfflineBanner.vue`                    | CREATE |
| `apps/backoffice/src/App.vue`                                         | MODIFY |
| `apps/backoffice/src/components/layout/AppLayout.vue`                 | MODIFY |
| `apps/backoffice/src/main.ts`                                         | MODIFY |
| `apps/backoffice/src/core/state/__tests__/notification.store.spec.ts` | CREATE |
| `apps/backoffice/src/core/__tests__/notification-flow.spec.ts`        | CREATE |

### Frontoffice — 10 files total

| File                                                                   | Action        |
| ---------------------------------------------------------------------- | ------------- |
| `apps/frontoffice/src/core/state/notification.store.ts`                | MODIFY        |
| `apps/frontoffice/src/core/state/attempt.store.ts`                     | CREATE (stub) |
| `apps/frontoffice/src/composables/useNotify.ts`                        | CREATE        |
| `apps/frontoffice/src/composables/useOfflineBanner.ts`                 | CREATE        |
| `apps/frontoffice/src/components/OfflineBanner.vue`                    | CREATE        |
| `apps/frontoffice/src/App.vue`                                         | MODIFY        |
| `apps/frontoffice/src/components/layout/AppLayout.vue`                 | MODIFY        |
| `apps/frontoffice/src/main.ts`                                         | MODIFY        |
| `apps/frontoffice/src/core/state/__tests__/notification.store.spec.ts` | CREATE        |
| `apps/frontoffice/src/core/__tests__/notification-flow.spec.ts`        | CREATE        |

### packages/ui-system — 1 file total

| File                                         | Action |
| -------------------------------------------- | ------ |
| `packages/ui-system/src/components/index.ts` | MODIFY |

---

## Architectural Concerns and ADR Triggers

### CONCERN-01 — Toast Bridge Ownership

**Issue**: The watch-based toast bridge in `App.vue` is a render-concern side effect
that bridges the Pinia store to the Sonner imperative API (`toast()`). This is a
non-standard pattern for Vue.

**Decision**: This is acceptable because:

- `vue-sonner` is imperative by design; there is no reactive binding for the `Toaster` component.
- Placing the bridge in `App.vue` keeps it co-located with the `<Toaster>` mount point.
- The bridge performs no business logic.

**No ADR required**: Pattern is consistent with vue-sonner official usage.

### CONCERN-02 — Attempt Store Stub (Frontoffice)

**Issue**: Creating a stub `attempt.store.ts` with `isExamActive: false` inside
this stage (UI-08) to satisfy `useNotify.ts` is technically cross-stage. The
real attempt store belongs to the exam engine stage.

**Decision**: The stub is acceptable because:

- It exposes no business logic — just a reactive boolean defaulting to `false`.
- It imports no cross-app boundary.
- It will be **replaced** (not extended) by the exam engine stage.
- The `NOTE` in the file clearly marks it as a stub.

**Risk**: The exam engine stage MUST be aware of this stub and replace it.
**Resolution**: Add a `// STUB: replaced by exam engine stage` comment and document
in `specs/runtime/ui-008-notification-and-feedback/` that the attempt store is a stub.

**ADR recommended**: If the exam engine stage isn't tracked, a lightweight ADR or
stage dependency note should be filed to prevent the stub from becoming permanent.

### CONCERN-03 — Form Error Routing (400 vs toast)

**Issue**: FR-012 says HTTP 400 MUST route to inline field errors, not a toast.
However, the notification store and `useNotify()` have no concept of "form context."
The routing decision lives **in the calling Pinia store action**, not in the
notification/error layer.

**Decision**: Store actions must distinguish field-level errors by inspecting
`AppError.code === ErrorCodes.VALIDATION_ERROR`. When inside a form-bound store
action, the error must be rethrown or the form's `setErrors()` must be called
rather than calling `useNotify().error()`. This is an **implementation constraint**
documented in each form-submit action, not a change to the notification system itself.

**No ADR required**: This is a usage convention, not an architecture decision.

### CONCERN-04 — `correlationId` in AppError

**Issue**: The spec clarification mentions `correlationId?: string` in `AppError`,
and this contract is reflected in the canonical `packages/api-client/src/types.ts`
interface.

**Decision**: The `AppError` interface includes an optional `correlationId?: string`
field, matching the shape defined in `packages/api-client/src/types.ts`. This is
used by `normalizeError()` to expose correlation IDs when the backend provides them.
Toast rendering via `vue-sonner` renders `AppError.message` post-sanitization,
and correlation IDs can optionally be embedded in the message string or accessed
via the `correlationId` field for structured logging or debugging context.

**Implementation note**: No changes to `normalizeError()` or `vue-sonner` integration
are required; the implementation already respects the canonical `AppError` contract.

---

## Completion Checklist

- [ ] `packages/ui-system/src/components/index.ts` exports `Toaster` and form primitives
- [ ] All 3 notification stores: deduplication + `visibleNotifications` added
- [ ] All 6 composables (`useNotify`, `useOfflineBanner`) created across 3 apps
- [ ] All 3 `OfflineBanner.vue` components created
- [ ] All 3 `App.vue` files mount `<Toaster>` and include the toast bridge watch
- [ ] All 3 `AppLayout.vue` files mount `<OfflineBanner>` as first child
- [ ] All 3 `main.ts` files wire notification store to global error handler `onError`
- [ ] Frontoffice `attempt.store.ts` stub created with `isExamActive: false`
- [ ] All 3 `notification.store.spec.ts` unit test files created
- [ ] All 3 `notification-flow.spec.ts` integration test files created
- [ ] `bun run typecheck` passes with zero errors in notification/error layers
- [ ] `bun run lint` passes with zero Biome warnings in notification/error layers
- [ ] All new tests pass: `bun run test`
