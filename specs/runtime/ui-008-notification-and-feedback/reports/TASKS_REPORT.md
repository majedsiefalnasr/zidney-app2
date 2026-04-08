# Tasks Report — Unified Notification and Feedback System

**Step:** 4 — Tasks  
**Timestamp:** 2026-04-07T00:30:00.000Z  
**Status:** COMPLETE

---

## Summary

29 atomic tasks generated across 7 waves for the Unified Notification and Feedback Layer. All tasks are scoped to `apps/mmc`, `apps/backoffice`, `apps/frontoffice`, and `packages/ui-system`. No API, worker, migration, or database tasks required. 28 of 29 tasks are parallelizable within their wave boundary. Wave ordering enforces strict dependency sequencing (T001 barrel prerequisite gates all subsequent waves).

---

## Inputs Reviewed

- `specs/runtime/ui-008-notification-and-feedback/spec.md`
- `specs/runtime/ui-008-notification-and-feedback/plan.md`
- `specs/runtime/ui-008-notification-and-feedback/tasks.md`
- `specs/runtime/ui-008-notification-and-feedback/research.md`

---

## Task Breakdown

| Category                   | Count  | Notes                                                                        |
| -------------------------- | ------ | ---------------------------------------------------------------------------- |
| UI System (shared package) | 1      | T001 — barrel export (Toaster + form primitives)                             |
| Pinia Store modifications  | 3      | T002–T004 — dedup + visible-cap + eviction per app                           |
| Composables                | 7      | T005–T011 — useNotify (×3) + useOfflineBanner (×3) + attempt.store stub (×1) |
| Vue SFC Components         | 3      | T012–T014 — OfflineBanner.vue per app                                        |
| App shell wiring           | 6      | T015–T020 — App.vue (Toaster bridge) + AppLayout.vue (banner mount)          |
| Bootstrap / Error handler  | 3      | T021–T023 — main.ts global error → store.push()                              |
| Unit Tests                 | 6      | T024–T029 — store tests (×3) + useNotify tests (×3)                          |
| **Total**                  | **29** |                                                                              |

---

## Wave Execution Plan

| Wave   | Tasks                                    | Parallel    | Dependency Gate                            |
| ------ | ---------------------------------------- | ----------- | ------------------------------------------ |
| Wave 1 | T001                                     | No          | None (prerequisite)                        |
| Wave 2 | T002, T003, T004                         | Yes (all 3) | T001 complete                              |
| Wave 3 | T005, T006, T007, T008, T009, T010, T011 | Yes (all 7) | Wave 2 complete                            |
| Wave 4 | T012, T013, T014                         | Yes (all 3) | Wave 3 complete                            |
| Wave 5 | T015, T016, T017, T018, T019, T020       | Yes (all 6) | Wave 4 + Wave 3 complete                   |
| Wave 6 | T021, T022, T023                         | Yes (all 3) | Wave 2 complete (independent of Waves 3–5) |
| Wave 7 | T024, T025, T026, T027, T028, T029       | Yes (all 6) | Wave 2 + Wave 3 complete                   |

---

## User Story Coverage

| User Story                  | Tasks                                                            | Coverage               |
| --------------------------- | ---------------------------------------------------------------- | ---------------------- |
| US1 — Toast Notifications   | T005, T007, T009, T015, T016, T017, T024, T025, T026, T027, T028 | Full                   |
| US2 — Global Error Fallback | T021, T022, T023                                                 | Full                   |
| US3 — Inline Form Errors    | T001 (partial)                                                   | Partial — see gap note |
| US4 — Offline Banner        | T006, T008, T010, T012, T013, T014, T018, T019, T020             | Full                   |
| US5 — Exam Mode Guard       | T011, T029                                                       | Full                   |

**US3 Gap:** No dedicated task files for inline form error binding (FR-012). This is a usage convention: form-bound Pinia store actions must call `setErrors()` from `useForm()` instead of `useNotify().error()` for `VALIDATION_ERROR` codes. `<FormMessage>` primitive is available via T001 barrel export. Pattern must be documented in each form submit action.

---

## Transactional Tasks

No database write-path tasks in this stage. All state mutations are in-memory Pinia store operations. Not applicable.

---

## Idempotency Tasks

| Task             | Mechanism                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| T002, T003, T004 | `push()` dedup via `lastPushed` Map — key = `type:title:message`, 2-second window prevents duplicate notifications                          |
| T015, T016, T017 | `seen` Set in App.vue toast bridge prevents duplicate `toast()` calls when `visibleNotifications` re-triggers on unrelated reactive updates |

---

## Architecture Governance Compliance

| Check                                        | Status | Notes                                                                                                             |
| -------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | No DB writes — in-memory Pinia only                                                                               |
| Idempotency tasks are defined where required | ✅     | T002–T004 dedup, T015–T017 seen Set                                                                               |
| Layer boundary rules are respected           | ✅     | UI components import composables only; composables import stores only; stores are pure Pinia; no DB imports in UI |
| No unrelated file modifications planned      | ✅     | All tasks are scoped to notification/feedback domain                                                              |
| Migration tasks included when required       | ✅     | No schema changes — no migration needed                                                                           |
| Trust chain respected                        | ✅     | No authentication, license, or tenant isolation concerns for client-side UI layer                                 |
| Import boundaries respected                  | ✅     | `apps/*` import from `packages/*`; no cross-app imports; T001 is `packages/ui-system` only                        |
| Architecture guard task included             | ✅     | Architecture Guardian verified plan at Step 3 (PASS)                                                              |

**Overall:** COMPLIANT

---

## Risk-Ranked Task Summary

| Task ID | Risk      | Description                                                                                   |
| ------- | --------- | --------------------------------------------------------------------------------------------- |
| T001    | 🟡 MEDIUM | Modify ui-system barrel — shared package export touches all consuming apps                    |
| T002    | 🟡 MEDIUM | Modify notification.store.ts (MMC) — store mutation with dedup logic                          |
| T003    | 🟡 MEDIUM | Modify notification.store.ts (Backoffice) — store mutation with dedup logic                   |
| T004    | 🟡 MEDIUM | Modify notification.store.ts (Frontoffice) — store mutation with dedup logic                  |
| T005    | 🟢 LOW    | Create useNotify.ts (MMC) — new composable, no existing code affected                         |
| T006    | 🟢 LOW    | Create useOfflineBanner.ts (MMC) — new composable                                             |
| T007    | 🟢 LOW    | Create useNotify.ts (Backoffice) — new composable                                             |
| T008    | 🟢 LOW    | Create useOfflineBanner.ts (Backoffice) — new composable                                      |
| T009    | 🟡 MEDIUM | Create useNotify.ts (Frontoffice) — exam-mode guard logic touches attempt store               |
| T010    | 🟢 LOW    | Create useOfflineBanner.ts (Frontoffice) — new composable                                     |
| T011    | 🟡 MEDIUM | Create attempt.store.ts stub (Frontoffice) — must not conflict with future exam engine stage  |
| T012    | 🟢 LOW    | Create OfflineBanner.vue (MMC) — new component                                                |
| T013    | 🟢 LOW    | Create OfflineBanner.vue (Backoffice) — new component                                         |
| T014    | 🟢 LOW    | Create OfflineBanner.vue (Frontoffice) — new component                                        |
| T015    | 🟡 MEDIUM | Modify App.vue (MMC) — adds Toaster mount + watch bridge to root component                    |
| T016    | 🟡 MEDIUM | Modify App.vue (Backoffice) — adds Toaster mount + watch bridge to root component             |
| T017    | 🟡 MEDIUM | Modify App.vue (Frontoffice) — adds Toaster mount + watch bridge to root component            |
| T018    | 🟢 LOW    | Modify AppLayout.vue (MMC) — add OfflineBanner as first child                                 |
| T019    | 🟢 LOW    | Modify AppLayout.vue (Backoffice) — add OfflineBanner as first child                          |
| T020    | 🟢 LOW    | Modify AppLayout.vue (Frontoffice) — add OfflineBanner as first child                         |
| T021    | 🟡 MEDIUM | Modify main.ts (MMC) — global error handler now pushes to notification store                  |
| T022    | 🟡 MEDIUM | Modify main.ts (Backoffice) — global error handler now pushes to notification store           |
| T023    | 🟡 MEDIUM | Modify main.ts (Frontoffice) — global error handler now pushes to notification store          |
| T024    | 🟢 LOW    | Create notification.store.test.ts (MMC) — unit tests only                                     |
| T025    | 🟢 LOW    | Create notification.store.test.ts (Backoffice) — unit tests only                              |
| T026    | 🟢 LOW    | Create notification.store.test.ts (Frontoffice) — unit tests only                             |
| T027    | 🟢 LOW    | Create useNotify.test.ts (MMC) — unit tests only                                              |
| T028    | 🟢 LOW    | Create useNotify.test.ts (Backoffice) — unit tests only                                       |
| T029    | 🟢 LOW    | Create useNotify.test.ts (Frontoffice) — unit tests only, includes exam-mode guard assertions |

---

## Tasks with External Dependencies

| Task ID          | Package                                | Version Note                                                                                            |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| T001             | `vue-sonner` (via `@zidney/ui-system`) | Toaster re-export — verified barrel structure at `packages/ui-system/src/components/shadcn-vue/sonner/` |
| T006, T008, T010 | `@vueuse/core`                         | `useOnline()` — verified available in all frontend apps via existing imports                            |
| T015, T016, T017 | `vue-sonner`                           | `toast()` function imported at top of App.vue                                                           |

---

## High-Downstream-Impact Tasks

These tasks modify architectural hotspots — extra review attention recommended.

| Task ID   | Module                                        | Impact                       | Description                                                                  |
| --------- | --------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| T001      | `packages/ui-system`                          | HIGH — shared by all apps    | Barrel export change affects all apps importing from `@zidney/ui-system`     |
| T002–T004 | `apps/*/src/core/state/notification.store.ts` | HIGH — used throughout app   | Store modifications affect all components that import the notification store |
| T015–T017 | `apps/*/src/App.vue`                          | HIGH — root component        | Root component modifications affect app initialization sequence              |
| T021–T023 | `apps/*/src/main.ts`                          | HIGH — bootstrap entry point | Error handler wiring affects all unhandled errors across the app             |

---

## Open Risks

| Risk                    | Severity | Mitigation                                                                                                                                                                               |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T011 stub conflict      | MEDIUM   | `attempt.store.ts` stub must be replaced entirely by exam engine stage — do not extend it; mark clearly with `// STUB` comment                                                           |
| T001 barrel scope creep | LOW      | Only add `Toaster` and form primitives — do not add other unrelated exports                                                                                                              |
| Wave 6 / Wave 5 race    | LOW      | main.ts wiring (Wave 6) uses `useFrontofficeNotificationStore()` which is initialized in bootstrap before error handler registration — safe; documented in tasks.md implementation notes |
| App.vue seen Set memory | LOW      | `seen` Set grows unbounded on long sessions — acceptable for notification dedup; `visibleNotifications` cap at 5 limits practical max entries                                            |

---

## Next Step

Proceed to Step 5 — Analyze.
