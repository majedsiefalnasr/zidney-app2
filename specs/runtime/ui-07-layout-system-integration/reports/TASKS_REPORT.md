# Tasks Report — STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION

**Step:** 4 — Tasks **Timestamp:** 2026-03-05T00:00:00Z **Status:** COMPLETE

---

## Summary

51 atomic tasks generated across 13 phases covering the full Layout System Integration
implementation for MMC, Backoffice, and Frontoffice. All tasks are dependency-ordered with 14
independent parallel groups identified.

No dependency conflicts found. Four ordering concerns are documented below and accounted for in task
sequencing.

---

## Inputs Reviewed

- `specs/runtime/ui-07-layout-system-integration/spec.md`
- `specs/runtime/ui-07-layout-system-integration/plan.md`
- `specs/runtime/ui-07-layout-system-integration/tasks.md`

---

## Task Breakdown

| Phase | Category                      | Tasks     | Count  | Notes                                                               |
| ----- | ----------------------------- | --------- | ------ | ------------------------------------------------------------------- |
| 1     | Dependency & Store Foundation | T001–T007 | 7      | ui.store + auth.store extension across 3 apps; T001 hard-blocks MMC |
| 2     | Types & Configuration         | T008–T013 | 6      | RouteMeta + NavigationConfig per app; all parallelizable            |
| 3     | Composables                   | T014–T016 | 3      | useBreakpoint per app; all parallelizable                           |
| 4a    | AppHeader Components          | T017–T019 | 3      | Per app; parallelizable after stores + composables                  |
| 4b    | AppSidebar Components         | T020–T022 | 3      | Per app; depends on nav config + resolvedPermissions                |
| 4c    | AppLayout Components          | T023–T025 | 3      | Per app; depends on AppHeader + AppSidebar                          |
| 5     | App Integration               | T026–T033 | 8      | App.vue updates + BackofficeLayout.vue removal + route cleanup      |
| 6a    | Store Extension Tests         | T034–T036 | 3      | Pinia testing for sidebar/mobile state; parallelizable              |
| 6b    | useBreakpoint Tests           | T037–T039 | 3      | Composable mock + resize simulation; parallelizable                 |
| 6c    | AppHeader Unit Tests          | T040–T042 | 3      | Display, logout, workspace context; parallelizable                  |
| 6d    | AppSidebar Unit Tests         | T043–T045 | 3      | Nav rendering, permission filtering, toggle; parallelizable         |
| 6e    | AppLayout Unit Tests          | T046–T048 | 3      | Shell structure, standalone bypass, slot injection; parallelizable  |
| 6f    | Integration Tests             | T049–T051 | 3      | Full shell render per app; parallelizable                           |
| —     | **Total**                     | T001–T051 | **51** | —                                                                   |

---

## Transactional Tasks

Not applicable — layout layer performs no DB write operations. All state changes are pure in-memory
Pinia store mutations.

---

## Idempotency Tasks

Not applicable — layout rendering and store state management are inherently idempotent. Multiple
calls to `toggleSidebar()` or `setMobile()` produce consistent, predictable state.

---

## Ordering Concerns

1. **T001 (MMC @zidney/ui-system) hard-blocks T002, T014, T017, T020, T023** — Backoffice and
   Frontoffice tasks can proceed in parallel while MMC waits.
2. **T032/T033 strict ordering** — `BackofficeLayout.vue` (T032) must not be deleted until App.vue
   update (T027) and standalone routes (T030) are complete. Premature deletion breaks Backoffice
   routing.
3. **RouteMeta augmentation before route file edits** — T029–T031 require T008–T010 to be in place;
   TypeScript strict mode will reject route meta assignments until the augmentation is registered.
4. **`<router-view>` placement clarification** — AppLayout.vue contains its own `<router-view />`.
   App.vue must NOT pass `<router-view>` as a slot child to avoid dead slot content (architecture
   checker finding).

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                  |
| -------------------------------------------- | ------ | ------------------------------------------------------ |
| All write paths include transaction tasks    | ✅     | No DB writes — not applicable                          |
| Idempotency tasks are defined where required | ✅     | No write operations — not applicable                   |
| Layer boundary rules are respected           | ✅     | All layout tasks scoped to own-app `src/` directories  |
| No unrelated file modifications planned      | ✅     | Only layout, store, composable, and test files touched |
| Migration tasks included when required       | ✅     | No migrations — UI-only stage                          |
| Import boundary rules enforced in tasks      | ✅     | No cross-app file references in any task               |

**Overall:** COMPLIANT

---

## Next Step

Proceed to Step 5 — Analyze (Drift Detector).
