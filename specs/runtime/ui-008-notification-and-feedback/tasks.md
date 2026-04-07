# Tasks: Unified Notification and Feedback System

**Stage**: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK  
**Spec**: `specs/runtime/ui-008-notification-and-feedback/spec.md`  
**Plan**: `specs/runtime/ui-008-notification-and-feedback/plan.md`  
**Branch**: `spec/ui-008-notification-and-feedback`

---

## Task Summary

| Metric                 | Value                                     |
| ---------------------- | ----------------------------------------- |
| Total tasks            | 29                                        |
| Parallel tasks (`[P]`) | 28                                        |
| Sequential tasks       | 1                                         |
| Execution waves        | 7                                         |
| User stories covered   | US1–US5 (US3 via barrel export in Wave 1) |

**MVP scope**: Wave 1–Wave 3 (US1 core path: store + composable + toast bridge)

**Parallel opportunities per wave**:

- Wave 2: 3 tasks — all 3 notification stores (independent files)
- Wave 3: 7 tasks — all composables + attempt store stub (independent files)
- Wave 4: 3 tasks — all OfflineBanner.vue components (independent files)
- Wave 5: 6 tasks — all App.vue + AppLayout.vue modifications (independent across apps)
- Wave 6: 3 tasks — all main.ts modifications (independent files)
- Wave 7: 6 tasks — all test files (independent files)

---

## Wave 1 — UI System Barrel (Prerequisite)

> Sequential prerequisite. Must complete before any app-level implementation.
> Enables `@zidney/ui-system` imports for `Toaster`, `FormMessage`, and all form primitives (US3 inline error pattern).

- [ ] T001 Modify `packages/ui-system/src/components/index.ts` — add `export { Toaster } from './shadcn-vue/sonner'` and export all form primitives (`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`) so apps can `import { Toaster, FormMessage } from '@zidney/ui-system'`

---

## Wave 2 — Notification Store Modifications (All 3 Apps)

> All three tasks are fully parallel — independent files in separate apps.
> Foundational prerequisite for Waves 3–7. No user story tag (infrastructure).

- [ ] T002 [P] Modify `apps/mmc/src/core/state/notification.store.ts` — add `lastPushed` Map, `DEDUP_WINDOW_MS = 2000` const, dedup logic in `push()` (key = `type:title:message`), `VISIBLE_CAP = 5` const, `visibleNotifications` computed (export: `slice(-5)`), `MAX_QUEUE_SIZE = 20` const with eviction, and clear `lastPushed` in `$reset()`
- [ ] T003 [P] Modify `apps/backoffice/src/core/state/notification.store.ts` — same additions as T002: `lastPushed` Map, dedup logic, `DEDUP_WINDOW_MS`, `VISIBLE_CAP`, `visibleNotifications` computed (exported), `MAX_QUEUE_SIZE` with eviction, clear map in `$reset()`
- [ ] T004 [P] Modify `apps/frontoffice/src/core/state/notification.store.ts` — same additions as T002: `lastPushed` Map, dedup logic, `DEDUP_WINDOW_MS`, `VISIBLE_CAP`, `visibleNotifications` computed (exported), `MAX_QUEUE_SIZE` with eviction, clear map in `$reset()`

---

## Wave 3 — Composables + Attempt Store Stub

> All seven tasks are fully parallel — independent files.
> Depends on Wave 2 (stores must exist with `push()` + `visibleNotifications`).

- [ ] T005 [P] [US1] Create `apps/mmc/src/composables/useNotify.ts` — wraps `useMmcNotificationStore`; exposes `{ success, error, warning, info }` with default durations: `success=4000`, `error=undefined` (persistent), `warning=7000`, `info=5000`; `dismissible: true` always; no exam-mode logic
- [ ] T006 [P] [US4] Create `apps/mmc/src/composables/useOfflineBanner.ts` — `useOnline()` from `@vueuse/core`; returns `{ showBanner: computed(() => !isOnline.value) }`
- [ ] T007 [P] [US1] Create `apps/backoffice/src/composables/useNotify.ts` — same pattern as T005, wraps `useBackofficeNotificationStore`; same default durations; `dismissible: true`; no exam-mode logic
- [ ] T008 [P] [US4] Create `apps/backoffice/src/composables/useOfflineBanner.ts` — same as T006: `useOnline()` from `@vueuse/core`; returns `{ showBanner: computed(() => !isOnline.value) }`
- [ ] T009 [P] [US1] Create `apps/frontoffice/src/composables/useNotify.ts` — same base as T005, wraps `useFrontofficeNotificationStore`; same defaults; adds exam-mode guard: if `useAttemptStore().isExamActive === true`, `success()` and `info()` return `""` without pushing; `error()` and `warning()` always push
- [ ] T010 [P] [US4] Create `apps/frontoffice/src/composables/useOfflineBanner.ts` — same as T006: `useOnline()` from `@vueuse/core`; returns `{ showBanner: computed(() => !isOnline.value) }`
- [ ] T011 [P] [US5] Create `apps/frontoffice/src/core/state/attempt.store.ts` — STUB: `defineStore('frontoffice-attempt', () => { const isExamActive = ref(false); return { isExamActive } })`; add `// STUB: replaced by exam engine stage` comment; required by Frontoffice `useNotify.ts`

---

## Wave 4 — OfflineBanner.vue Components

> All three tasks are fully parallel — independent files.
> Depends on Wave 3 (composable `useOfflineBanner` must exist).

- [ ] T012 [P] [US4] Create `apps/mmc/src/components/OfflineBanner.vue` — Vue SFC; `<script setup lang="ts">` uses `useOfflineBanner()`; template: `v-if="showBanner"` full-width div; `role="status"`; `bg-destructive text-destructive-foreground`; `WifiOff` icon from Lucide via `@zidney/ui-system`; text: "Connection lost — working offline. Some features may be unavailable."; no dismiss button
- [ ] T013 [P] [US4] Create `apps/backoffice/src/components/OfflineBanner.vue` — same as T012: `useOfflineBanner()`, `v-if="showBanner"`, `role="status"`, `bg-destructive`, `WifiOff` icon, no dismiss button
- [ ] T014 [P] [US4] Create `apps/frontoffice/src/components/OfflineBanner.vue` — same as T012: `useOfflineBanner()`, `v-if="showBanner"`, `role="status"`, `bg-destructive`, `WifiOff` icon, no dismiss button

---

## Wave 5 — App Shell Mounting

> All six tasks are fully parallel — independent files across separate apps.
> Depends on Wave 4 (OfflineBanner.vue must exist) and Wave 3 (stores + composables).

- [ ] T015 [P] [US1] Modify `apps/mmc/src/App.vue` — add `<Toaster>` inside `<ErrorBoundary>`; add toast bridge in `<script setup>`: `storeToRefs(useMmcNotificationStore())`, `const seen = new Set<string>()`, `watch(visibleNotifications, notifications => { for (n of notifications) { if (seen.has(n.id)) continue; seen.add(n.id); toast[n.type](n.title, { description: n.message, duration: n.duration }) } })`
- [ ] T016 [P] [US1] Modify `apps/backoffice/src/App.vue` — same as T015 using `useBackofficeNotificationStore`; add `<Toaster>` mount, `seen` Set, and `watch(visibleNotifications, ...)` toast bridge
- [ ] T017 [P] [US1] Modify `apps/frontoffice/src/App.vue` — same as T015 using `useFrontofficeNotificationStore`; add `<Toaster>` mount, `seen` Set, and `watch(visibleNotifications, ...)` toast bridge
- [ ] T018 [P] [US4] Modify `apps/mmc/src/components/layout/AppLayout.vue` — add `<OfflineBanner />` as first child within the root layout `div`, before the sidebar; import `OfflineBanner` from `../OfflineBanner.vue`
- [ ] T019 [P] [US4] Modify `apps/backoffice/src/components/layout/AppLayout.vue` — add `<OfflineBanner />` as first child within the root layout `div`, before the sidebar; import `OfflineBanner` from `../OfflineBanner.vue`
- [ ] T020 [P] [US4] Modify `apps/frontoffice/src/components/layout/AppLayout.vue` — add `<OfflineBanner />` as first child within the root layout `div`, before the sidebar; import `OfflineBanner` from `../OfflineBanner.vue`

---

## Wave 6 — Bootstrap / Global Error Handler Wiring

> All three tasks are fully parallel — independent files.
> Depends on Wave 2 (notification stores must be available before main.ts wiring).

- [ ] T021 [P] [US2] Modify `apps/mmc/src/main.ts` — in the `registerGlobalErrorHandlers({ onError })` callback, after existing `appLogger.error(...)`: add `if (!err.isNetworkError) { useMmcNotificationStore().push({ type: 'error', title: 'Unexpected error', message: err.message, dismissible: true }) }` (network errors are handled by offline banner, not toast)
- [ ] T022 [P] [US2] Modify `apps/backoffice/src/main.ts` — same as T021 using `useBackofficeNotificationStore()`; network error guard same: `if (!err.isNetworkError) { ... }`
- [ ] T023 [P] [US2] Modify `apps/frontoffice/src/main.ts` — same as T021 using `useFrontofficeNotificationStore()`; network error guard same: `if (!err.isNetworkError) { ... }`

---

## Wave 7 — Unit Tests

> All six tasks are fully parallel — independent test files.
> Depends on Waves 2–3 (implementations must exist to be tested).
> Test files use `.test.ts` suffix in `apps/*/tests/unit/`.

- [ ] T024 [P] [US1] Create `apps/mmc/tests/unit/stores/notification.store.test.ts` — Vitest unit tests: `push()` returns ID; dedup within 2s returns `""`; dedup after 2s window allowed (`vi.setSystemTime`); queue evicts oldest at 20 entries; `visibleNotifications` capped at 5; `dismiss(id)` removes only target; `clearAll()` empties queue; `$reset()` clears queue AND `lastPushed` map (verify same key re-pushes successfully after reset)
- [ ] T025 [P] [US1] Create `apps/backoffice/tests/unit/stores/notification.store.test.ts` — same test cases as T024 for `useBackofficeNotificationStore`
- [ ] T026 [P] [US1] Create `apps/frontoffice/tests/unit/stores/notification.store.test.ts` — same test cases as T024 for `useFrontofficeNotificationStore`
- [ ] T027 [P] [US1] Create `apps/mmc/tests/unit/composables/useNotify.test.ts` — Vitest unit tests with `createPinia` + `setActivePinia`: `success()` pushes `type:'success'` with `duration:4000`; `error()` pushes with `duration:undefined`; `warning()` pushes with `duration:7000`; `info()` pushes with `duration:5000`; all have `dismissible:true`
- [ ] T028 [P] [US1] Create `apps/backoffice/tests/unit/composables/useNotify.test.ts` — same test cases as T027 for `useBackofficeNotificationStore`-based `useNotify`; no exam-mode tests
- [ ] T029 [P] [US5] Create `apps/frontoffice/tests/unit/composables/useNotify.test.ts` — same base tests as T027 + exam-mode guard: mock `useAttemptStore` with `isExamActive = ref(true)`; assert `success()` returns `""` and queue stays empty; assert `info()` returns `""` and queue stays empty; assert `error()` always pushes (queue length = 1); assert `warning()` always pushes (queue length = 1); then with `isExamActive = ref(false)`: all 4 methods push normally

---

## Dependencies

```
T001
  └─► T002, T003, T004 (Wave 2 — stores add dedup/cap to existing stores)
        └─► T005, T006, T007, T008, T009, T010, T011 (Wave 3 — composables need stores)
              └─► T012, T013, T014 (Wave 4 — OfflineBanner needs useOfflineBanner)
                    └─► T015, T016, T017, T018, T019, T020 (Wave 5 — App shell needs components)
                          └─► T021, T022, T023 (Wave 6 — main.ts needs stores)
                                └─► T024, T025, T026, T027, T028, T029 (Wave 7 — tests need implementations)
```

Note: Wave 6 depends on Wave 2 (notification stores), but not on Waves 3–5. It can be run in parallel with Waves 3–5 if needed.

---

## User Story Coverage

| User Story | Tasks                                                            | Notes                                                                                                                        |
| ---------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| US1        | T005, T007, T009, T015, T016, T017, T024, T025, T026, T027, T028 | Core toast path: store → composable → App.vue bridge                                                                         |
| US2        | T021, T022, T023                                                 | Global error handler wires to notification store                                                                             |
| US3        | T001 (partial)                                                   | Form primitives barrel export enables `<FormMessage>` usage; actual form wiring lives in feature store actions per plan §1.8 |
| US4        | T006, T008, T010, T012, T013, T014, T018, T019, T020             | Offline detection composable + banner component + layout mount                                                               |
| US5        | T011, T029                                                       | Attempt store stub + Frontoffice useNotify exam-mode guard + tests                                                           |

---

## Implementation Notes

- **US3 gap**: No dedicated implementation tasks exist for inline form error binding (FR-012). This is a usage convention: form-bound Pinia store actions must call `setErrors()` from `useForm()` instead of `useNotify().error()` for `VALIDATION_ERROR` codes. Document this pattern in each form submit action. The `<FormMessage>` primitive is available via T001.
- **Wave 5 toast bridge**: The `seen` Set in each App.vue prevents duplicate `toast()` calls when `visibleNotifications` triggers on unrelated reactive updates.
- **Wave 6 ordering**: The `useMmcNotificationStore()` call inside the `onError` callback works because Pinia is initialized before `registerGlobalErrorHandlers` is called in each app's bootstrap sequence.
- **T011 stub**: `attempt.store.ts` defaults `isExamActive: false` — exam mode is always off until the real store replaces this stub in the exam engine stage.
