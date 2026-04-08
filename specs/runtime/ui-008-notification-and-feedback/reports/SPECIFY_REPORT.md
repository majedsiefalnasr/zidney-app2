# Specify Report — STAGE_UI_08_NOTIFICATION_AND_FEEDBACK

**Step:** 1 — Specify
**Timestamp:** 2026-04-07T00:06:00.000Z
**Status:** COMPLETE

---

## Summary

The specification for the Unified Notification and Feedback System has been completed. This stage standardizes how all three Zidney frontend apps (MMC, Backoffice, Frontoffice) surface API-driven feedback to users. The spec leverages existing per-app notification stores and error normalizers introduced in prior stages, extending and aligning them to a common contract.

---

## Inputs Reviewed

- `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_08_NOTIFICATION_AND_FEEDBACK.md`
- `apps/mmc/src/`, `apps/backoffice/src/`, `apps/frontoffice/src/` (existing store patterns)
- `packages/api-client/src/` (existing error handling)

---

## Key Decisions

| #   | Decision                                                                  | Rationale                                             |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Toast component: `Toaster` from `@zidney/ui-system` wrapping `vue-sonner` | Existing component confirmed in ui-system             |
| 2   | Error normalizer: per-app `src/core/errors/error-normalizer.ts`           | Confirmed identical in all 3 apps, not shared package |
| 3   | Deduplication window: 2-second by `type+title+message` hash               | Balances UX and spam prevention                       |
| 4   | ARIA: Native `vue-sonner` live regions (no custom annotations)            | Sufficient for a11y compliance                        |
| 5   | Z-index: `z-[9999]` for toast stack                                       | Above all application overlay layers                  |

---

## Functional Requirements Captured

- **FR-001 → FR-032**: 32 functional requirements across notification store, error handling classification, form feedback, async actions, offline/reconnect, and multi-app behaviors.

## Non-Functional Requirements Captured

- **NFR-001 → NFR-006**: Performance (< 50ms store update), accessibility (ARIA live regions), security, testability, browser compatibility, zero dependencies outside @zidney/ui-system.

## Security Requirements Captured

- **SEC-001 → SEC-006**: No token/stack trace exposure, no raw API response rendering, sanitized messages only, no PII in logs, correlation ID optional.

---

## User Stories Generated (5 total)

| #   | Title                                 | Priority |
| --- | ------------------------------------- | -------- |
| US1 | Error Feedback on API Failure         | P1       |
| US2 | Success and Confirmation Feedback     | P2       |
| US3 | Form Loading and Submission State     | P2       |
| US4 | Offline and Reconnect Banner          | P3       |
| US5 | Exam-Mode Quiet Toasts in Frontoffice | P3       |

---

## Clarification Markers Resolved

- **0 [NEEDS CLARIFICATION] markers** remain. All 5 technical decisions made during specification.

---

## Completion Criteria Summary

19 completion criteria captured in `checklists/requirements.md`:

- Notification store implemented in all 3 apps ✔
- Error normalization layer integrated ✔
- Toast component standardized via @zidney/ui-system ✔
- Form validation consistent (Zod + vee-validate) ✔
- Loading states consistent ✔
- Duplicate prevention (2s window) ✔
- Offline banner implemented ✔
- No raw API error rendering ✔
- CI lint + TypeScript passes ✔

---

## Artifacts Generated

| Artifact               | Path                                                                        |
| ---------------------- | --------------------------------------------------------------------------- |
| Feature Spec           | `specs/runtime/ui-008-notification-and-feedback/spec.md`                    |
| Requirements Checklist | `specs/runtime/ui-008-notification-and-feedback/checklists/requirements.md` |
