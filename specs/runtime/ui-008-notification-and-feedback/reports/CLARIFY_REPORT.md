# Clarify Report — STAGE_UI_08_NOTIFICATION_AND_FEEDBACK

**Step:** 2 — Clarify
**Timestamp:** 2026-04-07T00:11:00.000Z
**Status:** COMPLETE

---

## Summary

5 targeted ambiguities were identified in the specification and resolved. No blockers found. All clarifications are decisions that can be directly implemented. Security and performance checklists generated.

---

## Inputs Reviewed

- `specs/runtime/ui-008-notification-and-feedback/spec.md` (including `## Clarifications / Session 2026-04-07`)

---

## Clarifications Resolved

| #   | Question                                              | Resolution                                                                                                            | Impact                                       |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | How is the 2-second deduplication window implemented? | Private `lastPushed: Map<string, number>` in store; cleared on `$reset()` / `clearAll()`                              | Implementation detail for notification store |
| 2   | What is the typed `AppError` interface?               | From `@zidney/api-client`: `{ code, message, isNetworkError, statusCode?, correlationId? }` — never redeclare locally | Import path enforcement                      |
| 3   | Are notifications cleared on route navigation?        | No — only logout flows may call `clearAll()`. Router guards must not clear toasts                                     | Route guard implementation constraint        |
| 4   | How does Frontoffice detect exam mode?                | `useNotify()` composable checks `useAttemptStore().isExamActive`. Notification store has no exam knowledge            | Composable-level logic only                  |
| 5   | How are offline requests queued?                      | Out of scope — no request queuing. `useOfflineBanner` controls banner only                                            | Explicit scope boundary confirmed            |

---

## Open Items

None. All ambiguities resolved.

---

## Risk Assessment

| Risk                                     | Level  | Mitigation                                                      |
| ---------------------------------------- | ------ | --------------------------------------------------------------- |
| Race condition in duplicate prevention   | LOW    | `lastPushed` Map approach is single-threaded (Vue reactivity)   |
| `AppError` import coupling to api-client | MEDIUM | Per-app normalizers already import from api-client — consistent |
| Exam mode composable dependency          | LOW    | Frontoffice only; other apps unaffected                         |

---

## Artifacts Generated

| Artifact              | Path                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| Security Checklist    | `specs/runtime/ui-008-notification-and-feedback/checklists/security-checklist.md` (22 items)    |
| Performance Checklist | `specs/runtime/ui-008-notification-and-feedback/checklists/performance-checklist.md` (26 items) |
